import { promises as fs } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import { z } from 'zod';

// Module manifest schema
const ManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  author: z.string(),
  entry_point: z.string(),
  module_type: z.enum(['layout', 'agent', 'tool', 'provider']),
  dependencies: z.array(z.string()).optional().default([]),
  permissions: z.array(z.string()).optional().default([]),
  config_schema: z.record(z.any()).optional()
});

type Manifest = z.infer<typeof ManifestSchema>;

// Module context provided to modules during init
export interface ModuleContext {
  moduleId: string;
  config: Record<string, any>;
  logger: (level: string, message: string) => void;
  eventBus: EventEmitter;
  permissions: string[];
  rootPath: string;
}

// Loaded module interface
export interface LoadedModule {
  manifest: Manifest;
  instance: any;
  path: string;
  context: ModuleContext;
  isLoaded: boolean;
}

// Module loader events
export enum ModuleLoaderEvent {
  ModuleLoaded = 'module:loaded',
  ModuleUnloaded = 'module:unloaded',
  ModuleError = 'module:error',
  CommandRegistered = 'command:registered',
  CommandUnregistered = 'command:unregistered'
}

export class ModuleLoader extends EventEmitter {
  private modules: Map<string, LoadedModule> = new Map();
  private commandRegistry: Map<string, { moduleId: string; command: any }> = new Map();
  private modulesPath: string;
  private globalEventBus: EventEmitter;
  private userConfig: Record<string, any> = {};

  constructor(modulesPath: string, eventBus: EventEmitter) {
    super();
    this.modulesPath = modulesPath;
    this.globalEventBus = eventBus;
  }

  /**
   * Set user configuration for modules
   */
  setConfig(config: Record<string, any>): void {
    this.userConfig = config;
  }

  /**
   * Discover all modules in the modules directory
   */
  async discoverModules(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.modulesPath, { withFileTypes: true });
      const moduleDirs = entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);
      
      return moduleDirs;
    } catch (error) {
      console.error('Failed to discover modules:', error);
      return [];
    }
  }

  /**
   * Load a module by directory name
   */
  async loadModule(moduleName: string): Promise<LoadedModule | null> {
    const modulePath = path.join(this.modulesPath, moduleName);
    
    try {
      // Load and validate manifest
      const manifestPath = path.join(modulePath, 'manifest.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifestData = JSON.parse(manifestContent);
      const manifest = ManifestSchema.parse(manifestData);

      // Check if module already loaded
      if (this.modules.has(manifest.name)) {
        console.warn(`Module ${manifest.name} already loaded`);
        return this.modules.get(manifest.name)!;
      }

      // Check dependencies
      for (const dep of manifest.dependencies || []) {
        if (!this.modules.has(dep)) {
          console.error(`Module ${manifest.name} depends on ${dep} which is not loaded`);
          throw new Error(`Missing dependency: ${dep}`);
        }
      }

      // Create module context
      const context: ModuleContext = {
        moduleId: manifest.name,
        config: this.userConfig[manifest.name] || {},
        logger: (level, message) => {
          console.log(`[${manifest.name}] ${level}: ${message}`);
        },
        eventBus: this.globalEventBus,
        permissions: manifest.permissions || [],
        rootPath: modulePath
      };

      // Validate config against schema if provided
      if (manifest.config_schema) {
        try {
          const configSchema = z.object(manifest.config_schema);
          context.config = configSchema.parse(context.config);
        } catch (error) {
          console.error(`Invalid config for module ${manifest.name}:`, error);
          throw new Error(`Invalid configuration`);
        }
      }

      // Load module entry point
      const entryPath = path.join(modulePath, manifest.entry_point);
      const moduleExports = await import(entryPath);
      const instance = moduleExports.default || moduleExports;

      // Initialize module
      if (typeof instance.init === 'function') {
        await instance.init(context);
      }

      // Create loaded module entry
      const loadedModule: LoadedModule = {
        manifest,
        instance,
        path: modulePath,
        context,
        isLoaded: true
      };

      // Store module
      this.modules.set(manifest.name, loadedModule);

      // Register commands if present
      if (instance.commands) {
        this.registerModuleCommands(manifest.name, instance.commands);
      }

      // Register event handlers for agent modules
      if (manifest.module_type === 'agent' && instance.on) {
        this.registerEventHandlers(manifest.name, instance.on);
      }

      // Emit loaded event
      this.emit(ModuleLoaderEvent.ModuleLoaded, {
        moduleId: manifest.name,
        moduleType: manifest.module_type,
        version: manifest.version
      });

      return loadedModule;

    } catch (error) {
      console.error(`Failed to load module ${moduleName}:`, error);
      this.emit(ModuleLoaderEvent.ModuleError, {
        moduleId: moduleName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * Unload a module
   */
  async unloadModule(moduleId: string): Promise<boolean> {
    const module = this.modules.get(moduleId);
    if (!module) {
      return false;
    }

    try {
      // Call cleanup if available
      if (typeof module.instance.cleanup === 'function') {
        await module.instance.cleanup();
      }

      // Unregister commands
      this.unregisterModuleCommands(moduleId);

      // Unregister event handlers
      if (module.manifest.module_type === 'agent' && module.instance.on) {
        this.unregisterEventHandlers(moduleId, module.instance.on);
      }

      // Remove from registry
      this.modules.delete(moduleId);

      // Emit unloaded event
      this.emit(ModuleLoaderEvent.ModuleUnloaded, {
        moduleId,
        moduleType: module.manifest.module_type
      });

      return true;

    } catch (error) {
      console.error(`Failed to unload module ${moduleId}:`, error);
      return false;
    }
  }

  /**
   * Load all discovered modules
   */
  async loadAllModules(): Promise<void> {
    const moduleNames = await this.discoverModules();
    
    // Load modules in dependency order
    const loaded = new Set<string>();
    const loading = new Set<string>();
    
    const loadWithDeps = async (moduleName: string) => {
      if (loaded.has(moduleName) || loading.has(moduleName)) {
        return;
      }
      
      loading.add(moduleName);
      
      // Try to load module to check dependencies
      const modulePath = path.join(this.modulesPath, moduleName);
      try {
        const manifestPath = path.join(modulePath, 'manifest.json');
        const manifestContent = await fs.readFile(manifestPath, 'utf-8');
        const manifest = JSON.parse(manifestContent);
        
        // Load dependencies first
        for (const dep of manifest.dependencies || []) {
          const depModuleName = moduleNames.find(name => {
            const depManifestPath = path.join(this.modulesPath, name, 'manifest.json');
            try {
              const depManifest = JSON.parse(fs.readFileSync(depManifestPath, 'utf-8'));
              return depManifest.name === dep;
            } catch {
              return false;
            }
          });
          
          if (depModuleName) {
            await loadWithDeps(depModuleName);
          }
        }
      } catch (error) {
        console.error(`Failed to read manifest for ${moduleName}:`, error);
      }
      
      // Now load this module
      await this.loadModule(moduleName);
      loaded.add(moduleName);
      loading.delete(moduleName);
    };
    
    // Load all modules
    for (const moduleName of moduleNames) {
      await loadWithDeps(moduleName);
    }
  }

  /**
   * Get loaded module by ID
   */
  getModule(moduleId: string): LoadedModule | undefined {
    return this.modules.get(moduleId);
  }

  /**
   * Get all loaded modules
   */
  getLoadedModules(): LoadedModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get modules by type
   */
  getModulesByType(moduleType: string): LoadedModule[] {
    return Array.from(this.modules.values())
      .filter(module => module.manifest.module_type === moduleType);
  }

  /**
   * Execute a command
   */
  async executeCommand(commandName: string, args: any[]): Promise<any> {
    const command = this.commandRegistry.get(commandName);
    if (!command) {
      throw new Error(`Command not found: ${commandName}`);
    }

    const module = this.modules.get(command.moduleId);
    if (!module || !module.isLoaded) {
      throw new Error(`Module not loaded: ${command.moduleId}`);
    }

    // Check permissions if needed
    // TODO: Implement permission checking

    return await command.command.execute(args);
  }

  /**
   * Get all registered commands
   */
  getCommands(): Map<string, { moduleId: string; description?: string }> {
    const commands = new Map<string, { moduleId: string; description?: string }>();
    
    for (const [name, cmd] of this.commandRegistry) {
      commands.set(name, {
        moduleId: cmd.moduleId,
        description: cmd.command.description
      });
    }
    
    return commands;
  }

  /**
   * Register module commands
   */
  private registerModuleCommands(moduleId: string, commands: Record<string, any>): void {
    for (const [name, command] of Object.entries(commands)) {
      const fullName = `${moduleId}:${name}`;
      this.commandRegistry.set(fullName, { moduleId, command });
      
      // Also register without prefix if no conflict
      if (!this.commandRegistry.has(name)) {
        this.commandRegistry.set(name, { moduleId, command });
      }
      
      this.emit(ModuleLoaderEvent.CommandRegistered, {
        moduleId,
        commandName: fullName,
        description: command.description
      });
    }
  }

  /**
   * Unregister module commands
   */
  private unregisterModuleCommands(moduleId: string): void {
    const toRemove: string[] = [];
    
    for (const [name, cmd] of this.commandRegistry) {
      if (cmd.moduleId === moduleId) {
        toRemove.push(name);
      }
    }
    
    for (const name of toRemove) {
      this.commandRegistry.delete(name);
      this.emit(ModuleLoaderEvent.CommandUnregistered, {
        moduleId,
        commandName: name
      });
    }
  }

  /**
   * Register event handlers for agent modules
   */
  private registerEventHandlers(moduleId: string, handlers: Record<string, Function>): void {
    for (const [event, handler] of Object.entries(handlers)) {
      const wrappedHandler = async (...args: any[]) => {
        try {
          await handler(...args);
        } catch (error) {
          console.error(`Error in ${moduleId} handler for ${event}:`, error);
        }
      };
      
      // Tag handler with module ID for later removal
      (wrappedHandler as any).__moduleId = moduleId;
      
      this.globalEventBus.on(event, wrappedHandler);
    }
  }

  /**
   * Unregister event handlers
   */
  private unregisterEventHandlers(moduleId: string, handlers: Record<string, Function>): void {
    for (const event of Object.keys(handlers)) {
      const listeners = this.globalEventBus.listeners(event);
      for (const listener of listeners) {
        if ((listener as any).__moduleId === moduleId) {
          this.globalEventBus.removeListener(event, listener);
        }
      }
    }
  }
}