import { vi } from 'vitest';

/**
 * Mock Tauri window API
 */
export function createMockWindow() {
  const listeners = new Map<string, Set<Function>>();
  
  return {
    appWindow: {
      listen: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
        
        // Return unsubscribe function
        return Promise.resolve(() => {
          listeners.get(event)?.delete(handler);
        });
      }),
      
      emit: vi.fn((event: string, payload?: any) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler({ payload }));
        }
        return Promise.resolve();
      }),
      
      setTitle: vi.fn(() => Promise.resolve()),
      maximize: vi.fn(() => Promise.resolve()),
      minimize: vi.fn(() => Promise.resolve()),
      toggleMaximize: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      show: vi.fn(() => Promise.resolve()),
      setFocus: vi.fn(() => Promise.resolve()),
      center: vi.fn(() => Promise.resolve()),
      
      isMaximized: vi.fn(() => Promise.resolve(false)),
      isMinimized: vi.fn(() => Promise.resolve(false)),
      isVisible: vi.fn(() => Promise.resolve(true)),
      isFocused: vi.fn(() => Promise.resolve(true)),
      isDecorated: vi.fn(() => Promise.resolve(true)),
      isResizable: vi.fn(() => Promise.resolve(true)),
      
      innerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
      outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
      innerSize: vi.fn(() => Promise.resolve({ width: 1024, height: 768 })),
      outerSize: vi.fn(() => Promise.resolve({ width: 1024, height: 768 })),
      
      setPosition: vi.fn(() => Promise.resolve()),
      setSize: vi.fn(() => Promise.resolve()),
      setMinSize: vi.fn(() => Promise.resolve()),
      setMaxSize: vi.fn(() => Promise.resolve()),
      
      mockClear: () => {
        Object.values(mockWindow.appWindow).forEach(fn => {
          if (typeof fn === 'function' && 'mockClear' in fn) {
            (fn as any).mockClear();
          }
        });
      },
      
      mockReset: () => {
        listeners.clear();
        mockWindow.appWindow.mockClear();
      },
      
      triggerEvent: (event: string, payload?: any) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler({ payload }));
        }
      }
    }
  };
  
  const mockWindow = {
    appWindow: {
      listen: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
        
        return Promise.resolve(() => {
          listeners.get(event)?.delete(handler);
        });
      }),
      
      emit: vi.fn((event: string, payload?: any) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler({ payload }));
        }
        return Promise.resolve();
      }),
      
      setTitle: vi.fn(() => Promise.resolve()),
      maximize: vi.fn(() => Promise.resolve()),
      minimize: vi.fn(() => Promise.resolve()),
      toggleMaximize: vi.fn(() => Promise.resolve()),
      close: vi.fn(() => Promise.resolve()),
      hide: vi.fn(() => Promise.resolve()),
      show: vi.fn(() => Promise.resolve()),
      setFocus: vi.fn(() => Promise.resolve()),
      center: vi.fn(() => Promise.resolve()),
      
      isMaximized: vi.fn(() => Promise.resolve(false)),
      isMinimized: vi.fn(() => Promise.resolve(false)),
      isVisible: vi.fn(() => Promise.resolve(true)),
      isFocused: vi.fn(() => Promise.resolve(true)),
      isDecorated: vi.fn(() => Promise.resolve(true)),
      isResizable: vi.fn(() => Promise.resolve(true)),
      
      innerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
      outerPosition: vi.fn(() => Promise.resolve({ x: 0, y: 0 })),
      innerSize: vi.fn(() => Promise.resolve({ width: 1024, height: 768 })),
      outerSize: vi.fn(() => Promise.resolve({ width: 1024, height: 768 })),
      
      setPosition: vi.fn(() => Promise.resolve()),
      setSize: vi.fn(() => Promise.resolve()),
      setMinSize: vi.fn(() => Promise.resolve()),
      setMaxSize: vi.fn(() => Promise.resolve()),
      
      mockClear: () => {
        Object.values(mockWindow.appWindow).forEach(fn => {
          if (typeof fn === 'function' && 'mockClear' in fn) {
            (fn as any).mockClear();
          }
        });
      },
      
      mockReset: () => {
        listeners.clear();
        mockWindow.appWindow.mockClear();
      },
      
      triggerEvent: (event: string, payload?: any) => {
        const handlers = listeners.get(event);
        if (handlers) {
          handlers.forEach(handler => handler({ payload }));
        }
      }
    }
  };
  
  return mockWindow;
}

/**
 * Mock Tauri file system API
 */
export function createMockFs() {
  const fileSystem = new Map<string, string | Uint8Array>();
  
  return {
    readTextFile: vi.fn((path: string) => {
      const content = fileSystem.get(path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(typeof content === 'string' ? content : new TextDecoder().decode(content));
    }),
    
    readBinaryFile: vi.fn((path: string) => {
      const content = fileSystem.get(path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(
        content instanceof Uint8Array ? content : new TextEncoder().encode(content)
      );
    }),
    
    writeTextFile: vi.fn((path: string, content: string) => {
      fileSystem.set(path, content);
      return Promise.resolve();
    }),
    
    writeBinaryFile: vi.fn((path: string, content: Uint8Array) => {
      fileSystem.set(path, content);
      return Promise.resolve();
    }),
    
    exists: vi.fn((path: string) => {
      return Promise.resolve(fileSystem.has(path));
    }),
    
    createDir: vi.fn((path: string) => {
      // Mock directory creation
      return Promise.resolve();
    }),
    
    removeFile: vi.fn((path: string) => {
      fileSystem.delete(path);
      return Promise.resolve();
    }),
    
    removeDir: vi.fn((path: string) => {
      // Mock directory removal
      return Promise.resolve();
    }),
    
    copyFile: vi.fn((source: string, destination: string) => {
      const content = fileSystem.get(source);
      if (content !== undefined) {
        fileSystem.set(destination, content);
      }
      return Promise.resolve();
    }),
    
    renameFile: vi.fn((oldPath: string, newPath: string) => {
      const content = fileSystem.get(oldPath);
      if (content !== undefined) {
        fileSystem.delete(oldPath);
        fileSystem.set(newPath, content);
      }
      return Promise.resolve();
    }),
    
    mockClear: () => {
      Object.values(mockFs).forEach(fn => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as any).mockClear();
        }
      });
    },
    
    mockReset: () => {
      fileSystem.clear();
      mockFs.mockClear();
    },
    
    mockAddFile: (path: string, content: string | Uint8Array) => {
      fileSystem.set(path, content);
    },
    
    mockGetFile: (path: string) => fileSystem.get(path),
    
    mockListFiles: () => Array.from(fileSystem.keys())
  };
  
  const mockFs = {
    readTextFile: vi.fn((path: string) => {
      const content = fileSystem.get(path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(typeof content === 'string' ? content : new TextDecoder().decode(content));
    }),
    
    readBinaryFile: vi.fn((path: string) => {
      const content = fileSystem.get(path);
      if (content === undefined) {
        return Promise.reject(new Error(`File not found: ${path}`));
      }
      return Promise.resolve(
        content instanceof Uint8Array ? content : new TextEncoder().encode(content)
      );
    }),
    
    writeTextFile: vi.fn((path: string, content: string) => {
      fileSystem.set(path, content);
      return Promise.resolve();
    }),
    
    writeBinaryFile: vi.fn((path: string, content: Uint8Array) => {
      fileSystem.set(path, content);
      return Promise.resolve();
    }),
    
    exists: vi.fn((path: string) => {
      return Promise.resolve(fileSystem.has(path));
    }),
    
    createDir: vi.fn(() => Promise.resolve()),
    removeFile: vi.fn((path: string) => {
      fileSystem.delete(path);
      return Promise.resolve();
    }),
    removeDir: vi.fn(() => Promise.resolve()),
    
    copyFile: vi.fn((source: string, destination: string) => {
      const content = fileSystem.get(source);
      if (content !== undefined) {
        fileSystem.set(destination, content);
      }
      return Promise.resolve();
    }),
    
    renameFile: vi.fn((oldPath: string, newPath: string) => {
      const content = fileSystem.get(oldPath);
      if (content !== undefined) {
        fileSystem.delete(oldPath);
        fileSystem.set(newPath, content);
      }
      return Promise.resolve();
    }),
    
    mockClear: () => {
      Object.values(mockFs).forEach(fn => {
        if (typeof fn === 'function' && 'mockClear' in fn) {
          (fn as any).mockClear();
        }
      });
    },
    
    mockReset: () => {
      fileSystem.clear();
      mockFs.mockClear();
    },
    
    mockAddFile: (path: string, content: string | Uint8Array) => {
      fileSystem.set(path, content);
    },
    
    mockGetFile: (path: string) => fileSystem.get(path),
    mockListFiles: () => Array.from(fileSystem.keys())
  };
  
  return mockFs;
}

/**
 * Mock Tauri dialog API
 */
export function createMockDialog() {
  return {
    open: vi.fn(() => Promise.resolve(null as string | string[] | null)),
    save: vi.fn(() => Promise.resolve(null as string | null)),
    message: vi.fn(() => Promise.resolve()),
    ask: vi.fn(() => Promise.resolve(false)),
    confirm: vi.fn(() => Promise.resolve(false)),
    
    mockClear: () => {
      mockDialog.open.mockClear();
      mockDialog.save.mockClear();
      mockDialog.message.mockClear();
      mockDialog.ask.mockClear();
      mockDialog.confirm.mockClear();
    }
  };
  
  const mockDialog = {
    open: vi.fn(() => Promise.resolve(null as string | string[] | null)),
    save: vi.fn(() => Promise.resolve(null as string | null)),
    message: vi.fn(() => Promise.resolve()),
    ask: vi.fn(() => Promise.resolve(false)),
    confirm: vi.fn(() => Promise.resolve(false)),
    
    mockClear: () => {
      mockDialog.open.mockClear();
      mockDialog.save.mockClear();
      mockDialog.message.mockClear();
      mockDialog.ask.mockClear();
      mockDialog.confirm.mockClear();
    }
  };
  
  return mockDialog;
}

/**
 * Mock Tauri shell API
 */
export function createMockShell() {
  const processes = new Map<number, any>();
  let nextPid = 1;
  
  return {
    Command: vi.fn().mockImplementation((program: string, args?: string[]) => {
      const pid = nextPid++;
      const proc = {
        program,
        args: args || [],
        stdout: vi.fn(),
        stderr: vi.fn(),
        spawn: vi.fn(() => {
          processes.set(pid, proc);
          return Promise.resolve({ pid });
        }),
        execute: vi.fn(() => {
          return Promise.resolve({
            code: 0,
            signal: null,
            stdout: '',
            stderr: ''
          });
        }),
        kill: vi.fn(() => {
          processes.delete(pid);
          return Promise.resolve();
        })
      };
      return proc;
    }),
    
    open: vi.fn((url: string) => Promise.resolve()),
    
    mockClear: () => {
      mockShell.Command.mockClear();
      mockShell.open.mockClear();
    },
    
    mockReset: () => {
      processes.clear();
      nextPid = 1;
      mockShell.mockClear();
    },
    
    mockGetProcess: (pid: number) => processes.get(pid)
  };
  
  const mockShell = {
    Command: vi.fn().mockImplementation((program: string, args?: string[]) => {
      const pid = nextPid++;
      const proc = {
        program,
        args: args || [],
        stdout: vi.fn(),
        stderr: vi.fn(),
        spawn: vi.fn(() => {
          processes.set(pid, proc);
          return Promise.resolve({ pid });
        }),
        execute: vi.fn(() => {
          return Promise.resolve({
            code: 0,
            signal: null,
            stdout: '',
            stderr: ''
          });
        }),
        kill: vi.fn(() => {
          processes.delete(pid);
          return Promise.resolve();
        })
      };
      return proc;
    }),
    
    open: vi.fn(() => Promise.resolve()),
    
    mockClear: () => {
      mockShell.Command.mockClear();
      mockShell.open.mockClear();
    },
    
    mockReset: () => {
      processes.clear();
      nextPid = 1;
      mockShell.mockClear();
    },
    
    mockGetProcess: (pid: number) => processes.get(pid)
  };
  
  return mockShell;
}

/**
 * Mock Tauri clipboard API
 */
export function createMockClipboard() {
  let clipboardContent = '';
  
  return {
    readText: vi.fn(() => Promise.resolve(clipboardContent)),
    writeText: vi.fn((text: string) => {
      clipboardContent = text;
      return Promise.resolve();
    }),
    
    mockClear: () => {
      mockClipboard.readText.mockClear();
      mockClipboard.writeText.mockClear();
    },
    
    mockReset: () => {
      clipboardContent = '';
      mockClipboard.mockClear();
    },
    
    mockGetContent: () => clipboardContent
  };
  
  const mockClipboard = {
    readText: vi.fn(() => Promise.resolve(clipboardContent)),
    writeText: vi.fn((text: string) => {
      clipboardContent = text;
      return Promise.resolve();
    }),
    
    mockClear: () => {
      mockClipboard.readText.mockClear();
      mockClipboard.writeText.mockClear();
    },
    
    mockReset: () => {
      clipboardContent = '';
      mockClipboard.mockClear();
    },
    
    mockGetContent: () => clipboardContent
  };
  
  return mockClipboard;
}

/**
 * Mock Tauri invoke function
 */
export function createMockInvoke() {
  const handlers = new Map<string, Function>();
  
  const mockInvoke = vi.fn((command: string, args?: any) => {
    const handler = handlers.get(command);
    if (handler) {
      return handler(args);
    }
    return Promise.reject(new Error(`No handler for command: ${command}`));
  });

  mockInvoke.mockImplementation = (command: string, handler: Function) => {
    handlers.set(command, handler);
  };

  // Store the original mock methods to avoid circular reference
  const originalMockClear = vi.mocked(mockInvoke).mockClear;
  const originalMockReset = vi.mocked(mockInvoke).mockReset;

  mockInvoke.mockClear = () => {
    originalMockClear();
  };

  mockInvoke.mockReset = () => {
    handlers.clear();
    originalMockReset();
  };

  return mockInvoke;
}

/**
 * Create a complete mock Tauri API
 */
export function createMockTauri() {
  const mockWindow = createMockWindow();
  const mockFs = createMockFs();
  const mockDialog = createMockDialog();
  const mockShell = createMockShell();
  const mockClipboard = createMockClipboard();
  const mockInvoke = createMockInvoke();
  
  return {
    window: mockWindow,
    fs: mockFs,
    dialog: mockDialog,
    shell: mockShell,
    clipboard: mockClipboard,
    invoke: mockInvoke,
    
    mockClear: () => {
      mockWindow.appWindow.mockClear();
      mockFs.mockClear();
      mockDialog.mockClear();
      mockShell.mockClear();
      mockClipboard.mockClear();
      mockInvoke.mockClear();
    },
    
    mockReset: () => {
      mockWindow.appWindow.mockReset();
      mockFs.mockReset();
      mockShell.mockReset();
      mockClipboard.mockReset();
      mockInvoke.mockReset();
    }
  };
}

/**
 * Setup Tauri mocks in global scope
 */
export function setupTauriMocks() {
  const tauri = createMockTauri();
  
  // Set up global mocks
  (global as any).__TAURI__ = tauri;
  (global as any).window.__TAURI__ = tauri;
  
  return tauri;
}