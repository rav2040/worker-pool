import { createTask } from '../src';

const TASK_NAME = 'foo';

test('Creating a task named \'foo\' does not throw an error', () => {
  expect(() => createTask(TASK_NAME, () => {})).not.toThrow();
});

test('Creating two tasks named \'foo\' throws an error on the second attempt', () => {
  const message = `A task with the name '${TASK_NAME}' already exists.`;
  expect(() => createTask(TASK_NAME, () => {})).toThrow(message);
});
