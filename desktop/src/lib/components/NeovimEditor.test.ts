import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import NeovimEditor from './NeovimEditor.svelte';
import { 
  createTypedMock, 
  createSyncMock, 
  createAsyncMock,
  createVoidMock,
  createAsyncVoidMock,
  MockPatterns 
} from '@/test/mock-factory';
import type {
  Terminal,
  FitAddon,
  TmuxClient,
  NeovimClient,
  NeovimClientConstructor,
  UserEvent,
  MockResizeObserver,
  MockResizeObserverConstructor,
  ResizeObserverCallback,
  NeovimEditorComponent
} from './NeovimEditor.types';

// Mock XTerm
const mockTerminal = {
  open: createVoidMock(),
  dispose: createVoidMock(),
  clear: createVoidMock(),
  write: createVoidMock<[string]>(),
  writeln: createVoidMock<[string]>(),
  onData: vi.fn().mockReturnValue({ dispose: vi.fn() }),
  loadAddon: createVoidMock<[addon: FitAddon]>(),
  cols: 80,
  rows: 24
};

const mockFitAddon: FitAddon = {
  fit: createVoidMock(),
  dispose: createVoidMock()
};

vi.mock('@xterm/xterm', () => ({
  Terminal: createTypedMock<() => Terminal>(() => mockTerminal)
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: createTypedMock<() => FitAddon>(() => mockFitAddon)
}));

// Mock tmux client
vi.mock('$lib/tauri/tmux', () => ({
  tmux: {
    createPane: createAsyncMock<[session: string, command: string], { id: string }>(),
    sendKeys: createAsyncVoidMock<[paneId: string, keys: string]>(),
    capturePane: createAsyncMock<[paneId: string, maxLines: number], string>(),
    resizePane: createAsyncVoidMock<[paneId: string, cols: number, rows: number]>(),
    killPane: createAsyncVoidMock<[paneId: string]>()
  }
}));

// Mock Neovim client
vi.mock('$lib/tauri/neovim', () => ({
  NeovimClient: {
    create: createAsyncMock<[instanceId: string], NeovimClient>()
  } as NeovimClientConstructor
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation((_callback: ResizeObserverCallback) => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
})) as unknown as MockResizeObserverConstructor;

describe('NeovimEditor Component', () => {
  let cleanup: Array<() => void> = [];
  let user: UserEvent;
  let mockTmux: TmuxClient;
  let mockNeovimClient: NeovimClient;
  let MockNeovimClient: NeovimClientConstructor;

  beforeEach(async () => {
    user = userEvent.setup();
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Get the mocked clients
    const tmuxModule = await import('$lib/tauri/tmux');
    const neovimModule = await import('$lib/tauri/neovim');
    mockTmux = tmuxModule.tmux;
    MockNeovimClient = neovimModule.NeovimClient;
    
    // Setup mock responses
    mockTmux.createPane.mockResolvedValue({ id: 'test-pane-1' });
    mockTmux.capturePane.mockResolvedValue('nvim output content');
    mockTmux.sendKeys.mockResolvedValue(undefined);
    mockTmux.resizePane.mockResolvedValue(undefined);
    mockTmux.killPane.mockResolvedValue(undefined);
    
    // Setup the resolved client instance
    mockNeovimClient = {
      openFile: createAsyncVoidMock<[filePath: string]>(),
      save: createAsyncVoidMock(),
      getBufferContent: createAsyncMock<[], string>('file content'),
      getMode: createAsyncMock<[], string>('n'),
      eval: createAsyncMock<[command: string], unknown>(null),
      close: createAsyncVoidMock()
    };
    
    MockNeovimClient.create.mockResolvedValue(mockNeovimClient);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.useRealTimers();
  });

  describe('Component Initialization', () => {
    it('should render editor container', () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      const editorContainer = container.querySelector('.editor-container');
      expect(editorContainer).toBeTruthy();
    });

    it('should display default title', () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Neovim');
    });

    it('should display custom title', () => {
      const { container, unmount } = render(NeovimEditor, { props: { title: 'Custom Editor' } });
      cleanup.push(unmount);
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Custom Editor');
    });

    it('should create terminal instance on mount', async () => {
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      expect(mockTerminal.open).toHaveBeenCalled();
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should create Neovim client on mount', async () => {
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      expect(MockNeovimClient.create).toHaveBeenCalled();
    });

    it('should create tmux pane with Neovim', async () => {
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.stringContaining('nvim --listen')
        );
      });
    });

    it('should open file if provided', async () => {
      const { unmount } = render(NeovimEditor, { props: { filePath: 'test.js' } });
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(1100); // Wait for Neovim to start
      
      await waitFor(() => {
        expect(mockNeovimClient.openFile).toHaveBeenCalledWith('test.js');
      });
    });

    it('should handle custom session name', async () => {
      const { unmount } = render(NeovimEditor, { props: { sessionName: 'custom-session' } });
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'custom-session',
          expect.any(String)
        );
      });
    });
  });

  describe('Terminal Integration', () => {
    it('should send terminal data to tmux pane', async () => {
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      await onDataCallback('test input');
      
      await waitFor(() => {
        expect(mockTmux.sendKeys).toHaveBeenCalledWith('test-pane-1', 'test input');
      });
    });

    it('should handle send keys errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.sendKeys.mockRejectedValue(new Error('Send failed'));
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      await onDataCallback('test');
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to send keys:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });

    it('should poll for terminal output', async () => {
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(200); // Advance past polling interval
      
      await waitFor(() => {
        expect(mockTmux.capturePane).toHaveBeenCalledWith('test-pane-1', 1000);
      });
    });

    it('should update terminal when content changes', async () => {
      mockTmux.capturePane.mockResolvedValueOnce('first content');
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(mockTerminal.clear).toHaveBeenCalled();
        expect(mockTerminal.write).toHaveBeenCalledWith('first content');
      });
      
      mockTerminal.clear.mockClear();
      mockTerminal.write.mockClear();
      
      mockTmux.capturePane.mockResolvedValueOnce('new content\nline 2');
      vi.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(mockTerminal.clear).toHaveBeenCalled();
        expect(mockTerminal.writeln).toHaveBeenCalledWith('new content');
        expect(mockTerminal.write).toHaveBeenCalledWith('line 2');
      });
    });

    it('should handle terminal resize', async () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      const resizeCallback = (global.ResizeObserver as unknown as MockResizeObserverConstructor).mock.calls[0][0];
      resizeCallback();
      
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
      
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(mockTmux.resizePane).toHaveBeenCalledWith('test-pane-1', 80, 24);
      });
    });
  });

  describe('Editor Actions', () => {
    it('should render save button', () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      const saveButton = container.querySelector('[title="Save"]');
      expect(saveButton).toBeTruthy();
      expect(saveButton?.textContent).toBe('💾');
    });

    it('should call save when save button clicked', async () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const saveButton = container.querySelector('[title="Save"]') as HTMLElement;
      await fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockNeovimClient.save).toHaveBeenCalled();
      });
    });

    it('should expose save method', async () => {
      const { component, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await component.save();
      
      await waitFor(() => {
        expect(mockNeovimClient.save).toHaveBeenCalled();
      });
    });

    it('should expose getBuffer method', async () => {
      const { component, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const content = await component.getBuffer();
      
      expect(mockNeovimClient.getBufferContent).toHaveBeenCalled();
      expect(content).toBe('file content');
    });
  });

  describe('Error Handling', () => {
    it('should handle Neovim initialization error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      MockNeovimClient.create.mockRejectedValue(new Error('Neovim start failed'));
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Neovim:', expect.any(Error));
        expect(mockTerminal.writeln).toHaveBeenCalledWith('\x1b[31mError: Failed to initialize Neovim\x1b[0m');
        expect(mockTerminal.writeln).toHaveBeenCalledWith('Error: Neovim start failed');
      });
      
      vi.restoreAllMocks();
    });

    it('should handle tmux pane creation error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.createPane.mockRejectedValue(new Error('Tmux error'));
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Neovim:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });

    it('should handle polling errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.capturePane.mockRejectedValue(new Error('Capture failed'));
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to capture pane:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });

    it('should handle resize errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.resizePane.mockRejectedValue(new Error('Resize failed'));
      
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      const resizeCallback = (global.ResizeObserver as unknown as MockResizeObserverConstructor).mock.calls[0][0];
      resizeCallback();
      
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to resize pane:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });
  });

  describe('Component Lifecycle', () => {
    it('should cleanup on unmount', async () => {
      const { unmount } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await unmount();
      
      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(mockNeovimClient.close).toHaveBeenCalled();
      expect(mockTmux.killPane).toHaveBeenCalledWith('test-pane-1');
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.killPane.mockRejectedValue(new Error('Kill failed'));
      
      const { unmount } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await unmount();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to kill pane:', expect.any(Error));
      });
      
      vi.restoreAllMocks();
    });

    it('should clear intervals on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      const { unmount } = render(NeovimEditor);
      
      await tick();
      
      await unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should disconnect resize observer on unmount', async () => {
      const { unmount } = render(NeovimEditor);
      
      await tick();
      
      const resizeObserver = (global.ResizeObserver as unknown as MockResizeObserverConstructor).mock.results[0].value as MockResizeObserver;
      
      await unmount();
      
      expect(resizeObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Instance Management', () => {
    it('should generate instanceId if not provided', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
      
      const { unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith('nvim-12345');
      });
      
      vi.restoreAllMocks();
    });

    it('should use provided instanceId', async () => {
      const { unmount } = render(NeovimEditor, { props: { instanceId: 'custom-id' } });
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith('custom-id');
      });
    });

    it('should handle custom session name', async () => {
      const { unmount } = render(NeovimEditor, { props: { sessionName: 'my-session' } });
      cleanup.push(unmount);
      
      await tick();
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith('my-session', expect.any(String));
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button titles', () => {
      const { container, unmount } = render(NeovimEditor);
      cleanup.push(unmount);
      
      const saveButton = container.querySelector('[title="Save"]');
      expect(saveButton).toBeTruthy();
    });
  });
});