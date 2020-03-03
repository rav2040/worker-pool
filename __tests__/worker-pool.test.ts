import { cpus } from 'os';
import { WorkerPool } from '../src/index';


function test_reserved0() {
  //@ts-ignore
  return __parentPort;
}

function test_reserved1() {
  //@ts-ignore
  return __listeners;
}

function test_product(...args: number[]) {
  const result = args.reduce((a, b) => a * b);
  return result;
}

function test_promise() {
  return new Promise((resolve) => {
    setTimeout(() => resolve(42), 10);
  });
}

function test_jsonStringify(obj: object) {
  return JSON.stringify(obj);
}

describe('Successfully creating an instance of WorkerPool with', () => {
  const numCpus = cpus().length;

  test('default options', () => {
    const pool = new WorkerPool();

    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toEqual(numCpus - 1);
    expect(pool.maxQueueSize).toEqual(Number.MAX_SAFE_INTEGER);
    expect(pool.initialized).toEqual(false);
    expect(pool.stopped).toEqual(true);
    expect(pool.destroyed).toEqual(false);
  });

  test('numWorkers set to \'max\'', () => {
    const pool = new WorkerPool({ numWorkers: 'max'});

    expect(pool.numWorkers).toEqual(numCpus);
  });

  test('numWorkers set to 1', () => {
    const pool = new WorkerPool({ numWorkers: 1});

    expect(pool.numWorkers).toEqual(1);
  });

  test('numWorkers set to number of CPUs + 1', () => {
    const pool = new WorkerPool({ numWorkers: numCpus + 1});

    expect(pool.numWorkers).toEqual(numCpus);
  });

  test('maxQueueSize set to 100', () => {
    const pool = new WorkerPool({ maxQueueSize: 100 });

    expect(pool.maxQueueSize).toEqual(100);
  });

  test('maxJobsPerWorker set to 100', () => {
    const pool = new WorkerPool({ maxJobsPerWorker: 100 });

    expect(pool.maxJobsPerWorker).toEqual(100);
  });
});

describe('Adding a function', () => {
  const pool = new WorkerPool();

  afterAll(async () => {
    await pool.destroy();
  });

  function addFunction () {
    pool.add('test_product', test_product);
  }

  test('successfully', () => {
    pool.add('test_product', test_product);
    expect(pool.workerFunctions['test_product']).toBe(test_product);
  });

  test('successfully (async function)', () => {
    pool.add('test_promise', test_promise);
    expect(pool.workerFunctions['test_promise']).toBe(test_promise);
  });

  test('after worker pool is initialised throws an error', () => {
    pool.init();
    expect(addFunction).toThrowError('The worker pool has already been initialized.');
  });
});

describe('Adding a function', () => {
  test('after worker pool is destroyed throws an error', async () => {
    const pool = new WorkerPool();

    await pool.destroy();

    function addFunction () {
      pool.add('test_product', test_product);
    }

    expect(addFunction).toThrowError('The worker pool has been destroyed');
  });
});

describe('Initialising a worker pool', () => {
  const pool = new WorkerPool();

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully', () => {
    pool.init();

    expect(pool.initialized).toEqual(true);
    expect(pool.stopped).toEqual(false);
    expect(pool.destroyed).toEqual(false);
  });

  test('a second time throws an error', () => {
    expect(() => pool.init()).toThrowError('The worker pool has already been initialized.');
  });
});

describe('Initialising a worker pool', () => {
  const pool = new WorkerPool();

  pool.add('test_reserved0', test_reserved0);

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully when one of the added functions attempts to access the variable \'__parentPort\'', async () => {
    pool.init();
    expect(pool.initialized).toEqual(true);
  });
});

describe('Initialising a worker pool', () => {
  const pool = new WorkerPool();

  pool.add('test_reserved1', test_reserved1);

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully when one of the added functions attempts to access the variable \'__listeners\'', async () => {
    pool.init();
    expect(pool.initialized).toEqual(true);
  });
});

describe('Initialising a worker pool', () => {
  test('after it has been destroyed throws an error', async () => {
    const pool = new WorkerPool();

    await pool.destroy();

    expect(() => pool.init()).toThrowError('The worker pool has been destroyed.');
  });
});

describe('Starting a worker pool', () => {
  const pool = new WorkerPool();

  test('before it has been initialised throws an error', () => {
    expect(() => pool.start()).toThrowError('The worker pool has not been initialized.');
  });
});

describe('Starting a worker pool', () => {
  const pool = new WorkerPool();

  pool.init();
  pool.stop();

  test('successfully', () => {
    pool.start();

    expect(pool.stopped).toEqual(false);
  });

  test('successfully a second time', () => {
    pool.start();

    expect(pool.stopped).toEqual(false);
  });

  test('after it has been destroyed throws an error', async () => {
    await pool.destroy();

    expect(() => pool.start()).toThrowError('The worker pool has been destroyed.');
  });
});

describe('Executing a function', () => {
  const pool = new WorkerPool();

  test('before the worker pool is initialised throws an error', async () => {
    const promise = pool.exec('test_product', 1, 2, 3);

    await expect(promise).rejects.toThrowError('The worker pool has not been initialized.');
  });
});

describe('Executing a function', () => {
  const pool = new WorkerPool({ numWorkers: 1, maxQueueSize: 1 });

  pool
    .add('test_product', test_product)
    .init();

  afterAll(async () => {
    await pool.destroy();
  });

  test('when job queue is full throws an error', async () => {
    pool.exec('test_product', 1, 2, 3);

    const promise = pool.exec('test_product', 1, 2, 3);

    await expect(promise).rejects.toThrowError('Max job queue size has been reached: 1 jobs');
  });
});

describe('Executing a function', () => {
  const pool = new WorkerPool({});

  pool
    .add('test_product', test_product)
    .add('test_promise', test_promise)
    .init();

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully', async () => {
    const promise = pool.exec('test_product', 1, 2, 3);
    await expect(promise).resolves.toEqual(6);
  });

  test('successfully (async function)', async () => {
    const promise = pool.exec('test_promise');
    await expect(promise).resolves.toEqual(42);
  });

  test('that doesn\'t exist throws an error', async () => {
    const functionName = 'test_noexist';
    const promise = pool.exec(functionName);

    await expect(promise)
      .rejects
      .toThrowError(`A worker function with the name '${functionName}' does not exist in the worker pool.`);
  });

  test('while the worker pool is stopped throws an error', async () => {
    pool.stop();

    const promise = pool.exec('test_product', 1, 2, 3);

    await expect(promise).rejects.toThrowError('The worker pool is stopped.');
  });

  test('after the worker pool is destroyed throws an error', async () => {
    await pool.destroy();

    const promise = pool.exec('test_product', 1, 2, 3);

    await expect(promise).rejects.toThrowError('The worker pool has been destroyed.');
  });
});

describe('Executing a function', () => {
  const pool = new WorkerPool({ maxJobsPerWorker: 1000 });

  pool
    .add('test_jsonStringify', test_jsonStringify)
    .init();

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully 10,000 times (1000 jobs per worker)', async () => {
    const expectedResult: string[] = [];

    for (let i = 0; i < 10_000; i++) {
      expectedResult.push(JSON.stringify({ foo: 42 }));
    }

    const promises: Promise<string>[] = [];

    for (let i = 0; i < 10_000; i++) {
      const promise = pool.exec('test_jsonStringify', { foo: 42 });
      promises.push(promise);
    }

    await expect(Promise.all(promises)).resolves.toEqual(expectedResult);
  });
});

describe('Stopping a worker pool', () => {
  const pool = new WorkerPool();

  test('before it has been initialised throws an error', () => {
    expect(() => pool.stop()).toThrowError('The worker pool has not been initialized.');
  });
});

describe('Stopping a worker pool', () => {
  const pool = new WorkerPool();

  pool.init();

  afterAll(async () => {
    await pool.destroy();
  });

  test('successfully', () => {
    pool.stop();

    expect(pool.stopped).toEqual(true);
  });

  test('successfully a second time', () => {
    pool.stop();

    expect(pool.stopped).toEqual(true);
  });

  test('after it has been destroyed throws an error', async() => {
    await pool.destroy();

    expect(() => pool.stop()).toThrowError('The worker pool has been destroyed.');
  });
});

describe('Destroying a worker pool', () => {
  const pool = new WorkerPool();

  pool.init();
  pool.stop();

  test('successfully', async () => {
    const promise = pool.destroy();

    await expect(promise).resolves.toEqual(1);
    expect(pool.destroyed).toEqual(true);
  });

  test('successfully a second time', async () => {
    const promise = pool.destroy();

    await expect(promise).resolves.toEqual(0);
    expect(pool.destroyed).toEqual(true);
  });
});

describe('Destroying a worker pool', () => {
  const pool = new WorkerPool();

  pool.init();

  test('successfully before it has been stopped', async () => {
    const promise = pool.destroy();

    await expect(promise).resolves.toEqual(1);
    expect(pool.destroyed).toEqual(true);
  });
});
