// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/tests/setup-env.cjs'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'models/**/*.js',
    'controllers/**/*.js',
    'schemas/**/*.js',
    'middlewares/**/*.js',
    '!**/node_modules/**'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  verbose: true
};
