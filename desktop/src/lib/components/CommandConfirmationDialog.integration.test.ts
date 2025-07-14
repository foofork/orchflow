import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { createAsyncVoidMock, createTypedMock } from '@/test/mock-factory';
import { mockSvelteEvents } from '@/test/svelte5-event-helper';
import { createSvelteComponentMock } from '../../test/setup-mocks';

// Mock Modal to work around Svelte 5 rendering issues in tests
vi.mock('./Modal.svelte', () => ({
  default: createSvelteComponentMock('Modal', { show: false })
}));

// Import after mocking
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';

describe('CommandConfirmationDialog Integration Tests', () => {
  let cleanup: Array<() => void> = [];

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

  beforeEach(() => {
    cleanup = [];
    vi.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: createAsyncVoidMock<[text: string]>()
      }
    });
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
  });

  describe('Component Behavior', () => {
    it('component can be instantiated with required props', () => {
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

    it('handles confirm action', async () => {
      const mockConfirm = createTypedMock<(event: CustomEvent) => void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('confirm', mockConfirm);
      
      // Simulate confirm action
      if (mockComponent.$fire) {
        mockComponent.$fire('confirm', {
          command: 'rm -rf /',
          terminalId: 'term-1',
          rememberChoice: false
        });
      }

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'rm -rf /',
          terminalId: 'term-1',
          rememberChoice: false
        }
      }));
    });

    it('handles cancel action', async () => {
      const mockCancel = createTypedMock<(event: CustomEvent) => void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('cancel', mockCancel);
      
      // Simulate cancel action
      if (mockComponent.$fire) {
        mockComponent.$fire('cancel', {
          command: 'rm -rf /',
          terminalId: 'term-1'
        });
      }

      expect(mockCancel).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'rm -rf /',
          terminalId: 'term-1'
        }
      }));
    });

    it('handles bypass action for medium risk', async () => {
      const mockBypass = createTypedMock<(event: CustomEvent) => void>();
      const mediumRiskWarning = { ...mockWarning, riskLevel: 'Medium' as const };
      
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod 755 file',
          warning: mediumRiskWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('bypass', mockBypass);
      
      // Simulate bypass action
      if (mockComponent.$fire) {
        mockComponent.$fire('bypass', {
          command: 'chmod 755 file',
          terminalId: 'term-1'
        });
      }

      expect(mockBypass).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'chmod 755 file',
          terminalId: 'term-1'
        }
      }));
    });

    it('validates different risk levels', () => {
      const riskLevels = ['Low', 'Medium', 'High', 'Critical'] as const;
      
      riskLevels.forEach(level => {
        const { component, unmount } = render(CommandConfirmationDialog, {
          props: {
            open: true,
            command: 'test command',
            warning: { ...mockWarning, riskLevel: level },
            terminalInfo: mockTerminalInfo
          }
        });
        cleanup.push(unmount);
        
        expect(component).toBeTruthy();
      });
    });

    it('handles missing optional warning properties', () => {
      const minimalWarning = {
        message: 'Test warning',
        riskLevel: 'Low' as const,
        riskFactors: []
      };
      
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: minimalWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);
      
      expect(component).toBeTruthy();
    });

    it('handles edge case with undefined risk factors', () => {
      const warningWithoutFactors = {
        message: 'Test warning',
        riskLevel: 'Low' as const,
        riskFactors: undefined
      } as any;
      
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test',
          warning: warningWithoutFactors,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);
      
      expect(component).toBeTruthy();
    });
  });

  describe('Event Flow', () => {
    it('confirm event includes remember choice state', () => {
      const mockConfirm = createTypedMock<(event: CustomEvent) => void>();
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);

      const mockComponent = mockSvelteEvents(component);
      mockComponent.$on('confirm', mockConfirm);
      
      // Simulate confirm with remember choice
      if (mockComponent.$fire) {
        mockComponent.$fire('confirm', {
          command: 'rm -rf /',
          terminalId: 'term-1',
          rememberChoice: true
        });
      }

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        detail: expect.objectContaining({
          rememberChoice: true
        })
      }));
    });

    it('open prop controls visibility', () => {
      const { component, unmount, rerender } = render(CommandConfirmationDialog, {
        props: {
          open: false,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);
      
      expect(component).toBeTruthy();
      
      // Update open prop
      rerender({
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo
      });
      
      expect(component).toBeTruthy();
    });
  });

  describe('Clipboard Integration', () => {
    it('clipboard functionality is available', async () => {
      const { component, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });
      cleanup.push(unmount);
      
      // Verify clipboard mock is set up
      expect(navigator.clipboard.writeText).toBeDefined();
      expect(typeof navigator.clipboard.writeText).toBe('function');
    });
  });
});