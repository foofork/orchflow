import { writable, readable, type Writable, type Readable } from 'svelte/store';
import { vi, type MockedFunction } from 'vitest';
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';
import { createAsyncMock, createAsyncVoidMock } from './mock-factory';

// Helper to create a mock writable store that mimics a derived store
// This returns a Writable store even though it represents a derived store
// This is necessary for testing as we need to call .set() to setup test data
export function createMockDerivedStore<T>(initialValue: T): Writable<T> & { _isDerived: boolean } {
  const store = writable(initialValue);
  return {
    ...store,
    _isDerived: true, // Mark as derived for testing purposes
  };
}

// Helper to create a mock store that behaves like a writable in tests
// but represents a derived store from the real application
export function createMockDerivedAsWritable<T>(initialValue: T): Writable<T> {
  return writable(initialValue);
}

// Helper to create a tracked store that records all subscriptions and updates
export function createTrackedStore<T>(initialValue: T) {
  const subscribers = new Set<(value: T) => void>();
  const updateHistory: T[] = [initialValue];
  let currentValue = initialValue;

  const store: Writable<T> = {
    subscribe: vi.fn((subscriber: (value: T) => void) => {
      subscribers.add(subscriber);
      subscriber(currentValue);
      
      return () => {
        subscribers.delete(subscriber);
      };
    }),
    
    set: vi.fn((value: T) => {
      currentValue = value;
      updateHistory.push(value);
      subscribers.forEach(sub => sub(value));
    }),
    
    update: vi.fn((updater: (value: T) => T) => {
      const newValue = updater(currentValue);
      store.set(newValue);
    })
  };

  return {
    ...store,
    getSubscriberCount: () => subscribers.size,
    getUpdateHistory: () => [...updateHistory],
    getCurrentValue: () => currentValue,
    mockClear: () => {
      (store.subscribe as any).mockClear();
      (store.set as any).mockClear();
      (store.update as any).mockClear();
    },
    mockReset: () => {
      subscribers.clear();
      updateHistory.length = 1;
      updateHistory[0] = initialValue;
      currentValue = initialValue;
      (store.subscribe as any).mockReset();
      (store.set as any).mockReset();
      (store.update as any).mockReset();
    }
  };
}

// Helper to create a mock writable store with spy functions
export function createMockWritable<T>(initialValue: T) {
  const store = writable(initialValue);
  const subscribe = vi.fn(store.subscribe);
  const set = vi.fn(store.set);
  const update = vi.fn(store.update);

  return {
    subscribe,
    set,
    update,
    mockClear: () => {
      subscribe.mockClear();
      set.mockClear();
      update.mockClear();
    },
    mockReset: () => {
      subscribe.mockReset();
      set.mockReset();
      update.mockReset();
      store.set(initialValue);
    },
    getValue: () => {
      let value: T;
      store.subscribe(v => value = v)();
      return value!;
    }
  };
}

// Helper to create a mock readable store with spy functions
export function createMockReadable<T>(value: T) {
  const store = readable(value);
  const subscribe = vi.fn(store.subscribe);

  return {
    subscribe,
    mockClear: () => {
      subscribe.mockClear();
    },
    mockReset: () => {
      subscribe.mockReset();
    },
    getValue: () => value
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
// These return Writable stores for testing, even though the real stores are derived
export function createMockManagerStores() {
  const mockSessions = createMockDerivedAsWritable<Session[]>([]);
  const mockPanes = createMockDerivedAsWritable<Map<string, Pane>>(new Map());
  const mockActiveSession = createMockDerivedAsWritable<Session | undefined>(undefined);
  const mockActivePane = createMockDerivedAsWritable<Pane | undefined>(undefined);
  const mockPlugins = createMockDerivedAsWritable<PluginInfo[]>([]);
  const mockIsConnected = createMockDerivedAsWritable<boolean>(false);
  const mockTerminalOutputs = createMockDerivedAsWritable<Map<string, string>>(new Map());
  const mockLoadedPlugins = createMockDerivedAsWritable<Set<string>>(new Set());
  
  const mockManager: MockManager = {
    createTerminal: createAsyncMock<[sessionId?: string, options?: { command?: string; shellType?: string; name?: string; }], Pane>(),
    createSession: createAsyncMock<[name: string], Session>(),
    refreshSessions: createAsyncVoidMock<[]>(),
    refreshPlugins: createAsyncVoidMock<[]>(),
    searchProject: createAsyncMock<[query: string, options?: any], any>(),
    listDirectory: createAsyncMock<[path: string], any>(),
    sendInput: createAsyncVoidMock<[paneId: string, input: string]>(),
    execute: createAsyncVoidMock<[paneId: string, command: string]>(),
    closePane: createAsyncVoidMock<[paneId: string]>(),
    focusPane: createAsyncVoidMock<[paneId: string]>(),
    getPaneOutput: createAsyncMock<[paneId: string], string>(),
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

// Utility to wait for store updates in tests
export async function waitForStoreUpdate<T>(
  store: Readable<T>,
  predicate: (value: T) => boolean,
  timeout = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Store update timeout'));
    }, timeout);

    const unsubscribe = store.subscribe(value => {
      if (predicate(value)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(value);
      }
    });
  });
}

// Helper to create mock data factories
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session',
    name: 'Test Session',
    panes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockPane(overrides: Partial<Pane> = {}): Pane {
  return {
    id: 'test-pane',
    session_id: 'test-session',
    pane_type: 'Terminal',
    title: 'Test Pane',
    rows: 24,
    cols: 80,
    x: 0,
    y: 0,
    is_active: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}

export function createMockPlugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test plugin',
    capabilities: ['terminal', 'editor', 'search'],
    loaded: false,
    ...overrides
  };
}