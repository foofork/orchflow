/// <reference types="vitest" />

import type { Mock } from 'vitest';

declare module 'vitest' {
  interface MockInstance<TArgs extends any[] = any[], TReturns = any> {
    mockResolvedValue(value: TReturns): this;
    mockResolvedValueOnce(value: TReturns): this;
    mockRejectedValue(value: any): this;
    mockRejectedValueOnce(value: any): this;
    mockReturnValue(value: TReturns): this;
    mockReturnValueOnce(value: TReturns): this;
    mockImplementation(fn: (...args: TArgs) => TReturns): this;
    mockImplementationOnce(fn: (...args: TArgs) => TReturns): this;
    mockClear(): this;
    mockReset(): this;
    mockRestore(): this;
    getMockName(): string;
    mockName(name: string): this;
    mock: {
      calls: TArgs[];
      results: { type: 'return' | 'throw'; value: TReturns }[];
      instances: any[];
      contexts: any[];
      lastCall?: TArgs;
    };
  }

  interface MockedFunction<T extends (...args: any[]) => any> extends MockInstance<Parameters<T>, ReturnType<T>> {
    (...args: Parameters<T>): ReturnType<T>;
  }

  function fn<T extends (...args: any[]) => any = (...args: any[]) => any>(
    implementation?: T
  ): MockedFunction<T>;
}

// Extend Svelte store types for mocking
declare module 'svelte/store' {
  import type { Writable, Readable } from 'svelte/store';
  
  interface MockedWritable<T> extends Writable<T> {
    mockValue: T;
    mockSubscribe: Mock;
    mockSet: Mock;
    mockUpdate: Mock;
  }

  interface MockedReadable<T> extends Readable<T> {
    mockValue: T;
    mockSubscribe: Mock;
  }
}

// Component mock type
export interface MockedComponent {
  $$prop_def: Record<string, any>;
  $$events_def: Record<string, any>;
  $$slot_def: Record<string, any>;
}