import { Vector2, Vector3 } from "three";
import { Fragment } from "../entities/Fragment";
import {
  computeVoronoiCell,
  findKNearestNeighbors,
} from "../fracture/VoronoiCell";
import { findIsolatedGeometry } from "../fracture/FractureFragment";
import {
  unpackSourceFragment,
  unpackSeeds,
  packFragmentResult,
  VoronoiWorkerMessage,
  VoronoiWorkerResponse,
  WorkerFragmentResult,
} from "./FragmentTransfer";

// Cached data shared across compute messages within a fracture batch
let sourceFragment: Fragment | null = null;
let seeds: Vector3[] | null = null;

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

self.onmessage = (e: MessageEvent<VoronoiWorkerMessage>) => {
  const msg = e.data;

  if (msg.type === "init") {
    sourceFragment = unpackSourceFragment(msg.source);
    seeds = unpackSeeds(msg.seeds);
    return;
  }

  if (msg.type === "compute") {
    if (!sourceFragment || !seeds) {
      throw new Error("Worker not initialized. Send 'init' message first.");
    }

    const cellFragment = cloneFragment(sourceFragment);

    const neighborIndices = msg.useApproximation
      ? findKNearestNeighbors(msg.seedIndex, seeds, msg.approximationK)
      : null;

    const cell = computeVoronoiCell(
      cellFragment,
      msg.seedIndex,
      seeds,
      neighborIndices,
      new Vector2(msg.textureScaleX, msg.textureScaleY),
      new Vector2(msg.textureOffsetX, msg.textureOffsetY),
      false,
    );

    const results: WorkerFragmentResult[] = [];
    if (cell && cell.vertexCount > 0) {
      const isolatedFragments = findIsolatedGeometry(cell);
      for (const frag of isolatedFragments) {
        results.push(packFragmentResult(frag));
      }
    }

    const response: VoronoiWorkerResponse = {
      type: "result",
      seedIndex: msg.seedIndex,
      fragments: results,
    };

    const transferables: Transferable[] = [];
    for (const r of results) {
      transferables.push(
        r.positions.buffer as ArrayBuffer,
        r.normals.buffer as ArrayBuffer,
        r.uvs.buffer as ArrayBuffer,
        r.indices.buffer as ArrayBuffer,
      );
    }

    (self as unknown as Worker).postMessage(response, transferables);
  }
};
