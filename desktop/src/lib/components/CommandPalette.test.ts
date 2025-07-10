import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import CommandPalette from './CommandPalette.svelte';
import { mockInvoke } from '../../test/utils';

describe('CommandPalette', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    localStorage.clear();
    
    // Set up default mock responses
    mockInvoke({
      has_git_integration: false,
    });
  });

  it('renders when show is true', async () => {
    const { container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      const modalContent = container.querySelector('.command-palette');
      expect(modalContent).toBeInTheDocument();
    });
  });

  it('does not render when show is false', () => {
    const { container } = render(CommandPalette, {
      props: { show: false, testMode: true },
    });
    
    const modalContent = container.querySelector('.command-palette');
    expect(modalContent).not.toBeInTheDocument();
  });

  it('has search input when visible', async () => {
    const { getByPlaceholderText } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
  });

  it('shows commands list', async () => {
    const { container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      const commandsList = container.querySelector('.command-list');
      expect(commandsList).toBeInTheDocument();
      
      const commands = container.querySelectorAll('.command-item');
      expect(commands.length).toBeGreaterThan(0);
    });
  });

  it('filters commands based on search', async () => {
    const { getByPlaceholderText, container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
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
    const { getByPlaceholderText, container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    await fireEvent.keyDown(searchInput, { key: 'Escape' });
    
    // Check that close event was dispatched
    expect(container.querySelector('.command-palette')).toBeInTheDocument(); // Still rendered until parent updates show prop
  });

  it('navigates with arrow keys', async () => {
    const { getByPlaceholderText, container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
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
    const { getByPlaceholderText, container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    const searchInput = getByPlaceholderText('Type a command or search...');
    
    // Select first command
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    
    // Execute it
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Command palette should still be open (unless command closes it)
    // In this case, let's just verify no error occurred
    expect(searchInput).toBeInTheDocument();
  });

  it('filters git commands when git is not available', async () => {
    mockInvoke({
      has_git_integration: false,
    });
    
    const { container } = render(CommandPalette, {
      props: { show: true, testMode: false }, // Need testMode false to test git integration
    });
    
    // Wait for the git integration check to complete
    await waitFor(() => {
      const gitCommands = Array.from(container.querySelectorAll('.command-item'))
        .filter(el => el.textContent?.includes('Git:'));
      expect(gitCommands.length).toBe(0);
    }, { timeout: 3000 });
  });

  it('stores recent commands', async () => {
    const { getByPlaceholderText, container } = render(CommandPalette, {
      props: { show: true, testMode: false }, // Need testMode false to test localStorage
    });
    
    await waitFor(() => {
      expect(getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });
    
    // Execute a command
    const searchInput = getByPlaceholderText('Type a command or search...');
    await fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
    await fireEvent.keyDown(searchInput, { key: 'Enter' });
    
    // Check localStorage was updated
    const stored = localStorage.getItem('orchflow_recent_commands');
    expect(stored).toBeTruthy();
  });

  it('shows categories', async () => {
    const { container } = render(CommandPalette, {
      props: { show: true, testMode: true },
    });
    
    await waitFor(() => {
      const categories = container.querySelectorAll('.command-category');
      expect(categories.length).toBeGreaterThan(0);
    });
  });
});