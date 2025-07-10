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
  const tauriInvoke = require('@tauri-apps/api/tauri');
  
  // Default responses for common commands
  const defaultResponses: Record<string, any> = {
    get_sessions: [],
    get_panes: [],
    get_file_operation_history: [],
    search_project: { results: [], stats: { files_searched: 0, matches_found: 0, duration_ms: 0 } },
    get_search_history: [],
    get_saved_searches: [],
  };
  
  const mockImpl = (cmd: string, args?: any) => {
    if (responses[cmd] !== undefined) {
      return Promise.resolve(
        typeof responses[cmd] === 'function' ? responses[cmd](args) : responses[cmd]
      );
    }
    if (defaultResponses[cmd] !== undefined) {
      return Promise.resolve(defaultResponses[cmd]);
    }
    return Promise.resolve(null);
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