import { invoke } from '@tauri-apps/api/core';

export interface TmuxSession {
  name: string;
  windows: TmuxWindow[];
  created: string;
  attached: boolean;
}

export interface TmuxWindow {
  id: string;
  name: string;
  panes: TmuxPane[];
  active: boolean;
}

export interface TmuxPane {
  id: string;
  index: number;
  width: number;
  height: number;
  command: string;
  active: boolean;
}

export class TmuxClient {
  async createSession(name: string): Promise<TmuxSession> {
    return await invoke('tmux_create_session', { name });
  }

  async listSessions(): Promise<TmuxSession[]> {
    return await invoke('tmux_list_sessions');
  }

  async createPane(session: string, command?: string): Promise<TmuxPane> {
    return await invoke('tmux_create_pane', { session, command });
  }

  async sendKeys(paneId: string, keys: string): Promise<void> {
    return await invoke('tmux_send_keys', { paneId, keys });
  }

  async capturePane(paneId: string, lines?: number): Promise<string> {
    return await invoke('tmux_capture_pane', { paneId, lines });
  }

  async resizePane(paneId: string, width: number, height: number): Promise<void> {
    return await invoke('tmux_resize_pane', { paneId, width, height });
  }

  async killPane(paneId: string): Promise<void> {
    return await invoke('tmux_kill_pane', { paneId });
  }
}

export const tmux = new TmuxClient();