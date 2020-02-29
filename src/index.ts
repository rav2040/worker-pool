import { Worker } from 'worker_threads';
import { cpus } from 'os';

const maxNumWorkers = cpus().length;
const defaultNumWorkers = maxNumWorkers - 1;

class WorkerPool {
  readonly #numWorkers: number;
  readonly #intervalIds: NodeJS.Timeout[] = [];

  #isStopped = true;
  #isDestroyed = false;

  private _workerFunctions: { [name: string]: (...args: any[]) => any } = {};
  private readonly _seq = createRepeatingSequence();
  private readonly _workers: Worker[] = [];
  private readonly _queue: { n: number, name: string, value: any }[] = [];
  private readonly _callbacks: Map<number, (value: any) => void> = new Map();

  get numWorkers() {
    return this.#numWorkers;
  }

  get isStopped() {
    return this.#isStopped;
  }

  get isDestroyed() {
    return this.#isDestroyed;
  }

  get workerFunctions() {
    return this._workerFunctions;
  }

  constructor(options: { numWorkers?: number | 'max' } = {}) {
    if (!options.numWorkers) {
      this.#numWorkers = defaultNumWorkers;
    }

    else {
      if (options.numWorkers === 'max') {
        this.#numWorkers = maxNumWorkers;
      }

      else {
        this.#numWorkers = options.numWorkers <= maxNumWorkers
          ? options.numWorkers
          : maxNumWorkers;
      }
    }
  }

  add(name: string, func: (...args: any[]) => any) {
    if (this.#isDestroyed) {
      throw Error('The worker pool has been destroyed');
    }

    this._workerFunctions[name] = func;
    return this;
  }

  init() {
    if (this.#isDestroyed) {
      throw Error('The worker pool has been destroyed');
    }

    let code = 'const { parentPort } = require(\'worker_threads\');';

    code += 'const funcs = {';

    for (const [name, func] of Object.entries(this._workerFunctions)) {
      code += `${name}: ${func},`;
    }

    code += '}';

    code += `
      parentPort.on('message', async (jobs) => {
        for (const job of jobs) {
          const func = funcs[job.name];
          if (Array.isArray(job.value)) {
            job.value = await func(...job.value);
            continue;
          }
          job.value = func(job.value);
        }
        parentPort.postMessage(jobs);
      });
    `;

    for (let i = 0; i < this.#numWorkers; i++) {
      const worker = new Worker(code, { eval: true });

      worker.on('message', (results) => {
        for (const { n, value } of results) {
          const callback = this._callbacks.get(n);
          callback?.(value);
          this._callbacks.delete(n);

        }
      });

      this._workers.push(worker);
    }

    this.start();

    return this;
  }

  start() {
    if (this.#isDestroyed) {
      throw Error('The worker pool has been destroyed');
    }

    for (const [n, worker] of this._workers.entries()) {
      worker.ref();

      this.#intervalIds[n] = setInterval(() => {
        const jobs = this._queue.splice(0);
        worker.postMessage(jobs);
      }, 10);
    }

    this.#isStopped = false;

    return this;
  }

  stop() {
    if (this.#isDestroyed) {
      throw Error('The worker pool has been destroyed');
    }

    for (const [n, worker] of this._workers.entries()) {
      clearInterval(this.#intervalIds[n]);

      worker.unref();
    }

    this.#intervalIds.splice(0);

    this.#isStopped = true;

    return this;
  }

  exec(name: string, ...args: any[]) {
    return new Promise<any>((resolve, reject) => {
      if (this.#isDestroyed) {
        const err = Error('The worker pool has been destroyed');
        reject(err);
        return;
      }

      if (this.#isStopped) {
        const err = Error('The worker pool is stopped.');
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
    return new Promise((resolve) => {
      if (this.#isDestroyed) {
        resolve();
        return;
      }

      if (!this.#isStopped) {
        this.stop();
      }

      setImmediate(async () => {
        for (const worker of this._workers) {
          await worker.terminate();
        }

        this.#isDestroyed = true;

        resolve();
      });
    });
  }
}

function createRepeatingSequence(start = 0, end = Number.MAX_SAFE_INTEGER) {
  let n = start;

  return () => {
    const value = n;
    n = n < end ? n + 1 : 0;
    return value;
  };
}

export { WorkerPool };
