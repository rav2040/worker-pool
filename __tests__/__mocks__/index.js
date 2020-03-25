const { createTask } = require('./worker-script');

createTask('add', (a, b) => a + b);
createTask('addAsync', async (a, b) => a + b);
createTask('sleep5', () => new Promise((resolve) => setTimeout(resolve, 5000)));
