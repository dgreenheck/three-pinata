import { Vector3 } from "./Vector3";
import { Box3 } from "./Box3";

/**
 * Generates seed points for Voronoi fracturing
 */
export class SeedPointGenerator {
  /**
   * Generates uniformly distributed random seed points within a bounding box
   * @param bounds The bounding box to generate seeds within
   * @param count Number of seed points to generate
   * @returns Array of seed points
   */
  static generateUniform(bounds: Box3, count: number): Vector3[] {
    const seeds: Vector3[] = [];
    const min = bounds.min;
    const max = bounds.max;

    for (let i = 0; i < count; i++) {
      seeds.push(
        new Vector3(
          min.x + Math.random() * (max.x - min.x),
          min.y + Math.random() * (max.y - min.y),
          min.z + Math.random() * (max.z - min.z),
        ),
      );
    }

    return seeds;
  }

  /**
   * Generates seed points with higher density near an impact point
   * Uses a hybrid approach: some seeds clustered near impact, others uniform
   * @param bounds The bounding box to generate seeds within
   * @param count Number of seed points to generate
   * @param impactPoint The point of impact
   * @param impactRadius Radius around impact point where density is highest
   * @returns Array of seed points
   */
  static generateImpactBased(
    bounds: Box3,
    count: number,
    impactPoint: Vector3,
    impactRadius: number,
  ): Vector3[] {
    const seeds: Vector3[] = [];

    // Clamp impact point to bounds to ensure it's inside the mesh
    const clampedImpact = new Vector3(
      Math.max(bounds.min.x, Math.min(bounds.max.x, impactPoint.x)),
      Math.max(bounds.min.y, Math.min(bounds.max.y, impactPoint.y)),
      Math.max(bounds.min.z, Math.min(bounds.max.z, impactPoint.z)),
    );

    // Generate 60% of seeds near impact point, 40% uniformly distributed
    const impactCount = Math.floor(count * 0.6);
    const uniformCount = count - impactCount;

    // Generate seeds near impact using spherical distribution with falloff
    for (let i = 0; i < impactCount; i++) {
      // Use power distribution to bias towards center
      // Random value between 0-1, raised to power > 1 biases towards 0
      const r = Math.pow(Math.random(), 2.0) * impactRadius;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);

      const x = clampedImpact.x + r * Math.sin(phi) * Math.cos(theta);
      const y = clampedImpact.y + r * Math.sin(phi) * Math.sin(theta);
      const z = clampedImpact.z + r * Math.cos(phi);

      // Clamp to bounds
      seeds.push(
        new Vector3(
          Math.max(bounds.min.x, Math.min(bounds.max.x, x)),
          Math.max(bounds.min.y, Math.min(bounds.max.y, y)),
          Math.max(bounds.min.z, Math.min(bounds.max.z, z)),
        ),
      );
    }

    // Add uniform seeds for variation
    seeds.push(...this.generateUniform(bounds, uniformCount));

    return seeds;
  }

  /**
   * Generates seed points for 2.5D Voronoi fracturing
   * Creates a 2D pattern in one plane and extrudes through the mesh
   * @param bounds The bounding box to generate seeds within
   * @param count Number of seed points to generate
   * @param axis The axis along which to generate the pattern ('x', 'y', or 'z')
   * @returns Array of seed points in 3D space
   */
  static generate2D(
    bounds: Box3,
    count: number,
    axis: "x" | "y" | "z",
  ): Vector3[] {
    const seeds: Vector3[] = [];
    const min = bounds.min;
    const max = bounds.max;
    const center = new Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    );

    for (let i = 0; i < count; i++) {
      let seed: Vector3;

      if (axis === "x") {
        // Generate points in YZ plane at center X
        seed = new Vector3(
          center.x,
          min.y + Math.random() * (max.y - min.y),
          min.z + Math.random() * (max.z - min.z),
        );
      } else if (axis === "y") {
        // Generate points in XZ plane at center Y
        seed = new Vector3(
          min.x + Math.random() * (max.x - min.x),
          center.y,
          min.z + Math.random() * (max.z - min.z),
        );
      } else {
        // axis === 'z'
        // Generate points in XY plane at center Z
        seed = new Vector3(
          min.x + Math.random() * (max.x - min.x),
          min.y + Math.random() * (max.y - min.y),
          center.z,
        );
      }

      seeds.push(seed);
    }

    return seeds;
  }

  /**
   * Generates 2D seed points with higher density near an impact point
   * Seeds remain on a plane (for 2.5D mode) but cluster around impact
   * @param bounds The bounding box to generate seeds within
   * @param count Number of seed points to generate
   * @param impactPoint The point of impact
   * @param impactRadius Radius around impact point where density is highest
   * @param axis The axis along which to generate the pattern ('x', 'y', or 'z')
   * @returns Array of seed points on the specified plane
   */
  static generate2DImpactBased(
    bounds: Box3,
    count: number,
    impactPoint: Vector3,
    impactRadius: number,
    axis: "x" | "y" | "z",
  ): Vector3[] {
    const seeds: Vector3[] = [];
    const min = bounds.min;
    const max = bounds.max;
    const center = new Vector3(
      (min.x + max.x) / 2,
      (min.y + max.y) / 2,
      (min.z + max.z) / 2,
    );

    // Project impact point onto the plane
    let projectedImpact: Vector3;
    if (axis === "x") {
      projectedImpact = new Vector3(center.x, impactPoint.y, impactPoint.z);
    } else if (axis === "y") {
      projectedImpact = new Vector3(impactPoint.x, center.y, impactPoint.z);
    } else {
      // axis === 'z'
      projectedImpact = new Vector3(impactPoint.x, impactPoint.y, center.z);
    }

    // Generate 60% of seeds near impact point, 40% uniformly distributed
    const impactCount = Math.floor(count * 0.6);
    const uniformCount = count - impactCount;

    // Generate seeds near impact using 2D distribution
    for (let i = 0; i < impactCount; i++) {
      // Use power distribution to bias towards center (in 2D)
      const r = Math.pow(Math.random(), 2.0) * impactRadius;
      const theta = Math.random() * 2 * Math.PI;

      let seed: Vector3;
      if (axis === "x") {
        // Generate in YZ plane at center X
        const y = projectedImpact.y + r * Math.cos(theta);
        const z = projectedImpact.z + r * Math.sin(theta);
        seed = new Vector3(
          center.x,
          Math.max(min.y, Math.min(max.y, y)),
          Math.max(min.z, Math.min(max.z, z)),
        );
      } else if (axis === "y") {
        // Generate in XZ plane at center Y
        const x = projectedImpact.x + r * Math.cos(theta);
        const z = projectedImpact.z + r * Math.sin(theta);
        seed = new Vector3(
          Math.max(min.x, Math.min(max.x, x)),
          center.y,
          Math.max(min.z, Math.min(max.z, z)),
        );
      } else {
        // axis === 'z', generate in XY plane at center Z
        const x = projectedImpact.x + r * Math.cos(theta);
        const y = projectedImpact.y + r * Math.sin(theta);
        seed = new Vector3(
          Math.max(min.x, Math.min(max.x, x)),
          Math.max(min.y, Math.min(max.y, y)),
          center.z,
        );
      }

      seeds.push(seed);
    }

    // Add uniform 2D seeds for variation
    seeds.push(...this.generate2D(bounds, uniformCount, axis));

    return seeds;
  }

  /**
   * Automatically determines the best projection axis for 2.5D mode
   * based on mesh dimensions (chooses the shortest dimension)
   * @param bounds The bounding box of the mesh
   * @returns The axis perpendicular to the largest face
   */
  static determineBestProjectionAxis(bounds: Box3): "x" | "y" | "z" {
    const size = new Vector3(
      bounds.max.x - bounds.min.x,
      bounds.max.y - bounds.min.y,
      bounds.max.z - bounds.min.z,
    );

    // Choose axis with smallest extent (thinnest dimension)
    if (size.x <= size.y && size.x <= size.z) {
      return "x";
    } else if (size.y <= size.x && size.y <= size.z) {
      return "y";
    } else {
      return "z";
    }
  }
}
