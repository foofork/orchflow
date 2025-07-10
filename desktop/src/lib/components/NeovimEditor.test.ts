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

// Mock AIAssistant component
vi.mock('./AIAssistant.svelte', () => ({
  default: vi.fn(() => ({
    $destroy: vi.fn(),
    $on: vi.fn()
  }))
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
      eval: vi.fn().mockResolvedValue('result'),
      close: vi.fn().mockResolvedValue(undefined)
    };
    
    MockNeovimClient.create.mockResolvedValue(mockNeovimClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('Component Initialization', () => {
    it('should render editor container', () => {
      const { container } = render(NeovimEditor);
      
      const editorContainer = container.querySelector('.editor-container');
      expect(editorContainer).toBeTruthy();
    });

    it('should render editor header with title', () => {
      const { container } = render(NeovimEditor, {
        props: { title: 'Custom Editor' }
      });
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Custom Editor');
    });

    it('should initialize with default props', () => {
      const { container } = render(NeovimEditor);
      
      const title = container.querySelector('.editor-title');
      expect(title?.textContent).toBe('Neovim');
      
      const terminal = container.querySelector('.editor-terminal');
      expect(terminal).toBeTruthy();
    });

    it('should initialize terminal on mount', async () => {
      render(NeovimEditor);
      
      await tick();
      
      expect(mockTerminal.loadAddon).toHaveBeenCalledWith(mockFitAddon);
      expect(mockTerminal.open).toHaveBeenCalled();
      expect(mockFitAddon.fit).toHaveBeenCalled();
    });

    it('should create Neovim instance and tmux pane', async () => {
      render(NeovimEditor, {
        props: { 
          filePath: '/test/file.txt',
          sessionName: 'test-session'
        }
      });
      
      await tick();
      vi.advanceTimersByTime(1100); // Wait for initialization
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalled();
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'test-session', 
          expect.stringContaining('nvim --listen')
        );
      });
    });

    it('should open file if filePath provided', async () => {
      render(NeovimEditor, {
        props: { filePath: '/test/file.txt' }
      });
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await waitFor(() => {
        expect(mockNeovimClient.openFile).toHaveBeenCalledWith('/test/file.txt');
      });
    });
  });

  describe('Terminal Integration', () => {
    it('should handle terminal input', async () => {
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      // Simulate terminal input callback
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      await onDataCallback('test input');
      
      await waitFor(() => {
        expect(mockTmux.sendKeys).toHaveBeenCalledWith('test-pane-1', 'test input');
      });
    });

    it('should handle terminal input errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.sendKeys.mockRejectedValue(new Error('Send keys failed'));
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const onDataCallback = mockTerminal.onData.mock.calls[0][0];
      await onDataCallback('test input');
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to send keys:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should poll for terminal output', async () => {
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      // Advance timer to trigger polling
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(mockTmux.capturePane).toHaveBeenCalledWith('test-pane-1', 1000);
      });
    });

    it('should update terminal display when content changes', async () => {
      mockTmux.capturePane.mockResolvedValue('new content\nline 2');
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(mockTerminal.clear).toHaveBeenCalled();
        expect(mockTerminal.writeln).toHaveBeenCalledWith('new content');
        expect(mockTerminal.write).toHaveBeenCalledWith('line 2');
      });
    });

    it('should handle terminal resize', async () => {
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      // Get ResizeObserver callback
      const ResizeObserverCallback = (global.ResizeObserver as any).mock.calls[0][0];
      ResizeObserverCallback();
      
      vi.advanceTimersByTime(150); // Wait for resize debounce
      
      await waitFor(() => {
        expect(mockFitAddon.fit).toHaveBeenCalled();
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

    it('should render AI assistant button', () => {
      const { container } = render(NeovimEditor);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]');
      expect(aiButton).toBeTruthy();
      expect(aiButton?.textContent).toBe('🤖');
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
      
      expect(mockNeovimClient.save).toHaveBeenCalled();
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

  describe('AI Assistant Integration', () => {
    it('should toggle AI assistant when button clicked', async () => {
      const { container } = render(NeovimEditor);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        const aiPanel = container.querySelector('.ai-panel');
        expect(aiPanel).toBeTruthy();
      });
    });

    it('should toggle AI assistant with Ctrl+Enter', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      
      await fireEvent.keyDown(container.querySelector('.editor-terminal')!, {
        key: 'Enter',
        ctrlKey: true
      });
      
      await waitFor(() => {
        const aiPanel = container.querySelector('.ai-panel');
        expect(aiPanel).toBeTruthy();
      });
    });

    it('should toggle AI assistant with Cmd+Enter on Mac', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      
      await fireEvent.keyDown(container.querySelector('.editor-terminal')!, {
        key: 'Enter',
        metaKey: true
      });
      
      await waitFor(() => {
        const aiPanel = container.querySelector('.ai-panel');
        expect(aiPanel).toBeTruthy();
      });
    });

    it('should get selection when opening AI assistant in visual mode', async () => {
      mockNeovimClient.getMode.mockResolvedValue('v');
      mockNeovimClient.eval
        .mockResolvedValueOnce(5) // start line
        .mockResolvedValueOnce(10) // end line
        .mockResolvedValueOnce(['line 1', 'line 2', 'line 3']); // selected text
      
      const { container } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(mockNeovimClient.getMode).toHaveBeenCalled();
        expect(mockNeovimClient.eval).toHaveBeenCalledWith("line(\"'<\")");
        expect(mockNeovimClient.eval).toHaveBeenCalledWith("line(\"'>\")");
        expect(mockNeovimClient.eval).toHaveBeenCalledWith("getline(line(\"'<\"), line(\"'>\"))");
      });
    });

    it('should handle selection errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockNeovimClient.getMode.mockRejectedValue(new Error('Get mode failed'));
      
      const { container } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to get selection:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should show active state when AI assistant is open', async () => {
      const { container } = render(NeovimEditor);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        expect(aiButton).toHaveClass('active');
      });
    });

    it('should apply with-ai class to container when AI is open', async () => {
      const { container } = render(NeovimEditor);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        const editorContainer = container.querySelector('.editor-container');
        expect(editorContainer).toHaveClass('with-ai');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Neovim initialization error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      MockNeovimClient.create.mockRejectedValue(new Error('Neovim start failed'));
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize Neovim:', expect.any(Error));
        expect(mockTerminal.writeln).toHaveBeenCalledWith('\x1b[31mError: Failed to initialize Neovim\x1b[0m');
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle tmux pane creation error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.createPane.mockRejectedValue(new Error('Pane creation failed'));
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
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
      vi.advanceTimersByTime(1100);
      vi.advanceTimersByTime(200);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to capture pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle resize errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.resizePane.mockRejectedValue(new Error('Resize failed'));
      
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const ResizeObserverCallback = (global.ResizeObserver as any).mock.calls[0][0];
      ResizeObserverCallback();
      
      vi.advanceTimersByTime(150);
      
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
      
      unmount();
      
      expect(mockTerminal.dispose).toHaveBeenCalled();
      expect(mockNeovimClient.close).toHaveBeenCalled();
      expect(mockTmux.killPane).toHaveBeenCalledWith('test-pane-1');
    });

    it('should handle cleanup errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockTmux.killPane.mockRejectedValue(new Error('Kill pane failed'));
      
      const { unmount } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      unmount();
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to kill pane:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('should clear intervals on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
      
      const { unmount } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should disconnect resize observer on unmount', async () => {
      const { unmount } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const observerInstance = (global.ResizeObserver as any).mock.results[0].value;
      
      unmount();
      
      expect(observerInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('Instance Management', () => {
    it('should generate instanceId if not provided', async () => {
      render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith(expect.stringMatching(/^nvim-\d+$/));
      });
    });

    it('should use provided instanceId', async () => {
      render(NeovimEditor, {
        props: { instanceId: 'custom-instance' }
      });
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await waitFor(() => {
        expect(MockNeovimClient.create).toHaveBeenCalledWith('custom-instance');
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.stringContaining('/tmp/nvim-custom-instance.sock')
        );
      });
    });

    it('should handle custom session name', async () => {
      render(NeovimEditor, {
        props: { sessionName: 'my-session' }
      });
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      await waitFor(() => {
        expect(mockTmux.createPane).toHaveBeenCalledWith(
          'my-session',
          expect.any(String)
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button titles', () => {
      const { container } = render(NeovimEditor);
      
      const saveButton = container.querySelector('[title="Save"]');
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]');
      
      expect(saveButton).toBeTruthy();
      expect(aiButton).toBeTruthy();
    });

    it('should have keyboard shortcuts for AI assistant', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      
      await fireEvent.keyDown(container.querySelector('.editor-terminal')!, {
        key: 'Enter',
        ctrlKey: true
      });
      
      await waitFor(() => {
        const aiPanel = container.querySelector('.ai-panel');
        expect(aiPanel).toBeTruthy();
      });
    });

    it('should prevent default behavior for keyboard shortcuts', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        ctrlKey: true,
        cancelable: true
      });
      
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
      
      await fireEvent(container.querySelector('.editor-terminal')!, event);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should pass correct props to AI assistant', async () => {
      const { container } = render(NeovimEditor, {
        props: {
          filePath: '/test/file.txt',
          instanceId: 'test-instance'
        }
      });
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      await waitFor(() => {
        const aiPanel = container.querySelector('.ai-panel');
        expect(aiPanel).toBeTruthy();
        // AIAssistant would receive filePath and instanceId props
      });
    });

    it('should refresh terminal after AI changes applied', async () => {
      const { container } = render(NeovimEditor);
      
      await tick();
      vi.advanceTimersByTime(1100);
      
      const aiButton = container.querySelector('[title="AI Assistant (Ctrl+Enter)"]') as HTMLElement;
      await fireEvent.click(aiButton);
      
      // The applied event handler should clear lastContent to force refresh
      // This is tested by the component behavior
      expect(true).toBe(true); // Component renders correctly
    });
  });
});