import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CommandBar from './CommandBar.svelte';
import { manager, activeSession, plugins } from '$lib/stores/manager';

// Mock the manager store
vi.mock('$lib/stores/manager', () => {
  const { writable } = require('svelte/store');
  const mockManager = {
    createTerminal: vi.fn(),
    createSession: vi.fn(),
    refreshSessions: vi.fn(),
    refreshPlugins: vi.fn(),
    searchProject: vi.fn(),
    listDirectory: vi.fn(),
    sendInput: vi.fn()
  };
  
  return {
    manager: mockManager,
    activeSession: writable(null),
    plugins: writable([])
  };
});

describe('CommandBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.prompt
    window.prompt = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render input field', () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]');
      expect(input).toBeTruthy();
      expect(input?.getAttribute('placeholder')).toBeTruthy();
    });

    it('should render submit button', () => {
      const { container } = render(CommandBar);
      const button = container.querySelector('button[type="submit"]');
      expect(button).toBeTruthy();
    });

    it('should render command bar container', () => {
      const { container } = render(CommandBar);
      const commandBar = container.querySelector('.command-bar');
      expect(commandBar).toBeTruthy();
    });
  });

  describe('Suggestions', () => {
    it('should show suggestions when typing', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'cre' } });
      
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      });
    });

    it('should filter suggestions based on input', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'git' } });
      
      await waitFor(() => {
        const suggestionItems = container.querySelectorAll('.suggestion-item');
        expect(suggestionItems.length).toBeGreaterThan(0);
        expect(suggestionItems[0]?.textContent).toContain('git');
      });
    });

    it('should navigate suggestions with arrow keys', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      });
      
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      const selectedSuggestion = container.querySelector('.suggestion-item.selected');
      expect(selectedSuggestion).toBeTruthy();
    });

    it('should select suggestion on enter', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      });
      
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(input.value).toContain('create');
    });

    it('should hide suggestions on escape', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      });
      
      await fireEvent.keyDown(input, { key: 'Escape' });
      
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeFalsy();
      });
    });
  });

  describe('Command Execution', () => {
    it('should create terminal when executing "create terminal" command', async () => {
      activeSession.set({ id: 'test-session', name: 'Test' });
      manager.createTerminal.mockResolvedValue('pane-123');
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.createTerminal).toHaveBeenCalledWith('test-session', 'Terminal');
      });
    });

    it('should create session when executing "create session" command', async () => {
      window.prompt = vi.fn().mockReturnValue('My Session');
      manager.createSession.mockResolvedValue({ id: 'new-session' });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create session' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(window.prompt).toHaveBeenCalledWith('Session name:');
        expect(manager.createSession).toHaveBeenCalledWith('My Session');
      });
    });

    it('should refresh sessions when executing "list sessions" command', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'list sessions' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.refreshSessions).toHaveBeenCalled();
      });
    });

    it('should refresh plugins when executing "list plugins" command', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'list plugins' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.refreshPlugins).toHaveBeenCalled();
      });
    });

    it('should search project when executing search command', async () => {
      manager.searchProject.mockResolvedValue({ results: [], stats: {} });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'search TODO' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.searchProject).toHaveBeenCalledWith('TODO');
      });
    });

    it('should list directory when executing "get file tree" command', async () => {
      manager.listDirectory.mockResolvedValue([]);
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'get file tree' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.listDirectory).toHaveBeenCalledWith('/');
      });
    });

    it('should create terminal and run command for unknown commands', async () => {
      activeSession.set({ id: 'test-session', name: 'Test' });
      manager.createTerminal.mockResolvedValue('pane-123');
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'npm test' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.createTerminal).toHaveBeenCalledWith('test-session', 'npm test');
        expect(manager.sendInput).toHaveBeenCalledWith('pane-123', 'npm test\n');
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      activeSession.set({ id: 'test-session', name: 'Test' });
      manager.createTerminal.mockRejectedValue(new Error('Failed to create terminal'));
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to execute command:', 
          expect.any(Error)
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Input Behavior', () => {
    it('should clear input after successful command', async () => {
      activeSession.set({ id: 'test-session', name: 'Test' });
      manager.createTerminal.mockResolvedValue('pane-123');
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('should not submit empty commands', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: '   ' } });
      await fireEvent.submit(form);
      
      expect(manager.createTerminal).not.toHaveBeenCalled();
      expect(manager.createSession).not.toHaveBeenCalled();
    });

    it('should disable submit button while loading', async () => {
      activeSession.set({ id: 'test-session', name: 'Test' });
      
      // Create a delayed promise to control loading state
      let resolvePromise: () => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = () => resolve('pane-123');
      });
      manager.createTerminal.mockReturnValue(delayedPromise);
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      const button = container.querySelector('button[type="submit"]') as HTMLButtonElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      // Button should be disabled while loading
      expect(button.disabled).toBe(true);
      
      // Resolve the promise
      resolvePromise!();
      await waitFor(() => {
        expect(button.disabled).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle no active session for terminal commands', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      activeSession.set(null);
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No active session');
        expect(manager.createTerminal).not.toHaveBeenCalled();
      });
      
      consoleSpy.mockRestore();
    });

    it('should use default session name when prompt is cancelled', async () => {
      window.prompt = vi.fn().mockReturnValue(null);
      manager.createSession.mockResolvedValue({ id: 'new-session' });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create session' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.createSession).toHaveBeenCalledWith('New Session');
      });
    });

    it('should handle plugin command format', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'git.status' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Plugin commands not yet implemented in manager');
      });
      
      consoleSpy.mockRestore();
    });
  });
});