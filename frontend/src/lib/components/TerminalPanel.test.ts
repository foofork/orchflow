import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import TerminalPanel from './TerminalPanel.svelte';
import { mockInvoke } from '../../test/utils';

describe('TerminalPanel', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  const mockTerminals = [
    { id: 'term-1', title: 'Terminal 1', cwd: '/home/user', isActive: true, isRunning: true },
    { id: 'term-2', title: 'Terminal 2', cwd: '/home/user', isActive: false, isRunning: false },
  ];
  
  // Helper function to render with testMode
  const renderTerminalPanel = (props: any = {}) => {
    return render(TerminalPanel, {
      props: {
        testMode: true,
        ...props
      }
    });
  };

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockInvoke({
      create_streaming_terminal: { 
        terminalId: 'term-3',
        sessionId: 'session-1',
        paneId: 'pane-3',
      },
      get_available_shells: [
        { name: 'bash', path: '/bin/bash' },
        { name: 'zsh', path: '/bin/zsh' },
        { name: 'fish', path: '/usr/local/bin/fish' },
      ],
      get_terminal_groups: ['default', 'servers', 'builds'],
      rename_terminal: true,
      send_terminal_input: true,
      get_current_dir: '/home/user',
    });
  });

  it('renders terminal panel container', () => {
    const { container } = renderTerminalPanel({ 
      terminals: mockTerminals,
    });
    
    const panel = container.querySelector('.terminal-panel');
    expect(panel).toBeInTheDocument();
  });

  it('displays terminal tabs', () => {
    const { getByText } = renderTerminalPanel({ 
      terminals: mockTerminals 
    });
    
    expect(getByText('Terminal 1')).toBeInTheDocument();
    expect(getByText('Terminal 2')).toBeInTheDocument();
  });

  it('creates new terminal', async () => {
    const handleTerminalCreate = vi.fn();
    const { getByTitle } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onTerminalCreate: handleTerminalCreate,
    });
    
    const newTerminalButton = getByTitle(/New terminal/i);
    await fireEvent.click(newTerminalButton);
    
    expect(handleTerminalCreate).toHaveBeenCalled();
  });

  it('switches between terminal tabs', async () => {
    const handleTabSwitch = vi.fn();
    const { getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      onTabSwitch: handleTabSwitch,
    });
    
    const tab2 = getByText('Terminal 2').closest('[role="tab"]') || getByText('Terminal 2');
    await fireEvent.click(tab2);
    
    expect(handleTabSwitch).toHaveBeenCalledWith('term-2');
  });

  it('closes terminal tab', async () => {
    const handleTerminalClose = vi.fn();
    const { getAllByTitle } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onTerminalClose: handleTerminalClose,
    });
    
    const closeButtons = getAllByTitle(/Close terminal/i);
    expect(closeButtons.length).toBeGreaterThan(0);
    
    await fireEvent.click(closeButtons[0]);
    
    expect(handleTerminalClose).toHaveBeenCalledWith('term-1');
  });

  it('shows terminal selector dropdown', async () => {
    const { getByTitle, getByText } = renderTerminalPanel({ 
      terminals: mockTerminals 
    });
    
    const selectorButton = getByTitle(/Terminal selector|Shell selector|Choose shell/i);
    await fireEvent.click(selectorButton);
    
    await waitFor(() => {
      expect(getByText(/💻 bash/i)).toBeInTheDocument();
      expect(getByText(/💻 zsh/i)).toBeInTheDocument();
      expect(getByText(/💻 sh/i)).toBeInTheDocument();
    });
  });

  it('handles split view actions', async () => {
    const handleSplit = vi.fn();
    const { getByTitle } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onSplit: handleSplit,
    });
    
    // Split horizontal
    const splitHButton = getByTitle(/Split horizontal/i);
    await fireEvent.click(splitHButton);
    expect(handleSplit).toHaveBeenCalledWith('horizontal');
    
    // Split vertical
    const splitVButton = getByTitle(/Split vertical/i);
    await fireEvent.click(splitVButton);
    expect(handleSplit).toHaveBeenCalledWith('vertical');
  });

  it('displays terminal groups', async () => {
    const { getByText, getByTitle } = renderTerminalPanel({ 
      terminals: mockTerminals,
      terminalGroups: ['default', 'servers', 'builds'],
    });
    
    const groupButton = getByTitle(/Terminal groups|Groups/i);
    await fireEvent.click(groupButton);
    
    await waitFor(() => {
      expect(getByText('default')).toBeInTheDocument();
      expect(getByText('servers')).toBeInTheDocument();
      expect(getByText('builds')).toBeInTheDocument();
    });
  });

  it('toggles broadcast mode', async () => {
    const handleBroadcast = vi.fn();
    const { getByTitle } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onBroadcastToggle: handleBroadcast,
    });
    
    const broadcastButton = getByTitle(/Toggle broadcast|Broadcast/i);
    await fireEvent.click(broadcastButton);
    
    expect(handleBroadcast).toHaveBeenCalled();
  });

  it('shows quick commands menu', async () => {
    const { getByTitle, getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      quickCommands: [
        { label: 'Clear', command: 'clear' },
        { label: 'List files', command: 'ls -la' },
        { label: 'Git status', command: 'git status' },
      ],
    });
    
    const quickCommandsButton = getByTitle(/Quick commands|Commands/i);
    await fireEvent.click(quickCommandsButton);
    
    await waitFor(() => {
      expect(getByText('Clear')).toBeInTheDocument();
      expect(getByText('List files')).toBeInTheDocument();
      expect(getByText('Git status')).toBeInTheDocument();
    });
  });

  it('executes quick command', async () => {
    const handleQuickCommand = vi.fn();
    const { getByTitle, getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
      quickCommands: [
        { label: 'Clear', command: 'clear' },
      ],
      onQuickCommand: handleQuickCommand,
    });
    
    const quickCommandsButton = getByTitle(/Quick commands|Commands/i);
    await fireEvent.click(quickCommandsButton);
    
    await waitFor(() => {
      const clearCommand = getByText('Clear');
      fireEvent.click(clearCommand);
    });
    
    expect(handleQuickCommand).toHaveBeenCalledWith('clear');
  });

  it('shows process status indicators', () => {
    const { container } = renderTerminalPanel({ 
      terminals: mockTerminals 
    });
    
    // Look for status indicators - they are shown as emoji icons
    const tabs = container.querySelectorAll('.terminal-tab');
    expect(tabs.length).toBe(2);
    
    // First terminal has running process (🟢)
    expect(tabs[0].textContent).toContain('🟢');
    
    // Second terminal is stopped (⚫)
    expect(tabs[1].textContent).toContain('⚫');
  });

  it('handles terminal rename', async () => {
    const handleRename = vi.fn();
    const { getByText, getByDisplayValue } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onTerminalRename: handleRename,
    });
    
    // Double-click to start rename
    const terminalTab = getByText('Terminal 1').closest('[role="tab"]') || getByText('Terminal 1');
    await fireEvent.dblClick(terminalTab);
    
    // Input should appear
    await waitFor(() => {
      const input = getByDisplayValue('Terminal 1');
      expect(input).toBeInTheDocument();
    });
    
    const input = getByDisplayValue('Terminal 1');
    await user.clear(input);
    await user.type(input, 'My Terminal');
    await fireEvent.keyDown(input, { key: 'Enter' });
    
    expect(handleRename).toHaveBeenCalledWith('term-1', 'My Terminal');
  });

  it('supports tab reordering with drag and drop', async () => {
    const handleReorder = vi.fn();
    const { getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onTabReorder: handleReorder,
    });
    
    const tab1 = getByText('Terminal 1').closest('[role="tab"]') || getByText('Terminal 1');
    const tab2 = getByText('Terminal 2').closest('[role="tab"]') || getByText('Terminal 2');
    
    // Simulate drag and drop
    await fireEvent.dragStart(tab1);
    await fireEvent.dragOver(tab2);
    await fireEvent.drop(tab2);
    await fireEvent.dragEnd(tab1);
    
    expect(handleReorder).toHaveBeenCalled();
  });

  it('shows layout options', async () => {
    const handleLayoutChange = vi.fn();
    const { getByTitle, getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      supportedLayouts: ['single', 'split', 'grid'],
      onLayoutChange: handleLayoutChange,
    });
    
    const layoutButton = getByTitle(/Layout options|Layout|View/i);
    await fireEvent.click(layoutButton);
    
    await waitFor(() => {
      expect(getByText(/Single/i)).toBeInTheDocument();
      expect(getByText(/Split/i)).toBeInTheDocument();
      expect(getByText(/Grid/i)).toBeInTheDocument();
    });
    
    await fireEvent.click(getByText(/Grid/i));
    expect(handleLayoutChange).toHaveBeenCalledWith('grid');
  });

  it('shows terminal context menu', async () => {
    const { getByText } = renderTerminalPanel({ 
      terminals: mockTerminals 
    });
    
    const terminalTab = getByText('Terminal 1').closest('[role="tab"]') || getByText('Terminal 1');
    await fireEvent.contextMenu(terminalTab);
    
    await waitFor(() => {
      expect(getByText(/Rename|Duplicate|Close|Move/)).toBeInTheDocument();
    });
  });

  it('indicates active terminal', () => {
    const { getByText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      activeTerminalId: 'term-1',
    });
    
    const activeTab = getByText('Terminal 1').closest('[role="tab"]');
    const inactiveTab = getByText('Terminal 2').closest('[role="tab"]');
    
    // Active tab should have different styling
    expect(activeTab?.getAttribute('aria-selected')).toBe('true');
    expect(inactiveTab?.getAttribute('aria-selected')).toBe('false');
  });

  it('handles terminal output search', async () => {
    const handleSearch = vi.fn();
    const { getByTitle, getByPlaceholderText } = renderTerminalPanel({ 
      terminals: mockTerminals,
      onSearch: handleSearch,
    });
    
    const searchButton = getByTitle(/Search|Find/i);
    await fireEvent.click(searchButton);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText(/Search terminal|Find in terminal/i);
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText(/Search terminal|Find in terminal/i);
    await user.type(searchInput, 'error');
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    expect(handleSearch).toHaveBeenCalledWith('error');
  });

  it('shows terminal info tooltip', async () => {
    const terminals = [
      { 
        ...mockTerminals[0], 
        shell: '/bin/bash',
        cwd: '/home/user/project',
      }
    ];
    
    const { getByText } = renderTerminalPanel({ 
      terminals 
    });
    
    // The tooltip is shown via the title attribute
    const terminalTab = getByText('Terminal 1').closest('.terminal-tab');
    expect(terminalTab).toHaveAttribute('title', 'Terminal 1 - /home/user/project');
  });
});