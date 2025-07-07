import { EventEmitter } from 'events';
import path from 'path';
import { ModuleLoader, ModuleLoaderEvent, LoadedModule } from './module-loader';

/**
 * ModuleManager integrates the module loader with the orchestrator
 * Provides high-level module management functionality
 */
export class ModuleManager extends EventEmitter {
  private loader: ModuleLoader;
  private modulesPath: string;
  private config: Record<string, any> = {};
  private isInitialized = false;

  constructor(eventBus: EventEmitter, modulesPath?: string) {
    super();
    
    // Default to modules directory relative to project root
    this.modulesPath = modulesPath || path.join(process.cwd(), 'modules');
    this.loader = new ModuleLoader(this.modulesPath, eventBus);
    
    // Forward loader events
    this.loader.on(ModuleLoaderEvent.ModuleLoaded, (data) => {
      this.emit('module:loaded', data);
    });
    
    this.loader.on(ModuleLoaderEvent.ModuleUnloaded, (data) => {
      this.emit('module:unloaded', data);
    });
    
    this.loader.on(ModuleLoaderEvent.ModuleError, (data) => {
      this.emit('module:error', data);
    });
    
    this.loader.on(ModuleLoaderEvent.CommandRegistered, (data) => {
      this.emit('command:registered', data);
    });
  }

  /**
   * Initialize the module manager and load all modules
   */
  async initialize(config?: Record<string, any>): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (config) {
      this.config = config;
      this.loader.setConfig(config);
    }

    try {
      await this.loader.loadAllModules();
      this.isInitialized = true;
      this.emit('initialized', {
        modulesLoaded: this.loader.getLoadedModules().length
      });
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Hot reload a module
   */
  async reloadModule(moduleId: string): Promise<boolean> {
    const module = this.loader.getModule(moduleId);
    if (!module) {
      return false;
    }

    // Find module directory name
    const modules = await this.loader.discoverModules();
    const moduleDirName = modules.find(dir => {
      const mod = this.loader.getModule(moduleId);
      return mod && mod.path.endsWith(dir);
    });

    if (!moduleDirName) {
      return false;
    }

    // Unload and reload
    await this.loader.unloadModule(moduleId);
    const reloaded = await this.loader.loadModule(moduleDirName);
    
    return reloaded !== null;
  }

  /**
   * Execute a module command
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    return this.loader.executeCommand(command, args);
  }

  /**
   * Get layout modules for the layout manager
   */
  getLayoutModules(): LoadedModule[] {
    return this.loader.getModulesByType('layout');
  }

  /**
   * Get agent modules for the agent manager
   */
  getAgentModules(): LoadedModule[] {
    return this.loader.getModulesByType('agent');
  }

  /**
   * Get all available commands
   */
  getAvailableCommands(): Array<{
    name: string;
    moduleId: string;
    description?: string;
  }> {
    const commands = this.loader.getCommands();
    const result: Array<{
      name: string;
      moduleId: string;
      description?: string;
    }> = [];

    for (const [name, info] of commands) {
      result.push({
        name,
        moduleId: info.moduleId,
        description: info.description
      });
    }

    return result;
  }

  /**
   * Check if a module is loaded
   */
  isModuleLoaded(moduleId: string): boolean {
    return this.loader.getModule(moduleId) !== undefined;
  }

  /**
   * Get module info
   */
  getModuleInfo(moduleId: string): {
    name: string;
    version: string;
    description: string;
    type: string;
    permissions: string[];
  } | null {
    const module = this.loader.getModule(moduleId);
    if (!module) {
      return null;
    }

    return {
      name: module.manifest.name,
      version: module.manifest.version,
      description: module.manifest.description,
      type: module.manifest.module_type,
      permissions: module.manifest.permissions || []
    };
  }

  /**
   * List all loaded modules
   */
  listModules(): Array<{
    id: string;
    name: string;
    version: string;
    type: string;
    isLoaded: boolean;
  }> {
    return this.loader.getLoadedModules().map(module => ({
      id: module.manifest.name,
      name: module.manifest.name,
      version: module.manifest.version,
      type: module.manifest.module_type,
      isLoaded: module.isLoaded
    }));
  }

  /**
   * Install a new module (placeholder for future npm/git integration)
   */
  async installModule(source: string): Promise<void> {
    // TODO: Implement module installation from npm, git, or local path
    throw new Error('Module installation not yet implemented');
  }

  /**
   * Uninstall a module (placeholder)
   */
  async uninstallModule(moduleId: string): Promise<void> {
    // TODO: Implement module removal from filesystem
    await this.loader.unloadModule(moduleId);
  }

  /**
   * Get module configuration schema
   */
  getModuleConfigSchema(moduleId: string): Record<string, any> | null {
    const module = this.loader.getModule(moduleId);
    if (!module) {
      return null;
    }

    return module.manifest.config_schema || null;
  }

  /**
   * Update module configuration
   */
  async updateModuleConfig(moduleId: string, config: Record<string, any>): Promise<void> {
    this.config[moduleId] = config;
    this.loader.setConfig(this.config);
    
    // Reload module to apply new config
    await this.reloadModule(moduleId);
  }

  /**
   * Enable developer mode for a module (watches for changes)
   */
  async enableDevMode(moduleId: string): Promise<void> {
    // TODO: Implement file watching and auto-reload
    console.log(`Developer mode for ${moduleId} not yet implemented`);
  }

  /**
   * Get module loader instance (for advanced usage)
   */
  getLoader(): ModuleLoader {
    return this.loader;
  }
}