/**
 * Central Mock Registry for Test Infrastructure
 * 
 * Provides a unified interface for managing all mocks across the test suite.
 * Supports reset, snapshot, and decorator functionality.
 * Enhanced with advanced decorators and performance tracking.
 */

import { vi, type Mock, type MockInstance } from 'vitest';
import type { ComponentType } from 'svelte';

// Performance tracking for mocks
interface MockCallMetrics {
  count: number;
  totalTime: number;
  averageTime: number;
  maxTime: number;
  minTime: number;
  errors: number;
  lastCall: Date;
}

interface MockPerformanceData {
  [mockId: string]: MockCallMetrics;
}

type MockType = 'function' | 'module' | 'component' | 'store' | 'api';
type MockDecorator<T = any> = (target: T) => T;

interface MockMetadata {
  id: string;
  type: MockType;
  originalValue?: any;
  mock: Mock | MockInstance | ComponentType<any> | any;
  created: Date;
  tags: string[];
  decorators: MockDecorator[];
}

interface MockSnapshot {
  id: string;
  timestamp: Date;
  mocks: Map<string, MockMetadata>;
}

export class MockRegistry {
  private static instance: MockRegistry;
  private mocks: Map<string, MockMetadata> = new Map();
  private snapshots: Map<string, MockSnapshot> = new Map();
  private decorators: Map<string, MockDecorator[]> = new Map();
  private performanceData: MockPerformanceData = {};
  private globalSnapshots: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): MockRegistry {
    if (!MockRegistry.instance) {
      MockRegistry.instance = new MockRegistry();
    }
    return MockRegistry.instance;
  }

  /**
   * Register a mock with the registry
   */
  register<T = any>(
    id: string,
    type: MockType,
    mock: T,
    options?: {
      originalValue?: any;
      tags?: string[];
      decorators?: MockDecorator[];
    }
  ): T {
    const metadata: MockMetadata = {
      id,
      type,
      mock,
      originalValue: options?.originalValue,
      created: new Date(),
      tags: options?.tags || [],
      decorators: options?.decorators || [],
    };

    // Apply decorators
    let decoratedMock = mock;
    for (const decorator of metadata.decorators) {
      decoratedMock = decorator(decoratedMock);
    }

    metadata.mock = decoratedMock;
    this.mocks.set(id, metadata);

    return decoratedMock as T;
  }

  /**
   * Get a registered mock by ID
   */
  get<T = any>(id: string): T | undefined {
    return this.mocks.get(id)?.mock as T;
  }

  /**
   * Get all mocks by type
   */
  getByType<T = any>(type: MockType): T[] {
    return Array.from(this.mocks.values())
      .filter(m => m.type === type)
      .map(m => m.mock as T);
  }

  /**
   * Get all mocks by tag
   */
  getByTag<T = any>(tag: string): T[] {
    return Array.from(this.mocks.values())
      .filter(m => m.tags.includes(tag))
      .map(m => m.mock as T);
  }

  /**
   * Reset all mocks to their initial state
   */
  reset(): void {
    for (const metadata of this.mocks.values()) {
      if (metadata.type === 'function' && vi.isMockFunction(metadata.mock)) {
        (metadata.mock as Mock).mockReset();
      } else if (metadata.type === 'module') {
        // Reset module mocks
        vi.resetModules();
      } else if (metadata.type === 'store' && metadata.originalValue) {
        // Reset store to original value
        if (typeof metadata.mock.set === 'function') {
          metadata.mock.set(metadata.originalValue);
        }
      }
    }
  }

  /**
   * Clear all mock calls without resetting implementations
   */
  clearCalls(): void {
    for (const metadata of this.mocks.values()) {
      if (metadata.type === 'function' && vi.isMockFunction(metadata.mock)) {
        (metadata.mock as Mock).mockClear();
      }
    }
  }

  /**
   * Create a snapshot of current mock state
   */
  createSnapshot(id: string): void {
    const snapshot: MockSnapshot = {
      id,
      timestamp: new Date(),
      mocks: new Map(this.mocks),
    };
    this.snapshots.set(id, snapshot);
  }

  /**
   * Restore mock state from a snapshot
   */
  restoreSnapshot(id: string): boolean {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) {
      return false;
    }

    this.mocks = new Map(snapshot.mocks);
    return true;
  }

  /**
   * Delete a snapshot
   */
  deleteSnapshot(id: string): boolean {
    return this.snapshots.delete(id);
  }

  /**
   * List all snapshots
   */
  listSnapshots(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Unregister a mock
   */
  unregister(id: string): boolean {
    return this.mocks.delete(id);
  }

  /**
   * Clear all mocks and snapshots
   */
  clear(): void {
    this.reset();
    this.mocks.clear();
    this.snapshots.clear();
    this.decorators.clear();
  }

  /**
   * Add a global decorator for a mock type
   */
  addGlobalDecorator(type: MockType, decorator: MockDecorator): void {
    if (!this.decorators.has(type)) {
      this.decorators.set(type, []);
    }
    this.decorators.get(type)!.push(decorator);
  }

  /**
   * Apply global decorators to a mock
   */
  private applyGlobalDecorators<T>(type: MockType, mock: T): T {
    const decorators = this.decorators.get(type) || [];
    let decorated = mock;
    for (const decorator of decorators) {
      decorated = decorator(decorated);
    }
    return decorated;
  }

  /**
   * Track performance metrics for a mock
   */
  public trackPerformance(id: string, duration: number, error?: boolean): void {
    if (!this.performanceData[id]) {
      this.performanceData[id] = {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        maxTime: 0,
        minTime: Infinity,
        errors: 0,
        lastCall: new Date(),
      };
    }

    const metrics = this.performanceData[id];
    metrics.count++;
    metrics.totalTime += duration;
    metrics.averageTime = metrics.totalTime / metrics.count;
    metrics.maxTime = Math.max(metrics.maxTime, duration);
    metrics.minTime = Math.min(metrics.minTime, duration);
    metrics.lastCall = new Date();
    
    if (error) {
      metrics.errors++;
    }
  }

  /**
   * Get performance metrics for a mock
   */
  getPerformanceMetrics(id: string): MockCallMetrics | undefined {
    return this.performanceData[id];
  }

  /**
   * Get all performance metrics
   */
  getAllPerformanceMetrics(): MockPerformanceData {
    return { ...this.performanceData };
  }

  /**
   * Create a global snapshot including all registry state
   */
  createGlobalSnapshot(id: string): void {
    const globalState = {
      mocks: new Map(this.mocks),
      performanceData: { ...this.performanceData },
      timestamp: new Date(),
    };
    this.globalSnapshots.set(id, globalState);
  }

  /**
   * Restore from a global snapshot
   */
  restoreGlobalSnapshot(id: string): boolean {
    const snapshot = this.globalSnapshots.get(id);
    if (!snapshot) {
      return false;
    }

    this.mocks = new Map(snapshot.mocks);
    this.performanceData = { ...snapshot.performanceData };
    return true;
  }

  /**
   * Get detailed registry statistics with performance data
   */
  getStats(): {
    totalMocks: number;
    mocksByType: Record<MockType, number>;
    totalSnapshots: number;
    performanceMetrics: {
      totalCalls: number;
      averageCallTime: number;
      totalErrors: number;
      slowestMock: string | null;
      fastestMock: string | null;
    };
  } {
    const mocksByType: Record<MockType, number> = {
      function: 0,
      module: 0,
      component: 0,
      store: 0,
      api: 0,
    };

    for (const metadata of this.mocks.values()) {
      mocksByType[metadata.type]++;
    }

    // Calculate performance metrics
    let totalCalls = 0;
    let totalTime = 0;
    let totalErrors = 0;
    let slowestMock: string | null = null;
    let fastestMock: string | null = null;
    let slowestTime = 0;
    let fastestTime = Infinity;

    for (const [id, metrics] of Object.entries(this.performanceData)) {
      totalCalls += metrics.count;
      totalTime += metrics.totalTime;
      totalErrors += metrics.errors;
      
      if (metrics.averageTime > slowestTime) {
        slowestTime = metrics.averageTime;
        slowestMock = id;
      }
      
      if (metrics.averageTime < fastestTime && metrics.count > 0) {
        fastestTime = metrics.averageTime;
        fastestMock = id;
      }
    }

    return {
      totalMocks: this.mocks.size,
      mocksByType,
      totalSnapshots: this.snapshots.size,
      performanceMetrics: {
        totalCalls,
        averageCallTime: totalCalls > 0 ? totalTime / totalCalls : 0,
        totalErrors,
        slowestMock,
        fastestMock,
      },
    };
  }
}

/**
 * Enhanced Mock Decorators
 */
export const mockDecorators = {
  /**
   * Log all calls to a mock
   */
  withLogging<T extends Mock>(name: string): MockDecorator<T> {
    return (mock: T) => {
      const original = mock;
      return vi.fn((...args) => {
        console.log(`[MockRegistry] ${name} called with:`, args);
        return original(...args);
      }) as T;
    };
  },

  /**
   * Add timing information to mock calls with registry integration
   */
  withTiming<T extends Mock>(mockId?: string): MockDecorator<T> {
    return (mock: T) => {
      const timings: number[] = [];
      const timedMock = vi.fn((...args) => {
        const start = performance.now();
        let error = false;
        let result;
        
        try {
          result = mock(...args);
        } catch (err) {
          error = true;
          throw err;
        } finally {
          const end = performance.now();
          const duration = end - start;
          timings.push(duration);
          
          if (mockId) {
            mockRegistry.trackPerformance(mockId, duration, error);
          }
        }
        
        return result;
      }) as T & { getTimings: () => number[] };
      
      (timedMock as any).getTimings = () => timings;
      return timedMock;
    };
  },

  /**
   * Auto-reset mock after each test
   */
  withAutoReset<T extends Mock>(): MockDecorator<T> {
    return (mock: T) => {
      afterEach(() => {
        mock.mockReset();
      });
      return mock;
    };
  },

  /**
   * Limit the number of calls to a mock
   */
  withCallLimit<T extends Mock>(limit: number): MockDecorator<T> {
    return (mock: T) => {
      let callCount = 0;
      return vi.fn((...args) => {
        callCount++;
        if (callCount > limit) {
          throw new Error(`Mock called more than ${limit} times`);
        }
        return mock(...args);
      }) as T;
    };
  },

  /**
   * Add retry logic to a mock
   */
  withRetry<T extends Mock>(maxRetries: number = 3): MockDecorator<T> {
    return (mock: T) => {
      return vi.fn((...args) => {
        let attempts = 0;
        let lastError;
        
        while (attempts <= maxRetries) {
          try {
            return mock(...args);
          } catch (error) {
            lastError = error;
            attempts++;
            if (attempts > maxRetries) {
              throw lastError;
            }
            // Wait briefly before retry
            if (typeof setImmediate !== 'undefined') {
              setImmediate(() => {});
            }
          }
        }
      }) as T;
    };
  },

  /**
   * Add delay to mock calls
   */
  withDelay<T extends Mock>(delayMs: number): MockDecorator<T> {
    return (mock: T) => {
      return vi.fn(async (...args) => {
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return mock(...args);
      }) as T;
    };
  },

  /**
   * Add circuit breaker pattern
   */
  withCircuitBreaker<T extends Mock>(failureThreshold: number = 5, resetTimeoutMs: number = 60000): MockDecorator<T> {
    return (mock: T) => {
      let failures = 0;
      let lastFailure = 0;
      let state: 'closed' | 'open' | 'half-open' = 'closed';
      
      return vi.fn((...args) => {
        const now = Date.now();
        
        if (state === 'open') {
          if (now - lastFailure > resetTimeoutMs) {
            state = 'half-open';
          } else {
            throw new Error('Circuit breaker is OPEN');
          }
        }
        
        try {
          const result = mock(...args);
          if (state === 'half-open') {
            state = 'closed';
            failures = 0;
          }
          return result;
        } catch (error) {
          failures++;
          lastFailure = now;
          if (failures >= failureThreshold) {
            state = 'open';
          }
          throw error;
        }
      }) as T;
    };
  },

  /**
   * Add caching to mock calls
   */
  withCache<T extends Mock>(cacheSize: number = 100): MockDecorator<T> {
    return (mock: T) => {
      const cache = new Map<string, any>();
      
      return vi.fn((...args) => {
        const key = JSON.stringify(args);
        
        if (cache.has(key)) {
          return cache.get(key);
        }
        
        const result = mock(...args);
        
        if (cache.size >= cacheSize) {
          const firstKey = cache.keys().next().value as string;
          if (firstKey) {
            cache.delete(firstKey);
          }
        }
        
        cache.set(key, result);
        return result;
      }) as T;
    };
  },
};

/**
 * Convenience function to get the singleton instance
 */
export const mockRegistry = MockRegistry.getInstance();

/**
 * Test helper decorators
 */
export function withMockRegistry<T extends Function>(
  target: T,
  context?: ClassMethodDecoratorContext
): T {
  return function (this: any, ...args: any[]) {
    mockRegistry.createSnapshot('before-test');
    try {
      return target.apply(this, args);
    } finally {
      mockRegistry.restoreSnapshot('before-test');
      mockRegistry.deleteSnapshot('before-test');
    }
  } as any;
}

/**
 * Mock factory functions using the registry
 */
export const createMock = {
  function<T extends (...args: any[]) => any>(
    id: string,
    implementation?: T,
    options?: { tags?: string[]; decorators?: MockDecorator[] }
  ): Mock<T> {
    const mock = implementation ? vi.fn(implementation) : vi.fn();
    return mockRegistry.register(id, 'function', mock, options);
  },

  module<T>(
    id: string,
    moduleFactory: () => T,
    options?: { tags?: string[]; decorators?: MockDecorator[] }
  ): T {
    const mock = moduleFactory();
    return mockRegistry.register(id, 'module', mock, options);
  },

  component<T extends ComponentType<any>>(
    id: string,
    component: T,
    options?: { tags?: string[]; decorators?: MockDecorator[] }
  ): T {
    return mockRegistry.register(id, 'component', component, options);
  },

  store<T>(
    id: string,
    store: T,
    originalValue?: any,
    options?: { tags?: string[]; decorators?: MockDecorator[] }
  ): T {
    return mockRegistry.register(id, 'store', store, {
      ...options,
      originalValue,
    });
  },

  api<T extends Record<string, (...args: any[]) => any>>(
    id: string,
    methods: T,
    options?: { tags?: string[]; decorators?: MockDecorator[] }
  ): T {
    const mockedApi = {} as T;
    for (const [key, fn] of Object.entries(methods)) {
      mockedApi[key as keyof T] = vi.fn(fn) as any;
    }
    return mockRegistry.register(id, 'api', mockedApi, options);
  },
};