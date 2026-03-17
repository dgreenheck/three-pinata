import {
  SharedSourceData,
  SharedSeedsData,
  VoronoiWorkerMessage,
  VoronoiWorkerResponse,
  WorkerFragmentResult,
} from "./FragmentTransfer";

/**
 * Options for a single Voronoi cell computation dispatched to a worker.
 */
export interface ComputeOptions {
  useApproximation: boolean;
  approximationK: number;
  textureScaleX: number;
  textureScaleY: number;
  textureOffsetX: number;
  textureOffsetY: number;
}

/**
 * Manages a pool of Web Workers for parallel Voronoi cell computation.
 * Workers are initialized once with shared source data and seeds,
 * then dispatched individual seed indices for computation.
 */
export class VoronoiWorkerPool {
  private workers: Worker[];
  private idleWorkers: Worker[];
  private pendingResolves: Map<
    Worker,
    (results: WorkerFragmentResult[]) => void
  >;
  private pendingRejects: Map<Worker, (error: Error) => void>;

  constructor(createWorker: () => Worker, workerCount?: number) {
    const count =
      workerCount ??
      (typeof navigator !== "undefined"
        ? navigator.hardwareConcurrency || 4
        : 4);

    this.workers = [];
    this.idleWorkers = [];
    this.pendingResolves = new Map();
    this.pendingRejects = new Map();

    for (let i = 0; i < count; i++) {
      const worker = createWorker();
      this.workers.push(worker);
      this.idleWorkers.push(worker);

      worker.onmessage = (e: MessageEvent<VoronoiWorkerResponse>) => {
        const resolve = this.pendingResolves.get(worker);
        if (resolve) {
          this.pendingResolves.delete(worker);
          this.pendingRejects.delete(worker);
          this.idleWorkers.push(worker);
          resolve(e.data.fragments);
        }
      };

      worker.onerror = (e: ErrorEvent) => {
        const reject = this.pendingRejects.get(worker);
        if (reject) {
          this.pendingResolves.delete(worker);
          this.pendingRejects.delete(worker);
          this.idleWorkers.push(worker);
          reject(new Error(e.message));
        }
      };
    }
  }

  /**
   * Initialize all workers with shared source geometry and seed data.
   * Must be called before computeAll().
   */
  init(source: SharedSourceData, seeds: SharedSeedsData): void {
    const initMsg: VoronoiWorkerMessage = {
      type: "init",
      source,
      seeds,
    };

    for (const worker of this.workers) {
      worker.postMessage(initMsg);
    }
  }

  /**
   * Compute all Voronoi cells in parallel across the worker pool.
   * Returns results indexed by seed index (order preserved).
   */
  async computeAll(
    seedCount: number,
    options: ComputeOptions,
  ): Promise<WorkerFragmentResult[][]> {
    const results: WorkerFragmentResult[][] = new Array(seedCount);
    let nextSeed = 0;
    let completedCount = 0;

    return new Promise<WorkerFragmentResult[][]>((resolveAll, rejectAll) => {
      const dispatchNext = (worker: Worker) => {
        if (nextSeed >= seedCount) return;

        const seedIndex = nextSeed++;
        const idleIdx = this.idleWorkers.indexOf(worker);
        if (idleIdx >= 0) {
          this.idleWorkers.splice(idleIdx, 1);
        }

        this.pendingResolves.set(worker, (fragmentResults) => {
          results[seedIndex] = fragmentResults;
          completedCount++;

          if (completedCount === seedCount) {
            resolveAll(results);
          } else {
            dispatchNext(worker);
          }
        });

        this.pendingRejects.set(worker, (error) => {
          rejectAll(error);
        });

        const msg: VoronoiWorkerMessage = {
          type: "compute",
          seedIndex,
          ...options,
        };

        worker.postMessage(msg);
      };

      // Handle edge case: no seeds
      if (seedCount === 0) {
        resolveAll([]);
        return;
      }

      // Dispatch initial batch to all idle workers
      const workersToDispatch = [...this.idleWorkers];
      for (const worker of workersToDispatch) {
        if (nextSeed >= seedCount) break;
        dispatchNext(worker);
      }
    });
  }

  /**
   * Terminate all workers and clean up resources.
   */
  terminate(): void {
    for (const worker of this.workers) {
      worker.terminate();
    }
    this.workers = [];
    this.idleWorkers = [];
    this.pendingResolves.clear();
    this.pendingRejects.clear();
  }
}
