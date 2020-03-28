import { cpus } from 'os';
import { WorkerPool } from '../src';

const SCRIPT_PATH = './__tests__/__mocks__/index.js';
const numCpus = cpus().length;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Creating a worker pool returns an instance of WorkerPool when', () => {
  test('using default options', async () => {
    const pool = new WorkerPool(SCRIPT_PATH);
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(numCpus - 1);
    expect(pool.maxQueueSize).toBe(Number.MAX_SAFE_INTEGER);
    expect(pool.destroyed).toBe(false);
    await pool.destroy();
  });

  test('`numWorkers` is set to 1', async () => {
    const pool = new WorkerPool(SCRIPT_PATH, { numWorkers: 1 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(1);
    await pool.destroy();
  });

  test('`numWorkers` is set to number of CPUs', async () => {
    const pool = new WorkerPool(SCRIPT_PATH, { numWorkers: numCpus });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.numWorkers).toBe(numCpus);
    await pool.destroy();
  });

  test('`maxQueueSize` is set to 100', async () => {
    const pool = new WorkerPool(SCRIPT_PATH, { maxQueueSize: 100 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.maxQueueSize).toBe(100);
    await pool.destroy();
  });

  test('`maxJobsPerWorker` is set to 100', async () => {
    const pool = new WorkerPool(SCRIPT_PATH, { maxJobsPerWorker: 100 });
    expect(pool).toBeInstanceOf(WorkerPool);
    expect(pool.maxJobsPerWorker).toBe(100);
    await pool.destroy();
  });
});

describe('Calling getStats() returns an object with properties', () => {
  test('that have the same values as their corresponding instance properties', async () => {
    const pool = new WorkerPool(SCRIPT_PATH);

    const expectedResult = {
      activeTasks: pool.activeTasks,
      pendingTasks: pool.pendingTasks,
      idleWorkers: pool.numIdleWorkers,
      activeWorkers: pool.numActiveWorkers,
    };

    const result = pool.getStats();

    expect(result).toEqual(expectedResult);

    await pool.destroy();
  });
});

describe('Executing a task', () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  test ('with function `add(4, 2)` returns 6', async () => {
    const promise = pool.exec('add', 2, 4);
    await expect(promise).resolves.toBe(6);
  });

  test ('after the worker pool has been destroyed throws an error', async () => {
    await pool.destroy();
    const promise = pool.exec('add', 2, 4);
    await expect(promise).rejects.toThrow('The worker pool has been destroyed');
  });
});

describe('Executing an async task', () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  afterAll(async () => await pool.destroy());

  test ('with function `add_async(4, 2)` returns 6', async () => {
    const promise = pool.exec('add_async', 2, 4);
    await expect(promise).resolves.toBe(6);
  });
});

describe('Executing a task that throws an error', () => {
  const pool = new WorkerPool(SCRIPT_PATH);
  afterAll(async () => await pool.destroy());

  test('correctly catches the error', async () => {
    await expect(pool.exec('throw_error')).rejects.toThrow('This is a test error.');
  });
});

describe('Executing a task name that doesn\'t exist', () => {
  const taskName = 'fake_task';
  const pool = new WorkerPool(SCRIPT_PATH);
  afterAll(async () => await pool.destroy());

  test('throws an error', async () => {
    await expect(pool.exec(taskName)).rejects.toThrow(`A task with the name '${taskName}' was not found.`);
  });
});

describe('Executing multiple tasks simultaneously', () => {
  const maxQueueSize = 10;
  const pool = new WorkerPool(SCRIPT_PATH, { maxQueueSize });
  let promise: Promise<number>;

  afterAll(async () => await pool.destroy());

  test ('is successful when the number of tasks equals `maxQueueSize`', async () => {
    for (let i = 0; i < maxQueueSize; i++) {
      promise = pool.exec('add', 2, 4);
    }

    await expect(promise).resolves.toBe(6);
  });

  test ('throws an error when the number of tasks exceeds `maxQueueSize`', async () => {
    for (let i = 0; i < maxQueueSize + 1; i++) {
      promise = pool.exec('add', 2, 4);
    }

    await expect(promise).rejects.toThrow('Max job queue size has been reached: 10 jobs');
  });
});

describe('Destroying a worker pool', () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  test('sets `destroyed` to true', async () => {
    await pool.destroy();
    expect(pool.destroyed).toBe(true);
  });

  test('after it has been destroyed has no effect', async () => {
    await pool.destroy();
    expect(pool.destroyed).toBe(true);
  });
});

describe('Number of active/idle workers when \'numWorkers\' is 2', () => {
  const pool = new WorkerPool(SCRIPT_PATH, { numWorkers: 2 });

  afterAll(async () => await pool.destroy());

  test('and no tasks are executed is equal to 0/2', () => {
    expect(pool.numActiveWorkers).toEqual(0);
    expect(pool.numIdleWorkers).toEqual(2);
  })

  test('and one \'sleep\' task is executed is equal to 1/1', async () => {
    const promise = pool.exec('sleep10ms');
    await sleep(5);
    expect(pool.numActiveWorkers).toEqual(1);
    expect(pool.numIdleWorkers).toEqual(1);
    await promise;
  })
});

describe('After executing the \'sleep100ms\' task there are', () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  afterAll(async () => await pool.destroy());

  test('1 pending task, 0 active tasks', async () => {
    const promise = pool.exec('sleep10ms');

    expect(pool.pendingTasks).toBe(1);
    expect(pool.activeTasks).toBe(0);

    await promise;
  });

  test('0 pending tasks, 1 active task (with 0ms pause)', async () => {
    const promise = pool.exec('sleep10ms');

    await sleep(0);

    expect(pool.pendingTasks).toBe(0);
    expect(pool.activeTasks).toBe(1);

    await promise;
  });
});

describe('Calling destroy() immediately after executing a task', () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  test('causes the task to throw an error', async () => {
    const promise = pool.exec('add', 4, 2);
    await pool.destroy();
    await expect(promise).rejects.toThrow('The worker pool was destroyed before the task could complete.');
  });
});
