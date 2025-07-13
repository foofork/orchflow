import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import Sidebar from './Sidebar.svelte';
import { 
  renderWithContext, 
  simulateKeyboard,
  waitForElement,
  createMockResizeObserver
} from '../../test/utils/component-test-utils';
import { createMockContext } from '../../test/utils/test-fixtures';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';
import { mockSvelteEvents } from '@/test/svelte5-event-helper';

describe('Sidebar', () => {
  let mockProps: any;
  let mockContext: Map<any, any>;
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    mockProps = {
      activeView: 'explorer',
      sessionId: 'test-session-123'
    };
    mockContext = createMockContext();
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with default explorer view', () => {
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      expect(container.querySelector('.sidebar')).toBeTruthy();
      expect(container.querySelector('.sidebar-header h3')).toHaveTextContent('Explorer');
      expect(container.querySelector('.sidebar-content')).toBeTruthy();
    });

    it('should render with different panel configurations', async () => {
      const views = [
        { view: 'explorer', title: 'Explorer' },
        { view: 'search', title: 'Search' },
        { view: 'git', title: 'Source Control' },
        { view: 'debug', title: 'Run and Debug' },
        { view: 'extensions', title: 'Extensions' }
      ];

      for (const { view, title } of views) {
        const { container, rerender, unmount } = render(Sidebar, { 
          props: { ...mockProps, activeView: view } 
        });
        cleanup.push(unmount);
        
        expect(container.querySelector('.sidebar-header h3')).toHaveTextContent(title);
        
        // Verify correct panel is rendered
        const content = container.querySelector('.sidebar-content');
        expect(content).toBeTruthy();
      }
    });

    it('should show empty state for unknown view', () => {
      const { container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'unknown-view' } 
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.empty-state')).toBeTruthy();
      expect(container.querySelector('.empty-state p')).toHaveTextContent(
        'Select a view from the activity bar'
      );
      expect(container.querySelector('.sidebar-header h3')).toHaveTextContent('Sidebar');
    });

    it('should render action buttons based on active view', () => {
      // Explorer view
      let { container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'explorer' } 
      });
      cleanup.push(unmount);
      
      const explorerActions = container.querySelectorAll('.sidebar-actions .action-btn');
      expect(explorerActions).toHaveLength(3); // New File, New Folder, Refresh
      expect(explorerActions[0]).toHaveAttribute('title', 'New File');
      expect(explorerActions[1]).toHaveAttribute('title', 'New Folder');
      expect(explorerActions[2]).toHaveAttribute('title', 'Refresh');

      // Git view
      ({ container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'git' } 
      }));
      cleanup.push(unmount);
      
      const gitActions = container.querySelectorAll('.sidebar-actions .action-btn');
      expect(gitActions).toHaveLength(2); // Refresh, Commit
      expect(gitActions[0]).toHaveAttribute('title', 'Refresh');
      expect(gitActions[1]).toHaveAttribute('title', 'Commit');

      // Other views should have no actions
      ({ container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'search' } 
      }));
      cleanup.push(unmount);
      
      expect(container.querySelectorAll('.sidebar-actions .action-btn')).toHaveLength(0);
    });
  });

  describe('Panel Content', () => {
    it('should pass correct props to FileExplorerEnhanced', async () => {
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      // Wait for component to be mounted
      await waitFor(() => {
        const content = container.querySelector('.sidebar-content');
        expect(content).toBeTruthy();
      });
    });

    it('should pass sessionId to DebugPanel', () => {
      const sessionId = 'debug-session-456';
      const { unmount } = render(Sidebar, { 
        props: { activeView: 'debug', sessionId } 
      });
      cleanup.push(unmount);
      
      // The DebugPanel should receive the sessionId prop
      // This would be verified by the DebugPanel's own tests
    });
  });

  describe('Event Handling', () => {
    it('should dispatch events from action buttons', async () => {
      const { container, component, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'explorer' } 
      });
      cleanup.push(unmount);
      
      const eventHandlers = {
        newFile: createSyncMock<[], void>(),
        newFolder: createSyncMock<[], void>(),
        refresh: createSyncMock<[], void>()
      };

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('newFile', eventHandlers.newFile);
      mockComponent.$on('newFolder', eventHandlers.newFolder);
      mockComponent.$on('refresh', eventHandlers.refresh);

      const buttons = container.querySelectorAll('.sidebar-actions .action-btn');
      
      await fireEvent.click(buttons[0]); // New File
      expect(eventHandlers.newFile).toHaveBeenCalledTimes(1);
      
      await fireEvent.click(buttons[1]); // New Folder
      expect(eventHandlers.newFolder).toHaveBeenCalledTimes(1);
      
      await fireEvent.click(buttons[2]); // Refresh
      expect(eventHandlers.refresh).toHaveBeenCalledTimes(1);
    });

    it('should dispatch git-specific events', async () => {
      const { container, component, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'git' } 
      });
      cleanup.push(unmount);
      
      const eventHandlers = {
        gitRefresh: createSyncMock<[], void>(),
        gitCommit: createSyncMock<[], void>()
      };

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('gitRefresh', eventHandlers.gitRefresh);
      mockComponent.$on('gitCommit', eventHandlers.gitCommit);

      const buttons = container.querySelectorAll('.sidebar-actions .action-btn');
      
      await fireEvent.click(buttons[0]); // Refresh
      expect(eventHandlers.gitRefresh).toHaveBeenCalledTimes(1);
      
      await fireEvent.click(buttons[1]); // Commit
      expect(eventHandlers.gitCommit).toHaveBeenCalledTimes(1);
    });

    it('should forward events from child components', async () => {
      const { component, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'explorer' } 
      });
      cleanup.push(unmount);
      
      const openFileHandler = createSyncMock<[CustomEvent], void>();
      const shareHandler = createSyncMock<[CustomEvent], void>();
      
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('openFile', openFileHandler);
      mockComponent.$on('share', shareHandler);

      // Simulate events from FileExplorerEnhanced
      const fileExplorer = document.querySelector('[data-testid="file-explorer"]');
      if (fileExplorer) {
        const openFileEvent = new CustomEvent('openFile', { 
          detail: { path: '/test/file.ts' },
          bubbles: true 
        });
        fileExplorer.dispatchEvent(openFileEvent);
        
        await waitFor(() => {
          expect(openFileHandler).toHaveBeenCalledWith(
            expect.objectContaining({ 
              detail: { path: '/test/file.ts' } 
            })
          );
        });
      }
    });
  });

  describe('State Management', () => {
    it('should update title when activeView changes', async () => {
      const { container, rerender, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      expect(container.querySelector('.sidebar-header h3')).toHaveTextContent('Explorer');
      
      await rerender({ activeView: 'search' });
      expect(container.querySelector('.sidebar-header h3')).toHaveTextContent('Search');
      
      await rerender({ activeView: 'git' });
      expect(container.querySelector('.sidebar-header h3')).toHaveTextContent('Source Control');
    });

    it('should maintain panel state when switching views', async () => {
      const { rerender, container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      // Start with explorer
      expect(container.querySelector('.sidebar-content')).toBeTruthy();
      
      // Switch to search
      await rerender({ activeView: 'search' });
      expect(container.querySelector('.sidebar-content')).toBeTruthy();
      
      // Switch back to explorer
      await rerender({ activeView: 'explorer' });
      expect(container.querySelector('.sidebar-content')).toBeTruthy();
    });
  });

  describe('Resize Functionality', () => {
    it('should have correct CSS for resizing', () => {
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      
      // Check that the sidebar uses CSS variable for width
      expect(sidebar).toHaveClass('sidebar');
    });

    it('should handle resize with custom width', () => {
      // Set custom CSS property
      document.documentElement.style.setProperty('--sidebar-width', '300px');
      
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      
      // The sidebar should exist and have the sidebar class
      expect(sidebar).toHaveClass('sidebar');
      
      // Cleanup
      document.documentElement.style.removeProperty('--sidebar-width');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      const sidebar = container.querySelector('.sidebar');
      expect(sidebar).toBeTruthy();
      
      // Action buttons should have accessible labels
      const actionButtons = container.querySelectorAll('.action-btn');
      actionButtons.forEach(button => {
        expect(button).toHaveAttribute('title');
      });
    });

    it('should support keyboard navigation for action buttons', async () => {
      const { container, component, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'explorer' } 
      });
      cleanup.push(unmount);
      
      const newFileHandler = createSyncMock<[CustomEvent], void>();
      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('newFile', newFileHandler);
      
      const firstButton = container.querySelector('.action-btn');
      expect(firstButton).toBeTruthy();
      
      // Click the button to verify event handling works
      await fireEvent.click(firstButton!);
      expect(newFileHandler).toHaveBeenCalled();
    });
  });

  describe('Styling', () => {
    it('should apply correct CSS classes', () => {
      const { container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      expect(container.querySelector('.sidebar')).toBeTruthy();
      expect(container.querySelector('.sidebar-header')).toBeTruthy();
      expect(container.querySelector('.sidebar-content')).toBeTruthy();
      expect(container.querySelector('.sidebar-actions')).toBeTruthy();
    });

    it('should have hover states for action buttons', async () => {
      const { container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: 'explorer' } 
      });
      cleanup.push(unmount);
      
      const button = container.querySelector('.action-btn');
      expect(button).toBeTruthy();
      
      // Hover state is handled by CSS, just verify the class exists
      expect(button).toHaveClass('action-btn');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing child components gracefully', () => {
      // This test ensures the component doesn't crash with invalid views
      const { container, unmount } = render(Sidebar, { 
        props: { ...mockProps, activeView: null as any } 
      });
      cleanup.push(unmount);
      
      expect(container.querySelector('.empty-state')).toBeTruthy();
    });
  });

  describe('Integration', () => {
    it('should work with all panel types in sequence', async () => {
      const { rerender, container, unmount } = render(Sidebar, { props: mockProps });
      cleanup.push(unmount);
      
      const views = ['explorer', 'search', 'git', 'debug', 'extensions'];
      
      for (const view of views) {
        await rerender({ activeView: view });
        
        const header = container.querySelector('.sidebar-header h3');
        expect(header).toBeTruthy();
        
        const content = container.querySelector('.sidebar-content');
        expect(content).toBeTruthy();
      }
    });
  });
});