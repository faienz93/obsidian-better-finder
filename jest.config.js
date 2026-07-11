/** Test unitari sulla logica pura (strategy, parse): niente Electron/Obsidian reale */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  moduleNameMapper: {
    '^obsidian$': '<rootDir>/test/mocks/obsidian.ts',
    '^src/(.*)$': '<rootDir>/src/$1',
    '\\.css$': '<rootDir>/test/mocks/style.ts',
  },
};
