import { invoke } from '@tauri-apps/api/tauri';
import { listen, Event as TauriEvent } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';

// ===== Types matching Rust structures =====

export interface Session {
  id: string;
  name: string;
  panes: string[];
  active_pane?: string;
  created_at: string;
  updated_at: string;
}

export interface Pane {
  id: string;
  session_id: string;
  pane_type: PaneType;
  tmux_id?: string;
  title: string;
  working_dir?: string;
  command?: string;
  shell_type?: ShellType;
  custom_name?: string;
  created_at: string;
}

export type PaneType = 'terminal' | 'editor' | 'file_tree' | 'output' | { custom: string };

export type ShellType = 'bash' | 'zsh' | 'fish' | 'nushell' | 'sh' | { custom: string };

// ===== Actions (matching Rust Action enum) =====

export type Action = 
  // Terminal actions
  | { type: 'create_pane'; session_id: string; pane_type?: PaneType; title?: string; command?: string; shell?: ShellType }
  | { type: 'close_pane'; pane_id: string }
  | { type: 'send_input'; pane_id: string; data: string }
  | { type: 'resize_pane'; pane_id: string; width: number; height: number }
  | { type: 'get_output'; pane_id: string; lines?: number }
  | { type: 'rename_pane'; pane_id: string; name: string }
  | { type: 'list_terminal_history'; pane_id?: string; limit?: number }
  | { type: 'search_terminal_output'; pane_id: string; pattern: string; regex?: boolean }
  
  // Session actions
  | { type: 'create_session'; name: string }
  | { type: 'close_session'; session_id: string }
  | { type: 'rename_session'; session_id: string; name: string }
  | { type: 'list_sessions' }
  | { type: 'get_session_info'; session_id: string }
  
  // File actions
  | { type: 'create_file'; path: string; content?: string }
  | { type: 'read_file'; path: string }
  | { type: 'update_file'; path: string; content: string }
  | { type: 'delete_file'; path: string }
  | { type: 'rename_file'; old_path: string; new_path: string }
  | { type: 'create_directory'; path: string }
  | { type: 'delete_directory'; path: string }
  | { type: 'list_directory'; path: string }
  | { type: 'get_file_tree'; max_depth?: number }
  | { type: 'watch_path'; path: string }
  | { type: 'unwatch_path'; path: string }
  | { type: 'search_project'; query: string; case_sensitive?: boolean; whole_word?: boolean; regex?: boolean; file_pattern?: string }
  
  // Plugin actions
  | { type: 'list_plugins' }
  | { type: 'load_plugin'; id: string }
  | { type: 'unload_plugin'; id: string }
  | { type: 'plugin_command'; plugin_id: string; command: string; args?: any }
  
  // System actions
  | { type: 'get_system_info' };

// ===== Events (matching Rust Event enum) =====

export type OrchestratorEvent = 
  // Terminal events
  | { type: 'pane_created'; pane_id: string; session_id: string }
  | { type: 'pane_closed'; pane_id: string }
  | { type: 'pane_output'; pane_id: string; data: string }
  | { type: 'pane_resized'; pane_id: string; width: number; height: number }
  
  // Session events
  | { type: 'session_created'; session_id: string; name: string }
  | { type: 'session_closed'; session_id: string }
  | { type: 'session_renamed'; session_id: string; new_name: string }
  
  // File events
  | { type: 'file_created'; path: string }
  | { type: 'file_modified'; path: string }
  | { type: 'file_deleted'; path: string }
  | { type: 'file_renamed'; old_path: string; new_path: string }
  
  // Plugin events
  | { type: 'plugin_loaded'; plugin_id: string }
  | { type: 'plugin_unloaded'; plugin_id: string }
  | { type: 'plugin_event'; plugin_id: string; event_type: string; data?: any }
  
  // System events
  | { type: 'error'; message: string; source?: string };

// ===== Main Client Class =====

export class TauriOrchestratorClient {
  private eventListeners: Map<string, UnlistenFn> = new Map();
  private eventHandlers: Map<string, Set<(event: OrchestratorEvent) => void>> = new Map();

  // Execute an action through the orchestrator
  async execute<T = any>(action: Action): Promise<T> {
    try {
      return await invoke('orchestrator_execute', { action });
    } catch (error) {
      console.error('Orchestrator execution error:', error);
      throw error;
    }
  }

  // Subscribe to orchestrator events
  async subscribe(eventTypes: string[]): Promise<void> {
    // First, tell the backend we want to subscribe
    await invoke('orchestrator_subscribe', { events: eventTypes });
    
    // Then set up Tauri event listeners for each event type
    for (const eventType of eventTypes) {
      if (this.eventListeners.has(eventType)) {
        continue; // Already subscribed
      }

      const unlisten = await listen<OrchestratorEvent>(`orchestrator:${eventType}`, (event: TauriEvent<OrchestratorEvent>) => {
        const handlers = this.eventHandlers.get(eventType);
        if (handlers) {
          handlers.forEach(handler => handler(event.payload));
        }
      });

      this.eventListeners.set(eventType, unlisten);
    }
  }

  // Add event handler
  onEvent(eventType: string, handler: (event: OrchestratorEvent) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    this.eventHandlers.get(eventType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
          // Also unsubscribe from Tauri events if no handlers left
          const unlisten = this.eventListeners.get(eventType);
          if (unlisten) {
            unlisten();
            this.eventListeners.delete(eventType);
          }
        }
      }
    };
  }

  // Convenience methods for common actions

  async createSession(name: string): Promise<Session> {
    return this.execute({ type: 'create_session', name });
  }

  async listSessions(): Promise<Session[]> {
    return this.execute({ type: 'list_sessions' });
  }

  async createPane(sessionId: string, options?: { 
    paneType?: PaneType; 
    title?: string; 
    command?: string;
    shell?: ShellType;
  }): Promise<Pane> {
    return this.execute({
      type: 'create_pane',
      session_id: sessionId,
      pane_type: options?.paneType,
      title: options?.title,
      command: options?.command,
      shell: options?.shell,
    });
  }

  async sendInput(paneId: string, data: string): Promise<void> {
    return this.execute({ type: 'send_input', pane_id: paneId, data });
  }

  async closePane(paneId: string): Promise<void> {
    return this.execute({ type: 'close_pane', pane_id: paneId });
  }

  async getOutput(paneId: string, lines?: number): Promise<string> {
    return this.execute({ type: 'get_output', pane_id: paneId, lines });
  }

  async listPlugins(): Promise<any[]> {
    return this.execute({ type: 'list_plugins' });
  }

  async loadPlugin(pluginId: string): Promise<void> {
    return this.execute({ type: 'load_plugin', id: pluginId });
  }

  async executePluginCommand(pluginId: string, command: string, args?: any): Promise<any> {
    return this.execute({ 
      type: 'plugin_command', 
      plugin_id: pluginId, 
      command, 
      args 
    });
  }

  async searchProject(query: string, options?: {
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
    filePattern?: string;
  }): Promise<any> {
    return this.execute({
      type: 'search_project',
      query,
      case_sensitive: options?.caseSensitive,
      whole_word: options?.wholeWord,
      regex: options?.regex,
      file_pattern: options?.filePattern,
    });
  }

  async getFileTree(maxDepth?: number): Promise<any> {
    return this.execute({ type: 'get_file_tree', max_depth: maxDepth });
  }

  async watchPath(path: string): Promise<void> {
    return this.execute({ type: 'watch_path', path });
  }

  async unwatchPath(path: string): Promise<void> {
    return this.execute({ type: 'unwatch_path', path });
  }

  // Clean up all event listeners
  dispose(): void {
    this.eventListeners.forEach(unlisten => unlisten());
    this.eventListeners.clear();
    this.eventHandlers.clear();
  }
}

// Export singleton instance
export const orchestratorClient = new TauriOrchestratorClient();