import { invoke } from '@tauri-apps/api/core';

export interface ModuleManifest {
  name: string;
  version: string;
  description: string;
  author: string;
  entry_point: string;
  module_type: 'agent' | 'command' | 'layout' | 'theme' | 'language' | 'tool';
  dependencies: ModuleDependency[];
  permissions: Permission[];
  config_schema?: any;
}

export interface ModuleDependency {
  name: string;
  version: string;
}

export type Permission = 
  | 'file_system'
  | 'network'
  | 'process'
  | 'terminal'
  | 'editor'
  | 'state';

export class ModuleClient {
  async scanModules(): Promise<string[]> {
    return await invoke('module_scan');
  }

  async listModules(): Promise<ModuleManifest[]> {
    return await invoke('module_list');
  }

  async enableModule(name: string, enabled: boolean): Promise<void> {
    return await invoke('module_enable', { name, enabled });
  }

  async executeCommand(
    moduleName: string,
    command: string,
    args: string[] = []
  ): Promise<string> {
    return await invoke('module_execute', { 
      moduleName, 
      command, 
      args 
    });
  }
}

export const moduleClient = new ModuleClient();