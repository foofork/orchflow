import { describe, it, expect, vi, beforeEach, afterEach, type Mock, type MockedFunction } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import { tick } from 'svelte';
import StreamingTerminal from './StreamingTerminal.svelte';
import { invoke } from '@tauri-apps/api/core';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { createTypedMock, createAsyncMock, createVoidMock } from '@/test/mock-factory';
import type { ITerminalAddon } from '@xterm/xterm';
import type {
  TerminalInstance,
  FitAddonInstance,
  WebglAddonInstance,
  SearchAddonInstance,
  WebLinksAddonInstance,
  TerminalFactoryResult,
  TerminalFactory,
  MockResizeObserverInstance,
  TerminalOutputEvent,
  TerminalExitEvent,
  TerminalErrorEvent,
  StreamingTerminalComponent
} from './StreamingTerminal.types';

// Mock the Tauri API
vi.mock('@tauri-apps/api/core');
vi.mock('@tauri-apps/api/event');

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Store ResizeObserver instances globally for tests
let resizeObserverInstances: MockResizeObserverInstance[] = [];

describe('StreamingTerminal', () => {
  let cleanup: Array<() => void> = [];
  let mockUnlisten: MockedFunction<() => void>;
  let eventHandlers: Map<string, (event: TerminalOutputEvent | TerminalExitEvent | TerminalErrorEvent) => void>;
  let mockTerminal: TerminalInstance;
  let mockFitAddon: FitAddonInstance;
  let mockWebglAddon: WebglAddonInstance;
  let mockSearchAddon: SearchAddonInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
    
    // Reset ResizeObserver instances
    resizeObserverInstances = [];
    
    // Setup ResizeObserver mock
    global.ResizeObserver = vi.fn().mockImplementation((callback: ResizeObserverCallback) => {
      const instance: MockResizeObserverInstance = {
        observe: createVoidMock(),
        unobserve: createVoidMock(),
        disconnect: createVoidMock(),
        callback
      };
      resizeObserverInstances.push(instance);
      return instance as unknown as ResizeObserver;
    });
    eventHandlers = new Map();
    
    // Mock unlisten function
    mockUnlisten = createVoidMock();
    
    // Mock listen to capture event handlers and track unlisten calls
    vi.mocked(listen).mockImplementation(async (event, handler) => {
      eventHandlers.set(event, handler as (event: TerminalOutputEvent | TerminalExitEvent | TerminalErrorEvent) => void);
      return mockUnlisten as UnlistenFn;
    });
    
    // Default mock implementations
    vi.mocked(invoke).mockResolvedValue(undefined);
    vi.mocked(emit).mockResolvedValue(undefined);
    
    // Create mock terminal and addons
    mockTerminal = {
      rows: 24,
      cols: 80,
      element: document.createElement('div'),
      buffer: { active: { type: 'normal' } },
      open: createVoidMock<[container: HTMLElement]>(),
      write: createVoidMock<[data: string]>(),
      writeln: createVoidMock<[data: string]>(),
      clear: createVoidMock(),
      focus: createVoidMock(),
      blur: createVoidMock(),
      dispose: createVoidMock(),
      onData: createTypedMock<(callback: (data: string) => void) => { dispose: () => void }>().mockImplementation((callback) => {
        mockTerminal._dataCallback = callback;
        return { dispose: createVoidMock() };
      }),
      onResize: createTypedMock<(callback: (data: { cols: number; rows: number }) => void) => { dispose: () => void }>().mockImplementation((callback) => {
        mockTerminal._resizeCallback = callback;
        return { dispose: createVoidMock() };
      }),
      resize: createTypedMock<(cols: number, rows: number) => void>().mockImplementation((cols, rows) => {
        mockTerminal.cols = cols;
        mockTerminal.rows = rows;
      }),
      loadAddon: createVoidMock<[addon: ITerminalAddon]>()
    } as TerminalInstance;

    mockFitAddon = {
      fit: createVoidMock(),
      dispose: createVoidMock()
    } as FitAddonInstance;

    mockWebglAddon = {
      onContextLoss: createTypedMock<(callback: () => void) => void>().mockImplementation((callback) => {
        mockWebglAddon._contextLossCallback = callback;
      }),
      dispose: createVoidMock()
    } as WebglAddonInstance;

    mockSearchAddon = {
      findNext: createVoidMock<[term: string]>(),
      dispose: createVoidMock()
    } as SearchAddonInstance;
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.restoreAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render with default props', async () => {
      const { container } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-1'
        }
      });
      
      const terminalContainer = container.querySelector('.terminal-container');
      expect(terminalContainer).toBeTruthy();
    });

    it('should render in test mode', async () => {
      const { container, getByText } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-1',
          testMode: true
        }
      });
      
      expect(getByText('Terminal test-terminal-1 (Test Mode)')).toBeTruthy();
    });

    it('should initialize terminal with custom props', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon),
        WebglAddon: createTypedMock<() => WebglAddonInstance>().mockReturnValue(mockWebglAddon),
        SearchAddon: createTypedMock<() => SearchAddonInstance>().mockReturnValue(mockSearchAddon),
        WebLinksAddon: createTypedMock<() => WebLinksAddonInstance>()
      });

      const { container } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-2',
          title: 'Custom Terminal',
          initialRows: 30,
          initialCols: 100,
          shell: '/bin/zsh',
          cwd: '/home/user',
          env: { CUSTOM_VAR: 'value' },
          terminalFactory: mockFactory
        }
      });

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });
    });

    it('should create backend terminal with correct parameters', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon)
      });

      render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-3',
          shell: '/bin/bash',
          cwd: '/workspace',
          env: { PATH: '/usr/bin' },
          terminalFactory: mockFactory
        }
      });

      await waitFor(() => {
        expect(invoke).toHaveBeenCalledWith('create_terminal', {
          id: 'test-terminal-3',
          shell: '/bin/bash',
          cwd: '/workspace',
          env: { PATH: '/usr/bin' },
          rows: 24,
          cols: 80
        });
      });
    });

    it('should handle terminal factory errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockFactory = createAsyncMock<[], TerminalFactoryResult | null>();
      mockFactory.mockRejectedValue(new Error('Factory failed'));

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-error',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to initialize terminal:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Terminal Addons', () => {
    it('should load all addons when available', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon),
        WebglAddon: createTypedMock<() => WebglAddonInstance>().mockReturnValue(mockWebglAddon),
        SearchAddon: createTypedMock<() => SearchAddonInstance>().mockReturnValue(mockSearchAddon),
        WebLinksAddon: createTypedMock<() => WebLinksAddonInstance>()
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-addons',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(4); // fit, webgl, search, weblinks
      });
    });

    it('should handle WebGL addon failure gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const failingWebglAddon = {
        dispose: createVoidMock()
      };
      
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: {
          ...mockTerminal,
          loadAddon: createTypedMock<(addon: ITerminalAddon) => void>().mockImplementation((addon) => {
            if (addon === failingWebglAddon) {
              throw new Error('WebGL not supported');
            }
          })
        },
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon),
        WebglAddon: createTypedMock<() => WebglAddonInstance>().mockReturnValue(failingWebglAddon as WebglAddonInstance)
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-webgl-fail',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'WebGL addon failed to load, using canvas renderer',
          expect.any(Error)
        );
      });

      consoleWarnSpy.mockRestore();
    });

    it('should handle WebGL context loss', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        WebglAddon: createTypedMock<() => WebglAddonInstance>().mockReturnValue(mockWebglAddon)
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-context-loss',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockWebglAddon.onContextLoss).toHaveBeenCalled();
      });

      // Simulate context loss
      mockWebglAddon._contextLossCallback?.();
      expect(mockWebglAddon.dispose).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    it('should handle terminal input', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-input',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockTerminal.onData).toHaveBeenCalled();
      });

      // Simulate user input
      await mockTerminal._dataCallback?.('hello world');

      expect(invoke).toHaveBeenCalledWith('write_terminal', {
        terminalId: 'test-terminal-input',
        data: 'hello world'
      });
    });

    it('should not send input to backend in test mode', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-test-mode',
          testMode: true,
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockTerminal.onData).toHaveBeenCalled();
      });

      // Clear previous invoke calls
      vi.mocked(invoke).mockClear();

      // Simulate user input
      await mockTerminal._dataCallback?.('test input');

      expect(invoke).not.toHaveBeenCalled();
    });

    it('should handle terminal resize', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-resize',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockTerminal.onResize).toHaveBeenCalled();
      });

      // Simulate resize
      await mockTerminal._resizeCallback?.({ cols: 120, rows: 40 });

      expect(invoke).toHaveBeenCalledWith('resize_terminal', {
        terminalId: 'test-terminal-resize',
        rows: 40,
        cols: 120
      });
    });

    it('should handle terminal output events', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-output',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(listen).toHaveBeenCalledWith('terminal-output', expect.any(Function));
      });

      // Simulate terminal output event
      const outputHandler = eventHandlers.get('terminal-output');
      outputHandler?.({
        payload: {
          data: {
            terminal_id: 'test-terminal-output',
            data: 'Hello from backend'
          }
        }
      });

      expect(mockTerminal.write).toHaveBeenCalledWith('Hello from backend');
    });

    it('should handle terminal exit events', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-exit',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(listen).toHaveBeenCalledWith('terminal-exit', expect.any(Function));
      });

      // Simulate terminal exit event
      const exitHandler = eventHandlers.get('terminal-exit');
      exitHandler?.({
        payload: {
          data: {
            terminal_id: 'test-terminal-exit',
            code: 0
          }
        }
      });

      expect(mockTerminal.write).toHaveBeenCalledWith('\r\nProcess exited with code 0\r\n');
    });

    it('should handle terminal error events', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-error',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(listen).toHaveBeenCalledWith('terminal-error', expect.any(Function));
      });

      // Simulate terminal error event
      const errorHandler = eventHandlers.get('terminal-error');
      errorHandler?.({
        payload: {
          data: {
            terminal_id: 'test-terminal-error',
            error: 'Command not found'
          }
        }
      });

      expect(mockTerminal.write).toHaveBeenCalledWith('\r\nError: Command not found\r\n');
    });

    it('should ignore events for other terminals', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-1',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(listen).toHaveBeenCalled();
      });

      // Clear write calls
      mockTerminal.write.mockClear();

      // Simulate output for different terminal
      const outputHandler = eventHandlers.get('terminal-output');
      outputHandler?.({
        payload: {
          data: {
            terminal_id: 'other-terminal',
            data: 'Should not appear'
          }
        }
      });

      expect(mockTerminal.write).not.toHaveBeenCalled();
    });
  });

  describe('Resize Observer', () => {
    it('should set up resize observer when fit addon is available', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon)
      });

      const { container, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-resize-observer',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      // Get the ResizeObserver instance
      expect(resizeObserverInstances.length).toBeGreaterThan(0);
      
      const resizeObserver = resizeObserverInstances[resizeObserverInstances.length - 1];
      expect(resizeObserver.observe).toHaveBeenCalled();
    });

    it('should trigger fit on resize', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon)
      });

      const { container, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-fit',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });

      // Get the ResizeObserver instance and trigger resize
      const resizeObserver = resizeObserverInstances[resizeObserverInstances.length - 1];
      
      // Clear previous fit calls
      mockFitAddon.fit.mockClear();
      
      // Trigger resize callback
      const callback = resizeObserver.callback;
      if (callback) {
        callback([], resizeObserver);
      }
      
      // Fit should be called again
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Public Methods', () => {
    it('should expose write method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-write',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.write('test data');
      expect(mockTerminal.write).toHaveBeenCalledWith('test data');
    });

    it('should expose clear method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-clear',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.clear();
      expect(mockTerminal.clear).toHaveBeenCalled();
    });

    it('should expose focus method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-focus',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.focus();
      expect(mockTerminal.focus).toHaveBeenCalled();
    });

    it('should expose blur method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-blur',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.blur();
      expect(mockTerminal.blur).toHaveBeenCalled();
    });

    it('should expose search method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        SearchAddon: createTypedMock<() => SearchAddonInstance>().mockReturnValue(mockSearchAddon)
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-search',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.search('test pattern');
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('test pattern');
    });

    it('should expose resize method', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-resize-method',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      component.resize(100, 50);
      expect(mockTerminal.resize).toHaveBeenCalledWith(100, 50);
    });

    it('should handle methods when terminal is not initialized', () => {
      const { component, unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-uninitialized',
          terminalFactory: createAsyncMock<[], null>(null)
        }
      });
      cleanup.push(unmount);

      // These should not throw errors
      expect(() => {
        component.write('test');
        component.clear();
        component.focus();
        component.blur();
        component.search('test');
        component.resize(80, 24);
      }).not.toThrow();
    });
  });

  describe('Cleanup', () => {
    it('should clean up on destroy', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal,
        FitAddon: createTypedMock<() => FitAddonInstance>().mockReturnValue(mockFitAddon),
        WebglAddon: createTypedMock<() => WebglAddonInstance>().mockReturnValue(mockWebglAddon),
        SearchAddon: createTypedMock<() => SearchAddonInstance>().mockReturnValue(mockSearchAddon)
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-cleanup',
          terminalFactory: mockFactory,
          testMode: false // Enable backend listeners for this test
        }
      });

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      // Wait for event listeners to be set up
      await waitFor(() => {
        expect(listen).toHaveBeenCalledTimes(3); // 3 event listeners should be set up
      });

      // Get resize observer instance
      const resizeObserver = resizeObserverInstances[resizeObserverInstances.length - 1];

      unmount();

      // Check all cleanup happened
      expect(mockUnlisten).toHaveBeenCalledTimes(3); // 3 event listeners
      expect(resizeObserver.disconnect).toHaveBeenCalled();
      expect(mockSearchAddon.dispose).toHaveBeenCalled();
      expect(mockWebglAddon.dispose).toHaveBeenCalled();
      expect(mockFitAddon.dispose).toHaveBeenCalled();
      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(invoke).toHaveBeenCalledWith('close_terminal', { terminalId: 'test-terminal-cleanup' });
    });

    it('should not close backend terminal in test mode', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-testmode-cleanup',
          testMode: true,
          terminalFactory: mockFactory
        }
      });

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      // Clear previous invoke calls
      vi.mocked(invoke).mockClear();

      unmount();

      // Should not call close_terminal in test mode
      expect(invoke).not.toHaveBeenCalledWith('close_terminal', expect.any(Object));
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      // Mock invoke to reject on 'close_terminal' call
      vi.mocked(invoke).mockImplementation((command) => {
        if (command === 'close_terminal') {
          return Promise.reject(new Error('Close failed'));
        }
        return Promise.resolve();
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-cleanup-error',
          terminalFactory: mockFactory
        }
      });

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      unmount();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(new Error('Close failed'));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle direct terminal instance from factory', async () => {
      const mockFactory = createAsyncMock<[], TerminalInstance>(mockTerminal);

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-direct',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled();
      });
    });

    it('should handle missing container', async () => {
      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      // Temporarily mock the container binding
      const originalBind = (Element.prototype as Element & { bind?: () => void }).bind;
      (Element.prototype as Element & { bind?: () => void }).bind = createVoidMock();

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-no-container',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(mockFactory).toHaveBeenCalled();
      });

      // Restore
      (Element.prototype as Element & { bind?: () => void }).bind = originalBind;
    });

    it('should handle invoke errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      vi.mocked(invoke).mockRejectedValue(new Error('Backend error'));

      const mockFactory = createAsyncMock<[], TerminalFactoryResult>({
        term: mockTerminal
      });

      const { unmount } = render(StreamingTerminal, {
        props: {
          terminalId: 'test-terminal-invoke-error',
          terminalFactory: mockFactory
        }
      });
      cleanup.push(unmount);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to create backend terminal:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });
});