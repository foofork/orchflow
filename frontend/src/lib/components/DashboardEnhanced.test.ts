import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import DashboardEnhanced from './DashboardEnhanced.svelte';

// Mock the manager store module
vi.mock('../stores/manager', () => {
  const { writable } = require('svelte/store');
  const mockSessions = writable([]);
  const mockPanes = writable(new Map());
  const mockIsConnected = writable(true);
  
  return {
    manager: {
      subscribe: vi.fn(),
      createSession: vi.fn(),
      createTerminal: vi.fn(),
      closePane: vi.fn(),
      focusPane: vi.fn()
    },
    sessions: mockSessions,
    panes: mockPanes,
    isConnected: mockIsConnected
  };
});

// Import mocked stores after mocking
import { manager, sessions as sessionsStore, panes as panesStore, isConnected as connectedStore } from '../stores/manager';

describe('DashboardEnhanced Component', () => {
  const mockOnSelectPane = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores
    sessionsStore.set([]);
    panesStore.set(new Map());
    connectedStore.set(true);
    mockOnSelectPane.mockClear();
  });

  it('should render dashboard with header', () => {
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    
    expect(getByText('OrchFlow Dashboard')).toBeTruthy();
  });

  it('should show connection status', async () => {
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    
    expect(getByText('● Connected')).toBeTruthy();
    
    // Update connection status
    connectedStore.set(false);
    await tick();
    
    expect(getByText('● Disconnected')).toBeTruthy();
  });

  it('should toggle between card and table view', async () => {
    // Need panes to see the grid/table views
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        is_active: true
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { getByText, container } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    // Should start in card view
    expect(container.querySelector('.agent-grid')).toBeTruthy();
    expect(container.querySelector('.table-container')).toBeFalsy();
    
    // Click toggle button
    const toggleButton = getByText('📋 Table View');
    await fireEvent.click(toggleButton);
    
    // Should now be in table view
    expect(container.querySelector('.table-container')).toBeTruthy();
    expect(container.querySelector('.agent-grid')).toBeFalsy();
    expect(getByText('📊 Card View')).toBeTruthy();
  });

  it('should display system stats', () => {
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    
    expect(getByText('System CPU')).toBeTruthy();
    expect(getByText('Memory Used')).toBeTruthy();
    expect(getByText('Running')).toBeTruthy();
    expect(getByText('Idle')).toBeTruthy();
    expect(getByText('Errors')).toBeTruthy();
  });

  it('should show empty state when no panes exist', () => {
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    
    expect(getByText('No panes running')).toBeTruthy();
    expect(getByText('Press Ctrl+P to open command palette')).toBeTruthy();
  });

  it('should display panes in card view', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        is_active: true
      }],
      ['pane2', {
        id: 'pane2',
        session_id: 'session1',
        pane_type: 'Editor',
        title: 'main.js',
        is_active: false
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { getByText, container } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    expect(getByText('Terminal 1')).toBeTruthy();
    expect(getByText('main.js')).toBeTruthy();
    
    // Check pane type display
    const paneTypes = container.querySelectorAll('.agent-type');
    expect(Array.from(paneTypes).map(el => el.textContent)).toContain('Terminal');
    expect(Array.from(paneTypes).map(el => el.textContent)).toContain('Editor');
  });

  it('should display panes in table view', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        is_active: true
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { getByText, container } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    // Switch to table view
    await fireEvent.click(getByText('📋 Table View'));
    
    // Check table headers
    expect(getByText('Name')).toBeTruthy();
    expect(getByText('Type')).toBeTruthy();
    expect(getByText('Status')).toBeTruthy();
    expect(getByText('CPU %')).toBeTruthy();
    expect(getByText('Memory')).toBeTruthy();
    expect(getByText('Actions')).toBeTruthy();
    
    // Check table data
    expect(getByText('Terminal 1')).toBeTruthy();
  });

  it('should handle attach pane action', async () => {
    const testPane = {
      id: 'pane1',
      session_id: 'session1',
      pane_type: 'Terminal',
      title: 'Terminal 1',
      is_active: true
    };
    
    const testPanes = new Map([['pane1', testPane]]);
    panesStore.set(testPanes);
    
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    const attachButton = getByText('Attach');
    await fireEvent.click(attachButton);
    
    expect(manager.focusPane).toHaveBeenCalledWith('pane1');
    expect(mockOnSelectPane).toHaveBeenCalledWith(testPane);
  });

  it('should handle restart pane action', async () => {
    const testPane = {
      id: 'pane1',
      session_id: 'session1',
      pane_type: 'Terminal',
      title: 'Terminal 1',
      is_active: true
    };
    
    const testPanes = new Map([['pane1', testPane]]);
    panesStore.set(testPanes);
    
    vi.mocked(manager.createTerminal).mockResolvedValue({
      id: 'new-pane',
      session_id: 'session1',
      pane_type: 'Terminal',
      title: 'Terminal 1',
      is_active: true
    });
    
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    const restartButton = getByText('Restart');
    await fireEvent.click(restartButton);
    
    await waitFor(() => {
      expect(manager.closePane).toHaveBeenCalledWith('pane1');
      expect(manager.createTerminal).toHaveBeenCalledWith('session1', 'Terminal 1');
    });
  });

  it('should handle kill pane action', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        is_active: true
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { getByText } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    const killButton = getByText('Kill');
    await fireEvent.click(killButton);
    
    expect(manager.closePane).toHaveBeenCalledWith('pane1');
  });

  it('should display metrics for panes', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        is_active: true
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { container } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    // Wait for metrics collection (happens in onMount)
    await waitFor(() => {
      const cpuLabel = container.querySelector('.metric-label');
      expect(cpuLabel).toBeTruthy();
      expect(cpuLabel?.textContent).toBe('CPU');
      
      const memoryLabel = Array.from(container.querySelectorAll('.metric-label'))
        .find(el => el.textContent === 'Memory');
      expect(memoryLabel).toBeTruthy();
    });
  });

  it('should show correct icons for pane types', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal'
      }],
      ['pane2', {
        id: 'pane2',
        session_id: 'session1',
        pane_type: 'Editor',
        title: 'Editor'
      }],
      ['pane3', {
        id: 'pane3',
        session_id: 'session1',
        pane_type: 'FileTree',
        title: 'Files'
      }]
    ]);
    
    panesStore.set(testPanes);
    
    const { container } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    const statusIcons = container.querySelectorAll('.status-icon');
    const iconTexts = Array.from(statusIcons).map(el => el.textContent);
    
    expect(iconTexts).toContain('📟'); // Terminal
    expect(iconTexts).toContain('📝'); // Editor
    expect(iconTexts).toContain('📁'); // FileTree
  });

  it('should handle attach action in table view', async () => {
    const testPane = {
      id: 'pane1',
      session_id: 'session1',
      pane_type: 'Terminal',
      title: 'Terminal 1',
      is_active: true
    };
    
    const testPanes = new Map([['pane1', testPane]]);
    panesStore.set(testPanes);
    
    const { getByText, getByTitle } = render(DashboardEnhanced, {
      props: { onSelectPane: mockOnSelectPane }
    });
    await tick();
    
    // Switch to table view
    await fireEvent.click(getByText('📋 Table View'));
    
    const attachButton = getByTitle('Attach to pane');
    await fireEvent.click(attachButton);
    
    expect(manager.focusPane).toHaveBeenCalledWith('pane1');
    expect(mockOnSelectPane).toHaveBeenCalledWith(testPane);
  });
});