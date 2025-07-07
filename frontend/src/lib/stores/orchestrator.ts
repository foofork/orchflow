import { writable, derived } from 'svelte/store';
import { orchestratorClient, type Session, type Pane, type OrchestratorEvent } from '../api/orchestrator-client';
import type { Tab } from '../types';

// ===== Store Types =====

interface OrchestratorState {
  sessions: Session[];
  panes: Map<string, Pane>;
  activeSessionId?: string;
  activePaneId?: string;
  terminalOutputs: Map<string, string[]>;
  isConnected: boolean;
  error?: string;
}

// ===== Tab Management Stores =====
export const tabs = writable<Tab[]>([]);
export const activeTabId = writable<string | null>(null);

// ===== Main Store =====

function createOrchestratorStore() {
  const { subscribe, set, update } = writable<OrchestratorState>({
    sessions: [],
    panes: new Map(),
    terminalOutputs: new Map(),
    isConnected: true, // Always connected with Tauri
  });

  // Event handlers
  const eventUnsubscribers: (() => void)[] = [];

  // Initialize store
  async function init() {
    try {
      // Subscribe to all relevant events
      await orchestratorClient.subscribe([
        'pane_created',
        'pane_closed',
        'pane_output',
        'pane_resized',
        'session_created',
        'session_closed',
        'session_renamed',
        'error'
      ]);

      // Set up event handlers
      eventUnsubscribers.push(
        orchestratorClient.onEvent('pane_created', (event) => {
          if (event.type === 'pane_created') {
            refreshSessions();
          }
        }),

        orchestratorClient.onEvent('pane_closed', (event) => {
          if (event.type === 'pane_closed') {
            update(state => {
              state.panes.delete(event.pane_id);
              state.terminalOutputs.delete(event.pane_id);
              return state;
            });
          }
        }),

        orchestratorClient.onEvent('pane_output', (event) => {
          if (event.type === 'pane_output') {
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

        orchestratorClient.onEvent('session_created', (event) => {
          if (event.type === 'session_created') {
            refreshSessions();
          }
        }),

        orchestratorClient.onEvent('session_closed', (event) => {
          if (event.type === 'session_closed') {
            update(state => {
              state.sessions = state.sessions.filter(s => s.id !== event.session_id);
              if (state.activeSessionId === event.session_id) {
                state.activeSessionId = state.sessions[0]?.id;
              }
              return state;
            });
          }
        }),

        orchestratorClient.onEvent('error', (event) => {
          if (event.type === 'error') {
            update(state => ({
              ...state,
              error: event.message
            }));
          }
        })
      );

      // Load initial data
      await refreshSessions();

    } catch (error) {
      console.error('Failed to initialize orchestrator store:', error);
      update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to initialize'
      }));
    }
  }

  // Refresh sessions and panes
  async function refreshSessions() {
    try {
      const sessions = await orchestratorClient.listSessions();
      
      // Get all panes for all sessions
      const allPanes = new Map<string, Pane>();
      for (const session of sessions) {
        const sessionInfo = await orchestratorClient.execute<Session>({
          type: 'get_session_info',
          session_id: session.id
        });
        
        // Note: We'll need to add a get_panes action or include panes in session info
        // For now, we'll use the pane IDs from the session
        for (const paneId of sessionInfo.panes) {
          // TODO: Add get_pane_info action to orchestrator
          // const pane = await orchestratorClient.getPaneInfo(paneId);
          // allPanes.set(paneId, pane);
        }
      }

      update(state => ({
        ...state,
        sessions,
        panes: allPanes,
        activeSessionId: state.activeSessionId || sessions[0]?.id,
        error: undefined
      }));
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
      update(state => ({
        ...state,
        error: error instanceof Error ? error.message : 'Failed to refresh sessions'
      }));
    }
  }

  // Actions
  async function createSession(name: string) {
    try {
      const session = await orchestratorClient.createSession(name);
      await refreshSessions();
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  async function createTerminal(sessionId?: string, options?: { title?: string; command?: string }) {
    try {
      const targetSessionId = sessionId || get(activeSession)?.id;
      if (!targetSessionId) {
        throw new Error('No active session');
      }

      const pane = await orchestratorClient.createPane(targetSessionId, {
        paneType: 'terminal',
        title: options?.title,
        command: options?.command,
      });

      await refreshSessions();
      return pane;
    } catch (error) {
      console.error('Failed to create terminal:', error);
      throw error;
    }
  }

  async function sendInput(paneId: string, input: string) {
    try {
      await orchestratorClient.sendInput(paneId, input);
    } catch (error) {
      console.error('Failed to send input:', error);
      throw error;
    }
  }

  async function closePane(paneId: string) {
    try {
      await orchestratorClient.closePane(paneId);
    } catch (error) {
      console.error('Failed to close pane:', error);
      throw error;
    }
  }

  async function setActivePane(paneId: string) {
    update(state => ({
      ...state,
      activePaneId: paneId
    }));
  }

  async function setActiveSession(sessionId: string) {
    update(state => ({
      ...state,
      activeSessionId: sessionId
    }));
  }

  // Clean up on destroy
  function destroy() {
    eventUnsubscribers.forEach(unsubscribe => unsubscribe());
    orchestratorClient.dispose();
  }

  // Initialize on creation
  init();

  return {
    subscribe,
    init,
    createSession,
    createTerminal,
    sendInput,
    closePane,
    setActivePane,
    setActiveSession,
    refreshSessions,
    destroy
  };
}

// ===== Derived Stores =====

export const orchestrator = createOrchestratorStore();

// Derived store for active session
export const activeSession = derived(
  orchestrator,
  $orchestrator => $orchestrator.sessions.find(s => s.id === $orchestrator.activeSessionId)
);

// Derived store for active pane
export const activePane = derived(
  orchestrator,
  $orchestrator => $orchestrator.activePaneId ? $orchestrator.panes.get($orchestrator.activePaneId) : undefined
);

// Derived store for terminal outputs
export const terminalOutputs = derived(
  orchestrator,
  $orchestrator => $orchestrator.terminalOutputs
);

// Utility function to get store value synchronously
function get<T>(store: { subscribe: (fn: (value: T) => void) => () => void }): T | undefined {
  let value: T | undefined;
  const unsubscribe = store.subscribe(v => value = v);
  unsubscribe();
  return value;
}