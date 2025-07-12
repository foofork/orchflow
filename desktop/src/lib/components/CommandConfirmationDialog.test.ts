// NOTE: This test file has complex mocking requirements due to Modal and Icon component dependencies.
// For better maintainability, use:
// - CommandConfirmationDialog.unit.test.ts for pure component logic testing
// - CommandConfirmationDialog.integration.test.ts for full component behavior testing
//
// This file is kept for reference but should be considered deprecated in favor of the split approach.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import CommandConfirmationDialog from './CommandConfirmationDialog.svelte';
import { MockSvelteComponent } from '../../test/utils/svelte-component-mock-types';

// Mock Modal component
vi.mock('./Modal.svelte', () => {
  return {
    default: class MockModal extends MockSvelteComponent {
      constructor(options: any) {
        super(options);
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
        
        // Override $set to handle modal visibility
        this.$set = vi.fn((newProps: any) => {
          Object.assign(props, newProps);
          if (newProps.show === false && target) {
            const modal = target.querySelector('.mock-modal');
            if (modal) modal.remove();
          }
        });
      }
    }
  };
});

// Mock Icon component
vi.mock('./Icon.svelte', () => {
  return {
    default: class MockIcon extends MockSvelteComponent {
      constructor(options: any) {
        super(options);
        const { target, props = {} } = options;
        
        if (target) {
          const icon = document.createElement('span');
          icon.className = 'mock-icon';
          icon.setAttribute('data-icon', props.name || '');
          icon.textContent = props.name || '';
          target.appendChild(icon);
        }
        
        // Override $set to handle icon updates
        this.$set = vi.fn((newProps: any) => {
          Object.assign(props, newProps);
          if (target) {
            const icon = target.querySelector('.mock-icon');
            if (icon && newProps.name) {
              icon.setAttribute('data-icon', newProps.name);
              icon.textContent = newProps.name;
            }
          }
        });
      }
    }
  };
});

// Mock slide transition
vi.mock('svelte/transition', () => ({
  slide: () => ({
    delay: 0,
    duration: 0,
    css: () => ''
  })
}));

describe('CommandConfirmationDialog', () => {
  let mockOnConfirm: ReturnType<typeof vi.fn>;
  let mockOnCancel: ReturnType<typeof vi.fn>;
  let mockOnBypass: ReturnType<typeof vi.fn>;
  
  const mockWarning = {
    riskLevel: 'High' as const,
    message: 'This command could be dangerous',
    riskFactors: ['Contains rm -rf', 'Targets root directory'],
    matchedPattern: 'rm -rf /*'
  };
  
  const mockTerminalInfo = {
    id: 'term-1',
    name: 'Terminal 1'
  };

  beforeEach(() => {
    mockOnConfirm = vi.fn();
    mockOnCancel = vi.fn();
    mockOnBypass = vi.fn();
  });

  it('renders warning dialog when open', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo,
        onConfirm: mockOnConfirm,
        onCancel: mockOnCancel,
        onBypass: mockOnBypass
      }
    });

    // Wait for async rendering
    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    // Check key elements
    expect(container.textContent).toContain('High Risk Command Detected');
    expect(container.textContent).toContain('This command could be dangerous');
    expect(container.textContent).toContain('rm -rf /');
    expect(container.textContent).toContain('Terminal 1');
  });

  it('shows risk factors when toggled', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    // Initially collapsed
    expect(container.querySelector('.factors-list')).not.toBeInTheDocument();

    // Toggle to show factors
    const toggleButton = container.querySelector('.toggle-details');
    expect(toggleButton).toBeInTheDocument();
    if (toggleButton) {
      await fireEvent.click(toggleButton);
    }

    // Now visible
    await waitFor(() => {
      expect(container.querySelector('.factors-list')).toBeInTheDocument();
      expect(container.textContent).toContain('Contains rm -rf');
      expect(container.textContent).toContain('Targets root directory');
    });
  });

  it('calls onConfirm when proceed clicked', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo,
        onConfirm: mockOnConfirm
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const proceedButton = container.querySelector('.btn-danger');
    expect(proceedButton).toBeInTheDocument();
    expect(proceedButton?.textContent).toContain('Proceed with High Risk');

    if (proceedButton) {
      await fireEvent.click(proceedButton);
    }

    expect(mockOnConfirm).toHaveBeenCalledWith(false); // rememberChoice defaults to false
  });

  it('calls onCancel when cancel clicked', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo,
        onCancel: mockOnCancel
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const cancelButton = container.querySelector('.btn-secondary');
    expect(cancelButton).toBeInTheDocument();
    expect(cancelButton?.textContent).toContain('Cancel');

    if (cancelButton) {
      await fireEvent.click(cancelButton);
    }

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('shows bypass option for low/medium risk', async () => {
    const lowRiskWarning = { ...mockWarning, riskLevel: 'Low' as const };
    
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'curl http://example.com',
        warning: lowRiskWarning,
        terminalInfo: mockTerminalInfo,
        onBypass: mockOnBypass
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const bypassButton = container.querySelector('[title*="Execute without security checks"]');
    expect(bypassButton).toBeInTheDocument();
    expect(bypassButton?.textContent).toContain('Bypass Security');

    if (bypassButton) {
      await fireEvent.click(bypassButton);
    }

    expect(mockOnBypass).toHaveBeenCalled();
  });

  it('does not show bypass option for high risk', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const bypassButton = container.querySelector('[title*="Execute without security checks"]');
    expect(bypassButton).not.toBeInTheDocument();
  });

  it('handles remember choice checkbox', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo,
        onConfirm: mockOnConfirm
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(checkbox).toBeInTheDocument();
    expect(checkbox?.checked).toBe(false);

    // Check the checkbox
    if (checkbox) {
      await fireEvent.click(checkbox);
    }

    // Confirm with remember checked
    const proceedButton = container.querySelector('.btn-danger');
    if (proceedButton) {
      await fireEvent.click(proceedButton);
    }

    expect(mockOnConfirm).toHaveBeenCalledWith(true);
  });

  it('copies command to clipboard', async () => {
    // Mock clipboard
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
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
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    const copyButton = container.querySelector('.copy-button');
    expect(copyButton).toBeInTheDocument();

    if (copyButton) {
      await fireEvent.click(copyButton);
    }

    expect(mockWriteText).toHaveBeenCalledWith('rm -rf /');
  });

  it('handles keyboard navigation', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: mockWarning,
        terminalInfo: mockTerminalInfo,
        onCancel: mockOnCancel
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    // Simulate ESC key
    await fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('uses correct risk styling', async () => {
    // Test different risk levels
    const riskLevels = [
      { level: 'Low' as const, bgClass: 'bg-blue-50', textClass: 'text-blue-700' },
      { level: 'Medium' as const, bgClass: 'bg-yellow-50', textClass: 'text-yellow-700' },
      { level: 'High' as const, bgClass: 'bg-red-50', textClass: 'text-red-700' },
      { level: 'Critical' as const, bgClass: 'bg-red-100', textClass: 'text-red-800' }
    ];

    for (const { level, bgClass, textClass } of riskLevels) {
      const { container, unmount } = render(CommandConfirmationDialog, {
        props: {
          open: true,
          command: 'test command',
          warning: { ...mockWarning, riskLevel: level },
          terminalInfo: mockTerminalInfo
        }
      });

      await waitFor(() => {
        expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
      });

      const banner = container.querySelector('.risk-banner');
      expect(banner?.className).toContain(bgClass);
      
      const heading = container.querySelector('h3');
      expect(heading?.className).toContain(textClass);
      
      unmount();
    }
  });

  it('displays matched pattern when available', async () => {
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: { ...mockWarning, matchedPattern: 'rm -rf /*' },
        terminalInfo: mockTerminalInfo
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    expect(container.textContent).toContain('Matched security pattern:');
    expect(container.textContent).toContain('rm -rf /*');
  });

  it('handles missing risk factors gracefully', async () => {
    const warningWithoutFactors = { ...mockWarning, riskFactors: [] };
    
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: warningWithoutFactors,
        terminalInfo: mockTerminalInfo
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    // Should not show risk factors section
    expect(container.querySelector('.risk-factors')).not.toBeInTheDocument();
  });

  it('handles undefined risk factors', async () => {
    const warningWithoutFactors = { 
      ...mockWarning, 
      riskFactors: undefined as any 
    };
    
    const { container } = render(CommandConfirmationDialog, {
      props: {
        open: true,
        command: 'rm -rf /',
        warning: warningWithoutFactors,
        terminalInfo: mockTerminalInfo
      }
    });

    await waitFor(() => {
      expect(container.querySelector('.confirmation-dialog')).toBeInTheDocument();
    });

    // Should not show risk factors section and not crash
    expect(container.querySelector('.risk-factors')).not.toBeInTheDocument();
  });
});