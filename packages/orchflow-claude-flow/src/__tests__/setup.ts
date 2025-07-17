// Test setup
import { TextEncoder, TextDecoder } from 'util';

// Polyfill for Node.js < 16
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock console.error for cleaner test output
const originalError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalError;
});

// Increase timeout for integration tests
jest.setTimeout(30000);