import { invoke } from '@tauri-apps/api/core';

export interface Session {
  id: string;
  name: string;
  tmux_session: string | null;
  created_at: string;
  last_active: string;
  metadata: string | null;
}

export interface Pane {
  id: string;
  session_id: string;
  tmux_pane: string | null;
  pane_type: string;
  content: string | null;
  metadata: string | null;
  created_at: string;
}

export interface Layout {
  id: string;
  session_id: string;
  name: string;
  layout_data: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Module {
  name: string;
  version: string;
  manifest: string;
  installed_at: string;
  updated_at: string;
}

export class StateStoreClient {
  // Session methods
  async createSession(name: string, tmuxSession?: string): Promise<Session> {
    return await invoke('db_create_session', { name, tmuxSession });
  }

  async getSession(id: string): Promise<Session | null> {
    return await invoke('db_get_session', { id });
  }

  async listSessions(): Promise<Session[]> {
    return await invoke('db_list_sessions');
  }

  async updateSessionActivity(id: string): Promise<void> {
    return await invoke('db_update_session_activity', { id });
  }

  // Layout methods
  async saveLayout(sessionId: string, name: string, layoutData: any): Promise<Layout> {
    return await invoke('db_save_layout', { sessionId, name, layoutData });
  }

  async getActiveLayout(sessionId: string): Promise<Layout | null> {
    return await invoke('db_get_active_layout', { sessionId });
  }

  async listLayouts(sessionId: string): Promise<Layout[]> {
    return await invoke('db_list_layouts', { sessionId });
  }

  // Pane methods
  async savePane(sessionId: string, tmuxPane: string | null, paneType: string): Promise<Pane> {
    return await invoke('db_save_pane', { sessionId, tmuxPane, paneType });
  }

  async updatePaneContent(id: string, content: string): Promise<void> {
    return await invoke('db_update_pane_content', { id, content });
  }

  // Module methods
  async installModule(name: string, version: string, manifest: any): Promise<Module> {
    return await invoke('db_install_module', { name, version, manifest });
  }

  async listModules(): Promise<Module[]> {
    return await invoke('db_list_modules');
  }

  // Settings methods
  async setSetting(key: string, value: string): Promise<void> {
    return await invoke('db_set_setting', { key, value });
  }

  async getSetting(key: string): Promise<string | null> {
    return await invoke('db_get_setting', { key });
  }
}

export const stateStore = new StateStoreClient();