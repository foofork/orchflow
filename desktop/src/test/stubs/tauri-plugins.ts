import { vi } from 'vitest';

// @tauri-apps/plugin-fs
export const readDir = vi.fn(() => Promise.resolve([]));
export const readFile = vi.fn(() => Promise.resolve(new Uint8Array()));
export const writeFile = vi.fn(() => Promise.resolve());
export const exists = vi.fn(() => Promise.resolve(false));
export const createDir = vi.fn(() => Promise.resolve());
export const removeFile = vi.fn(() => Promise.resolve());
export const removeDir = vi.fn(() => Promise.resolve());

// @tauri-apps/plugin-shell
export class Command {
  constructor(public program: string, public args?: string[]) {}
  
  execute = vi.fn(() => Promise.resolve({ code: 0, signal: null, stdout: '', stderr: '' }));
  spawn = vi.fn(() => Promise.resolve({ code: 0, signal: null, stdout: '', stderr: '' }));
  stdout = { on: vi.fn() };
  stderr = { on: vi.fn() };
  on = vi.fn();
}

export const open = vi.fn(() => Promise.resolve());

// @tauri-apps/plugin-process
export const exit = vi.fn();
export const relaunch = vi.fn(() => Promise.resolve());

// @tauri-apps/plugin-os
export const platform = vi.fn(() => 'darwin');
export const version = vi.fn(() => Promise.resolve('1.0.0'));
export const type = vi.fn(() => Promise.resolve('Darwin'));
export const arch = vi.fn(() => Promise.resolve('x86_64'));
export const tempdir = vi.fn(() => Promise.resolve('/tmp'));

// @tauri-apps/plugin-updater
export const checkUpdate = vi.fn(() => Promise.resolve(null));
export const installUpdate = vi.fn(() => Promise.resolve());
export const onUpdaterEvent = vi.fn(() => Promise.resolve(() => {}));