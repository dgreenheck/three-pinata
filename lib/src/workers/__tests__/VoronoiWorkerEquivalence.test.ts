import * as THREE from "three";
import { Vector2, Vector3 } from "three";
import { VoronoiFractureOptions } from "../../entities/VoronoiFractureOptions";
import { voronoiFracture } from "../../fracture/VoronoiFracture";
import {
  computeVoronoiCell,
  findKNearestNeighbors,
} from "../../fracture/VoronoiCell";
import { findIsolatedGeometry } from "../../fracture/FractureFragment";
import { geometryToFragment } from "../../utils/GeometryConversion";
import { SeedPointGenerator } from "../../utils/SeedPointGenerator";
import { SeededRandom } from "../../utils/SeededRandom";
import { Fragment } from "../../entities/Fragment";
import {
  packSourceFragment,
  unpackSourceFragment,
  packSeeds,
  unpackSeeds,
  packFragmentResult,
  WorkerFragmentResult,
} from "../FragmentTransfer";

/**
 * Simulates the worker computation path for a single Voronoi cell:
 * pack source → unpack source → clone → computeVoronoiCell → findIsolatedGeometry → pack results
 *
 * This exercises the full serialization pipeline that a real Web Worker would use.
 */
function simulateWorkerForSeed(
  sourceFragment: Fragment,
  seeds: Vector3[],
  seedIndex: number,
  options: {
    useApproximation: boolean;
    approximationK: number;
    textureScale: Vector2;
    textureOffset: Vector2;
  },
): WorkerFragmentResult[] {
  // Step 1: Pack source (same as main thread does before sending to worker)
  const packedSource = packSourceFragment(sourceFragment);
  const packedSeeds = packSeeds(seeds);

  // Step 2: Unpack in "worker" (same as worker init handler)
  const workerSource = unpackSourceFragment(packedSource);
  const workerSeeds = unpackSeeds(packedSeeds);

  // Step 3: Clone (same as worker compute handler)
  const cloned = cloneFragment(workerSource);

  // Step 4: Find neighbors
  const neighborIndices = options.useApproximation
    ? findKNearestNeighbors(seedIndex, workerSeeds, options.approximationK)
    : null;

  // Step 5: Compute Voronoi cell
  const cell = computeVoronoiCell(
    cloned,
    seedIndex,
    workerSeeds,
    neighborIndices,
    options.textureScale,
    options.textureOffset,
    false,
  );

  // Step 6: Find isolated geometry and pack results
  const results: WorkerFragmentResult[] = [];
  if (cell && cell.vertexCount > 0) {
    const isolatedFragments = findIsolatedGeometry(cell);
    for (const frag of isolatedFragments) {
      results.push(packFragmentResult(frag));
    }
  }

  return results;
}

/**
 * Deep clone a Fragment (same as the cloneFragment in VoronoiFracture.ts and voronoiWorker.ts)
 */
function cloneFragment(fragment: Fragment): Fragment {
  const cloned = new Fragment();
  cloned.vertices = fragment.vertices.map((v) => v.clone());
  cloned.cutVertices = fragment.cutVertices.map((v) => v.clone());
  cloned.triangles = fragment.triangles.map((submesh) => [...submesh]);
  cloned.constraints = fragment.constraints.map((c) => c.clone());
  cloned.vertexAdjacency = [...fragment.vertexAdjacency];
  cloned.indexMap = { ...fragment.indexMap };
  if (fragment.bounds) {
    cloned.bounds = fragment.bounds.clone();
  }
  return cloned;
}

/**
 * Converts a WorkerFragmentResult to a BufferGeometry (mirrors workerResultToGeometry).
 */
function resultToGeometry(result: WorkerFragmentResult): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(result.positions, 3),
  );
  geometry.setAttribute(
    "normal",
    new THREE.BufferAttribute(result.normals, 3),
  );
  geometry.setAttribute("uv", new THREE.BufferAttribute(result.uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(result.indices, 1));
  geometry.addGroup(0, result.group0Count, 0);
  geometry.addGroup(result.group0Count, result.group1Count, 1);
  return geometry;
}

/**
 * Generates seeds using the same logic as voronoiFracture3D.
 */
function generateSeeds3D(
  sourceFragment: Fragment,
  options: VoronoiFractureOptions,
  rng: SeededRandom,
): Vector3[] {
  if (options.seedPoints && options.seedPoints.length > 0) {
    return options.seedPoints;
  }
  if (!sourceFragment.bounds) {
    sourceFragment.calculateBounds();
  }
  if (options.impactPoint) {
    const radius =
      options.impactRadius ||
      Math.min(
        sourceFragment.bounds.max.x - sourceFragment.bounds.min.x,
        sourceFragment.bounds.max.y - sourceFragment.bounds.min.y,
        sourceFragment.bounds.max.z - sourceFragment.bounds.min.z,
      ) * 0.3;
    return SeedPointGenerator.generateImpactBased(
      sourceFragment.bounds,
      options.fragmentCount,
      options.impactPoint,
      radius,
      rng,
    );
  } else {
    return SeedPointGenerator.generateUniform(
      sourceFragment.bounds,
      options.fragmentCount,
      rng,
    );
  }
}

/**
 * Runs the full worker-simulated pipeline for all seeds and returns BufferGeometries.
 */
function runWorkerSimulation(
  geometry: THREE.BufferGeometry,
  options: VoronoiFractureOptions,
): THREE.BufferGeometry[] {
  const rng = new SeededRandom(options.seed);

  const sourceFragment = geometryToFragment(geometry);
  const seeds = generateSeeds3D(sourceFragment, options, rng);

  const useKNearest = options.useApproximation;
  const k = Math.min(options.approximationNeighborCount, seeds.length - 1);

  const allGeometries: THREE.BufferGeometry[] = [];

  for (let i = 0; i < seeds.length; i++) {
    const results = simulateWorkerForSeed(sourceFragment, seeds, i, {
      useApproximation: useKNearest,
      approximationK: k,
      textureScale: options.textureScale,
      textureOffset: options.textureOffset,
    });

    for (const result of results) {
      allGeometries.push(resultToGeometry(result));
    }
  }

  return allGeometries;
}

/**
 * Compares two BufferGeometry arrays for equivalence.
 * Checks: count, vertex positions, normals, UVs, indices, and groups.
 */
function compareGeometryArrays(
  syncGeos: THREE.BufferGeometry[],
  workerGeos: THREE.BufferGeometry[],
  tolerance: number = 1e-5,
) {
  expect(workerGeos.length).toBe(syncGeos.length);

  for (let i = 0; i < syncGeos.length; i++) {
    const sg = syncGeos[i];
    const wg = workerGeos[i];

    const sPos = sg.attributes.position.array as Float32Array;
    const wPos = wg.attributes.position.array as Float32Array;
    expect(wPos.length).toBe(sPos.length);
    for (let j = 0; j < sPos.length; j++) {
      expect(Math.abs(wPos[j] - sPos[j])).toBeLessThan(tolerance);
    }

    const sNorm = sg.attributes.normal.array as Float32Array;
    const wNorm = wg.attributes.normal.array as Float32Array;
    expect(wNorm.length).toBe(sNorm.length);
    for (let j = 0; j < sNorm.length; j++) {
      expect(Math.abs(wNorm[j] - sNorm[j])).toBeLessThan(tolerance);
    }

    const sUV = sg.attributes.uv.array as Float32Array;
    const wUV = wg.attributes.uv.array as Float32Array;
    expect(wUV.length).toBe(sUV.length);
    for (let j = 0; j < sUV.length; j++) {
      expect(Math.abs(wUV[j] - sUV[j])).toBeLessThan(tolerance);
    }

    const sIdx = sg.index!.array as Uint32Array;
    const wIdx = wg.index!.array as Uint32Array;
    expect(wIdx.length).toBe(sIdx.length);
    for (let j = 0; j < sIdx.length; j++) {
      expect(wIdx[j]).toBe(sIdx[j]);
    }

    expect(wg.groups.length).toBe(sg.groups.length);
    for (let j = 0; j < sg.groups.length; j++) {
      expect(wg.groups[j].start).toBe(sg.groups[j].start);
      expect(wg.groups[j].count).toBe(sg.groups[j].count);
      expect(wg.groups[j].materialIndex).toBe(sg.groups[j].materialIndex);
    }
  }
}

describe("Voronoi Worker Equivalence", () => {
  describe("3D mode - Box geometry", () => {
    const seed = 12345;

    it("produces same fragment count as sync path", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 5,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      expect(workerResult.length).toBe(syncResult.length);
      geometry.dispose();
    });

    it("produces byte-identical geometry data as sync path", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 5,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });

    it("handles larger fragment counts", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 15,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });
  });

  describe("3D mode - Sphere geometry", () => {
    const seed = 54321;

    it("produces same fragment count for sphere", () => {
      const geometry = new THREE.SphereGeometry(1, 8, 8);
      const options = new VoronoiFractureOptions({
        fragmentCount: 5,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      expect(workerResult.length).toBe(syncResult.length);
      geometry.dispose();
    });

    it("produces identical geometry data for sphere", () => {
      const geometry = new THREE.SphereGeometry(1, 8, 8);
      const options = new VoronoiFractureOptions({
        fragmentCount: 5,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });
  });

  describe("3D mode - with impact point", () => {
    const seed = 99999;

    it("produces identical results with impact-based seeds", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 8,
        mode: "3D",
        seed,
        impactPoint: new Vector3(0.5, 0.5, 0),
        impactRadius: 0.8,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });
  });

  describe("3D mode - with approximation", () => {
    const seed = 77777;

    it("produces identical results with k-nearest approximation", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 10,
        mode: "3D",
        seed,
        useApproximation: true,
        approximationNeighborCount: 6,
      });

      // Suppress console.warn for approximation warning
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
      warnSpy.mockRestore();
    });
  });

  describe("3D mode - custom seed points", () => {
    const seed = 11111;

    it("produces identical results with custom seeds", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const customSeeds = [
        new Vector3(-0.5, 0, 0),
        new Vector3(0.5, 0, 0),
        new Vector3(0, 0.5, 0),
      ];

      const options = new VoronoiFractureOptions({
        mode: "3D",
        seed,
        seedPoints: customSeeds,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });
  });

  describe("Edge cases", () => {
    const seed = 33333;

    it("handles single seed (1 fragment)", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 1,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      // With 1 seed, the result should be the original geometry (no slicing)
      expect(workerResult.length).toBe(syncResult.length);
      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });

    it("handles 2 seeds", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 2,
        mode: "3D",
        seed,
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });

    it("handles texture scale and offset", () => {
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 4,
        mode: "3D",
        seed,
        textureScale: new Vector2(2.0, 3.0),
        textureOffset: new Vector2(0.5, -0.25),
      });

      const syncResult = voronoiFracture(geometry, options);
      const workerResult = runWorkerSimulation(geometry, { ...options, seed });

      compareGeometryArrays(syncResult, workerResult);
      geometry.dispose();
    });
  });

  describe("Serialization fidelity across pipeline", () => {
    it("pack → unpack → computation matches direct computation for each seed", () => {
      const seed = 42;
      const geometry = new THREE.BoxGeometry(2, 2, 2);
      const options = new VoronoiFractureOptions({
        fragmentCount: 5,
        mode: "3D",
        seed,
      });

      // Generate source and seeds using the same RNG path as voronoiFracture
      const rng = new SeededRandom(seed);
      const sourceFragment = geometryToFragment(geometry);
      const seeds = generateSeeds3D(sourceFragment, options, rng);

      const textureScale = options.textureScale;
      const textureOffset = options.textureOffset;

      // For each seed, compare direct computation vs serialized computation
      for (let i = 0; i < seeds.length; i++) {
        // Direct computation (no serialization)
        const directClone = cloneFragment(sourceFragment);
        const directCell = computeVoronoiCell(
          directClone,
          i,
          seeds,
          null,
          textureScale,
          textureOffset,
          false,
        );
        const directFragments = directCell && directCell.vertexCount > 0
          ? findIsolatedGeometry(directCell)
          : [];
        const directResults = directFragments.map(packFragmentResult);

        // Serialized computation (through pack/unpack)
        const serializedResults = simulateWorkerForSeed(
          sourceFragment,
          seeds,
          i,
          {
            useApproximation: false,
            approximationK: 0,
            textureScale,
            textureOffset,
          },
        );

        // Compare results
        expect(serializedResults.length).toBe(directResults.length);

        for (let j = 0; j < directResults.length; j++) {
          const dr = directResults[j];
          const sr = serializedResults[j];

          expect(sr.group0Count).toBe(dr.group0Count);
          expect(sr.group1Count).toBe(dr.group1Count);
          expect(sr.positions.length).toBe(dr.positions.length);
          expect(sr.indices.length).toBe(dr.indices.length);

          for (let k = 0; k < dr.positions.length; k++) {
            expect(Math.abs(sr.positions[k] - dr.positions[k])).toBeLessThan(
              1e-5,
            );
          }
          for (let k = 0; k < dr.normals.length; k++) {
            expect(Math.abs(sr.normals[k] - dr.normals[k])).toBeLessThan(1e-5);
          }
          for (let k = 0; k < dr.uvs.length; k++) {
            expect(Math.abs(sr.uvs[k] - dr.uvs[k])).toBeLessThan(1e-5);
          }
          for (let k = 0; k < dr.indices.length; k++) {
            expect(sr.indices[k]).toBe(dr.indices[k]);
          }
        }
      }

      geometry.dispose();
    });
  });
});
