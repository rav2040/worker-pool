import { isMainThread, parentPort, workerData } from 'worker_threads';

const tasks: { [key: string]: (...args: any[]) => any } = {};

export function createTask(name: string, task: (...args: any[]) => any) {
  tasks[name] = task;
};

// Code coverage doesn't work for the following code because it doesn't run in the main thread, so we ignore it.
/* istanbul ignore if */
if (!isMainThread) {
  const idle = workerData;
  idle.set([1]);

  parentPort!.on('message', async (jobs) => {
    idle.set([0]);

    for (let i = 0; i < jobs.length; i++) {
      const { num, name, args } = jobs[i];
      const runTask = tasks[name];
      const result = await runTask(...args);
      jobs[i] = { num, result };
    }

    parentPort!.postMessage(jobs);
    idle.set([1]);
  });
}
