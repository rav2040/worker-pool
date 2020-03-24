const { createTask } = require('../../src/worker-script');
createTask('add', (a, b) => a + b);
