import { WorkerPool } from '../src/index';

function test0_product(...args: number[]) {
  const result = args.reduce((a, b) => a * b);
  return result;
}

function test1_promise() {
  return new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

let pool: WorkerPool = new WorkerPool();

test('Create instance of WorkerPool', () => {
  pool = new WorkerPool();
  expect(pool).toBeInstanceOf(WorkerPool);
  expect(pool.initialized).toEqual(false);
});

test('Add first test function', () => {
  pool.add('test0_product', test0_product);

  expect(pool.workerFunctions['test0_product']).toBe(test0_product);
});

test('Add second test function', () => {
  pool.add('test1_promise', test1_promise);

  expect(pool.workerFunctions['test1_promise']).toBe(test1_promise);
});

test('Call first test function expecting error', async () => {
  let result: number | undefined;
  let error: Error | undefined;

  try {
    result = await pool.exec('test0_product', 1, 2, 3, 4, 5, 6, 7, 8, 9);
  }

  catch (err) {
    error = err;
  }

  expect(result).toBeUndefined();
  expect(error).toBeInstanceOf(Error);
});

test('Initialise worker pool', () => {
  pool.init();

  expect(pool.initialized).toEqual(true);
  expect(pool.stopped).toEqual(false);
  expect(pool.destroyed).toEqual(false);
});

test('Call first test function successfully', async () => {
  let result: number | undefined;
  let error: Error | undefined;

  try {
    result = await pool.exec('test0_product', 1, 2, 3, 4, 5, 6, 7, 8, 9);
  }

  catch (err) {
    error = err;
  }

  expect(result).toEqual(362_880);
  expect(error).toBeUndefined();
});

test('Stop worker pool', () => {
  pool.stop();

  expect(pool.stopped).toEqual(true);
  expect(pool.destroyed).toEqual(false);
});

test('Call second test function expecting error', async () => {
  let result: number | undefined;
  let error: Error | undefined;

  try {
    result = await pool.exec('test1_promise');
  }

  catch (err) {
    error = err;
  }

  expect(result).toBeUndefined();
  expect(error).toBeInstanceOf(Error);
});

test('Start worker pool', () => {
  pool.start();

  expect(pool.stopped).toEqual(false);
  expect(pool.destroyed).toEqual(false);
});

test('Call second test function successfully', async () => {
  let result: undefined;
  let error: Error | undefined;

  try {
    result = await pool.exec('test1_promise');
  }

  catch (err) {
    error = err;
  }

  expect(result).toBeUndefined();
  expect(error).toBeUndefined();
});

test('Destroy worker pool', async () => {
  await pool.destroy();

  expect(pool.stopped).toEqual(true);
  expect(pool.destroyed).toEqual(true);
});
