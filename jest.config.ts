import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      }
    }]
  },
  moduleNameMapper: {
    '@domain/(.*)': '<rootDir>/src/domain/$1',
    '@application/(.*)': '<rootDir>/src/application/$1',
    '@infrastructure/(.*)': '<rootDir>/src/infrastructure/$1',
    '@shared/(.*)': '<rootDir>/src/shared/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
    '!src/infrastructure/database/migrations/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'json-summary'],
  reporters: ['default', ['jest-sonar', { outputDirectory: 'coverage', outputName: 'test-report.xml' }]],
  verbose: true,
};

export default config;
