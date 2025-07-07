import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import path from 'path';
import { promises as fs } from 'fs';
import { ModuleLoader, ModuleLoaderEvent } from './module-loader';

// Mock fs module
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn(),
    readFile: vi.fn()
  }
}));

// Mock dynamic imports
vi.mock('path', async () => {
  const actual = await vi.importActual('path');
  return {
    ...actual,
    join: vi.fn((...args) => args.join('/'))
  };
});

describe('ModuleLoader', () => {
  let moduleLoader: ModuleLoader;
  let eventBus: EventEmitter;
  const modulesPath = '/test/modules';

  beforeEach(() => {
    eventBus = new EventEmitter();
    moduleLoader = new ModuleLoader(modulesPath, eventBus);
    vi.clearAllMocks();
  });

  afterEach(() => {
    eventBus.removeAllListeners();
  });

  describe('discoverModules', () => {
    it('should discover module directories', async () => {
      const mockEntries = [
        { name: 'module1', isDirectory: () => true },
        { name: 'module2', isDirectory: () => true },
        { name: 'file.txt', isDirectory: () => false },
        { name: '.hidden', isDirectory: () => true }
      ];

      vi.mocked(fs.readdir).mockResolvedValue(mockEntries as any);

      const modules = await moduleLoader.discoverModules();
      
      expect(modules).toEqual(['module1', 'module2', '.hidden']);
      expect(fs.readdir).toHaveBeenCalledWith(modulesPath, { withFileTypes: true });
    });

    it('should return empty array on error', async () => {
      vi.mocked(fs.readdir).mockRejectedValue(new Error('Permission denied'));

      const modules = await moduleLoader.discoverModules();
      
      expect(modules).toEqual([]);
    });
  });

  describe('loadModule', () => {
    const mockManifest = {
      name: 'test-module',
      version: '1.0.0',
      description: 'Test module',
      author: 'Test Author',
      entry_point: 'index.js',
      module_type: 'tool',
      dependencies: [],
      permissions: ['terminal']
    };

    const mockModuleInstance = {
      init: vi.fn(),
      cleanup: vi.fn(),
      commands: {
        'test-command': {
          description: 'Test command',
          execute: vi.fn()
        }
      }
    };

    beforeEach(() => {
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockManifest));
      
      // Mock dynamic import
      vi.doMock('/test/modules/test-module/index.js', () => ({
        default: mockModuleInstance
      }));
    });

    it('should load a valid module', async () => {
      const loadedSpy = vi.fn();
      moduleLoader.on(ModuleLoaderEvent.ModuleLoaded, loadedSpy);

      const module = await moduleLoader.loadModule('test-module');

      expect(module).toBeTruthy();
      expect(module?.manifest).toEqual(mockManifest);
      expect(module?.isLoaded).toBe(true);
      expect(mockModuleInstance.init).toHaveBeenCalledWith(
        expect.objectContaining({
          moduleId: 'test-module',
          config: {},
          permissions: ['terminal']
        })
      );
      expect(loadedSpy).toHaveBeenCalledWith({
        moduleId: 'test-module',
        moduleType: 'tool',
        version: '1.0.0'
      });
    });

    it('should not load module twice', async () => {
      await moduleLoader.loadModule('test-module');
      const module2 = await moduleLoader.loadModule('test-module');

      expect(mockModuleInstance.init).toHaveBeenCalledTimes(1);
      expect(module2?.manifest.name).toBe('test-module');
    });

    it('should fail on missing dependencies', async () => {
      const manifestWithDeps = {
        ...mockManifest,
        dependencies: ['missing-dep']
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifestWithDeps));

      const errorSpy = vi.fn();
      moduleLoader.on(ModuleLoaderEvent.ModuleError, errorSpy);

      const module = await moduleLoader.loadModule('test-module');

      expect(module).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith({
        moduleId: 'test-module',
        error: 'Missing dependency: missing-dep'
      });
    });

    it('should validate config against schema', async () => {
      const manifestWithSchema = {
        ...mockManifest,
        config_schema: {
          apiKey: { type: 'string' },
          maxRetries: { type: 'number', default: 3 }
        }
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(manifestWithSchema));

      moduleLoader.setConfig({
        'test-module': {
          apiKey: 'test-key',
          maxRetries: 5
        }
      });

      const module = await moduleLoader.loadModule('test-module');

      expect(module).toBeTruthy();
      expect(mockModuleInstance.init).toHaveBeenCalledWith(
        expect.objectContaining({
          config: {
            apiKey: 'test-key',
            maxRetries: 5
          }
        })
      );
    });

    it('should register commands', async () => {
      const commandSpy = vi.fn();
      moduleLoader.on(ModuleLoaderEvent.CommandRegistered, commandSpy);

      await moduleLoader.loadModule('test-module');

      expect(commandSpy).toHaveBeenCalledWith({
        moduleId: 'test-module',
        commandName: 'test-module:test-command',
        description: 'Test command'
      });

      const commands = moduleLoader.getCommands();
      expect(commands.has('test-module:test-command')).toBe(true);
      expect(commands.has('test-command')).toBe(true);
    });

    it('should register event handlers for agent modules', async () => {
      const agentManifest = {
        ...mockManifest,
        module_type: 'agent'
      };
      const agentInstance = {
        init: vi.fn(),
        on: {
          'terminal.output': vi.fn(),
          'terminal.error': vi.fn()
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(agentManifest));
      vi.doMock('/test/modules/test-module/index.js', () => ({
        default: agentInstance
      }));

      await moduleLoader.loadModule('test-module');

      // Verify event handlers are registered
      expect(eventBus.listenerCount('terminal.output')).toBe(1);
      expect(eventBus.listenerCount('terminal.error')).toBe(1);
    });
  });

  describe('unloadModule', () => {
    beforeEach(async () => {
      const mockManifest = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        author: 'Test Author',
        entry_point: 'index.js',
        module_type: 'tool'
      };
      
      const mockModuleInstance = {
        init: vi.fn(),
        cleanup: vi.fn(),
        commands: {
          'test-command': {
            description: 'Test command',
            execute: vi.fn()
          }
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockManifest));
      vi.doMock('/test/modules/test-module/index.js', () => ({
        default: mockModuleInstance
      }));

      await moduleLoader.loadModule('test-module');
    });

    it('should unload a loaded module', async () => {
      const unloadedSpy = vi.fn();
      moduleLoader.on(ModuleLoaderEvent.ModuleUnloaded, unloadedSpy);

      const module = moduleLoader.getModule('test-module');
      const result = await moduleLoader.unloadModule('test-module');

      expect(result).toBe(true);
      expect(module?.instance.cleanup).toHaveBeenCalled();
      expect(moduleLoader.getModule('test-module')).toBeUndefined();
      expect(unloadedSpy).toHaveBeenCalledWith({
        moduleId: 'test-module',
        moduleType: 'tool'
      });
    });

    it('should unregister commands on unload', async () => {
      const unregisterSpy = vi.fn();
      moduleLoader.on(ModuleLoaderEvent.CommandUnregistered, unregisterSpy);

      await moduleLoader.unloadModule('test-module');

      expect(unregisterSpy).toHaveBeenCalled();
      expect(moduleLoader.getCommands().has('test-command')).toBe(false);
    });

    it('should return false for non-existent module', async () => {
      const result = await moduleLoader.unloadModule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('executeCommand', () => {
    beforeEach(async () => {
      const mockManifest = {
        name: 'test-module',
        version: '1.0.0',
        description: 'Test module',
        author: 'Test Author',
        entry_point: 'index.js',
        module_type: 'tool'
      };
      
      const mockModuleInstance = {
        init: vi.fn(),
        commands: {
          'test-command': {
            description: 'Test command',
            execute: vi.fn().mockResolvedValue('command result')
          }
        }
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockManifest));
      vi.doMock('/test/modules/test-module/index.js', () => ({
        default: mockModuleInstance
      }));

      await moduleLoader.loadModule('test-module');
    });

    it('should execute a registered command', async () => {
      const result = await moduleLoader.executeCommand('test-command', ['arg1', 'arg2']);
      
      expect(result).toBe('command result');
      const module = moduleLoader.getModule('test-module');
      expect(module?.instance.commands['test-command'].execute).toHaveBeenCalledWith(['arg1', 'arg2']);
    });

    it('should execute command with module prefix', async () => {
      const result = await moduleLoader.executeCommand('test-module:test-command', ['arg1']);
      expect(result).toBe('command result');
    });

    it('should throw for non-existent command', async () => {
      await expect(
        moduleLoader.executeCommand('non-existent', [])
      ).rejects.toThrow('Command not found: non-existent');
    });
  });

  describe('getModulesByType', () => {
    it('should filter modules by type', async () => {
      const modules = [
        { name: 'layout1', module_type: 'layout' },
        { name: 'agent1', module_type: 'agent' },
        { name: 'layout2', module_type: 'layout' },
        { name: 'tool1', module_type: 'tool' }
      ];

      for (const mod of modules) {
        const manifest = {
          name: mod.name,
          version: '1.0.0',
          description: 'Test',
          author: 'Test',
          entry_point: 'index.js',
          module_type: mod.module_type
        };
        
        vi.mocked(fs.readFile).mockResolvedValueOnce(JSON.stringify(manifest));
        vi.doMock(`/test/modules/${mod.name}/index.js`, () => ({
          default: { init: vi.fn() }
        }));
        
        await moduleLoader.loadModule(mod.name);
      }

      const layoutModules = moduleLoader.getModulesByType('layout');
      expect(layoutModules).toHaveLength(2);
      expect(layoutModules.map(m => m.manifest.name)).toEqual(['layout1', 'layout2']);
    });
  });

  describe('loadAllModules', () => {
    it('should load modules in dependency order', async () => {
      const moduleDefs = {
        'module-a': {
          manifest: {
            name: 'module-a',
            version: '1.0.0',
            description: 'Module A',
            author: 'Test',
            entry_point: 'index.js',
            module_type: 'tool',
            dependencies: ['module-b']
          },
          instance: { init: vi.fn() }
        },
        'module-b': {
          manifest: {
            name: 'module-b',
            version: '1.0.0',
            description: 'Module B',
            author: 'Test',
            entry_point: 'index.js',
            module_type: 'tool',
            dependencies: []
          },
          instance: { init: vi.fn() }
        },
        'module-c': {
          manifest: {
            name: 'module-c',
            version: '1.0.0',
            description: 'Module C',
            author: 'Test',
            entry_point: 'index.js',
            module_type: 'tool',
            dependencies: ['module-a']
          },
          instance: { init: vi.fn() }
        }
      };

      vi.mocked(fs.readdir).mockResolvedValue(
        Object.keys(moduleDefs).map(name => ({ name, isDirectory: () => true })) as any
      );

      // Mock manifest reads
      vi.mocked(fs.readFile).mockImplementation((path) => {
        const pathStr = path.toString();
        for (const [name, def] of Object.entries(moduleDefs)) {
          if (pathStr.includes(`${name}/manifest.json`)) {
            return Promise.resolve(JSON.stringify(def.manifest));
          }
        }
        return Promise.reject(new Error('Not found'));
      });

      // Mock module imports
      for (const [name, def] of Object.entries(moduleDefs)) {
        vi.doMock(`/test/modules/${name}/index.js`, () => ({
          default: def.instance
        }));
      }

      await moduleLoader.loadAllModules();

      // Verify all modules loaded
      expect(moduleLoader.getLoadedModules()).toHaveLength(3);

      // Verify init was called in correct order (B -> A -> C)
      const initCalls = [
        moduleDefs['module-b'].instance.init,
        moduleDefs['module-a'].instance.init,
        moduleDefs['module-c'].instance.init
      ];

      for (let i = 0; i < initCalls.length - 1; i++) {
        const firstCallOrder = initCalls[i].mock.invocationCallOrder[0];
        const secondCallOrder = initCalls[i + 1].mock.invocationCallOrder[0];
        expect(firstCallOrder).toBeLessThan(secondCallOrder);
      }
    });
  });
});