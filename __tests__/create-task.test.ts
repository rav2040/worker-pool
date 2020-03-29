import { createTask } from '../src';

const TASK_NAME = 'foo';

describe(`Creating a task named '${TASK_NAME}'`, () => {
  test(`does not throw an error`, () => {
    expect(() => createTask(TASK_NAME, () => {})).not.toThrow();
  });
});

describe(`Creating a second task named '${TASK_NAME}'`, () => {
  test(`throws an error`, () => {
    const expectedMessage = `A task with the name '${TASK_NAME}' already exists.`;
    expect(() => createTask(TASK_NAME, () => {})).toThrow(expectedMessage);
  });
});
