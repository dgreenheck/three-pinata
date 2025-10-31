import * as THREE from "three";
import { Vector3 } from "three";
import { VoronoiFractureOptions } from "../entities/VoronoiFractureOptions";
import { SeedPointGenerator } from "../utils/SeedPointGenerator";
import { computeVoronoiCell, findKNearestNeighbors } from "./VoronoiCell";
import { geometryToFragment, fragmentToGeometry } from "../utils/GeometryConversion";
import { Fragment } from "../entities/Fragment";
import { findIsolatedGeometry } from "./FractureFragment";

/**
 * Fractures a mesh using Voronoi tessellation.
 * Creates more visually appealing fracture patterns compared to recursive slicing.
 *
 * @param geometry The source geometry to fracture
 * @param options Options for Voronoi fracturing
 * @returns Array of fractured geometry pieces
 */
export function voronoiFracture(
  geometry: THREE.BufferGeometry,
  options: VoronoiFractureOptions,
): THREE.BufferGeometry[] {
  // Convert input geometry to internal fragment representation
  const sourceFragment = geometryToFragment(geometry);

  // Generate Voronoi cells based on mode
  let fragments: Fragment[];

  if (options.mode === "3D") {
    fragments = voronoiFracture3D(sourceFragment, options);
  } else {
    fragments = voronoiFracture2D(sourceFragment, options);
  }

  // Convert fragments back to THREE.BufferGeometry
  return fragments.map((fragment) => fragmentToGeometry(fragment));
}

/**
 * Performs 3D Voronoi fracturing using half-space intersections
 *
 * @param sourceFragment The source fragment to fracture
 * @param options Voronoi fracture options
 * @returns Array of Voronoi cell fragments
 */
function voronoiFracture3D(
  sourceFragment: Fragment,
  options: VoronoiFractureOptions,
): Fragment[] {
  // Step 1: Generate or use provided seed points
  const seeds = generateSeeds(sourceFragment, options);

  // Step 2: Compute Voronoi cells for each seed
  const fragments: Fragment[] = [];
  const convex = options.fractureMode === "Convex";

  // Use approximation based on user option (not automatic threshold)
  const useKNearest = options.useApproximation;
  const k = Math.min(
    options.approximationNeighborCount,
    seeds.length - 1,
  );

  // Warn user if approximation is enabled
  if (useKNearest) {
    console.warn(
      `⚠️ Voronoi approximation enabled (k=${k} neighbors). This may cause fragment overlaps.`,
      `\nFor accurate results with no overlaps, set useApproximation: false in VoronoiFractureOptions.`,
    );
  }

  for (let i = 0; i < seeds.length; i++) {
    // Clone the source fragment for each cell
    const cellFragment = cloneFragment(sourceFragment);

    // Find neighbors for this seed
    const neighborIndices = useKNearest
      ? findKNearestNeighbors(i, seeds, k)
      : null; // null means use all other seeds

    // Compute the Voronoi cell by sequential half-space intersections
    const cell = computeVoronoiCell(
      cellFragment,
      i,
      seeds,
      neighborIndices,
      options.textureScale,
      options.textureOffset,
      convex,
    );

    // Only add non-empty cells
    if (cell && cell.vertexCount > 0) {
      // Detect isolated fragments within this cell if enabled
      if (options.detectIsolatedFragments && !convex) {
        const isolatedFragments = findIsolatedGeometry(cell);
        fragments.push(...isolatedFragments);
      } else {
        fragments.push(cell);
      }
    }
  }

  return fragments;
}

/**
 * Performs 2.5D Voronoi fracturing by projecting a 2D pattern through the mesh
 *
 * @param sourceFragment The source fragment to fracture
 * @param options Voronoi fracture options
 * @returns Array of fragments
 */
function voronoiFracture2D(
  sourceFragment: Fragment,
  options: VoronoiFractureOptions,
): Fragment[] {
  // Calculate bounds
  sourceFragment.calculateBounds();

  // Determine projection axis
  let axis: "x" | "y" | "z";

  if (options.projectionNormal) {
    // Determine axis from projection normal (choose axis most aligned with normal)
    const normal = options.projectionNormal;
    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absX > absY && absX > absZ) {
      axis = "x";
    } else if (absY > absX && absY > absZ) {
      axis = "y";
    } else {
      axis = "z";
    }
  } else {
    // Fall back to projectionAxis or auto-detect
    const axisOption = options.projectionAxis || "auto";
    if (axisOption === "auto") {
      axis = SeedPointGenerator.determineBestProjectionAxis(
        sourceFragment.bounds,
      );
    } else {
      axis = axisOption;
    }
  }

  // Generate seed points (use impact-based if impact point provided, otherwise 2D uniform)
  let seeds: Vector3[];
  if (options.seedPoints) {
    seeds = options.seedPoints;
  } else if (options.impactPoint) {
    // Use 2D impact-based generation to keep seeds on a plane
    const radius = options.impactRadius ||
      Math.min(
        sourceFragment.bounds.max.x - sourceFragment.bounds.min.x,
        sourceFragment.bounds.max.y - sourceFragment.bounds.min.y,
        sourceFragment.bounds.max.z - sourceFragment.bounds.min.z,
      ) * 0.3;

    seeds = SeedPointGenerator.generate2DImpactBased(
      sourceFragment.bounds,
      options.fragmentCount,
      options.impactPoint,
      radius,
      axis as "x" | "y" | "z",
    );
  } else {
    seeds = SeedPointGenerator.generate2D(
      sourceFragment.bounds,
      options.fragmentCount,
      axis as "x" | "y" | "z",
    );
  }

  // For 2.5D, we still use the 3D algorithm but with seeds on a plane
  // The cells will naturally extend through the mesh along the projection axis
  const fragments: Fragment[] = [];
  const convex = options.fractureMode === "Convex";

  // Use approximation based on user option (for 2.5D, defaults can be slightly lower)
  const useKNearest = options.useApproximation;
  const k = Math.min(
    options.approximationNeighborCount,
    seeds.length - 1,
  );

  // Warn user if approximation is enabled
  if (useKNearest) {
    console.warn(
      `⚠️ Voronoi 2.5D approximation enabled (k=${k} neighbors). This may cause fragment overlaps.`,
      `\nFor accurate results with no overlaps, set useApproximation: false in VoronoiFractureOptions.`,
    );
  }

  for (let i = 0; i < seeds.length; i++) {
    const cellFragment = cloneFragment(sourceFragment);

    // Find neighbors for this seed
    const neighborIndices = useKNearest
      ? findKNearestNeighbors(i, seeds, k)
      : null;

    const cell = computeVoronoiCell(
      cellFragment,
      i,
      seeds,
      neighborIndices,
      options.textureScale,
      options.textureOffset,
      convex,
    );

    if (cell && cell.vertexCount > 0) {
      // Detect isolated fragments within this cell if enabled
      if (options.detectIsolatedFragments && !convex) {
        const isolatedFragments = findIsolatedGeometry(cell);
        fragments.push(...isolatedFragments);
      } else {
        fragments.push(cell);
      }
    }
  }

  return fragments;
}

/**
 * Generates seed points based on options
 *
 * @param fragment The fragment to generate seeds for
 * @param options Voronoi fracture options
 * @returns Array of seed points
 */
function generateSeeds(
  fragment: Fragment,
  options: VoronoiFractureOptions,
): Vector3[] {
  // Use provided seeds if available
  if (options.seedPoints && options.seedPoints.length > 0) {
    return options.seedPoints;
  }

  // Calculate bounds if not already done
  if (!fragment.bounds) {
    fragment.calculateBounds();
  }

  // Generate seeds based on impact point or uniform distribution
  if (options.impactPoint) {
    const radius = options.impactRadius ||
      Math.min(
        fragment.bounds.max.x - fragment.bounds.min.x,
        fragment.bounds.max.y - fragment.bounds.min.y,
        fragment.bounds.max.z - fragment.bounds.min.z,
      ) * 0.3; // Default to 30% of smallest dimension

    return SeedPointGenerator.generateImpactBased(
      fragment.bounds,
      options.fragmentCount,
      options.impactPoint,
      radius,
    );
  } else {
    return SeedPointGenerator.generateUniform(
      fragment.bounds,
      options.fragmentCount,
    );
  }
}

/**
 * Creates a deep clone of a fragment
 * This is needed because each Voronoi cell computation modifies the fragment
 *
 * @param fragment The fragment to clone
 * @returns A deep copy of the fragment
 */
function cloneFragment(fragment: Fragment): Fragment {
  const cloned = new Fragment();

  // Clone vertices
  cloned.vertices = fragment.vertices.map((v) => v.clone());

  // Clone cut vertices (initially empty for source fragment)
  cloned.cutVertices = fragment.cutVertices.map((v) => v.clone());

  // Clone triangles (deep copy the arrays)
  cloned.triangles = fragment.triangles.map((submesh) => [...submesh]);

  // Clone constraints
  cloned.constraints = fragment.constraints.map((c) => c.clone());

  // Clone vertex adjacency
  cloned.vertexAdjacency = [...fragment.vertexAdjacency];

  // Clone index map
  cloned.indexMap = { ...fragment.indexMap };

  // Clone bounds if it exists
  if (fragment.bounds) {
    cloned.bounds = fragment.bounds.clone();
  }

  return cloned;
}
