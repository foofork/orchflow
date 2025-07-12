/**
 * Mock Factory Utilities Export
 * 
 * Re-exports all mock factory utilities from the main mock-factory module.
 * This allows consistent imports from the test/utils directory.
 */

export * from '../mock-factory';

// Re-export commonly used utilities for convenience
export { 
  createAsyncMock,
  createAsyncVoidMock,
  createSyncMock,
  createMockObject,
  createTypedMock,
  createSequenceMock,
  createAsyncSequenceMock,
  MockPatterns,
  getMocked
} from '../mock-factory';

// Re-export types
export type { MockedFunction, Mock, MockOf } from '../mock-factory';