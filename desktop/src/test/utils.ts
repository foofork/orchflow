import { render } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import type { ComponentType } from 'svelte';

export function renderWithStores(
  Component: ComponentType,
  props: Record<string, any> = {},
  stores: Record<string, any> = {}
) {
  const mockStores = {
    settings: writable({
      theme: 'dark',
      fontSize: 14,
      tabSize: 2,
    }),
    sessions: writable([]),
    panes: writable([]),
    ...stores,
  };

  return render(Component, {
    props,
    context: new Map(Object.entries(mockStores)),
  });
}

export const mockInvoke = (responses: Record<string, any> = {}) => {
  const tauriApi = require('@tauri-apps/api');
  const tauriInvoke = require('@tauri-apps/api/core');
  
  // Default responses for common commands
  const defaultResponses: Record<string, any> = {
    get_sessions: [],
    get_panes: [],
    get_file_operation_history: [],
    search_project: { results: [], stats: { files_searched: 0, matches_found: 0, duration_ms: 0 } },
    get_search_history: [],
    get_saved_searches: [],
    create_streaming_terminal: { 
      terminalId: 'test-terminal',
      sessionId: 'test-session',
      paneId: 'test-pane',
    },
    get_available_shells: ['/bin/bash', '/bin/zsh', '/bin/sh'],
    get_terminal_groups: ['default', 'servers', 'builds'],
    rename_terminal: true,
    send_terminal_input: true,
    get_current_dir: '/home/user',
    broadcast_terminal_input: true,
  };
  
  const mockImpl = async (cmd: string, args?: any) => {
    // Add small delay to simulate real async behavior and prevent race conditions
    await new Promise(resolve => setTimeout(resolve, 5));
    
    if (responses[cmd] !== undefined) {
      const response = responses[cmd];
      
      if (response instanceof Error) {
        throw response;
      }
      
      return typeof response === 'function' ? response(args) : response;
    }
    
    if (defaultResponses[cmd] !== undefined) {
      return defaultResponses[cmd];
    }
    
    return null;
  };
  
  if (tauriApi.invoke && typeof tauriApi.invoke.mockImplementation === 'function') {
    tauriApi.invoke.mockImplementation(mockImpl);
  }
  if (tauriInvoke.invoke && typeof tauriInvoke.invoke.mockImplementation === 'function') {
    tauriInvoke.invoke.mockImplementation(mockImpl);
  }
  
  return tauriApi.invoke || tauriInvoke.invoke;
};

export const createMockFile = (name: string, path: string, type: 'file' | 'directory' = 'file') => ({
  name,
  path,
  type,
  size: type === 'file' ? 1024 : 0,
  modified: new Date().toISOString(),
  children: type === 'directory' ? [] : undefined,
});

export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to wait for async operations with proper timeout handling
export async function waitForAsync<T>(
  fn: () => T | Promise<T>,
  timeout = 5000,
  interval = 50
): Promise<T> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = await fn();
      return result;
    } catch (error) {
      if (Date.now() - startTime + interval >= timeout) {
        throw error;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  throw new Error(`waitForAsync timed out after ${timeout}ms`);
}

// Mock performance APIs that might cause timeouts
export function mockPerformanceAPIs() {
  if (!global.performance) {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByType: () => [],
      getEntriesByName: () => [],
      clearMarks: () => {},
      clearMeasures: () => {},
    } as any;
  }
  
  if (!global.requestAnimationFrame) {
    global.requestAnimationFrame = (callback: FrameRequestCallback) => {
      return setTimeout(() => callback(Date.now()), 16);
    };
  }
  
  if (!global.cancelAnimationFrame) {
    global.cancelAnimationFrame = (id: number) => {
      clearTimeout(id);
    };
  }
}

// Setup function to call in tests that need all performance mocks
export function setupTestEnvironment() {
  mockPerformanceAPIs();
}