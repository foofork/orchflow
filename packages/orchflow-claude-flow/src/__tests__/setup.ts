// Test setup
import { TextEncoder, TextDecoder } from 'util';
import { TEST_CONFIGURATION } from './test-config';
import './test-utils'; // Import custom matchers

// Polyfill for Node.js < 16
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock console.error for cleaner test output
const originalError = console.error;
const originalWarn = console.warn;
const originalLog = console.log;

beforeAll(() => {
  // Mock console methods for cleaner test output
  console.error = jest.fn();
  console.warn = jest.fn();
  
  // Only show logs in verbose mode
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
  }
});

afterAll(() => {
  // Restore original console methods
  console.error = originalError;
  console.warn = originalWarn;
  console.log = originalLog;
});

// Set timeout based on test configuration
jest.setTimeout(TEST_CONFIGURATION.ENVIRONMENT.TIMEOUT);

// Global test configuration
(global as any).TEST_CONFIG = TEST_CONFIGURATION;

// Mock fetch for unit tests
if (process.env.NODE_ENV === 'test' && !process.env.INTEGRATION_TESTS) {
  const mockFetch = jest.fn();
  (global as any).fetch = mockFetch;
}

// Performance monitoring
if (process.env.PERFORMANCE_TESTS) {
  const originalTest = global.test;
  global.test = (name: string, fn: any, timeout?: number) => {
    return originalTest(name, async () => {
      const startTime = performance.now();
      const result = await fn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log performance metrics
      if (process.env.VERBOSE_TESTS) {
        console.log(`Test "${name}" completed in ${duration.toFixed(2)}ms`);
      }
      
      return result;
    }, timeout);
  };
}

// Memory leak detection
if (process.env.MEMORY_TESTS) {
  let initialMemory: NodeJS.MemoryUsage;
  
  beforeEach(() => {
    if (global.gc) global.gc();
    initialMemory = process.memoryUsage();
  });
  
  afterEach(() => {
    if (global.gc) global.gc();
    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
    
    if (memoryIncrease > TEST_CONFIGURATION.MEMORY.MAX_MEMORY_INCREASE) {
      console.warn(`Memory increase detected: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    }
  });
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Cleanup function for test resources
(global as any).cleanupTestResources = () => {
  // Clear any intervals or timeouts
  if (typeof window !== 'undefined') {
    // Browser environment cleanup
    const highestTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < highestTimeoutId; i++) {
      clearTimeout(i);
    }
    
    const highestIntervalId = setInterval(() => {}, 0);
    for (let i = 0; i < highestIntervalId; i++) {
      clearInterval(i);
    }
  }
};

// Register cleanup on test completion
afterAll(() => {
  if ((global as any).cleanupTestResources) {
    (global as any).cleanupTestResources();
  }
});