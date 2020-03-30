# TuftJS: Worker Pool

![Node.js CI](https://github.com/tuftjs/worker-pool/workflows/Node.js%20CI/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/tuftjs/worker-pool/badge.svg?branch=master)](https://coveralls.io/github/tuftjs/worker-pool?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/tuftjs/worker-pool/badge.svg?targetFile=package.json)](https://snyk.io/test/github/rav2040/rollup-plugin-scrub?targetFile=package.json)

Use a pool of Node.js worker threads to perform computationally expensive operations.

A worker pool consists of an array of dedicated workers that perform user-defined tasks. Tasks submitted to the worker pool are added to a queue, and the workers take it in turns to take jobs from the queue. By default, jobs are batched together. Once a worker has finished processing all jobs in a particualar batch, the results are sent back to the main thread.  

## Installation

```bash
npm i @tuft/worker-pool
```

## Usage

```js
// my-script.js

const { createTask } = require('@tuft/workerpool');
const { randomBytes } = require('crypto');

createTask('generate random hex string', (size) => {
  return randomBytes(size).toString('hex');
});
```

```js
// index.js

const { WorkerPool } = require('@tuft/workerpool');

const pool = new WorkerPool(__dirname + '/my-script.js');

async function main() {
  const result = await pool.exec('generate random hex string', 256);
  console.log(result); // 3b0fb3156251699d1e0f32dca3ff306f43e...
}

main();
```

## API

### createTask(*name*, *callback*)

Adds the provided *callback* to an internal list of functions, indexed by *name*. This function should be called in a separate script file, which is then loaded by the the worker pool.

#### Parameters

>***name*** `string`  
>The name of the task, used to index the function.
>
>***callback*** `Function | AsyncFunction`  
>The function to be called each time the task is executed.

#### Return value

>`undefined`

#### Exceptions

* Throws a `TypeError` if the provided task name is not a `string`.
* Throws a `TypeError` if the provided callback is not a `Function`.
* Throws an `Error` if a task with the provided name has already been created.

```js
const { createTask } = require('@tuft/workerpool');

createTask('cube', (num) => {
  return num ** 3;
});
```

### new WorkerPool(*filename* [, *options*])

Creates a pool of workers which are capable of performing tasks created by `createTask()`. Workers are implemented using the Node.js `Worker` class. 

>For more information about how worker threads work in Node, see the [official documentation](https://nodejs.org/dist/latest-v12.x/docs/api/worker_threads.html).

`WorkerPool` loads a script, which each worker in the pool will execute when they are first loaded. The code in this script will only be executed in worker threads, never in the main thread.

#### Parameters

>***filename*** `string`  
>An absolute or relative path to a separate `.js` file.
>
>***options*** `Object` *(optional)*  
>An object containing any of the following properties:
> * ***numWorkers*** `number` *(optional)*  
>   The number of workers the worker pool will employ. Defaults to *'number of CPU cores' - 1*.
> * ***maxQueueSize*** `number` *(optional)*  
>   The maximum number of pending jobs the worker pool will accept. Defaults to `Number.MAX_SAFE_INTEGER`.
> * ***maxJobsPerWorker*** `number` *(optional)*  
>   The maximum number of jobs a worker will take from the queue at once. Defaults to `Number.MAX_SAFE_INTEGER`.

#### Properties

>**activeTasks** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The number of tasks currently being processed.
>
>**destroyed** `boolean`  
>&nbsp;&nbsp;&nbsp;&nbsp;Whether or not the worker pool has been destroyed.
>
>**maxJobsPerWorker** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The maximum number of jobs a worker will take from the queue at once.
>
>**maxQueueSize** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The maximum number of pending jobs the worker pool will accept.
>
>**numActiveWorkers** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The number of currently active (busy) workers.
>
>**numIdleWorkers** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The number of currently idle workers.
>
>**numWorkers** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The total number of workers employed by the worker pool.
>
>**pendingTasks** `number`  
>&nbsp;&nbsp;&nbsp;&nbsp;The number of tasks currently waiting to be processed.

#### Methods

### `destroy()`  
Destroys the worker pool by terminating all workers, preventing the worker pool from being used again. Tasks not yet completed are immediately canceled. Returns a `Promise` that resolves once all workers have been terminated.

### `exec(taskName, ...arguments)`  
Executes a task based on the provided task name. All arguments after the first are passed on to the worker. Returns a `Promise`, which either resolves to the result of the executed task, or rejects with an `Error`.

### `getStats()`  
Returns an `Object` which contains the following statistics:
```ts
{
  activeTasks: number,
  pendingTasks: number,
  idleWorkers: number,
  activeWorkers: number,
}
```
