import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Dashboard from './Dashboard.svelte';

// Mock the manager store module first
vi.mock('../stores/manager', () => {
  const { writable } = require('svelte/store');
  const mockSessions = writable([]);
  const mockActiveSession = writable(null);
  const mockPanes = writable(new Map());
  
  return {
    manager: {
      subscribe: vi.fn(),
      createSession: vi.fn(),
      createTerminal: vi.fn(),
      focusPane: vi.fn()
    },
    sessions: mockSessions,
    activeSession: mockActiveSession,
    panes: mockPanes
  };
});

// Import mocked manager and stores after mocking
import { manager, sessions as sessionsStore, panes as panesStore } from '../stores/manager';

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores
    sessionsStore.set([]);
    panesStore.set(new Map());
    
    // Mock window functions
    global.prompt = vi.fn();
  });

  it('should render dashboard with header', () => {
    const { container, getByText } = render(Dashboard);
    
    const dashboard = container.querySelector('.dashboard');
    expect(dashboard).toBeTruthy();
    expect(getByText('Dashboard')).toBeTruthy();
  });

  it('should toggle between grid and table view', async () => {
    // Need at least one session to see grid/table views
    sessionsStore.set([
      { id: 'session1', name: 'Test Session' }
    ]);
    
    const { getByText, container } = render(Dashboard);
    await tick();
    
    // Should start in grid view
    expect(container.querySelector('.grid-view')).toBeTruthy();
    expect(container.querySelector('.table-view')).toBeFalsy();
    
    // Click toggle button
    const toggleButton = getByText('📋 Table View');
    await fireEvent.click(toggleButton);
    
    // Should now be in table view
    expect(container.querySelector('.table-view')).toBeTruthy();
    expect(container.querySelector('.grid-view')).toBeFalsy();
    expect(getByText('📊 Grid View')).toBeTruthy();
  });

  it('should show empty state when no sessions exist', () => {
    const { getByText } = render(Dashboard);
    
    expect(getByText('No active sessions')).toBeTruthy();
    expect(getByText('Create First Session')).toBeTruthy();
  });

  it('should create new session when clicking create button', async () => {
    global.prompt = vi.fn().mockReturnValue('Test Session');
    vi.mocked(manager.createSession).mockResolvedValue({
      id: 'new-session',
      name: 'Test Session'
    });
    
    const { getByText } = render(Dashboard);
    
    const createButton = getByText('Create First Session');
    await fireEvent.click(createButton);
    
    expect(global.prompt).toHaveBeenCalledWith('Session name:');
    expect(manager.createSession).toHaveBeenCalledWith('Test Session');
  });

  it('should use default session name when prompt is cancelled', async () => {
    sessionsStore.set([
      { id: 'session1', name: 'Session 1' }
    ]);
    
    global.prompt = vi.fn().mockReturnValue(null);
    
    const { getByText } = render(Dashboard);
    await tick();
    
    const createButton = getByText('➕ New Session');
    await fireEvent.click(createButton);
    
    expect(manager.createSession).toHaveBeenCalledWith('Session 2');
  });

  it('should display sessions in grid view', async () => {
    const testSessions = [
      { id: 'session1', name: 'Dev Session' },
      { id: 'session2', name: 'Test Session' }
    ];
    
    sessionsStore.set(testSessions);
    
    const { getByText } = render(Dashboard);
    await tick();
    
    expect(getByText('Dev Session')).toBeTruthy();
    expect(getByText('Test Session')).toBeTruthy();
  });

  it('should display panes for each session', async () => {
    const testSessions = [
      { id: 'session1', name: 'Dev Session' }
    ];
    
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        working_dir: '/home/user/project'
      }],
      ['pane2', {
        id: 'pane2',
        session_id: 'session1',
        pane_type: 'Editor',
        title: 'main.js'
      }]
    ]);
    
    sessionsStore.set(testSessions);
    panesStore.set(testPanes);
    
    const { getByText, container } = render(Dashboard);
    await tick();
    
    expect(getByText('Terminal 1')).toBeTruthy();
    expect(getByText('main.js')).toBeTruthy();
    
    // Check pane type icons
    expect(container.querySelector('.pane-icon')?.textContent).toContain('📟');
  });

  it('should show correct pane type icons', async () => {
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
      }],
      ['pane4', {
        id: 'pane4',
        session_id: 'session1',
        pane_type: 'Unknown',
        title: 'Other'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { container } = render(Dashboard);
    await tick();
    
    const icons = Array.from(container.querySelectorAll('.pane-icon')).map(el => el.textContent);
    expect(icons).toContain('📟'); // Terminal
    expect(icons).toContain('📝'); // Editor
    expect(icons).toContain('📁'); // FileTree
    expect(icons).toContain('📋'); // Unknown/default
  });

  it('should create new terminal when clicking add new pane', async () => {
    sessionsStore.set([{ id: 'session1', name: 'Test Session' }]);
    
    vi.mocked(manager.createTerminal).mockResolvedValue({
      id: 'new-pane',
      session_id: 'session1',
      pane_type: 'Terminal',
      title: 'New Terminal'
    });
    
    const { getByText } = render(Dashboard);
    await tick();
    
    const addButton = getByText('New Terminal');
    await fireEvent.click(addButton);
    
    expect(manager.createTerminal).toHaveBeenCalledWith('session1', 'Terminal');
  });

  it('should set active pane when clicking pane card', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { container } = render(Dashboard);
    await tick();
    
    const paneCard = container.querySelector('.pane-card:not(.add-new)');
    await fireEvent.click(paneCard!);
    
    expect(manager.focusPane).toHaveBeenCalledWith('pane1');
  });

  it('should display table view with correct columns', async () => {
    const testSessions = [{ id: 'session1', name: 'Test Session' }];
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1'
      }]
    ]);
    
    sessionsStore.set(testSessions);
    panesStore.set(testPanes);
    
    const { getByText, container } = render(Dashboard);
    await tick();
    
    // Switch to table view
    await fireEvent.click(getByText('📋 Table View'));
    
    // Check table headers
    expect(getByText('Session')).toBeTruthy();
    expect(getByText('Pane')).toBeTruthy();
    expect(getByText('Type')).toBeTruthy();
    expect(getByText('Status')).toBeTruthy();
    expect(getByText('CPU %')).toBeTruthy();
    expect(getByText('Memory')).toBeTruthy();
    expect(getByText('Actions')).toBeTruthy();
    
    // Check table data
    expect(getByText('Test Session')).toBeTruthy();
    expect(getByText('Terminal 1')).toBeTruthy();
    expect(container.querySelector('.pane-type')?.textContent).toBe('Terminal');
  });

  it('should display metrics for panes', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { container } = render(Dashboard);
    await tick();
    
    // Wait for metrics collection (happens in onMount)
    await waitFor(() => {
      const cpuMetric = container.querySelector('.metric .value');
      expect(cpuMetric).toBeTruthy();
      // Should have some CPU value
      expect(cpuMetric?.textContent).toMatch(/\d+(\.\d+)?%/);
    });
  });

  it('should refresh metrics when clicking refresh button', async () => {
    // Need panes to see metrics
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { getByText, container } = render(Dashboard);
    await tick();
    
    const refreshButton = getByText('🔄 Refresh');
    
    // Get initial metrics value
    await waitFor(() => {
      expect(container.querySelector('.metric')).toBeTruthy();
    });
    
    // Click refresh
    await fireEvent.click(refreshButton);
    
    // Metrics should still be present (collectMetrics was called)
    expect(container.querySelector('.metric')).toBeTruthy();
  });

  it('should show working directory for panes that have it', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1',
        working_dir: '/home/user/my-project'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { container } = render(Dashboard);
    await tick();
    
    const workingDir = container.querySelector('.working-dir');
    expect(workingDir).toBeTruthy();
    expect(workingDir?.textContent).toContain('my-project');
    expect(workingDir?.getAttribute('title')).toBe('/home/user/my-project');
  });

  it('should filter panes by session', async () => {
    const testSessions = [
      { id: 'session1', name: 'Session 1' },
      { id: 'session2', name: 'Session 2' }
    ];
    
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Session 1 Terminal'
      }],
      ['pane2', {
        id: 'pane2',
        session_id: 'session2',
        pane_type: 'Terminal',
        title: 'Session 2 Terminal'
      }]
    ]);
    
    sessionsStore.set(testSessions);
    panesStore.set(testPanes);
    
    const { getByText, queryByText } = render(Dashboard);
    await tick();
    
    // Should show both sessions' panes
    expect(getByText('Session 1 Terminal')).toBeTruthy();
    expect(getByText('Session 2 Terminal')).toBeTruthy();
    
    // Each session group should only show its own panes
    const session1Group = getByText('Session 1').closest('.session-group');
    expect(session1Group?.textContent).toContain('Session 1 Terminal');
    expect(session1Group?.textContent).not.toContain('Session 2 Terminal');
  });

  it('should handle view action button in table view', async () => {
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal',
        title: 'Terminal 1'
      }]
    ]);
    
    sessionsStore.set([{ id: 'session1', name: 'Test' }]);
    panesStore.set(testPanes);
    
    const { getByText, container } = render(Dashboard);
    await tick();
    
    // Switch to table view
    await fireEvent.click(getByText('📋 Table View'));
    await tick();
    
    const viewButton = container.querySelector('.action-btn');
    expect(viewButton?.textContent).toBe('View');
    
    await fireEvent.click(viewButton!);
    expect(manager.focusPane).toHaveBeenCalledWith('pane1');
  });
});