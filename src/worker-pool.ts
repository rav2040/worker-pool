import { Worker as WorkerBase } from 'worker_threads';
import { cpus } from 'os';
import { createRepeatingSequence } from './sequence';

type WorkerPoolOptions = {
  numWorkers?: number | 'max',
  maxQueueSize?: number,
  maxJobsPerWorker?: number,
}

type WorkerJob = {
  num: number,
  name: string,
  args: any[],
}

type WorkerJobResult = {
  num: number,
  err?: Error,
  result?: any,
}

type PromiseCallback = {
  resolve: (value?: any) => void,
  reject: (err: Error) => void,
}

const DEFAULT_DESTROYED = false;

const defaultMaxNumWorkers = cpus().length;
const defaultNumWorkers = defaultMaxNumWorkers - 1;
const defaultMaxQueueSize = Number.MAX_SAFE_INTEGER;
const defaultMaxJobs = Number.MAX_SAFE_INTEGER;

const activeTasksDataView: unique symbol = Symbol('data view');

/**
 * The extended Worker class has an additional 'activeTasksDataView' property that must be passed as the
 * second argument when the instance is created. This is an Int32Array which references a SharedArrayBuffer, used by the
 * worker thread to report the number of active tasks it is currently executing back to the worker pool.
 */

class Worker extends WorkerBase {
  [activeTasksDataView]: Int32Array;

  constructor(filename: string, dataView: Int32Array) {
    super(filename, { workerData: dataView });
    this[activeTasksDataView] = dataView;
  }
}

/**
 * The WorkerPool class creates and manages a pool of Workers which can execute tasks included in the provided script.
 */

export class WorkerPool {
  #destroyed = DEFAULT_DESTROYED;

  private readonly _numWorkers: number;
  private readonly _maxQueueSize: number;
  private readonly _maxJobsPerWorker: number;
  private readonly _seq: () => number; // Returns a number that iterates by 1 each time it's called.

  private readonly _workers: Worker[] = [];
  private readonly _timeouts: NodeJS.Timeout[] = [];
  private readonly _queue: WorkerJob[] = [];
  private readonly _callbacks: Map<number, PromiseCallback> = new Map();

  get isDestroyed() {
    return this.#destroyed;
  }

  get numWorkers() {
    return this._numWorkers;
  }

  get maxQueueSize() {
    return this._maxQueueSize;
  }

  get maxJobsPerWorker() {
    return this._maxJobsPerWorker;
  }

  get pendingTasks() {
    return this._queue.length;
  }

  get activeTasks() {
    let i, n;

    for (i = 0, n = 0; i < this._numWorkers; i++) {
      n += this._workers[i][activeTasksDataView][0];
    }

    return n;
  }

  get numIdleWorkers() {
    let i, n;

    for (i = 0, n = 0; i < this._numWorkers; i++) {
      n = n + (this._workers[i][activeTasksDataView][0] === 0 ? 1 : 0);
    }

    return n;
  }

  constructor(filename: string, options: WorkerPoolOptions = {}) {
    if (!options.numWorkers) {
      this._numWorkers = defaultNumWorkers;
    }

    else {
      if (options.numWorkers === 'max') {
        this._numWorkers = defaultMaxNumWorkers;
      }

      else {
        this._numWorkers = options.numWorkers <= defaultMaxNumWorkers
          ? options.numWorkers
          : defaultMaxNumWorkers;
      }
    }

    this._maxQueueSize = options.maxQueueSize ?? defaultMaxQueueSize;
    this._maxJobsPerWorker = options.maxJobsPerWorker ?? defaultMaxJobs;
    this._seq = createRepeatingSequence(this._maxQueueSize);

    for (let i = 0; i < this._numWorkers; i++) {
      // A SharedArrayBuffer is passed to the worker, which is used to report how many active tasks it has.
      const buf = new SharedArrayBuffer(4);
      const view = new Int32Array(buf);

      // Create a worker with the provided script.
      const worker = new Worker(filename, view);

      // A recursive function executed with setTimeout(). Removes any jobs currently in the queue (up until the max jobs
      // limit) and passes them to the worker thread.
      const processJobs = () => {
        const jobs = this._queue.splice(0, this._maxJobsPerWorker);

        if (jobs.length === 0) {
          this._timeouts[i] = setTimeout(processJobs, 0);
          return;
        }

        worker.once('message', () => {
          this._timeouts[i] = setTimeout(processJobs, 0);
        });

        worker.postMessage(jobs);
      };

      this._timeouts[i] = setTimeout(processJobs, 0);

      // When task results are received from the worker, iterate over them and execute their corresponding callbacks.
      worker.on('message', (results: WorkerJobResult[]) => {
        for (let i = 0; i < results.length; i++) {
          const { num, err, result } = results[i];
          const { resolve, reject } = this._callbacks.get(num)!;

          err ? reject(err) : resolve(result);

          // Delete redundant callbacks to avoid running out of memory.
          this._callbacks.delete(num);
        }
      });

      // Add the newly created worker to the worker pool.
      this._workers.push(worker);
    }
  }

  /**
   * Execute a task by name. All arguments after the first argument are passed on to the worker. Returns
   * a promise which either resolves to the result of the task callback, or rejects with an Error.
   */

  exec(name: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      let err: Error | undefined;

      if (this.#destroyed) {
        err = Error('The worker pool has been destroyed.');
      }

      else if (this._queue.length >= this._maxQueueSize) {
        err = Error(`Max job queue size has been reached: ${this._maxQueueSize} jobs`);
      }

      if (err) {
        reject(err);
        return;
      }

      const num = this._seq();
      this._callbacks.set(num, { resolve, reject });
      this._queue.push({ num, name, args });
    });
  }

  /**
   * Destroys the worker pool instance by terminating all workers, preventing the worker pool from being used again.
   * Tasks not yet completed are immediately canceled. This should be called when the worker pool is no longer needed
   * in order to prevent open handles. Returns a promise that resolves once all workers have been successfully
   * terminated.
   */

  destroy() {
    return new Promise<void>((resolve) => {
      if (this.#destroyed) {
        resolve();
        return;
      }

      setImmediate(async () => {
        for (let i = 0; i < this._numWorkers; i++) {
          clearTimeout(this._timeouts[i]);
          await this._workers[i].terminate();
        }

        this.#destroyed = true;
        resolve();
      });
    });
  }
}
