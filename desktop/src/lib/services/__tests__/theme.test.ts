import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { settings } from '$lib/stores/settings';
import { initTheme, applyTheme, toggleTheme, setupThemeShortcut } from '../theme';
import { createTypedMock } from '@/test/mock-factory';

// Mock the settings store
vi.mock('$lib/stores/settings', () => ({
  settings: {
    subscribe: vi.fn(),
    update: vi.fn(),
  }
}));

// Mock svelte store get
vi.mock('svelte/store', () => ({
  get: vi.fn()
}));

describe('Theme Service', () => {
  let cleanup: Array<() => void> = [];
  let mockSetAttribute: any;
  let mockAddEventListener: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock document.documentElement.setAttribute
    mockSetAttribute = vi.fn();
    Object.defineProperty(document, 'documentElement', {
      value: {
        setAttribute: mockSetAttribute,
      },
      writable: true,
      configurable: true,
    });

    // Mock window.addEventListener
    mockAddEventListener = vi.fn();
    window.addEventListener = mockAddEventListener;
    
    // Reset theme shortcut flag
    window.__themeShortcutKPressed = false;
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    vi.clearAllMocks();
  });

  describe('initTheme', () => {
    it('should apply initial theme from settings', () => {
      const mockSettings = { theme: 'dark' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      initTheme();
      
      expect(get).toHaveBeenCalledWith(settings);
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should subscribe to theme changes', () => {
      const mockSettings = { theme: 'light' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      initTheme();
      
      expect(settings.subscribe).toHaveBeenCalled();
    });

    it('should apply theme when settings change', () => {
      const mockSettings = { theme: 'light' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      let subscribeFn: any;
      vi.mocked(settings.subscribe).mockImplementation((fn) => {
        subscribeFn = fn;
        const unsubscribe = () => {};
        cleanup.push(unsubscribe);
        return unsubscribe;
      });
      
      initTheme();
      
      // Simulate settings change
      subscribeFn({ theme: 'dark' });
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });
  });

  describe('applyTheme', () => {
    it('should set data-theme attribute to dark', () => {
      applyTheme('dark');
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark');
    });

    it('should set data-theme attribute to light', () => {
      applyTheme('light');
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light');
    });
  });

  describe('toggleTheme', () => {
    it('should toggle from dark to light', () => {
      const mockSettings = { theme: 'dark' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      toggleTheme();
      
      expect(settings.update).toHaveBeenCalled();
      const updateFn = vi.mocked(settings.update).mock.calls[0][0];
      const newSettings = updateFn(mockSettings);
      expect(newSettings.theme).toBe('light');
    });

    it('should toggle from light to dark', () => {
      const mockSettings = { theme: 'light' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      toggleTheme();
      
      expect(settings.update).toHaveBeenCalled();
      const updateFn = vi.mocked(settings.update).mock.calls[0][0];
      const newSettings = updateFn(mockSettings);
      expect(newSettings.theme).toBe('dark');
    });
  });

  describe('setupThemeShortcut', () => {
    let keydownHandler: (e: KeyboardEvent) => void;

    beforeEach(() => {
      setupThemeShortcut();
      
      // Capture the keydown handler
      expect(mockAddEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
      keydownHandler = mockAddEventListener.mock.calls[0][1];
    });

    it('should set flag when Cmd-K is pressed on Mac', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
      });
      
      keydownHandler(event);
      
      expect(window.__themeShortcutKPressed).toBe(true);
    });

    it('should set flag when Ctrl-K is pressed on Windows/Linux', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
      });
      
      keydownHandler(event);
      
      expect(window.__themeShortcutKPressed).toBe(true);
    });

    it('should toggle theme when D is pressed after K', () => {
      const mockSettings = { theme: 'dark' as const };
      vi.mocked(get).mockReturnValue(mockSettings);
      
      // First press Cmd-K
      window.__themeShortcutKPressed = true;
      
      // Then press D
      const event = new KeyboardEvent('keydown', {
        key: 'd',
      });
      const preventDefault = vi.fn();
      Object.defineProperty(event, 'preventDefault', {
        value: preventDefault,
        writable: true,
      });
      
      keydownHandler(event);
      
      expect(preventDefault).toHaveBeenCalled();
      expect(settings.update).toHaveBeenCalled();
      expect(window.__themeShortcutKPressed).toBe(false);
    });

    it('should not toggle theme when D is pressed without K', () => {
      window.__themeShortcutKPressed = false;
      
      const event = new KeyboardEvent('keydown', {
        key: 'd',
      });
      
      keydownHandler(event);
      
      expect(settings.update).not.toHaveBeenCalled();
    });

    it('should clear flag after timeout', async () => {
      vi.useFakeTimers();
      
      const event = new KeyboardEvent('keydown', {
        key: 'k',
        metaKey: true,
      });
      
      keydownHandler(event);
      
      expect(window.__themeShortcutKPressed).toBe(true);
      
      // Advance timers by 1 second
      vi.advanceTimersByTime(1000);
      
      expect(window.__themeShortcutKPressed).toBe(false);
      
      vi.useRealTimers();
    });

    it('should ignore K without modifier key', () => {
      const event = new KeyboardEvent('keydown', {
        key: 'k',
      });
      
      keydownHandler(event);
      
      expect(window.__themeShortcutKPressed).toBeFalsy();
    });
  });
});