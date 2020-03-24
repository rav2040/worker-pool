module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: [
    '/node_modules/',
    '__tests__/example'
  ],
  preset: 'ts-jest/presets/js-with-ts',
  globals: {
    'ts-jest': {
      tsConfig: {
        allowJs: true,
      }
    }
  }
};
