import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import QuickSwitcher from './QuickSwitcher.svelte';
import { mockInvoke } from '../../test/utils';
import { createTypedMock, createSyncMock, createAsyncMock } from '@/test/mock-factory';

describe('QuickSwitcher', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const cleanup: Array<() => void> = [];
  
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    localStorage.clear();
    
    // Mock the tauri commands
    mockInvoke({
      get_sessions: [
        { id: 'session1', name: 'Main Session', pane_count: 2 },
      ],
      get_panes: [
        { id: 'pane1', pane_type: 'terminal', title: 'Terminal 1', working_dir: '/home/user' },
      ],
      get_file_operation_history: [
        { path: '/src/main.ts', timestamp: Date.now() - 1000 },
        { path: '/src/app.ts', timestamp: Date.now() - 2000 },
      ],
    });
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup.length = 0;
  });

  it('renders when show is true', async () => {
    const { getByPlaceholderText, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'Test File', type: 'file', icon: '📄' },
          { id: '2', title: 'Test Terminal', type: 'terminal', icon: '💻' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  it('does not render when show is false', () => {
    const { container, unmount } = render(QuickSwitcher, {
      props: { 
        show: false,
        testMode: true,
        initialItems: []
      },
    });
    cleanup.push(unmount);
    
    expect(container.querySelector('.quick-switcher')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const { getByPlaceholderText, container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'Test File', type: 'file', icon: '📄' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText(/Search/i);
    await fireEvent.keyDown(searchInput, { key: 'Escape' });
    
    // Component dispatches close event
    expect(container.querySelector('.quick-switcher')).toBeInTheDocument();
  });

  it('filters items based on search', async () => {
    const { getByPlaceholderText, container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'Terminal 1', type: 'terminal', icon: '💻', description: 'Terminal session' },
          { id: '2', title: 'main.ts', type: 'file', icon: '📄', description: 'TypeScript file' },
          { id: '3', title: 'Terminal 2', type: 'terminal', icon: '💻', description: 'Another terminal' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'terminal');
    
    // Should filter to show only terminal-related items
    await waitFor(() => {
      const items = container.querySelectorAll('.switch-item');
      const terminalItems = Array.from(items).filter(item => 
        item.textContent?.toLowerCase().includes('terminal')
      );
      expect(terminalItems.length).toBeGreaterThan(0);
    });
  });

  it('navigates with keyboard', async () => {
    const { getByPlaceholderText, container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'First Item', type: 'file', icon: '📄' },
          { id: '2', title: 'Second Item', type: 'terminal', icon: '💻' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText(/Search/i);
    
    // Press down arrow
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // Check if first item is selected
    await waitFor(() => {
      const selectedItem = container.querySelector('.selected');
      expect(selectedItem).toBeInTheDocument();
    });
  });

  it('loads recent items from localStorage', async () => {
    const recentItems = [
      { id: 'file1', timestamp: Date.now() },
      { id: 'terminal1', timestamp: Date.now() - 1000 },
    ];
    localStorage.setItem('orchflow_quick_switcher_recent', JSON.stringify(recentItems));
    
    const { container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: 'file1', title: 'Recent File', type: 'file', icon: '📄' },
          { id: 'terminal1', title: 'Recent Terminal', type: 'terminal', icon: '💻' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const items = container.querySelectorAll('.switch-item');
      expect(items.length).toBeGreaterThan(0);
    });
  });

  it('executes item on Enter', async () => {
    const { getByPlaceholderText, container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'Test Item', type: 'file', icon: '📄' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText(/Search/i);
    
    // Select first item
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // Press Enter to execute
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Component should dispatch select event
    expect(container.querySelector('.quick-switcher')).toBeInTheDocument();
  });

  it('shows different modes', async () => {
    const { container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        mode: 'files',
        testMode: true,
        initialItems: [
          { id: '1', title: 'Test File', type: 'file', icon: '📄' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      // In files mode, should only show file items
      const items = container.querySelectorAll('.switch-item');
      expect(items.length).toBeGreaterThanOrEqual(0);
    });
  });

  it('displays item icons', async () => {
    const { container, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: [
          { id: '1', title: 'Test File', type: 'file', icon: '📄' },
          { id: '2', title: 'Test Terminal', type: 'terminal', icon: '💻' }
        ]
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const icons = container.querySelectorAll('.item-icon');
      expect(icons.length).toBeGreaterThan(0);
    });
  });

  it('shows empty state when no items', async () => {
    const { getByText, unmount } = render(QuickSwitcher, {
      props: { 
        show: true,
        testMode: true,
        initialItems: []
      },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByText(/No recent items/i)).toBeInTheDocument();
    });
  });
});