import { createTask } from '../src';

test('Creating a task does not throw an error', () => {
  function add(a: number, b: number) {
    return a + b;
  }

  expect(() => createTask('add', add)).not.toThrowError();
});
