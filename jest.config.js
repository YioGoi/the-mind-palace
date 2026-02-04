module.exports = {

  testEnvironment: 'node',
  transform: {
    '^.+\\.(js|ts|tsx)$': 'babel-jest'
  },
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^react-native/jest/setup.js$': '<rootDir>/jest.setup.js',
    '^@/(.*)$': '<rootDir>/$1',
  },

  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?@?react-native|@react-navigation|expo|expo-crypto|@unimodules|base64-js)'
  ],
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  }
}
