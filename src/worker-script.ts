import type { MessagePort } from 'worker_threads';
import { isMainThread, parentPort } from 'worker_threads';

type TaskCallback = (...args: any[]) => any;

const tasks: Map<string, TaskCallback> = new Map();

/**
 * Adds the provided callback function to the tasks Map, indexed by the provided name. Throws an error if a task with
 * the provided name already exists.
 */

export function createTask(name: string, callback: TaskCallback): void {
  if (tasks.has(name)) {
    throw Error(`A task with the name '${name}' already exists.`);
  }

  tasks.set(name, callback);
};

// Code coverage doesn't work for the following code because it doesn't run in the main thread, so it is ignored.

/* istanbul ignore if */
if (!isMainThread) {
  // This is a worker thread.
  const port = parentPort as MessagePort;

  port.on('message', async (jobs) => {
    // Iterate through the list of jobs and execute their corresponding callbacks, passing any given arguments.
    for (let i = 0; i < jobs.length; i++) {
      const { num, name, args } = jobs[i];
      const callback = tasks.get(name);

      try {
        if (callback === undefined) {
          throw Error(`A task with the name '${name}' was not found.`);
        }

        const result = await callback(...args);
        jobs[i] = { num, result };
      }

      catch (err) {
        jobs[i] = { num, err };
      }
    }

    // Send the completed jobs back to the main thread.
    port.postMessage(jobs);
  });
}
