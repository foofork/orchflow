// Terminal IPC Service
// Handles communication with the Rust backend for terminal streaming

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn, emit } from '@tauri-apps/api/event';
import { writable, type Writable } from 'svelte/store';
import { parseMuxdTimestamp } from '$lib/utils/timestamp';

export interface TerminalMetadata {
  id: string;
  title: string;
  shell: string;
  rows: number;
  cols: number;
  created_at: string;
  last_activity: string;
  process_id?: number;
}

export interface TerminalState {
  id: string;
  rows: number;
  cols: number;
  cursor: {
    x: number;
    y: number;
    visible: boolean;
    blinking: boolean;
  };
  mode: 'normal' | 'insert' | 'visual' | 'command' | 'search' | 'raw';
  title: string;
  working_dir?: string;
  process_info?: ProcessInfo;
  active: boolean;
  last_activity: string;
}

export interface ProcessInfo {
  pid: number;
  name: string;
  command: string;
  status: ProcessStatus;
}

export type ProcessStatus = 
  | { Running: null }
  | { Exited: number }
  | { Crashed: null };

export interface TerminalHealth {
  terminal_id: string;
  status: HealthStatus;
  process_info: ProcessInfo;
  last_activity: string;
  uptime_seconds: number;
}

export type HealthStatus =
  | { type: 'Healthy' }
  | { type: 'Unhealthy'; message: string }
  | { type: 'Stopped' };

export interface TerminalEvent {
  type: 'output' | 'exit' | 'error' | 'state';
  data: {
    terminal_id: string;
    data?: string;
    code?: number;
    error?: string;
    state?: TerminalState;
  };
}

export interface CreateTerminalOptions {
  terminalId: string;
  shell?: string;
  rows?: number;
  cols?: number;
  cwd?: string;
  env?: Record<string, string>;
}

class TerminalIPCService {
  private terminals: Map<string, TerminalMetadata> = new Map();
  private listeners: Map<string, UnlistenFn[]> = new Map();
  private terminalStates: Writable<Map<string, TerminalState>> = writable(new Map());

  async createTerminal(options: CreateTerminalOptions): Promise<TerminalMetadata> {
    try {
      const metadata = await invoke<TerminalMetadata>('create_streaming_terminal', {
        terminal_id: options.terminalId,
        shell: options.shell,
        rows: options.rows || 24,
        cols: options.cols || 80,
        cwd: options.cwd,
        env: options.env
      });
      
      // Parse timestamps from backend response
      if (metadata.created_at) {
        const parsedDate = parseMuxdTimestamp(metadata.created_at);
        if (parsedDate) {
          metadata.created_at = parsedDate.toISOString();
        }
      }
      if (metadata.last_activity) {
        const parsedDate = parseMuxdTimestamp(metadata.last_activity);
        if (parsedDate) {
          metadata.last_activity = parsedDate.toISOString();
        }
      }
      
      this.terminals.set(options.terminalId, metadata);
      return metadata;
    } catch (error) {
      throw new Error(`Failed to create terminal: ${error}`);
    }
  }

  async sendInput(terminalId: string, data: string): Promise<void> {
    return invoke('send_terminal_input', {
      terminal_id: terminalId,
      input_type: 'text',
      data
    });
  }

  async sendKey(terminalId: string, key: string, modifiers: string[] = []): Promise<void> {
    return invoke('send_terminal_key', {
      terminal_id: terminalId,
      key,
      modifiers
    });
  }

  async resize(terminalId: string, rows: number, cols: number): Promise<void> {
    return invoke('resize_streaming_terminal', {
      terminal_id: terminalId,
      rows,
      cols
    });
  }

  async clearScrollback(terminalId: string): Promise<void> {
    return invoke('clear_terminal_scrollback', {
      terminal_id: terminalId
    });
  }

  async stopTerminal(terminalId: string): Promise<void> {
    await invoke('stop_streaming_terminal', { terminal_id: terminalId });
    this.terminals.delete(terminalId);
    
    // Clean up listeners
    const listeners = this.listeners.get(terminalId);
    if (listeners) {
      listeners.forEach(unlisten => unlisten());
      this.listeners.delete(terminalId);
    }
  }

  async getState(terminalId: string): Promise<TerminalState | null> {
    try {
      const state = await invoke<TerminalState>('get_terminal_state', { terminal_id: terminalId });
      
      // Parse timestamp from backend response
      if (state && state.last_activity) {
        const parsedDate = parseMuxdTimestamp(state.last_activity);
        if (parsedDate) {
          state.last_activity = parsedDate.toISOString();
        }
      }
      
      return state;
    } catch {
      return null;
    }
  }

  async broadcastInput(terminalIds: string[], data: string): Promise<Map<string, boolean>> {
    const results = await invoke<Array<[string, boolean]>>('broadcast_terminal_input', {
      terminal_ids: terminalIds,
      input_type: 'text',
      data
    });
    
    return new Map(results);
  }
  
  async getProcessInfo(terminalId: string): Promise<ProcessInfo> {
    return invoke<ProcessInfo>('get_terminal_process_info', {
      terminal_id: terminalId
    });
  }
  
  async getHealth(terminalId: string): Promise<TerminalHealth> {
    const health = await invoke<TerminalHealth>('monitor_terminal_health', {
      terminal_id: terminalId
    });
    
    // Parse timestamp from backend response
    if (health && health.last_activity) {
      const parsedDate = parseMuxdTimestamp(health.last_activity);
      if (parsedDate) {
        health.last_activity = parsedDate.toISOString();
      }
    }
    
    return health;
  }
  
  async restartTerminal(terminalId: string): Promise<void> {
    return invoke('restart_terminal_process', {
      terminal_id: terminalId
    });
  }

  subscribeToTerminal(
    terminalId: string,
    handlers: {
      onOutput?: (data: string) => void;
      onExit?: (code?: number) => void;
      onError?: (error: string) => void;
      onStateChange?: (state: TerminalState) => void;
    }
  ): () => void {
    const listeners: UnlistenFn[] = [];

    // Output handler
    if (handlers.onOutput) {
      listen('terminal:output', (event: any) => {
        const payload = event.payload;
        if (payload.terminal_id === terminalId && payload.data) {
          // Decode base64
          const decoded = atob(payload.data);
          handlers.onOutput!(decoded);
        }
      }).then(unlisten => listeners.push(unlisten));
    }

    // Exit handler
    if (handlers.onExit) {
      listen('terminal:exit', (event: any) => {
        const payload = event.payload;
        if (payload.terminal_id === terminalId) {
          handlers.onExit!(payload.code);
        }
      }).then(unlisten => listeners.push(unlisten));
    }

    // Error handler
    if (handlers.onError) {
      listen('terminal:error', (event: any) => {
        const payload = event.payload;
        if (payload.terminal_id === terminalId && payload.error) {
          handlers.onError!(payload.error);
        }
      }).then(unlisten => listeners.push(unlisten));
    }

    // State change handler
    if (handlers.onStateChange) {
      listen('terminal:state', (event: any) => {
        const payload = event.payload;
        if (payload.terminal_id === terminalId && payload.state) {
          const state = payload.state;
          
          // Parse timestamp from backend response
          if (state.last_activity) {
            const parsedDate = parseMuxdTimestamp(state.last_activity);
            if (parsedDate) {
              state.last_activity = parsedDate.toISOString();
            }
          }
          
          handlers.onStateChange!(state);
          
          // Update store
          this.terminalStates.update(states => {
            states.set(terminalId, state);
            return states;
          });
        }
      }).then(unlisten => listeners.push(unlisten));
    }

    // Store listeners for cleanup
    const existingListeners = this.listeners.get(terminalId) || [];
    this.listeners.set(terminalId, [...existingListeners, ...listeners]);

    // Return unsubscribe function
    return () => {
      listeners.forEach(unlisten => unlisten());
    };
  }

  getTerminals(): Map<string, TerminalMetadata> {
    return this.terminals;
  }

  getStatesStore(): Writable<Map<string, TerminalState>> {
    return this.terminalStates;
  }
}

// Export singleton instance
export const terminalIPC = new TerminalIPCService();