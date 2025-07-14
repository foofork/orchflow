/**
 * Type definitions for StreamingTerminal component and its tests
 */

import type { UnlistenFn } from '@tauri-apps/api/event';
import type { ITerminalAddon, ITerminalOptions } from '@xterm/xterm';

// Terminal instance type based on xterm.js
export interface TerminalInstance {
  rows: number;
  cols: number;
  element: HTMLElement;
  buffer: {
    active: {
      type: string;
    };
  };
  open(container: HTMLElement): void;
  write(data: string): void;
  writeln(data: string): void;
  clear(): void;
  focus(): void;
  blur(): void;
  dispose(): void;
  onData(callback: (data: string) => void): { dispose: () => void };
  onResize(callback: (data: { cols: number; rows: number }) => void): { dispose: () => void };
  resize(cols: number, rows: number): void;
  loadAddon(addon: ITerminalAddon): void;
  // Internal callbacks for testing
  _dataCallback?: (data: string) => void;
  _resizeCallback?: (data: { cols: number; rows: number }) => void;
}

// Addon types
export interface FitAddonInstance extends ITerminalAddon {
  fit(): void;
}

export interface WebglAddonInstance extends ITerminalAddon {
  onContextLoss(callback: () => void): void;
  // Internal callback for testing
  _contextLossCallback?: () => void;
}

export interface SearchAddonInstance extends ITerminalAddon {
  findNext(term: string): void;
}

export interface WebLinksAddonInstance extends ITerminalAddon {}

// Factory return types
export interface TerminalFactory {
  (): Promise<TerminalFactoryResult | TerminalInstance | null>;
}

export interface TerminalFactoryResult {
  term: TerminalInstance;
  FitAddon?: () => FitAddonInstance;
  WebglAddon?: () => WebglAddonInstance;
  SearchAddon?: () => SearchAddonInstance;
  WebLinksAddon?: () => WebLinksAddonInstance;
}

// Terminal constructor type
export interface TerminalConstructor {
  new (options?: ITerminalOptions): TerminalInstance;
}

// Event payload types
export interface TerminalOutputEvent {
  payload: {
    data: {
      terminal_id: string;
      data: string;
    };
  };
}

export interface TerminalExitEvent {
  payload: {
    data: {
      terminal_id: string;
      code: number;
    };
  };
}

export interface TerminalErrorEvent {
  payload: {
    data: {
      terminal_id: string;
      error: string;
    };
  };
}

// ResizeObserver instance type for testing
export interface MockResizeObserverInstance {
  observe: () => void;
  unobserve: () => void;
  disconnect: () => void;
  callback: ResizeObserverCallback;
}

// Component props type
export interface StreamingTerminalProps {
  terminalId: string;
  title?: string;
  initialRows?: number;
  initialCols?: number;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  terminalFactory?: TerminalFactory;
  testMode?: boolean;
}

// Component instance type
export interface StreamingTerminalComponent {
  write(data: string): void;
  clear(): void;
  focus(): void;
  blur(): void;
  search(term: string): void;
  resize(cols: number, rows: number): void;
}