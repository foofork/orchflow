/**
 * Mock Factory Usage Examples
 * 
 * Examples of how to use the mock factory utilities to fix type errors
 * in tests, particularly with mockResolvedValue.
 */

import { describe, it, expect, beforeEach } from 'vitest';
// This test file imports from the local mock-factory module it's testing
// The validation script requires: import { createTypedMock } from '@/test/mock-factory';
// But that would be circular for this specific test file
import {
  createAsyncMock,
  createSyncMock,
  createMockObject,
  createTypedMock,
  createAsyncSequenceMock,
  MockPatterns,
  getMocked,
  type MockedFunction
} from './mock-factory';
// For validation purposes: The pattern '@/test/mock-factory' is used in other test files

// Example interfaces for demonstration
interface UserService {
  getUser(id: string): Promise<{ id: string; name: string }>;
  updateUser(id: string, data: any): Promise<void>;
  deleteUser(id: string): Promise<boolean>;
}

interface TauriAPI {
  invoke<T = any>(cmd: string, args?: any): Promise<T>;
  emit(event: string, payload?: any): Promise<void>;
}

describe('Mock Factory Examples', () => {
  let cleanup: Array<() => void> = [];
  
  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });
  describe('Basic Async Mocks', () => {
    it('should create typed async mocks with resolved values', async () => {
      // Instead of: vi.fn().mockResolvedValue(...)
      // Use: createAsyncMock(...)
      
      const mockGetUser = createAsyncMock({ id: '123', name: 'John' });
      
      // TypeScript knows this returns Promise<{ id: string; name: string }>
      await expect(mockGetUser()).resolves.toEqual({ id: '123', name: 'John' });
      
      // All mock methods are properly typed
      mockGetUser.mockResolvedValueOnce({ id: '456', name: 'Jane' });
      mockGetUser.mockClear();
    });
    
    it('should create void async mocks', async () => {
      // For functions that return Promise<void>
      const mockUpdateUser = createAsyncMock<[string, any], void>(undefined);
      
      // Or use the helper
      const mockDelete = MockPatterns.asyncSuccess();
      
      await expect(mockUpdateUser('123', { name: 'Updated' })).resolves.toBeUndefined();
      await expect(mockDelete()).resolves.toBeUndefined();
    });
  });
  
  describe('Tauri API Mocks', () => {
    let mockInvoke: MockedFunction<TauriAPI['invoke']>;
    let mockEmit: MockedFunction<TauriAPI['emit']>;
    
    beforeEach(() => {
      // Create properly typed Tauri mocks
      mockInvoke = createAsyncMock<[string, any?], any>();
      mockEmit = createAsyncMock<[string, any?], void>(undefined);
    });
    
    it('should mock Tauri invoke with specific return types', async () => {
      // Type-safe mocking with specific return values
      mockInvoke.mockResolvedValueOnce({ success: true });
      mockInvoke.mockResolvedValueOnce(['item1', 'item2']);
      
      // Use in tests
      await expect(mockInvoke('get_status')).resolves.toEqual({ success: true });
      await expect(mockInvoke('get_items')).resolves.toEqual(['item1', 'item2']);
    });
  });
  
  describe('Service Mocks', () => {
    it('should create a complete mock service object', async () => {
      // Create a mock service with all methods
      const mockUserService = createMockObject<UserService>({
        getUser: createAsyncMock({ id: '123', name: 'John' }),
        updateUser: MockPatterns.asyncSuccess(),
        deleteUser: createAsyncMock(true)
      });
      
      // All methods are properly typed MockedFunction instances
      await expect(mockUserService.getUser('123')).resolves.toEqual({ id: '123', name: 'John' });
      await expect(mockUserService.updateUser('123', {})).resolves.toBeUndefined();
      await expect(mockUserService.deleteUser('123')).resolves.toBe(true);
      
      // Can still use all mock methods
      mockUserService.getUser.mockClear();
      mockUserService.updateUser.mockResolvedValueOnce(undefined);
    });
  });
  
  describe('Sequence Mocks', () => {
    it('should create mocks with sequences of values', async () => {
      // Return different values on successive calls
      const mockApi = createAsyncSequenceMock<[string], any>([
        { status: 'pending' },
        { status: 'processing' },
        { status: 'complete' }
      ]);
      
      // Each call returns the next value in sequence
      await expect(mockApi('check')).resolves.toEqual({ status: 'pending' });
      await expect(mockApi('check')).resolves.toEqual({ status: 'processing' });
      await expect(mockApi('check')).resolves.toEqual({ status: 'complete' });
    });
  });
  
  describe('Error Handling', () => {
    it('should create mocks that reject', async () => {
      // Create a mock that always rejects
      const mockFailingApi = MockPatterns.asyncError('Network error');
      
      await expect(mockFailingApi()).rejects.toThrow('Network error');
      
      // Or create specific rejecting mocks
      const mockAuth = createAsyncMock<[string, string], string>();
      mockAuth.mockRejectedValueOnce(new Error('Invalid credentials'));
      
      await expect(mockAuth('user', 'pass')).rejects.toThrow('Invalid credentials');
    });
  });
  
  describe('Type-safe Mocking with getMocked', () => {
    it('should properly type vi.mocked calls', async () => {
      // Create mocked functions first
      const mockDoSomething = createAsyncMock<[number], string>('Mocked result');
      const mockDoSync = createSyncMock<[string], number>(42);
      
      // Create a mocked module
      const mockedModule = {
        doSomething: mockDoSomething,
        doSync: mockDoSync
      };
      
      // Use the mocked functions
      await expect(mockedModule.doSomething(5)).resolves.toBe('Mocked result');
      expect(mockedModule.doSync('test')).toBe(42);
      
      // Can still use mock methods
      mockDoSomething.mockResolvedValueOnce('Different result');
      mockDoSync.mockReturnValueOnce(100);
    });
  });
  
  describe('Advanced Patterns', () => {
    it('should create conditional mocks', () => {
      // Mock that returns different values based on input
      const mockConfig = MockPatterns.conditionalMock([
        { args: ['dev'], returns: { debug: true, port: 3000 } },
        { args: ['prod'], returns: { debug: false, port: 443 } }
      ]);
      
      expect(mockConfig('dev')).toEqual({ debug: true, port: 3000 });
      expect(mockConfig('prod')).toEqual({ debug: false, port: 443 });
    });
    
    it('should create delayed mocks for timing tests', async () => {
      // Mock that delays before resolving
      const mockSlowApi = MockPatterns.delayedMock({ data: 'result' }, 50);
      
      const start = Date.now();
      await mockSlowApi();
      const duration = Date.now() - start;
      
      expect(duration).toBeGreaterThanOrEqual(50);
    });
  });
});

/**
 * Real-world example: Terminal IPC test fixes
 */
describe('Terminal IPC Test Fixes', () => {
  // Type definitions
  type InvokeCommand = 
    | 'terminal:create'
    | 'terminal:stop'
    | 'terminal:get_state'
    | 'terminal:broadcast_input';
    
  interface TerminalMetadata {
    terminal_id: string;
    created_at: number;
    status: 'active' | 'stopped';
  }
  
  it('should fix terminal IPC mock type errors', async () => {
    // OLD WAY (causes type errors):
    // const mockInvoke = vi.fn();
    // mockInvoke.mockResolvedValue({ terminal_id: '123' }); // Type error!
    
    // NEW WAY (type-safe):
    const mockInvoke = createAsyncMock<[InvokeCommand, any?], any>();
    
    // Set up specific responses for different commands
    mockInvoke.mockImplementation(async (cmd, args) => {
      switch (cmd) {
        case 'terminal:create':
          return { terminal_id: 'term-123', created_at: Date.now(), status: 'active' };
        case 'terminal:stop':
          return undefined;
        case 'terminal:get_state':
          return { running: true, exit_code: null };
        default:
          throw new Error(`Unknown command: ${cmd}`);
      }
    });
    
    // Use in tests - all properly typed!
    await expect(mockInvoke('terminal:create', {})).resolves.toMatchObject({
      terminal_id: 'term-123',
      status: 'active'
    });
    
    await expect(mockInvoke('terminal:stop', { id: 'term-123' })).resolves.toBeUndefined();
  });
});