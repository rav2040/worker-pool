import { createTask } from '../src';

describe('Creating a task with the name \'add\'', () => {
  const TASK_NAME = 'add';

  function add(a: number, b: number) {
    return a + b;
  }

  test('does not throw an error', () => {
    expect(() => createTask(TASK_NAME, add)).not.toThrowError();
  });

  test('a second time throws an error', () => {
    expect(() => createTask(TASK_NAME, add)).toThrow(`A task with the name '${TASK_NAME}' already exists.`);
  });
});
