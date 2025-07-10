import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import NeovimEditor from './NeovimEditor.svelte';

// Mock XTerm
const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  clear: vi.fn(),
  write: vi.fn(),
  writeln: vi.fn(),
  onData: vi.fn(),
  loadAddon: vi.fn(),
  cols: 80,
  rows: 24
};

const mockFitAddon = {
  fit: vi.fn()
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTerminal)
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => mockFitAddon)
}));

// Mock tmux client
vi.mock('$lib/tauri/tmux', () => ({
  tmux: {
    createPane: vi.fn(),
    sendKeys: vi.fn(),
    capturePane: vi.fn(),
    resizePane: vi.fn(),
    killPane: vi.fn()
  }
}));

// Mock Neovim client
vi.mock('$lib/tauri/neovim', () => ({
  NeovimClient: {
    create: vi.fn(() => Promise.resolve({
      openFile: vi.fn(),
      save: vi.fn(),
      getBufferContent: vi.fn(),
      getMode: vi.fn(),
      eval: vi.fn(),
      close: vi.fn()
    }))
  }
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn(() => ({
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn()
}));

describe('NeovimEditor Component', () => {
  let user: any;
  let mockTmux: any;
  let mockNeovimClient: any;
  let MockNeovimClient: any;

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
      openFile: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
      getBufferContent: vi.fn().mockResolvedValue('file content'),
      getMode: vi.fn().mockResolvedValue('n'),
      eval: vi.fn().mockResolvedValue(null),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    MockNeovimClient.create.mockResolvedValue(mockNeovimClient);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Initialization', () => {
    it('should render editor container', () => {
      const { container } = render(NeovimEditor);
      
      const editorContainer = container.querySelector('.editor-container');
      expect(editorContainer).toBeTruthy();
    });

    it('should display default title', () => {
      const { container } = render(NeovimEditor);
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Neovim');
    });

    it('should display custom title', () => {
      const { container } = render(NeovimEditor, { props: { title: 'Custom Editor' } });
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Custom Editor');
    });

    it('should create terminal instance on mount', async () => {
      render(NeovimEditor);
      
      await tick();
      
      expect(mockTerminal.open).toHaveBeenCalled();
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should create Neovim client on mount', async () => {
      render(NeovimEditor);
      
      await tick();
      
      expect(MockNeovimClient.create).toHaveBeenCalled();
    });

    it('should create tmux pane with Neovim', async () => {
      render(NeovimEditor);
      
      await tick();
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.stringContaining('nvim --listen')
        );
      });
    });

    it('should open file if provided', async () => {
      render(NeovimEditor, { props: { filePath: 'test.js' } });
      
      await tick();
      vi.advanceTimersByTime(1100); // Wait for Neovim to start
      
      await waitFor(() => {
        expect(mockNeovimClient.openFile).toHaveBeenCalledWith('test.js');
      });
    });

    it('should handle custom session name', async () => {
      render(NeovimEditor, { props: { sessionName: 'custom-session' } });
      
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
      render(NeovimEditor);
      
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
      
      render(NeovimEditor);
      
      await tick();
      
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      await onDataCallback('test');
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to send keys:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should poll for terminal output', async () => {
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(200); // Advance past polling interval
      
      await waitFor(() => {
        expect(mockTmux.capturePane).toHaveBeenCalledWith('test-pane-1', 1000);
      });
    });

    it('should update terminal when content changes', async () => {
      mockTmux.capturePane.mockResolvedValueOnce('first content');
      
      render(NeovimEditor);
      
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
      const { container } = render(NeovimEditor);
      
      await tick();
      
      const resizeCallback = (global.ResizeObserver as any).mock.calls[0][0];
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
      const { container } = render(NeovimEditor);
      
      const saveButton = container.querySelector('[title="Save"]');
      expect(saveButton).toBeTruthy();
      expect(saveButton?.textContent).toBe('💾');
    });

    it('should call save when save button clicked', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const saveButton = container.querySelector('[title="Save"]') as HTMLElement;
      await fireEvent.click(saveButton);
      
      await waitFor(() => {
        expect(mockNeovimClient.save).toHaveBeenCalled();
      });
    });

    it('should expose save method', async () => {
      const { component } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await component.save();
      
      await waitFor(() => {
        expect(mockNeovimClient.save).toHaveBeenCalled();
      });
    });

    it('should expose getBuffer method', async () => {
      const { component } = render(NeovimEditor);
      
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
      
      render(NeovimEditor);
      
      await tick();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Neovim:', expect.any(Error));
        expect(mockTerminal.writeln).toHaveBeenCalledWith('\x1b[31mError: Failed to initialize Neovim\x1b[0m');
        expect(mockTerminal.writeln).toHaveBeenCalledWith('Error: Neovim start failed');
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle tmux pane creation error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.createPane.mockRejectedValue(new Error('Tmux error'));
      
      render(NeovimEditor);
      
      await tick();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Neovim:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle polling errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.capturePane.mockRejectedValue(new Error('Capture failed'));
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to capture pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle resize errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.resizePane.mockRejectedValue(new Error('Resize failed'));
      
      const { container } = render(NeovimEditor);
      
      await tick();
      
      const resizeCallback = (global.ResizeObserver as any).mock.calls[0][0];
      resizeCallback();
      
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to resize pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
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
      
      consoleSpy.mockRestore();
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
      
      const resizeObserver = (global.ResizeObserver as any).mock.results[0].value;
      
      await unmount();
      
      expect(resizeObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Instance Management', () => {
    it('should generate instanceId if not provided', async () => {
      const dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(12345);
      
      render(NeovimEditor);
      
      await tick();
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith('nvim-12345');
      });
      
      dateNowSpy.mockRestore();
    });

    it('should use provided instanceId', async () => {
      render(NeovimEditor, { props: { instanceId: 'custom-id' } });
      
      await tick();
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith('custom-id');
      });
    });

    it('should handle custom session name', async () => {
      render(NeovimEditor, { props: { sessionName: 'my-session' } });
      
      await tick();
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith('my-session', expect.any(String));
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button titles', () => {
      const { container } = render(NeovimEditor);
      
      const saveButton = container.querySelector('[title="Save"]');
      expect(saveButton).toBeTruthy();
    });
  });
});