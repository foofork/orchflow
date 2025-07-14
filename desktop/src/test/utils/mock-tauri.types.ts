/**
 * Type definitions for mock-tauri.ts
 */

import type { MockedFunction } from 'vitest';

// Event listener type
export type EventHandler = (event: { payload?: unknown }) => void;

// Position type
export interface Position {
  x: number;
  y: number;
}

// Size type
export interface Size {
  width: number;
  height: number;
}

// Window mock interface
export interface MockWindow {
  appWindow: {
    listen: MockedFunction<[event: string, handler: EventHandler], Promise<() => void>>;
    emit: MockedFunction<[event: string, payload?: unknown], Promise<void>>;
    setTitle: MockedFunction<[title: string], Promise<void>>;
    maximize: MockedFunction<[], Promise<void>>;
    minimize: MockedFunction<[], Promise<void>>;
    toggleMaximize: MockedFunction<[], Promise<void>>;
    close: MockedFunction<[], Promise<void>>;
    hide: MockedFunction<[], Promise<void>>;
    show: MockedFunction<[], Promise<void>>;
    setFocus: MockedFunction<[], Promise<void>>;
    center: MockedFunction<[], Promise<void>>;
    isMaximized: MockedFunction<[], Promise<boolean>>;
    isMinimized: MockedFunction<[], Promise<boolean>>;
    isVisible: MockedFunction<[], Promise<boolean>>;
    isFocused: MockedFunction<[], Promise<boolean>>;
    isDecorated: MockedFunction<[], Promise<boolean>>;
    isResizable: MockedFunction<[], Promise<boolean>>;
    innerPosition: MockedFunction<[], Promise<Position>>;
    outerPosition: MockedFunction<[], Promise<Position>>;
    innerSize: MockedFunction<[], Promise<Size>>;
    outerSize: MockedFunction<[], Promise<Size>>;
    setPosition: MockedFunction<[position: Position], Promise<void>>;
    setSize: MockedFunction<[size: Size], Promise<void>>;
    setMinSize: MockedFunction<[size: Size], Promise<void>>;
    setMaxSize: MockedFunction<[size: Size], Promise<void>>;
    mockClear: () => void;
    mockReset: () => void;
    triggerEvent: (event: string, payload?: unknown) => void;
  };
}

// File system mock interface
export interface MockFileSystem {
  readTextFile: MockedFunction<[path: string], Promise<string>>;
  readBinaryFile: MockedFunction<[path: string], Promise<Uint8Array>>;
  writeTextFile: MockedFunction<[path: string, content: string], Promise<void>>;
  writeBinaryFile: MockedFunction<[path: string, content: Uint8Array], Promise<void>>;
  exists: MockedFunction<[path: string], Promise<boolean>>;
  createDir: MockedFunction<[path: string], Promise<void>>;
  removeFile: MockedFunction<[path: string], Promise<void>>;
  removeDir: MockedFunction<[path: string], Promise<void>>;
  copyFile: MockedFunction<[source: string, destination: string], Promise<void>>;
  renameFile: MockedFunction<[oldPath: string, newPath: string], Promise<void>>;
  mockClear: () => void;
  mockReset: () => void;
  mockAddFile: (path: string, content: string | Uint8Array) => void;
  mockGetFile: (path: string) => string | Uint8Array | undefined;
  mockListFiles: () => string[];
}

// Dialog mock interface
export interface MockDialog {
  open: MockedFunction<[], Promise<string | string[] | null>>;
  save: MockedFunction<[], Promise<string | null>>;
  message: MockedFunction<[message: string], Promise<void>>;
  ask: MockedFunction<[message: string], Promise<boolean>>;
  confirm: MockedFunction<[message: string], Promise<boolean>>;
  mockClear: () => void;
}

// Shell process interface
export interface MockProcess {
  program: string;
  args: string[];
  stdout: MockedFunction<[], void>;
  stderr: MockedFunction<[], void>;
  spawn: MockedFunction<[], Promise<{ pid: number }>>;
  execute: MockedFunction<[], Promise<{
    code: number;
    signal: string | null;
    stdout: string;
    stderr: string;
  }>>;
  kill: MockedFunction<[], Promise<void>>;
}

// Shell mock interface
export interface MockShell {
  Command: MockedFunction<[program: string, args?: string[]], MockProcess>;
  open: MockedFunction<[url: string], Promise<void>>;
  mockClear: () => void;
  mockReset: () => void;
  mockGetProcess: (pid: number) => MockProcess | undefined;
}

// Clipboard mock interface
export interface MockClipboard {
  readText: MockedFunction<[], Promise<string>>;
  writeText: MockedFunction<[text: string], Promise<void>>;
  mockClear: () => void;
  mockReset: () => void;
  mockGetContent: () => string;
}

// Invoke handler type
export type InvokeHandler = (...args: unknown[]) => unknown;

// Invoke mock interface
export interface MockInvoke extends MockedFunction<[command: string, args?: unknown], Promise<unknown>> {
  mockImplementation: (command: string, handler: InvokeHandler) => void;
  mockClear: () => void;
  mockReset: () => void;
}

// Complete Tauri mock interface
export interface MockTauri {
  window: MockWindow;
  fs: MockFileSystem;
  dialog: MockDialog;
  shell: MockShell;
  clipboard: MockClipboard;
  invoke: MockInvoke;
  mockClear: () => void;
  mockReset: () => void;
}

// Global declaration extension
declare global {
  interface GlobalThis {
    __TAURI__?: MockTauri;
    window: Window & {
      __TAURI__?: MockTauri;
    };
  }
}