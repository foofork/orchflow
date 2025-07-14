/**
 * Type definitions for NeovimEditor component and its tests
 */

import type { MockedFunction } from 'vitest';

// Terminal addon interfaces
export interface ITerminalAddon {
  dispose(): void;
}

export interface FitAddon extends ITerminalAddon {
  fit(): void;
}

// Terminal instance interface
export interface Terminal {
  open(element: HTMLElement): void;
  dispose(): void;
  clear(): void;
  write(data: string): void;
  writeln(data: string): void;
  onData(callback: (data: string) => void): { dispose: () => void };
  loadAddon(addon: ITerminalAddon): void;
  cols: number;
  rows: number;
}

// Tmux pane interface
export interface TmuxPane {
  id: string;
}

// Tmux client interface
export interface TmuxClient {
  createPane: MockedFunction<[session: string, command: string], Promise<TmuxPane>>;
  sendKeys: MockedFunction<[paneId: string, keys: string], Promise<void>>;
  capturePane: MockedFunction<[paneId: string, maxLines: number], Promise<string>>;
  resizePane: MockedFunction<[paneId: string, cols: number, rows: number], Promise<void>>;
  killPane: MockedFunction<[paneId: string], Promise<void>>;
}

// Neovim client interface
export interface NeovimClient {
  openFile: MockedFunction<[filePath: string], Promise<void>>;
  save: MockedFunction<[], Promise<void>>;
  getBufferContent: MockedFunction<[], Promise<string>>;
  getMode: MockedFunction<[], Promise<string>>;
  eval: MockedFunction<[command: string], Promise<unknown>>;
  close: MockedFunction<[], Promise<void>>;
}

// Neovim client constructor interface
export interface NeovimClientConstructor {
  create: MockedFunction<[instanceId: string], Promise<NeovimClient>>;
}

// Component props interface
export interface NeovimEditorProps {
  filePath?: string;
  sessionName?: string;
  title?: string;
  instanceId?: string;
}

// Component instance interface
export interface NeovimEditorComponent {
  save(): Promise<void>;
  getBuffer(): Promise<string>;
}

// ResizeObserver mock types
export interface MockResizeObserver {
  observe: MockedFunction<[target: Element], void>;
  disconnect: MockedFunction<[], void>;
  unobserve: MockedFunction<[target: Element], void>;
}

export type ResizeObserverCallback = () => void;

export interface MockResizeObserverConstructor {
  new (callback: ResizeObserverCallback): MockResizeObserver;
  prototype: MockResizeObserver;
}

// User event type
export interface UserEvent {
  click(element: Element): Promise<void>;
  type(element: Element, text: string): Promise<void>;
  keyboard(keys: string): Promise<void>;
}