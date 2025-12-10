import { Vector2, Vector3 } from "three";
import { Fragment } from "../entities/Fragment";
import { sliceFragment } from "./SliceFragment";

/**
 * Represents a bisecting plane between two Voronoi seed points
 */
export interface BisectingPlane {
  /** The origin point on the plane (midpoint between seeds) */
  origin: Vector3;
  /** The normal vector of the plane (points from seed1 towards seed2) */
  normal: Vector3;
}

/**
 * Computes the bisecting plane between two seed points.
 * The plane is perpendicular to the line connecting the seeds and passes through their midpoint.
 * The normal points from seed1 towards seed2.
 *
 * @param seed1 The first seed point
 * @param seed2 The second seed point
 * @returns The bisecting plane
 */
export function computeBisectingPlane(
  seed1: Vector3,
  seed2: Vector3,
): BisectingPlane {
  // Midpoint between the two seeds
  const origin = new Vector3(
    (seed1.x + seed2.x) / 2,
    (seed1.y + seed2.y) / 2,
    (seed1.z + seed2.z) / 2,
  );

  // Normal vector points from seed1 to seed2
  const normal = new Vector3(
    seed2.x - seed1.x,
    seed2.y - seed1.y,
    seed2.z - seed1.z,
  ).normalize();

  return { origin, normal };
}

/**
 * Computes an anisotropic bisecting plane between two seed points.
 * Uses a scaled distance metric that creates elongated Voronoi cells along the grain direction.
 *
 * The anisotropic distance metric is:
 *   aniso_dist²(P, S) = |P - S|² - (1 - 1/A²) · dot(P - S, G)²
 *
 * This causes cells to be elongated along the grain direction G by factor A.
 *
 * @param seed1 The first seed point
 * @param seed2 The second seed point
 * @param grainDirection Normalized direction of grain/elongation
 * @param anisotropy Factor controlling elongation (1.0 = isotropic, >1 = elongated along grain)
 * @returns The anisotropic bisecting plane
 */
export function computeAnisotropicBisectingPlane(
  seed1: Vector3,
  seed2: Vector3,
  grainDirection: Vector3,
  anisotropy: number,
): BisectingPlane {
  // Origin stays at midpoint (unchanged from isotropic case)
  const origin = new Vector3(
    (seed1.x + seed2.x) / 2,
    (seed1.y + seed2.y) / 2,
    (seed1.z + seed2.z) / 2,
  );

  // D = vector from seed1 to seed2
  const D = new Vector3(
    seed2.x - seed1.x,
    seed2.y - seed1.y,
    seed2.z - seed1.z,
  );

  // Anisotropic factor: (1 - 1/A²)
  // When A = 1, factor = 0, giving standard isotropic Voronoi
  // When A > 1, factor approaches 1, giving maximum elongation
  // Guard against divide by zero and invalid values (anisotropy must be >= 1.0)
  const clampedAnisotropy = Math.max(1.0, anisotropy);
  const factor = 1 - 1 / (clampedAnisotropy * clampedAnisotropy);

  // Dot product of D with grain direction
  const dotDG = D.dot(grainDirection);

  // Modified normal: D - factor · dot(D, G) · G
  // This tilts the bisecting plane to give more space to cells aligned with grain
  const normal = D.clone()
    .sub(grainDirection.clone().multiplyScalar(factor * dotDG))
    .normalize();

  return { origin, normal };
}

/**
 * Computes a single Voronoi cell by applying sequential half-space intersections.
 * Starts with the input fragment and carves it down by slicing with bisecting planes.
 *
 * @param fragment The initial fragment (typically the full mesh or bounding box)
 * @param seedIndex The index of the seed point for this cell
 * @param seeds All seed points
 * @param neighborIndices Indices of neighboring seeds (if null, uses all other seeds)
 * @param textureScale Texture scale for cut faces
 * @param textureOffset Texture offset for cut faces
 * @param convex Whether to use convex triangulation mode
 * @param grainDirection Optional grain direction for anisotropic Voronoi (must be normalized)
 * @param anisotropy Optional anisotropy factor (1.0 = isotropic, >1 = elongated along grain)
 * @returns The computed Voronoi cell fragment, or null if the cell is empty
 */
export function computeVoronoiCell(
  fragment: Fragment,
  seedIndex: number,
  seeds: Vector3[],
  neighborIndices: number[] | null,
  textureScale: Vector2,
  textureOffset: Vector2,
  convex: boolean,
  grainDirection?: Vector3,
  anisotropy?: number,
): Fragment | null {
  let cell = fragment;
  const thisSeed = seeds[seedIndex];

  // Determine which seeds are neighbors
  const neighbors = neighborIndices || getAllNeighbors(seedIndex, seeds.length);

  // Check if we should use anisotropic mode
  const useAnisotropic =
    grainDirection !== undefined &&
    anisotropy !== undefined &&
    anisotropy > 1.0;

  // Apply half-space intersection for each neighbor
  for (const neighborIndex of neighbors) {
    const neighborSeed = seeds[neighborIndex];

    // Compute the bisecting plane between this seed and the neighbor
    // Use anisotropic version if grain parameters are provided
    const plane = useAnisotropic
      ? computeAnisotropicBisectingPlane(
          thisSeed,
          neighborSeed,
          grainDirection!,
          anisotropy!,
        )
      : computeBisectingPlane(thisSeed, neighborSeed);

    // Slice the current cell with this plane
    // We want to keep the side closer to thisSeed (the "bottom" side since normal points away)
    const { bottomSlice } = sliceFragment(
      cell,
      plane.normal,
      plane.origin,
      textureScale,
      textureOffset,
      convex,
    );

    // Keep the half-space closer to our seed (opposite direction of normal)
    cell = bottomSlice;

    // Early termination: if cell becomes empty, no need to continue
    if (cell.vertexCount === 0) {
      return null;
    }
  }

  return cell;
}

/**
 * Returns indices of all seeds except the given seed index.
 * This is a naive approach that considers all other seeds as neighbors.
 * Can be optimized later with spatial acceleration structures.
 *
 * @param seedIndex The index to exclude
 * @param totalSeeds Total number of seeds
 * @returns Array of neighbor indices
 */
function getAllNeighbors(seedIndex: number, totalSeeds: number): number[] {
  const neighbors: number[] = [];
  for (let i = 0; i < totalSeeds; i++) {
    if (i !== seedIndex) {
      neighbors.push(i);
    }
  }
  return neighbors;
}

/**
 * Finds K nearest neighbors for a seed point using brute force distance calculation.
 * This is a simple O(n log n) approach suitable for small seed counts.
 * For real-time performance with many seeds, this should be replaced with a spatial structure.
 *
 * @param seedIndex The index of the seed to find neighbors for
 * @param seeds All seed points
 * @param k Number of nearest neighbors to find
 * @returns Array of neighbor indices sorted by distance
 */
export function findKNearestNeighbors(
  seedIndex: number,
  seeds: Vector3[],
  k: number,
): number[] {
  const thisSeed = seeds[seedIndex];
  const distances: { index: number; distance: number }[] = [];

  // Calculate distance to all other seeds
  for (let i = 0; i < seeds.length; i++) {
    if (i === seedIndex) continue;

    const dx = seeds[i].x - thisSeed.x;
    const dy = seeds[i].y - thisSeed.y;
    const dz = seeds[i].z - thisSeed.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    distances.push({ index: i, distance });
  }

  // Sort by distance and take k nearest
  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, Math.min(k, distances.length)).map((d) => d.index);
}
