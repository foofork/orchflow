import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockRegistry, mockRegistry, createMock, mockDecorators } from './mock-registry';

describe('MockRegistry', () => {
  beforeEach(() => {
    mockRegistry.clear();
  });

  afterEach(() => {
    mockRegistry.clear();
  });

  describe('Basic Operations', () => {
    it('should register and retrieve mocks', () => {
      const mockFn = vi.fn();
      mockRegistry.register('test-fn', 'function', mockFn);
      
      expect(mockRegistry.get('test-fn')).toBe(mockFn);
    });

    it('should get mocks by type', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      const module1 = { test: 'module' };
      
      mockRegistry.register('fn1', 'function', fn1);
      mockRegistry.register('fn2', 'function', fn2);
      mockRegistry.register('mod1', 'module', module1);
      
      const functions = mockRegistry.getByType('function');
      expect(functions).toHaveLength(2);
      expect(functions).toContain(fn1);
      expect(functions).toContain(fn2);
    });

    it('should get mocks by tag', () => {
      const fn1 = vi.fn();
      const fn2 = vi.fn();
      
      mockRegistry.register('fn1', 'function', fn1, { tags: ['api', 'auth'] });
      mockRegistry.register('fn2', 'function', fn2, { tags: ['api', 'user'] });
      
      const apiMocks = mockRegistry.getByTag('api');
      expect(apiMocks).toHaveLength(2);
      
      const authMocks = mockRegistry.getByTag('auth');
      expect(authMocks).toHaveLength(1);
      expect(authMocks[0]).toBe(fn1);
    });
  });

  describe('Reset and Clear', () => {
    it('should reset function mocks', () => {
      const mockFn = vi.fn();
      mockRegistry.register('test-fn', 'function', mockFn);
      
      mockFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
      
      mockRegistry.reset();
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should clear mock calls without resetting implementation', () => {
      const mockFn = vi.fn(() => 'result');
      mockRegistry.register('test-fn', 'function', mockFn);
      
      mockFn();
      expect(mockFn).toHaveBeenCalled();
      
      mockRegistry.clearCalls();
      expect(mockFn).not.toHaveBeenCalled();
      expect(mockFn()).toBe('result');
    });
  });

  describe('Snapshots', () => {
    it('should create and restore snapshots', () => {
      const mockFn = vi.fn();
      mockRegistry.register('test-fn', 'function', mockFn);
      
      mockRegistry.createSnapshot('before-changes');
      
      mockRegistry.unregister('test-fn');
      expect(mockRegistry.get('test-fn')).toBeUndefined();
      
      mockRegistry.restoreSnapshot('before-changes');
      expect(mockRegistry.get('test-fn')).toBe(mockFn);
    });

    it('should list snapshots', () => {
      mockRegistry.createSnapshot('snapshot1');
      mockRegistry.createSnapshot('snapshot2');
      
      const snapshots = mockRegistry.listSnapshots();
      expect(snapshots).toContain('snapshot1');
      expect(snapshots).toContain('snapshot2');
    });
  });

  describe('Decorators', () => {
    it('should apply decorators during registration', () => {
      const originalFn = vi.fn(() => 'result');
      const decorator = (fn: any) => {
        return vi.fn((...args) => {
          console.log('Decorated call');
          return fn(...args);
        });
      };
      
      const decorated = mockRegistry.register('test-fn', 'function', originalFn, {
        decorators: [decorator]
      });
      
      expect(decorated).not.toBe(originalFn);
      expect(decorated()).toBe('result');
    });

    it('should apply logging decorator', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const mockFn = vi.fn();
      
      const decorated = mockRegistry.register('test-fn', 'function', mockFn, {
        decorators: [mockDecorators.withLogging('TestFunction')]
      });
      
      decorated('arg1', 'arg2');
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[MockRegistry] TestFunction called with:',
        ['arg1', 'arg2']
      );
      
      consoleSpy.mockRestore();
    });

    it('should apply timing decorator', () => {
      const mockFn = vi.fn(() => {
        // Simulate some work
        for (let i = 0; i < 1000; i++) {}
      });
      
      const decorated = mockRegistry.register('test-fn', 'function', mockFn, {
        decorators: [mockDecorators.withTiming()]
      }) as any;
      
      decorated();
      decorated();
      
      const timings = decorated.getTimings();
      expect(timings).toHaveLength(2);
      expect(timings[0]).toBeGreaterThan(0);
    });

    it('should apply call limit decorator', () => {
      const mockFn = vi.fn();
      
      const decorated = mockRegistry.register('test-fn', 'function', mockFn, {
        decorators: [mockDecorators.withCallLimit(2)]
      });
      
      decorated();
      decorated();
      
      expect(() => decorated()).toThrow('Mock called more than 2 times');
    });
  });

  describe('Factory Functions', () => {
    it('should create function mocks', () => {
      const mock = createMock.function('test-fn', () => 'result', {
        tags: ['test']
      });
      
      expect(mock()).toBe('result');
      expect(mockRegistry.get('test-fn')).toBe(mock);
      expect(mockRegistry.getByTag('test')).toContain(mock);
    });

    it('should create module mocks', () => {
      const mock = createMock.module('test-module', () => ({
        method1: vi.fn(),
        method2: vi.fn()
      }));
      
      expect(mock.method1).toBeDefined();
      expect(mock.method2).toBeDefined();
      expect(mockRegistry.get('test-module')).toBe(mock);
    });

    it('should create API mocks', () => {
      const api = createMock.api('test-api', {
        getData: () => ({ id: 1, name: 'test' }),
        saveData: (data: any) => ({ success: true })
      });
      
      expect(vi.isMockFunction(api.getData)).toBe(true);
      expect(vi.isMockFunction(api.saveData)).toBe(true);
      expect(api.getData()).toEqual({ id: 1, name: 'test' });
    });
  });

  describe('Statistics', () => {
    it('should provide registry statistics', () => {
      createMock.function('fn1', () => {});
      createMock.function('fn2', () => {});
      createMock.module('mod1', () => ({}));
      createMock.api('api1', { test: () => {} });
      
      mockRegistry.createSnapshot('snap1');
      mockRegistry.createSnapshot('snap2');
      
      const stats = mockRegistry.getStats();
      
      expect(stats.totalMocks).toBe(4);
      expect(stats.mocksByType.function).toBe(2);
      expect(stats.mocksByType.module).toBe(1);
      expect(stats.mocksByType.api).toBe(1);
      expect(stats.totalSnapshots).toBe(2);
    });
  });
});