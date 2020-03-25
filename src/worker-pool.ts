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
  result: any,
}

const DEFAULT_DESTROYED = false;

const defaultMaxNumWorkers = cpus().length;
const defaultNumWorkers = defaultMaxNumWorkers - 1;
const defaultMaxQueueSize = Number.MAX_SAFE_INTEGER;
const defaultMaxJobs = Number.MAX_SAFE_INTEGER;

const view: unique symbol = Symbol('data view');

class Worker extends WorkerBase {
  [view]:Uint8Array;

  constructor(filename: string, options: any, dataView: Uint8Array) {
    super(filename, options);
    this[view] = dataView;
  }
}

export class WorkerPool {
  #destroyed = DEFAULT_DESTROYED;

  private readonly _numWorkers: number;
  private readonly _maxQueueSize: number;
  private readonly _maxJobsPerWorker: number;
  private readonly _seq: () => number;

  private readonly _workers: Worker[] = [];
  private readonly _timeouts: NodeJS.Timeout[] = [];
  private readonly _queue: WorkerJob[] = [];
  private readonly _callbacks: { [key: number]: (value: any) => void } = {};

  private _activeTasks: number = 0;
  private _pendingTasks: number = 0;

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

  get activeTasks() {
    return this._activeTasks;
  }

  get pendingTasks() {
    return this._pendingTasks;
  }

  get numIdleWorkers() {
    let i, n;

    for (i = 0, n = 0; i < this._numWorkers; i++) {
      n = n + (this._workers[i][view][0] === 1 ? 1 : 0);
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
      const buf = new SharedArrayBuffer(1);
      const view = new Uint8Array(buf, 0, 1);
      const worker = new Worker(filename, { workerData: view }, view);

      const processJobs = () => {
        const jobs = this._queue.splice(0, this._maxJobsPerWorker);

        if (jobs.length === 0) {
          this._timeouts[i] = setTimeout(processJobs, 0);
          return;
        }

        worker.once('message', () => {
          this._timeouts[i] = setTimeout(processJobs, 0);
        });

        this._activeTasks += jobs.length;
        this._pendingTasks -= jobs.length;

        worker.postMessage(jobs);
      };

      this._timeouts[i] = setTimeout(processJobs, 0);

      worker.on('message', (results: WorkerJobResult[]) => {
        for (let i = 0; i < results.length; i++) {
          const { num, result } = results[i];
          const callback = this._callbacks[num];
          callback(result);
        }

        this._activeTasks -= results.length;
      });

      this._workers.push(worker);
    }
  }

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
      this._callbacks[num] = resolve;
      this._queue.push({ num, name, args });
      this._pendingTasks++;
    });
  }

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
