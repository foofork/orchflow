/// <reference types="vitest" />
/// <reference types="@testing-library/jest-dom" />

import type { MockedFunction, Mock } from 'vitest';

declare global {
  // Node.js globals for Vitest
  interface GlobalThis {
    testUtilsSetup?: boolean;
    window: Window & typeof globalThis;
    browser: boolean;
    self: typeof globalThis;
  }

  // Vitest global types
  const vi: typeof import('vitest').vi;

  // Additional Tauri types
  interface Window {
    __TAURI_IPC__?: MockedFunction<(...args: unknown[]) => unknown>;
    __TAURI_METADATA__?: {
      __windows: { label: string }[];
      __currentWindow: { label: string };
    };
  }

  // Mock component types for tests
  interface MockSvelteComponent {
    $set: Mock<[props: Record<string, unknown>], void>;
    $on: Mock<[event: string, handler: (...args: unknown[]) => void], () => void>;
    $destroy: Mock<[], void>;
    $$: {
      fragment: {
        c: Mock<[], void>;
        m: Mock<[target: HTMLElement, anchor?: Node], void>;
        p: Mock<[ctx: unknown[], dirty: number[]], void>;
        d: Mock<[detaching: boolean], void>;
      };
      ctx: unknown[];
      props: Record<string, unknown>;
      update: Mock<[], void>;
      not_equal: (a: unknown, b: unknown) => boolean;
      bound: Record<string, unknown>;
      on_mount: Array<(...args: unknown[]) => void>;
      on_destroy: Array<(...args: unknown[]) => void>;
      on_disconnect: Array<(...args: unknown[]) => void>;
      before_update: Array<(...args: unknown[]) => void>;
      after_update: Array<(...args: unknown[]) => void>;
      context: Map<string, unknown>;
      callbacks: Record<string, Array<(...args: unknown[]) => void>>;
      dirty: number[];
      skip_bound: boolean;
      root: HTMLElement;
    };
    element: HTMLElement;
  }

  // Terminal mock types
  interface MockTerminal {
    open: Mock<[container: HTMLElement], void>;
    write: Mock<[data: string], void>;
    onData: Mock<[callback: (data: string) => void], { dispose: Mock<[], void> }>;
    onResize: Mock<[callback: (event: { cols: number; rows: number }) => void], { dispose: Mock<[], void> }>;
    resize: Mock<[cols: number, rows: number], void>;
    dispose: Mock<[], void>;
    clear: Mock<[], void>;
    focus: Mock<[], void>;
    blur: Mock<[], void>;
    element: HTMLElement;
    cols: number;
    rows: number;
  }

  // Error types for catch blocks
  interface ErrorWithMessage {
    message: string;
  }

  // Canvas mock types
  interface MockCanvasRenderingContext2D extends Partial<CanvasRenderingContext2D> {
    [key: string]: unknown;
  }

  // ResizeObserver types
  interface ResizeObserverEntry {
    target: Element;
    contentRect: DOMRectReadOnly;
    borderBoxSize: readonly ResizeObserverSize[];
    contentBoxSize: readonly ResizeObserverSize[];
    devicePixelContentBoxSize: readonly ResizeObserverSize[];
  }

  interface ResizeObserverSize {
    inlineSize: number;
    blockSize: number;
  }

  type ResizeObserverCallback = (entries: ResizeObserverEntry[], observer: ResizeObserver) => void;

  interface ResizeObserver {
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
  }

  const ResizeObserver: {
    prototype: ResizeObserver;
    new(callback: ResizeObserverCallback): ResizeObserver;
  };
}

export {};