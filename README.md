# TuftJS: Worker Pool

![Node.js CI](https://github.com/tuftjs/worker-pool/workflows/Node.js%20CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/tuftjs/worker-pool/badge.svg?branch=master)](https://coveralls.io/github/tuftjs/worker-pool?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/tuftjs/worker-pool/badge.svg?targetFile=package.json)](https://snyk.io/test/github/rav2040/rollup-plugin-scrub?targetFile=package.json)

Use a pool of Node.js worker threads to perform computationally expensive operations.

A worker pool consists of an array of dedicated workers that perform user-defined tasks. Tasks submitted to the worker pool are added to a queue, and the workers take it in turns to take jobs from the queue. By default, jobs are batched together. Once a worker has finished processing all jobs in a particular batch, the results are sent back to the main thread.

As advised in the official Worker Threads [documentation](https://nodejs.org/dist/latest-v12.x/docs/api/worker_threads.html), worker threads should only be used for offloading CPU-intensve operations from the main thread. Otherwise, the overhead of passing data back and forth between the main thread and workers will exceed any benefit.

### Installation

```sh
npm install @tuft/worker-pool
```

### Usage

First, create the script that will be loaded by the worker pool. Import the `createTask()` function and pass it a task name and a callback function. In this contrived example, we're generating a string of random bytes of `size` length.

```js
// my-script.js

const { createTask } = require('@tuft/worker-pool');
const { randomBytes } = require('crypto');

createTask('random bytes', (size) => {
  return randomBytes(size);
});
```

Then, in your main application, import the `WorkerPool` class and create a new instance, passing the pathname of your script as the first argument. You will then be able to execute the task from your script by calling `pool.exec()`, passing the name of the task (in this case, `'random bytes'`) as the first argument. The remaining arguments passed to `pool.exec()` should be the arguments your function accepts. In this example, that would be the `size` of the random bytes.

```js
// my-app.js

const { WorkerPool } = require('@tuft/worker-pool');

const pool = new WorkerPool(__dirname + '/my-script.js');

async function main() {
  const result = await pool.exec('random bytes', 256);
  console.log(result.toString()); // 3b0fb3156251699d1e0f32dca3ff306f43e...

  // Don't forget to destroy the worker pool once you've finished with it.
  await pool.destroy();
}

main();
```
`pool.exec()` will return a promise that resolves to the result of your task. To prevent active handles from letting your application exit cleanly, you'll have to call `pool.destroy()` once you're done.

## API

### **`createTask(name, callback)`**

Adds the provided `callback` to an internal list of functions, indexed by `name`. This function should be called in a separate script file, which is then loaded by the the worker pool.

#### Parameters
* `name: string`
* `callback: Function | AsyncFunction`

Throws an `Error` if a task with the provided name has already been created.


```js
const { createTask } = require('@tuft/worker-pool');

createTask('cube', (num) => {
  return num ** 3;
});
```

### **`createWorkerPool(filename, options?)`**

Returns an instance of `WorkerPool`. Workers are implemented using the Node built-in `Worker` class. The `filename` passed as the first argument should be the absolute or relative path of a `.js` file which implements the `createTask()` function as outlined above.

#### Parameters
* `filename: string`
* `options?: Object`

If an `options` object is provided, it can contain any of the following optional properties:

* `numWorkers: number`  
  The number of workers the worker pool will employ. Defaults to *'number of CPU cores' - 1*.
* `maxQueueSize: number`  
  The maximum number of pending jobs the worker pool will accept. Defaults to `Number.MAX_SAFE_INTEGER`.
* `maxJobsPerWorker: number`  
  The maximum number of jobs a worker will take from the queue at once. Defaults to `Number.MAX_SAFE_INTEGER`.

```js
const { WorkerPool } = require('@tuft/worker-pool');

async function main() {
  const pool = new WorkerPool('./my-script.js', {
    numWorkers: 2,
    maxQueueSize: 1000,
    maxJobsPerWorker: 40,
  });

  const result = await pool.exec('cube', 73);
  console.log(result); // 389017

  await pool.destroy();
}

main();
```

### **`class WorkerPool`**
The `WorkerPool` class is not exported directly, but instead returned by the `createWorkerPool()` function. It exposes the following properties and methods:

### `.destroy()`  
Terminates all workers and removes all jobs from the queue. Tasks not yet completed are immediately canceled and rejected with an `Error`. Returns a promise that resolves once all workers have been terminated.

### `.exec(taskName, ...arguments)`  
Executes the given task. All arguments after the first are passed on to the worker. Returns a promise which either resolves to the result of the executed task, or rejects with an `Error`.

`.exec()` will throw an `Error` if any of the following occur:
* the worker pool has been destroyed.
* the worker pool was destroyed before the task could complete.
* the max job queue size has been reached.
* a task with the provided name doesn't exist.

In addition, if your task function throws an error during execution, the worker thread will pass that error back to the main thread, and then `exec()` will reject with that error.

### `.getStats()`  
Returns an `Object` which contains the following worker pool statistics:
```ts
{
  activeTasks: number,
  pendingTasks: number,
  idleWorkers: number,
  activeWorkers: number,
}
```

#### Properties

* **`activeTasks: number`**  
The number of tasks currently being processed.

* **`destroyed: boolean`**  
Indicates whether or not the worker pool has been destroyed.

* **`maxJobsPerWorker: number`**  
The maximum number of jobs a worker will take from the queue at once.

* **`maxQueueSize: number`**  
The maximum number of pending jobs the worker pool will accept.

* **`numActiveWorkers: number`**  
The number of currently active (busy) workers.

* **`numIdleWorkers: number`**  
The number of currently idle workers.

* **`numWorkers: number`**  
The total number of workers employed by the worker pool.

* **`pendingTasks: number`**  
The number of tasks currently waiting to be processed.
