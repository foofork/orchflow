import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { terminalIPC } from '../terminal-ipc';
import { invoke } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { createAsyncMock, createAsyncVoidMock, createTypedMock } from '@/test/mock-factory';

// Type for UnlistenFn
type UnlistenFn = () => void;

// Create typed mocks
const mockInvoke = createAsyncMock();
const mockEmit = createAsyncVoidMock();
const mockListen = createAsyncMock<UnlistenFn>();
const mockUnlisten = createTypedMock<UnlistenFn>();

// Mock the Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

vi.mock('@tauri-apps/api/event', () => ({
  emit: mockEmit,
  listen: mockListen
}));

describe('Terminal IPC Service', () => {
  let cleanup: Array<() => void> = [];
  let eventHandlers: Map<string, ((event: any) => void)[]>;

  beforeEach(() => {
    cleanup = [];
    eventHandlers = new Map();
    
    // Mock listen to capture event handlers - store multiple handlers per event
    mockListen.mockImplementation(async (event, handler) => {
      const existingHandlers = eventHandlers.get(event) || [];
      eventHandlers.set(event, [...existingHandlers, handler]);
      return mockUnlisten;
    });
    
    // Default mock implementations
    mockInvoke.mockResolvedValue(undefined);
    mockEmit.mockResolvedValue(undefined);
    
    // Clear terminals between tests
    (terminalIPC as any).terminals.clear();
    (terminalIPC as any).listeners.clear();
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    
    // Clean up any listeners by clearing the maps
    (terminalIPC as any).terminals.clear();
    (terminalIPC as any).listeners.clear();
    
    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('createTerminal', () => {
    it('should create a new terminal', async () => {
      const mockMetadata = {
        id: 'term-123',
        title: 'Terminal',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        process_id: 12345
      };
      
      mockInvoke.mockResolvedValue(mockMetadata);
      
      const result = await terminalIPC.createTerminal({
        terminalId: 'term-123',
        shell: '/bin/bash',
        cwd: '/home/user',
        env: { CUSTOM: 'value' }
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('create_streaming_terminal', {
        terminal_id: 'term-123',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        cwd: '/home/user',
        env: { CUSTOM: 'value' }
      });
      expect(result).toEqual(mockMetadata);
      expect(terminalIPC.getTerminals().get('term-123')).toEqual(mockMetadata);
    });

    it('should use default rows and cols when not provided', async () => {
      const mockMetadata = {
        id: 'term-456',
        title: 'Terminal',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };
      
      mockInvoke.mockResolvedValue(mockMetadata);
      
      const result = await terminalIPC.createTerminal({
        terminalId: 'term-456'
      });
      
      expect(mockInvoke).toHaveBeenCalledWith('create_streaming_terminal', {
        terminal_id: 'term-456',
        shell: undefined,
        rows: 24,
        cols: 80,
        cwd: undefined,
        env: undefined
      });
      expect(result).toEqual(mockMetadata);
    });

    it('should handle creation errors', async () => {
      const error = new Error('Backend error');
      mockInvoke.mockRejectedValue(error);
      
      await expect(terminalIPC.createTerminal({ terminalId: 'term-789' }))
        .rejects.toThrow('Failed to create terminal: Error: Backend error');
    });
  });

  describe('stopTerminal', () => {
    it('should stop a terminal and clean up', async () => {
      // First create a terminal
      const mockMetadata = {
        id: 'term-123',
        title: 'Terminal',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };
      
      mockInvoke.mockResolvedValueOnce(mockMetadata);
      await terminalIPC.createTerminal({ terminalId: 'term-123' });
      
      // Stop the terminal
      mockInvoke.mockResolvedValueOnce(undefined);
      await terminalIPC.stopTerminal('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('stop_streaming_terminal', {
        terminal_id: 'term-123'
      });
      expect(terminalIPC.getTerminals().has('term-123')).toBe(false);
    });
    

    it('should handle stop errors', async () => {
      const error = new Error('Terminal not found');
      mockInvoke.mockRejectedValue(error);
      
      await expect(terminalIPC.stopTerminal('invalid')).rejects.toThrow('Terminal not found');
    });
  });

  describe('sendInput', () => {
    it('should send text input to terminal', async () => {
      await terminalIPC.sendInput('term-123', 'ls -la\n');
      
      expect(mockInvoke).toHaveBeenCalledWith('send_terminal_input', {
        terminal_id: 'term-123',
        input_type: 'text',
        data: 'ls -la\n'
      });
    });

    it('should handle input errors', async () => {
      const error = new Error('Write failed');
      mockInvoke.mockRejectedValue(error);
      
      await expect(terminalIPC.sendInput('term-123', 'data')).rejects.toThrow('Write failed');
    });
  });

  describe('sendKey', () => {
    it('should send key input to terminal', async () => {
      await terminalIPC.sendKey('term-123', 'Enter', ['ctrl']);
      
      expect(mockInvoke).toHaveBeenCalledWith('send_terminal_key', {
        terminal_id: 'term-123',
        key: 'Enter',
        modifiers: ['ctrl']
      });
    });

    it('should send key without modifiers', async () => {
      await terminalIPC.sendKey('term-123', 'a');
      
      expect(mockInvoke).toHaveBeenCalledWith('send_terminal_key', {
        terminal_id: 'term-123',
        key: 'a',
        modifiers: []
      });
    });
  });

  describe('resize', () => {
    it('should resize terminal', async () => {
      await terminalIPC.resize('term-123', 30, 100);
      
      expect(mockInvoke).toHaveBeenCalledWith('resize_streaming_terminal', {
        terminal_id: 'term-123',
        rows: 30,
        cols: 100
      });
    });

    it('should handle resize errors', async () => {
      const error = new Error('Terminal not found');
      mockInvoke.mockRejectedValue(error);
      
      await expect(terminalIPC.resize('term-123', 30, 100))
        .rejects.toThrow('Terminal not found');
    });
  });

  describe('clearScrollback', () => {
    it('should clear terminal scrollback', async () => {
      await terminalIPC.clearScrollback('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('clear_terminal_scrollback', {
        terminal_id: 'term-123'
      });
    });

    it('should handle clear errors', async () => {
      const error = new Error('Terminal not found');
      mockInvoke.mockRejectedValue(error);
      
      await expect(terminalIPC.clearScrollback('term-123'))
        .rejects.toThrow('Terminal not found');
    });
  });

  describe('getState', () => {
    it('should get terminal state', async () => {
      const mockState = {
        id: 'term-123',
        rows: 24,
        cols: 80,
        cursor: { x: 0, y: 0, visible: true, blinking: true },
        mode: 'normal' as const,
        title: 'Terminal',
        working_dir: '/home/user',
        active: true,
        last_activity: new Date().toISOString()
      };
      
      mockInvoke.mockResolvedValue(mockState);
      
      const result = await terminalIPC.getState('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('get_terminal_state', {
        terminal_id: 'term-123'
      });
      expect(result).toEqual(mockState);
    });

    it('should return null on error', async () => {
      mockInvoke.mockRejectedValue(new Error('Not found'));
      
      const result = await terminalIPC.getState('term-123');
      expect(result).toBeNull();
    });
  });

  describe('subscribeToTerminal', () => {
    it('should register output handler', async () => {
      const handler = createTypedMock<(data: string) => void>();
      
      const unsubscribe = terminalIPC.subscribeToTerminal('term-123', {
        onOutput: handler
      });
      
      expect(mockListen).toHaveBeenCalledWith('terminal:output', expect.any(Function));
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate output event with base64 encoded data
      const outputEvent = {
        payload: {
          terminal_id: 'term-123',
          data: btoa('Hello World\n') // base64 encode
        }
      };
      
      const handlers = eventHandlers.get('terminal:output') || [];
      handlers.forEach(h => h(outputEvent));
      expect(handler).toHaveBeenCalledWith('Hello World\n');
      
      expect(typeof unsubscribe).toBe('function');
    });

    it('should filter events by terminal ID', async () => {
      const handler1 = createTypedMock<(data: string) => void>();
      const handler2 = createTypedMock<(data: string) => void>();
      
      terminalIPC.subscribeToTerminal('term-123', { onOutput: handler1 });
      terminalIPC.subscribeToTerminal('term-456', { onOutput: handler2 });
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send output to term-123
      const handlers = eventHandlers.get('terminal:output') || [];
      handlers.forEach(h => h({
        payload: {
          terminal_id: 'term-123',
          data: btoa('Data for term-123')
        }
      }));
      
      expect(handler1).toHaveBeenCalledWith('Data for term-123');
      expect(handler2).not.toHaveBeenCalled();
      
      // Send output to term-456
      handler1.mockClear();
      handlers.forEach(h => h({
        payload: {
          terminal_id: 'term-456',
          data: btoa('Data for term-456')
        }
      }));
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith('Data for term-456');
    });

    it('should register exit handler', async () => {
      const handler = createTypedMock<(code: number) => void>();
      
      terminalIPC.subscribeToTerminal('term-123', {
        onExit: handler
      });
      
      expect(mockListen).toHaveBeenCalledWith('terminal:exit', expect.any(Function));
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const handlers = eventHandlers.get('terminal:exit') || [];
      handlers.forEach(h => h({
        payload: {
          terminal_id: 'term-123',
          code: 0
        }
      }));
      
      expect(handler).toHaveBeenCalledWith(0);
    });

    it('should register error handler', async () => {
      const handler = createTypedMock<(error: string) => void>();
      
      terminalIPC.subscribeToTerminal('term-123', {
        onError: handler
      });
      
      expect(mockListen).toHaveBeenCalledWith('terminal:error', expect.any(Function));
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const handlers = eventHandlers.get('terminal:error') || [];
      handlers.forEach(h => h({
        payload: {
          terminal_id: 'term-123',
          error: 'Connection lost'
        }
      }));
      
      expect(handler).toHaveBeenCalledWith('Connection lost');
    });

    it('should register state change handler', async () => {
      const handler = createTypedMock<(state: any) => void>();
      
      terminalIPC.subscribeToTerminal('term-123', {
        onStateChange: handler
      });
      
      expect(mockListen).toHaveBeenCalledWith('terminal:state', expect.any(Function));
      
      const mockState = {
        id: 'term-123',
        rows: 24,
        cols: 80,
        cursor: { x: 0, y: 0, visible: true, blinking: true },
        mode: 'normal' as const,
        title: 'Terminal',
        active: true,
        last_activity: new Date().toISOString()
      };
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const handlers = eventHandlers.get('terminal:state') || [];
      handlers.forEach(h => h({
        payload: {
          terminal_id: 'term-123',
          state: mockState
        }
      }));
      
      expect(handler).toHaveBeenCalledWith(mockState);
    });
  });

  describe('broadcastInput', () => {
    it('should broadcast input to multiple terminals', async () => {
      const mockResults: Array<[string, boolean]> = [
        ['term-123', true],
        ['term-456', true],
        ['term-789', false]
      ];
      
      mockInvoke.mockResolvedValue(mockResults);
      
      const result = await terminalIPC.broadcastInput(
        ['term-123', 'term-456', 'term-789'],
        'echo "broadcast"\n'
      );
      
      expect(mockInvoke).toHaveBeenCalledWith('broadcast_terminal_input', {
        terminal_ids: ['term-123', 'term-456', 'term-789'],
        input_type: 'text',
        data: 'echo "broadcast"\n'
      });
      
      expect(result).toBeInstanceOf(Map);
      expect(result.get('term-123')).toBe(true);
      expect(result.get('term-456')).toBe(true);
      expect(result.get('term-789')).toBe(false);
    });
  });

  describe('getProcessInfo', () => {
    it('should get terminal process information', async () => {
      const mockInfo = {
        pid: 12345,
        name: 'bash',
        command: '/bin/bash',
        status: { Running: null }
      };
      
      mockInvoke.mockResolvedValue(mockInfo);
      
      const result = await terminalIPC.getProcessInfo('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('get_terminal_process_info', {
        terminal_id: 'term-123'
      });
      expect(result).toEqual(mockInfo);
    });
  });

  describe('getHealth', () => {
    it('should get terminal health status', async () => {
      const mockHealth = {
        terminal_id: 'term-123',
        status: { type: 'Healthy' },
        process_info: {
          pid: 12345,
          name: 'bash',
          command: '/bin/bash',
          status: { Running: null }
        },
        last_activity: new Date().toISOString(),
        uptime_seconds: 3600
      };
      
      mockInvoke.mockResolvedValue(mockHealth);
      
      const result = await terminalIPC.getHealth('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('monitor_terminal_health', {
        terminal_id: 'term-123'
      });
      expect(result).toEqual(mockHealth);
    });
  });

  describe('restartTerminal', () => {
    it('should restart terminal process', async () => {
      await terminalIPC.restartTerminal('term-123');
      
      expect(mockInvoke).toHaveBeenCalledWith('restart_terminal_process', {
        terminal_id: 'term-123'
      });
    });
  });

  describe('getTerminals', () => {
    it('should return all created terminals', async () => {
      // Create two terminals
      const mockMetadata1 = {
        id: 'term-123',
        title: 'Terminal 1',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };
      
      const mockMetadata2 = {
        id: 'term-456',
        title: 'Terminal 2',
        shell: '/bin/zsh',
        rows: 30,
        cols: 100,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };
      
      mockInvoke
        .mockResolvedValueOnce(mockMetadata1)
        .mockResolvedValueOnce(mockMetadata2);
      
      await terminalIPC.createTerminal({ terminalId: 'term-123' });
      await terminalIPC.createTerminal({ terminalId: 'term-456' });
      
      const terminals = terminalIPC.getTerminals();
      expect(terminals.size).toBe(2);
      expect(terminals.get('term-123')).toEqual(mockMetadata1);
      expect(terminals.get('term-456')).toEqual(mockMetadata2);
    });
  });

  describe('getStatesStore', () => {
    it('should return the terminal states store', () => {
      const store = terminalIPC.getStatesStore();
      expect(store).toBeDefined();
      expect(typeof store.subscribe).toBe('function');
      expect(typeof store.set).toBe('function');
      expect(typeof store.update).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should propagate backend errors', async () => {
      const backendError = new Error('Backend error: Terminal process crashed');
      mockInvoke.mockRejectedValue(backendError);
      
      await expect(terminalIPC.sendInput('term-123', 'data'))
        .rejects.toThrow('Backend error: Terminal process crashed');
    });

    it('should handle event payload validation', async () => {
      const handler = createTypedMock<(data: string) => void>();
      terminalIPC.subscribeToTerminal('term-123', { onOutput: handler });
      
      // Wait for async listen to resolve
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Send malformed event - missing terminal_id
      const handlers = eventHandlers.get('terminal:output') || [];
      handlers.forEach(h => h({
        payload: { data: btoa('test') }
      }));
      
      // Send malformed event - missing data
      handlers.forEach(h => h({
        payload: { terminal_id: 'term-123' }
      }));
      
      // Handler should not be called with invalid data
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('cleanup patterns', () => {
    it('should properly clean up subscriptions', async () => {
      const handler = createTypedMock<(data: string) => void>();
      
      const unsubscribe = terminalIPC.subscribeToTerminal('term-123', {
        onOutput: handler
      });
      
      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Call unsubscribe
      unsubscribe();
      
      // Verify cleanup (mock unlisten should have been called)
      expect(mockUnlisten).toHaveBeenCalled();
    });

    it('should handle multiple terminals cleanup', async () => {
      // Create multiple terminals
      const mockMetadata = {
        id: 'term-123',
        title: 'Terminal',
        shell: '/bin/bash',
        rows: 24,
        cols: 80,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString()
      };
      
      mockInvoke.mockResolvedValue(mockMetadata);
      
      await terminalIPC.createTerminal({ terminalId: 'term-123' });
      await terminalIPC.createTerminal({ terminalId: 'term-456' });
      await terminalIPC.createTerminal({ terminalId: 'term-789' });
      
      expect(terminalIPC.getTerminals().size).toBe(3);
      
      // Stop all terminals
      mockInvoke.mockResolvedValue(undefined);
      await terminalIPC.stopTerminal('term-123');
      await terminalIPC.stopTerminal('term-456');
      await terminalIPC.stopTerminal('term-789');
      
      expect(terminalIPC.getTerminals().size).toBe(0);
    });
  });
});