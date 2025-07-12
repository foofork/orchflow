import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { withTimeout, withRetry, exponentialBackoff, TIMEOUT_CONFIG } from '$lib/utils/timeout';

// ===== Types matching Rust structures =====

export interface Session {
  id: string;
  name: string;
  panes: string[];
  layout?: any;
  created_at: string;
  updated_at: string;
}

export interface Pane {
  id: string;
  session_id: string;
  pane_type: PaneType;
  backend_id?: string;
  title?: string;
  rows: number;
  cols: number;
  x: number;
  y: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type PaneType = 'Terminal' | 'Editor' | 'FileExplorer' | 'Output' | { Custom: string };

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  author?: string;
  description?: string;
  capabilities: string[];
  loaded: boolean;
}

export interface PluginMetadata {
  name: string;
  version: string;
  author?: string;
  description?: string;
  capabilities: string[];
}

export interface CommandHistoryEntry {
  id: string;
  command: string;
  pane_id?: string;
  session_id?: string;
  timestamp: string;
  exit_code?: number;
  output?: string;
}

// ===== Actions (matching Rust Action enum) =====

export type Action = 
  // Session management
  | { type: 'CreateSession'; name: string }
  | { type: 'DeleteSession'; session_id: string }
  | { type: 'SaveSession'; session_id: string; name?: string }
  
  // Pane management
  | { type: 'CreatePane'; session_id: string; pane_type?: PaneType; command?: string; shell_type?: string; name?: string }
  | { type: 'ClosePane'; pane_id: string }
  | { type: 'ResizePane'; pane_id: string; width: number; height: number }
  | { type: 'RenamePane'; pane_id: string; name: string }
  
  // Terminal operations
  | { type: 'SendInput'; pane_id: string; data: string }
  | { type: 'SendKeys'; pane_id: string; keys: string }
  | { type: 'RunCommand'; pane_id: string; command: string }
  | { type: 'GetPaneOutput'; pane_id: string; lines?: number }
  | { type: 'ClearPane'; pane_id: string }
  
  // File operations
  | { type: 'CreateFile'; path: string; content?: string }
  | { type: 'OpenFile'; path: string }
  | { type: 'SaveFile'; path: string; content: string }
  | { type: 'CreateDirectory'; path: string }
  | { type: 'DeletePath'; path: string; permanent?: boolean }
  | { type: 'RenamePath'; old_path: string; new_name: string }
  | { type: 'CopyPath'; source: string; destination: string }
  | { type: 'MovePath'; source: string; destination: string }
  | { type: 'MoveFiles'; files: string[]; destination: string }
  | { type: 'CopyFiles'; files: string[]; destination: string }
  
  // Search operations
  | { type: 'SearchProject'; query: string; options?: SearchOptions }
  | { type: 'SearchInFile'; path: string; query: string; options?: SearchOptions }
  | { type: 'ReplaceInFile'; path: string; search: string; replace: string; options?: SearchOptions }
  
  // Plugin management
  | { type: 'LoadPlugin'; id: string; config?: any }
  | { type: 'UnloadPlugin'; id: string }
  | { type: 'ExecutePluginCommand'; plugin_id: string; command: string; args?: any }
  
  // Terminal streaming
  | { type: 'CreateStreamingTerminal'; terminal_id: string; shell?: string; rows?: number; cols?: number }
  | { type: 'ResizeStreamingTerminal'; terminal_id: string; rows: number; cols: number }
  | { type: 'StopStreamingTerminal'; terminal_id: string };

export interface SearchOptions {
  case_sensitive?: boolean;
  whole_word?: boolean;
  regex?: boolean;
  include_hidden?: boolean;
  file_pattern?: string;
  exclude_pattern?: string;
  max_results?: number;
}

// ===== Events =====

export type ManagerEvent = 
  // Session events
  | { type: 'SessionCreated'; session_id: string; name: string }
  | { type: 'SessionDeleted'; session_id: string }
  | { type: 'SessionRenamed'; session_id: string; new_name: string }
  
  // Pane events  
  | { type: 'PaneCreated'; pane_id: string; session_id: string }
  | { type: 'PaneClosed'; pane_id: string }
  | { type: 'PaneResized'; pane_id: string; width: number; height: number }
  | { type: 'PaneFocused'; pane_id: string }
  | { type: 'PaneOutput'; pane_id: string; data: string }
  
  // File events
  | { type: 'FileCreated'; path: string }
  | { type: 'FileModified'; path: string }
  | { type: 'FileDeleted'; path: string }
  | { type: 'FileRenamed'; old_path: string; new_path: string }
  | { type: 'FileSaved'; path: string }
  | { type: 'FileRead'; path: string; size: number }
  
  // File watch events
  | { type: 'FileWatchStarted'; path: string; recursive: boolean }
  | { type: 'FileWatchStopped'; path: string }
  | { type: 'FileChanged'; path: string; change_type: string }
  
  // Plugin events
  | { type: 'PluginLoaded'; plugin_id: string }
  | { type: 'PluginUnloaded'; plugin_id: string }
  | { type: 'PluginEvent'; plugin_id: string; event_type: string; data?: any }
  
  // Custom events
  | { type: 'Custom'; event_type: string; data?: any };

// ===== Manager Client =====

export class ManagerClient {
  private eventListeners: Map<string, UnlistenFn[]> = new Map();
  private eventHandlers: Map<string, Set<(event: ManagerEvent) => void>> = new Map();
  
  // Use centralized timeout utility for all Tauri calls

  // Execute an action
  async execute<T = any>(action: Action): Promise<T> {
    try {
      return await withTimeout(
        invoke('manager_execute', { action }),
        TIMEOUT_CONFIG.TAURI_API,
        `Manager execute action ${action.type} timed out`
      );
    } catch (error) {
      console.error('Manager execution error:', error);
      throw error;
    }
  }

  // Subscribe to events (uses WebSocket on port 50505)
  async subscribe(eventTypes: string[]): Promise<void> {
    return await withTimeout(
      invoke('manager_subscribe', { eventTypes }),
      TIMEOUT_CONFIG.TAURI_API,
      'Manager subscribe timed out'
    );
  }

  // Direct command invocations

  async getSessions(): Promise<Session[]> {
    return await withTimeout(
      invoke('get_sessions'),
      TIMEOUT_CONFIG.TAURI_API,
      'Get sessions timed out'
    );
  }

  async getSession(sessionId: string): Promise<Session> {
    return await withTimeout(
      invoke('get_session', { session_id: sessionId }),
      TIMEOUT_CONFIG.TAURI_API,
      'Get session timed out'
    );
  }

  async getPanes(sessionId: string): Promise<Pane[]> {
    return await invoke('get_panes', { session_id: sessionId });
  }

  async getPane(paneId: string): Promise<Pane> {
    return await invoke('get_pane', { pane_id: paneId });
  }

  async selectBackendPane(paneId: string): Promise<void> {
    await invoke('select_backend_pane', { pane_id: paneId });
  }

  async listPlugins(): Promise<PluginInfo[]> {
    return await invoke('list_plugins');
  }

  async getPluginMetadata(pluginId: string): Promise<PluginMetadata> {
    return await invoke('get_plugin_metadata', { plugin_id: pluginId });
  }

  async persistState(): Promise<void> {
    await invoke('persist_state');
  }

  async getCommandHistory(paneId?: string, limit?: number): Promise<CommandHistoryEntry[]> {
    return await invoke('get_command_history', { pane_id: paneId, limit });
  }

  async searchCommandHistory(pattern: string, paneId?: string): Promise<CommandHistoryEntry[]> {
    return await invoke('search_command_history', { pattern, pane_id: paneId });
  }

  async listDirectory(path: string): Promise<any> {
    return await invoke('list_directory', { path });
  }

  async readFile(path: string): Promise<string> {
    return await invoke('read_file', { path });
  }

  async saveFile(path: string, content: string): Promise<void> {
    await invoke('save_file', { path, content });
  }

  async watchFile(path: string, recursive: boolean = false): Promise<void> {
    await invoke('watch_file', { path, recursive });
  }

  async unwatchFile(path: string): Promise<void> {
    await invoke('unwatch_file', { path });
  }

  // Convenience methods using actions

  async createSession(name: string): Promise<Session> {
    const result = await this.execute({ type: 'CreateSession', name });
    return result.session;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.execute({ type: 'DeleteSession', session_id: sessionId });
  }

  async createPane(sessionId: string, options?: {
    paneType?: PaneType;
    command?: string;
    shellType?: string;
    name?: string;
  }): Promise<Pane> {
    const result = await this.execute({
      type: 'CreatePane',
      session_id: sessionId,
      pane_type: options?.paneType,
      command: options?.command,
      shell_type: options?.shellType,
      name: options?.name
    });
    return result.pane;
  }

  async closePane(paneId: string): Promise<void> {
    await this.execute({ type: 'ClosePane', pane_id: paneId });
  }

  async sendInput(paneId: string, data: string): Promise<void> {
    await this.execute({ type: 'SendInput', pane_id: paneId, data });
  }

  async sendKeys(paneId: string, keys: string): Promise<void> {
    await this.execute({ type: 'SendKeys', pane_id: paneId, keys });
  }

  async getPaneOutput(paneId: string, lines?: number): Promise<string> {
    const result = await this.execute({ type: 'GetPaneOutput', pane_id: paneId, lines });
    return result.output;
  }

  async loadPlugin(pluginId: string, config?: any): Promise<void> {
    await this.execute({ type: 'LoadPlugin', id: pluginId, config });
  }

  async unloadPlugin(pluginId: string): Promise<void> {
    await this.execute({ type: 'UnloadPlugin', id: pluginId });
  }

  async searchProject(query: string, options?: SearchOptions): Promise<any> {
    const result = await this.execute({ type: 'SearchProject', query, options });
    return result.results;
  }

  // Event handling

  onEvent(eventType: string, handler: (event: ManagerEvent) => void): () => void {
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
        }
      }
    };
  }

  // WebSocket connection for real-time events
  private connectionRetries = 0;
  private readonly MAX_WS_RETRIES = 5;
  private wsConnectionTimeout?: number;
  
  async connectWebSocket(): Promise<void> {
    // Clear any existing connection timeout
    if (this.wsConnectionTimeout) {
      clearTimeout(this.wsConnectionTimeout);
    }
    
    const ws = new WebSocket('ws://localhost:50505');
    let connectionEstablished = false;
    
    // Set connection timeout
    this.wsConnectionTimeout = setTimeout(() => {
      if (!connectionEstablished) {
        ws.close();
        console.error('WebSocket connection timed out');
        this.handleConnectionFailure();
      }
    }, TIMEOUT_CONFIG.WEBSOCKET_CONNECT) as unknown as number;
    
    ws.onopen = () => {
      connectionEstablished = true;
      if (this.wsConnectionTimeout) {
        clearTimeout(this.wsConnectionTimeout);
      }
      this.connectionRetries = 0; // Reset on successful connection
      console.log('Connected to Manager WebSocket');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event) {
          this.handleEvent(data.event);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleConnectionFailure();
    };

    ws.onclose = () => {
      connectionEstablished = false;
      console.log('WebSocket connection closed');
      this.handleConnectionFailure();
    };
  }
  
  private handleConnectionFailure(): void {
    if (this.connectionRetries < this.MAX_WS_RETRIES) {
      this.connectionRetries++;
      const backoffMs = exponentialBackoff(this.connectionRetries - 1, 1000, TIMEOUT_CONFIG.RETRY_BACKOFF_MAX);
      console.log(`Reconnecting WebSocket in ${backoffMs}ms (attempt ${this.connectionRetries}/${this.MAX_WS_RETRIES})`);
      setTimeout(() => this.connectWebSocket(), backoffMs);
    } else {
      console.error('Max WebSocket reconnection attempts reached. Giving up.');
    }
  }

  private handleEvent(event: ManagerEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => handler(event));
    }
  }

  // Cleanup
  dispose(): void {
    if (this.wsConnectionTimeout) {
      clearTimeout(this.wsConnectionTimeout);
    }
    this.eventListeners.forEach(listeners => listeners.forEach(unlisten => unlisten()));
    this.eventListeners.clear();
    this.eventHandlers.clear();
  }
}

// Export singleton instance
export const managerClient = new ManagerClient();