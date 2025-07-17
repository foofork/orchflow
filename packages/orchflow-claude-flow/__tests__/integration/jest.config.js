/**
 * Jest configuration for integration tests
 * Optimized for testing refactored components
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test files
  testMatch: [
    '**/__tests__/integration/**/*.test.ts'
  ],
  
  // Module resolution
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform configuration
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  
  // Module name mapping for absolute imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/__tests__/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/__tests__/integration/setup.ts'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**',
    '!src/**/node_modules/**'
  ],
  
  coverageDirectory: 'coverage/integration',
  coverageReporters: ['text', 'lcov', 'html'],
  
  // Test environment setup
  testTimeout: 60000, // 60 seconds for integration tests
  
  // Verbose output
  verbose: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Global setup and teardown
  globalSetup: '<rootDir>/__tests__/integration/global-setup.ts',
  globalTeardown: '<rootDir>/__tests__/integration/global-teardown.ts',
  
  // Jest environment variables
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  },
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance
  maxWorkers: '50%',
  
  // Fail fast on first error (for CI)
  bail: process.env.CI ? 1 : 0,
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/integration',
      outputName: 'junit.xml'
    }]
  ],
  
  // Test result processor
  testResultsProcessor: '<rootDir>/__tests__/integration/test-results-processor.js'
};