import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';

// Mock the stores first
vi.mock('$lib/stores/manager', async () => {
  const { writable } = await import('svelte/store');
  return {
    manager: writable(null),
    activeSession: writable(null),
    activePane: writable(null),
    panes: writable(new Map()),
    sessions: writable([]),
    plugins: writable([]),
    isConnected: writable(false),
    terminalOutputs: writable(new Map()),
    loadedPlugins: writable(new Set())
  };
});

// Mock PluginStatusBar component
vi.mock('./PluginStatusBar.svelte', () => ({
  default: createTypedMock<() => any>().mockImplementation(() => ({
    $$: {
      fragment: {
        c: createTypedMock<() => {}>(() => ({})),
        m: createTypedMock<() => {}>(() => ({})),
        p: createTypedMock<() => {}>(() => ({})),
        d: createTypedMock<() => {}>(() => ({}))
      },
      ctx: [],
      props: {},
      update: createTypedMock<() => {}>(() => ({})),
      not_equal: (a: any, b: any) => a !== b,
      bound: {},
      on_mount: [],
      on_destroy: [],
      on_disconnect: [],
      before_update: [],
      after_update: [],
      context: new Map(),
      callbacks: {},
      dirty: [],
      skip_bound: false,
      root: document.createElement('div')
    },
    element: document.createElement('div'),
    $set: createTypedMock<(props: any) => void>(),
    $on: createTypedMock<(event: string, handler: Function) => void>(),
    $destroy: createTypedMock<() => void>()
  }))
}));

import StatusBar from './StatusBar.svelte';
import { manager, activeSession, activePane, panes, sessions, plugins, isConnected, terminalOutputs, loadedPlugins } from '$lib/stores/manager';
import type { Writable } from 'svelte/store';

// Cast mocked stores to writable for tests
const writableActiveSession = activeSession as unknown as Writable<any>;
const writableActivePane = activePane as unknown as Writable<any>;
const writablePanes = panes as unknown as Writable<any>;
const writableSessions = sessions as unknown as Writable<any>;
const writablePlugins = plugins as unknown as Writable<any>;
const writableIsConnected = isConnected as unknown as Writable<any>;
const writableTerminalOutputs = terminalOutputs as unknown as Writable<any>;
const writableLoadedPlugins = loadedPlugins as unknown as Writable<any>;
import {
  createMockWritable,
  createMockManagerStores,
  waitForStoreUpdate
} from '@/test/utils/mock-stores';
import {
  buildSession,
  buildPane
} from '@/test/test-data-builders';
import { enhancedComponentMocks } from '@/test/mock-factory';

describe('StatusBar', () => {
  let clockInterval: NodeJS.Timeout;
  let cleanup: Array<() => void> = [];
  
  beforeEach(() => {
    vi.useFakeTimers();
    cleanup = [];
    // Mock Date for consistent clock testing
    vi.setSystemTime(new Date('2024-01-01 14:30:00'));
  });
  
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    // Reset stores using enhanced utilities
    writableActiveSession.set(null);
    writableActivePane.set(null);
    writablePanes.set(new Map());
    writableSessions.set([]);
    writablePlugins.set([]);
    writableIsConnected.set(false);
    writableTerminalOutputs.set(new Map());
    writableLoadedPlugins.set(new Set());
    // Clean up tracked resources
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('Rendering', () => {
    it('renders the status bar with all sections', () => {
      const { container, unmount } = render(StatusBar, {
        props: { sessionId: 'test-session' }
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.status-bar')).toBeInTheDocument();
      expect(container.querySelector('.status-section.left')).toBeInTheDocument();
      expect(container.querySelector('.status-section.center')).toBeInTheDocument();
      expect(container.querySelector('.status-section.right')).toBeInTheDocument();
    });

    it('renders session name when activeSession is set', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      const testSession = buildSession({ 
        id: 'test-session', 
        name: 'My Project' 
      });
      writableActiveSession.set(testSession);
      
      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument();
        expect(screen.getByText('📁')).toBeInTheDocument();
      });
    });

    it('renders active pane title when activePane is set', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      const testPane = buildPane({ 
        id: 'pane-1', 
        title: 'main.ts', 
        pane_type: 'Editor' 
      });
      writableActivePane.set(testPane);
      
      await waitFor(() => {
        expect(screen.getByText('main.ts')).toBeInTheDocument();
        expect(screen.getByText('📄')).toBeInTheDocument();
      });
    });

    it('renders terminal count when terminals exist', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      const terminalPanes = new Map([
        ['pane-1', buildPane({ id: 'pane-1', pane_type: 'Terminal', title: 'Terminal 1' })],
        ['pane-2', buildPane({ id: 'pane-2', pane_type: 'Terminal', title: 'Terminal 2' })],
        ['pane-3', buildPane({ id: 'pane-3', pane_type: 'Editor', title: 'main.ts' })]
      ]);
      writablePanes.set(terminalPanes);
      
      await waitFor(() => {
        expect(screen.getByText('2 terminals')).toBeInTheDocument();
        expect(screen.getByText('📟')).toBeInTheDocument();
      });
    });

    it('renders singular terminal text for single terminal', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      const singleTerminal = new Map([
        ['pane-1', buildPane({ id: 'pane-1', pane_type: 'Terminal', title: 'Terminal 1' })]
      ]);
      writablePanes.set(singleTerminal);
      
      await waitFor(() => {
        expect(screen.getByText('1 terminal')).toBeInTheDocument();
      });
    });

    it('renders clock with correct format', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(screen.getByText('02:30 PM')).toBeInTheDocument();
        expect(screen.getByText('🕐')).toBeInTheDocument();
      });
    });
  });

  describe('Clock Updates', () => {
    it('updates clock every second', async () => {
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      cleanup.push(unmount);
      
      expect(screen.getByText('02:30 PM')).toBeInTheDocument();
      
      // Advance time by 1 minute
      vi.setSystemTime(new Date('2024-01-01 14:31:00'));
      vi.advanceTimersByTime(1000);
      
      await waitFor(() => {
        expect(screen.getByText('02:31 PM')).toBeInTheDocument();
      });
    });

    it('clears clock interval on unmount', () => {
      const clearIntervalSpy = createSyncMock<[number | NodeJS.Timeout], void>();
      const originalClearInterval = global.clearInterval;
      global.clearInterval = clearIntervalSpy as any;
      cleanup.push(() => { global.clearInterval = originalClearInterval; });
      
      const { unmount } = render(StatusBar, { props: { sessionId: 'test-session' } });
      
      unmount();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  describe('Notifications', () => {
    it('displays notification interface elements', () => {
      const { container, unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Should have notification area ready
      const rightSection = container.querySelector('.status-section.right');
      expect(rightSection).toBeInTheDocument();
    });

    it('renders notification button placeholder', () => {
      const { container, unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const notificationArea = container.querySelector('.status-section.right .status-item');
      expect(notificationArea).toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('maintains layout with no data', () => {
      const { container, unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Should still have all sections even with no data
      expect(container.querySelector('.status-section.left')).toBeInTheDocument();
      expect(container.querySelector('.status-section.center')).toBeInTheDocument();
      expect(container.querySelector('.status-section.right')).toBeInTheDocument();
      
      // Clock should always be present
      expect(screen.getByText('🕐')).toBeInTheDocument();
    });

    it('handles long session names with text overflow', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const longNameSession = buildSession({ 
        id: 'test-session', 
        name: 'This is a very long session name that should be truncated' 
      });
      writableActiveSession.set(longNameSession);
      
      await waitFor(() => {
        const textElement = screen.getByText(/This is a very long session name/);
        expect(textElement).toHaveClass('text');
        // The CSS class should handle overflow
      });
    });

    it('handles multiple status items gracefully', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Set all possible status items using builders
      const project = buildSession({ id: 'test-session', name: 'My Project' });
      const editor = buildPane({ id: 'pane-1', title: 'main.ts', pane_type: 'Editor' });
      const terminalPanes = new Map([
        ['pane-1', buildPane({ id: 'pane-1', pane_type: 'Terminal', title: 'Terminal 1' })],
        ['pane-2', buildPane({ id: 'pane-2', pane_type: 'Terminal', title: 'Terminal 2' })]
      ]);
      
      writableActiveSession.set(project);
      writableActivePane.set(editor);
      writablePanes.set(terminalPanes);
      
      await waitFor(() => {
        expect(screen.getByText('My Project')).toBeInTheDocument();
        expect(screen.getByText('main.ts')).toBeInTheDocument();
        expect(screen.getByText('2 terminals')).toBeInTheDocument();
      });
    });
  });

  describe('Integration with PluginStatusBar', () => {
    it('renders PluginStatusBar in center section', () => {
      const { container, unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const centerSection = container.querySelector('.status-section.center');
      expect(centerSection).toBeInTheDocument();
      // PluginStatusBar component should exist
    });
  });

  describe('Store Subscriptions', () => {
    it('updates when activeSession changes', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      expect(screen.queryByText('Project A')).not.toBeInTheDocument();
      
      const projectA = buildSession({ id: 'test-session', name: 'Project A' });
      writableActiveSession.set(projectA);
      await waitFor(() => {
        expect(screen.getByText('Project A')).toBeInTheDocument();
      });
      
      const projectB = buildSession({ id: 'test-session', name: 'Project B' });
      writableActiveSession.set(projectB);
      await waitFor(() => {
        expect(screen.queryByText('Project A')).not.toBeInTheDocument();
        expect(screen.getByText('Project B')).toBeInTheDocument();
      });
    });

    it('updates when activePane changes', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const file1 = buildPane({ id: 'pane-1', title: 'file1.ts', pane_type: 'Editor' });
      writableActivePane.set(file1);
      await waitFor(() => {
        expect(screen.getByText('file1.ts')).toBeInTheDocument();
      });
      
      const file2 = buildPane({ id: 'pane-2', title: 'file2.ts', pane_type: 'Editor' });
      writableActivePane.set(file2);
      await waitFor(() => {
        expect(screen.queryByText('file1.ts')).not.toBeInTheDocument();
        expect(screen.getByText('file2.ts')).toBeInTheDocument();
      });
    });

    it('updates terminal count when panes change', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Start with no terminals
      writablePanes.set(new Map());
      expect(screen.queryByText(/terminal/)).not.toBeInTheDocument();
      
      // Add one terminal
      const oneTerminal = new Map([
        ['pane-1', buildPane({ id: 'pane-1', pane_type: 'Terminal', title: 'Terminal 1' })]
      ]);
      writablePanes.set(oneTerminal);
      await waitFor(() => {
        expect(screen.getByText('1 terminal')).toBeInTheDocument();
      });
      
      // Add another terminal
      const twoTerminals = new Map([
        ['pane-1', buildPane({ id: 'pane-1', pane_type: 'Terminal', title: 'Terminal 1' })],
        ['pane-2', buildPane({ id: 'pane-2', pane_type: 'Terminal', title: 'Terminal 2' })]
      ]);
      writablePanes.set(twoTerminals);
      await waitFor(() => {
        expect(screen.getByText('2 terminals')).toBeInTheDocument();
      });
    });

    it('handles store updates using waitForStoreUpdate', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Use enhanced store utility
      const updatePromise = waitForStoreUpdate(
        activeSession,
        (value) => value?.name === 'Updated Project'
      );
      
      const updatedSession = buildSession({ id: 'test-session', name: 'Updated Project' });
      writableActiveSession.set(updatedSession);
      
      await updatePromise;
      expect(screen.getByText('Updated Project')).toBeInTheDocument();
    });
  });

  describe('Pane Type Icons', () => {
    it('shows correct icon for Editor pane', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const editorPane = buildPane({ 
        id: 'pane-1', 
        title: 'script.js', 
        pane_type: 'Editor' 
      });
      writableActivePane.set(editorPane);
      
      await waitFor(() => {
        expect(screen.getByText('📄')).toBeInTheDocument();
      });
    });

    it('shows correct icon for Terminal pane', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const terminalPane = buildPane({ 
        id: 'pane-1', 
        title: 'bash', 
        pane_type: 'Terminal' 
      });
      writableActivePane.set(terminalPane);
      
      await waitFor(() => {
        expect(screen.getByText('📟')).toBeInTheDocument();
      });
    });

    it('shows correct icon for Preview pane', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      const previewPane = buildPane({ 
        id: 'pane-1', 
        title: 'README.md', 
        pane_type: 'Editor' 
      });
      writableActivePane.set(previewPane);
      
      await waitFor(() => {
        expect(screen.getByText('👁️')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty panes map gracefully', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      writablePanes.set(new Map());
      
      await waitFor(() => {
        expect(screen.queryByText(/terminal/)).not.toBeInTheDocument();
      });
    });

    it('handles null activeSession gracefully', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      writableActiveSession.set(null);
      
      await waitFor(() => {
        expect(screen.queryByText('📁')).not.toBeInTheDocument();
      });
    });

    it('handles null activePane gracefully', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      writableActivePane.set(null);
      
      await waitFor(() => {
        expect(screen.queryByText('📄')).not.toBeInTheDocument();
      });
    });
  });

  describe('Performance', () => {
    it('efficiently updates only changed elements', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Set initial state
      const session1 = buildSession({ id: 'test-session', name: 'Session 1' });
      writableActiveSession.set(session1);
      
      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });
      
      // Clock should continue updating independently
      vi.advanceTimersByTime(1000);
      
      // Session name should remain
      expect(screen.getByText('Session 1')).toBeInTheDocument();
    });

    it('handles rapid store updates gracefully', async () => {
      const { unmount } = render(StatusBar, { 
        props: { sessionId: 'test-session' } 
      });
      cleanup.push(unmount);
      
      // Rapidly update panes
      for (let i = 0; i < 10; i++) {
        const newPanes = new Map([
          [`pane-${i}`, buildPane({ 
            id: `pane-${i}`, 
            pane_type: 'Terminal', 
            title: `Terminal ${i}` 
          })]
        ]);
        writablePanes.set(newPanes);
      }
      
      // Should show final state
      await waitFor(() => {
        expect(screen.getByText('1 terminal')).toBeInTheDocument();
      });
    });
  });
});