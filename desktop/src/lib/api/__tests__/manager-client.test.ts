import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ManagerClient, type Session, type Pane, type PaneType, type PluginInfo, type CommandHistoryEntry } from '../manager-client';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// Mocks are already set up in src/test/setup.ts

describe('ManagerClient', () => {
  let client: ManagerClient;
  let mockedInvoke: any;
  let mockedListen: any;

  beforeEach(() => {
    client = new ManagerClient();
    mockedInvoke = vi.mocked(invoke);
    mockedListen = vi.mocked(listen);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('execute', () => {
    it('should execute an action successfully', async () => {
      const action = { type: 'CreateSession' as const, name: 'test-session' };
      const expectedResult = { session: { id: '123', name: 'test-session' } };
      mockedInvoke.mockResolvedValueOnce(expectedResult);

      const result = await client.execute(action);

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', { action });
      expect(result).toEqual(expectedResult);
    });

    it('should handle execution errors', async () => {
      const action = { type: 'CreateSession' as const, name: 'test-session' };
      const error = new Error('Execution failed');
      mockedInvoke.mockRejectedValueOnce(error);

      await expect(client.execute(action)).rejects.toThrow('Execution failed');
      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', { action });
    });
  });

  describe('subscribe', () => {
    it('should subscribe to events', async () => {
      const eventTypes = ['SessionCreated', 'SessionDeleted'];
      mockedInvoke.mockResolvedValueOnce(undefined);

      await client.subscribe(eventTypes);

      expect(mockedInvoke).toHaveBeenCalledWith('manager_subscribe', { eventTypes });
    });
  });

  describe('Session Management', () => {
    describe('getSessions', () => {
      it('should get all sessions', async () => {
        const sessions: Session[] = [
          {
            id: '1',
            name: 'session1',
            panes: ['pane1'],
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ];
        mockedInvoke.mockResolvedValueOnce(sessions);

        const result = await client.getSessions();

        expect(mockedInvoke).toHaveBeenCalledWith('get_sessions');
        expect(result).toEqual(sessions);
      });
    });

    describe('getSession', () => {
      it('should get a specific session', async () => {
        const session: Session = {
          id: '1',
          name: 'session1',
          panes: ['pane1'],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockedInvoke.mockResolvedValueOnce(session);

        const result = await client.getSession('1');

        expect(mockedInvoke).toHaveBeenCalledWith('get_session', { session_id: '1' });
        expect(result).toEqual(session);
      });
    });

    describe('createSession', () => {
      it('should create a new session', async () => {
        const session: Session = {
          id: '1',
          name: 'new-session',
          panes: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockedInvoke.mockResolvedValueOnce({ session });

        const result = await client.createSession('new-session');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'CreateSession', name: 'new-session' },
        });
        expect(result).toEqual(session);
      });
    });

    describe('deleteSession', () => {
      it('should delete a session', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.deleteSession('session-id');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'DeleteSession', session_id: 'session-id' },
        });
      });
    });
  });

  describe('Pane Management', () => {
    describe('getPanes', () => {
      it('should get panes for a session', async () => {
        const panes: Pane[] = [
          {
            id: 'pane1',
            session_id: 'session1',
            pane_type: 'Terminal',
            title: 'Terminal 1',
            rows: 24,
            cols: 80,
            x: 0,
            y: 0,
            is_active: true,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ];
        mockedInvoke.mockResolvedValueOnce(panes);

        const result = await client.getPanes('session1');

        expect(mockedInvoke).toHaveBeenCalledWith('get_panes', { session_id: 'session1' });
        expect(result).toEqual(panes);
      });
    });

    describe('getPane', () => {
      it('should get a specific pane', async () => {
        const pane: Pane = {
          id: 'pane1',
          session_id: 'session1',
          pane_type: 'Terminal',
          title: 'Terminal 1',
          rows: 24,
          cols: 80,
          x: 0,
          y: 0,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockedInvoke.mockResolvedValueOnce(pane);

        const result = await client.getPane('pane1');

        expect(mockedInvoke).toHaveBeenCalledWith('get_pane', { pane_id: 'pane1' });
        expect(result).toEqual(pane);
      });
    });

    describe('createPane', () => {
      it('should create a pane with default options', async () => {
        const pane: Pane = {
          id: 'new-pane',
          session_id: 'session1',
          pane_type: 'Terminal',
          rows: 24,
          cols: 80,
          x: 0,
          y: 0,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockedInvoke.mockResolvedValueOnce({ pane });

        const result = await client.createPane('session1');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: {
            type: 'CreatePane',
            session_id: 'session1',
            pane_type: undefined,
            command: undefined,
            shell_type: undefined,
            name: undefined,
          },
        });
        expect(result).toEqual(pane);
      });

      it('should create a pane with custom options', async () => {
        const pane: Pane = {
          id: 'new-pane',
          session_id: 'session1',
          pane_type: 'Editor',
          title: 'Editor Pane',
          rows: 30,
          cols: 120,
          x: 0,
          y: 0,
          is_active: true,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        };
        mockedInvoke.mockResolvedValueOnce({ pane });

        const result = await client.createPane('session1', {
          paneType: 'Editor',
          command: 'vim',
          shellType: 'bash',
          name: 'Editor Pane',
        });

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: {
            type: 'CreatePane',
            session_id: 'session1',
            pane_type: 'Editor',
            command: 'vim',
            shell_type: 'bash',
            name: 'Editor Pane',
          },
        });
        expect(result).toEqual(pane);
      });
    });

    describe('selectBackendPane', () => {
      it('should select a backend pane', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.selectBackendPane('pane1');

        expect(mockedInvoke).toHaveBeenCalledWith('select_backend_pane', { pane_id: 'pane1' });
      });
    });
  });

  describe('Plugin Management', () => {
    describe('listPlugins', () => {
      it('should list all plugins', async () => {
        const plugins: PluginInfo[] = [
          {
            id: 'plugin1',
            name: 'Test Plugin',
            version: '1.0.0',
            author: 'Test Author',
            description: 'A test plugin',
            capabilities: ['terminal', 'editor'],
            loaded: true,
          },
        ];
        mockedInvoke.mockResolvedValueOnce(plugins);

        const result = await client.listPlugins();

        expect(mockedInvoke).toHaveBeenCalledWith('list_plugins');
        expect(result).toEqual(plugins);
      });
    });

    describe('getPluginMetadata', () => {
      it('should get plugin metadata', async () => {
        const metadata = {
          name: 'Test Plugin',
          version: '1.0.0',
          author: 'Test Author',
          description: 'A test plugin',
          capabilities: ['terminal', 'editor'],
        };
        mockedInvoke.mockResolvedValueOnce(metadata);

        const result = await client.getPluginMetadata('plugin1');

        expect(mockedInvoke).toHaveBeenCalledWith('get_plugin_metadata', { plugin_id: 'plugin1' });
        expect(result).toEqual(metadata);
      });
    });
  });

  describe('File Operations', () => {
    describe('listDirectory', () => {
      it('should list directory contents', async () => {
        const files = [
          { name: 'file1.txt', path: '/path/file1.txt', is_dir: false },
          { name: 'dir1', path: '/path/dir1', is_dir: true },
        ];
        mockedInvoke.mockResolvedValueOnce(files);

        const result = await client.listDirectory('/path');

        expect(mockedInvoke).toHaveBeenCalledWith('list_directory', { path: '/path' });
        expect(result).toEqual(files);
      });
    });

    describe('readFile', () => {
      it('should read file content', async () => {
        const content = 'File content here';
        mockedInvoke.mockResolvedValueOnce(content);

        const result = await client.readFile('/path/file.txt');

        expect(mockedInvoke).toHaveBeenCalledWith('read_file', { path: '/path/file.txt' });
        expect(result).toEqual(content);
      });
    });

    describe('saveFile', () => {
      it('should save file content', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.saveFile('/path/file.txt', 'New content');

        expect(mockedInvoke).toHaveBeenCalledWith('save_file', {
          path: '/path/file.txt',
          content: 'New content',
        });
      });
    });

    describe('watchFile', () => {
      it('should watch a file', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.watchFile('/path/file.txt');

        expect(mockedInvoke).toHaveBeenCalledWith('watch_file', {
          path: '/path/file.txt',
          recursive: false,
        });
      });

      it('should watch a directory recursively', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.watchFile('/path/dir', true);

        expect(mockedInvoke).toHaveBeenCalledWith('watch_file', {
          path: '/path/dir',
          recursive: true,
        });
      });
    });

    describe('unwatchFile', () => {
      it('should unwatch a file', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.unwatchFile('/path/file.txt');

        expect(mockedInvoke).toHaveBeenCalledWith('unwatch_file', { path: '/path/file.txt' });
      });
    });
  });

  describe('Command History', () => {
    describe('getCommandHistory', () => {
      it('should get command history', async () => {
        const history: CommandHistoryEntry[] = [
          {
            id: '1',
            command: 'ls -la',
            pane_id: 'pane1',
            session_id: 'session1',
            timestamp: '2024-01-01T00:00:00Z',
            exit_code: 0,
            output: 'file1.txt\nfile2.txt',
          },
        ];
        mockedInvoke.mockResolvedValueOnce(history);

        const result = await client.getCommandHistory();

        expect(mockedInvoke).toHaveBeenCalledWith('get_command_history', {
          pane_id: undefined,
          limit: undefined,
        });
        expect(result).toEqual(history);
      });

      it('should get command history with filters', async () => {
        const history: CommandHistoryEntry[] = [];
        mockedInvoke.mockResolvedValueOnce(history);

        const result = await client.getCommandHistory('pane1', 10);

        expect(mockedInvoke).toHaveBeenCalledWith('get_command_history', {
          pane_id: 'pane1',
          limit: 10,
        });
        expect(result).toEqual(history);
      });
    });

    describe('searchCommandHistory', () => {
      it('should search command history', async () => {
        const history: CommandHistoryEntry[] = [
          {
            id: '1',
            command: 'git status',
            timestamp: '2024-01-01T00:00:00Z',
          },
        ];
        mockedInvoke.mockResolvedValueOnce(history);

        const result = await client.searchCommandHistory('git');

        expect(mockedInvoke).toHaveBeenCalledWith('search_command_history', {
          pattern: 'git',
          pane_id: undefined,
        });
        expect(result).toEqual(history);
      });
    });
  });

  describe('State Management', () => {
    describe('persistState', () => {
      it('should persist state', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.persistState();

        expect(mockedInvoke).toHaveBeenCalledWith('persist_state');
      });
    });
  });

  describe('Terminal Operations', () => {
    it('should send input to a pane', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await client.execute({
        type: 'SendInput',
        pane_id: 'pane1',
        data: 'ls -la\n',
      });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'SendInput',
          pane_id: 'pane1',
          data: 'ls -la\n',
        },
      });
    });

    it('should run a command in a pane', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await client.execute({
        type: 'RunCommand',
        pane_id: 'pane1',
        command: 'echo "Hello World"',
      });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'RunCommand',
          pane_id: 'pane1',
          command: 'echo "Hello World"',
        },
      });
    });

    it('should clear a pane', async () => {
      mockedInvoke.mockResolvedValueOnce(undefined);

      await client.execute({
        type: 'ClearPane',
        pane_id: 'pane1',
      });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'ClearPane',
          pane_id: 'pane1',
        },
      });
    });
  });

  describe('Search Operations', () => {
    it('should search in project', async () => {
      const searchResults = {
        matches: [
          { file: 'file1.txt', line: 1, text: 'matching text' },
        ],
      };
      mockedInvoke.mockResolvedValueOnce(searchResults);

      const result = await client.execute({
        type: 'SearchProject',
        query: 'matching',
        options: {
          case_sensitive: false,
          regex: false,
        },
      });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'SearchProject',
          query: 'matching',
          options: {
            case_sensitive: false,
            regex: false,
          },
        },
      });
      expect(result).toEqual(searchResults);
    });

    it('should replace in file', async () => {
      mockedInvoke.mockResolvedValueOnce({ replacements: 5 });

      const result = await client.execute({
        type: 'ReplaceInFile',
        path: '/path/file.txt',
        search: 'old',
        replace: 'new',
        options: {
          whole_word: true,
        },
      });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'ReplaceInFile',
          path: '/path/file.txt',
          search: 'old',
          replace: 'new',
          options: {
            whole_word: true,
          },
        },
      });
      expect(result).toEqual({ replacements: 5 });
    });

    it('should use searchProject convenience method', async () => {
      const searchResults = [
        { file: 'file1.txt', line: 1, text: 'test' },
      ];
      mockedInvoke.mockResolvedValueOnce({ results: searchResults });

      const result = await client.searchProject('test', { regex: true });

      expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
        action: {
          type: 'SearchProject',
          query: 'test',
          options: { regex: true },
        },
      });
      expect(result).toEqual(searchResults);
    });
  });

  describe('Convenience Methods', () => {
    describe('closePane', () => {
      it('should close a pane', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.closePane('pane1');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'ClosePane', pane_id: 'pane1' },
        });
      });
    });

    describe('sendInput', () => {
      it('should send input to a pane', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.sendInput('pane1', 'ls -la\n');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'SendInput', pane_id: 'pane1', data: 'ls -la\n' },
        });
      });
    });

    describe('sendKeys', () => {
      it('should send keys to a pane', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.sendKeys('pane1', 'Ctrl+C');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'SendKeys', pane_id: 'pane1', keys: 'Ctrl+C' },
        });
      });
    });

    describe('getPaneOutput', () => {
      it('should get pane output', async () => {
        const output = 'Terminal output here';
        mockedInvoke.mockResolvedValueOnce({ output });

        const result = await client.getPaneOutput('pane1', 100);

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'GetPaneOutput', pane_id: 'pane1', lines: 100 },
        });
        expect(result).toEqual(output);
      });
    });

    describe('loadPlugin', () => {
      it('should load a plugin', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.loadPlugin('plugin1', { enabled: true });

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'LoadPlugin', id: 'plugin1', config: { enabled: true } },
        });
      });
    });

    describe('unloadPlugin', () => {
      it('should unload a plugin', async () => {
        mockedInvoke.mockResolvedValueOnce(undefined);

        await client.unloadPlugin('plugin1');

        expect(mockedInvoke).toHaveBeenCalledWith('manager_execute', {
          action: { type: 'UnloadPlugin', id: 'plugin1' },
        });
      });
    });
  });

  describe('Event Handling', () => {
    describe('onEvent', () => {
      it('should register event handler', () => {
        const handler = vi.fn();
        const unsubscribe = client.onEvent('SessionCreated', handler);

        expect(typeof unsubscribe).toBe('function');
      });

      it('should unregister event handler', () => {
        const handler = vi.fn();
        const unsubscribe = client.onEvent('SessionCreated', handler);

        unsubscribe();

        // Verify handler was removed by checking internal state
        const handlers = (client as any).eventHandlers.get('SessionCreated');
        expect(handlers).toBeUndefined();
      });

      it('should handle multiple handlers for same event', () => {
        const handler1 = vi.fn();
        const handler2 = vi.fn();

        const unsub1 = client.onEvent('SessionCreated', handler1);
        const unsub2 = client.onEvent('SessionCreated', handler2);

        const handlers = (client as any).eventHandlers.get('SessionCreated');
        expect(handlers?.size).toBe(2);

        unsub1();
        expect(handlers?.size).toBe(1);

        unsub2();
        expect((client as any).eventHandlers.get('SessionCreated')).toBeUndefined();
      });
    });

    describe('WebSocket handling', () => {
      let mockWebSocket: any;

      beforeEach(() => {
        mockWebSocket = {
          onopen: null,
          onmessage: null,
          onerror: null,
          onclose: null,
          close: vi.fn(),
          send: vi.fn(),
        };

        global.WebSocket = vi.fn(() => mockWebSocket) as any;
      });

      it('should connect to WebSocket', async () => {
        await client.connectWebSocket();

        expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:50505');
        expect(mockWebSocket.onopen).toBeDefined();
        expect(mockWebSocket.onmessage).toBeDefined();
        expect(mockWebSocket.onerror).toBeDefined();
        expect(mockWebSocket.onclose).toBeDefined();
      });

      it('should handle WebSocket messages', async () => {
        const handler = vi.fn();
        client.onEvent('SessionCreated', handler);

        await client.connectWebSocket();

        const event = {
          type: 'SessionCreated',
          session_id: '123',
          name: 'test-session',
        };

        // Simulate message
        mockWebSocket.onmessage({
          data: JSON.stringify({ event }),
        });

        expect(handler).toHaveBeenCalledWith(event);
      });

      it('should handle WebSocket parse errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await client.connectWebSocket();

        mockWebSocket.onmessage({
          data: 'invalid json',
        });

        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to parse WebSocket message:',
          expect.any(Error)
        );

        consoleSpy.mockRestore();
      });

      it('should handle WebSocket errors', async () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await client.connectWebSocket();

        const error = new Error('Connection failed');
        mockWebSocket.onerror(error);

        expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', error);

        consoleSpy.mockRestore();
      });

      it('should reconnect on WebSocket close', async () => {
        const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.useFakeTimers();

        await client.connectWebSocket();

        mockWebSocket.onclose();

        expect(consoleSpy).toHaveBeenCalledWith(
          'WebSocket connection closed, reconnecting in 5s...'
        );

        vi.advanceTimersByTime(5000);

        expect(global.WebSocket).toHaveBeenCalledTimes(2);

        consoleSpy.mockRestore();
        vi.useRealTimers();
      });
    });

    describe('dispose', () => {
      it('should clean up resources', () => {
        const handler = vi.fn();
        client.onEvent('SessionCreated', handler);

        client.dispose();

        expect((client as any).eventHandlers.size).toBe(0);
        expect((client as any).eventListeners.size).toBe(0);
      });
    });
  });
});