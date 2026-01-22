module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.js'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'routes/**/*.js',
    'models/**/*.js',
    'utils/**/*.js',
    '!**/node_modules/**'
  ],
  testTimeout: 30000,
  verbose: true
};
