module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src/tests'],
    moduleFileExtensions: ['ts', 'js'],
    testTimeout: 20000,
    moduleNameMapper: {
        '^vscode$': '<rootDir>/src/tests/mocks/vscode.ts'
      }
  };