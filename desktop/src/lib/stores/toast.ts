import { writable } from 'svelte/store';
import type { ToastMessage } from '$lib/components/ToastNotification.svelte';

export const toasts = writable<ToastMessage[]>([]);

export const toastManager = {
  // Add a new toast
  add(toast: Omit<ToastMessage, 'id'>): string {
    const id = crypto.randomUUID();
    const newToast: ToastMessage = {
      id,
      ...toast,
    };

    toasts.update(currentToasts => [...currentToasts, newToast]);
    return id;
  },

  // Remove a specific toast
  remove(id: string): void {
    toasts.update(currentToasts => currentToasts.filter(t => t.id !== id));
  },

  // Clear all toasts
  clear(): void {
    toasts.set([]);
  },

  // Convenience methods for different toast types
  success(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>): string {
    return this.add({
      type: 'success',
      message,
      ...options,
    });
  },

  info(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>): string {
    return this.add({
      type: 'info',
      message,
      ...options,
    });
  },

  warning(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>): string {
    return this.add({
      type: 'warning',
      message,
      ...options,
    });
  },

  error(message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>): string {
    return this.add({
      type: 'error',
      message,
      duration: 8000, // Errors stay longer by default
      ...options,
    });
  },

  // Show error with action buttons
  errorWithActions(
    message: string,
    actions: Array<{ label: string; handler: () => void; variant?: 'primary' | 'secondary' }>,
    options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message' | 'actions'>>
  ): string {
    return this.add({
      type: 'error',
      message,
      actions,
      persistent: true, // Errors with actions are persistent by default
      ...options,
    });
  },

  // Show command execution error
  commandError(command: string, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return this.error(`Failed to execute command "${command}": ${errorMessage}`, {
      title: 'Command Failed',
      actions: [
        {
          label: 'Copy Error',
          variant: 'secondary',
          handler: () => {
            navigator.clipboard.writeText(`Command: ${command}\nError: ${errorMessage}`);
          }
        },
        {
          label: 'Dismiss',
          variant: 'primary',
          handler: () => {} // Will auto-dismiss
        }
      ]
    });
  },

  // Show security alert
  securityAlert(
    message: string,
    severity: 'info' | 'warning' | 'error' = 'warning',
    actions?: Array<{ label: string; handler: () => void; variant?: 'primary' | 'secondary' }>
  ): string {
    return this.add({
      type: severity,
      title: 'Security Alert',
      message,
      persistent: true,
      actions: actions || [
        {
          label: 'Acknowledge',
          variant: 'primary',
          handler: () => {} // Will auto-dismiss
        }
      ]
    });
  }
};

export default toastManager;