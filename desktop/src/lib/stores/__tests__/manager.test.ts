import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import type { Session, Pane, ManagerEvent, PluginInfo } from '../../api/manager-client';
import { createAsyncMock, createAsyncVoidMock, createTypedMock } from '@/test/mock-factory';
import { buildSession, buildPane, buildPlugin } from '../../../test/test-data-builders';

// Set NODE_ENV to test before importing anything
process.env.NODE_ENV = 'test';

// Create mock functions with proper types
const mockManagerClient = {
  connectWebSocket: createAsyncVoidMock(),
  subscribe: createAsyncVoidMock(),
  onEvent: createTypedMock<(eventType: string, handler: (event: ManagerEvent) => void) => (() => void)>(),
  getSessions: createAsyncMock<Session[]>(),
  getPanes: createAsyncMock<Pane[]>(),
  listPlugins: createAsyncMock<PluginInfo[]>(),
  createSession: createAsyncMock<Session>(),
  deleteSession: createAsyncVoidMock(),
  createPane: createAsyncMock<Pane>(),
  closePane: createAsyncVoidMock(),
  sendInput: createAsyncVoidMock(),
  sendKeys: createAsyncVoidMock(),
  selectBackendPane: createAsyncVoidMock(),
  loadPlugin: createAsyncVoidMock(),
  unloadPlugin: createAsyncVoidMock(),
  persistState: createAsyncVoidMock(),
  readFile: createAsyncMock<string>(),
  saveFile: createAsyncVoidMock(),
  listDirectory: createAsyncMock<any[]>(),
  watchFile: createAsyncVoidMock(),
  unwatchFile: createAsyncVoidMock(),
  searchProject: createAsyncMock<any[]>(),
  getCommandHistory: createAsyncMock<any[]>(),
  dispose: createAsyncVoidMock(),
};

// Mock the manager client BEFORE importing the store
vi.mock('../../api/manager-client', () => ({
  managerClient: mockManagerClient
}));

// Import store AFTER mocking to prevent auto-init issues
const { managerClient } = await import('../../api/manager-client');
const storeModule = await import('../manager');

// Destructure the store exports
const { manager, sessions, activeSession, panes, activePane, plugins, loadedPlugins, terminalOutputs, isConnected, error } = storeModule;

describe('Manager Store', () => {
  let cleanup: Array<() => void> = [];
  let eventHandlers: Map<string, (event: ManagerEvent) => void>;
  let isInitialized = false;
  let unsubscribeFns: (() => void)[] = [];
  
  beforeEach(() => {
    eventHandlers = new Map();
    unsubscribeFns = [];
    
    // Setup mock implementations
    mockManagerClient.connectWebSocket.mockResolvedValue(undefined);
    mockManagerClient.subscribe.mockResolvedValue(undefined);
    mockManagerClient.onEvent.mockImplementation((eventType: string, handler: (event: ManagerEvent) => void) => {
      eventHandlers.set(eventType, handler);
      const unsubscribe = () => eventHandlers.delete(eventType);
      unsubscribeFns.push(unsubscribe);
      return unsubscribe;
    });
    
    // Default data - ensure proper return types
    mockManagerClient.getSessions.mockResolvedValue([]);
    mockManagerClient.getPanes.mockResolvedValue([]);
    mockManagerClient.listPlugins.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    // Clean up event handlers
    unsubscribeFns.forEach(fn => fn());
    eventHandlers.clear();
    
    // Only destroy if manager was initialized
    if (isInitialized) {
      try {
        manager.destroy();
      } catch (e) {
        // Ignore errors during cleanup
      }
      isInitialized = false;
    }
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should connect websocket and subscribe to events on init', async () => {
      await manager.init();
      isInitialized = true;
      
      expect(mockManagerClient.connectWebSocket).toHaveBeenCalled();
      expect(mockManagerClient.subscribe).toHaveBeenCalledWith([
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
      mockManagerClient.connectWebSocket.mockRejectedValue(new Error(errorMsg));
      
      await manager.init();
      isInitialized = true;
      
      expect(get(isConnected)).toBe(false);
      expect(get(error)).toBe(errorMsg);
    });

    it('should load initial sessions and plugins', async () => {
      const mockSessions = [buildSession({ id: 'session1', name: 'Test Session' })];
      const mockPlugins = [buildPlugin({ id: 'plugin1', name: 'Test Plugin', loaded: true })];
      
      mockManagerClient.getSessions.mockResolvedValue(mockSessions);
      mockManagerClient.listPlugins.mockResolvedValue(mockPlugins);
      
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
      const newSession = buildSession({ id: 'new-session', name: 'New Session' });
      
      mockManagerClient.createSession.mockResolvedValue(newSession);
      mockManagerClient.getSessions.mockResolvedValue([newSession]);
      
      const result = await manager.createSession('New Session');
      
      expect(result).toEqual(newSession);
      expect(mockManagerClient.createSession).toHaveBeenCalledWith('New Session');
    });

    it('should delete a session', async () => {
      await manager.deleteSession('session1');
      
      expect(mockManagerClient.deleteSession).toHaveBeenCalledWith('session1');
    });

    it('should refresh sessions', async () => {
      const mockSessions = [
        buildSession({ id: 'session1', name: 'Session 1' }),
        buildSession({ id: 'session2', name: 'Session 2' })
      ];
      
      mockManagerClient.getSessions.mockResolvedValue(mockSessions);
      
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
      const mockSessions = [buildSession({ id: 'new-session', name: 'New Session' })];
      mockManagerClient.getSessions.mockResolvedValue(mockSessions);
      
      const event: ManagerEvent = { type: 'SessionCreated', session_id: 'new-session', name: 'New Session' };
      eventHandlers.get('SessionCreated')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify getSessions was called to refresh
      expect(mockManagerClient.getSessions).toHaveBeenCalled();
    });

    it('should remove session on SessionDeleted event', async () => {
      // Set up initial state
      const initialSessions = [
        buildSession({ id: 'session1', name: 'Session 1' }),
        buildSession({ id: 'session2', name: 'Session 2' })
      ];
      mockManagerClient.getSessions.mockResolvedValue(initialSessions);
      await manager.refreshSessions();
      
      // Delete session1
      const event: ManagerEvent = { type: 'SessionDeleted', session_id: 'session1' };
      eventHandlers.get('SessionDeleted')?.(event);
      
      expect(get(sessions)).toHaveLength(1);
      expect(get(sessions)[0].id).toBe('session2');
      expect(get(activeSession)?.id).toBe('session2');
    });

    it('should refresh panes on PaneCreated event', async () => {
      const mockPanes = [buildPane({ 
        id: 'pane1', 
        session_id: 'session1',
        title: 'New Pane',
        is_active: true
      })];
      mockManagerClient.getPanes.mockResolvedValue(mockPanes);
      
      const event: ManagerEvent = { 
        type: 'PaneCreated', 
        session_id: 'session1',
        pane_id: 'pane1' 
      };
      eventHandlers.get('PaneCreated')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify getPanes was called with the session ID
      expect(mockManagerClient.getPanes).toHaveBeenCalledWith('session1');
    });

    it('should handle PaneClosed event', async () => {
      // Set up initial pane
      const mockPanes = [buildPane({ 
        id: 'pane1', 
        session_id: 'session1',
        title: 'Test Pane',
        is_active: true
      })];
      
      mockManagerClient.getPanes.mockResolvedValue(mockPanes);
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
      const mockPlugins = [buildPlugin({ 
        id: 'plugin1', 
        name: 'Test Plugin', 
        loaded: true
      })];
      mockManagerClient.listPlugins.mockResolvedValue(mockPlugins);
      
      const event: ManagerEvent = { type: 'PluginLoaded', plugin_id: 'plugin1' };
      eventHandlers.get('PluginLoaded')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify listPlugins was called to refresh
      expect(mockManagerClient.listPlugins).toHaveBeenCalled();
    });

    it('should refresh plugins on PluginUnloaded event', async () => {
      mockManagerClient.listPlugins.mockResolvedValue([]);
      
      const event: ManagerEvent = { type: 'PluginUnloaded', plugin_id: 'plugin1' };
      eventHandlers.get('PluginUnloaded')?.(event);
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Verify listPlugins was called to refresh
      expect(mockManagerClient.listPlugins).toHaveBeenCalled();
    });
  });

  describe('pane management', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should create a terminal', async () => {
      const newPane = buildPane({
        id: 'new-pane',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'New Terminal',
        is_active: true
      });
      
      mockManagerClient.createPane.mockResolvedValue(newPane);
      mockManagerClient.getPanes.mockResolvedValue([newPane]);
      
      const result = await manager.createTerminal('session1', { command: 'bash' });
      
      expect(result).toEqual(newPane);
      expect(mockManagerClient.createPane).toHaveBeenCalledWith('session1', {
        paneType: 'Terminal',
        command: 'bash'
      });
    });

    it('should close a pane', async () => {
      await manager.closePane('pane1');
      
      expect(mockManagerClient.closePane).toHaveBeenCalledWith('pane1');
    });

    it('should send input to a pane', async () => {
      await manager.sendInput('pane1', 'ls -la');
      
      expect(mockManagerClient.sendInput).toHaveBeenCalledWith('pane1', 'ls -la');
    });

    it('should send keys to a pane', async () => {
      await manager.sendKeys('pane1', 'Ctrl+C');
      
      expect(mockManagerClient.sendKeys).toHaveBeenCalledWith('pane1', 'Ctrl+C');
    });

    it('should focus a pane', async () => {
      await manager.focusPane('pane2');
      
      expect(mockManagerClient.selectBackendPane).toHaveBeenCalledWith('pane2');
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
      
      expect(mockManagerClient.loadPlugin).toHaveBeenCalledWith('plugin1');
    });

    it('should unload a plugin', async () => {
      await manager.unloadPlugin('plugin1');
      
      expect(mockManagerClient.unloadPlugin).toHaveBeenCalledWith('plugin1');
    });

    it('should refresh plugins', async () => {
      const mockPlugins = [
        buildPlugin({ id: 'plugin1', name: 'Plugin 1', loaded: true }),
        buildPlugin({ id: 'plugin2', name: 'Plugin 2', loaded: false })
      ];
      
      mockManagerClient.listPlugins.mockResolvedValue(mockPlugins);
      
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
      mockManagerClient.readFile.mockResolvedValue(content);
      
      const result = await manager.readFile('/path/to/file');
      
      expect(result).toBe(content);
      expect(mockManagerClient.readFile).toHaveBeenCalledWith('/path/to/file');
    });

    it('should save a file', async () => {
      await manager.saveFile('/path/to/file', 'new content');
      
      expect(mockManagerClient.saveFile).toHaveBeenCalledWith('/path/to/file', 'new content');
    });

    it('should list directory', async () => {
      const files = [{ name: 'file1.txt', type: 'file' }];
      mockManagerClient.listDirectory.mockResolvedValue(files);
      
      const result = await manager.listDirectory('/path');
      
      expect(result).toEqual(files);
      expect(mockManagerClient.listDirectory).toHaveBeenCalledWith('/path');
    });

    it('should watch a file', async () => {
      await manager.watchFile('/path/to/file');
      
      expect(mockManagerClient.watchFile).toHaveBeenCalledWith('/path/to/file');
    });

    it('should unwatch a file', async () => {
      await manager.unwatchFile('/path/to/file');
      
      expect(mockManagerClient.unwatchFile).toHaveBeenCalledWith('/path/to/file');
    });
  });

  describe('search operations', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should search project', async () => {
      const results = [{ file: 'test.ts', matches: [] }];
      mockManagerClient.searchProject.mockResolvedValue(results);
      
      const result = await manager.searchProject('test', { caseSensitive: true });
      
      expect(result).toEqual(results);
      expect(mockManagerClient.searchProject).toHaveBeenCalledWith('test', { caseSensitive: true });
    });

    it('should get command history', async () => {
      const history = [{ 
        id: 'cmd1',
        command: 'ls', 
        timestamp: new Date().toISOString(),
        pane_id: 'pane1'
      }];
      mockManagerClient.getCommandHistory.mockResolvedValue(history);
      
      const result = await manager.getCommandHistory('pane1', 10);
      
      expect(result).toEqual(history);
      expect(mockManagerClient.getCommandHistory).toHaveBeenCalledWith('pane1', 10);
    });
  });

  describe('state persistence', () => {
    beforeEach(async () => {
      await manager.init();
      isInitialized = true;
    });

    it('should persist state', async () => {
      await manager.persistState();
      
      expect(mockManagerClient.persistState).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should cleanup resources on destroy', async () => {
      await manager.init();
      isInitialized = true;
      
      // Set up event handlers to verify they are cleaned up
      const unsubscribeSpy = createTypedMock<() => void>();
      mockManagerClient.onEvent.mockReturnValue(unsubscribeSpy);
      
      // Re-init to register event handlers with our spy
      await manager.init();
      
      manager.destroy();
      isInitialized = false;
      
      expect(mockManagerClient.dispose).toHaveBeenCalled();
    });
  });
});