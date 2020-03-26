const { createTask } = require('./worker-script');

createTask('add', (a, b) => a + b);
createTask('add_async', async (a, b) => a + b);

createTask('sleep5', () => {
  return new Promise((resolve) => setTimeout(resolve, 5000));
});

createTask('throw_error', () => {
  throw Error('This is a test error.');
});
