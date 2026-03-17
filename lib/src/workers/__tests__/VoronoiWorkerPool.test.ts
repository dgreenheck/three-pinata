import { VoronoiWorkerPool } from "../VoronoiWorkerPool";
import {
  SharedSourceData,
  SharedSeedsData,
  VoronoiWorkerMessage,
  VoronoiWorkerResponse,
  WorkerFragmentResult,
} from "../FragmentTransfer";

/**
 * Mock Worker that processes messages synchronously via microtasks.
 * Simulates the worker behavior without actual Web Worker threads.
 */
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;

  private initialized = false;
  private terminated = false;

  postMessage(data: VoronoiWorkerMessage): void {
    if (this.terminated) return;

    if (data.type === "init") {
      this.initialized = true;
      return;
    }

    if (data.type === "compute") {
      if (!this.initialized) {
        // Simulate error
        if (this.onerror) {
          const errorEvent = new ErrorEvent("error", {
            message: "Worker not initialized",
          });
          Promise.resolve().then(() => this.onerror!(errorEvent));
        }
        return;
      }

      // Create a minimal mock result for the seed
      const result: WorkerFragmentResult = {
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
        normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
        uvs: new Float32Array([0, 0, 1, 0, 0, 1]),
        indices: new Uint32Array([0, 1, 2]),
        group0Count: 3,
        group1Count: 0,
      };

      const response: VoronoiWorkerResponse = {
        type: "result",
        seedIndex: data.seedIndex,
        fragments: [result],
      };

      // Deliver asynchronously to match real Worker behavior
      Promise.resolve().then(() => {
        if (this.onmessage && !this.terminated) {
          this.onmessage(new MessageEvent("message", { data: response }));
        }
      });
    }
  }

  terminate(): void {
    this.terminated = true;
    this.onmessage = null;
    this.onerror = null;
  }
}

/**
 * Mock Worker that returns empty results (no fragments for any seed).
 */
class EmptyResultMockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  private terminated = false;

  postMessage(data: VoronoiWorkerMessage): void {
    if (this.terminated) return;
    if (data.type === "init") {
      return;
    }
    if (data.type === "compute") {
      const response: VoronoiWorkerResponse = {
        type: "result",
        seedIndex: data.seedIndex,
        fragments: [],
      };
      Promise.resolve().then(() => {
        if (this.onmessage && !this.terminated) {
          this.onmessage(new MessageEvent("message", { data: response }));
        }
      });
    }
  }

  terminate(): void {
    this.terminated = true;
  }
}

/**
 * Creates minimal shared source data for pool initialization.
 */
function createMinimalSourceData(): SharedSourceData {
  const posBuffer = new SharedArrayBuffer(3 * 3 * Float64Array.BYTES_PER_ELEMENT);
  const normBuffer = new SharedArrayBuffer(3 * 3 * Float64Array.BYTES_PER_ELEMENT);
  const uvBuffer = new SharedArrayBuffer(3 * 2 * Float64Array.BYTES_PER_ELEMENT);
  const idx0Buffer = new SharedArrayBuffer(3 * Uint32Array.BYTES_PER_ELEMENT);
  const idx1Buffer = new SharedArrayBuffer(0);

  return {
    positions: posBuffer,
    normals: normBuffer,
    uvs: uvBuffer,
    indices0: idx0Buffer,
    indices1: idx1Buffer,
    vertexCount: 3,
    boundsMin: [-1, -1, -1],
    boundsMax: [1, 1, 1],
  };
}

function createMinimalSeedsData(count: number): SharedSeedsData {
  const buffer = new SharedArrayBuffer(
    count * 3 * Float64Array.BYTES_PER_ELEMENT,
  );
  return { buffer, count };
}

describe("VoronoiWorkerPool", () => {
  it("dispatches all seeds and collects results", async () => {
    const pool = new VoronoiWorkerPool(
      () => new MockWorker() as unknown as Worker,
      2,
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(5);
    pool.init(source, seeds);

    const results = await pool.computeAll(5, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    expect(results.length).toBe(5);
    for (let i = 0; i < 5; i++) {
      expect(results[i]).toBeDefined();
      expect(results[i].length).toBe(1); // MockWorker returns 1 fragment per seed
    }

    pool.terminate();
  });

  it("handles more seeds than workers", async () => {
    const pool = new VoronoiWorkerPool(
      () => new MockWorker() as unknown as Worker,
      2, // Only 2 workers
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(10);
    pool.init(source, seeds);

    const results = await pool.computeAll(10, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    // All 10 seeds should be processed even with only 2 workers
    expect(results.length).toBe(10);
    for (let i = 0; i < 10; i++) {
      expect(results[i]).toBeDefined();
    }

    pool.terminate();
  });

  it("handles zero seeds", async () => {
    const pool = new VoronoiWorkerPool(
      () => new MockWorker() as unknown as Worker,
      2,
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(0);
    pool.init(source, seeds);

    const results = await pool.computeAll(0, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    expect(results.length).toBe(0);

    pool.terminate();
  });

  it("handles single worker", async () => {
    const pool = new VoronoiWorkerPool(
      () => new MockWorker() as unknown as Worker,
      1,
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(3);
    pool.init(source, seeds);

    const results = await pool.computeAll(3, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    expect(results.length).toBe(3);
    pool.terminate();
  });

  it("handles empty fragment results", async () => {
    const pool = new VoronoiWorkerPool(
      () => new EmptyResultMockWorker() as unknown as Worker,
      2,
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(3);
    pool.init(source, seeds);

    const results = await pool.computeAll(3, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    expect(results.length).toBe(3);
    for (let i = 0; i < 3; i++) {
      expect(results[i]).toEqual([]);
    }

    pool.terminate();
  });

  it("terminates workers on cleanup", () => {
    const terminatedWorkers: MockWorker[] = [];

    const pool = new VoronoiWorkerPool(
      () => {
        const worker = new MockWorker();
        const origTerminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          terminatedWorkers.push(worker);
          origTerminate();
        };
        return worker as unknown as Worker;
      },
      3,
    );

    pool.terminate();

    expect(terminatedWorkers.length).toBe(3);
  });

  it("preserves result ordering by seed index", async () => {
    // Use a worker that includes the seedIndex in the result for verification
    class OrderVerifyWorker {
      onmessage: ((e: MessageEvent) => void) | null = null;
      onerror: ((e: ErrorEvent) => void) | null = null;
      private terminated = false;

      postMessage(data: VoronoiWorkerMessage): void {
        if (this.terminated) return;
        if (data.type === "init") { return; }
        if (data.type === "compute") {
          // Introduce variable delay to test ordering
          const delay = Math.random() * 5;
          setTimeout(() => {
            if (this.onmessage && !this.terminated) {
              // Encode the seed index in the position data so we can verify order
              const seedIdx = data.seedIndex;
              const result: WorkerFragmentResult = {
                positions: new Float32Array([seedIdx, 0, 0]),
                normals: new Float32Array([0, 0, 1]),
                uvs: new Float32Array([0, 0]),
                indices: new Uint32Array([0]),
                group0Count: 1,
                group1Count: 0,
              };
              const response: VoronoiWorkerResponse = {
                type: "result",
                seedIndex: seedIdx,
                fragments: [result],
              };
              this.onmessage(new MessageEvent("message", { data: response }));
            }
          }, delay);
        }
      }

      terminate(): void { this.terminated = true; }
    }

    const pool = new VoronoiWorkerPool(
      () => new OrderVerifyWorker() as unknown as Worker,
      2,
    );

    const source = createMinimalSourceData();
    const seeds = createMinimalSeedsData(8);
    pool.init(source, seeds);

    const results = await pool.computeAll(8, {
      useApproximation: false,
      approximationK: 0,
      textureScaleX: 1,
      textureScaleY: 1,
      textureOffsetX: 0,
      textureOffsetY: 0,
    });

    // Results should be ordered by seed index regardless of completion order
    for (let i = 0; i < 8; i++) {
      expect(results[i].length).toBe(1);
      // The seed index was encoded in positions[0]
      expect(results[i][0].positions[0]).toBe(i);
    }

    pool.terminate();
  });
});
