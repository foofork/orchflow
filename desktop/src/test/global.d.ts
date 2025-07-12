/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />
/// <reference types="svelte" />

declare global {
  // Ensure vitest globals are available
  const vi: typeof import('vitest').vi;
  const expect: typeof import('vitest').expect;
  const describe: typeof import('vitest').describe;
  const it: typeof import('vitest').it;
  const test: typeof import('vitest').test;
  const beforeEach: typeof import('vitest').beforeEach;
  const afterEach: typeof import('vitest').afterEach;
  const beforeAll: typeof import('vitest').beforeAll;
  const afterAll: typeof import('vitest').afterAll;

  // Testing library matchers
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toBeVisible(): R;
      toBeDisabled(): R;
      toHaveClass(className: string): R;
      toHaveTextContent(text: string | RegExp): R;
      toHaveAttribute(attr: string, value?: string): R;
    }
  }

  // Svelte component types
  interface SvelteComponent {
    $set(props: any): void;
    $on(event: string, handler: Function): () => void;
    $destroy(): void;
  }

  // Mock types
  type MockedFunction<T extends (...args: any[]) => any> = import('vitest').MockedFunction<T>;
  type Mock<T = any> = import('vitest').Mock<T>;

  // Custom test utilities
  interface Window {
    __TAURI__?: any;
    __TEST_MODE__?: boolean;
  }
}

// Ensure this is treated as a module
export {};

// Additional type exports for test files
export type { MockedFunction, Mock } from 'vitest';
export type { RenderResult } from '@testing-library/svelte';
export type { ComponentProps, SvelteComponent } from 'svelte';