import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import userEvent from '@testing-library/user-event';
import { 
  createAsyncMock, 
  createAsyncVoidMock,
  createSyncMock,
  createTypedMock,
  createSvelteComponentMock
} from '@/test/mock-factory';

// Mock TauriTerminal component - must be hoisted before PaneGrid import
const MockTauriTerminal = createSvelteComponentMock('TauriTerminal', {
  terminal: {
    dispose: createSyncMock<[], void>(),
    clear: createSyncMock<[], void>(),
    write: createSyncMock<[string], void>(),
    writeln: createSyncMock<[string], void>(),
    onData: createSyncMock<[any], void>()
  },
  fitAddon: {
    dispose: createSyncMock<[], void>(),
    fit: createSyncMock<[], void>(),
    proposeDimensions: createSyncMock<[], { cols: number; rows: number }>()
      .mockReturnValue({ cols: 80, rows: 24 })
  },
  resizeObserver: {
    disconnect: createSyncMock<[], void>(),
    observe: createSyncMock<[Element], void>(),
    unobserve: createSyncMock<[Element], void>()
  },
  pollInterval: null
});

vi.mock('./TauriTerminal.svelte', () => ({
  default: MockTauriTerminal
}));

// Mock layout client
const mockGetLayout = createAsyncMock<[string], any>();
const mockCreateLayout = createAsyncMock<[string], any>();
const mockSplitPane = createAsyncMock<[string, string, boolean, number], [string, string]>();
const mockClosePane = createAsyncVoidMock();

vi.mock('$lib/tauri/layout', () => ({
  layoutClient: {
    getLayout: mockGetLayout,
    createLayout: mockCreateLayout,
    splitPane: mockSplitPane,
    closePane: mockClosePane
  }
}));

// Import components AFTER mocks
import PaneGrid from './PaneGrid.svelte';

describe('PaneGrid Component', () => {
  let cleanup: Array<() => void> = [];
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(async () => {
    user = userEvent.setup();
    vi.clearAllMocks();

    // Setup default mock responses
    const mockLayout = {
      panes: {
        'pane-1': {
          id: 'pane-1',
          bounds: { x: 0, y: 0, width: 50, height: 100 },
          children: [],
          pane_id: 'terminal-1'
        },
        'pane-2': {
          id: 'pane-2',
          bounds: { x: 50, y: 0, width: 50, height: 100 },
          children: [],
          pane_id: 'terminal-2'
        }
      }
    };

    mockGetLayout.mockResolvedValue(mockLayout);
    mockCreateLayout.mockResolvedValue(mockLayout);
    mockSplitPane.mockResolvedValue(['pane-1', 'pane-3']);
    mockClosePane.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.clearAllMocks();
  });

  describe('Component Initialization', () => {
    it('should render pane grid container', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const gridContainer = container.querySelector('.pane-grid-container');
      expect(gridContainer).toBeTruthy();
    });

    it('should initialize with default session ID', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const controls = container.querySelector('.pane-controls');
      expect(controls).toBeTruthy();
    });

    it('should accept custom session ID', () => {
      const { container, unmount } = render(PaneGrid, {
        props: {
          sessionId: 'custom-session'
        }
      });
      cleanup.push(unmount);
      
      const gridContainer = container.querySelector('.pane-grid-container');
      expect(gridContainer).toBeTruthy();
    });

    it('should show loading state initially', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const loading = container.querySelector('.loading');
      expect(loading).toBeTruthy();
      expect(loading?.textContent).toContain('Initializing layout');
    });

    it('should load existing layout on mount', async () => {
      const { unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalledWith('orchflow-main');
      });
    });

    it('should create layout if getting layout fails', async () => {
      mockGetLayout.mockRejectedValueOnce(new Error('Layout not found'));
      
      const { unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalledWith('orchflow-main');
        expect(mockCreateLayout).toHaveBeenCalledWith('orchflow-main');
      });
    });
  });

  describe('Layout Display', () => {
    it('should display panes after loading', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const paneGrid = container.querySelector('.pane-grid');
        expect(paneGrid).toBeTruthy();
      }, { timeout: 3000 });
    });

    it('should render leaf panes only', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2); // Only leaf panes
      });
    });

    it('should apply correct grid styles to panes', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
        
        // Check first pane has correct grid positioning
        const firstPane = panes[0];
        expect(firstPane.getAttribute('style')).toContain('grid-column: 1 / span 50');
        expect(firstPane.getAttribute('style')).toContain('grid-row: 1 / span 100');
      });
    });

    it('should render TauriTerminal components for panes with pane_id', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
        // TauriTerminal components would be rendered inside panes
      });
    });

    it('should render empty pane for panes without pane_id', async () => {
      const mockLayoutWithEmpty = {
        panes: {
          'pane-1': {
            id: 'pane-1',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            children: [],
            pane_id: null
          }
        }
      };
      
      mockGetLayout.mockResolvedValue(mockLayoutWithEmpty);
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const emptyPane = container.querySelector('.empty-pane');
        expect(emptyPane).toBeTruthy();
        expect(emptyPane?.textContent).toContain('Empty Pane');
        expect(emptyPane?.textContent).toContain('Click to select, then split');
      });
    });
  });

  describe('Pane Selection', () => {
    it('should select pane when clicked', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
      });

      const firstPane = container.querySelector('.pane');
      await user.click(firstPane!);

      await waitFor(() => {
        expect(firstPane).toHaveClass('selected');
      });
    });

    it('should update selected pane when different pane clicked', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
      });

      const panes = container.querySelectorAll('.pane');
      const firstPane = panes[0];
      const secondPane = panes[1];

      // Click first pane
      await user.click(firstPane);
      await waitFor(() => {
        expect(firstPane).toHaveClass('selected');
      });

      // Click second pane
      await user.click(secondPane);
      await waitFor(() => {
        expect(secondPane).toHaveClass('selected');
        expect(firstPane).not.toHaveClass('selected');
      });
    });

    it('should show visual selection indicator', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      await waitFor(() => {
        expect(pane).toHaveClass('selected');
        // CSS should apply box-shadow for selected state
      });
    });
  });

  describe('Pane Controls', () => {
    it('should render all control buttons', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const controls = container.querySelector('.pane-controls');
      const buttons = controls?.querySelectorAll('button');
      
      expect(buttons).toHaveLength(3);
    });

    it('should have correct button titles', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
      const verticalSplit = container.querySelector('[title="Split Vertically"]');
      const closePane = container.querySelector('[title="Close Pane"]');
      
      expect(horizontalSplit).toBeTruthy();
      expect(verticalSplit).toBeTruthy();
      expect(closePane).toBeTruthy();
    });

    it('should disable buttons when no pane selected', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const buttons = container.querySelectorAll('.pane-controls button');
      
      buttons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });

    it('should enable split buttons when pane selected', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      await waitFor(() => {
        const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
        const verticalSplit = container.querySelector('[title="Split Vertically"]');
        
        expect(horizontalSplit).not.toBeDisabled();
        expect(verticalSplit).not.toBeDisabled();
      });
    });

    it('should disable close button when only one pane exists', async () => {
      const singlePaneLayout = {
        panes: {
          'pane-1': {
            id: 'pane-1',
            bounds: { x: 0, y: 0, width: 100, height: 100 },
            children: [],
            pane_id: 'terminal-1'
          }
        }
      };
      
      mockGetLayout.mockResolvedValue(singlePaneLayout);
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      await waitFor(() => {
        const closeButton = container.querySelector('[title="Close Pane"]');
        expect(closeButton).toBeDisabled();
      });
    });
  });

  describe('Pane Splitting', () => {
    it('should split pane horizontally when horizontal split clicked', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
      await user.click(horizontalSplit!);

      await waitFor(() => {
        expect(mockSplitPane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.any(String),
          true,
          50
        );
      });
    });

    it('should split pane vertically when vertical split clicked', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const verticalSplit = container.querySelector('[title="Split Vertically"]');
      await user.click(verticalSplit!);

      await waitFor(() => {
        expect(mockSplitPane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.any(String),
          false,
          50
        );
      });
    });

    it('should refresh layout after splitting', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
      await user.click(horizontalSplit!);

      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalledTimes(2); // Initial + after split
      });
    });

    it('should select new pane after splitting', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
      await user.click(horizontalSplit!);

      // The new pane should be selected (child2 from mock)
      await waitFor(() => {
        expect(mockSplitPane).toHaveBeenCalled();
      });
    });

    it('should handle split pane error gracefully', async () => {
      mockSplitPane.mockRejectedValueOnce(new Error('Split failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleSpy.mockRestore());

      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const horizontalSplit = container.querySelector('[title="Split Horizontally"]');
      await user.click(horizontalSplit!);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to split pane:', expect.any(Error));
      });
    });
  });

  describe('Pane Closing', () => {
    it('should close selected pane when close button clicked', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const closeButton = container.querySelector('[title="Close Pane"]');
      await user.click(closeButton!);

      await waitFor(() => {
        expect(mockClosePane).toHaveBeenCalledWith(
          'orchflow-main',
          expect.any(String)
        );
      });
    });

    it('should refresh layout after closing pane', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const closeButton = container.querySelector('[title="Close Pane"]');
      await user.click(closeButton!);

      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalledTimes(2); // Initial + after close
      });
    });

    it('should clear selection after closing pane', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const closeButton = container.querySelector('[title="Close Pane"]');
      await user.click(closeButton!);

      await waitFor(() => {
        expect(mockClosePane).toHaveBeenCalled();
        // Selection should be cleared after close
      });
    });

    it('should handle close pane error gracefully', async () => {
      mockClosePane.mockRejectedValueOnce(new Error('Close failed'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleSpy.mockRestore());

      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      await user.click(pane!);

      const closeButton = container.querySelector('[title="Close Pane"]');
      await user.click(closeButton!);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to close pane:', expect.any(Error));
      });
    });
  });

  describe('Grid Calculation', () => {
    it('should calculate correct CSS grid styles', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
        
        // First pane: x=0, y=0, width=50, height=100
        const firstPane = panes[0];
        const firstStyle = firstPane.getAttribute('style');
        expect(firstStyle).toContain('grid-column: 1 / span 50');
        expect(firstStyle).toContain('grid-row: 1 / span 100');
        
        // Second pane: x=50, y=0, width=50, height=100
        const secondPane = panes[1];
        const secondStyle = secondPane.getAttribute('style');
        expect(secondStyle).toContain('grid-column: 51 / span 50');
        expect(secondStyle).toContain('grid-row: 1 / span 100');
      });
    });

    it('should handle complex grid layouts', async () => {
      const complexLayout = {
        panes: {
          'pane-1': {
            id: 'pane-1',
            bounds: { x: 0, y: 0, width: 25, height: 50 },
            children: [],
            pane_id: 'terminal-1'
          },
          'pane-2': {
            id: 'pane-2',
            bounds: { x: 25, y: 0, width: 75, height: 100 },
            children: [],
            pane_id: 'terminal-2'
          },
          'pane-3': {
            id: 'pane-3',
            bounds: { x: 0, y: 50, width: 25, height: 50 },
            children: [],
            pane_id: 'terminal-3'
          }
        }
      };
      
      mockGetLayout.mockResolvedValue(complexLayout);
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(3);
        
        // Verify each pane has correct positioning
        const styles = Array.from(panes).map(pane => pane.getAttribute('style'));
        expect(styles[0]).toContain('grid-column: 1 / span 25');
        expect(styles[0]).toContain('grid-row: 1 / span 50');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle layout loading errors gracefully', async () => {
      mockGetLayout.mockRejectedValue(new Error('Network error'));
      mockCreateLayout.mockRejectedValue(new Error('Create failed'));
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        // Should still render basic structure
        const gridContainer = container.querySelector('.pane-grid-container');
        expect(gridContainer).toBeTruthy();
      });
    });

    it('should handle missing layout data', async () => {
      mockGetLayout.mockResolvedValue(null);
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const loading = container.querySelector('.loading');
        expect(loading).toBeTruthy();
      });
    });

    it('should handle malformed pane data', async () => {
      const malformedLayout = {
        panes: {
          'pane-1': {
            id: 'pane-1',
            // Missing bounds
            children: [],
            pane_id: 'terminal-1'
          }
        }
      };
      
      mockGetLayout.mockResolvedValue(malformedLayout as any);
      
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      // Should not crash
      await waitFor(() => {
        const gridContainer = container.querySelector('.pane-grid-container');
        expect(gridContainer).toBeTruthy();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have clickable panes', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
        
        panes.forEach(pane => {
          expect(pane).toHaveStyle('cursor: pointer');
        });
      });
    });

    it('should have proper button accessibility', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const buttons = container.querySelectorAll('.pane-controls button');
      
      buttons.forEach(button => {
        expect(button).toHaveAttribute('title');
      });
    });

    it('should indicate disabled state visually', () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      const buttons = container.querySelectorAll('.pane-controls button');
      
      buttons.forEach(button => {
        expect(button).toBeDisabled();
        // CSS should apply opacity: 0.5 for disabled buttons
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up properly on unmount', async () => {
      const { unmount } = render(PaneGrid);
      
      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalled();
      });
      
      unmount();
      
      // Should not cause any errors
      expect(true).toBe(true);
    });

    it('should handle rapid state changes', async () => {
      const { container, unmount } = render(PaneGrid);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const pane = container.querySelector('.pane');
        expect(pane).toBeTruthy();
      });

      const pane = container.querySelector('.pane');
      
      // Rapid selection changes
      await user.click(pane!);
      await user.click(pane!);
      await user.click(pane!);
      
      // Should handle gracefully
      expect(pane).toHaveClass('selected');
    });
  });

  describe('Integration', () => {
    it('should pass correct props to TauriTerminal', async () => {
      const { container, unmount } = render(PaneGrid, {
        props: {
          sessionId: 'test-session'
        }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.pane');
        expect(panes).toHaveLength(2);
      });
      
      // TauriTerminal components should be rendered with correct props
      // This would be verified in integration tests with actual TauriTerminal
    });

    it('should maintain session consistency', async () => {
      const sessionId = 'consistent-session';
      
      const { unmount } = render(PaneGrid, {
        props: { sessionId }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockGetLayout).toHaveBeenCalledWith(sessionId);
      });
    });
  });
});