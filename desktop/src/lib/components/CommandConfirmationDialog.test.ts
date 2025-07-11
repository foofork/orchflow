import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';

// Mock Icon component
vi.mock('./Icon.svelte', () => ({
  default: class MockIcon {
    $$: any;
    constructor(options: any) {
      const { target, props = {} } = options;
      
      // Create element
      const span = document.createElement('span');
      span.className = 'mock-icon';
      span.textContent = props.name || 'icon';
      if (target) target.appendChild(span);
      
      // Set up Svelte component interface
      this.$$ = {
        fragment: document.createDocumentFragment(),
        ctx: [],
        props: props,
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: span
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  }
}));

// Mock Modal component  
vi.mock('./Modal.svelte', () => ({
  default: class MockModal {
    $$: any;
    constructor(options: any) {
      const { target, props = {} } = options;
      
      // Create element
      const div = document.createElement('div');
      div.className = 'mock-modal';
      if (props.show || props.open) {
        const content = document.createElement('div');
        content.className = 'modal-content';
        div.appendChild(content);
      }
      if (target) target.appendChild(div);
      
      // Set up Svelte component interface
      this.$$ = {
        fragment: document.createDocumentFragment(),
        ctx: [],
        props: props,
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: div
      };
    }
    $destroy() {}
    $on() { return () => {}; }
    $set() {}
  }
}));

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
    it('renders dialog when open', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      expect(container.querySelector('.confirmation-dialog')).toBeTruthy();
    });

    it('displays risk level banner with correct styling', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const banner = container.querySelector('.risk-banner');
      expect(banner).toBeTruthy();
      expect(banner?.classList.contains('bg-orange-100')).toBe(true);
      expect(banner?.classList.contains('border-orange-300')).toBe(true);
    });

    it('displays terminal information', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const terminalInfo = container.querySelector('.terminal-info');
      expect(terminalInfo?.textContent).toContain('Terminal: Terminal 1');
    });

    it('displays command in code block', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const commandCode = container.querySelector('.command-display code');
      expect(commandCode?.textContent).toBe('rm -rf /');
    });

    it('shows risk factors when available', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const toggleButton = container.querySelector('.toggle-details');
      expect(toggleButton?.textContent).toContain('Risk Analysis (2 factors)');
    });

    it('shows matched pattern when available', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const matchedPattern = container.querySelector('.matched-pattern');
      expect(matchedPattern?.textContent).toContain('rm -rf');
    });
  });

  describe('Risk Level Styling', () => {
    it('applies correct styling for Low risk', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'echo test',
          warning: { ...mockWarning, riskLevel: 'Low' },
          terminalInfo: mockTerminalInfo
        }
      });

      const banner = container.querySelector('.risk-banner');
      expect(banner?.classList.contains('bg-blue-100')).toBe(true);
      expect(banner?.classList.contains('border-blue-300')).toBe(true);
    });

    it('applies correct styling for Medium risk', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'sudo command',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      const banner = container.querySelector('.risk-banner');
      expect(banner?.classList.contains('bg-yellow-100')).toBe(true);
      expect(banner?.classList.contains('border-yellow-300')).toBe(true);
    });

    it('applies correct styling for Critical risk', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, riskLevel: 'Critical' },
          terminalInfo: mockTerminalInfo
        }
      });

      const banner = container.querySelector('.risk-banner');
      expect(banner?.classList.contains('bg-red-100')).toBe(true);
      expect(banner?.classList.contains('border-red-300')).toBe(true);
    });
  });

  describe('User Interactions', () => {
    it('toggles risk factors details', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const toggleButton = container.querySelector('.toggle-details') as HTMLElement;
      
      // Initially hidden
      expect(container.querySelector('.factors-list')).toBeFalsy();
      
      // Click to show
      await fireEvent.click(toggleButton);
      await waitFor(() => {
        const factorsList = container.querySelector('.factors-list');
        expect(factorsList).toBeTruthy();
        expect(factorsList?.querySelectorAll('li')).toHaveLength(2);
      });
    });

    it('copies command to clipboard', async () => {
      const mockClipboard = {
        writeText: vi.fn().mockResolvedValue(undefined)
      };
      Object.assign(navigator, { clipboard: mockClipboard });

      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const copyButton = container.querySelector('.copy-button') as HTMLElement;
      await fireEvent.click(copyButton);
      
      expect(mockClipboard.writeText).toHaveBeenCalledWith('rm -rf /');
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

      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
      
      await fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('Action Buttons', () => {
    it('dispatches confirm event with correct data', async () => {
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const confirmHandler = vi.fn();
      component.$on('confirm', confirmHandler);

      // Check remember choice
      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await fireEvent.click(checkbox);

      // Click confirm button
      const confirmButton = container.querySelector('.btn-danger') as HTMLElement;
      await fireEvent.click(confirmButton);

      expect(confirmHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            command: 'rm -rf /',
            terminalId: 'term-1',
            rememberChoice: true
          }
        })
      );
    });

    it('dispatches cancel event', async () => {
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      const cancelHandler = vi.fn();
      component.$on('cancel', cancelHandler);

      const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
      await fireEvent.click(cancelButton);

      expect(cancelHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            command: 'rm -rf /',
            terminalId: 'term-1'
          }
        })
      );
    });

    it('shows bypass button for Low and Medium risk', () => {
      const { container: lowRiskContainer } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'echo test',
          warning: { ...mockWarning, riskLevel: 'Low' },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(lowRiskContainer.querySelector('.btn-ghost')).toBeTruthy();

      const { container: mediumRiskContainer } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'sudo command',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(mediumRiskContainer.querySelector('.btn-ghost')).toBeTruthy();
    });

    it('hides bypass button for High and Critical risk', () => {
      const { container: highRiskContainer } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, riskLevel: 'High' },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(highRiskContainer.querySelector('.btn-ghost')).toBeFalsy();

      const { container: criticalRiskContainer } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, riskLevel: 'Critical' },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(criticalRiskContainer.querySelector('.btn-ghost')).toBeFalsy();
    });

    it('dispatches bypass event when bypass button clicked', async () => {
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'echo test',
          warning: { ...mockWarning, riskLevel: 'Low' },
          terminalInfo: mockTerminalInfo
        }
      });

      const bypassHandler = vi.fn();
      component.$on('bypass', bypassHandler);

      const bypassButton = container.querySelector('.btn-ghost') as HTMLElement;
      await fireEvent.click(bypassButton);

      expect(bypassHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: {
            command: 'echo test',
            terminalId: 'term-1'
          }
        })
      );
    });
  });

  describe('Dialog State', () => {
    it('closes dialog when confirm is clicked', async () => {
      let open = true;
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('confirm', () => {
        open = false;
      });

      const confirmButton = container.querySelector('.btn-danger') as HTMLElement;
      await fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(open).toBe(false);
      });
    });

    it('closes dialog when cancel is clicked', async () => {
      let open = true;
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('cancel', () => {
        open = false;
      });

      const cancelButton = container.querySelector('.btn-secondary') as HTMLElement;
      await fireEvent.click(cancelButton);

      await waitFor(() => {
        expect(open).toBe(false);
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles missing risk factors gracefully', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test command',
          warning: {
            message: 'Test warning',
            riskLevel: 'Medium',
            riskFactors: []
          },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(container.querySelector('.risk-factors')).toBeFalsy();
    });

    it('handles missing matched pattern gracefully', () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test command',
          warning: {
            message: 'Test warning',
            riskLevel: 'Medium',
            riskFactors: ['Test factor']
          },
          terminalInfo: mockTerminalInfo
        }
      });

      expect(container.querySelector('.matched-pattern')).toBeFalsy();
    });
  });
});