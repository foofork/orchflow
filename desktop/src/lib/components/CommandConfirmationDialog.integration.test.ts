import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';

describe('CommandConfirmationDialog Integration Tests', () => {
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
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn()
      }
    });
  });

  describe('Full Component Behavior', () => {
    it('renders complete dialog with modal backdrop', async () => {
      const { container, getByText } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();

      // Check modal is rendered
      expect(container.querySelector('.modal-backdrop')).toBeInTheDocument();
      expect(container.querySelector('.modal-content')).toBeInTheDocument();

      // Check dialog content
      expect(getByText('Security Confirmation Required')).toBeInTheDocument();
      expect(getByText('High Risk Command Detected')).toBeInTheDocument();
      expect(getByText(mockWarning.message)).toBeInTheDocument();
    });

    it('displays all risk information correctly', async () => {
      const { container, getByText } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();

      // Check terminal info
      expect(getByText(`Terminal: ${mockTerminalInfo.name}`)).toBeInTheDocument();

      // Check command display
      const commandCode = container.querySelector('.command-display code');
      expect(commandCode).toHaveTextContent('rm -rf /');

      // Check matched pattern
      expect(getByText(/Matched security pattern:/)).toBeInTheDocument();
      expect(container.querySelector('.matched-pattern code')).toHaveTextContent(mockWarning.matchedPattern);
    });

    it('handles risk factor toggle interaction', async () => {
      const { container, getByText } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();

      // Initially collapsed
      expect(container.querySelector('.factors-list')).not.toBeInTheDocument();

      // Click to expand
      const toggleButton = getByText(/Risk Analysis/);
      await fireEvent.click(toggleButton);
      await tick();

      // Check factors are visible
      const factorsList = container.querySelector('.factors-list');
      expect(factorsList).toBeInTheDocument();
      expect(getByText('Deletes files')).toBeInTheDocument();
      expect(getByText('Cannot be undone')).toBeInTheDocument();
    });

    it('handles clipboard copy functionality', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();

      const copyButton = container.querySelector('.copy-button') as HTMLElement;
      await fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('rm -rf /');
    });

    it('handles confirm action with remember choice', async () => {
      const mockConfirm = vi.fn();
      const { container, getByText, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('confirm', mockConfirm);
      await tick();

      // Check remember choice
      const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
      await fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      // Click confirm
      const confirmButton = getByText('Execute Anyway');
      await fireEvent.click(confirmButton);

      expect(mockConfirm).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'rm -rf /',
          terminalId: 'term-1',
          rememberChoice: true
        }
      }));
    });

    it('shows bypass button only for Low and Medium risk', async () => {
      // Test Medium risk - should show bypass
      const { container, rerender } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod 755 file',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();
      expect(container.querySelector('[title*="bypass"]')).toBeInTheDocument();

      // Test High risk - should not show bypass
      await rerender({
        props: {
          open: true,
          command: 'rm -rf /',
          warning: { ...mockWarning, riskLevel: 'High' },
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();
      expect(container.querySelector('[title*="bypass"]')).not.toBeInTheDocument();
    });

    it('applies correct styling for each risk level', async () => {
      const riskLevels = [
        { level: 'Low', bgClass: 'bg-blue-100', borderClass: 'border-blue-300' },
        { level: 'Medium', bgClass: 'bg-yellow-100', borderClass: 'border-yellow-300' },
        { level: 'High', bgClass: 'bg-orange-100', borderClass: 'border-orange-300' },
        { level: 'Critical', bgClass: 'bg-red-100', borderClass: 'border-red-300' }
      ];

      for (const { level, bgClass, borderClass } of riskLevels) {
        const { container } = render(CommandConfirmationDialog, {
          props: {
            open: true,
            command: 'test command',
            warning: { ...mockWarning, riskLevel: level as any },
            terminalInfo: mockTerminalInfo
          }
        });

        await tick();
        
        const banner = container.querySelector('.risk-banner');
        expect(banner).toHaveClass(bgClass);
        expect(banner).toHaveClass(borderClass);
      }
    });

    it('closes dialog on cancel', async () => {
      const mockCancel = vi.fn();
      let isOpen = true;
      
      const { getByText, component, rerender } = render(CommandConfirmationDialog, {
        props: {
          open: isOpen,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('cancel', () => {
        mockCancel();
        isOpen = false;
      });

      await tick();

      const cancelButton = getByText('Cancel');
      await fireEvent.click(cancelButton);

      expect(mockCancel).toHaveBeenCalled();

      // Rerender with updated open state
      await rerender({
        props: {
          open: isOpen,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();
      
      // Dialog should be closed
      expect(document.querySelector('.confirmation-dialog')).not.toBeInTheDocument();
    });

    it('handles bypass action correctly', async () => {
      const mockBypass = vi.fn();
      const { container, component } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'chmod 755 file',
          warning: { ...mockWarning, riskLevel: 'Medium' },
          terminalInfo: mockTerminalInfo
        }
      });

      component.$on('bypass', mockBypass);
      await tick();

      const bypassButton = container.querySelector('[title*="bypass"]') as HTMLElement;
      await fireEvent.click(bypassButton);

      expect(mockBypass).toHaveBeenCalledWith(expect.objectContaining({
        detail: {
          command: 'chmod 755 file',
          terminalId: 'term-1'
        }
      }));
    });

    it('handles edge cases gracefully', async () => {
      // Missing risk factors
      const { container: container1 } = render(CommandConfirmationDialog, {
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

      await tick();
      expect(container1.querySelector('.toggle-details')).not.toBeInTheDocument();

      // Missing matched pattern
      const { container: container2 } = render(CommandConfirmationDialog, {
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

      await tick();
      expect(container2.querySelector('.matched-pattern')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels and keyboard navigation', async () => {
      const { container } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'rm -rf /',
          warning: mockWarning,
          terminalInfo: mockTerminalInfo
        }
      });

      await tick();

      // Check ARIA labels
      const copyButton = container.querySelector('[aria-label="Copy command"]');
      expect(copyButton).toBeInTheDocument();

      // Check focus management
      const modal = container.querySelector('.modal-content');
      expect(modal).toBeInTheDocument();
      
      // Modal should trap focus
      const focusableElements = modal?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      expect(focusableElements?.length).toBeGreaterThan(0);
    });
  });
});