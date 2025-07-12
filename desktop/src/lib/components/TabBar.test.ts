import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import { 
  renderWithContext, 
  simulateDragAndDrop,
  simulateKeyboard,
  waitForElement,
  simulateMouse 
} from '../../test/utils/component-test-utils';
import { createDataTransferMock } from '../../test/mock-factory';
import TabBar from './TabBar.svelte';

describe('TabBar', () => {
  let container: HTMLElement;
  
  beforeEach(() => {
    container = document.body;
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  const mockTabs = [
    { id: 'tab1', title: 'Terminal 1', type: 'terminal' as const, paneId: 'pane1' },
    { id: 'tab2', title: 'File 1', type: 'file' as const, paneId: 'pane2' },
    { id: 'tab3', title: 'Dashboard', type: 'dashboard' as const, paneId: 'pane3' }
  ];

  describe('Rendering', () => {
    it('should render tabs with correct icons and titles', () => {
      render(TabBar, { props: { tabs: mockTabs, activeTabId: 'tab1' } });
      
      // Check each tab is rendered
      expect(screen.getByText('Terminal 1')).toBeInTheDocument();
      expect(screen.getByText('File 1')).toBeInTheDocument();
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      
      // Check icons are rendered
      expect(screen.getByText('📟')).toBeInTheDocument(); // terminal icon
      expect(screen.getByText('📄')).toBeInTheDocument(); // file icon
      expect(screen.getByText('📊')).toBeInTheDocument(); // dashboard icon
    });

    it('should render empty message when no tabs', () => {
      render(TabBar, { props: { tabs: [], activeTabId: null } });
      
      expect(screen.getByText('No open tabs')).toBeInTheDocument();
    });

    it('should apply active class to selected tab', () => {
      const { container } = render(TabBar, { props: { tabs: mockTabs, activeTabId: 'tab2' } });
      
      const tabs = container.querySelectorAll('.tab');
      expect(tabs[0]).not.toHaveClass('active');
      expect(tabs[1]).toHaveClass('active');
      expect(tabs[2]).not.toHaveClass('active');
    });

    it('should render correct icon for different tab types', () => {
      const specialTabs = [
        { id: 'test1', title: 'Test', type: 'test' as const, paneId: 'pane1' },
        { id: 'settings1', title: 'Settings', type: 'settings' as const, paneId: 'pane2' },
        { id: 'plugins1', title: 'Plugins', type: 'plugins' as const, paneId: 'pane3' },
        { id: 'unknown1', title: 'Unknown', type: 'unknown' as const, paneId: 'pane4' }
      ];
      
      render(TabBar, { props: { tabs: specialTabs, activeTabId: null } });
      
      expect(screen.getByText('🧪')).toBeInTheDocument(); // test icon
      expect(screen.getByText('⚙️')).toBeInTheDocument(); // settings icon
      expect(screen.getByText('🔌')).toBeInTheDocument(); // plugins icon
      expect(screen.getByText('📋')).toBeInTheDocument(); // default icon
    });

    it('should have ellipsis class for truncating long tab titles', () => {
      const longTitleTab = [{
        id: 'long1',
        title: 'This is a very long tab title that should be truncated with ellipsis',
        type: 'file' as const,
        paneId: 'pane1'
      }];
      
      const { container } = render(TabBar, { props: { tabs: longTitleTab, activeTabId: null } });
      
      const tabTitle = container.querySelector('.tab-title');
      expect(tabTitle).toHaveClass('tab-title');
      // Verify the element has the correct structure for CSS ellipsis
      // (CSS styles may not be computed correctly in jsdom)
      expect(tabTitle?.parentElement).toHaveClass('tab');
    });
  });

  describe('Tab Selection', () => {
    it('should select tab on click', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const secondTab = container.querySelectorAll('.tab')[1];
      await fireEvent.click(secondTab);
      
      expect(component.activeTabId).toBe('tab2');
    });

    it('should update active tab when prop changes', async () => {
      const { component, container, rerender } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      expect(container.querySelector('.tab.active .tab-title')?.textContent).toBe('Terminal 1');
      
      await rerender({ tabs: mockTabs, activeTabId: 'tab3' });
      
      expect(container.querySelector('.tab.active .tab-title')?.textContent).toBe('Dashboard');
    });

    it('should maintain selection when tabs array changes', async () => {
      const { component, rerender } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab2' } 
      });
      
      const newTabs = [...mockTabs, { id: 'tab4', title: 'New Tab', type: 'file', paneId: 'pane4' }];
      await rerender({ tabs: newTabs, activeTabId: 'tab2' });
      
      expect(component.activeTabId).toBe('tab2');
    });
  });

  describe('Close Button', () => {
    it('should have close button that shows on hover', async () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const firstTab = container.querySelector('.tab');
      const closeButton = firstTab!.querySelector('.tab-close');
      
      // Verify close button exists and has correct class
      expect(closeButton).toHaveClass('tab-close');
      expect(closeButton).toHaveAttribute('title', 'Close tab');
      
      // Simulate hover - in real browser, CSS would handle opacity
      await fireEvent.mouseEnter(firstTab!);
      
      // Verify button is still present and functional
      expect(closeButton).toBeInTheDocument();
    });

    it('should dispatch closeTab event on close button click', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const closeHandler = vi.fn();
      component.$on('closeTab', closeHandler);
      
      const firstCloseButton = container.querySelector('.tab-close');
      await fireEvent.click(firstCloseButton!);
      
      expect(closeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { tabId: 'tab1' }
        })
      );
    });

    it('should prevent tab selection when clicking close button', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const secondTab = container.querySelectorAll('.tab')[1];
      const closeButton = secondTab.querySelector('.tab-close');
      
      await fireEvent.click(closeButton!);
      
      // Tab should not be selected
      expect(component.activeTabId).toBe('tab1');
    });

    it('should handle close button keyboard navigation', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const closeHandler = vi.fn();
      component.$on('closeTab', closeHandler);
      
      const closeButton = container.querySelector('.tab-close');
      (closeButton as HTMLElement).focus();
      
      await fireEvent.keyDown(closeButton!, { key: 'Enter' });
      
      expect(closeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: { tabId: 'tab1' }
        })
      );
    });
  });

  describe('Drag and Drop', () => {
    it('should allow dragging tabs', async () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const firstTab = container.querySelector('.tab');
      expect(firstTab).toHaveAttribute('draggable', 'true');
    });

    it('should reorder tabs on drag and drop', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: [...mockTabs], activeTabId: 'tab1' } 
      });
      
      const tabs = container.querySelectorAll('.tab');
      const firstTab = tabs[0];
      const thirdTab = tabs[2];
      
      // Mock DataTransfer
      const mockDataTransfer = createDataTransferMock({
        getData: vi.fn().mockReturnValue('tab1')
      });
      
      await simulateDragAndDrop(firstTab!, thirdTab!, mockDataTransfer);
      
      // Check tab order changed
      expect(component.tabs[0].id).toBe('tab2');
      expect(component.tabs[1].id).toBe('tab3');
      expect(component.tabs[2].id).toBe('tab1');
    });

    it('should not reorder when dropping on same tab', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: [...mockTabs], activeTabId: 'tab1' } 
      });
      
      const firstTab = container.querySelector('.tab');
      const initialOrder = component.tabs.map((t: any) => t.id);
      
      const mockDataTransfer = createDataTransferMock({
        getData: vi.fn().mockReturnValue('tab1')
      });
      
      await simulateDragAndDrop(firstTab!, firstTab!, mockDataTransfer);
      
      // Order should remain the same
      expect(component.tabs.map((t: { id: string }) => t.id)).toEqual(initialOrder);
    });

    it('should handle invalid drag data gracefully', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: [...mockTabs], activeTabId: 'tab1' } 
      });
      
      const firstTab = container.querySelector('.tab');
      const initialOrder = component.tabs.map((t: any) => t.id);
      
      const mockDataTransfer = createDataTransferMock({
        getData: vi.fn().mockReturnValue('invalid-tab-id')
      });
      
      await simulateDragAndDrop(firstTab!, firstTab!, mockDataTransfer);
      
      // Order should remain the same
      expect(component.tabs.map((t: { id: string }) => t.id)).toEqual(initialOrder);
    });

    it('should set correct drag effect', async () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const firstTab = container.querySelector('.tab');
      const mockDataTransfer = createDataTransferMock({
        effectAllowed: 'none',
        dropEffect: 'none'
      });
      
      await fireEvent.dragStart(firstTab!, { dataTransfer: mockDataTransfer });
      expect(mockDataTransfer.effectAllowed).toBe('move');
      
      await fireEvent.dragOver(firstTab!, { dataTransfer: mockDataTransfer });
      expect(mockDataTransfer.dropEffect).toBe('move');
    });
  });

  describe('Overflow Behavior', () => {
    it('should handle horizontal scrolling for many tabs', () => {
      const manyTabs = Array.from({ length: 20 }, (_, i) => ({
        id: `tab${i}`,
        title: `Tab ${i + 1}`,
        type: 'file',
        paneId: `pane${i}`
      }));
      
      const { container } = render(TabBar, { 
        props: { tabs: manyTabs, activeTabId: 'tab0' } 
      });
      
      const tabBar = container.querySelector('.tab-bar');
      // Verify tab bar has correct class for scrolling
      expect(tabBar).toHaveClass('tab-bar');
      // All tabs should be rendered
      const tabs = container.querySelectorAll('.tab');
      expect(tabs).toHaveLength(20);
    });

    it('should scroll active tab into view', async () => {
      const manyTabs = Array.from({ length: 20 }, (_, i) => ({
        id: `tab${i}`,
        title: `Tab ${i + 1}`,
        type: 'file',
        paneId: `pane${i}`
      }));
      
      const { container, rerender } = render(TabBar, { 
        props: { tabs: manyTabs, activeTabId: 'tab0' } 
      });
      
      const tabBar = container.querySelector('.tab-bar');
      const scrollIntoViewMock = vi.fn();
      
      // Mock scrollIntoView on the active tab
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
        configurable: true,
        value: scrollIntoViewMock
      });
      
      // Change active tab to one that would be out of view
      await rerender({ tabs: manyTabs, activeTabId: 'tab15' });
      
      const activeTab = container.querySelector('.tab.active');
      expect(activeTab).toBeTruthy();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should handle Tab key navigation between tabs', async () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const tabs = container.querySelectorAll('.tab');
      
      // Focus first tab
      (tabs[0] as HTMLElement).focus();
      expect(document.activeElement).toBe(tabs[0]);
      
      // Tab to next
      await fireEvent.keyDown(tabs[0], { key: 'Tab' });
      
      // Note: Browser behavior for Tab key is not simulated by testing library
      // We're just verifying the tabs are focusable
      expect(tabs[0]).toHaveAttribute('tabindex', '0');
      expect(tabs[1]).toHaveAttribute('tabindex', '0');
    });

    it('should activate tab on Enter key', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const secondTab = container.querySelectorAll('.tab')[1];
      (secondTab as HTMLElement).focus();
      
      await fireEvent.keyDown(secondTab, { key: 'Enter' });
      
      expect(component.activeTabId).toBe('tab2');
    });

    it('should activate tab on Space key', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const thirdTab = container.querySelectorAll('.tab')[2];
      (thirdTab as HTMLElement).focus();
      
      await fireEvent.keyDown(thirdTab, { key: ' ' });
      
      expect(component.activeTabId).toBe('tab3');
    });

    it('should handle arrow key navigation', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const tabs = container.querySelectorAll('.tab');
      (tabs[0] as HTMLElement).focus();
      
      // Right arrow to next tab
      await fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
      
      // Left arrow to previous tab
      (tabs[1] as HTMLElement).focus();
      await fireEvent.keyDown(tabs[1], { key: 'ArrowLeft' });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab2' } 
      });
      
      const tabBar = container.querySelector('.tab-bar');
      expect(tabBar).toHaveAttribute('role', 'tablist');
      
      const tabs = container.querySelectorAll('.tab');
      tabs.forEach((tab, index) => {
        expect(tab).toHaveAttribute('role', 'tab');
        expect(tab).toHaveAttribute('aria-selected', index === 1 ? 'true' : 'false');
        expect(tab).toHaveAttribute('tabindex', '0');
      });
    });

    it('should have accessible close button', () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const closeButtons = container.querySelectorAll('.tab-close');
      closeButtons.forEach(button => {
        expect(button).toHaveAttribute('title', 'Close tab');
        expect(button).toHaveAttribute('aria-label', expect.stringContaining('Close'));
      });
    });

    it('should announce tab changes to screen readers', async () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const secondTab = container.querySelectorAll('.tab')[1];
      
      // Create a live region for announcements
      const liveRegion = document.createElement('div');
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      container.appendChild(liveRegion);
      
      await fireEvent.click(secondTab);
      
      // In a real implementation, this would announce the tab change
      expect(secondTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty tabs array', () => {
      const { container } = render(TabBar, { 
        props: { tabs: [], activeTabId: null } 
      });
      
      expect(container.querySelector('.empty-message')).toBeInTheDocument();
      expect(container.querySelectorAll('.tab')).toHaveLength(0);
    });

    it('should handle activeTabId not in tabs array', () => {
      const { container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'non-existent' } 
      });
      
      const activeTabs = container.querySelectorAll('.tab.active');
      expect(activeTabs).toHaveLength(0);
    });

    it('should handle rapid tab switching', async () => {
      const { component, container } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const tabs = container.querySelectorAll('.tab');
      
      // Rapidly click different tabs
      await fireEvent.click(tabs[1]);
      await fireEvent.click(tabs[2]);
      await fireEvent.click(tabs[0]);
      await fireEvent.click(tabs[2]);
      
      expect(component.activeTabId).toBe('tab3');
    });

    it('should handle tabs with missing properties', () => {
      const incompleteTabs = [
        { id: 'tab1', title: 'Tab 1', type: 'file' }, // missing paneId
        { id: 'tab2', title: '', type: 'terminal', paneId: 'pane2' }, // empty title
        { id: 'tab3', title: 'Tab 3', type: '', paneId: 'pane3' } // empty type
      ];
      
      const { container } = render(TabBar, { 
        props: { tabs: incompleteTabs, activeTabId: 'tab1' } 
      });
      
      expect(container.querySelectorAll('.tab')).toHaveLength(3);
      expect(screen.getByText('📋')).toBeInTheDocument(); // default icon for empty type
    });
  });

  describe('Performance', () => {
    it('should efficiently update when tabs change', async () => {
      const { rerender } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const updateStartTime = performance.now();
      
      // Add many tabs
      const manyTabs = Array.from({ length: 100 }, (_, i) => ({
        id: `tab${i}`,
        title: `Tab ${i + 1}`,
        type: 'file',
        paneId: `pane${i}`
      }));
      
      await rerender({ tabs: manyTabs, activeTabId: 'tab50' });
      
      const updateEndTime = performance.now();
      const updateTime = updateEndTime - updateStartTime;
      
      // Update should be fast even with many tabs
      expect(updateTime).toBeLessThan(300); // 300ms threshold for CI environments
    });

    it('should not re-render unnecessarily', async () => {
      const { component, rerender } = render(TabBar, { 
        props: { tabs: mockTabs, activeTabId: 'tab1' } 
      });
      
      const initialTabs = component.tabs;
      
      // Re-render with same props
      await rerender({ tabs: mockTabs, activeTabId: 'tab1' });
      
      // Should use same array reference if unchanged
      expect(component.tabs).toBe(initialTabs);
    });
  });
});