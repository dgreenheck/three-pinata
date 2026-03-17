import { Vector2, Vector3, Box3 } from "three";
import { Fragment } from "../entities/Fragment";
import { MeshVertex } from "../entities/MeshVertex";

/**
 * Packed source fragment data using SharedArrayBuffer (or ArrayBuffer fallback)
 * for cross-worker sharing. All buffers are read-only across workers.
 */
export interface SharedSourceData {
  positions: SharedArrayBuffer | ArrayBuffer;
  normals: SharedArrayBuffer | ArrayBuffer;
  uvs: SharedArrayBuffer | ArrayBuffer;
  indices0: SharedArrayBuffer | ArrayBuffer;
  indices1: SharedArrayBuffer | ArrayBuffer;
  vertexCount: number;
  boundsMin: [number, number, number];
  boundsMax: [number, number, number];
}

/**
 * Packed seed points using SharedArrayBuffer (or ArrayBuffer fallback).
 */
export interface SharedSeedsData {
  buffer: SharedArrayBuffer | ArrayBuffer;
  count: number;
}

/**
 * Result fragment data returned from a worker.
 * Uses regular ArrayBuffers which can be Transferred for zero-copy.
 */
export interface WorkerFragmentResult {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
  group0Count: number;
  group1Count: number;
}

/**
 * Message sent from main thread to worker.
 */
export type VoronoiWorkerMessage =
  | {
      type: "init";
      source: SharedSourceData;
      seeds: SharedSeedsData;
    }
  | {
      type: "compute";
      seedIndex: number;
      useApproximation: boolean;
      approximationK: number;
      textureScaleX: number;
      textureScaleY: number;
      textureOffsetX: number;
      textureOffsetY: number;
    };

/**
 * Message sent from worker to main thread.
 */
export interface VoronoiWorkerResponse {
  type: "result";
  seedIndex: number;
  fragments: WorkerFragmentResult[];
}

/**
 * Creates a SharedArrayBuffer if available, otherwise falls back to ArrayBuffer.
 */
function createBuffer(byteLength: number): SharedArrayBuffer | ArrayBuffer {
  if (typeof SharedArrayBuffer !== "undefined") {
    return new SharedArrayBuffer(byteLength);
  }
  return new ArrayBuffer(byteLength);
}

/**
 * Packs a source Fragment into SharedArrayBuffers for cross-worker sharing.
 */
export function packSourceFragment(fragment: Fragment): SharedSourceData {
  const vertexCount = fragment.vertices.length;

  const posBuffer = createBuffer(
    vertexCount * 3 * Float64Array.BYTES_PER_ELEMENT,
  );
  const normBuffer = createBuffer(
    vertexCount * 3 * Float64Array.BYTES_PER_ELEMENT,
  );
  const uvBuffer = createBuffer(
    vertexCount * 2 * Float64Array.BYTES_PER_ELEMENT,
  );
  const idx0Buffer = createBuffer(
    fragment.triangles[0].length * Uint32Array.BYTES_PER_ELEMENT,
  );
  const idx1Buffer = createBuffer(
    fragment.triangles[1].length * Uint32Array.BYTES_PER_ELEMENT,
  );

  const positions = new Float64Array(posBuffer);
  const normals = new Float64Array(normBuffer);
  const uvs = new Float64Array(uvBuffer);
  const indices0 = new Uint32Array(idx0Buffer);
  const indices1 = new Uint32Array(idx1Buffer);

  for (let i = 0; i < vertexCount; i++) {
    const v = fragment.vertices[i];
    positions[i * 3] = v.position.x;
    positions[i * 3 + 1] = v.position.y;
    positions[i * 3 + 2] = v.position.z;
    normals[i * 3] = v.normal.x;
    normals[i * 3 + 1] = v.normal.y;
    normals[i * 3 + 2] = v.normal.z;
    uvs[i * 2] = v.uv.x;
    uvs[i * 2 + 1] = v.uv.y;
  }

  for (let i = 0; i < fragment.triangles[0].length; i++) {
    indices0[i] = fragment.triangles[0][i];
  }
  for (let i = 0; i < fragment.triangles[1].length; i++) {
    indices1[i] = fragment.triangles[1][i];
  }

  if (!fragment.bounds) {
    fragment.calculateBounds();
  }

  return {
    positions: posBuffer,
    normals: normBuffer,
    uvs: uvBuffer,
    indices0: idx0Buffer,
    indices1: idx1Buffer,
    vertexCount,
    boundsMin: [
      fragment.bounds.min.x,
      fragment.bounds.min.y,
      fragment.bounds.min.z,
    ],
    boundsMax: [
      fragment.bounds.max.x,
      fragment.bounds.max.y,
      fragment.bounds.max.z,
    ],
  };
}

/**
 * Packs seed points into a SharedArrayBuffer.
 */
export function packSeeds(seeds: Vector3[]): SharedSeedsData {
  const buffer = createBuffer(
    seeds.length * 3 * Float64Array.BYTES_PER_ELEMENT,
  );
  const data = new Float64Array(buffer);

  for (let i = 0; i < seeds.length; i++) {
    data[i * 3] = seeds[i].x;
    data[i * 3 + 1] = seeds[i].y;
    data[i * 3 + 2] = seeds[i].z;
  }

  return { buffer, count: seeds.length };
}

/**
 * Reconstructs a Fragment from packed source data.
 */
export function unpackSourceFragment(source: SharedSourceData): Fragment {
  const fragment = new Fragment();
  const positions = new Float64Array(source.positions);
  const normals = new Float64Array(source.normals);
  const uvs = new Float64Array(source.uvs);
  const indices0 = new Uint32Array(source.indices0);
  const indices1 = new Uint32Array(source.indices1);

  for (let i = 0; i < source.vertexCount; i++) {
    fragment.vertices.push(
      new MeshVertex(
        new Vector3(
          positions[i * 3],
          positions[i * 3 + 1],
          positions[i * 3 + 2],
        ),
        new Vector3(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]),
        new Vector2(uvs[i * 2], uvs[i * 2 + 1]),
      ),
    );
  }

  fragment.triangles = [Array.from(indices0), Array.from(indices1)];
  fragment.bounds = new Box3(
    new Vector3(source.boundsMin[0], source.boundsMin[1], source.boundsMin[2]),
    new Vector3(source.boundsMax[0], source.boundsMax[1], source.boundsMax[2]),
  );

  return fragment;
}

/**
 * Reconstructs seed Vector3 array from packed seed data.
 */
export function unpackSeeds(seedsData: SharedSeedsData): Vector3[] {
  const data = new Float64Array(seedsData.buffer);
  const seeds: Vector3[] = [];

  for (let i = 0; i < seedsData.count; i++) {
    seeds.push(new Vector3(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]));
  }

  return seeds;
}

/**
 * Packs a Fragment into transferable typed arrays for worker → main thread.
 * Produces the same data layout as fragmentToGeometry but as raw arrays.
 */
export function packFragmentResult(fragment: Fragment): WorkerFragmentResult {
  const vertexCount = fragment.vertices.length + fragment.cutVertices.length;
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);

  let posIdx = 0;
  let normIdx = 0;
  let uvIdx = 0;

  for (const vert of fragment.vertices) {
    positions[posIdx++] = vert.position.x;
    positions[posIdx++] = vert.position.y;
    positions[posIdx++] = vert.position.z;
    normals[normIdx++] = vert.normal.x;
    normals[normIdx++] = vert.normal.y;
    normals[normIdx++] = vert.normal.z;
    uvs[uvIdx++] = vert.uv.x;
    uvs[uvIdx++] = vert.uv.y;
  }

  for (const vert of fragment.cutVertices) {
    positions[posIdx++] = vert.position.x;
    positions[posIdx++] = vert.position.y;
    positions[posIdx++] = vert.position.z;
    normals[normIdx++] = vert.normal.x;
    normals[normIdx++] = vert.normal.y;
    normals[normIdx++] = vert.normal.z;
    uvs[uvIdx++] = vert.uv.x;
    uvs[uvIdx++] = vert.uv.y;
  }

  const totalIndices =
    fragment.triangles[0].length + fragment.triangles[1].length;
  const indices = new Uint32Array(totalIndices);
  let idx = 0;
  for (const i of fragment.triangles[0]) indices[idx++] = i;
  for (const i of fragment.triangles[1]) indices[idx++] = i;

  return {
    positions,
    normals,
    uvs,
    indices,
    group0Count: fragment.triangles[0].length,
    group1Count: fragment.triangles[1].length,
  };
}
