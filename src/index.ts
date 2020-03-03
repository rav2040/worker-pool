import { Worker } from 'worker_threads';
import { cpus } from 'os';
import { createRepeatingSequence } from './sequence';

const DEFAULT_INITIALIZED = false;
const DEFAULT_STOPPED = true;
const DEFAULT_DESTROYED = false;

const DEFAULT_PARENT_PORT_STRING = '__parentPort';
const DEFAULT_LISTENERS_STRING = '__listeners';

const maxNumWorkers = cpus().length;
const defaultNumWorkers = maxNumWorkers - 1;
const defaultMaxQueueSize = Number.MAX_SAFE_INTEGER;
const defaultMaxJobs = Number.MAX_SAFE_INTEGER;

class WorkerPool {
  #initialized = DEFAULT_INITIALIZED;
  #stopped = DEFAULT_STOPPED;
  #destroyed = DEFAULT_DESTROYED;

  #workerFunctions: { [name: string]: (...args: any[]) => any } = {};

  private readonly _numWorkers: number;
  private readonly _maxQueueSize: number;
  private readonly _maxJobsPerWorker: number;

  private readonly _seq = createRepeatingSequence();
  private readonly _workers: Worker[] = [];
  private readonly _timeouts: NodeJS.Timeout[] = [];
  private readonly _queue: { n: number, name: string, value: any }[] = [];
  private readonly _callbacks: Map<number, (value: any) => void> = new Map();

  get numWorkers() {
    return this._numWorkers;
  }

  get maxQueueSize() {
    return this._maxQueueSize;
  }

  get maxJobsPerWorker() {
    return this._maxJobsPerWorker;
  }

  get initialized() {
    return this.#initialized;
  }

  get stopped() {
    return this.#stopped;
  }

  get destroyed() {
    return this.#destroyed;
  }

  get workerFunctions() {
    return this.#workerFunctions;
  }

  constructor(options: { numWorkers?: number | 'max', maxQueueSize?: number, maxJobsPerWorker?: number } = {}) {
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
  }

  add(name: string, func: (...args: any[]) => any) {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed');
    }

    if (this.#initialized) {
      throw Error('The worker pool has already been initialized.');
    }

    this.#workerFunctions[name] = func;

    return this;
  }

  init() {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed.');
    }

    if (this.#initialized) {
      throw Error('The worker pool has already been initialized.');
    }

    let parentPort = DEFAULT_PARENT_PORT_STRING;
    let listeners = DEFAULT_LISTENERS_STRING;

    const listenersAsStringArray = Object.values(this.#workerFunctions)
      .map((listener) => listener.toString());

    const listenersAsString = ''.concat(...listenersAsStringArray);

    while (listenersAsString.includes(parentPort)) {
      parentPort = '_' + parentPort;
    }

    while (listenersAsString.includes(listeners)) {
      listeners = '_' + listeners;
    }

    let code = `const { parentPort: ${parentPort} } = require('worker_threads');`;

    code += `const ${listeners} = {`;

    for (const [name, func] of Object.entries(this.#workerFunctions)) {
      code += `${name}: ${func},`;
    }

    code += '}';

    code += `
      ${parentPort}.on('message', async (jobs) => {
        for (const job of jobs) {
          const listener = ${listeners}[job.name];
          if (Array.isArray(job.value)) {
            job.value = await listener(...job.value);
            continue;
          }
          job.value = await listener(job.value);
        }
        ${parentPort}.postMessage(jobs);
      });
    `;

    for (let i = 0; i < this._numWorkers; i++) {
      const worker = new Worker(code, { eval: true });

      worker.on('message', (results) => {
        for (const { n, value } of results) {
          const callback = this._callbacks.get(n);
          callback!(value);
          this._callbacks.delete(n);
        }
      });

      this._workers.push(worker);
    }

    this.#initialized = true;

    this.start();

    return this;
  }

  start() {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed.');
    }

    if (!this.#initialized) {
      throw Error('The worker pool has not been initialized.');
    }

    if (!this.#stopped) {
      return;
    }

    for (const [n, worker] of this._workers.entries()) {
      worker.ref();

      const processJobs = () => {
        const jobs = this._queue.splice(0, this._maxJobsPerWorker);

        if (jobs.length === 0) {
          this._timeouts[n] = setTimeout(processJobs, 0);
          return;
        }

        worker.once('message', () => {
          this._timeouts[n] = setTimeout(processJobs, 0);
        });

        worker.postMessage(jobs);
      };

      this._timeouts[n] = setTimeout(processJobs, 0);
    }

    this.#stopped = false;

    return this;
  }

  stop() {
    if (this.#destroyed) {
      throw Error('The worker pool has been destroyed.');
    }

    if (!this.#initialized) {
      throw Error('The worker pool has not been initialized.');
    }

    if (this.#stopped) {
      return;
    }

    for (const [n, worker] of this._workers.entries()) {
      clearTimeout(this._timeouts[n]);
      worker.unref();
    }

    this.#stopped = true;

    return this;
  }

  exec(name: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      let err: Error | undefined;

      if (this.#destroyed) {
        err = Error('The worker pool has been destroyed.');
      }

      else if (!this.#initialized) {
        err = Error('The worker pool has not been initialized.');
      }

      else if (this.#stopped) {
        err = Error('The worker pool is stopped.');
      }

      else if (!this.#workerFunctions[name]) {
        err = Error(`A worker function with the name '${name}' does not exist in the worker pool.`);
      }

      else if (this._queue.length >= this._maxQueueSize) {
        err = Error(`Max job queue size has been reached: ${this._maxQueueSize} jobs`);
      }

      if (err) {
        reject(err);
        return;
      }

      const n = this._seq() as number;
      const value = args;

      this._callbacks.set(n, resolve);
      this._queue.push({ n, name, value });
    });
  }

  destroy() {
    return new Promise<number>((resolve, reject) => {
      if (this.#destroyed) {
        resolve(0);
        return;
      }

      if (!this.#stopped) {
        this.stop();
      }

      setImmediate(async () => {
        for (const worker of this._workers) {
          const exitCode = await worker.terminate();

          if (exitCode !== 1) {
            const err = Error(`Worker ${worker.threadId} failed to terminate.`);
            reject(err);
            return;
          }
        }

        this.#destroyed = true;

        resolve(1);
      });
    });
  }
}

export { WorkerPool };
