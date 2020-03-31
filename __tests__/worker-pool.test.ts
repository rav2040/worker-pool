import { cpus } from 'os';
import { createWorkerPool } from '../src';
import { WorkerPool } from '../src/worker-pool';

const SCRIPT_PATH = './__tests__/__mocks__/index.js';
const numCpus = cpus().length;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Creating a worker pool', () => {
  describe('with default options', () => {
    test('returns an instance of WorkerPool with expected values', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      expect(pool).toBeInstanceOf(WorkerPool);
      expect(pool.destroyed).toBe(false);
      expect(pool.numWorkers).toBe(numCpus - 1);
      expect(pool.maxQueueSize).toBe(Number.MAX_SAFE_INTEGER);
      expect(pool.maxJobsPerWorker).toBe(100);

      await pool.destroy();
    });
  });

  describe('with custom options', () => {
    test('returns an instance of WorkerPool with expected values', async () => {
      const NUM_WORKERS = 2;
      const MAX_QUEUE_SIZE = 100;
      const MAX_JOBS_PER_WORKER = 20;

      const options = {
        numWorkers: NUM_WORKERS,
        maxQueueSize: MAX_QUEUE_SIZE,
        maxJobsPerWorker: MAX_JOBS_PER_WORKER,
      };

      const pool = createWorkerPool(SCRIPT_PATH, options);

      expect(pool).toBeInstanceOf(WorkerPool);
      expect(pool.destroyed).toBe(false);
      expect(pool.numWorkers).toBe(NUM_WORKERS);
      expect(pool.maxQueueSize).toBe(MAX_QUEUE_SIZE);
      expect(pool.maxJobsPerWorker).toBe(MAX_JOBS_PER_WORKER);

      await pool.destroy();
    });
  });

  describe('with option \'numWorkers\' set to 0', () => {
    test('returns an instance of WorkerPool with numWorkers equal to 1', async () => {
      const pool = createWorkerPool(SCRIPT_PATH, { numWorkers: 0 });

      expect(pool.numWorkers).toBe(1);

      await pool.destroy();
    });
  });
});

describe('Calling getStats() ', () => {
  test('returns an object with the expected values', async () => {
    const pool = createWorkerPool(SCRIPT_PATH);

    const expectedResult = {
      activeTasks: pool.activeTasks,
      pendingTasks: pool.pendingTasks,
      idleWorkers: pool.numIdleWorkers,
      activeWorkers: pool.numActiveWorkers,
    };

    expect(pool.getStats()).toEqual(expectedResult);

    await pool.destroy();
  });
});

describe('Calling exec()', () => {
  describe('with arguments: \'add\', 4, 2', () => {
    test('returns 6', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      await expect(pool.exec('add', 4, 2)).resolves.toBe(6);

      await pool.destroy();
    });
  });

  describe('with arguments: \'add_async\', 4, 2', () => {
    test('returns 6', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      await expect(pool.exec('add_async', 4, 2)).resolves.toBe(6);

      await pool.destroy();
    });
  });

  describe('with argument: \'throw_error\'', () => {
    test('throws an error', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      await expect(pool.exec('throw_error')).rejects.toThrow('This is a test error.');

      await pool.destroy();
    });
  });

  describe('with argument: \'does_not_exist\'', () => {
    test('throws an error', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      await expect(pool.exec('does_not_exist'))
        .rejects.toThrow('A task with the name \'does_not_exist\' was not found.');

      await pool.destroy();
    });
  });

  describe('10 times when \'maxQueueSize\' equals 10', () => {
    test('does not throw an error', async () => {
      const maxQueueSize = 10;
      const pool = createWorkerPool(SCRIPT_PATH, { maxQueueSize });

      const promises = [];

      for (let i = 0; i < maxQueueSize - 1; i++) {
        promises.push(pool.exec('test'));
      }

      await expect(pool.exec('test')).resolves.not.toThrow();

      await Promise.all(promises);
      await pool.destroy();
    });
  });

  describe('11 times when \'maxQueueSize\' equals 10', () => {
    test('throws an error', async () => {
      const maxQueueSize = 10;
      const pool = createWorkerPool(SCRIPT_PATH, { maxQueueSize });

      const promises = [];

      for (let i = 0; i < maxQueueSize; i++) {
        promises.push(pool.exec('test'));
      }

      await expect(pool.exec('test')).rejects.toThrow(`Max job queue size has been reached: ${maxQueueSize} jobs`);

      await Promise.all(promises);
      await pool.destroy();
    });
  });

  describe('after the worker pool has been destroyed', () => {
    test('throws an error', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      await pool.destroy();
      await expect(pool.exec('add', 4, 2)).rejects.toThrow('The worker pool has been destroyed.');
    });
  });

  describe('when destroy() is called before it can resolve', () => {
    test('throws an error', async () => {
      const pool = createWorkerPool(SCRIPT_PATH);

      const promise = pool.exec('test');
      await pool.destroy();
      await expect(promise).rejects.toThrow('The worker pool was destroyed before the task could complete.');
    });
  });
});

describe('Calling destroy() once', () => {
  test('sets the \'destroyed\' property to true and does not throw an error', async () => {
    const pool = createWorkerPool(SCRIPT_PATH);

    await expect(pool.destroy()).resolves.not.toThrow();
    expect(pool.destroyed).toBe(true);
  });
});

describe('Calling destroy() twice', () => {
  test('does not throw an error', async () => {
    const pool = createWorkerPool(SCRIPT_PATH);

    await expect(pool.destroy()).resolves.not.toThrow();
    await expect(pool.destroy()).resolves.not.toThrow();
  });
});

describe('When \'numWorkers\' is set to 2 and', () => {
  describe('exec() is not called', () => {
    test('\'numActiveWorkers\' equals 0 and \'numIdleWorkers\' equals 2', async () => {
      const pool = createWorkerPool(SCRIPT_PATH, { numWorkers: 2 });

      expect(pool.numActiveWorkers).toBe(0);
      expect(pool.numIdleWorkers).toBe(2);

      await pool.destroy();
    });
  });

  describe('exec() is called once', () => {
    test('\'numActiveWorkers\' equals 1 and \'numIdleWorkers\' equals 1', async () => {
      const pool = createWorkerPool(SCRIPT_PATH, { numWorkers: 2 });

      const promise = pool.exec('sleep10ms');
      await sleep(5);

      expect(pool.numActiveWorkers).toBe(1);
      expect(pool.numIdleWorkers).toBe(1);

      await promise;
      await pool.destroy();
    });
  });
});

describe('After calling exec() once', () => {
  test('\'pendingTasks\' equals 1 and \'activeTasks\' equals 0 ', async () => {
    const pool = createWorkerPool(SCRIPT_PATH);

    const promise = pool.exec('sleep10ms');
    expect(pool.pendingTasks).toBe(1);
    expect(pool.activeTasks).toBe(0);

    await promise;
    await pool.destroy();
  });
});

describe('After calling exec() once and sleeping for 0ms', () => {
  test('\'pendingTasks\' equals 0 and \'activeTasks\' equals 1 ', async () => {
    const pool = createWorkerPool(SCRIPT_PATH);

    const promise = pool.exec('sleep10ms');
    await sleep(0);
    expect(pool.pendingTasks).toBe(0);
    expect(pool.activeTasks).toBe(1);

    await promise;
    await pool.destroy();
  });
});
