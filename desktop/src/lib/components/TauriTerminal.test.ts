import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/svelte';
import { tick } from 'svelte';
import TauriTerminal from './TauriTerminal.svelte';
import { browser } from '$app/environment';
import { tmux } from '$lib/tauri/tmux';
import { TIMEOUT_CONFIG } from '$lib/utils/timeout';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock tmux
vi.mock('$lib/tauri/tmux', () => ({
  tmux: {
    createPane: vi.fn(),
    killPane: vi.fn(),
    sendKeys: vi.fn(),
    resizePane: vi.fn(),
    capturePane: vi.fn()
  }
}));

// Create mock instances
const mockTerminal = {
  loadAddon: vi.fn(),
  open: vi.fn(),
  write: vi.fn(),
  writeln: vi.fn(),
  clear: vi.fn(),
  onData: vi.fn(() => ({ dispose: vi.fn() })),
  onResize: vi.fn(() => ({ dispose: vi.fn() })),
  dispose: vi.fn(),
  resize: vi.fn(),
  focus: vi.fn(),
  blur: vi.fn(),
  buffer: { active: { type: 'normal' } },
  cols: 80,
  rows: 24
};

const mockFitAddon = {
  fit: vi.fn(),
  proposeDimensions: vi.fn(() => ({ cols: 80, rows: 24 })),
  activate: vi.fn(),
  dispose: vi.fn()
};

const mockWebLinksAddon = {
  activate: vi.fn(),
  dispose: vi.fn()
};

// Mock dynamic imports
vi.doMock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal)
}));

vi.doMock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon)
}));

vi.doMock('@xterm/addon-web-links', () => ({
  WebLinksAddon: vi.fn(() => mockWebLinksAddon)
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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Setup default mock responses
    (tmux.createPane as any).mockResolvedValue({ id: 'pane-123' });
    (tmux.capturePane as any).mockResolvedValue('Terminal output\n$');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render terminal container', async () => {
      const { container } = render(TauriTerminal);
      
      const terminalContainer = container.querySelector('.terminal-container');
      expect(terminalContainer).toBeTruthy();
    });

    it('should create pane on mount', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          command: 'bash'
        }
      });
      
      await waitForMount();
      
      expect(tmux.createPane).toHaveBeenCalledWith('test-session', 'bash');
    });

    it('should use existing paneId if provided', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'existing-pane'
        }
      });
      
      await waitForMount();
      
      expect(tmux.createPane).not.toHaveBeenCalled();
    });

    it('should initialize terminal with theme', async () => {
      render(TauriTerminal);
      
      await waitForMount();
      
      expect(mockTerminal.open).toHaveBeenCalled();
    });

    it('should set up resize observer', async () => {
      const mockObserve = vi.fn();
      const MockResizeObserver = vi.fn(() => ({
        observe: mockObserve,
        unobserve: vi.fn(),
        disconnect: vi.fn()
      }));
      global.ResizeObserver = MockResizeObserver as any;
      
      render(TauriTerminal);
      
      await waitForMount();
      
      expect(MockResizeObserver).toHaveBeenCalled();
      expect(mockObserve).toHaveBeenCalled();
    });
  });

  describe('User Input', () => {
    it('should send input to tmux on data event', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitForMount();
      
      // Get the data callback
      const dataCallback = mockTerminal.onData.mock.calls[0][0];
      await dataCallback('ls -la');
      
      expect(tmux.sendKeys).toHaveBeenCalledWith('pane-123', 'ls -la');
    });
  });

  describe('Content Updates', () => {
    it('should poll for content updates', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
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
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
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
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      
      await waitForMount();
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle pane creation failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (tmux.createPane as any).mockRejectedValue(new Error('Failed to create pane'));
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      
      await waitForMount();
      
      // Component should not crash
      expect(tmux.createPane).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });

    it('should handle capture pane failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmux.capturePane.mockRejectedValue(new Error('Failed to capture'));
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
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