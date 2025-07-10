import { writable, readable, derived, type Writable, type Readable } from 'svelte/store';
import { vi } from 'vitest';

/**
 * Create a mock writable store with spy functions
 */
export function createMockWritable<T>(initialValue: T) {
  const store = writable(initialValue);
  const subscribe = vi.fn(store.subscribe);
  const set = vi.fn(store.set);
  const update = vi.fn(store.update);

  return {
    subscribe,
    set,
    update,
    mockClear: () => {
      subscribe.mockClear();
      set.mockClear();
      update.mockClear();
    },
    mockReset: () => {
      subscribe.mockReset();
      set.mockReset();
      update.mockReset();
      store.set(initialValue);
    },
    getValue: () => {
      let value: T;
      store.subscribe(v => value = v)();
      return value!;
    }
  };
}

/**
 * Create a mock readable store with spy functions
 */
export function createMockReadable<T>(value: T) {
  const store = readable(value);
  const subscribe = vi.fn(store.subscribe);

  return {
    subscribe,
    mockClear: () => {
      subscribe.mockClear();
    },
    mockReset: () => {
      subscribe.mockReset();
    },
    getValue: () => value
  };
}

/**
 * Create a mock derived store with spy functions
 */
export function createMockDerived<T>(value: T) {
  // Create a simple derived store that just returns the value
  const baseStore = writable(value);
  const store = derived(baseStore, $base => $base);
  const subscribe = vi.fn(store.subscribe);

  return {
    subscribe,
    mockClear: () => {
      subscribe.mockClear();
    },
    mockReset: () => {
      subscribe.mockReset();
    },
    getValue: () => value,
    updateBase: (newValue: T) => {
      baseStore.set(newValue);
    }
  };
}

/**
 * Mock terminal store for testing terminal-related components
 */
export function createMockTerminalStore() {
  const terminals = new Map<string, any>();
  const activeTerminalId = writable<string | null>(null);
  
  const store = {
    terminals: writable(terminals),
    activeTerminalId,
    
    createTerminal: vi.fn((id: string, title?: string) => {
      const terminal = {
        id,
        title: title || `Terminal ${id}`,
        element: document.createElement('div'),
        isReady: true,
        write: vi.fn(),
        clear: vi.fn(),
        focus: vi.fn(),
        dispose: vi.fn(),
      };
      terminals.set(id, terminal);
      store.terminals.set(new Map(terminals));
      return terminal;
    }),
    
    getTerminal: vi.fn((id: string) => terminals.get(id)),
    
    removeTerminal: vi.fn((id: string) => {
      const terminal = terminals.get(id);
      if (terminal) {
        terminal.dispose();
        terminals.delete(id);
        store.terminals.set(new Map(terminals));
      }
    }),
    
    setActiveTerminal: vi.fn((id: string | null) => {
      activeTerminalId.set(id);
    }),
    
    mockClear: () => {
      store.createTerminal.mockClear();
      store.getTerminal.mockClear();
      store.removeTerminal.mockClear();
      store.setActiveTerminal.mockClear();
    },
    
    mockReset: () => {
      terminals.clear();
      store.terminals.set(new Map());
      activeTerminalId.set(null);
      store.mockClear();
    }
  };
  
  return store;
}

/**
 * Mock settings store for testing settings-related components
 */
export function createMockSettingsStore() {
  const defaultSettings = {
    theme: 'dark',
    fontSize: 14,
    fontFamily: 'monospace',
    tabSize: 2,
    wordWrap: false,
    lineNumbers: true,
    minimap: true,
    scrollBeyondLastLine: false,
  };

  const settings = writable(defaultSettings);
  
  const store = {
    subscribe: settings.subscribe,
    
    update: vi.fn((updater: (settings: any) => any) => {
      settings.update(updater);
    }),
    
    set: vi.fn((value: any) => {
      settings.set(value);
    }),
    
    reset: vi.fn(() => {
      settings.set(defaultSettings);
    }),
    
    getSetting: vi.fn((key: string) => {
      let value: any;
      settings.subscribe(s => value = s[key])();
      return value;
    }),
    
    setSetting: vi.fn((key: string, value: any) => {
      settings.update(s => ({ ...s, [key]: value }));
    }),
    
    mockClear: () => {
      store.update.mockClear();
      store.set.mockClear();
      store.reset.mockClear();
      store.getSetting.mockClear();
      store.setSetting.mockClear();
    },
    
    mockReset: () => {
      store.reset();
      store.mockClear();
    }
  };
  
  return store;
}

/**
 * Mock file explorer store for testing file-related components
 */
export function createMockFileExplorerStore() {
  const files = new Map<string, any>();
  const selectedFiles = new Set<string>();
  const expandedDirs = new Set<string>();
  
  const store = {
    files: writable(files),
    selectedFiles: writable(selectedFiles),
    expandedDirs: writable(expandedDirs),
    currentPath: writable('/'),
    
    addFile: vi.fn((path: string, file: any) => {
      files.set(path, file);
      store.files.set(new Map(files));
    }),
    
    removeFile: vi.fn((path: string) => {
      files.delete(path);
      selectedFiles.delete(path);
      store.files.set(new Map(files));
      store.selectedFiles.set(new Set(selectedFiles));
    }),
    
    selectFile: vi.fn((path: string, multi = false) => {
      if (!multi) {
        selectedFiles.clear();
      }
      selectedFiles.add(path);
      store.selectedFiles.set(new Set(selectedFiles));
    }),
    
    deselectFile: vi.fn((path: string) => {
      selectedFiles.delete(path);
      store.selectedFiles.set(new Set(selectedFiles));
    }),
    
    toggleDir: vi.fn((path: string) => {
      if (expandedDirs.has(path)) {
        expandedDirs.delete(path);
      } else {
        expandedDirs.add(path);
      }
      store.expandedDirs.set(new Set(expandedDirs));
    }),
    
    mockClear: () => {
      store.addFile.mockClear();
      store.removeFile.mockClear();
      store.selectFile.mockClear();
      store.deselectFile.mockClear();
      store.toggleDir.mockClear();
    },
    
    mockReset: () => {
      files.clear();
      selectedFiles.clear();
      expandedDirs.clear();
      store.files.set(new Map());
      store.selectedFiles.set(new Set());
      store.expandedDirs.set(new Set());
      store.currentPath.set('/');
      store.mockClear();
    }
  };
  
  return store;
}

/**
 * Mock command palette store for testing command-related components
 */
export function createMockCommandPaletteStore() {
  const commands = new Map<string, any>();
  const recentCommands = new Set<string>();
  
  const store = {
    isOpen: writable(false),
    searchQuery: writable(''),
    commands: writable(commands),
    recentCommands: writable(recentCommands),
    selectedIndex: writable(0),
    
    registerCommand: vi.fn((id: string, command: any) => {
      commands.set(id, command);
      store.commands.set(new Map(commands));
    }),
    
    unregisterCommand: vi.fn((id: string) => {
      commands.delete(id);
      store.commands.set(new Map(commands));
    }),
    
    executeCommand: vi.fn((id: string, ...args: any[]) => {
      const command = commands.get(id);
      if (command?.execute) {
        recentCommands.add(id);
        store.recentCommands.set(new Set(recentCommands));
        return command.execute(...args);
      }
    }),
    
    open: vi.fn(() => {
      store.isOpen.set(true);
      store.searchQuery.set('');
      store.selectedIndex.set(0);
    }),
    
    close: vi.fn(() => {
      store.isOpen.set(false);
      store.searchQuery.set('');
      store.selectedIndex.set(0);
    }),
    
    mockClear: () => {
      store.registerCommand.mockClear();
      store.unregisterCommand.mockClear();
      store.executeCommand.mockClear();
      store.open.mockClear();
      store.close.mockClear();
    },
    
    mockReset: () => {
      commands.clear();
      recentCommands.clear();
      store.commands.set(new Map());
      store.recentCommands.set(new Set());
      store.isOpen.set(false);
      store.searchQuery.set('');
      store.selectedIndex.set(0);
      store.mockClear();
    }
  };
  
  return store;
}

/**
 * Create a mock store that tracks all subscriptions and updates
 */
export function createTrackedStore<T>(initialValue: T) {
  const subscribers = new Set<(value: T) => void>();
  const updateHistory: T[] = [initialValue];
  let currentValue = initialValue;

  const store: Writable<T> = {
    subscribe: vi.fn((subscriber: (value: T) => void) => {
      subscribers.add(subscriber);
      subscriber(currentValue);
      
      return () => {
        subscribers.delete(subscriber);
      };
    }),
    
    set: vi.fn((value: T) => {
      currentValue = value;
      updateHistory.push(value);
      subscribers.forEach(sub => sub(value));
    }),
    
    update: vi.fn((updater: (value: T) => T) => {
      const newValue = updater(currentValue);
      store.set(newValue);
    })
  };

  return {
    ...store,
    getSubscriberCount: () => subscribers.size,
    getUpdateHistory: () => [...updateHistory],
    getCurrentValue: () => currentValue,
    mockClear: () => {
      (store.subscribe as any).mockClear();
      (store.set as any).mockClear();
      (store.update as any).mockClear();
    },
    mockReset: () => {
      subscribers.clear();
      updateHistory.length = 1;
      updateHistory[0] = initialValue;
      currentValue = initialValue;
      (store.subscribe as any).mockReset();
      (store.set as any).mockReset();
      (store.update as any).mockReset();
    }
  };
}

/**
 * Utility to wait for store updates in tests
 */
export async function waitForStoreUpdate<T>(
  store: Readable<T>,
  predicate: (value: T) => boolean,
  timeout = 1000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Store update timeout'));
    }, timeout);

    const unsubscribe = store.subscribe(value => {
      if (predicate(value)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve(value);
      }
    });
  });
}