import { EventEmitter } from 'events';
import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { createRepeatingSequence } from './sequence';

const enum WorkerStatus {
  Inactive = 0,
  Active = 1,
}

type WorkerPoolOptions = {
  numWorkers?: number,
  maxQueueSize?: number,
  maxJobsPerWorker?: number,
}

type WorkerJob = {
  num: string,
  name: string,
  args: any[],
}

type WorkerJobResult = {
  num: string,
  err?: Error,
  result?: any,
}

const MIN_NUM_WORKERS = 1;
const DEFAULT_DESTROYED = false;

const defaultNumWorkers = cpus().length - 1;
const defaultMaxQueueSize = Number.MAX_SAFE_INTEGER;
const defaultMaxJobsPerWorker = Number.MAX_SAFE_INTEGER;

const activeSymbol = Symbol('WorkerPoolWorker property: active');
const timeoutSymbol = Symbol('WorkerPoolWorker property: timeout');

/**
 * Extends the Worker class for the sole purpose of adding extra properties used by the worker pool.
 */

class WorkerPoolWorker extends Worker {
  [activeSymbol]: WorkerStatus = WorkerStatus.Inactive; // Denotes whether or not the worker is active (busy).
  [timeoutSymbol]: NodeJS.Timeout;                      // Recursive setTimeout() to take and process jobs.
}

/**
 * Creates and manages a pool of Workers which are able to execute the tasks included in the provided script.
 */

export class WorkerPool {
  #destroyed: boolean = DEFAULT_DESTROYED;  // Denotes whether or not the worker pool has been destroyed.

  readonly #numWorkers: number;               // The total number of workers employed by the worker pool.
  readonly #maxQueueSize: number;             // The max number of pending jobs the worker pool will accept.
  readonly #maxJobsPerWorker: number;         // The max number of jobs a worker will take from the queue.
  readonly #seq: () => number;                // Returns a self-incrementing value.

  readonly #workers: WorkerPoolWorker[] = [];           // An array of workers.
  readonly #queue: WorkerJob[] = [];                    // A 'first-in, first-out' job queue.
  readonly #events: EventEmitter = new EventEmitter();  // Handles promise callbacks.

  /**
   * Returns the 'destroyed' status of the worker pool.
   */
  get destroyed() {
    return this.#destroyed;
  }

  /**
   * Returns the total number of workers employed by the worker pool.
   */
  get numWorkers() {
    return this.#numWorkers;
  }

  /**
   * Returns the maximum number of jobs the queue will store.
   */
  get maxQueueSize() {
    return this.#maxQueueSize;
  }

  /**
   * Returns the maximum number of jobs a worker will take from the queue.
   */
  get maxJobsPerWorker() {
    return this.#maxJobsPerWorker;
  }

  /**
   * Returns the current number of pending tasks.
   */
  get pendingTasks() {
    return this.#queue.length;
  }

  /**
   * Returns the current number of active tasks.
   */
  get activeTasks() {
    return this.#events.eventNames().length - this.#queue.length;
  }

  /**
   * Returns the current number of active (busy) workers.
   */
  get numActiveWorkers() {
    let i, n;

    for (i = 0, n = 0; i < this.#numWorkers; i++) {
      n += this.#workers[i][activeSymbol];
    }

    return n;
  }

  /**
   * Returns the current number of idle workers.
   */
  get numIdleWorkers() {
    let i, n;

    for (i = 0, n = this.#numWorkers; i < this.#numWorkers; i++) {
      n -= this.#workers[i][activeSymbol];
    }

    return n;
  }

  constructor(filename: string, options: WorkerPoolOptions = {}) {
    this.#numWorkers = options.numWorkers ?? defaultNumWorkers;
    this.#maxQueueSize = options.maxQueueSize ?? defaultMaxQueueSize;
    this.#maxJobsPerWorker = options.maxJobsPerWorker ?? defaultMaxJobsPerWorker;
    this.#seq = createRepeatingSequence(this.#maxQueueSize);

    if (this.#numWorkers < MIN_NUM_WORKERS) {
      this.#numWorkers = MIN_NUM_WORKERS;
    }

    for (let i = 0; i < this.#numWorkers; i++) {
      const worker = new WorkerPoolWorker(filename);

      const processJobs = () => {
        // Take any jobs currently in the queue (up to the max jobs limit).
        const jobs = this.#queue.splice(0, this.#maxJobsPerWorker);

        if (jobs.length === 0) {
          // There are no jobs, so do nothing except continue to watch for jobs.
          worker[timeoutSymbol] = setTimeout(processJobs, 0);
          return;
        }

        // Send the jobs to the worker thread.
        worker.postMessage(jobs);

        // Mark this worker as being active.
        worker[activeSymbol] = WorkerStatus.Active;
      };

      // Start watching the queue for pending jobs.
      worker[timeoutSymbol] = setTimeout(processJobs, 0);

       worker.on('message', (results: WorkerJobResult[]) => {
        // Emit an event for each completed job, passing the corresponding results.
        for (let i = 0; i < results.length; i++) {
          const { num, err, result } = results[i];
          this.#events.emit(num, err, result);
        }

        // Mark this worker as being inactive.
        worker[activeSymbol] = WorkerStatus.Inactive;

        // All results have been processed, so start accepting more jobs.
        worker[timeoutSymbol] = setTimeout(processJobs, 0);
      });

      // Add the newly created worker to the worker pool.
      this.#workers.push(worker);
    }
  }

  /**
   * Returns an object that contains statistics for the worker pool.
   */

  getStats() {
    return {
      activeTasks: this.activeTasks,
      pendingTasks: this.pendingTasks,
      idleWorkers: this.numIdleWorkers,
      activeWorkers: this.numActiveWorkers,
    };
  }

  /**
   * Executes a task based on the provided task name. All arguments after the first are passed on to the worker. Returns
   * a promise, which either resolves to the result of the executed task, or rejects with an Error.
   */

  exec(name: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      let err: Error | undefined;

      if (this.#destroyed) {
        err = Error('The worker pool has been destroyed.');
      }

      else if (this.#queue.length >= this.#maxQueueSize) {
        err = Error(`Max job queue size has been reached: ${this.#maxQueueSize} jobs`);
      }

      if (err) {
        reject(err);
        return;
      }

      // Get a new job number.
      const num = this.#seq().toString();

      // Listen for the job completion event.
      this.#events.once(num, (err, result) => {
        err ? reject(err) : resolve(result);
      });

      // Add the new job to the queue.
      this.#queue.push({ num, name, args });
    });
  }

  /**
   * Destroys the worker pool by terminating all workers, preventing the worker pool from being used again.
   * Tasks not yet completed are immediately canceled. Returns a promise that resolves once all workers have been
   * terminated.
   */

  destroy() {
    return new Promise<void>(resolve => {
      if (this.#destroyed) {
        resolve();
        return;
      }

      setImmediate(async () => {
        // Terminate workers and clear their recursive timeouts.
        for (let i = 0; i < this.#numWorkers; i++) {
          const worker = this.#workers[i];
          await worker.terminate();
          clearTimeout(worker[timeoutSymbol]);
        }

        // Remove pending tasks from the queue.
        this.#queue.splice(0);

        // Reject any remaining promises.
        const err = Error('The worker pool was destroyed before the task could complete.');
        for (const num of this.#events.eventNames()) {
          this.#events.emit(num, err);
        }

        this.#destroyed = true;
        resolve();
      });
    });
  }
}

export function createWorkerPool(filename: string, options?: WorkerPoolOptions) {
  return new WorkerPool(filename, options);
}
