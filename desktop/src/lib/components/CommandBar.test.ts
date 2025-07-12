import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CommandBar from './CommandBar.svelte';
import { manager, activeSession, plugins } from '$lib/stores/manager';

// Mock the manager store
vi.mock('$lib/stores/manager', async () => {
  const { writable, readable } = await import('svelte/store');
  const { vi } = await import('vitest');
  
  // Create writable stores for testing
  const mockActiveSessionStore = writable(null);
  const mockSessionsStore = writable([]);
  const mockPanesStore = writable(new Map());
  const mockPluginsStore = writable([]);
  
  const mockManager = {
    createTerminal: vi.fn() as any,
    createSession: vi.fn() as any,
    refreshSessions: vi.fn() as any,
    refreshPlugins: vi.fn() as any,
    searchProject: vi.fn() as any,
    listDirectory: vi.fn() as any,
    sendInput: vi.fn() as any,
    subscribe: vi.fn() as any
  };
  
  return {
    manager: mockManager,
    activeSession: mockActiveSessionStore,
    sessions: mockSessionsStore,
    panes: mockPanesStore,
    plugins: mockPluginsStore
  };
});

describe('CommandBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.prompt
    window.prompt = vi.fn() as any;
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

    it('should render form element', () => {
      const { container } = render(CommandBar);
      const form = container.querySelector('form');
      expect(form).toBeTruthy();
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
      
      // Wait for debounce timer (300ms in component)
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      }, { timeout: 500 });
    });

    it('should filter suggestions based on input', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'git' } });
      
      await waitFor(() => {
        const suggestionItems = container.querySelectorAll('.suggestion');
        expect(suggestionItems.length).toBeGreaterThan(0);
        expect(suggestionItems[0]?.textContent).toContain('git');
      }, { timeout: 500 });
    });

    it('should navigate suggestions with arrow keys', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      }, { timeout: 500 });
      
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      
      const selectedSuggestion = container.querySelector('.suggestion.selected');
      expect(selectedSuggestion).toBeTruthy();
    });

    it('should select suggestion on enter', async () => {
      const { activeSession } = await import('$lib/stores/manager');
      (activeSession as any).set({ id: 'test-session', name: 'Test' });
      vi.mocked(manager.createTerminal).mockResolvedValue({ 
        id: 'pane-123',
        session_id: 'test-session',
        pane_type: 'Terminal',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      }, { timeout: 500 });
      
      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await fireEvent.keyDown(input, { key: 'Enter' });
      
      // The input is cleared after submitting
      await waitFor(() => {
        expect(input.value).toBe('');
        expect(manager.createTerminal).toHaveBeenCalled();
      });
    });

    it('should hide suggestions on escape', async () => {
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      
      await fireEvent.input(input, { target: { value: 'create' } });
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeTruthy();
      }, { timeout: 500 });
      
      await fireEvent.keyDown(input, { key: 'Escape' });
      
      await waitFor(() => {
        const suggestions = container.querySelector('.suggestions');
        expect(suggestions).toBeFalsy();
      });
    });
  });

  describe('Command Execution', () => {
    it('should create terminal when executing "create terminal" command', async () => {
      const { activeSession } = await import('$lib/stores/manager');
      (activeSession as any).set({ id: 'test-session', name: 'Test' });
      vi.mocked(manager.createTerminal).mockResolvedValue({ 
        id: 'pane-123',
        session_id: 'test-session',
        pane_type: 'Terminal',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.createTerminal).toHaveBeenCalledWith('test-session', { name: 'Terminal' });
      });
    });

    it('should create session when executing "create session" command', async () => {
      window.prompt = vi.fn().mockReturnValue('My Session') as any;
      vi.mocked(manager.createSession).mockResolvedValue({ 
        id: 'new-session',
        name: 'My Session',
        panes: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
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
      vi.mocked(manager.searchProject).mockResolvedValue({ results: [], stats: {} });
      
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
      vi.mocked(manager.listDirectory).mockResolvedValue([]);
      
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
      (activeSession as any).set({ 
        id: 'test-session', 
        name: 'Test',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      vi.mocked(manager.createTerminal).mockResolvedValue({ 
        id: 'pane-123',
        session_id: 'test-session',
        pane_type: 'Terminal',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'npm test' } });
      await fireEvent.submit(form);
      
      await waitFor(() => {
        expect(manager.createTerminal).toHaveBeenCalledWith('test-session', { command: 'npm test' });
        expect(manager.sendInput).toHaveBeenCalledWith('pane-123', 'npm test\n');
      });
    });

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (activeSession as any).set({ 
        id: 'test-session', 
        name: 'Test',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      vi.mocked(manager.createTerminal).mockRejectedValue(new Error('Failed to create terminal'));
      
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
      (activeSession as any).set({ 
        id: 'test-session', 
        name: 'Test',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      vi.mocked(manager.createTerminal).mockResolvedValue({ 
        id: 'pane-123',
        session_id: 'test-session',
        pane_type: 'Terminal',
        rows: 24,
        cols: 80,
        x: 0,
        y: 0,
        is_active: true,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
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

    it('should disable input while loading', async () => {
      (activeSession as any).set({ 
        id: 'test-session', 
        name: 'Test',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
      // Create a delayed promise to control loading state
      let resolvePromise: () => void;
      const delayedPromise = new Promise((resolve) => {
        resolvePromise = () => resolve('pane-123');
      });
      vi.mocked(manager.createTerminal).mockReturnValue(delayedPromise as any);
      
      const { container } = render(CommandBar);
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      const form = container.querySelector('form') as HTMLFormElement;
      
      await fireEvent.input(input, { target: { value: 'create terminal' } });
      await fireEvent.submit(form);
      
      // Input should be disabled while loading
      expect(input.disabled).toBe(true);
      
      // Resolve the promise
      resolvePromise!();
      await waitFor(() => {
        expect(input.disabled).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle no active session for terminal commands', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (activeSession as any).set(null);
      
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
      window.prompt = vi.fn().mockReturnValue(null) as any;
      vi.mocked(manager.createSession).mockResolvedValue({ 
        id: 'new-session',
        name: 'New Session',
        panes: [],
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      });
      
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