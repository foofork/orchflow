import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/svelte';
import { tick } from 'svelte';
import TauriTerminal from './TauriTerminal.svelte';
import { browser } from '$app/environment';
import { tmux } from '$lib/tauri/tmux';
import { TIMEOUT_CONFIG } from '$lib/utils/timeout';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock tmux
vi.mock('$lib/tauri/tmux', () => ({
  tmux: {
    createPane: createAsyncMock<[string, string?], { id: string }>(),
    killPane: createAsyncMock<[string], void>(),
    sendKeys: createAsyncMock<[string, string], void>(),
    resizePane: createAsyncMock<[string, number, number], void>(),
    capturePane: createAsyncMock<[string], string>()
  }
}));

// Create mock instances
const mockTerminal = {
  loadAddon: createSyncMock<[any], void>(),
  open: createSyncMock<[HTMLElement], void>(),
  write: createSyncMock<[string], void>(),
  writeln: createSyncMock<[string], void>(),
  clear: createSyncMock<[], void>(),
  onData: createSyncMock<[Function], { dispose: Function }>(() => ({ dispose: createSyncMock<[], void>() })),
  onResize: createSyncMock<[Function], { dispose: Function }>(() => ({ dispose: createSyncMock<[], void>() })),
  dispose: createSyncMock<[], void>(),
  resize: createSyncMock<[number, number], void>(),
  focus: createSyncMock<[], void>(),
  blur: createSyncMock<[], void>(),
  buffer: { active: { type: 'normal' } },
  cols: 80,
  rows: 24
};

const mockFitAddon = {
  fit: createSyncMock<[], void>(),
  proposeDimensions: createSyncMock<[], { cols: number; rows: number }>(() => ({ cols: 80, rows: 24 })),
  activate: createSyncMock<[any], void>(),
  dispose: createSyncMock<[], void>()
};

const mockWebLinksAddon = {
  activate: createSyncMock<[any], void>(),
  dispose: createSyncMock<[], void>()
};

// Mock dynamic imports
vi.doMock('@xterm/xterm', () => ({
  Terminal: createSyncMock<[any?], typeof mockTerminal>(() => mockTerminal)
}));

vi.doMock('@xterm/addon-fit', () => ({
  FitAddon: createSyncMock<[any?], typeof mockFitAddon>(() => mockFitAddon)
}));

vi.doMock('@xterm/addon-web-links', () => ({
  WebLinksAddon: createSyncMock<[any?], typeof mockWebLinksAddon>(() => mockWebLinksAddon)
}));

vi.doMock('@xterm/xterm/css/xterm.css', () => ({}));

// Helper to wait for component mount and dynamic imports
async function waitForMount() {
  await act(async () => {
    await tick();
    await new Promise(resolve => setTimeout(resolve, 100));
  });
}

describe('TauriTerminal', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    cleanup = [];
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mock responses
    (tmux.createPane as any).mockResolvedValue({ id: 'pane-123' });
    (tmux.capturePane as any).mockResolvedValue('Terminal output\n$');
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render terminal container', async () => {
      const { container, unmount } = render(TauriTerminal);
      cleanup.push(unmount);
      
      const terminalContainer = container.querySelector('.terminal-container');
      expect(terminalContainer).toBeTruthy();
    });

    it('should create pane on mount', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          command: 'bash'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      expect(tmux.createPane).toHaveBeenCalledWith('test-session', 'bash');
    });

    it('should use existing paneId if provided', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'existing-pane'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      expect(tmux.createPane).not.toHaveBeenCalled();
    });

    it('should initialize terminal with theme', async () => {
      const { unmount } = render(TauriTerminal);
      cleanup.push(unmount);
      
      await waitForMount();
      
      expect(mockTerminal.open).toHaveBeenCalled();
    });

    it('should set up resize observer', async () => {
      const mockObserve = createSyncMock<[Element], void>();
      const MockResizeObserver = createSyncMock<[Function], {
        observe: Function;
        unobserve: Function;
        disconnect: Function;
      }>(() => ({
        observe: mockObserve,
        unobserve: createSyncMock<[Element], void>(),
        disconnect: createSyncMock<[], void>()
      }));
      global.ResizeObserver = MockResizeObserver as any;
      
      const { unmount } = render(TauriTerminal);
      cleanup.push(unmount);
      
      await waitForMount();
      
      expect(MockResizeObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('User Input', () => {
    it('should send input to tmux on data event', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      // Get the data callback
      const dataCallback = mockTerminal.onData.mock.calls[0][0];
      await dataCallback('ls -la');
      
      expect(tmux.sendKeys).toHaveBeenCalledWith('pane-123', 'ls -la');
    });
  });

  describe('Content Updates', () => {
    it('should poll for content updates', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      // Fast forward time to trigger polling (using TIMEOUT_CONFIG.TERMINAL_POLL)
      await act(async () => {
        vi.advanceTimersByTime(TIMEOUT_CONFIG.TERMINAL_POLL + 100);
      });
      
      expect(tmux.capturePane).toHaveBeenCalledWith('pane-123');
    });

    it('should update terminal content when new output arrives', async () => {
      tmux.capturePane
        .mockResolvedValueOnce('Initial output\n$ ')
        .mockResolvedValueOnce('New output\n$ ');
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      // Trigger first poll (using TIMEOUT_CONFIG.TERMINAL_POLL)
      await act(async () => {
        vi.advanceTimersByTime(TIMEOUT_CONFIG.TERMINAL_POLL + 100);
        await tick();
      });
      
      // Trigger second poll with new content
      await act(async () => {
        vi.advanceTimersByTime(TIMEOUT_CONFIG.TERMINAL_POLL + 100);
        await tick();
      });
      
      expect(mockTerminal.clear).toHaveBeenCalled();
      expect(mockTerminal.write).toHaveBeenCalledWith('New output\n$ ');
    });
  });

  describe('Cleanup', () => {
    it('should clean up on unmount', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      
      await waitForMount();
      
      unmount();
      
      expect(mockTerminal.dispose).toHaveBeenCalled();
    });

    it('should clear poll interval on unmount', async () => {
      const clearIntervalSpy = createTypedMock<[NodeJS.Timeout], void>();
      vi.spyOn(global, 'clearInterval').mockImplementation(clearIntervalSpy);
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle pane creation failure gracefully', async () => {
      const consoleSpy = createTypedMock<[any, ...any[]], void>();
      vi.spyOn(console, 'error').mockImplementation(consoleSpy);
      (tmux.createPane as any).mockRejectedValue(new Error('Failed to create pane'));
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      // Component should not crash
      expect(tmux.createPane).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle capture pane failure gracefully', async () => {
      const consoleSpy = createTypedMock<[any, ...any[]], void>();
      vi.spyOn(console, 'error').mockImplementation(consoleSpy);
      tmux.capturePane.mockRejectedValue(new Error('Failed to capture'));
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      cleanup.push(unmount);
      
      await waitForMount();
      
      // Trigger polling (using TIMEOUT_CONFIG.TERMINAL_POLL)
      await act(async () => {
        vi.advanceTimersByTime(TIMEOUT_CONFIG.TERMINAL_POLL + 100);
        await tick();
      });
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to capture pane:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });
});