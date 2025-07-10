import { render, fireEvent, screen, waitFor, type RenderResult } from '@testing-library/svelte';
import type { ComponentType, SvelteComponent } from 'svelte';
import { writable, type Writable } from 'svelte/store';
import { vi } from 'vitest';

/**
 * Enhanced render function with common test utilities
 */
export function renderWithContext<T extends SvelteComponent>(
  Component: ComponentType<T>,
  props?: any,
  options?: {
    target?: HTMLElement;
    context?: Map<any, any>;
    stores?: Record<string, Writable<any>>;
  }
): RenderResult<T> & { component: T } {
  const target = options?.target || document.body;
  
  // Set up any required context
  const context = options?.context || new Map();
  
  // Set up any required stores
  if (options?.stores) {
    Object.entries(options.stores).forEach(([key, store]) => {
      context.set(key, store);
    });
  }

  const result = render(Component, {
    ...props,
    target,
    context
  });

  return {
    ...result,
    component: result.component as T
  };
}

/**
 * Wait for element to appear in DOM
 */
export async function waitForElement(
  selector: string,
  container: HTMLElement = document.body,
  timeout = 1000
): Promise<Element> {
  return waitFor(
    () => {
      const element = container.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found: ${selector}`);
      }
      return element;
    },
    { timeout }
  );
}

/**
 * Simulate keyboard events with proper key codes
 */
export function simulateKeyboard(
  element: Element,
  key: string,
  options: {
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  } = {}
) {
  const keyboardEventInit: KeyboardEventInit = {
    key,
    code: getKeyCode(key),
    bubbles: true,
    cancelable: true,
    ...options
  };

  fireEvent.keyDown(element, keyboardEventInit);
  fireEvent.keyPress(element, keyboardEventInit);
  fireEvent.keyUp(element, keyboardEventInit);
}

/**
 * Get key code from key string
 */
function getKeyCode(key: string): string {
  const keyCodes: Record<string, string> = {
    'Enter': 'Enter',
    'Escape': 'Escape',
    'Tab': 'Tab',
    'ArrowUp': 'ArrowUp',
    'ArrowDown': 'ArrowDown',
    'ArrowLeft': 'ArrowLeft',
    'ArrowRight': 'ArrowRight',
    ' ': 'Space',
    'a': 'KeyA',
    'b': 'KeyB',
    'c': 'KeyC',
    // Add more as needed
  };
  
  return keyCodes[key] || `Key${key.toUpperCase()}`;
}

/**
 * Simulate mouse events with coordinates
 */
export function simulateMouse(
  element: Element,
  event: 'click' | 'dblclick' | 'mousedown' | 'mouseup' | 'mousemove',
  options: {
    clientX?: number;
    clientY?: number;
    button?: number;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
    metaKey?: boolean;
  } = {}
) {
  const rect = element.getBoundingClientRect();
  const mouseEventInit: MouseEventInit = {
    clientX: options.clientX ?? rect.left + rect.width / 2,
    clientY: options.clientY ?? rect.top + rect.height / 2,
    button: options.button ?? 0,
    bubbles: true,
    cancelable: true,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    shiftKey: options.shiftKey ?? false,
    metaKey: options.metaKey ?? false,
  };

  fireEvent[event](element, mouseEventInit);
}

/**
 * Simulate drag and drop operations
 */
export async function simulateDragAndDrop(
  source: Element,
  target: Element,
  dataTransfer?: Partial<DataTransfer>
) {
  const defaultDataTransfer = {
    dropEffect: 'none',
    effectAllowed: 'all',
    files: [] as File[],
    items: [] as DataTransferItem[],
    types: [] as string[],
    setData: vi.fn(),
    getData: vi.fn(),
    clearData: vi.fn(),
    setDragImage: vi.fn(),
  };

  const dt = { ...defaultDataTransfer, ...dataTransfer };

  // Start drag
  fireEvent.dragStart(source, { dataTransfer: dt });
  
  // Enter target
  fireEvent.dragEnter(target, { dataTransfer: dt });
  
  // Over target
  fireEvent.dragOver(target, { dataTransfer: dt });
  
  // Drop
  fireEvent.drop(target, { dataTransfer: dt });
  
  // End drag
  fireEvent.dragEnd(source, { dataTransfer: dt });
  
  // Wait for any async updates
  await waitFor(() => {}, { timeout: 100 });
}

/**
 * Create a mock ResizeObserver for testing resize behavior
 */
export function createMockResizeObserver() {
  const callbacks = new Map<Element, ResizeObserverCallback>();
  
  const MockResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => ({
    observe: vi.fn((target: Element) => {
      callbacks.set(target, callback);
    }),
    unobserve: vi.fn((target: Element) => {
      callbacks.delete(target);
    }),
    disconnect: vi.fn(() => {
      callbacks.clear();
    }),
  }));

  // Helper to trigger resize
  const triggerResize = (element: Element, contentRect: Partial<DOMRectReadOnly>) => {
    const callback = callbacks.get(element);
    if (callback) {
      const entry: ResizeObserverEntry = {
        target: element,
        contentRect: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          top: 0,
          right: 100,
          bottom: 100,
          left: 0,
          toJSON: () => ({}),
          ...contentRect,
        },
        borderBoxSize: [],
        contentBoxSize: [],
        devicePixelContentBoxSize: [],
      };
      callback([entry], MockResizeObserver as any);
    }
  };

  return { MockResizeObserver, triggerResize };
}

/**
 * Create a mock IntersectionObserver for testing visibility
 */
export function createMockIntersectionObserver() {
  const callbacks = new Map<Element, IntersectionObserverCallback>();
  
  const MockIntersectionObserver = vi.fn().mockImplementation((callback: IntersectionObserverCallback) => ({
    observe: vi.fn((target: Element) => {
      callbacks.set(target, callback);
    }),
    unobserve: vi.fn((target: Element) => {
      callbacks.delete(target);
    }),
    disconnect: vi.fn(() => {
      callbacks.clear();
    }),
  }));

  // Helper to trigger intersection
  const triggerIntersection = (element: Element, isIntersecting: boolean) => {
    const callback = callbacks.get(element);
    if (callback) {
      const entry: IntersectionObserverEntry = {
        target: element,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: element.getBoundingClientRect(),
        boundingClientRect: element.getBoundingClientRect(),
        rootBounds: null,
        time: Date.now(),
      };
      callback([entry], MockIntersectionObserver as any);
    }
  };

  return { MockIntersectionObserver, triggerIntersection };
}

/**
 * Helper to test async component updates
 */
export async function waitForComponentUpdate(
  testFn: () => void | Promise<void>,
  options?: { timeout?: number }
): Promise<void> {
  await waitFor(testFn, { timeout: options?.timeout ?? 1000 });
}

/**
 * Helper to test component cleanup
 */
export function testComponentCleanup(cleanup: () => void) {
  const originalError = console.error;
  const errors: any[] = [];
  
  // Capture any errors during cleanup
  console.error = (...args: any[]) => {
    errors.push(args);
  };
  
  try {
    cleanup();
  } finally {
    console.error = originalError;
  }
  
  // Check for common cleanup issues
  if (errors.length > 0) {
    throw new Error(`Cleanup errors detected: ${errors.map(e => e.join(' ')).join('; ')}`);
  }
}

/**
 * Create a test harness for components that need specific setup
 */
export function createTestHarness<T extends Record<string, any>>(
  setup: () => T | Promise<T>
): {
  beforeEach: (fn?: (context: T) => void | Promise<void>) => void;
  afterEach: (fn?: (context: T) => void | Promise<void>) => void;
  test: (name: string, fn: (context: T) => void | Promise<void>) => void;
} {
  let context: T;
  let beforeEachFn: ((context: T) => void | Promise<void>) | undefined;
  let afterEachFn: ((context: T) => void | Promise<void>) | undefined;

  return {
    beforeEach: (fn) => {
      beforeEachFn = fn;
    },
    afterEach: (fn) => {
      afterEachFn = fn;
    },
    test: (name, fn) => {
      test(name, async () => {
        context = await setup();
        if (beforeEachFn) await beforeEachFn(context);
        try {
          await fn(context);
        } finally {
          if (afterEachFn) await afterEachFn(context);
        }
      });
    },
  };
}