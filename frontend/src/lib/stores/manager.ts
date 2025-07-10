import { writable, derived, get } from 'svelte/store';
import { managerClient, type Session, type Pane, type ManagerEvent, type PluginInfo } from '../api/manager-client';

// ===== Store Types =====

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

// ===== Main Store =====

function createManagerStore() {
  const { subscribe, set, update } = writable<ManagerState>({
    sessions: [],
    panes: new Map(),
    plugins: [],
    terminalOutputs: new Map(),
    isConnected: false,
  });

  let eventUnsubscribers: (() => void)[] = [];

  // Initialize store
  async function init() {
    try {
      // Connect WebSocket for real-time events
      await managerClient.connectWebSocket();
      
      // Subscribe to events
      await managerClient.subscribe([
        'SessionCreated',
        'SessionDeleted',
        'PaneCreated',
        'PaneClosed',
        'PaneOutput',
        'PaneResized',
        'PaneFocused',
        'PluginLoaded',
        'PluginUnloaded',
        'FileModified',
        'FileSaved'
      ]);

      // Set up event handlers
      eventUnsubscribers.push(
        managerClient.onEvent('SessionCreated', (event) => {
          refreshSessions();
        }),

        managerClient.onEvent('SessionDeleted', (event) => {
          if (event.type === 'SessionDeleted') {
            update(state => {
              state.sessions = state.sessions.filter(s => s.id !== event.session_id);
              if (state.activeSessionId === event.session_id) {
                state.activeSessionId = state.sessions[0]?.id;
              }
              return state;
            });
          }
        }),

        managerClient.onEvent('PaneCreated', (event) => {
          if (event.type === 'PaneCreated') {
            refreshPanes(event.session_id);
          }
        }),

        managerClient.onEvent('PaneClosed', (event) => {
          if (event.type === 'PaneClosed') {
            update(state => {
              state.panes.delete(event.pane_id);
              state.terminalOutputs.delete(event.pane_id);
              if (state.activePaneId === event.pane_id) {
                const panes = Array.from(state.panes.values());
                state.activePaneId = panes[0]?.id;
              }
              return state;
            });
          }
        }),

        managerClient.onEvent('PaneOutput', (event) => {
          if (event.type === 'PaneOutput') {
            update(state => {
              const outputs = state.terminalOutputs.get(event.pane_id) || [];
              outputs.push(event.data);
              // Keep last 1000 lines
              if (outputs.length > 1000) {
                outputs.splice(0, outputs.length - 1000);
              }
              state.terminalOutputs.set(event.pane_id, outputs);
              return state;
            });
          }
        }),

        managerClient.onEvent('PaneFocused', (event) => {
          if (event.type === 'PaneFocused') {
            update(state => ({
              ...state,
              activePaneId: event.pane_id
            }));
          }
        }),

        managerClient.onEvent('PluginLoaded', (event) => {
          refreshPlugins();
        }),

        managerClient.onEvent('PluginUnloaded', (event) => {
          refreshPlugins();
        })
      );

      // Mark as connected
      update(state => ({ ...state, isConnected: true }));

      // Load initial data
      await Promise.all([
        refreshSessions(),
        refreshPlugins()
      ]);

    } catch (error) {
      console.error('Failed to initialize manager store:', error);
      update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isConnected: false
      }));
    }
  }

  // Refresh all sessions
  async function refreshSessions() {
    try {
      const sessions = await managerClient.getSessions();
      
      update(state => ({
        ...state,
        sessions,
        activeSessionId: state.activeSessionId || sessions[0]?.id,
        error: undefined
      }));

      // Refresh panes for active session
      const activeSessionId = get(store).activeSessionId;
      if (activeSessionId) {
        await refreshPanes(activeSessionId);
      }
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
      update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to refresh sessions'
      }));
    }
  }

  // Refresh panes for a session
  async function refreshPanes(sessionId: string) {
    try {
      const panes = await managerClient.getPanes(sessionId);
      
      update(state => {
        // Update panes map
        const newPanes = new Map(state.panes);
        panes.forEach(pane => newPanes.set(pane.id, pane));
        
        return {
          ...state,
          panes: newPanes,
          activePaneId: state.activePaneId || panes[0]?.id
        };
      });
    } catch (error) {
      console.error('Failed to refresh panes:', error);
    }
  }

  // Refresh plugins
  async function refreshPlugins() {
    try {
      const plugins = await managerClient.listPlugins();
      update(state => ({
        ...state,
        plugins
      }));
    } catch (error) {
      console.error('Failed to refresh plugins:', error);
    }
  }

  // Actions

  async function createSession(name: string): Promise<Session> {
    const session = await managerClient.createSession(name);
    await refreshSessions();
    return session;
  }

  async function deleteSession(sessionId: string): Promise<void> {
    await managerClient.deleteSession(sessionId);
    await refreshSessions();
  }

  async function createTerminal(sessionId?: string, options?: {
    command?: string;
    shellType?: string;
    name?: string;
  }): Promise<Pane> {
    const targetSessionId = sessionId || get(store).activeSessionId;
    if (!targetSessionId) {
      throw new Error('No active session');
    }

    const pane = await managerClient.createPane(targetSessionId, {
      paneType: 'Terminal',
      ...options
    });

    await refreshPanes(targetSessionId);
    return pane;
  }

  async function closePane(paneId: string): Promise<void> {
    await managerClient.closePane(paneId);
  }

  async function sendInput(paneId: string, input: string): Promise<void> {
    await managerClient.sendInput(paneId, input);
  }

  async function sendKeys(paneId: string, keys: string): Promise<void> {
    await managerClient.sendKeys(paneId, keys);
  }

  async function focusPane(paneId: string): Promise<void> {
    await managerClient.selectBackendPane(paneId);
    update(state => ({
      ...state,
      activePaneId: paneId
    }));
  }

  async function setActiveSession(sessionId: string): Promise<void> {
    update(state => ({
      ...state,
      activeSessionId: sessionId
    }));
    await refreshPanes(sessionId);
  }

  async function loadPlugin(pluginId: string): Promise<void> {
    await managerClient.loadPlugin(pluginId);
    await refreshPlugins();
  }

  async function unloadPlugin(pluginId: string): Promise<void> {
    await managerClient.unloadPlugin(pluginId);
    await refreshPlugins();
  }

  async function persistState(): Promise<void> {
    await managerClient.persistState();
  }

  // File operations

  async function readFile(path: string): Promise<string> {
    return await managerClient.readFile(path);
  }

  async function saveFile(path: string, content: string): Promise<void> {
    await managerClient.saveFile(path, content);
  }

  async function listDirectory(path: string): Promise<any> {
    return await managerClient.listDirectory(path);
  }

  async function watchFile(path: string): Promise<void> {
    await managerClient.watchFile(path);
  }

  async function unwatchFile(path: string): Promise<void> {
    await managerClient.unwatchFile(path);
  }

  // Search operations

  async function searchProject(query: string, options?: any): Promise<any> {
    return await managerClient.searchProject(query, options);
  }

  async function getCommandHistory(paneId?: string, limit?: number): Promise<any[]> {
    return await managerClient.getCommandHistory(paneId, limit);
  }

  // Cleanup
  function destroy() {
    eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    managerClient.dispose();
  }

  // Create store instance
  const store = {
    subscribe,
    init,
    createSession,
    deleteSession,
    createTerminal,
    closePane,
    sendInput,
    sendKeys,
    focusPane,
    setActiveSession,
    loadPlugin,
    unloadPlugin,
    persistState,
    readFile,
    saveFile,
    listDirectory,
    watchFile,
    unwatchFile,
    searchProject,
    getCommandHistory,
    refreshSessions,
    refreshPanes,
    refreshPlugins,
    destroy
  };

  // Auto-initialize only in non-test environment
  if (typeof process === 'undefined' || process.env.NODE_ENV !== 'test') {
    init();
  }

  return store;
}

// ===== Store Instances =====

export const manager = createManagerStore();

// ===== Derived Stores =====

export const sessions = derived(manager, $manager => $manager.sessions);

export const activeSession = derived(
  manager,
  $manager => $manager.sessions.find(s => s.id === $manager.activeSessionId)
);

export const panes = derived(manager, $manager => $manager.panes);

export const activePaneId = derived(manager, $manager => $manager.activePaneId);

export const activePane = derived(
  manager,
  $manager => $manager.activePaneId ? $manager.panes.get($manager.activePaneId) : undefined
);

export const plugins = derived(manager, $manager => $manager.plugins);

export const loadedPlugins = derived(
  plugins,
  $plugins => $plugins.filter(p => p.loaded)
);

export const terminalOutputs = derived(
  manager,
  $manager => $manager.terminalOutputs
);

export const isConnected = derived(manager, $manager => $manager.isConnected);

export const error = derived(manager, $manager => $manager.error);