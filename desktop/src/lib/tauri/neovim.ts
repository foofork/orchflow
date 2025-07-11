import { invoke } from '@tauri-apps/api/core';

export interface NeovimBuffer {
  id: number;
  name: string;
  filetype: string;
  modified: boolean;
  lines: string[];
}

export interface NeovimCursor {
  line: number;
  column: number;
}

export class NeovimClient {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  static async create(id?: string): Promise<NeovimClient> {
    const instanceId = id || `nvim-${Date.now()}`;
    await invoke('nvim_create_instance', { id: instanceId });
    return new NeovimClient(instanceId);
  }

  async openFile(filepath: string): Promise<void> {
    return await invoke('nvim_open_file', { 
      id: this.instanceId, 
      filepath 
    });
  }

  async getBuffer(): Promise<NeovimBuffer> {
    return await invoke('nvim_get_buffer', { 
      id: this.instanceId 
    });
  }

  async setBufferContent(content: string): Promise<void> {
    return await invoke('nvim_set_buffer_content', { 
      id: this.instanceId, 
      content 
    });
  }

  async executeCommand(command: string): Promise<string> {
    return await invoke('nvim_execute_command', { 
      id: this.instanceId, 
      command 
    });
  }

  async close(): Promise<void> {
    return await invoke('nvim_close_instance', { 
      id: this.instanceId 
    });
  }

  // Helper methods
  async save(): Promise<string> {
    return await this.executeCommand('w');
  }

  async saveAs(filepath: string): Promise<string> {
    return await this.executeCommand(`w ${filepath}`);
  }

  async undo(): Promise<string> {
    return await this.executeCommand('undo');
  }

  async redo(): Promise<string> {
    return await this.executeCommand('redo');
  }

  async search(pattern: string): Promise<string> {
    return await this.executeCommand(`/${pattern}`);
  }

  async replace(pattern: string, replacement: string, flags: string = 'g'): Promise<string> {
    return await this.executeCommand(`%s/${pattern}/${replacement}/${flags}`);
  }
  
  async getMode(): Promise<string> {
    return await invoke('nvim_get_mode', { id: this.instanceId });
  }
  
  async eval(expression: string): Promise<any> {
    return await invoke('nvim_eval', { id: this.instanceId, expression });
  }
  
  async getBufferContent(): Promise<string> {
    const buffer = await this.getBuffer();
    return buffer.lines.join('\n');
  }
}