import { isMainThread, parentPort, workerData as activeTasksDataView } from 'worker_threads';

const tasks: Map<string, (...args: any[]) => any> = new Map();

/** Adds a callback function to the task map. */
export function createTask(name: string, callback: (...args: any[]) => any): void {
  tasks.set(name, callback);
};

// Code coverage doesn't work for the following code because it doesn't run in the main thread, so we ignore it.
/* istanbul ignore if */
if (!isMainThread) {
  // The module has been imported by a worker.
  parentPort!.on('message', async (jobs) => {
    // Set the number of active tasks for this worker.
    activeTasksDataView.set([jobs.length]);

    // Iterate through the list of jobs and execute their corresponding callbacks, passing any given arguments.
    for (let i = 0; i < jobs.length; i++) {
      const { num, name, args } = jobs[i];
      const callback = tasks.get(name);

      try {
        if (callback === undefined) {
          throw Error(`Task with name '${name}' was not found.`);
        }

        const result = await callback(...args);
        jobs[i] = { num, result };
      }

      catch (err) {
        jobs[i] = { num, err };
      }
    }

    // Pass the task results back to the main thread.
    parentPort!.postMessage(jobs);

    // Reset the number of active tasks for this worker to zero.
    activeTasksDataView.set([0]);
  });
}
