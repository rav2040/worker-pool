# Node Thread Pool

![Node.js CI](https://github.com/rav2040/node-thread-pool/workflows/Node.js%20CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/rav2040/node-thread-pool/badge.svg?branch=master)](https://coveralls.io/github/rav2040/node-thread-pool?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/rav2040/node-thread-pool/badge.svg?targetFile=package.json)](https://snyk.io/test/github/rav2040/node-thread-pool?targetFile=package.json)

Use a pool of Node.js `worker_threads` to perform computationally expensive operations.

A worker pool consists of an array of dedicated workers that perform user-defined tasks. By offloading CPU-intensive tasks to worker threads, they are prevented from [blocking the event loop](https://nodejs.org/en/docs/guides/dont-block-the-event-loop/).

**Tuft Worker Pool** implements a batched queue system. When a task is executed, it is added to a job queue. When a worker is ready to process jobs, it takes the pending jobs from the queue (up to a customizable limit) and processes them together. Once they have all completed, the results are sent back to the main thread. The advantage of this approach is that some of the overhead cost involved in passing data to the worker thread and back is reduced. However, it also means that some tasks may not necessarily be processed in the order they were submitted. If a particular task takes a long time to complete, all other tasks in the same batch will have to wait along with it. Therefore, **Tuft Worker Pool** allows you to customize the maximum number of tasks that can be batched together. If you have a combination of both long and short running tasks, it may be best to utilize a separate worker pool for each.

## Installation

```sh
npm install node-thread-pool
```

## Usage

First, create the script that will be loaded by the worker pool. Import the `createTask()` function and pass it a task name and a callback function. Here we're using the classic example of calculating the *nth* digit in the fibonacci sequence.

```js
// my-script.js

const { createTask } = require('@tuft/worker-pool');

function fib(n) {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2); 
}

createTask('fibonacci', fib);
```

Then, in your main application, import the `createWorkerPool()` function and call it to create a new instance of `WorkerPool`, passing the pathname of your script as the first argument. You will then be able to execute the task from your script by calling `pool.exec(taskName)`, with the remaining arguments being the ones your task function accepts. `pool.exec()` returns a promise that resolves to the result of your task.

```js
// my-app.js

const { createWorkerPool } = require('@tuft/worker-pool');

const pool = createWorkerPool(__dirname + '/my-script.js');

async function main() {
  const result = await pool.exec('fibonacci', 23);
  console.log(result); // 28657

  // Don't forget to destroy the worker pool once you've finished with it.
  await pool.destroy();
}

main();
```
 To prevent active handles from letting your application exit cleanly, make sure to call `pool.destroy()` once you're done.

## API

### **`createTask(name, callback)`**

Creates a task using the provided `callback`, indexed by `name`. This function should be called in a separate script file, which is then loaded by the the worker pool.

Throws an `Error` if a task with the provided name has already been created.


```js
const { createTask } = require('@tuft/worker-pool');

createTask('my task', (...args) => {
  let result;

  // Perform some expensive operations.

  return result;
});
```

### **`createWorkerPool(filename, options?)`**

Returns an instance of `WorkerPool`. Workers are implemented using Node's built-in `Worker` class. The `filename` passed as the first argument should be the absolute or relative path of a `.js` file which implements the `createTask()` function as outlined above.

If an `options` object is provided, it can contain any of the following optional properties:

* `numWorkers`  
The number of workers the worker pool will employ. Defaults to one less than the number of available CPU cores.  

* `maxQueueSize`  
The maximum number of pending jobs the worker pool will accept. Defaults to `Number.MAX_SAFE_INTEGER`.  

* `maxJobsPerWorker`  
The maximum number of jobs a worker will take from the queue at once. Defaults to `100`.  


```js
const { createWorkerPool } = require('@tuft/worker-pool');

async function main() {
  const pool = createWorkerPool('./my-script.js', {
    numWorkers: 2,
    maxQueueSize: 1000,
    maxJobsPerWorker: 20,
  });

  const result = await pool.exec('my task', ...args);

  // Do something with the result.

  await pool.destroy();
}

main();
```

Calling `createWorkerPool()` will return an instance of `WorkerPool`, but the `WorkerPool` class is not exported directly.

An instance of `WorkerPool` exposes the following properties and methods:

### Properties

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

### Methods

### `.destroy()`  
Terminates all workers and removes all jobs from the queue. Tasks not yet completed are immediately canceled and rejected with an `Error`. Returns a promise that resolves once all workers have been terminated and the `destroyed` property has been set to `true`.

### `.exec(taskName, ...arguments)`  
Executes the given task. All arguments after the first are passed to the worker. Returns a promise which either resolves to the result of the executed task, or rejects with an error.

An `Error` is thrown if any of the following occur:
* The worker pool has been destroyed.
* The worker pool was destroyed before the task could complete.
* The max job queue size has been reached.
* A task with the provided name doesn't exist.

In addition, if your task function throws an error during execution, the worker will catch it and pass it back to the main thread. `exec()` will then reject with that error.

### `.getStats()`  
Returns an `Object` which contains the following `WorkerPool` properties:

* `activeTasks`
* `pendingTasks`
* `idleWorkers`
* `activeWorkers`
