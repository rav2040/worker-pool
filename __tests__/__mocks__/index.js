const { createTask } = require('./worker-script');

createTask('add', (a, b) => a + b);
createTask('add_async', async (a, b) => a + b);

createTask('sleep10ms', () => {
  return new Promise((resolve) => setTimeout(resolve, 10));
});

createTask('throw_error', () => {
  throw Error('This is a test error.');
});
