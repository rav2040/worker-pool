const { cpus } = require('os');
const { WorkerPool, createTask } = require('../src');

const FILENAME = './__tests__/example/index.js';
const numCpus = cpus().length;

describe('Creating a task', () => {
  test('using a sync function', () => {
    function add(a, b) {
      return a + b;
    }

    expect(() => createTask('add', add)).not.toThrowError();
  });

  test('using an async function', () => {
    async function add(a, b) {
      return a + b;
    }

    expect(() => createTask('add', add)).not.toThrowError();
  });
});

describe('Creating a worker pool', () => {
  test('using default options', async () => {
    const pool = new WorkerPool(FILENAME);
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(numCpus - 1);
    expect(pool.maxQueueSize).toBe(Number.MAX_SAFE_INTEGER);
    expect(pool.isStopped).toBe(false);
    expect(pool.isDestroyed).toBe(false);
    await pool.destroy();
  });

  test('with numWorkers set to \'max\'', async () => {
    const pool = new WorkerPool(FILENAME, { numWorkers: 'max' });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(numCpus);
    await pool.destroy();
  });

  test('with numWorkers set to 1', async () => {
    const pool = new WorkerPool(FILENAME, { numWorkers: 1 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(1);
    await pool.destroy();
  });

  test('with numWorkers set to number of CPUs + 1', async () => {
    const pool = new WorkerPool(FILENAME, { numWorkers: numCpus + 1 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(numCpus);
    await pool.destroy();
  });

  test('with maxQueueSize set to 100', async () => {
    const pool = new WorkerPool(FILENAME, { maxQueueSize: 100 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.maxQueueSize).toBe(100);
    await pool.destroy();
  });

  test('with maxJobsPerWorker set to 100', async () => {
    const pool = new WorkerPool(FILENAME, { maxJobsPerWorker: 100 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.maxJobsPerWorker).toBe(100);
    await pool.destroy();
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);
  afterAll(async () => await pool.destroy());

  test('Stopping', () => {
    pool.stop();
    expect(pool.isStopped).toBe(true);
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);
  afterAll(async () => await pool.destroy());

  test('Stopping and starting', () => {
    pool.stop();
    expect(pool.isStopped).toBe(true);
    pool.start();
    expect(pool.isStopped).toBe(false);
  });

  test('Stopping after it has already been stopped', () => {
    pool.stop();
    expect(pool.isStopped).toBe(true);
    pool.stop();
    expect(pool.isStopped).toBe(true);
  });

  test('Starting after it has already been started', () => {
    pool.start();
    expect(pool.isStopped).toBe(false);
    pool.start();
    expect(pool.isStopped).toBe(false);
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);

  test('Destroying', async () => {
    await pool.destroy();
    expect(pool.isDestroyed).toBe(true);
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);

  test('Starting after is has been destroyed', async () => {
    await pool.destroy();
    expect(() => pool.start()).toThrow('The worker pool has been destroyed.');
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);

  test('Stopping after is has been destroyed', async () => {
    await pool.destroy();
    expect(() => pool.stop()).toThrow('The worker pool has been destroyed.');
  });
});

describe('Changing the state of a worker pool', () => {
  const pool = new WorkerPool(FILENAME);

  test('Destroying after is has been destroyed', async () => {
    await pool.destroy();
    expect(pool.isDestroyed).toBe(true);
    await pool.destroy();
    expect(pool.isDestroyed).toBe(true);
  });
});

describe('Executing a task', () => {
  const pool = new WorkerPool(FILENAME);

  afterAll(async () => await pool.destroy());

  test ('add(4, 2) returns 6', async () => {
    const promise = pool.exec('add', 2, 4);
    await expect(promise).resolves.toBe(6);
  });
});

describe('Executing a task', () => {
  const pool = new WorkerPool(FILENAME);

  afterAll(async () => await pool.destroy());

  test ('after the worker pool has been stopped throws an error', async () => {
    pool.stop();

    const promise = pool.exec('add', 2, 4);
    await expect(promise).rejects.toThrow('The worker pool is stopped.');
  });
});

describe('Executing a task', () => {
  const pool = new WorkerPool(FILENAME);

  test ('after the worker pool has been destroyed throws an error', async () => {
    await pool.destroy();

    const promise = pool.exec('add', 2, 4);
    await expect(promise).rejects.toThrow('The worker pool has been destroyed');
  });
});

describe('Executing multiple tasks', () => {
  const pool = new WorkerPool(FILENAME, { maxQueueSize: 1 });
  let promise;

  afterAll(async () => await pool.destroy());

  test ('when maxQueueSize is set to 1 throws an error', async () => {
    promise = pool.exec('add', 2, 4);
    promise = pool.exec('add', 2, 4);
    await expect(promise).rejects.toThrow('Max job queue size has been reached: 1 jobs');
  });
});

describe('Executing multiple tasks', () => {
  const pool = new WorkerPool(FILENAME);
  let promise;

  afterAll(async () => await pool.destroy());

  test ('is successful when number of tasks is over 10,000', async () => {
    for (let i = 0; i < 10002; i++) {
      promise = pool.exec('add', 2, 4);
    }

    await expect(promise).resolves.toBe(6);
  });
});
