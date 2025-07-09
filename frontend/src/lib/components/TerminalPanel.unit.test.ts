import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import TerminalPanel from './TerminalPanel.svelte';
import type { Terminal } from '$lib/types';

/**
 * Unit tests for TerminalPanel component
 * Tests component logic without canvas rendering
 */
describe('TerminalPanel - Unit Tests', () => {
  const mockTerminals: Terminal[] = [
    {
      id: 'term-1',
      title: 'Terminal 1',
      cwd: '/home/user',
      isActive: true,
      processName: 'bash',
      processId: 1234,
    },
    {
      id: 'term-2', 
      title: 'Terminal 2',
      cwd: '/home/user/project',
      isActive: false,
      processName: 'node',
      processId: 5678,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Terminal Management', () => {
    it('displays terminal tabs', () => {
      const { getAllByRole } = render(TerminalPanel, {
        props: { terminals: mockTerminals },
      });
      
      const tabs = getAllByRole('tab');
      expect(tabs).toHaveLength(2);
      expect(tabs[0]).toHaveTextContent('Terminal 1');
      expect(tabs[1]).toHaveTextContent('Terminal 2');
    });

    it('creates new terminal when callback is triggered', async () => {
      const onTerminalCreate = vi.fn();
      
      const { getByTitle } = render(TerminalPanel, {
        props: { 
          terminals: mockTerminals,
          onTerminalCreate,
        },
      });
      
      const newTerminalButton = getByTitle(/New terminal/i);
      await newTerminalButton.click();
      
      expect(onTerminalCreate).toHaveBeenCalledOnce();
    });

    it('closes terminal when close button clicked', async () => {
      const onTerminalClose = vi.fn();
      
      const { getAllByTitle } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          onTerminalClose,
        },
      });
      
      const closeButtons = getAllByTitle(/Close terminal/i);
      await closeButtons[0].click();
      
      expect(onTerminalClose).toHaveBeenCalledWith('term-1');
    });
  });

  describe('State Management', () => {
    it('indicates active terminal', () => {
      const { getAllByRole } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
        },
      });
      
      const tabs = getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
      expect(tabs[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('shows process information', () => {
      const { getByText } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
        },
      });
      
      expect(getByText('bash')).toBeInTheDocument();
      expect(getByText('/home/user')).toBeInTheDocument();
    });
  });

  describe('Quick Commands', () => {
    it('displays quick commands when provided', () => {
      const quickCommands = [
        { id: 'git-status', label: 'Git Status', command: 'git status' },
        { id: 'npm-test', label: 'Run Tests', command: 'npm test' },
      ];
      
      const { getByText } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          quickCommands,
        },
      });
      
      expect(getByText('Git Status')).toBeInTheDocument();
      expect(getByText('Run Tests')).toBeInTheDocument();
    });

    it('executes quick command when clicked', async () => {
      const onQuickCommand = vi.fn();
      const quickCommands = [
        { id: 'git-status', label: 'Git Status', command: 'git status' },
      ];
      
      const { getByText } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          quickCommands,
          onQuickCommand,
        },
      });
      
      await getByText('Git Status').click();
      
      expect(onQuickCommand).toHaveBeenCalledWith('term-1', 'git status');
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels', () => {
      const { getByRole, getAllByRole } = render(TerminalPanel, {
        props: { terminals: mockTerminals },
      });
      
      expect(getByRole('tablist')).toHaveAttribute('aria-label', 'Terminal tabs');
      
      const tabs = getAllByRole('tab');
      expect(tabs[0]).toHaveAttribute('aria-controls');
      expect(tabs[0]).toHaveAttribute('id');
    });

    it('supports keyboard navigation', async () => {
      const onTabSwitch = vi.fn();
      
      const { getAllByRole } = render(TerminalPanel, {
        props: {
          terminals: mockTerminals,
          activeTerminalId: 'term-1',
          onTabSwitch,
        },
      });
      
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