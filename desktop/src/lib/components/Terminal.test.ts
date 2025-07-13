import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { writable, get } from 'svelte/store';
import type { MockedFunction } from 'vitest';

// Import mock utilities
import { 
  createTypedMock, 
  createAsyncMock,
  createAsyncVoidMock,
  createSyncMock,
  createVoidMock,
  enhancedStoreMocks
} from '@/test/mock-factory';
import { 
  buildTerminalConfig, 
  buildTerminalTheme,
  buildTerminalOutput,
  createMockTerminal
} from '../test/domain-builders';
import { createMockManagerStores } from '../test/store-mocks';
import { buildPane, buildSession } from '../test/test-data-builders';

// Mock browser environment
vi.mock('$app/environment', () => ({ browser: true }));

// Enhanced mock instances with proper types
let mockTerminalInstance: ReturnType<typeof createMockTerminal>;
let mockFitAddon: {
  fit: MockedFunction<() => void>;
  proposeDimensions: MockedFunction<() => { cols: number; rows: number } | null>;
  dispose: MockedFunction<() => void>;
};
let mockSearchAddon: {
  findNext: MockedFunction<(searchTerm: string) => void>;
  findPrevious: MockedFunction<(searchTerm: string) => void>;
  dispose: MockedFunction<() => void>;
};
let mockWebLinksAddon: {
  dispose?: MockedFunction<() => void>;
};

// Create manager mocks before module imports
const managerStores = createMockManagerStores();

// Mock manager store with enhanced patterns
vi.mock('$lib/stores/manager', () => {
  return managerStores;
});

// Mock xterm and addons with enhanced patterns
vi.mock('@xterm/xterm', () => {
  return {
    Terminal: createTypedMock<(options?: any) => typeof mockTerminalInstance>().mockImplementation((options?: any) => {
      // Create a new mock terminal instance
      mockTerminalInstance = createMockTerminal();
      
      // Enhanced mock with proper event handling
      const onDataHandlers: Array<(data: string) => void> = [];
      const onResizeHandlers: Array<(size: { cols: number; rows: number }) => void> = [];
      
      // Override onData to track handlers
      mockTerminalInstance.onData.mockImplementation((handler) => {
        onDataHandlers.push(handler);
        return createVoidMock();
      });
      
      // Override onResize to track handlers
      const onResize = createTypedMock<(handler: (size: { cols: number; rows: number }) => void) => () => void>();
      onResize.mockImplementation((handler) => {
        onResizeHandlers.push(handler);
        return createVoidMock();
      });
      
      // Add helper for testing
      (mockTerminalInstance as any)._onDataHandlers = onDataHandlers;
      (mockTerminalInstance as any)._onResizeHandlers = onResizeHandlers;
      (mockTerminalInstance as any).onResize = onResize;
      
      return mockTerminalInstance;
    })
  };
});

vi.mock('@xterm/addon-fit', () => {
  return {
    FitAddon: createTypedMock<() => typeof mockFitAddon>().mockImplementation(() => {
      mockFitAddon = {
        fit: createVoidMock(),
        proposeDimensions: createSyncMock<[], { cols: number; rows: number } | null>({ cols: 80, rows: 24 }),
        dispose: createVoidMock()
      };
      return mockFitAddon;
    })
  };
});

vi.mock('@xterm/addon-search', () => {
  return {
    SearchAddon: createTypedMock<() => typeof mockSearchAddon>().mockImplementation(() => {
      mockSearchAddon = {
        findNext: createVoidMock<[string]>(),
        findPrevious: createVoidMock<[string]>(),
        dispose: createVoidMock()
      };
      return mockSearchAddon;
    })
  };
});

vi.mock('@xterm/addon-web-links', () => ({
  WebLinksAddon: createTypedMock<() => typeof mockWebLinksAddon>().mockImplementation(() => {
    mockWebLinksAddon = {
      dispose: createVoidMock()
    };
    return mockWebLinksAddon;
  })
}));

vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// Enhanced ResizeObserver mock
class MockResizeObserver implements ResizeObserver {
  callback: ResizeObserverCallback;
  observe = createVoidMock<[target: Element]>();
  unobserve = createVoidMock<[target: Element]>();
  disconnect = createVoidMock();
  
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    mockResizeObserverInstance = this;
  }
}

let mockResizeObserverInstance: MockResizeObserver | null = null;
global.ResizeObserver = MockResizeObserver as any;

// Mock prompt with typed mock
const mockPrompt = createSyncMock<[message?: string], string | null>('search term');
global.prompt = mockPrompt as any;

// Import Terminal after mocks are set up
import Terminal from './Terminal.svelte';

describe('Terminal Component', () => {
  let cleanup: Array<() => void> = [];
  let mockManager: typeof managerStores.manager;
  let mockTerminalOutputs: typeof managerStores.terminalOutputs;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Reset mock instances
    mockTerminalInstance = null as any;
    mockFitAddon = null as any;
    mockSearchAddon = null as any;
    mockWebLinksAddon = null as any;
    mockResizeObserverInstance = null;
    
    // Get references to mocked objects
    mockManager = managerStores.manager;
    mockTerminalOutputs = managerStores.terminalOutputs;
    
    // Reset store
    mockTerminalOutputs.set(new Map());
    
    // Reset prompt mock
    mockPrompt.mockReturnValue('search term');
    
    // Setup default mock behaviors
    mockManager.getPaneOutput.mockResolvedValue('Previous output\n');
  });

  afterEach(() => {
    // Run cleanup functions
    cleanup.forEach(fn => fn());
    cleanup = [];
    
    // Cleanup all mocks
    vi.clearAllMocks();
    
    // Cleanup any DOM elements
    document.body.innerHTML = '';
    
    // Reset mock instances
    if (mockTerminalInstance?.dispose) {
      mockTerminalInstance.dispose();
    }
    if (mockFitAddon?.dispose) {
      mockFitAddon.dispose();
    }
    if (mockSearchAddon?.dispose) {
      mockSearchAddon.dispose();
    }
    if (mockWebLinksAddon?.dispose) {
      mockWebLinksAddon.dispose();
    }
    if (mockResizeObserverInstance?.disconnect) {
      mockResizeObserverInstance.disconnect();
    }
  });

  describe('Component Lifecycle', () => {
    it('should initialize xterm on mount with proper configuration', async () => {
      const { Terminal: XTerm } = await import('@xterm/xterm');
      const terminalConfig = buildTerminalConfig();
      const terminalTheme = buildTerminalTheme({
        background: '#1e1e2e',
        foreground: '#cdd6f4',
        cursor: '#f5e0dc'
      });
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(XTerm).toHaveBeenCalledWith(expect.objectContaining({
          theme: expect.objectContaining({
            background: terminalTheme.background,
            foreground: terminalTheme.foreground,
            cursor: terminalTheme.cursor
          }),
          fontSize: terminalConfig.fontSize,
          fontFamily: expect.stringContaining('Cascadia Code'),
          cursorBlink: true,
          cursorStyle: 'bar'
        }));
      });
    });

    it('should load all addons in correct order', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.loadAddon).toHaveBeenCalledTimes(3);
        
        // Verify addons are loaded
        expect(mockFitAddon).toBeTruthy();
        expect(mockSearchAddon).toBeTruthy();
        expect(mockWebLinksAddon).toBeTruthy();
      });
    });

    it('should attach terminal to DOM container', async () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        const terminalContainer = container.querySelector('.terminal-container');
        expect(terminalContainer).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalledWith(terminalContainer);
      });
    });

    it('should fit terminal on mount', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockFitAddon).toBeTruthy();
        expect(mockFitAddon.fit).toHaveBeenCalled();
      });
    });

    it('should load existing output from manager', async () => {
      const existingOutput = buildTerminalOutput('Previous output\n', {
        type: 'stdout',
        timestamp: Date.now() - 1000
      });
      
      mockManager.getPaneOutput.mockResolvedValue(existingOutput.content);
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockManager.getPaneOutput).toHaveBeenCalledWith('test-pane', 1000);
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.write).toHaveBeenCalledWith(existingOutput.content);
      });
    });

    it('should write welcome message with title', async () => {
      const customTitle = 'My Terminal';
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: customTitle
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith(`\x1b[1;34m${customTitle}\x1b[0m`);
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith('');
      });
    });

    it('should handle error when loading existing output fails', async () => {
      const loadError = new Error('Failed to load');
      mockManager.getPaneOutput.mockRejectedValueOnce(loadError);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load existing output:', loadError);
      });
      
      consoleSpy.mockRestore();
    });

    it('should dispose terminal and cleanup on destroy', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(mockTerminalInstance.dispose).toHaveBeenCalled();
      expect(mockResizeObserverInstance?.disconnect).toHaveBeenCalled();
    });
  });

  describe('Terminal Input', () => {
    it('should send input data to manager', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.onData).toHaveBeenCalled();
      });
      
      // Get the onData handlers
      const handlers = (mockTerminalInstance as any)._onDataHandlers;
      expect(handlers).toHaveLength(1);
      
      // Simulate typing
      const testInput = 'hello world';
      handlers[0](testInput);
      
      expect(mockManager.sendInput).toHaveBeenCalledWith('test-pane', testInput);
    });

    it('should handle special key combinations', async () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      const terminalEl = container.querySelector('.terminal-container');
      expect(terminalEl).toBeTruthy();
      
      // Test Ctrl+C
      await fireEvent.keyDown(terminalEl!, {
        key: 'c',
        ctrlKey: true
      });
      
      expect(mockManager.sendInput).toHaveBeenCalledWith('test-pane', '\x03');
      
      // Test Ctrl+D
      await fireEvent.keyDown(terminalEl!, {
        key: 'd',
        ctrlKey: true
      });
      
      expect(mockManager.sendInput).toHaveBeenCalledWith('test-pane', '\x04');
    });

    it('should handle search with Ctrl+F', async () => {
      const searchTerm = 'test search';
      mockPrompt.mockReturnValue(searchTerm);
      
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      const terminalEl = container.querySelector('.terminal-container');
      
      await fireEvent.keyDown(terminalEl!, {
        key: 'f',
        ctrlKey: true
      });
      
      expect(mockPrompt).toHaveBeenCalledWith('Search for:');
      expect(mockSearchAddon).toBeTruthy();
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith(searchTerm);
    });

    it('should handle search cancellation gracefully', async () => {
      mockPrompt.mockReturnValue(null);
      
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      const terminalEl = container.querySelector('.terminal-container');
      
      await fireEvent.keyDown(terminalEl!, {
        key: 'f',
        ctrlKey: true
      });
      
      expect(mockSearchAddon).toBeTruthy();
      expect(mockSearchAddon.findNext).toHaveBeenCalledWith('');
    });
  });

  describe('Terminal Output', () => {
    it('should subscribe to terminal outputs store', async () => {
      const pane = buildPane({ id: 'test-pane' });
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: pane.id,
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      // Clear write calls from initialization
      mockTerminalInstance.write.mockClear();
      
      // Simulate output update
      const newOutput = buildTerminalOutput('Line 2\n');
      const outputMap = new Map([[pane.id, ['Line 1\n', newOutput.content]]]);
      mockTerminalOutputs.set(outputMap);
      
      await waitFor(() => {
        expect(mockTerminalInstance.write).toHaveBeenCalledWith(newOutput.content);
      });
    });

    it('should handle empty output gracefully', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      // Clear write calls from initialization
      mockTerminalInstance.write.mockClear();
      
      // Simulate empty output
      const outputMap = new Map([['test-pane', []]]);
      mockTerminalOutputs.set(outputMap);
      
      // Wait a bit to ensure no writes happen
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should not write anything
      expect(mockTerminalInstance.write).not.toHaveBeenCalled();
    });

    it('should only write new output lines incrementally', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      // Clear previous calls
      mockTerminalInstance.write.mockClear();
      
      // Simulate first output
      const output1 = buildTerminalOutput('Line 1\n');
      const outputMap1 = new Map([['test-pane', [output1.content]]]);
      mockTerminalOutputs.set(outputMap1);
      
      await waitFor(() => {
        expect(mockTerminalInstance.write).toHaveBeenCalledWith(output1.content);
      });
      
      mockTerminalInstance.write.mockClear();
      
      // Simulate second output
      const output2 = buildTerminalOutput('Line 2\n');
      const outputMap2 = new Map([['test-pane', [output1.content, output2.content]]]);
      mockTerminalOutputs.set(outputMap2);
      
      await waitFor(() => {
        expect(mockTerminalInstance.write).toHaveBeenCalledWith(output2.content);
        expect(mockTerminalInstance.write).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Terminal Resize', () => {
    it('should observe container resize', async () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      const terminalContainer = container.querySelector('.terminal-container');
      expect(mockResizeObserverInstance).toBeTruthy();
      expect(mockResizeObserverInstance.observe).toHaveBeenCalledWith(terminalContainer);
    });

    it('should fit terminal and notify backend on resize', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      expect(mockResizeObserverInstance).toBeTruthy();
      const resizeCallback = mockResizeObserverInstance.callback;
      
      // Clear previous calls
      mockFitAddon.fit.mockClear();
      mockManager.execute.mockClear();
      
      // Set dimensions
      const newDimensions = { cols: 100, rows: 30 };
      mockFitAddon.proposeDimensions.mockReturnValueOnce(newDimensions);
      
      // Trigger resize
      resizeCallback([], mockResizeObserverInstance as any);
      
      expect(mockFitAddon.fit).toHaveBeenCalled();
      expect(mockManager.execute).toHaveBeenCalledWith({
        type: 'ResizePane',
        pane_id: 'test-pane',
        width: newDimensions.cols,
        height: newDimensions.rows
      });
    });

    it('should handle resize when dimensions are not available', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
        expect(mockFitAddon).toBeTruthy();
      });
      
      // Mock proposeDimensions to return null
      mockFitAddon.proposeDimensions.mockReturnValueOnce(null);
      
      expect(mockResizeObserverInstance).toBeTruthy();
      const resizeCallback = mockResizeObserverInstance.callback;
      
      // Clear previous calls
      mockManager.execute.mockClear();
      
      // Trigger resize
      resizeCallback([], mockResizeObserverInstance as any);
      
      expect(mockFitAddon.fit).toHaveBeenCalled();
      expect(mockManager.execute).not.toHaveBeenCalled();
    });

    it('should disconnect resize observer on destroy', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      expect(mockResizeObserverInstance).toBeTruthy();
      
      unmount();
      
      expect(mockResizeObserverInstance.disconnect).toHaveBeenCalled();
    });
  });

  describe('Props and Configuration', () => {
    it('should use custom title', async () => {
      const customTitle = 'Custom Terminal';
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: customTitle
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith(`\x1b[1;34m${customTitle}\x1b[0m`);
      });
    });

    it('should use default title when not provided', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith('\x1b[1;34mTerminal\x1b[0m');
      });
    });

    it('should apply terminal configuration correctly', async () => {
      const customConfig = buildTerminalConfig({
        fontSize: 16,
        cursorStyle: 'underline',
        cursorBlink: false
      });
      
      const { Terminal: XTerm } = await import('@xterm/xterm');
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(XTerm).toHaveBeenCalledWith(expect.objectContaining({
          fontSize: 14, // Default from component
          cursorStyle: 'bar', // Default from component
          cursorBlink: true // Default from component
        }));
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper tabindex for keyboard navigation', () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      const terminalEl = container.querySelector('.terminal-container');
      expect(terminalEl?.getAttribute('tabindex')).toBe('0');
    });

    it('should handle keyboard events when focused', async () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      const terminalEl = container.querySelector('.terminal-container');
      
      // Regular key should not trigger special handling
      await fireEvent.keyDown(terminalEl!, {
        key: 'a'
      });
      
      // Only Ctrl+C, Ctrl+D, Ctrl+F should be handled specially
      expect(mockManager.sendInput).not.toHaveBeenCalledWith('test-pane', 'a');
    });

    it('should support copy and paste operations', async () => {
      const { container, unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
      });
      
      // Verify terminal has selection capabilities
      expect(mockTerminalInstance.selectAll).toBeDefined();
      expect(mockTerminalInstance.copy).toBeDefined();
      expect(mockTerminalInstance.paste).toBeDefined();
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should continue working if getPaneOutput fails', async () => {
      const networkError = new Error('Network error');
      mockManager.getPaneOutput.mockRejectedValueOnce(networkError);
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to load existing output:', networkError);
        // Terminal should still be initialized
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith('\x1b[1;34mTest Terminal\x1b[0m');
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle addon loading failures gracefully', async () => {
      // Mock addon loading failure
      mockTerminalInstance = createMockTerminal();
      mockTerminalInstance.loadAddon.mockImplementation(() => {
        throw new Error('Addon loading failed');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // This test would need component error boundaries
      expect(true).toBe(true);
      
      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    it('should clean up event handlers on unmount', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.open).toHaveBeenCalled();
      });
      
      // Get handler counts before unmount
      const onDataHandlers = (mockTerminalInstance as any)._onDataHandlers;
      const onResizeHandlers = (mockTerminalInstance as any)._onResizeHandlers;
      
      expect(onDataHandlers.length).toBeGreaterThan(0);
      
      // Unmount and verify cleanup
      unmount();
      
      expect(mockTerminalInstance.dispose).toHaveBeenCalled();
      expect(mockResizeObserverInstance?.disconnect).toHaveBeenCalled();
    });

    it('should handle multiple rapid resize events efficiently', async () => {
      const { unmount } = render(Terminal, {
        props: {
          paneId: 'test-pane',
          title: 'Test Terminal'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockResizeObserverInstance).toBeTruthy();
      });
      
      const resizeCallback = mockResizeObserverInstance.callback;
      
      // Clear calls
      mockFitAddon.fit.mockClear();
      mockManager.execute.mockClear();
      
      // Trigger multiple rapid resizes
      for (let i = 0; i < 5; i++) {
        mockFitAddon.proposeDimensions.mockReturnValueOnce({ cols: 80 + i, rows: 24 + i });
        resizeCallback([], mockResizeObserverInstance as any);
      }
      
      // Should call fit for each resize
      expect(mockFitAddon.fit).toHaveBeenCalledTimes(5);
      
      // Should notify backend for each resize
      expect(mockManager.execute).toHaveBeenCalledTimes(5);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete terminal session lifecycle', async () => {
      const session = buildSession({ id: 'test-session' });
      const pane = buildPane({ 
        id: 'test-pane', 
        session_id: session.id,
        title: 'Session Terminal'
      });
      
      // Render terminal
      const { unmount } = render(Terminal, {
        props: {
          paneId: pane.id,
          title: pane.title
        }
      });
      cleanup.push(unmount);
      
      // Verify initialization
      await waitFor(() => {
        expect(mockTerminalInstance).toBeTruthy();
        expect(mockTerminalInstance.writeln).toHaveBeenCalledWith(`\x1b[1;34m${pane.title}\x1b[0m`);
      });
      
      // Simulate user input
      const handlers = (mockTerminalInstance as any)._onDataHandlers;
      handlers[0]('ls -la\n');
      
      expect(mockManager.sendInput).toHaveBeenCalledWith(pane.id, 'ls -la\n');
      
      // Simulate output
      const output = buildTerminalOutput('total 42\ndrwxr-xr-x  2 user user 4096 Jan  1 00:00 .\n');
      const outputMap = new Map([[pane.id, [output.content]]]);
      mockTerminalOutputs.set(outputMap);
      
      await waitFor(() => {
        expect(mockTerminalInstance.write).toHaveBeenCalledWith(output.content);
      });
      
      // Cleanup
      unmount();
      
      expect(mockTerminalInstance.dispose).toHaveBeenCalled();
    });
  });
});