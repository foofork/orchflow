// Test setup
import { TextEncoder, TextDecoder } from 'util';
import { TEST_CONFIGURATION } from './test-config';
import './test-utils'; // Import custom matchers

// Polyfill for Node.js < 16
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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

// Mock node-fetch for ES module compatibility
jest.mock('node-fetch', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => 
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
        text: () => Promise.resolve(''),
        headers: new Map()
      })
    )
  };
});

// Performance monitoring
if (process.env.PERFORMANCE_TESTS) {
  const originalTest = global.test;
  
  // Create a performance wrapper that matches Jest's It interface
  const performanceWrapper = (name: string, fn: jest.ProvidesCallback, timeout?: number) => {
    return originalTest(name, async () => {
      const startTime = performance.now();
      
      try {
        let result;
        if (fn.length > 0) {
          // Function expects a callback (done)
          result = await new Promise<void>((resolve, reject) => {
            const doneFn = Object.assign((error?: any) => {
              if (error) reject(error);
              else resolve();
            }, {
              fail: (error?: string | { message: string }) => {
                reject(error);
              }
            });
            fn(doneFn);
          });
        } else {
          // Function is async or returns a promise
          result = await (fn as () => Promise<any>)();
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;

        // Log performance metrics
        if (process.env.VERBOSE_TESTS) {
          console.log(`Test "${name}" completed in ${duration.toFixed(2)}ms`);
        }

        return result;
      } catch (error) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        if (process.env.VERBOSE_TESTS) {
          console.log(`Test "${name}" failed after ${duration.toFixed(2)}ms`);
        }
        
        throw error;
      }
    }, timeout);
  };
  
  // Apply the wrapper to both test and it
  global.test = performanceWrapper as any;
  global.it = performanceWrapper as any;
}

// Memory leak detection
if (process.env.MEMORY_TESTS) {
  let initialMemory: NodeJS.MemoryUsage;

  beforeEach(() => {
    if (global.gc) {global.gc();}
    initialMemory = process.memoryUsage();
  });

  afterEach(() => {
    if (global.gc) {global.gc();}
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
  const globalAny = global as any;
  if (typeof globalAny !== 'undefined' && typeof globalAny.window !== 'undefined') {
    // Browser environment cleanup (if running in jsdom)
    const highestTimeoutId = setTimeout(() => {}, 0);
    for (let i = 0; i < (highestTimeoutId as any); i++) {
      clearTimeout(i);
    }

    const highestIntervalId = setInterval(() => {}, 0);
    for (let i = 0; i < (highestIntervalId as any); i++) {
      clearInterval(i);
    }
  } else {
    // Node.js environment cleanup
    // In Node.js, we can't iterate through all possible timeout/interval IDs
    // Instead, we'll rely on Jest's automatic cleanup
    // But we can clear any specific timers we know about
    if (process.env.VERBOSE_TESTS) {
      console.log('Cleanup: Node.js environment detected, relying on Jest cleanup');
    }
  }
};

// Register cleanup on test completion
afterAll(() => {
  if ((global as any).cleanupTestResources) {
    (global as any).cleanupTestResources();
  }
});