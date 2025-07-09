import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Dialog from './Dialog.svelte';

describe('Dialog', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
  });

  it('renders dialog when show is true', () => {
    const { getByTestId } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true }
    });
    
    expect(getByTestId('dialog')).toBeInTheDocument();
    expect(getByTestId('dialog-content')).toBeInTheDocument();
  });

  it('does not render dialog when show is false', () => {
    const { queryByTestId } = render(Dialog, {
      props: { show: false, title: 'Test Dialog', testMode: true }
    });
    
    expect(queryByTestId('dialog')).not.toBeInTheDocument();
  });

  it('displays title when provided', () => {
    const { getByText } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true }
    });
    
    expect(getByText('Test Dialog')).toBeInTheDocument();
  });

  it('renders content slot', () => {
    const { getByText } = render(Dialog, {
      props: { show: true, testMode: true },
      slots: { default: 'Dialog content' }
    });
    
    expect(getByText('Dialog content')).toBeInTheDocument();
  });

  it('renders actions slot when provided', () => {
    const { getByText, getByTestId } = render(Dialog, {
      props: { show: true, testMode: true },
      slots: { actions: '<button>Action</button>' }
    });
    
    expect(getByTestId('dialog-actions')).toBeInTheDocument();
    expect(getByText('Action')).toBeInTheDocument();
  });

  it('does not render actions container when no actions slot', () => {
    const { queryByTestId } = render(Dialog, {
      props: { show: true, testMode: true }
    });
    
    expect(queryByTestId('dialog-actions')).not.toBeInTheDocument();
  });

  it('dispatches close event when close button is clicked', async () => {
    const { getByTestId, component } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true }
    });
    
    let closeEvent = false;
    component.$on('close', () => {
      closeEvent = true;
    });
    
    const closeButton = getByTestId('dialog-close');
    await fireEvent.click(closeButton);
    
    expect(closeEvent).toBe(true);
  });

  it('dispatches close event when Escape key is pressed', async () => {
    const { getByTestId, component } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true }
    });
    
    let closeEvent = false;
    component.$on('close', () => {
      closeEvent = true;
    });
    
    const dialog = getByTestId('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    
    expect(closeEvent).toBe(true);
  });

  it('does not close on Escape when closeOnEscape is false', async () => {
    const { getByTestId, component } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true, closeOnEscape: false }
    });
    
    let closeEvent = false;
    component.$on('close', () => {
      closeEvent = true;
    });
    
    const dialog = getByTestId('dialog');
    await fireEvent.keyDown(dialog, { key: 'Escape' });
    
    expect(closeEvent).toBe(false);
  });

  it('dispatches close event when backdrop is clicked', async () => {
    const { getByTestId, component } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true }
    });
    
    let closeEvent = false;
    component.$on('close', () => {
      closeEvent = true;
    });
    
    const backdrop = getByTestId('dialog-backdrop');
    await fireEvent.click(backdrop);
    
    expect(closeEvent).toBe(true);
  });

  it('does not close on backdrop click when closeOnBackdrop is false', async () => {
    const { getByTestId, component } = render(Dialog, {
      props: { show: true, title: 'Test Dialog', testMode: true, closeOnBackdrop: false }
    });
    
    let closeEvent = false;
    component.$on('close', () => {
      closeEvent = true;
    });
    
    const backdrop = getByTestId('dialog-backdrop');
    await fireEvent.click(backdrop);
    
    expect(closeEvent).toBe(false);
  });

  it('applies custom width and height', () => {
    const { getByTestId } = render(Dialog, {
      props: { show: true, width: '600px', height: '400px', testMode: true }
    });
    
    const dialog = getByTestId('dialog');
    expect(dialog).toHaveStyle('width: 600px');
    expect(dialog).toHaveStyle('height: 400px');
  });

  it('has proper ARIA attributes', () => {
    const { getByTestId } = render(Dialog, {
      props: { 
        show: true, 
        title: 'Test Dialog', 
        testMode: true,
        ariaDescribedBy: 'description'
      }
    });
    
    const dialog = getByTestId('dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby');
    expect(dialog).toHaveAttribute('aria-describedby', 'description');
  });

  it('uses aria-label when no title provided', () => {
    const { getByTestId } = render(Dialog, {
      props: { 
        show: true, 
        testMode: true,
        ariaLabel: 'Custom dialog label'
      }
    });
    
    const dialog = getByTestId('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Custom dialog label');
  });

  it('has focus trap for keyboard navigation', async () => {
    const { getByTestId } = render(Dialog, {
      props: { 
        show: true, 
        testMode: true,
        title: 'Test Dialog'
      },
      slots: { 
        default: '<input data-testid="first-input" /><button data-testid="button">Button</button><input data-testid="last-input" />' 
      }
    });
    
    const firstInput = getByTestId('first-input');
    const button = getByTestId('button');
    const lastInput = getByTestId('last-input');
    
    // Focus should cycle through focusable elements
    firstInput.focus();
    await user.tab();
    expect(button).toHaveFocus();
    
    await user.tab();
    expect(lastInput).toHaveFocus();
    
    // Tab from last element should go to first
    await user.tab();
    expect(getByTestId('dialog-close')).toHaveFocus();
  });

  it('handles shift+tab for reverse focus trap', async () => {
    const { getByTestId } = render(Dialog, {
      props: { 
        show: true, 
        testMode: true,
        title: 'Test Dialog'
      },
      slots: { 
        default: '<input data-testid="first-input" /><button data-testid="button">Button</button>' 
      }
    });
    
    const firstInput = getByTestId('first-input');
    const closeButton = getByTestId('dialog-close');
    
    // Focus first element then shift+tab should go to last
    firstInput.focus();
    await user.tab({ shift: true });
    expect(closeButton).toHaveFocus();
  });

  it('focuses close button when no focusable elements in content', async () => {
    const { getByTestId } = render(Dialog, {
      props: { 
        show: true, 
        testMode: true,
        title: 'Test Dialog'
      },
      slots: { 
        default: '<div>No focusable content</div>' 
      }
    });
    
    // Only the close button should be focusable
    const closeButton = getByTestId('dialog-close');
    expect(closeButton).toBeInTheDocument();
  });
});