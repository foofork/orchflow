import { render, RenderResult } from '@testing-library/svelte';
import { vi } from 'vitest';
import type { ComponentType } from 'svelte';

export interface ComponentTestOptions {
  props?: Record<string, any>;
  mocks?: {
    terminal?: boolean;
    canvas?: boolean;
    tauri?: Record<string, any>;
  };
}

interface UtilsModule {
  mockInvoke: (mocks: Record<string, any>) => void;
}

interface CanvasModule {
  mockCanvasGetContext: () => void;
}

interface TerminalMocks {
  MockTerminal: any;
}

/**
 * Professional component test helper
 * Provides consistent setup for different types of components
 */
export function renderComponent<T extends ComponentType>(
  Component: T,
  options: ComponentTestOptions = {}
): RenderResult & { updateProps: (props: Partial<any>) => Promise<void> } {
  const { props = {}, mocks = {} } = options;
  
  // Setup mocks if needed
  if (mocks.tauri) {
    const { mockInvoke } = require('../utils') as UtilsModule;
    mockInvoke(mocks.tauri);
  }
  
  if (mocks.terminal) {
    // Terminal-specific setup
    vi.mock('@xterm/xterm', () => ({
      Terminal: (require('../mocks/terminal') as TerminalMocks).MockTerminal,
    }));
  }
  
  if (mocks.canvas) {
    // Canvas-specific setup
    const { mockCanvasGetContext } = require('../utils/canvas') as CanvasModule;
    mockCanvasGetContext();
  }
  
  const result = render(Component, { props });
  
  // Add helper to update props
  const updateProps = async (newProps: Partial<any>) => {
    result.component.$set(newProps);
    await vi.waitFor(() => {
      // Wait for Svelte to update
    });
  };
  
  return {
    ...result,
    updateProps,
  };
}

/**
 * Test helper for components that use ResizeObserver
 */
export function mockResizeObserver() {
  const observers = new Map<Element, ResizeObserver>();
  const callbacks = new Map<ResizeObserver, ResizeObserverCallback>();
  
  global.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => {
    const observer = {
      observe: vi.fn((target: Element) => {
        observers.set(target, observer);
        callbacks.set(observer, callback);
      }),
      unobserve: vi.fn((target: Element) => {
        observers.delete(target);
      }),
      disconnect: vi.fn(() => {
        for (const [target, obs] of observers) {
          if (obs === observer) {
            observers.delete(target);
          }
        }
        callbacks.delete(observer);
      }),
    };
    return observer;
  });
  
  return {
    triggerResize: (element: Element, contentRect: Partial<DOMRectReadOnly>) => {
      const observer = observers.get(element);
      const callback = observer ? callbacks.get(observer) : undefined;
      if (callback) {
        callback([{
          target: element,
          contentRect: {
            x: 0,
            y: 0,
            width: 800,
            height: 600,
            top: 0,
            right: 800,
            bottom: 600,
            left: 0,
            ...contentRect,
          } as DOMRectReadOnly,
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        }], observer as ResizeObserver);
      }
    },
  };
}

/**
 * Test helper for drag and drop operations
 */
export function createDragEvent(type: string, data?: Record<string, any>) {
  const event = new Event(type, { bubbles: true, cancelable: true }) as Event & {
    dataTransfer: {
      data: Record<string, string>;
      setData(key: string, value: string): void;
      getData(key: string): string;
      clearData(): void;
      effectAllowed: string;
      dropEffect: string;
      files: FileList;
      items: DataTransferItemList;
      types: readonly string[];
    };
  };
  
  const mockDataTransfer = {
    data: {} as Record<string, string>,
    setData(key: string, value: string) {
      this.data[key] = value;
    },
    getData(key: string) {
      return this.data[key] || '';
    },
    clearData() {
      this.data = {};
    },
    effectAllowed: 'all',
    dropEffect: 'none',
    files: [] as any as FileList,
    items: [] as any as DataTransferItemList,
    types: [] as readonly string[],
  };
  
  Object.assign(event, {
    dataTransfer: mockDataTransfer,
    ...data,
  });
  return event;
}