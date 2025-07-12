import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor, cleanup } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import CommandPalette from './CommandPalette.svelte';
import { mockInvoke } from '../../test/utils';
import { createAsyncMock, createTypedMock, createSyncMock } from '@/test/mock-factory';
import { buildCommandPaletteItem } from '../../test/test-data-builders';

describe('CommandPalette', () => {
  let user: ReturnType<typeof userEvent.setup>;
  let cleanup: Array<() => void> = [];
  
  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    
    // Set up default mock responses
    mockInvoke({
      has_git_integration: false,
    });
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders when show is true', async () => {
    const { container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const modalContent = container.querySelector('.command-palette');
      expect(modalContent).toBeInTheDocument();
    });
  });

  it('does not render when show is false', () => {
    const { container, unmount } = render(CommandPalette, {
      props: { show: false, testMode: true },
    });
    cleanup.push(unmount);
    
    const modalContent = container.querySelector('.command-palette');
    expect(modalContent).not.toBeInTheDocument();
  });

  it('has search input when visible', async () => {
    const { getByPlaceholderText, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
  });

  it('shows commands list', async () => {
    const { container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const commandsList = container.querySelector('.command-list');
      expect(commandsList).toBeInTheDocument();
      
      const commands = container.querySelectorAll('.command-item');
      expect(commands.length).toBeGreaterThan(0);
    });
  });

  it('filters commands based on search', async () => {
    const { getByPlaceholderText, container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText('Type a command or search...');
      expect(searchInput).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    
    // Get initial command count
    const initialCommands = container.querySelectorAll('.command-item');
    const initialCount = initialCommands.length;
    
    // Type in search
    await user.type(searchInput, 'new file');
    
    await waitFor(() => {
      const filteredCommands = container.querySelectorAll('.command-item');
      // Should find at least "New File" command
      expect(filteredCommands.length).toBeGreaterThan(0);
      // Should be less than all commands
      expect(filteredCommands.length).toBeLessThanOrEqual(initialCount);
      
      // Check that "New File" is in the results
      const newFileCommand = Array.from(filteredCommands).find(cmd => 
        cmd.textContent?.includes('New File')
      );
      expect(newFileCommand).toBeTruthy();
    });
  });

  it('closes when Escape is pressed', async () => {
    const mockClose = createAsyncMock<[], void>();
    const { getByPlaceholderText, component, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    component.$on('close', mockClose);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    await fireEvent.keyDown(searchInput, { key: 'Escape' });
    
    // Check that close event was dispatched
    expect(mockClose).toHaveBeenCalled();
  });

  it('navigates with arrow keys', async () => {
    const { getByPlaceholderText, container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    
    // Press down arrow
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    await waitFor(() => {
      const selectedCommand = container.querySelector('.command-item.selected');
      expect(selectedCommand).toBeInTheDocument();
    });
  });

  it('executes command on Enter', async () => {
    const mockAction = createAsyncMock<[], void>();
    const mockClose = createAsyncMock<[], void>();
    
    // Create a custom command with our mock action
    const testCommand = buildCommandPaletteItem({
      id: 'test-command',
      label: 'Test Command',
      action: mockAction,
    });
    
    const { getByPlaceholderText, component, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    component.$on('close', mockClose);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    
    // Select first command
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // Execute it
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Wait for any async operations
    await waitFor(() => {
      // Command palette should close after execution
      expect(mockClose).toHaveBeenCalled();
    });
  });

  it('filters git commands when git is not available', async () => {
    mockInvoke({
      has_git_integration: false,
    });
    
    const { container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: false }, // Need testMode false to test git integration
    });
    cleanup.push(unmount);
    
    // Wait for the git integration check to complete
    await waitFor(() => {
      const gitCommands = Array.from(container.querySelectorAll('.command-item'))
        .filter(el => el.textContent?.includes('Git:'));
      expect(gitCommands.length).toBe(0);
    }, { timeout: 3000 });
  });

  it('stores recent commands', async () => {
    const { getByPlaceholderText, unmount } = render(CommandPalette, {
      props: { show: true, testMode: false }, // Need testMode false to test localStorage
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    // Execute a command
    const searchInput = getByPlaceholderText('Type a command or search...');
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Check localStorage was updated
    await waitFor(() => {
      const stored = localStorage.getItem('orchflow_recent_commands');
      expect(stored).toBeTruthy();
    });
  });

  it('shows categories', async () => {
    const { container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const categories = container.querySelectorAll('.command-category');
      expect(categories.length).toBeGreaterThan(0);
    });
  });

  it('handles git integration when available', async () => {
    mockInvoke({
      has_git_integration: true,
    });
    
    const { container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: false },
    });
    cleanup.push(unmount);
    
    // Wait for git integration check and commands to load
    await waitFor(() => {
      const gitCommands = Array.from(container.querySelectorAll('.command-item'))
        .filter(el => el.textContent?.includes('Git:'));
      expect(gitCommands.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it('handles search with no results', async () => {
    const { getByPlaceholderText, container, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    
    // Type in search that won't match anything
    await user.type(searchInput, 'xyznonexistentcommand');
    
    await waitFor(() => {
      const commands = container.querySelectorAll('.command-item');
      expect(commands.length).toBe(0);
    });
  });

  it('maintains focus on search input', async () => {
    const { getByPlaceholderText, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      const searchInput = getByPlaceholderText('Type a command or search...');
      expect(searchInput).toBeInTheDocument();
      expect(document.activeElement).toBe(searchInput);
    });
  });

  it('clears search on close and reopen', async () => {
    const { getByPlaceholderText, rerender, unmount } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    cleanup.push(unmount);
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    await user.type(searchInput, 'test search');
    
    // Close and reopen
    await rerender({ show: false, testMode: true });
    await rerender({ show: true, testMode: true });
    
    await waitFor(() => {
      const newSearchInput = getByPlaceholderText('Type a command or search...');
      expect(newSearchInput).toHaveValue('');
    });
  });
});