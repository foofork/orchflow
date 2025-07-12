import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import TerminalGrid from './TerminalGrid.svelte';
import { terminalIPC } from '$lib/services/terminal-ipc';
import { 
  createAsyncVoidMock, 
  createAsyncMock,
  createSvelteComponentMock 
} from '@/test/mock-factory';
import { buildTerminalConfig } from '@/test/domain-builders';

// Mock StreamingTerminal component properly
const MockStreamingTerminal = createSvelteComponentMock('StreamingTerminal', {
  terminalId: 'mock-terminal-id',
  config: buildTerminalConfig()
});

vi.mock('./StreamingTerminal.svelte', () => ({
  default: MockStreamingTerminal
}));

// Create typed mocks for terminal IPC
const mockStopTerminal = createAsyncVoidMock();
const mockBroadcastInput = createAsyncMock<[string[], string], Map<string, boolean>>();

// Mock terminal IPC service
vi.mock('$lib/services/terminal-ipc', () => ({
  terminalIPC: {
    stopTerminal: mockStopTerminal,
    broadcastInput: mockBroadcastInput
  }
}));

describe('TerminalGrid', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockStopTerminal.mockResolvedValue(undefined);
    mockBroadcastInput.mockResolvedValue(new Map());
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render empty state when no terminals', () => {
      const { container, getByText, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 0 }
      });
      cleanup.push(unmount);
      
      expect(getByText('No terminals open')).toBeTruthy();
      expect(getByText('Create Terminal')).toBeTruthy();
    });

    it('should render terminals based on initialTerminals prop', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(3);
      });
    });

    it('should render with correct layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { 
          layout: 'split-horizontal',
          initialTerminals: 2
        }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-split-horizontal')).toBe(true);
    });

    it('should render terminal titles', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const titles = container.querySelectorAll('.terminal-title');
        expect(titles[0]?.textContent).toBe('Terminal 1');
        expect(titles[1]?.textContent).toBe('Terminal 2');
      });
    });

    it('should mark first terminal as active', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(true);
        expect(panes[1]?.classList.contains('active')).toBe(false);
      });
    });
  });

  describe('Terminal Management', () => {
    it('should create terminal on button click in empty state', async () => {
      const { getByText, container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 0 }
      });
      cleanup.push(unmount);
      
      const createButton = getByText('Create Terminal');
      await fireEvent.click(createButton);
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(1);
      });
    });

    it('should close terminal on close button click', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const closeButtons = container.querySelectorAll('.terminal-close');
        expect(closeButtons.length).toBe(2);
      });
      
      const closeButtons = container.querySelectorAll('.terminal-close');
      await fireEvent.click(closeButtons[0]);
      
      await waitFor(() => {
        expect(mockStopTerminal).toHaveBeenCalled();
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(1);
      });
    });

    it('should focus terminal on click', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes.length).toBe(3);
      });
      
      const panes = container.querySelectorAll('.terminal-pane');
      await fireEvent.click(panes[2]);
      
      await waitFor(() => {
        expect(panes[0]?.classList.contains('active')).toBe(false);
        expect(panes[2]?.classList.contains('active')).toBe(true);
      });
    });

    it('should select next terminal when active is closed', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes.length).toBe(3);
      });
      
      // Close the first (active) terminal
      const closeButtons = container.querySelectorAll('.terminal-close');
      await fireEvent.click(closeButtons[0]);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes.length).toBe(2);
        expect(panes[0]?.classList.contains('active')).toBe(true);
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should create terminal on Ctrl+Shift+T', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 1 }
      });
      cleanup.push(unmount);
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: 'T',
        ctrlKey: true,
        shiftKey: true
      });
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(2);
      });
    });

    it('should close active terminal on Ctrl+Shift+W', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(2);
      });
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: 'W',
        ctrlKey: true,
        shiftKey: true
      });
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(1);
      });
    });

    it('should switch to next terminal on Ctrl+Tab', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(true);
      });
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: 'Tab',
        ctrlKey: true
      });
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(false);
        expect(panes[1]?.classList.contains('active')).toBe(true);
      });
    });

    it('should switch to previous terminal on Ctrl+Shift+Tab', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(true);
      });
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: 'Tab',
        ctrlKey: true,
        shiftKey: true
      });
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(false);
        expect(panes[2]?.classList.contains('active')).toBe(true);
      });
    });

    it('should switch to terminal by number on Ctrl+1-9', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 5 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes.length).toBe(5);
      });
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: '3',
        ctrlKey: true
      });
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[2]?.classList.contains('active')).toBe(true);
      });
    });

    it('should not switch to terminal if number exceeds count', async () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const panes = container.querySelectorAll('.terminal-pane');
        expect(panes[0]?.classList.contains('active')).toBe(true);
      });
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: '5',
        ctrlKey: true
      });
      
      // Should still have first terminal active
      const panes = container.querySelectorAll('.terminal-pane');
      expect(panes[0]?.classList.contains('active')).toBe(true);
    });
  });

  describe('Layout Classes', () => {
    it('should apply single layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { layout: 'single', initialTerminals: 1 }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-single')).toBe(true);
    });

    it('should apply split-horizontal layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { layout: 'split-horizontal', initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-split-horizontal')).toBe(true);
    });

    it('should apply split-vertical layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { layout: 'split-vertical', initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-split-vertical')).toBe(true);
    });

    it('should apply grid-2x2 layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { layout: 'grid-2x2', initialTerminals: 4 }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-2x2')).toBe(true);
    });

    it('should apply grid-3x3 layout class', () => {
      const { container, unmount } = render(TerminalGrid, {
        props: { layout: 'grid-3x3', initialTerminals: 9 }
      });
      cleanup.push(unmount);
      
      const grid = container.querySelector('.terminal-grid');
      expect(grid?.classList.contains('grid-3x3')).toBe(true);
    });
  });

  describe('Public API', () => {
    it('should add terminal via addTerminal method', async () => {
      const { container, component, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 1 }
      });
      cleanup.push(unmount);
      
      component.addTerminal('Custom Terminal');
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(2);
        const titles = container.querySelectorAll('.terminal-title');
        expect(titles[1]?.textContent).toBe('Custom Terminal');
      });
    });

    it('should remove terminal via removeTerminal method', async () => {
      const { container, component, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(3);
      });
      
      // Get the ID of the second terminal
      const terminals = container.querySelectorAll('.terminal-pane');
      const terminalId = terminals[1].querySelector('.terminal-content .mock-streaming-terminal')?.getAttribute('data-terminal-id');
      
      if (terminalId) {
        component.removeTerminal(terminalId);
        
        await waitFor(() => {
          const terminals = container.querySelectorAll('.terminal-pane');
          expect(terminals.length).toBe(2);
        });
      }
    });

    it('should change layout via setLayout method', async () => {
      const { container, component, unmount } = render(TerminalGrid, {
        props: { layout: 'single', initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      component.setLayout('split-horizontal');
      
      await waitFor(() => {
        const grid = container.querySelector('.terminal-grid');
        expect(grid?.classList.contains('grid-split-horizontal')).toBe(true);
      });
    });

    it('should get active terminal ID', async () => {
      const { container, component, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 2 }
      });
      cleanup.push(unmount);
      
      await waitFor(() => {
        const terminals = container.querySelectorAll('.terminal-pane');
        expect(terminals.length).toBe(2);
      });
      
      const activeId = component.getActiveTerminal();
      expect(activeId).toBeTruthy();
      expect(typeof activeId).toBe('string');
    });

    it('should broadcast input to all terminals', async () => {
      const { component, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      cleanup.push(unmount);
      
      component.broadcastInput('test command');
      
      await waitFor(() => {
        expect(mockBroadcastInput).toHaveBeenCalledWith(
          expect.any(Array),
          'test command'
        );
        const callArgs = mockBroadcastInput.mock.calls[0];
        expect(callArgs[0].length).toBe(3);
      });
    });
  });

  describe('Cleanup', () => {
    it('should stop all terminals on unmount', async () => {
      const { unmount } = render(TerminalGrid, {
        props: { initialTerminals: 3 }
      });
      
      unmount();
      
      await waitFor(() => {
        expect(mockStopTerminal).toHaveBeenCalledTimes(3);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle no active terminal for close shortcut', async () => {
      const { container, component, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 0 }
      });
      cleanup.push(unmount);
      
      // Manually set activeTerminalId to null
      component.getActiveTerminal = () => null;
      
      const gridContainer = container.querySelector('.terminal-grid-container');
      await fireEvent.keyDown(gridContainer!, {
        key: 'W',
        ctrlKey: true,
        shiftKey: true
      });
      
      // Should not throw error
      expect(mockStopTerminal).not.toHaveBeenCalled();
    });

    it('should handle stopTerminal failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockStopTerminal.mockRejectedValueOnce(new Error('Failed to stop'));
      
      const { container, unmount } = render(TerminalGrid, {
        props: { initialTerminals: 1 }
      });
      cleanup.push(unmount);
      cleanup.push(() => consoleSpy.mockRestore());
      
      await waitFor(() => {
        const closeButtons = container.querySelectorAll('.terminal-close');
        expect(closeButtons.length).toBe(1);
      });
      
      const closeButton = container.querySelector('.terminal-close');
      await fireEvent.click(closeButton!);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});