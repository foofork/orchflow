import { invoke } from '@tauri-apps/api/core';

export interface PaneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PaneLayout {
  id: string;
  parent_id: string | null;
  split_type: 'Horizontal' | 'Vertical' | null;
  split_percent: number | null;
  pane_id: string | null; // tmux pane ID
  children: string[];
  bounds: PaneBounds;
}

export interface GridLayout {
  session_id: string;
  root_id: string;
  active_pane_id: string | null;
  panes: Record<string, PaneLayout>;
}

export class LayoutClient {
  async createLayout(sessionId: string): Promise<GridLayout> {
    // Create a session with a default layout using unified state commands
    const session = await invoke('create_session', { name: sessionId });
    return await invoke('get_unified_layout', { sessionId });
  }

  async getLayout(sessionId: string): Promise<GridLayout> {
    return await invoke('get_unified_layout', { sessionId });
  }

  async splitPane(
    sessionId: string,
    paneId: string,
    horizontal: boolean,
    percent?: number,
    command?: string
  ): Promise<[string, string]> {
    return await invoke('split_unified_layout_pane', {
      sessionId,
      paneId,
      horizontal,
      percent,
      command
    });
  }

  async closePane(sessionId: string, paneId: string): Promise<void> {
    return await invoke('close_unified_layout_pane', { sessionId, paneId });
  }

  async resizePane(sessionId: string, paneId: string, newPercent: number): Promise<void> {
    return await invoke('resize_unified_layout_pane', { sessionId, paneId, newPercent });
  }

  async getLeafPanes(sessionId: string): Promise<PaneLayout[]> {
    return await invoke('get_unified_layout_leaf_panes', { sessionId });
  }
}

export const layoutClient = new LayoutClient();