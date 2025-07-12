import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { vi } from 'vitest';
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';
import { createAsyncMock } from '../mock-factory';

interface ManagerState {
  sessions: Session[];
  panes: Map<string, Pane>;
  activeSessionId?: string;
  activePaneId?: string;
  plugins: PluginInfo[];
  terminalOutputs: Map<string, string[]>;
  isConnected: boolean;
  error?: string;
}

/**
 * Create a comprehensive mock for the manager store and its derived stores
 */
export function createMockManagerStore() {
  // Create the main writable store
  const managerStore = writable<ManagerState>({
    sessions: [],
    panes: new Map(),
    plugins: [],
    terminalOutputs: new Map(),
    isConnected: false,
  });

  // Create mock functions
  const mockFunctions = {
    init: createAsyncMock(),
    cleanup: createAsyncMock(),
    createSession: createAsyncMock(),
    deleteSession: createAsyncMock(),
    createTerminal: createAsyncMock(),
    closePane: createAsyncMock(),
    sendInput: createAsyncMock(),
    sendKeys: createAsyncMock(),
    focusPane: createAsyncMock(),
    setActiveSession: vi.fn(),
    loadPlugin: createAsyncMock(),
    unloadPlugin: createAsyncMock(),
    persistState: createAsyncMock(),
    readFile: createAsyncMock(),
    saveFile: createAsyncMock(),
    listDirectory: createAsyncMock(),
    watchFile: createAsyncMock(),
    unwatchFile: createAsyncMock(),
    searchProject: createAsyncMock(),
    searchFiles: createAsyncMock(),
    resizePane: createAsyncMock(),
    refreshSessions: createAsyncMock(),
    refreshPanes: createAsyncMock(),
    refreshPlugins: createAsyncMock(),
  };

  // Create the manager object with both store methods and custom methods
  const manager = {
    subscribe: managerStore.subscribe,
    set: managerStore.set,
    update: managerStore.update,
    ...mockFunctions,
  };

  // Create derived stores
  const sessions = derived(manager, $manager => $manager.sessions);
  const activeSession = derived(
    manager,
    $manager => $manager.sessions.find(s => s.id === $manager.activeSessionId)
  );
  const panes = derived(manager, $manager => $manager.panes);
  const activePaneId = derived(manager, $manager => $manager.activePaneId);
  const activePane = derived(
    manager,
    $manager => $manager.activePaneId ? $manager.panes.get($manager.activePaneId) : undefined
  );
  const plugins = derived(manager, $manager => $manager.plugins);
  const loadedPlugins = derived(
    plugins,
    $plugins => $plugins.filter(p => p.loaded)
  );

  // Helper functions to update the store state
  const helpers = {
    setPlugins: (newPlugins: PluginInfo[]) => {
      managerStore.update(state => ({ ...state, plugins: newPlugins }));
    },
    setPanes: (newPanes: Map<string, Pane>) => {
      managerStore.update(state => ({ ...state, panes: newPanes }));
    },
    setActiveSession: (sessionId: string | undefined) => {
      managerStore.update(state => ({ ...state, activeSessionId: sessionId }));
    },
    setActivePane: (paneId: string | undefined) => {
      managerStore.update(state => ({ ...state, activePaneId: paneId }));
    },
    setSessions: (newSessions: Session[]) => {
      managerStore.update(state => ({ ...state, sessions: newSessions }));
    },
    addSession: (session: Session) => {
      managerStore.update(state => ({
        ...state,
        sessions: [...state.sessions, session]
      }));
    },
    removeSession: (sessionId: string) => {
      managerStore.update(state => ({
        ...state,
        sessions: state.sessions.filter(s => s.id !== sessionId)
      }));
    },
    addPane: (pane: Pane) => {
      managerStore.update(state => {
        const newPanes = new Map(state.panes);
        newPanes.set(pane.id, pane);
        return { ...state, panes: newPanes };
      });
    },
    removePane: (paneId: string) => {
      managerStore.update(state => {
        const newPanes = new Map(state.panes);
        newPanes.delete(paneId);
        return { ...state, panes: newPanes };
      });
    },
    reset: () => {
      managerStore.set({
        sessions: [],
        panes: new Map(),
        plugins: [],
        terminalOutputs: new Map(),
        isConnected: false,
      });
    },
    mockClear: () => {
      Object.values(mockFunctions).forEach(fn => fn.mockClear());
    },
    mockReset: () => {
      helpers.reset();
      helpers.mockClear();
    }
  };

  return {
    manager,
    sessions,
    activeSession,
    panes,
    activePaneId,
    activePane,
    plugins,
    loadedPlugins,
    ...helpers,
  };
}

/**
 * Create mock plugin data for testing
 */
export function createMockPlugin(overrides: Partial<PluginInfo> = {}): PluginInfo {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    author: 'Test Author',
    description: 'A test plugin',
    // Note: path is not a valid PluginInfo property, removing
    loaded: false,
    status: 'available',
    type: 'core',
    ...overrides
  };
}

/**
 * Create mock pane data for testing
 */
export function createMockPane(overrides: Partial<Pane> = {}): Pane {
  return {
    id: 'test-pane',
    session_id: 'test-session',
    pane_type: 'Editor',
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

/**
 * Create mock session data for testing
 */
export function createMockSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-session',
    name: 'Test Session',
    panes: [],
    layout: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides
  };
}