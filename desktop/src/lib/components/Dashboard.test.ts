import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import Dashboard from './Dashboard.svelte';

// Mock the manager store module first
vi.mock('$lib/stores/manager', async () => {
  const { writable, derived } = await import('svelte/store');
  const { vi } = await import('vitest');
  
  interface ManagerState {
    sessions: any[];
    panes: Map<string, any>;
    activeSessionId?: string;
    activePaneId?: string;
    plugins: any[];
    terminalOutputs: Map<string, string>;
    isConnected: boolean;
  }
  
  const managerStore = writable<ManagerState>({
    sessions: [],
    panes: new Map(),
    activeSessionId: undefined,
    activePaneId: undefined,
    plugins: [],
    terminalOutputs: new Map(),
    isConnected: true
  });
  
  return {
    manager: {
      subscribe: managerStore.subscribe,
      createSession: vi.fn().mockResolvedValue(undefined),
      createTerminal: vi.fn().mockResolvedValue(undefined),
      focusPane: vi.fn().mockResolvedValue(undefined),
      update: managerStore.update,
      set: managerStore.set
    },
    sessions: derived(managerStore, $manager => $manager.sessions),
    activeSession: derived(managerStore, $manager => 
      $manager.sessions.find(s => s.id === $manager.activeSessionId)
    ),
    panes: derived(managerStore, $manager => $manager.panes)
  };
});

// Import mocked manager and stores after mocking
import { manager, sessions as sessionsStore, panes as panesStore } from '$lib/stores/manager';

// Helper function to update manager state
function updateManagerState(updates: any) {
  (manager as any).update((state: any) => ({ ...state, ...updates }));
}

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset manager store state
    (manager as any).set({
      sessions: [],
      panes: new Map(),
      activeSessionId: undefined,
      activePaneId: undefined,
      plugins: [],
      terminalOutputs: new Map(),
      isConnected: true
    });
    
    // Mock window functions
    global.prompt = vi.fn() as any;
  });

  it('should render dashboard with header', () => {
    const { container, getByText } = render(Dashboard);
    
    const dashboard = container.querySelector('.dashboard');
    expect(dashboard).toBeTruthy();
    expect(getByText('Dashboard')).toBeTruthy();
  });

  it('should toggle between grid and table view', async () => {
    // Need at least one session to see grid/table views
    updateManagerState({ sessions: [
      { 
        id: 'session1', 
        name: 'Test Session',
        panes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ] });
    
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
    global.prompt = vi.fn().mockReturnValue('Test Session') as any;
    vi.mocked(manager.createSession).mockResolvedValue({
      id: 'new-session',
      name: 'Test Session',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    const { getByText } = render(Dashboard);
    
    const createButton = getByText('Create First Session');
    await fireEvent.click(createButton);
    
    expect(global.prompt).toHaveBeenCalledWith('Session name:');
    expect(manager.createSession).toHaveBeenCalledWith('Test Session');
  });

  it('should use default session name when prompt is cancelled', async () => {
    updateManagerState({ sessions: [
      { 
        id: 'session1', 
        name: 'Session 1',
        panes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ] });
    
    global.prompt = vi.fn().mockReturnValue(null) as any;
    
    const { getByText } = render(Dashboard);
    await tick();
    
    const createButton = getByText('➕ New Session');
    await fireEvent.click(createButton);
    
    expect(manager.createSession).toHaveBeenCalledWith('Session 2');
  });

  it('should display sessions in grid view', async () => {
    const testSessions = [
      { 
        id: 'session1', 
        name: 'Dev Session',
        panes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      { 
        id: 'session2', 
        name: 'Test Session',
        panes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    updateManagerState({ sessions: testSessions });
    
    const { getByText } = render(Dashboard);
    await tick();
    
    expect(getByText('Dev Session')).toBeTruthy();
    expect(getByText('Test Session')).toBeTruthy();
  });

  it('should display panes for each session', async () => {
    const testSessions = [
      { 
        id: 'session1', 
        name: 'Dev Session',
        panes: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    
    const testPanes = new Map([
      ['pane1', {
        id: 'pane1',
        session_id: 'session1',
        pane_type: 'Terminal' as const,
        title: 'Terminal 1',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }],
      ['pane2', {
        id: 'pane2',
        session_id: 'session1',
        pane_type: 'Editor' as const,
        title: 'main.js',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]
    ]);
    
    updateManagerState({ 
      sessions: testSessions,
      panes: testPanes
    });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
    const { container } = render(Dashboard);
    await tick();
    
    const icons = Array.from(container.querySelectorAll('.pane-icon')).map(el => el.textContent);
    expect(icons).toContain('📟'); // Terminal
    expect(icons).toContain('📝'); // Editor
    expect(icons).toContain('📁'); // FileTree
    expect(icons).toContain('📋'); // Unknown/default
  });

  it('should create new terminal when clicking add new pane', async () => {
    updateManagerState({ sessions: [{ id: 'session1', name: 'Test Session' }] });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
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
    
    updateManagerState({ 
      sessions: testSessions,
      panes: testPanes
    });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
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
    
    updateManagerState({ 
      sessions: testSessions,
      panes: testPanes
    });
    
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
    
    updateManagerState({ sessions: [{ 
      id: 'session1', 
      name: 'Test',
      panes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }] });
    updateManagerState({ panes: testPanes });
    
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