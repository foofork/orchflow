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
    __TAURI_IPC__?: MockedFunction<(...args: any[]) => any>;
    __TAURI_METADATA__?: {
      __windows: any[];
      __currentWindow: { label: string };
    };
  }

  // Mock component types for tests
  interface MockSvelteComponent {
    $set: Mock<[props: any], void>;
    $on: Mock<[event: string, handler: Function], () => void>;
    $destroy: Mock<[], void>;
    $$: {
      fragment: {
        c: Mock<[], void>;
        m: Mock<[target: HTMLElement, anchor?: Node], void>;
        p: Mock<[ctx: any[], dirty: number[]], void>;
        d: Mock<[detaching: boolean], void>;
      };
      ctx: any[];
      props: Record<string, any>;
      update: Mock<[], void>;
      not_equal: (a: any, b: any) => boolean;
      bound: Record<string, any>;
      on_mount: Function[];
      on_destroy: Function[];
      on_disconnect: Function[];
      before_update: Function[];
      after_update: Function[];
      context: Map<any, any>;
      callbacks: Record<string, Function[]>;
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
    [key: string]: any;
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