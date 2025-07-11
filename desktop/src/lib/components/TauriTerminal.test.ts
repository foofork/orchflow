import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import TauriTerminal from './TauriTerminal.svelte';
import { browser } from '$app/environment';
import { tmux } from '$lib/tauri/tmux';

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

// Mock terminal modules
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

const mockWebLinksAddon = vi.fn();
const mockSearchAddon = vi.fn();

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal)
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon)
}));

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: mockWebLinksAddon
}));

vi.mock('@xterm/addon-search', () => ({
  SearchAddon: mockSearchAddon
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

describe('TauriTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset terminal mock
    mockTerminal.write.mockClear();
    mockTerminal.writeln.mockClear();
    tmux.createPane.mockResolvedValue('pane-123');
    tmux.capturePane.mockResolvedValue('Terminal output\n$');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should render terminal container', async () => {
      const { container } = render(TauriTerminal);
      
      await waitFor(() => {
        const terminalContainer = container.querySelector('.terminal-container');
        expect(terminalContainer).toBeTruthy();
      });
    });

    it('should create pane on mount', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          command: 'bash'
        }
      });
      
      await waitFor(() => {
        expect(tmux.createPane).toHaveBeenCalledWith('test-session', 'bash');
      });
    });

    it('should use existing paneId if provided', async () => {
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'existing-pane'
        }
      });
      
      await waitFor(() => {
        expect(tmux.createPane).not.toHaveBeenCalled();
        expect(tmux.capturePane).toHaveBeenCalledWith('test-session', 'existing-pane');
      });
    });

    it('should initialize terminal with correct theme', async () => {
      const { Terminal } = await import('@xterm/xterm');
      
      render(TauriTerminal);
      
      await waitFor(() => {
        expect(Terminal).toHaveBeenCalledWith(
          expect.objectContaining({
            theme: expect.objectContaining({
              background: '#1e1e2e',
              foreground: '#cdd6f4'
            }),
            fontSize: 14,
            fontFamily: expect.any(String)
          })
        );
      });
    });

    it('should load terminal addons', async () => {
      render(TauriTerminal);
      
      await waitFor(() => {
        expect(mockTerminal.loadAddon).toHaveBeenCalledTimes(3); // fit, weblinks, search
      });
    });

    it('should write previous output to terminal', async () => {
      tmux.capturePane.mockResolvedValue('Previous command\n$ ');
      
      render(TauriTerminal);
      
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith('Previous command\n$ ');
      });
    });

    it('should set up resize observer', async () => {
      render(TauriTerminal);
      
      await waitFor(() => {
        expect(global.ResizeObserver).toHaveBeenCalled();
        const mockInstance = (global.ResizeObserver as any).mock.results[0].value;
        expect(mockInstance.observe).toHaveBeenCalled();
      });
    });
  });

  describe('User Input', () => {
    it('should send input to tmux on data event', async () => {
      let dataCallback: (data: string) => void = () => {};
      mockTerminal.onData.mockImplementation((cb) => {
        dataCallback = cb;
        return { dispose: vi.fn() };
      });
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.onData).toHaveBeenCalled();
      });
      
      // Simulate user typing
      dataCallback('ls -la');
      
      await waitFor(() => {
        expect(tmux.sendKeys).toHaveBeenCalledWith('test-session', 'pane-123', 'ls -la');
      });
    });

    it('should handle special keys', async () => {
      let dataCallback: (data: string) => void = () => {};
      mockTerminal.onData.mockImplementation((cb) => {
        dataCallback = cb;
        return { dispose: vi.fn() };
      });
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.onData).toHaveBeenCalled();
      });
      
      // Simulate Enter key
      dataCallback('\r');
      
      await waitFor(() => {
        expect(tmux.sendKeys).toHaveBeenCalledWith('test-session', 'pane-123', '\r');
      });
    });
  });

  describe('Terminal Resizing', () => {
    it('should resize terminal on window resize', async () => {
      let resizeCallback: (size: { cols: number; rows: number }) => void = () => {};
      mockTerminal.onResize.mockImplementation((cb) => {
        resizeCallback = cb;
        return { dispose: vi.fn() };
      });
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.onResize).toHaveBeenCalled();
      });
      
      // Simulate resize
      resizeCallback({ cols: 100, rows: 30 });
      
      await waitFor(() => {
        expect(tmux.resizePane).toHaveBeenCalledWith('test-session', 'pane-123', 100, 30);
      });
    });

    it('should fit terminal on container resize', async () => {
      const { container } = render(TauriTerminal);
      
      await waitFor(() => {
        const mockInstance = (global.ResizeObserver as any).mock.results[0].value;
        expect(mockInstance.observe).toHaveBeenCalled();
      });
      
      // Simulate ResizeObserver callback
      const observerCallback = (global.ResizeObserver as any).mock.calls[0][0];
      observerCallback([{ contentRect: { width: 800, height: 600 } }]);
      
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });
  });

  describe('Content Updates', () => {
    it('should poll for content updates', async () => {
      vi.useFakeTimers();
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      // Initial capture
      await waitFor(() => {
        expect(tmux.capturePane).toHaveBeenCalledTimes(1);
      });
      
      // Fast-forward 100ms (poll interval)
      vi.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(tmux.capturePane).toHaveBeenCalledTimes(2);
      });
      
      vi.useRealTimers();
    });

    it('should update terminal content when new output arrives', async () => {
      tmux.capturePane
        .mockResolvedValueOnce('Initial output\n$ ')
        .mockResolvedValueOnce('Initial output\n$ ls\nfile1.txt file2.txt\n$ ');
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.write).toHaveBeenCalledWith('Initial output\n$ ');
      });
      
      vi.useFakeTimers();
      vi.advanceTimersByTime(100);
      vi.useRealTimers();
      
      await waitFor(() => {
        expect(mockTerminal.clear).toHaveBeenCalled();
        expect(mockTerminal.write).toHaveBeenCalledWith('Initial output\n$ ls\nfile1.txt file2.txt\n$ ');
      });
    });
  });

  describe('Cleanup', () => {
    it('should clean up on unmount', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(mockFitAddon.dispose).toHaveBeenCalled();
    });

    it('should kill pane on unmount if created', async () => {
      tmux.createPane.mockResolvedValue('created-pane');
      
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      
      await waitFor(() => {
        expect(tmux.createPane).toHaveBeenCalled();
      });
      
      unmount();
      
      await waitFor(() => {
        expect(tmux.killPane).toHaveBeenCalledWith('test-session', 'created-pane');
      });
    });

    it('should not kill pane if using existing paneId', async () => {
      const { unmount } = render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'existing-pane'
        }
      });
      
      await waitFor(() => {
        expect(tmux.createPane).not.toHaveBeenCalled();
      });
      
      unmount();
      
      expect(tmux.killPane).not.toHaveBeenCalled();
    });

    it('should clear poll interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      const { unmount } = render(TauriTerminal);
      
      await waitFor(() => {
        expect(mockTerminal.open).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle pane creation failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmux.createPane.mockRejectedValue(new Error('Failed to create pane'));
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session'
        }
      });
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to create pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle capture pane failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmux.capturePane.mockRejectedValue(new Error('Failed to capture'));
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to capture pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle send keys failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      tmux.sendKeys.mockRejectedValue(new Error('Failed to send'));
      
      let dataCallback: (data: string) => void = () => {};
      mockTerminal.onData.mockImplementation((cb) => {
        dataCallback = cb;
        return { dispose: vi.fn() };
      });
      
      render(TauriTerminal, {
        props: {
          sessionName: 'test-session',
          paneId: 'pane-123'
        }
      });
      
      await waitFor(() => {
        expect(mockTerminal.onData).toHaveBeenCalled();
      });
      
      dataCallback('test');
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to send keys:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });
  });
});