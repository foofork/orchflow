import { writable, type Writable, type Readable } from 'svelte/store';
import { vi, type MockedFunction } from 'vitest';
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';

// Helper to create a mock writable store that mimics a derived store
export function createMockDerivedStore<T>(initialValue: T): Writable<T> & { _isDerived: boolean } {
  const store = writable(initialValue);
  return {
    ...store,
    _isDerived: true, // Mark as derived for testing purposes
  };
}

// Helper to create properly typed mock manager
export interface MockManager {
  createTerminal: MockedFunction<(sessionId?: string, options?: { command?: string; shellType?: string; name?: string; }) => Promise<Pane>>;
  createSession: MockedFunction<(name: string) => Promise<Session>>;
  refreshSessions: MockedFunction<() => Promise<void>>;
  refreshPlugins: MockedFunction<() => Promise<void>>;
  searchProject: MockedFunction<(query: string, options?: any) => Promise<any>>;
  listDirectory: MockedFunction<(path: string) => Promise<any>>;
  sendInput: MockedFunction<(paneId: string, input: string) => Promise<void>>;
  execute: MockedFunction<(paneId: string, command: string) => Promise<void>>;
  closePane: MockedFunction<(paneId: string) => Promise<void>>;
  focusPane: MockedFunction<(paneId: string) => Promise<void>>;
  getPaneOutput: MockedFunction<(paneId: string) => Promise<string>>;
  subscribe: MockedFunction<(fn: (value: any) => void) => () => void>;
}

// Helper to create properly typed mock stores for manager
export function createMockManagerStores() {
  const mockSessions = createMockDerivedStore<Session[]>([]);
  const mockPanes = createMockDerivedStore<Map<string, Pane>>(new Map());
  const mockActiveSession = createMockDerivedStore<Session | undefined>(undefined);
  const mockActivePane = createMockDerivedStore<Pane | undefined>(undefined);
  const mockPlugins = createMockDerivedStore<PluginInfo[]>([]);
  const mockIsConnected = createMockDerivedStore<boolean>(false);
  const mockTerminalOutputs = createMockDerivedStore<Map<string, string>>(new Map());
  const mockLoadedPlugins = createMockDerivedStore<Set<string>>(new Set());
  
  const mockManager: MockManager = {
    createTerminal: vi.fn<[sessionId?: string, options?: { command?: string; shellType?: string; name?: string; }], Promise<Pane>>(),
    createSession: vi.fn<[string], Promise<Session>>(),
    refreshSessions: vi.fn<[], Promise<void>>(),
    refreshPlugins: vi.fn<[], Promise<void>>(),
    searchProject: vi.fn<[string, any?], Promise<any>>(),
    listDirectory: vi.fn<[string], Promise<any>>(),
    sendInput: vi.fn<[string, string], Promise<void>>(),
    execute: vi.fn<[string, string], Promise<void>>(),
    closePane: vi.fn<[string], Promise<void>>(),
    focusPane: vi.fn<[string], Promise<void>>(),
    getPaneOutput: vi.fn<[string], Promise<string>>(),
    subscribe: vi.fn(),
  };
  
  return {
    manager: mockManager,
    sessions: mockSessions,
    panes: mockPanes,
    activeSession: mockActiveSession,
    activePane: mockActivePane,
    plugins: mockPlugins,
    isConnected: mockIsConnected,
    terminalOutputs: mockTerminalOutputs,
    loadedPlugins: mockLoadedPlugins,
  };
}

// Factory function to create a mock manager module for vi.mock
export function createMockManagerModule() {
  return createMockManagerStores();
}