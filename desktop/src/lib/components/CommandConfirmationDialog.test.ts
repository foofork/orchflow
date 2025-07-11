// NOTE: This test file has complex mocking requirements due to Modal and Icon component dependencies.
// For better maintainability, use:
// - CommandConfirmationDialog.unit.test.ts for pure component logic testing
// - CommandConfirmationDialog.integration.test.ts for full component behavior testing
//
// This file is kept for reference but should be considered deprecated in favor of the split approach.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';

// Mock Modal component
vi.mock('./Modal.svelte', () => {
  return {
    default: class MockModal {
      constructor(options: any) {
        const { target, props = {} } = options;
        
        // Create the modal element only if show is true
        if (props.show && target) {
          const modal = document.createElement('div');
          modal.className = 'mock-modal';
          modal.setAttribute('data-testid', 'Modal');
          
          // CommandConfirmationDialog will render its content inside the Modal
          // We need to let the testing library handle the actual slot rendering
          target.appendChild(modal);
          
          // Move any children into the modal (this simulates slot behavior)
          setTimeout(() => {
            const dialogContent = target.querySelector('.confirmation-dialog');
            if (dialogContent && modal) {
              modal.appendChild(dialogContent);
            }
          }, 0);
        }
        
        this.$$ = {
          fragment: null,
          ctx: [],
          props: {},
          update: vi.fn(),
          dirty: [],
          after_update: [],
          before_update: [],
          context: new Map(),
          callbacks: {},
          skip_bound: false,
          root: target,
          on_mount: [],
          on_destroy: []
        };
        
        this.$set = vi.fn((newProps: any) => {
          Object.assign(props, newProps);
          if (newProps.show === false && target) {
            const modal = target.querySelector('.mock-modal');
            if (modal) modal.remove();
          }
        });
        
        this.$on = vi.fn();
        this.$destroy = vi.fn();
      }
    }
  };
});

// Mock Icon component
vi.mock('./Icon.svelte', () => {
  return {
    default: class MockIcon {
      constructor(options: any) {
        const { target, props = {} } = options;
        
        if (target) {
          const icon = document.createElement('span');
          icon.className = 'mock-icon';
          icon.setAttribute('data-icon', props.name || '');
          icon.textContent = props.name || '';
          target.appendChild(icon);
        }
        
        this.$$ = {
          fragment: null,
          ctx: [],
          props: {},
          update: vi.fn(),
          dirty: [],
          after_update: [],
          before_update: [],
          context: new Map(),
          callbacks: {},
          skip_bound: false,
          root: target,
          on_mount: [],
          on_destroy: []
        };
        
        this.$set = vi.fn();
        this.$on = vi.fn();
        this.$destroy = vi.fn();
      }
    }
  };
});

describe('CommandConfirmationDialog', () => {
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
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders dialog when open', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      // Wait for the component to render and move content
      await waitFor(() => {
        expect(container.querySelector('.confirmation-dialog')).toBeTruthy();
      });
    });

    it('displays risk level banner with correct styling', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const banner = container.querySelector('.risk-banner');
        expect(banner).toBeTruthy();
        expect(banner?.classList.contains('bg-orange-100')).toBe(true);
        expect(banner?.classList.contains('border-orange-300')).toBe(true);
      });
    });

    it('displays terminal information', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const terminalInfo = container.querySelector('.terminal-info');
        expect(terminalInfo?.textContent).toContain('Terminal: Terminal 1');
      });
    });

    it('displays command in code block', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const commandCode = container.querySelector('.command-display code');
        expect(commandCode?.textContent).toBe('rm -rf /');
      });
    });

    it('shows risk factors when available', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Deletes files');
        expect(container.textContent).toContain('Cannot be undone');
      });
    });

    it('shows matched pattern when available', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        expect(container.textContent).toContain('Matched pattern: rm -rf');
      });
    });
  });

  describe('Risk Level Styling', () => {
    it('applies correct styling for Low risk', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'ls',
          warning: { ...mockWarning, riskLevel: 'Low' },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const banner = container.querySelector('.risk-banner');
        expect(banner?.classList.contains('bg-blue-100')).toBe(true);
        expect(banner?.classList.contains('border-blue-300')).toBe(true);
      });
    });

    it('applies correct styling for Medium risk', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const banner = container.querySelector('.risk-banner');
        expect(banner?.classList.contains('bg-yellow-100')).toBe(true);
        expect(banner?.classList.contains('border-yellow-300')).toBe(true);
      });
    });

    it('applies correct styling for Critical risk', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'sudo rm -rf /',
          warning: { ...mockWarning, riskLevel: 'Critical' },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const banner = container.querySelector('.risk-banner');
        expect(banner?.classList.contains('bg-red-100')).toBe(true);
        expect(banner?.classList.contains('border-red-300')).toBe(true);
      });
    });
  });

  describe('User Interactions', () => {
    it('toggles risk factors details', async () => {
      const { container, getByText } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const detailsToggle = container.querySelector('.toggle-details span');
        expect(detailsToggle?.textContent).toContain('Risk Analysis');
      });
      
      const toggleButton = container.querySelector('.toggle-details') as HTMLElement;
      await fireEvent.click(toggleButton);

      await waitFor(() => {
        const factorsList = container.querySelector('.factors-list');
        expect(factorsList).toBeTruthy();
      });
    });

    it('copies command to clipboard', async () => {
      const mockWriteText = vi.fn();
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText
        }
      });

      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const copyButton = container.querySelector('.copy-button') as HTMLElement;
        expect(copyButton).toBeTruthy();
      });

      const copyButton = container.querySelector('.copy-button') as HTMLElement;
      await fireEvent.click(copyButton);

      expect(mockWriteText).toHaveBeenCalledWith('rm -rf /');
    });

    it('toggles remember choice checkbox', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox).toBeTruthy();
      });

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      await fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Action Buttons', () => {
    it('dispatches confirm event with correct data', async () => {
      const mockConfirm = vi.fn();
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('confirm', mockConfirm);

      await waitFor(() => {
        const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
        expect(checkbox).toBeTruthy();
      });

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await fireEvent.click(checkbox);

      const confirmButton = container.querySelector('.btn-danger') as HTMLElement;
      await fireEvent.click(confirmButton);

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'rm -rf /',
          terminalId: 'term-1',
          rememberChoice: true
        }
      }));
    });

    it('dispatches cancel event', async () => {
      const mockCancel = vi.fn();
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('cancel', mockCancel);

      await waitFor(() => {
        const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
        expect(cancelButton).toBeTruthy();
      });

      const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
      await fireEvent.click(cancelButton);

      expect(mockCancel).toHaveBeenCalled();
    });

    it('shows bypass button for Low and Medium risk', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const bypassButton = container.querySelector('[title*="bypass"]');
        expect(bypassButton).toBeTruthy();
      });
    });

    it('hides bypass button for High and Critical risk', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        const content = container.querySelector('.confirmation-dialog');
        expect(content).toBeTruthy();
      });

      const bypassButton = container.querySelector('[title*="bypass"]');
      expect(bypassButton).toBeNull();
    });

    it('dispatches bypass event when bypass button clicked', async () => {
      const mockBypass = vi.fn();
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('bypass', mockBypass);

      await waitFor(() => {
        const bypassButton = container.querySelector('[title*="bypass"]') as HTMLElement;
        expect(bypassButton).toBeTruthy();
      });

      const bypassButton = container.querySelector('[title*="bypass"]') as HTMLElement;
      await fireEvent.click(bypassButton);

      expect(mockBypass).toHaveBeenCalled();
    });
  });

  describe('Dialog State', () => {
    it('closes dialog when confirm is clicked', async () => {
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      let openProp = true;
      component.$on('confirm', () => {
        openProp = false;
      });

      await waitFor(() => {
        const confirmButton = container.querySelector('.btn-danger') as HTMLElement;
        expect(confirmButton).toBeTruthy();
      });

      const confirmButton = container.querySelector('.btn-danger') as HTMLElement;
      await fireEvent.click(confirmButton);

      expect(openProp).toBe(false);
    });

    it('closes dialog when cancel is clicked', async () => {
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      let openProp = true;
      component.$on('cancel', () => {
        openProp = false;
      });

      await waitFor(() => {
        const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
        expect(cancelButton).toBeTruthy();
      });

      const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
      await fireEvent.click(cancelButton);

      expect(openProp).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('handles missing risk factors gracefully', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, riskFactors: undefined },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        expect(container.querySelector('.confirmation-dialog')).toBeTruthy();
      });
      
      expect(container.querySelector('.risk-factors')).toBeNull();
    });

    it('handles missing matched pattern gracefully', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, matchedPattern: undefined },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        expect(container.querySelector('.confirmation-dialog')).toBeTruthy();
      });
      
      expect(container.textContent).not.toContain('Matched pattern:');
    });
  });
});