import { cpus } from 'os';
import { WorkerPool } from '../src';

const SCRIPT_PATH = './__tests__/__mocks__/index.js';
const numCpus = cpus().length;

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

test('Creating a worker pool with default options returns an instance of WorkerPool with expected properties', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  expect(pool).toBeInstanceOf(WorkerPool);
  expect(pool.destroyed).toBe(false);
  expect(pool.numWorkers).toBe(numCpus - 1);
  expect(pool.maxQueueSize).toBe(Number.MAX_SAFE_INTEGER);
  expect(pool.maxJobsPerWorker).toBe(Number.MAX_SAFE_INTEGER);

  await pool.destroy();
});

test('Creating a worker pool with custom options returns an instance of WorkerPool with expected properties', async () => {
  const NUM_WORKERS = 2;
  const MAX_QUEUE_SIZE = 100;
  const MAX_JOBS_PER_WORKER = 20;

  const options = {
    numWorkers: NUM_WORKERS,
    maxQueueSize: MAX_QUEUE_SIZE,
    maxJobsPerWorker: MAX_JOBS_PER_WORKER,
  };

  const pool = new WorkerPool(SCRIPT_PATH, options);

  expect(pool).toBeInstanceOf(WorkerPool);
  expect(pool.destroyed).toBe(false);
  expect(pool.numWorkers).toBe(NUM_WORKERS);
  expect(pool.maxQueueSize).toBe(MAX_QUEUE_SIZE);
  expect(pool.maxJobsPerWorker).toBe(MAX_JOBS_PER_WORKER);

  await pool.destroy();
});

test('Calling pool.getStats() returns an object with the expected properties and values', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  const expectedResult = {
    activeTasks: pool.activeTasks,
    pendingTasks: pool.pendingTasks,
    idleWorkers: pool.numIdleWorkers,
    activeWorkers: pool.numActiveWorkers,
  };

  expect(pool.getStats()).toEqual(expectedResult);

  await pool.destroy();
});

test('Calling pool.exec(\'add\', 4, 2) returns 6', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.exec('add', 4, 2)).resolves.toBe(6);

  await pool.destroy();
});

test('Calling pool.exec(\'add_async\', 4, 2) returns 6', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.exec('add_async', 4, 2)).resolves.toBe(6);

  await pool.destroy();
});

test('Calling pool.exec(\'add\', 4, 2) after the worker pool has been destroyed throws an error', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await pool.destroy();
  await expect(pool.exec('add', 4, 2)).rejects.toThrow('The worker pool has been destroyed.');
});

test('Calling pool.exec(\'throw_error\') throws an error', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.exec('throw_error')).rejects.toThrow('This is a test error.');

  await pool.destroy();
});

test('Calling pool.exec(\'does_not_exist\') throws an error', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.exec('does_not_exist')).rejects.toThrow('A task with the name \'does_not_exist\' was not found.');

  await pool.destroy();
});

test('Calling pool.exec(\'test\') 10 times when \'maxQueueSize\' equals 10 does not throw an error', async () => {
  const maxQueueSize = 10;
  const pool = new WorkerPool(SCRIPT_PATH, { maxQueueSize });

  const promises = [];

  for (let i = 0; i < maxQueueSize - 1; i++) {
    promises.push(pool.exec('test'));
  }

  await expect(pool.exec('test')).resolves.not.toThrow();

  await Promise.all(promises);
  await pool.destroy();
});

test('Calling pool.exec(\'test\') 11 times when \'maxQueueSize\' equals 10 throws an error', async () => {
  const maxQueueSize = 10;
  const pool = new WorkerPool(SCRIPT_PATH, { maxQueueSize });

  const promises = [];

  for (let i = 0; i < maxQueueSize; i++) {
    promises.push(pool.exec('test'));
  }

  await expect(pool.exec('test')).rejects.toThrow(`Max job queue size has been reached: ${maxQueueSize} jobs`);

  await Promise.all(promises);
  await pool.destroy();
});

test('Calling pool.destroy() does not throw an error and sets the \'destroyed\' property to true', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.destroy()).resolves.not.toThrow();
  expect(pool.destroyed).toBe(true);
});

test('Calling pool.destroy() twice does not throw an error', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  await expect(pool.destroy()).resolves.not.toThrow();
  await expect(pool.destroy()).resolves.not.toThrow();
});

test('Pool.exec() rejects with an error if pool.destroy() is called before it can resolve', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  const promise = pool.exec('test');
  await pool.destroy();
  await expect(promise).rejects.toThrow('The worker pool was destroyed before the task could complete.');
});

test('\'pool.numActiveWorkers\' equals 0 and \'pool.numIdleWorkers\' equals 2 when \'numWorkers\' is set to 2 and pool.exec() is not called', async () => {
  const pool = new WorkerPool(SCRIPT_PATH, { numWorkers: 2 });

  expect(pool.numActiveWorkers).toBe(0);
  expect(pool.numIdleWorkers).toBe(2);

  await pool.destroy();
});

test('\'pool.numActiveWorkers\' equals 1 and \'pool.numIdleWorkers\' equals 1 when \'numWorkers\' is set to 2 and pool.exec() is called once', async () => {
  const pool = new WorkerPool(SCRIPT_PATH, { numWorkers: 2 });

  const promise = pool.exec('sleep10ms');
  await sleep(5);

  expect(pool.numActiveWorkers).toBe(1);
  expect(pool.numIdleWorkers).toBe(1);

  await promise;
  await pool.destroy();
});

test('\'pool.pendingTasks\' equals 1 and \'pool.activeTasks\' equals 0 immediately after calling pool.exec() once', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  const promise = pool.exec('sleep10ms');
  expect(pool.pendingTasks).toBe(1);
  expect(pool.activeTasks).toBe(0);

  await promise;
  await pool.destroy();
});

test('\'pool.pendingTasks\' equals 0 and \'pool.activeTasks\' equals 1 after calling pool.exec() once', async () => {
  const pool = new WorkerPool(SCRIPT_PATH);

  const promise = pool.exec('sleep10ms');
  await sleep(0);
  expect(pool.pendingTasks).toBe(0);
  expect(pool.activeTasks).toBe(1);

  await promise;
  await pool.destroy();
});
