import { writable, derived, type Writable, type Readable } from 'svelte/store';
import { vi } from 'vitest';
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';

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
    init: vi.fn(),
    cleanup: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    createTerminal: vi.fn(),
    closePane: vi.fn(),
    sendInput: vi.fn(),
    sendKeys: vi.fn(),
    focusPane: vi.fn(),
    setActiveSession: vi.fn(),
    loadPlugin: vi.fn(),
    unloadPlugin: vi.fn(),
    persistState: vi.fn(),
    readFile: vi.fn(),
    saveFile: vi.fn(),
    listDirectory: vi.fn(),
    watchFile: vi.fn(),
    unwatchFile: vi.fn(),
    searchProject: vi.fn(),
    searchFiles: vi.fn(),
    resizePane: vi.fn(),
    refreshSessions: vi.fn(),
    refreshPanes: vi.fn(),
    refreshPlugins: vi.fn(),
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
    path: '/path/to/plugin',
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
    title: 'Test Pane',
    pane_type: 'Editor',
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
    ...overrides
  };
}