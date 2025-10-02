/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.js"],
  setupFilesAfterEnv: ["<rootDir>/test/setupTests.js"],
  collectCoverageFrom: ["src/**/*.js", "!src/**/index.js"],
  verbose: true,
};
