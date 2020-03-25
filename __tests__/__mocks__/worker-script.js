"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const worker_threads_1 = require("worker_threads");
const tasks = {};
function createTask(name, task) {
    tasks[name] = task;
}
exports.createTask = createTask;
;
// Code coverage doesn't work for the following code because it doesn't run in the main thread, so we ignore it.
/* istanbul ignore if */
if (!worker_threads_1.isMainThread) {
    const idle = worker_threads_1.workerData;
    idle.set([1]);
    worker_threads_1.parentPort.on('message', async (jobs) => {
        idle.set([0]);
        for (let i = 0; i < jobs.length; i++) {
            const { num, name, args } = jobs[i];
            const runTask = tasks[name];
            const result = await runTask(...args);
            jobs[i] = { num, result };
        }
        worker_threads_1.parentPort.postMessage(jobs);
        idle.set([1]);
    });
}
