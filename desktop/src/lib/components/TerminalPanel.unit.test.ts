import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import TerminalPanel from './TerminalPanel.svelte';
import type { Terminal } from '$lib/types';
import { createVoidMock } from '@/test/mock-factory';

/**
 * Unit tests for TerminalPanel component
 * Tests component logic without canvas rendering
 */
describe('TerminalPanel - Unit Tests', () => {
  let cleanup: Array<() => void> = [];
  const mockTerminals: Terminal[] = [
    {
      id: 'term-1',
      title: 'Terminal 1',
      cwd: '/home/user',
      isActive: true,
      processName: 'bash',
      processId: 1234,
      isRunning: true,
      shell: '/bin/bash',
    },
    {
      id: 'term-2', 
      title: 'Terminal 2',
      cwd: '/home/user/project',
      isActive: false,
      processName: 'node',
      processId: 5678,
      isRunning: true,
      shell: '/bin/zsh',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('Terminal Management', () => {
    it('displays terminal tabs', () => {
      const { getAllByRole, unmount } = render(TerminalPanel, {
        props: { terminals: mockTerminals, testMode: true },
      });
      cleanup.push(unmount);
      
      const tabs = getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent('Terminal 1');
      expect(tabs[1]).toHaveTextContent('Terminal 2');
    });

    it('creates new terminal when callback is triggered', async () => {
      const onTerminalCreate = createVoidMock<[]>();
      
      const { getByTitle, unmount } = render(TerminalPanel, {
        props: { 
          terminals: mockTerminals,
          onTerminalCreate,
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      const newTerminalButton = getByTitle(/New terminal/i);
      await newTerminalButton.click();
      
      expect(onTerminalCreate).toHaveBeenCalledOnce();
    });

    it('closes terminal when close button clicked', async () => {
      const onTerminalClose = createVoidMock<[string]>();
      
      const { getAllByTitle, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          onTerminalClose,
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      const closeButtons = getAllByTitle(/Close terminal/i);
      await closeButtons[0].click();
      
      expect(onTerminalClose).toHaveBeenCalledWith('term-1');
    });
  });

  describe('State Management', () => {
    it('indicates active terminal', () => {
      const { getAllByRole, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      const tabs = getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('shows process information', () => {
      const { getByText, container, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      // Process info is shown in status bar
      const statusBar = container.querySelector('.terminal-status');
      expect(statusBar?.textContent).toContain('bash'); // Shell info
      expect(statusBar?.textContent).toContain('2 terminals'); // Terminal count
    });
  });

  describe('Quick Commands', () => {
    it('displays quick commands when provided', async () => {
      const quickCommands = [
        { label: 'Git Status', command: 'git status' },
        { label: 'Run Tests', command: 'npm test' },
      ];
      
      const { getByText, getByTitle, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          quickCommands,
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      // Click quick commands button to open menu
      const quickCommandsButton = getByTitle(/Quick commands/i);
      await quickCommandsButton.click();
      
      // Check commands are in menu
      expect(getByText(/Git Status/i)).toBeInTheDocument();
      expect(getByText(/Run Tests/i)).toBeInTheDocument();
    });

    it('executes quick command when clicked', async () => {
      const onQuickCommand = createVoidMock<[string]>();
      const quickCommands = [
        { label: 'Git Status', command: 'git status' },
      ];
      
      const { getByText, getByTitle, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          quickCommands,
          onQuickCommand,
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      // Open quick commands menu
      const quickCommandsButton = getByTitle(/Quick commands/i);
      await quickCommandsButton.click();
      
      // Click the command
      await getByText(/Git Status/i).click();
      
      expect(onQuickCommand).toHaveBeenCalledWith('git status');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const { getByRole, getAllByRole, unmount } = render(TerminalPanel, {
        props: { terminals: mockTerminals, testMode: true },
      });
      cleanup.push(unmount);
      
      expect(getByRole('tablist')).toHaveAttribute('aria-label', 'Terminal tabs');
      
      const tabs = getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-controls');
      expect(tabs[0]).toHaveAttribute('id');
    });

    it('supports keyboard navigation', async () => {
      const onTabSwitch = createVoidMock<[string]>();
      
      const { getAllByRole, unmount } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          onTabSwitch,
          testMode: true,
        },
      });
      cleanup.push(unmount);
      
      const tabs = getAllByRole('tab');
      tabs[0].focus();
      
      // Simulate arrow key navigation
      await tabs[0].dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight' })
      );
      
      expect(onTabSwitch).toHaveBeenCalledWith('term-2');
    });
  });
});