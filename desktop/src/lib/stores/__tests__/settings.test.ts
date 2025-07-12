import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { createTypedMock } from '@/test/mock-factory';
import { buildSettings } from '../../../test/test-data-builders';

// Create typed mock for localStorage
const createLocalStorageMock = () => ({
  getItem: createTypedMock<Storage['getItem']>(),
  setItem: createTypedMock<Storage['setItem']>(),
  removeItem: createTypedMock<Storage['removeItem']>(),
  clear: createTypedMock<Storage['clear']>(),
  length: 0,
  key: createTypedMock<Storage['key']>()
});

const localStorageMock = createLocalStorageMock();

// Mock localStorage BEFORE importing the store
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Import settings after mocking localStorage
import { settings, type Settings } from '../settings';

describe('Settings Store', () => {
  let cleanup: Array<() => void> = [];
  
  const defaultSettings: Settings = {
    theme: 'dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: true,
    autoSave: false,
    autoFormat: false,
    terminal: {
      fontSize: 14,
      fontFamily: 'monospace',
      cursorBlink: true,
    },
    editor: {
      vim: false,
      lineNumbers: true,
      rulers: [80, 120],
    },
  };

  beforeEach(() => {
    // Reset all mocks
    localStorageMock.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    // Reset the store by recreating it
    settings.reset();
    // Clear all mocks
    vi.clearAllMocks();
    // Run cleanup functions
    cleanup.forEach(fn => fn());
    cleanup = [];
  });

  describe('initialization', () => {
    it('should load default settings when localStorage is empty', async () => {
      // Re-import the settings module to trigger initialization
      vi.resetModules();
      localStorageMock.getItem.mockReturnValue(null);
      const { settings: freshSettings } = await import('../settings');
      
      const currentSettings = get(freshSettings);
      expect(currentSettings).toEqual(defaultSettings);
      expect(localStorageMock.getItem).toHaveBeenCalledWith('orchflow-settings');
    });

    it('should load settings from localStorage if available', async () => {
      const storedSettings: Partial<Settings> = {
        theme: 'light',
        fontSize: 16,
        terminal: {
          fontSize: 16,
          fontFamily: 'Consolas',
          cursorBlink: false,
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(storedSettings));
      
      // Need to re-import to trigger loading from localStorage
      vi.resetModules();
      const { settings: freshSettings } = await import('../settings');
      
      const currentSettings = get(freshSettings);
      expect(currentSettings.theme).toBe('light');
      expect(currentSettings.fontSize).toBe(16);
      expect(currentSettings.terminal.fontSize).toBe(16);
      expect(currentSettings.terminal.fontFamily).toBe('Consolas');
      expect(currentSettings.terminal.cursorBlink).toBe(false);
      
      // Other settings should still have default values
      expect(currentSettings.tabSize).toBe(defaultSettings.tabSize);
      expect(currentSettings.wordWrap).toBe(defaultSettings.wordWrap);
    });

    it('should handle corrupted localStorage data gracefully', async () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      cleanup.push(() => consoleErrorSpy.mockRestore());
      
      // Need to re-import to trigger loading from localStorage
      vi.resetModules();
      const { settings: freshSettings } = await import('../settings');
      
      const currentSettings = get(freshSettings);
      expect(currentSettings).toEqual(defaultSettings);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to parse stored settings:', expect.any(Error));
    });
  });

  describe('set', () => {
    it('should update settings and save to localStorage', () => {
      const newSettings = buildSettings({
        theme: 'light',
        fontSize: 16,
        autoSave: true,
      });
      
      settings.set(newSettings);
      
      const currentSettings = get(settings);
      expect(currentSettings).toEqual(newSettings);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'orchflow-settings',
        JSON.stringify(newSettings)
      );
    });

    it('should work when window is undefined (SSR)', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      const newSettings = buildSettings({ theme: 'light' });
      settings.set(newSettings);
      
      const currentSettings = get(settings);
      expect(currentSettings.theme).toBe('light');
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('update', () => {
    it('should update specific settings and save to localStorage', () => {
      settings.update(s => ({
        ...s,
        fontSize: 18,
        terminal: {
          ...s.terminal,
          fontSize: 18,
        }
      }));
      
      const currentSettings = get(settings);
      expect(currentSettings.fontSize).toBe(18);
      expect(currentSettings.terminal.fontSize).toBe(18);
      expect(currentSettings.theme).toBe(defaultSettings.theme); // unchanged
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'orchflow-settings',
        JSON.stringify(currentSettings)
      );
    });

    it('should handle complex nested updates', () => {
      settings.update(s => ({
        ...s,
        editor: {
          ...s.editor,
          vim: true,
          rulers: [100, 150],
        }
      }));
      
      const currentSettings = get(settings);
      expect(currentSettings.editor.vim).toBe(true);
      expect(currentSettings.editor.rulers).toEqual([100, 150]);
      expect(currentSettings.editor.lineNumbers).toBe(true); // unchanged
    });

    it('should work when window is undefined (SSR)', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      settings.update(s => ({ ...s, fontSize: 20 }));
      
      const currentSettings = get(settings);
      expect(currentSettings.fontSize).toBe(20);
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('reset', () => {
    it('should reset to default settings and clear localStorage', () => {
      // First modify settings
      const customSettings = buildSettings({
        theme: 'light',
        fontSize: 20,
      });
      settings.set(customSettings);
      
      // Then reset
      settings.reset();
      
      const currentSettings = get(settings);
      expect(currentSettings).toEqual(defaultSettings);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('orchflow-settings');
    });

    it('should work when window is undefined (SSR)', () => {
      // Temporarily remove window
      const originalWindow = global.window;
      // @ts-ignore
      delete global.window;
      
      settings.reset();
      
      const currentSettings = get(settings);
      expect(currentSettings).toEqual(defaultSettings);
      
      // Restore window
      global.window = originalWindow;
    });
  });

  describe('theme changes', () => {
    it('should toggle theme between light and dark', () => {
      // Start with dark (default)
      expect(get(settings).theme).toBe('dark');
      
      // Toggle to light
      settings.update(s => ({ ...s, theme: 'light' }));
      expect(get(settings).theme).toBe('light');
      
      // Toggle back to dark
      settings.update(s => ({ ...s, theme: 'dark' }));
      expect(get(settings).theme).toBe('dark');
    });
  });

  describe('terminal settings', () => {
    it('should update terminal settings independently', () => {
      settings.update(s => ({
        ...s,
        terminal: {
          ...s.terminal,
          fontFamily: 'JetBrains Mono',
          cursorBlink: false,
        }
      }));
      
      const currentSettings = get(settings);
      expect(currentSettings.terminal.fontFamily).toBe('JetBrains Mono');
      expect(currentSettings.terminal.cursorBlink).toBe(false);
      expect(currentSettings.terminal.fontSize).toBe(14); // unchanged
    });
  });

  describe('editor settings', () => {
    it('should update editor settings independently', () => {
      settings.update(s => ({
        ...s,
        editor: {
          ...s.editor,
          vim: true,
          lineNumbers: false,
        }
      }));
      
      const currentSettings = get(settings);
      expect(currentSettings.editor.vim).toBe(true);
      expect(currentSettings.editor.lineNumbers).toBe(false);
      expect(currentSettings.editor.rulers).toEqual([80, 120]); // unchanged
    });
  });

  describe('persistence', () => {
    it('should persist changes across store recreations', async () => {
      const customSettings = buildSettings({
        theme: 'light',
        fontSize: 18,
        autoSave: true,
      });
      
      settings.set(customSettings);
      
      // Simulate page reload by resetting mocks and reimporting
      localStorageMock.getItem.mockReturnValue(JSON.stringify(customSettings));
      vi.resetModules();
      const { settings: newSettings } = await import('../settings');
      
      const loadedSettings = get(newSettings);
      expect(loadedSettings).toEqual(customSettings);
    });
  });

  describe('edge cases', () => {
    it('should handle partial settings objects in localStorage', async () => {
      const partialSettings = {
        theme: 'light' as const,
        fontSize: 20,
        // Missing many other properties
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(partialSettings));
      
      vi.resetModules();
      const { settings: freshSettings } = await import('../settings');
      
      const currentSettings = get(freshSettings);
      
      // Should have the partial settings
      expect(currentSettings.theme).toBe('light');
      expect(currentSettings.fontSize).toBe(20);
      
      // Should have default values for missing properties
      expect(currentSettings.tabSize).toBe(defaultSettings.tabSize);
      expect(currentSettings.terminal).toEqual(defaultSettings.terminal);
      expect(currentSettings.editor).toEqual(defaultSettings.editor);
    });

    it('should handle deeply nested partial objects', async () => {
      const partialSettings = {
        terminal: {
          fontSize: 16,
          // Missing fontFamily and cursorBlink
        }
      };
      
      localStorageMock.getItem.mockReturnValue(JSON.stringify(partialSettings));
      
      vi.resetModules();
      const { settings: freshSettings } = await import('../settings');
      
      const currentSettings = get(freshSettings);
      
      // Should merge partial nested objects correctly
      expect(currentSettings.terminal.fontSize).toBe(16);
      expect(currentSettings.terminal.fontFamily).toBe(defaultSettings.terminal.fontFamily);
      expect(currentSettings.terminal.cursorBlink).toBe(defaultSettings.terminal.cursorBlink);
    });
  });

  describe('settings builder integration', () => {
    it('should work with buildSettings helper', () => {
      const customSettings = buildSettings({
        theme: 'light',
        fontSize: 18,
        terminal: {
          fontSize: 16,
          fontFamily: 'JetBrains Mono',
          cursorBlink: false,
        },
        editor: {
          vim: true,
          lineNumbers: false,
          rulers: [100],
        },
      });

      settings.set(customSettings);
      
      const currentSettings = get(settings);
      expect(currentSettings.theme).toBe('light');
      expect(currentSettings.fontSize).toBe(18);
      expect(currentSettings.terminal.fontSize).toBe(16);
      expect(currentSettings.terminal.fontFamily).toBe('JetBrains Mono');
      expect(currentSettings.editor.vim).toBe(true);
      expect(currentSettings.editor.rulers).toEqual([100]);
    });

    it('should use buildSettings for partial updates', () => {
      const initial = buildSettings({ theme: 'dark' });
      settings.set(initial);

      const updated = buildSettings({ 
        theme: 'light',
        fontSize: 20,
      });
      
      settings.update(s => ({
        ...s,
        theme: updated.theme,
        fontSize: updated.fontSize,
      }));

      const currentSettings = get(settings);
      expect(currentSettings.theme).toBe('light');
      expect(currentSettings.fontSize).toBe(20);
      // Other settings remain unchanged
      expect(currentSettings.tabSize).toBe(initial.tabSize);
      expect(currentSettings.terminal).toEqual(initial.terminal);
    });
  });
});