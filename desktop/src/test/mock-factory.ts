/**
 * Mock Factory Utilities
 * 
 * Type-safe utilities for creating mock functions with Vitest.
 * Provides proper TypeScript types for mockResolvedValue and other mock methods.
 */

import { vi, type MockedFunction, type Mock } from 'vitest';

/**
 * Create a properly typed mock function
 * @param implementation Optional implementation function
 * @returns A typed MockedFunction with all mock methods
 */
export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> {
  return vi.fn(implementation) as MockedFunction<T>;
}

/**
 * Create a mock for async functions with proper resolved value typing
 * @param resolvedValue The value to resolve with
 * @returns A typed MockedFunction that returns a Promise
 */
export function createAsyncMock<TArgs extends any[], TReturn>(
  resolvedValue?: TReturn
): MockedFunction<(...args: TArgs) => Promise<TReturn>> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => Promise<TReturn>>;
  if (resolvedValue !== undefined) {
    mock.mockResolvedValue(resolvedValue as any);
  } else {
    // Always return a Promise, even for void
    mock.mockResolvedValue(undefined as any);
  }
  return mock;
}

/**
 * Create a mock for sync functions with proper return value typing
 * @param returnValue The value to return
 * @returns A typed MockedFunction
 */
export function createSyncMock<TArgs extends any[], TReturn>(
  returnValue?: TReturn
): MockedFunction<(...args: TArgs) => TReturn> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => TReturn>;
  if (returnValue !== undefined) {
    mock.mockReturnValue(returnValue);
  }
  return mock;
}

/**
 * Create a mock that throws an error
 * @param error The error to throw
 * @returns A typed MockedFunction that throws
 */
export function createThrowingMock<TArgs extends any[]>(
  error: Error | string
): MockedFunction<(...args: TArgs) => never> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => never>;
  mock.mockImplementation(() => {
    throw typeof error === 'string' ? new Error(error) : error;
  });
  return mock;
}

/**
 * Create a mock that rejects with an error (for async functions)
 * @param error The error to reject with
 * @returns A typed MockedFunction that returns a rejected Promise
 */
export function createRejectingMock<TArgs extends any[]>(
  error: Error | string
): MockedFunction<(...args: TArgs) => Promise<never>> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => Promise<never>>;
  mock.mockRejectedValue(typeof error === 'string' ? new Error(error) : error);
  return mock;
}

/**
 * Create a mock with a sequence of return values
 * @param values Array of values to return in sequence
 * @returns A typed MockedFunction
 */
export function createSequenceMock<TArgs extends any[], TReturn>(
  values: TReturn[]
): MockedFunction<(...args: TArgs) => TReturn> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => TReturn>;
  values.forEach(value => mock.mockReturnValueOnce(value));
  return mock;
}

/**
 * Create a mock with a sequence of resolved values (for async functions)
 * @param values Array of values to resolve in sequence
 * @returns A typed MockedFunction that returns Promises
 */
export function createAsyncSequenceMock<TArgs extends any[], TReturn>(
  values: TReturn[]
): MockedFunction<(...args: TArgs) => Promise<TReturn>> {
  const mock = vi.fn() as MockedFunction<(...args: TArgs) => Promise<TReturn>>;
  values.forEach(value => mock.mockResolvedValueOnce(value as any));
  return mock;
}

/**
 * Create a mock that tracks calls but doesn't return anything
 * @returns A typed MockedFunction that returns void
 */
export function createVoidMock<TArgs extends any[]>(): MockedFunction<(...args: TArgs) => void> {
  return vi.fn() as MockedFunction<(...args: TArgs) => void>;
}

/**
 * Create a mock that tracks calls but doesn't return anything (async version)
 * @returns A typed MockedFunction that returns Promise<void>
 */
export function createAsyncVoidMock<TArgs extends any[]>(): MockedFunction<(...args: TArgs) => Promise<void>> {
  return createAsyncMock<TArgs, void>(undefined);
}

/**
 * Type helper for creating mocks with specific signatures
 */
export type MockOf<T> = T extends (...args: infer TArgs) => infer TReturn
  ? MockedFunction<(...args: TArgs) => TReturn>
  : never;

/**
 * Create a typed mock from a function type
 * @param _type Type parameter only (not used at runtime)
 * @param implementation Optional implementation
 * @returns A typed MockedFunction matching the type
 */
export function createTypedMock<T extends (...args: any[]) => any>(
  _type?: T,
  implementation?: T
): MockOf<T> {
  return vi.fn(implementation) as MockOf<T>;
}

/**
 * Create a partial mock object with typed methods
 * @param methods Object with method names and their mock implementations
 * @returns An object with mocked methods
 */
export function createMockObject<T extends Record<string, (...args: any[]) => any>>(
  methods: { [K in keyof T]: MockedFunction<T[K]> }
): { [K in keyof T]: MockedFunction<T[K]> } {
  return methods;
}

/**
 * Utility to type vi.mocked() calls
 * @param item The item to get mocked version of
 * @returns The mocked version with proper types
 */
export function getMocked<T>(item: T): T extends (...args: any[]) => any 
  ? MockedFunction<T>
  : T extends object
  ? { [K in keyof T]: T[K] extends (...args: any[]) => any ? MockedFunction<T[K]> : T[K] }
  : T {
  return vi.mocked(item) as any;
}

/**
 * Helper to create common mock patterns
 */
export const MockPatterns = {
  /**
   * Create a mock that always succeeds with undefined (common for void async functions)
   */
  asyncSuccess: () => createAsyncMock<any[], void>(undefined),
  
  /**
   * Create a mock that always fails with a generic error
   */
  asyncError: (message = 'Mock error') => createRejectingMock<any[]>(message),
  
  /**
   * Create a mock that returns different values based on input
   */
  conditionalMock: <TArgs extends any[], TReturn>(
    conditions: Array<{ args: TArgs; returns: TReturn }>
  ): MockedFunction<(...args: TArgs) => TReturn> => {
    const mock = vi.fn() as MockedFunction<(...args: TArgs) => TReturn>;
    mock.mockImplementation((...args) => {
      const condition = conditions.find(c => 
        JSON.stringify(c.args) === JSON.stringify(args)
      );
      if (condition) {
        return condition.returns;
      }
      throw new Error(`No mock condition matched for args: ${JSON.stringify(args)}`);
    });
    return mock;
  },
  
  /**
   * Create a mock that delays before resolving
   */
  delayedMock: <TReturn>(value: TReturn, delay = 100): MockedFunction<() => Promise<TReturn>> => {
    const mock = vi.fn() as MockedFunction<() => Promise<TReturn>>;
    mock.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve(value), delay))
    );
    return mock;
  }
};

/**
 * Create a properly typed DataTransfer mock for drag and drop tests
 * @param overrides Optional overrides for specific DataTransfer properties
 * @returns A properly typed DataTransfer mock
 */
export function createDataTransferMock(
  overrides: Partial<DataTransfer> = {}
): Partial<DataTransfer> {
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData: vi.fn() as MockedFunction<(format: string, data: string) => void>,
    getData: vi.fn().mockReturnValue('') as MockedFunction<(format: string) => string>,
    clearData: vi.fn() as MockedFunction<(format?: string) => void>,
    setDragImage: vi.fn() as MockedFunction<(image: Element, x: number, y: number) => void>,
    types: [],
    files: [] as any,
    items: [] as any,
    ...overrides
  };
}

/**
 * Create a properly typed mock for DOM events
 * @param eventType The type of event to mock
 * @param properties Additional event properties
 * @returns A properly typed event mock
 */
export function createEventMock<T extends Event>(
  eventType: string,
  properties: Partial<T> = {}
): Partial<T> {
  return {
    type: eventType,
    target: null,
    currentTarget: null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    stopImmediatePropagation: vi.fn(),
    ...properties
  } as Partial<T>;
}

/**
 * Export commonly used mock types
 */
export type {
  MockedFunction,
  Mock
} from 'vitest';