/**
 * This file is written in JavaScript because it needs to be required by the test script during
 * tests and passed to the new Worker() instance, which only accepts .js and .mjs files.
 */

const { isMainThread, parentPort } = require('worker_threads');

const listeners = {};

exports.createTask = function createTask(name, listener) {
  listeners[name] = listener;
};

// Code coverage doesn't work for the following code because it doesn't run in the main thread, so we ignore it.
/* istanbul ignore if */
if (!isMainThread) {
  parentPort.on('message', async (jobs) => {
    if (parentPort === null) {
      throw Error('parentPort is null');
    }

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      const callListener = listeners[job.name];
      job.value = await callListener(...job.value);
    }

    parentPort.postMessage(jobs);
  });
}
