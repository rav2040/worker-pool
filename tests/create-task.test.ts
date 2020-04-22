import { createTask } from '../src';

const TASK_NAME = 'foo';

describe(`Creating a task named '${TASK_NAME}'`, () => {
  test('does not throw an error', () => {
    expect(() => createTask(TASK_NAME, () => {})).not.toThrow();
  });
});

describe(`Creating a second task named '${TASK_NAME}'`, () => {
  test('throws an error', () => {
    const expectedMessage = `A task with the name '${TASK_NAME}' already exists.`;
    expect(() => createTask(TASK_NAME, () => {})).toThrow(expectedMessage);
  });
});

describe('Creating a task with incorrect argument types', () => {
  test('throws an error', () => {
    //@ts-ignore
    expect(() => createTask(42, () => {})).toThrow('The first argument must be a string.');
    //@ts-ignore
    expect(() => createTask(TASK_NAME, 42)).toThrow('The second argument must be a function.');
  });
});
