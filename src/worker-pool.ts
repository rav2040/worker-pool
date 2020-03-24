import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { createRepeatingSequence } from './sequence';

type WorkerPoolOptions = {
  numWorkers?: number | 'max',
  maxQueueSize?: number,
  maxJobsPerWorker?: number,
};

const STOPPED_DEFAULT = true;
const DESTROYED_DEFAULT = false;

const maxNumWorkers = cpus().length;
const defaultNumWorkers = maxNumWorkers - 1;
const defaultMaxQueueSize = Number.MAX_SAFE_INTEGER;
const defaultMaxJobs = Number.MAX_SAFE_INTEGER;

export class WorkerPool {
  #stopped = STOPPED_DEFAULT;
  #destroyed = DESTROYED_DEFAULT;

  private readonly _numWorkers: number;
  private readonly _maxQueueSize: number;
  private readonly _maxJobsPerWorker: number;

  private readonly _seq = createRepeatingSequence();
  private readonly _workers: Worker[] = [];
  private readonly _timeouts: NodeJS.Timeout[] = [];
  private readonly _queue: { n: number, name: string, value: any }[] = [];
  private readonly _callbacks: Map<number, (value: any) => void> = new Map();

  get isStopped() {
    return this.#stopped;
  }

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

  constructor(filename: string, options: WorkerPoolOptions = {}) {
    if (!options.numWorkers) {
      this._numWorkers = defaultNumWorkers;
    }

    else {
      if (options.numWorkers === 'max') {
        this._numWorkers = maxNumWorkers;
      }

      else {
        this._numWorkers = options.numWorkers <= maxNumWorkers
          ? options.numWorkers
          : maxNumWorkers;
      }
    }

    this._maxQueueSize = options.maxQueueSize ?? defaultMaxQueueSize;
    this._maxJobsPerWorker = options.maxJobsPerWorker ?? defaultMaxJobs;

    for (let i = 0; i < this._numWorkers; i++) {
      const worker = new Worker(filename);

      worker.on('message', (results) => {
        for (let i = 0; i < results.length; i++) {
          const { n, value } = results[i];
          const callback = this._callbacks.get(n);
          callback?.(value);
          this._callbacks.delete(n);
        }
      });

      this._workers.push(worker);
    }

    this.start();
  }

  start() {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed.');
    }

    if (!this.#stopped) {
      return;
    }

    for (let i = 0; i < this._numWorkers; i++) {
      const worker = this._workers[i];
      worker.ref();

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
    }

    this.#stopped = false;

    return this;
  }

  stop() {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed.');
    }

    if (this.#stopped) {
      return;
    }

    for (let i = 0; i < this._numWorkers; i++) {
      clearTimeout(this._timeouts[i]);
      this._workers[i].unref();
    }

    this.#stopped = true;

    return this;
  }

  destroy() {
    return new Promise<void>((resolve) => {
      if (this.#destroyed) {
        resolve();
        return;
      }

      if (!this.#stopped) {
        this.stop();
      }

      setImmediate(async () => {
        for (const worker of this._workers) {
          await worker.terminate();
        }

        this.#destroyed = true;
        resolve();
      });
    });
  }

  exec(name: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      let err: Error | undefined;

      if (this.#destroyed) {
        err = Error('The worker pool has been destroyed.');
      }

      else if (this.#stopped) {
        err = Error('The worker pool is stopped.');
      }

      else if (this._queue.length >= this._maxQueueSize) {
        err = Error(`Max job queue size has been reached: ${this._maxQueueSize} jobs`);
      }

      if (err) {
        reject(err);
        return;
      }

      const n = this._seq();
      this._callbacks.set(n, resolve);
      this._queue.push({ n, name, value: args });
    });
  }
}
