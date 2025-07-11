import { writable } from 'svelte/store';

export interface Settings {
  theme: 'dark' | 'light';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  autoFormat: boolean;
  terminal: {
    fontSize: number;
    fontFamily: string;
    cursorBlink: boolean;
  };
  editor: {
    vim: boolean;
    lineNumbers: boolean;
    rulers: number[];
  };
}

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

// Deep merge helper function
function deepMerge<T extends object>(target: T, source: Partial<T>): T {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] !== undefined && source[key] !== null) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(
          target[key] as any || {}, 
          source[key] as any
        );
      } else {
        result[key] = source[key] as any;
      }
    }
  }
  
  return result;
}

// Load settings from localStorage if available
function loadSettings(): Settings {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('orchflow-settings');
    if (stored) {
      try {
        const parsedSettings = JSON.parse(stored);
        return deepMerge(defaultSettings, parsedSettings);
      } catch (e) {
        console.error('Failed to parse stored settings:', e);
      }
    }
  }
  return defaultSettings;
}

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(loadSettings());

  return {
    subscribe,
    set: (value: Settings) => {
      set(value);
      if (typeof window !== 'undefined') {
        localStorage.setItem('orchflow-settings', JSON.stringify(value));
      }
    },
    update: (updater: (value: Settings) => Settings) => {
      update((settings) => {
        const newSettings = updater(settings);
        if (typeof window !== 'undefined') {
          localStorage.setItem('orchflow-settings', JSON.stringify(newSettings));
        }
        return newSettings;
      });
    },
    reset: () => {
      set(defaultSettings);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('orchflow-settings');
      }
    },
  };
}

export const settings = createSettingsStore();