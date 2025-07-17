/**
 * Integration test setup
 * Configures the test environment for integration tests
 */

import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Extend Jest matchers
import 'jest-extended';

// Global test timeout
jest.setTimeout(60000);

// Mock console methods in CI to reduce noise
if (process.env.CI) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error // Keep errors for debugging
  };
}

// Create test directories
const testDirs = [
  'coverage/integration',
  'logs/integration',
  'temp/integration'
];

testDirs.forEach(dir => {
  const fullPath = join(process.cwd(), dir);
  if (!existsSync(fullPath)) {
    mkdirSync(fullPath, { recursive: true });
  }
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.ORCHFLOW_TEST_MODE = 'integration';
process.env.ORCHFLOW_LOG_LEVEL = 'error';
process.env.ORCHFLOW_DISABLE_ANALYTICS = 'true';

// Global test utilities
global.testConfig = {
  timeout: 60000,
  maxRetries: 3,
  tempDir: join(process.cwd(), 'temp/integration'),
  logDir: join(process.cwd(), 'logs/integration')
};

// Mock external dependencies that might not be available in test environment
jest.mock('tmux', () => ({
  createSession: jest.fn(),
  listSessions: jest.fn(),
  killSession: jest.fn()
}), { virtual: true });

jest.mock('inquirer', () => ({
  prompt: jest.fn().mockResolvedValue({ confirmed: true })
}), { virtual: true });

// Error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Setup global error handler
beforeEach(() => {
  // Clear any existing timers
  jest.clearAllTimers();
  
  // Reset modules
  jest.resetModules();
});

afterEach(() => {
  // Clean up any hanging promises
  jest.clearAllTimers();
  
  // Clear all mocks
  jest.clearAllMocks();
});

// Global teardown
afterAll(() => {
  // Clean up test environment
  jest.restoreAllMocks();
});