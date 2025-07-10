import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type { Session, Pane, ManagerEvent, PluginInfo } from '../../api/manager-client';

// Mock the manager client BEFORE importing the store
vi.mock('../../api/manager-client', () => ({
  managerClient: {
    connectWebSocket: vi.fn(),
    subscribe: vi.fn(),
    onEvent: vi.fn(),
    getSessions: vi.fn(),
    getPanes: vi.fn(),
    listPlugins: vi.fn(),
    createSession: vi.fn(),
    deleteSession: vi.fn(),
    createPane: vi.fn(),
    closePane: vi.fn(),
    sendInput: vi.fn(),
    sendKeys: vi.fn(),
    selectBackendPane: vi.fn(),
    loadPlugin: vi.fn(),
    unloadPlugin: vi.fn(),
    persistState: vi.fn(),
    readFile: vi.fn(),
    saveFile: vi.fn(),
    listDirectory: vi.fn(),
    watchFile: vi.fn(),
    unwatchFile: vi.fn(),
    searchProject: vi.fn(),
    getCommandHistory: vi.fn(),
    dispose: vi.fn(),
  }
}));

// Import store AFTER mocking to prevent auto-init issues
const { managerClient } = await import('../../api/manager-client');
const storeModule = await import('../manager');

// Destructure the store exports
const { manager, sessions, activeSession, panes, activePane, plugins, loadedPlugins, terminalOutputs, isConnected, error } = storeModule;

describe('Manager Store', () => {
  let eventHandlers: Map<string, (event: ManagerEvent) => void>;
  let isInitialized = false;
  
  beforeEach(() => {
    vi.clearAllMocks();
    eventHandlers = new Map();
    
    // Setup mock implementations
    vi.mocked(managerClient.connectWebSocket).mockResolvedValue(undefined);
    vi.mocked(managerClient.subscribe).mockResolvedValue(undefined);
    vi.mocked(managerClient.onEvent).mockImplementation((eventType, handler) => {
      eventHandlers.set(eventType, handler);
      return () => eventHandlers.delete(eventType);
    });
    
    // Default data - ensure proper return types
    vi.mocked(managerClient.getSessions).mockResolvedValue([]);
    vi.mocked(managerClient.getPanes).mockResolvedValue([]);
    vi.mocked(managerClient.listPlugins).mockResolvedValue([]);
  });

  afterEach(() => {
    try {
      // Only destroy if manager was initialized
      if (isInitialized) {
        manager.destroy();
        isInitialized = false;
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  describe('initialization', () => {
    it('should connect websocket and subscribe to events on init', async () => {
      await manager.init();
      isInitialized = true;
      
      expect(managerClient.connectWebSocket).toHaveBeenCalled();
      expect(managerClient.subscribe).toHaveBeenCalledWith([
        'SessionCreated',
        'SessionDeleted',
        'PaneCreated',
        'PaneClosed',
        'PaneOutput',
        'PaneResized',
        'PaneFocused',
        'PluginLoaded',
        'PluginUnloaded',
        'FileModified',
        'FileSaved'
      ]);
    });

    it('should set isConnected to true after successful init', async () => {
      await manager.init();
      isInitialized = true;
      
      expect(get(isConnected)).toBe(true);
      expect(get(error)).toBeUndefined();
    });

    it('should handle initialization errors', async () => {
      const errorMsg = 'Connection failed';
      vi.mocked(managerClient.connectWebSocket).mockRejectedValue(new Error(errorMsg));
      
      await manager.init();
      isInitialized = true;
      
      expect(get(isConnected)).toBe(false);
      expect(get(error)).toBe(errorMsg);
    });

    it('should load initial sessions and plugins', async () => {
      const mockSessions: Session[] = [
        { id: 'session1', name: 'Test Session', created_at: new Date().toISOString() }
      ];
      const mockPlugins: PluginInfo[] = [
        { id: 'plugin1', name: 'Test Plugin', version: '1.0.0', loaded: true, metadata: {} }
      ];
      
      vi.mocked(managerClient.getSessions).mockResolvedValue(mockSessions);
      vi.mocked(managerClient.listPlugins).mockResolvedValue(mockPlugins);
      
      await manager.init();
      isInitialized = true;
      
      expect(get(sessions)).toEqual(mockSessions);
      expect(get(plugins)).toEqual(mockPlugins);
      expect(get(activeSession)?.id).toBe('session1');
    });
  });

  describe('session management', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should create a new session', async () => {
      const newSession: Session = { 
        id: 'new-session', 
        name: 'New Session', 
        created_at: new Date().toISOString() 
      };
      
      vi.mocked(managerClient.createSession).mockResolvedValue(newSession);
      vi.mocked(managerClient.getSessions).mockResolvedValue([newSession]);
      
      const result = await manager.createSession('New Session');
      
      expect(result).toEqual(newSession);
      expect(managerClient.createSession).toHaveBeenCalledWith('New Session');
    });

    it('should delete a session', async () => {
      await manager.deleteSession('session1');
      
      expect(managerClient.deleteSession).toHaveBeenCalledWith('session1');
    });

    it('should refresh sessions', async () => {
      const mockSessions: Session[] = [
        { id: 'session1', name: 'Session 1', created_at: new Date().toISOString() },
        { id: 'session2', name: 'Session 2', created_at: new Date().toISOString() }
      ];
      
      vi.mocked(managerClient.getSessions).mockResolvedValue(mockSessions);
      
      await manager.refreshSessions();
      
      expect(get(sessions)).toEqual(mockSessions);
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should refresh sessions on SessionCreated event', async () => {
      // Mock to track the refresh call
      const mockSessions: Session[] = [
        { id: 'new-session', name: 'New Session', created_at: new Date().toISOString() }
      ];
      vi.mocked(managerClient.getSessions).mockResolvedValue(mockSessions);
      
      const event: ManagerEvent = { type: 'SessionCreated', session_id: 'new-session' };
      eventHandlers.get('SessionCreated')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify getSessions was called to refresh
      expect(managerClient.getSessions).toHaveBeenCalled();
    });

    it('should remove session on SessionDeleted event', async () => {
      // Set up initial state
      const initialSessions: Session[] = [
        { id: 'session1', name: 'Session 1', created_at: new Date().toISOString() },
        { id: 'session2', name: 'Session 2', created_at: new Date().toISOString() }
      ];
      vi.mocked(managerClient.getSessions).mockResolvedValue(initialSessions);
      await manager.refreshSessions();
      
      // Delete session1
      const event: ManagerEvent = { type: 'SessionDeleted', session_id: 'session1' };
      eventHandlers.get('SessionDeleted')?.(event);
      
      expect(get(sessions)).toHaveLength(1);
      expect(get(sessions)[0].id).toBe('session2');
      expect(get(activeSession)?.id).toBe('session2');
    });

    it('should refresh panes on PaneCreated event', async () => {
      // Mock to track the refresh call
      const mockPanes: Pane[] = [
        { 
          id: 'pane1', 
          session_id: 'session1',
          pane_type: 'Terminal',
          title: 'New Pane',
          is_active: true,
          cols: 80,
          rows: 24,
          cwd: '/home/user',
          process_id: null,
          exit_code: null
        }
      ];
      vi.mocked(managerClient.getPanes).mockResolvedValue(mockPanes);
      
      const event: ManagerEvent = { 
        type: 'PaneCreated', 
        session_id: 'session1',
        pane_id: 'pane1' 
      };
      eventHandlers.get('PaneCreated')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify getPanes was called with the session ID
      expect(managerClient.getPanes).toHaveBeenCalledWith('session1');
    });

    it('should handle PaneClosed event', async () => {
      // Set up initial pane
      const mockPanes: Pane[] = [
        { 
          id: 'pane1', 
          session_id: 'session1',
          pane_type: 'Terminal',
          title: 'Test Pane',
          is_active: true,
          cols: 80,
          rows: 24,
          cwd: '/home/user',
          process_id: null,
          exit_code: null
        }
      ];
      
      vi.mocked(managerClient.getPanes).mockResolvedValue(mockPanes);
      await manager.refreshPanes('session1');
      
      // Add some terminal output
      const outputEvent: ManagerEvent = {
        type: 'PaneOutput',
        pane_id: 'pane1',
        data: 'test output'
      };
      eventHandlers.get('PaneOutput')?.(outputEvent);
      
      // Close the pane
      const event: ManagerEvent = { type: 'PaneClosed', pane_id: 'pane1' };
      eventHandlers.get('PaneClosed')?.(event);
      
      expect(get(panes).has('pane1')).toBe(false);
      expect(get(terminalOutputs).has('pane1')).toBe(false);
    });

    it('should handle PaneOutput event', async () => {
      const event: ManagerEvent = {
        type: 'PaneOutput',
        pane_id: 'pane1',
        data: 'Hello, World!'
      };
      
      eventHandlers.get('PaneOutput')?.(event);
      
      const outputs = get(terminalOutputs);
      expect(outputs.get('pane1')).toEqual(['Hello, World!']);
    });

    it('should handle PaneFocused event', async () => {
      const event: ManagerEvent = {
        type: 'PaneFocused',
        pane_id: 'pane2'
      };
      
      eventHandlers.get('PaneFocused')?.(event);
      
      const state = get(manager);
      expect(state.activePaneId).toBe('pane2');
    });

    it('should refresh plugins on PluginLoaded event', async () => {
      // Mock to track the refresh call
      const mockPlugins: PluginInfo[] = [
        { id: 'plugin1', name: 'Test Plugin', version: '1.0.0', loaded: true, metadata: {} }
      ];
      vi.mocked(managerClient.listPlugins).mockResolvedValue(mockPlugins);
      
      const event: ManagerEvent = { type: 'PluginLoaded', plugin_id: 'plugin1' };
      eventHandlers.get('PluginLoaded')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify listPlugins was called to refresh
      expect(managerClient.listPlugins).toHaveBeenCalled();
    });

    it('should refresh plugins on PluginUnloaded event', async () => {
      // Mock to track the refresh call
      const mockPlugins: PluginInfo[] = [];
      vi.mocked(managerClient.listPlugins).mockResolvedValue(mockPlugins);
      
      const event: ManagerEvent = { type: 'PluginUnloaded', plugin_id: 'plugin1' };
      eventHandlers.get('PluginUnloaded')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify listPlugins was called to refresh
      expect(managerClient.listPlugins).toHaveBeenCalled();
    });
  });

  describe('pane management', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should create a terminal', async () => {
      const newPane: Pane = {
        id: 'new-pane',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'New Terminal',
        is_active: true,
        cols: 80,
        rows: 24,
        cwd: '/home/user',
        process_id: null,
        exit_code: null
      };
      
      vi.mocked(managerClient.createPane).mockResolvedValue(newPane);
      vi.mocked(managerClient.getPanes).mockResolvedValue([newPane]);
      
      const result = await manager.createTerminal('session1', { cwd: '/home/user' });
      
      expect(result).toEqual(newPane);
      expect(managerClient.createPane).toHaveBeenCalledWith('session1', {
        paneType: 'Terminal',
        cwd: '/home/user'
      });
    });

    it('should close a pane', async () => {
      await manager.closePane('pane1');
      
      expect(managerClient.closePane).toHaveBeenCalledWith('pane1');
    });

    it('should send input to a pane', async () => {
      await manager.sendInput('pane1', 'ls -la');
      
      expect(managerClient.sendInput).toHaveBeenCalledWith('pane1', 'ls -la');
    });

    it('should send keys to a pane', async () => {
      await manager.sendKeys('pane1', 'Ctrl+C');
      
      expect(managerClient.sendKeys).toHaveBeenCalledWith('pane1', 'Ctrl+C');
    });

    it('should focus a pane', async () => {
      await manager.focusPane('pane2');
      
      expect(managerClient.selectBackendPane).toHaveBeenCalledWith('pane2');
      const state = get(manager);
      expect(state.activePaneId).toBe('pane2');
    });
  });

  describe('plugin management', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should load a plugin', async () => {
      await manager.loadPlugin('plugin1');
      
      expect(managerClient.loadPlugin).toHaveBeenCalledWith('plugin1');
    });

    it('should unload a plugin', async () => {
      await manager.unloadPlugin('plugin1');
      
      expect(managerClient.unloadPlugin).toHaveBeenCalledWith('plugin1');
    });

    it('should refresh plugins', async () => {
      const mockPlugins: PluginInfo[] = [
        { id: 'plugin1', name: 'Plugin 1', version: '1.0.0', loaded: true, metadata: {} },
        { id: 'plugin2', name: 'Plugin 2', version: '2.0.0', loaded: false, metadata: {} }
      ];
      
      vi.mocked(managerClient.listPlugins).mockResolvedValue(mockPlugins);
      
      await manager.refreshPlugins();
      
      expect(get(plugins)).toEqual(mockPlugins);
      expect(get(loadedPlugins)).toHaveLength(1);
      expect(get(loadedPlugins)[0].id).toBe('plugin1');
    });
  });

  describe('file operations', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should read a file', async () => {
      const content = 'file content';
      vi.mocked(managerClient.readFile).mockResolvedValue(content);
      
      const result = await manager.readFile('/path/to/file');
      
      expect(result).toBe(content);
      expect(managerClient.readFile).toHaveBeenCalledWith('/path/to/file');
    });

    it('should save a file', async () => {
      await manager.saveFile('/path/to/file', 'new content');
      
      expect(managerClient.saveFile).toHaveBeenCalledWith('/path/to/file', 'new content');
    });

    it('should list directory', async () => {
      const files = [{ name: 'file1.txt', type: 'file' }];
      vi.mocked(managerClient.listDirectory).mockResolvedValue(files);
      
      const result = await manager.listDirectory('/path');
      
      expect(result).toEqual(files);
      expect(managerClient.listDirectory).toHaveBeenCalledWith('/path');
    });

    it('should watch a file', async () => {
      await manager.watchFile('/path/to/file');
      
      expect(managerClient.watchFile).toHaveBeenCalledWith('/path/to/file');
    });

    it('should unwatch a file', async () => {
      await manager.unwatchFile('/path/to/file');
      
      expect(managerClient.unwatchFile).toHaveBeenCalledWith('/path/to/file');
    });
  });

  describe('search operations', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should search project', async () => {
      const results = [{ file: 'test.ts', matches: [] }];
      vi.mocked(managerClient.searchProject).mockResolvedValue(results);
      
      const result = await manager.searchProject('test', { caseSensitive: true });
      
      expect(result).toEqual(results);
      expect(managerClient.searchProject).toHaveBeenCalledWith('test', { caseSensitive: true });
    });

    it('should get command history', async () => {
      const history = [{ command: 'ls', timestamp: Date.now() }];
      vi.mocked(managerClient.getCommandHistory).mockResolvedValue(history);
      
      const result = await manager.getCommandHistory('pane1', 10);
      
      expect(result).toEqual(history);
      expect(managerClient.getCommandHistory).toHaveBeenCalledWith('pane1', 10);
    });
  });

  describe('state persistence', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should persist state', async () => {
      await manager.persistState();
      
      expect(managerClient.persistState).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await manager.init();
      isInitialized = true;
      
      // Set up event handlers to verify they are cleaned up
      const unsubscribeSpy = vi.fn();
      vi.mocked(managerClient.onEvent).mockReturnValue(unsubscribeSpy);
      
      // Re-init to register event handlers with our spy
      await manager.init();
      
      manager.destroy();
      isInitialized = false;
      
      expect(managerClient.dispose).toHaveBeenCalled();
    });
  });
});