import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { createSvelteComponentMock } from '../../test/setup-mocks';
import { createTypedMock } from '@/test/mock-factory';
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';

// Mock child components with proper Svelte component interface
vi.mock('./Modal.svelte', () => ({
  default: createSvelteComponentMock('Modal', { show: false })
}));

vi.mock('./Icon.svelte', () => ({
  default: createSvelteComponentMock('Icon', { name: 'icon' })
}));

describe('CommandConfirmationDialog Unit Tests', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
  });
  const mockWarning = {
    message: 'This command may be dangerous',
    riskLevel: 'High' as const,
    riskFactors: ['Deletes files', 'Cannot be undone'],
    matchedPattern: 'rm -rf'
  };

  const mockTerminalInfo = {
    id: 'term-1',
    name: 'Terminal 1'
  };

  describe('Component Initialization', () => {
    it('renders without errors with required props', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(component).toBeTruthy();
    });

    it('renders in closed state', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: false,
          command: 'test',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(component).toBeTruthy();
    });
  });

  describe('Event Handler Registration', () => {
    it('allows registering confirm event handler', () => {
      const mockConfirm = createTypedMock<[CustomEvent], void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(() => component.$on('confirm', mockConfirm)).not.toThrow();
    });

    it('allows registering cancel event handler', () => {
      const mockCancel = createTypedMock<[CustomEvent], void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(() => component.$on('cancel', mockCancel)).not.toThrow();
    });

    it('allows registering bypass event handler', () => {
      const mockBypass = createTypedMock<[CustomEvent], void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod 755 file',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(() => component.$on('bypass', mockBypass)).not.toThrow();
    });
  });

  describe('Prop Variations', () => {
    it('handles all risk levels', () => {
      const riskLevels = ['Low', 'Medium', 'High', 'Critical'] as const;
      
      riskLevels.forEach(level => {
        const { component, unmount } = render(CommandConfirmationDialog, {
          props: {
            open: true,
            command: 'test',
            warning: { ...mockWarning, riskLevel: level },
            terminalInfo: mockTerminalInfo
          }
        });
        cleanup.push(unmount);
        
        expect(component).toBeTruthy();
      });
    });

    it('handles missing optional warning properties', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: {
            message: 'Test warning',
            riskLevel: 'Low',
            riskFactors: undefined
          } as any,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(component).toBeTruthy();
    });

    it('handles empty risk factors array', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: {
            ...mockWarning,
            riskFactors: []
          },
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(component).toBeTruthy();
    });

    it('handles missing matched pattern', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: {
            message: 'Test warning',
            riskLevel: 'Low',
            riskFactors: [],
            matchedPattern: undefined
          },
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(component).toBeTruthy();
    });
  });

  describe('Prop Updates', () => {
    it('allows updating open state', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: false,
          command: 'test',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(() => component.$set({ open: true })).not.toThrow();
    });

    it('allows updating command', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'initial command',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      expect(() => component.$set({ command: 'updated command' })).not.toThrow();
    });

    it('allows updating warning', () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      const updatedWarning = {
        ...mockWarning,
        riskLevel: 'Critical' as const,
        message: 'Updated warning'
      };

      expect(() => component.$set({ warning: updatedWarning })).not.toThrow();
    });
  });
});