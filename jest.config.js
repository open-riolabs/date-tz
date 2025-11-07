/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/dist/**/*.spec.js'],
  transform: {},           // niente ts-jest: testiamo JS già compilato
  moduleFileExtensions: ['js', 'json']
};