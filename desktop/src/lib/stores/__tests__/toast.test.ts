import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import type { ToastMessage, ToastAction } from '$lib/components/ToastNotification.svelte';

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
Object.defineProperty(global.crypto, 'randomUUID', {
  value: mockRandomUUID,
  writable: true,
  configurable: true
});

// Mock navigator.clipboard
const mockClipboardWriteText = vi.fn();
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockClipboardWriteText
  },
  writable: true
});

// Import after mocking
import { toasts, toastManager } from '../toast';

describe('Toast Store', () => {
  const cleanup: Array<() => void> = [];

  beforeEach(() => {
    // Reset store
    toasts.set([]);
    // Reset mocks
    mockRandomUUID.mockReturnValue('test-uuid');
    mockClipboardWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup.length = 0;
    vi.clearAllMocks();
  });

  describe('toastManager.add', () => {
    it('should add a toast with generated ID', () => {
      const toast = {
        type: 'info' as const,
        message: 'Test message'
      };

      const id = toastManager.add(toast);

      expect(id).toBe('test-uuid');
      expect(mockRandomUUID).toHaveBeenCalledTimes(1);

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(1);
      expect(allToasts[0]).toEqual({
        id: 'test-uuid',
        type: 'info',
        message: 'Test message'
      });
    });

    it('should add multiple toasts', () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      toastManager.add({ type: 'success', message: 'Success!' });
      toastManager.add({ type: 'warning', message: 'Warning!' });
      toastManager.add({ type: 'error', message: 'Error!' });

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(3);
      expect(allToasts[0].id).toBe('uuid-1');
      expect(allToasts[1].id).toBe('uuid-2');
      expect(allToasts[2].id).toBe('uuid-3');
    });

    it('should preserve all toast properties', () => {
      const toast: Omit<ToastMessage, 'id'> = {
        type: 'info',
        title: 'Important Update',
        message: 'Something happened',
        duration: 10000,
        persistent: true,
        actions: [
          {
            label: 'Retry',
            variant: 'primary',
            handler: vi.fn()
          }
        ]
      };

      toastManager.add(toast);

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject(toast);
    });
  });

  describe('toastManager.remove', () => {
    it('should remove a specific toast by ID', () => {
      mockRandomUUID
        .mockReturnValueOnce('toast-1')
        .mockReturnValueOnce('toast-2')
        .mockReturnValueOnce('toast-3');

      toastManager.add({ type: 'info', message: 'Toast 1' });
      toastManager.add({ type: 'info', message: 'Toast 2' });
      toastManager.add({ type: 'info', message: 'Toast 3' });

      toastManager.remove('toast-2');

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(2);
      expect(allToasts.find(t => t.id === 'toast-2')).toBeUndefined();
      expect(allToasts[0].message).toBe('Toast 1');
      expect(allToasts[1].message).toBe('Toast 3');
    });

    it('should handle removing non-existent toast', () => {
      toastManager.add({ type: 'info', message: 'Test' });
      
      toastManager.remove('non-existent');

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(1);
    });

    it('should handle removing from empty store', () => {
      toastManager.remove('any-id');

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(0);
    });
  });

  describe('toastManager.clear', () => {
    it('should remove all toasts', () => {
      mockRandomUUID
        .mockReturnValueOnce('toast-1')
        .mockReturnValueOnce('toast-2')
        .mockReturnValueOnce('toast-3');

      toastManager.add({ type: 'info', message: 'Toast 1' });
      toastManager.add({ type: 'success', message: 'Toast 2' });
      toastManager.add({ type: 'error', message: 'Toast 3' });

      toastManager.clear();

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(0);
    });

    it('should handle clearing empty store', () => {
      toastManager.clear();

      const allToasts = get(toasts);
      expect(allToasts).toHaveLength(0);
    });
  });

  describe('convenience methods', () => {
    describe('success', () => {
      it('should create success toast with correct type', () => {
        const id = toastManager.success('Operation completed!');

        const allToasts = get(toasts);
        expect(allToasts[0]).toMatchObject({
          id: 'test-uuid',
          type: 'success',
          message: 'Operation completed!'
        });
        expect(id).toBe('test-uuid');
      });

      it('should accept additional options', () => {
        toastManager.success('Success!', {
          title: 'Great Job',
          duration: 3000,
          persistent: true
        });

        const allToasts = get(toasts);
        expect(allToasts[0]).toMatchObject({
          type: 'success',
          message: 'Success!',
          title: 'Great Job',
          duration: 3000,
          persistent: true
        });
      });
    });

    describe('info', () => {
      it('should create info toast with correct type', () => {
        const id = toastManager.info('For your information');

        const allToasts = get(toasts);
        expect(allToasts[0]).toMatchObject({
          id: 'test-uuid',
          type: 'info',
          message: 'For your information'
        });
        expect(id).toBe('test-uuid');
      });

      it('should accept additional options', () => {
        toastManager.info('Info message', {
          title: 'Notice',
          actions: [{
            label: 'Got it',
            handler: vi.fn()
          }]
        });

        const allToasts = get(toasts);
        expect(allToasts[0].title).toBe('Notice');
        expect(allToasts[0].actions).toHaveLength(1);
      });
    });

    describe('warning', () => {
      it('should create warning toast with correct type', () => {
        const id = toastManager.warning('Be careful!');

        const allToasts = get(toasts);
        expect(allToasts[0]).toMatchObject({
          id: 'test-uuid',
          type: 'warning',
          message: 'Be careful!'
        });
        expect(id).toBe('test-uuid');
      });
    });

    describe('error', () => {
      it('should create error toast with default 8s duration', () => {
        const id = toastManager.error('Something went wrong');

        const allToasts = get(toasts);
        expect(allToasts[0]).toMatchObject({
          id: 'test-uuid',
          type: 'error',
          message: 'Something went wrong',
          duration: 8000
        });
        expect(id).toBe('test-uuid');
      });

      it('should allow overriding default duration', () => {
        toastManager.error('Quick error', { duration: 3000 });

        const allToasts = get(toasts);
        expect(allToasts[0].duration).toBe(3000);
      });
    });
  });

  describe('errorWithActions', () => {
    it('should create persistent error toast with actions', () => {
      const retryHandler = vi.fn();
      const dismissHandler = vi.fn();
      
      const actions: ToastAction[] = [
        { label: 'Retry', handler: retryHandler, variant: 'primary' },
        { label: 'Dismiss', handler: dismissHandler }
      ];

      const id = toastManager.errorWithActions('Failed to save file', actions);

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject({
        id: 'test-uuid',
        type: 'error',
        message: 'Failed to save file',
        persistent: true,
        actions
      });
      expect(id).toBe('test-uuid');
    });

    it('should accept additional options', () => {
      const actions: ToastAction[] = [
        { label: 'OK', handler: vi.fn() }
      ];

      toastManager.errorWithActions('Error occurred', actions, {
        title: 'System Error',
        persistent: false, // Override default
        duration: 5000
      });

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject({
        type: 'error',
        message: 'Error occurred',
        title: 'System Error',
        persistent: false,
        duration: 5000,
        actions
      });
    });
  });

  describe('commandError', () => {
    it('should create error toast for command failures', () => {
      const id = toastManager.commandError('rm -rf /', new Error('Permission denied'));

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject({
        id: 'test-uuid',
        type: 'error',
        title: 'Command Failed',
        message: 'Failed to execute command "rm -rf /": Permission denied',
        actions: expect.any(Array)
      });
      expect(id).toBe('test-uuid');
    });

    it('should handle non-Error objects', () => {
      toastManager.commandError('ls', 'Command not found');

      const allToasts = get(toasts);
      expect(allToasts[0].message).toBe('Failed to execute command "ls": Command not found');
    });

    it('should provide copy error action', async () => {
      toastManager.commandError('git push', new Error('Authentication failed'));

      const allToasts = get(toasts);
      const copyAction = allToasts[0].actions?.find(a => a.label === 'Copy Error');
      expect(copyAction).toBeDefined();

      // Execute the copy handler
      await copyAction!.handler();

      expect(mockClipboardWriteText).toHaveBeenCalledWith(
        'Command: git push\nError: Authentication failed'
      );
    });

    it('should provide dismiss action', () => {
      toastManager.commandError('npm install', new Error('Network error'));

      const allToasts = get(toasts);
      const dismissAction = allToasts[0].actions?.find(a => a.label === 'Dismiss');
      expect(dismissAction).toBeDefined();
      expect(dismissAction?.variant).toBe('primary');
      
      // The handler should be a no-op function
      expect(() => dismissAction!.handler()).not.toThrow();
    });

    it('should handle complex error objects', () => {
      const complexError = {
        message: 'Complex error',
        code: 'ENOENT',
        path: '/missing/file'
      };

      toastManager.commandError('cat file.txt', complexError);

      const allToasts = get(toasts);
      expect(allToasts[0].message).toContain('[object Object]');
    });
  });

  describe('securityAlert', () => {
    it('should create security alert with default warning severity', () => {
      const id = toastManager.securityAlert('Untrusted workspace detected');

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject({
        id: 'test-uuid',
        type: 'warning',
        title: 'Security Alert',
        message: 'Untrusted workspace detected',
        persistent: true,
        actions: expect.any(Array)
      });
      expect(id).toBe('test-uuid');
    });

    it('should use specified severity level', () => {
      toastManager.securityAlert('Security scan completed', 'info');

      const allToasts = get(toasts);
      expect(allToasts[0].type).toBe('info');
    });

    it('should use error severity', () => {
      toastManager.securityAlert('Critical security breach!', 'error');

      const allToasts = get(toasts);
      expect(allToasts[0].type).toBe('error');
    });

    it('should provide default acknowledge action', () => {
      toastManager.securityAlert('Warning message');

      const allToasts = get(toasts);
      expect(allToasts[0].actions).toHaveLength(1);
      expect(allToasts[0].actions![0]).toMatchObject({
        label: 'Acknowledge',
        variant: 'primary'
      });

      // The handler should be a no-op function
      expect(() => allToasts[0].actions![0].handler()).not.toThrow();
    });

    it('should use custom actions when provided', () => {
      const allowHandler = vi.fn();
      const blockHandler = vi.fn();
      
      const customActions: ToastAction[] = [
        { label: 'Allow', handler: allowHandler, variant: 'primary' },
        { label: 'Block', handler: blockHandler, variant: 'secondary' }
      ];

      toastManager.securityAlert('Suspicious activity detected', 'warning', customActions);

      const allToasts = get(toasts);
      expect(allToasts[0].actions).toEqual(customActions);
    });
  });

  describe('store reactivity', () => {
    it('should trigger subscribers when toasts are added', () => {
      const subscriber = vi.fn();
      const unsubscribe = toasts.subscribe(subscriber);
      cleanup.push(unsubscribe);

      // Initial call
      expect(subscriber).toHaveBeenCalledTimes(1);
      expect(subscriber).toHaveBeenCalledWith([]);

      toastManager.add({ type: 'info', message: 'Test' });

      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenLastCalledWith([
        expect.objectContaining({
          type: 'info',
          message: 'Test'
        })
      ]);
    });

    it('should trigger subscribers when toasts are removed', () => {
      const subscriber = vi.fn();
      
      toastManager.add({ type: 'info', message: 'Test' });
      
      const unsubscribe = toasts.subscribe(subscriber);
      cleanup.push(unsubscribe);

      toastManager.remove('test-uuid');

      expect(subscriber).toHaveBeenCalledTimes(2);
      expect(subscriber).toHaveBeenLastCalledWith([]);
    });

    it('should trigger subscribers when toasts are cleared', () => {
      const subscriber = vi.fn();
      
      mockRandomUUID
        .mockReturnValueOnce('toast-1')
        .mockReturnValueOnce('toast-2');
      
      toastManager.add({ type: 'info', message: 'Test 1' });
      toastManager.add({ type: 'success', message: 'Test 2' });
      
      const unsubscribe = toasts.subscribe(subscriber);
      cleanup.push(unsubscribe);

      toastManager.clear();

      expect(subscriber).toHaveBeenLastCalledWith([]);
    });
  });

  describe('edge cases', () => {
    it('should handle empty message', () => {
      toastManager.info('');

      const allToasts = get(toasts);
      expect(allToasts[0].message).toBe('');
    });

    it('should handle very long messages', () => {
      const longMessage = 'A'.repeat(1000);
      toastManager.info(longMessage);

      const allToasts = get(toasts);
      expect(allToasts[0].message).toBe(longMessage);
    });

    it('should handle concurrent additions', () => {
      mockRandomUUID
        .mockReturnValueOnce('uuid-1')
        .mockReturnValueOnce('uuid-2')
        .mockReturnValueOnce('uuid-3');

      // Simulate rapid additions
      const promises = [
        Promise.resolve(toastManager.success('Toast 1')),
        Promise.resolve(toastManager.info('Toast 2')),
        Promise.resolve(toastManager.error('Toast 3'))
      ];

      return Promise.all(promises).then(() => {
        const allToasts = get(toasts);
        expect(allToasts).toHaveLength(3);
        expect(allToasts.map(t => t.id)).toEqual(['uuid-1', 'uuid-2', 'uuid-3']);
      });
    });

    it('should handle special characters in messages', () => {
      const specialMessage = 'Error: <script>alert("XSS")</script> & "quotes" \'single\'';
      toastManager.error(specialMessage);

      const allToasts = get(toasts);
      expect(allToasts[0].message).toBe(specialMessage);
    });

    it('should handle undefined options gracefully', () => {
      toastManager.success('Test', undefined);

      const allToasts = get(toasts);
      expect(allToasts[0]).toMatchObject({
        type: 'success',
        message: 'Test'
      });
    });
  });
});