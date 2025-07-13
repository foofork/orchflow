import { vi } from 'vitest';
import type { Terminal as XTerminal } from '@xterm/xterm';

/**
 * Professional mock strategy for terminal components
 * Isolates canvas/WebGL rendering from unit tests
 */

export interface MockTerminalOptions {
  rows?: number;
  cols?: number;
  mockBehavior?: 'minimal' | 'interactive' | 'full';
}

export class MockTerminal implements Partial<XTerminal> {
  rows: number;
  cols: number;
  element: HTMLElement;
  buffer: any; // Mock buffer - type incompatibility is expected for test mocks
  
  private _data: string[] = [];
  private _onDataHandlers: Array<(data: string) => void> = [];
  private _onResizeHandlers: Array<(size: { cols: number; rows: number }) => void> = [];
  
  constructor(options: MockTerminalOptions = {}) {
    this.rows = options.rows || 24;
    this.cols = options.cols || 80;
    this.element = document.createElement('div');
    this.element.className = 'xterm-screen';
    this.element.style.width = `${this.cols * 7}px`;
    this.element.style.height = `${this.rows * 17}px`;
    this.buffer = { active: { type: 'normal' } };
  }
  
  loadAddon = vi.fn((addon: any) => {
    // Mock addon loading
    if (addon && addon.activate) {
      addon.activate(this);
    }
  });
  
  open = vi.fn((container: HTMLElement) => {
    if (container && this.element) {
      container.appendChild(this.element);
    }
  });
  
  write = vi.fn((data: string) => {
    this._data.push(data);
    // Update mock DOM for testing
    const line = document.createElement('div');
    line.textContent = data;
    this.element.appendChild(line);
  });
  
  writeln = vi.fn((data: string) => {
    this.write(data + '\n');
  });
  
  clear = vi.fn(() => {
    this._data = [];
    this.element.innerHTML = '';
  });
  
  focus = vi.fn();
  blur = vi.fn();
  dispose = vi.fn();
  
  onData = vi.fn((handler: (data: string) => void) => {
    this._onDataHandlers.push(handler);
    return { dispose: () => {
      const idx = this._onDataHandlers.indexOf(handler);
      if (idx >= 0) this._onDataHandlers.splice(idx, 1);
    }};
  });
  
  onResize = vi.fn((handler: (size: { cols: number; rows: number }) => void) => {
    this._onResizeHandlers.push(handler);
    return { dispose: () => {
      const idx = this._onResizeHandlers.indexOf(handler);
      if (idx >= 0) this._onResizeHandlers.splice(idx, 1);
    }};
  });
  
  resize = vi.fn((cols: number, rows: number) => {
    this.cols = cols;
    this.rows = rows;
    this._onResizeHandlers.forEach(h => h({ cols, rows }));
  });
  
  // Test helpers
  simulateInput(data: string) {
    this._onDataHandlers.forEach(h => h(data));
  }
  
  getOutput(): string {
    return this._data.join('');
  }
}

export function createMockTerminalFactory(defaultOptions?: MockTerminalOptions) {
  return class extends MockTerminal {
    constructor(options?: any) {
      super({ ...defaultOptions, ...options });
    }
  };
}