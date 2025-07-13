import { vi } from 'vitest';
import { mockRegistry, createMock } from './utils/mock-registry';
import './setup';

/**
 * Integration Test Setup
 * 
 * Sets up environment for integration tests that test interactions
 * between multiple components and Tauri APIs
 */

// Initialize real Tauri API mocks with proper behavior
const tauriAPI = createMock.api('tauri-integration', {
  invoke: async (cmd: string, args?: any) => {
    // Simulate real Tauri command responses
    switch (cmd) {
      case 'get_flows':
        return [
          { id: 1, name: 'Test Flow', description: 'Integration test flow' }
        ];
      case 'create_flow':
        return { id: 2, ...args };
      case 'update_flow':
        return { ...args, updated_at: new Date().toISOString() };
      case 'delete_flow':
        return true;
      case 'run_flow':
        return { 
          id: args.flowId, 
          status: 'running',
          started_at: new Date().toISOString() 
        };
      case 'get_terminal_output':
        return 'Terminal output for integration test\n';
      case 'git_status':
        return { 
          modified: ['/project/src/main.js'],
          staged: [],
          untracked: [] 
        };
      case 'git_add_all':
        return true;
      case 'git_commit':
        return { 
          hash: 'abc123',
          sha: 'abc123',
          message: args.message,
          timestamp: new Date().toISOString()
        };
      default:
        return null;
    }
  }
}, { tags: ['integration', 'tauri'] });

// Enhanced file system mocks for integration tests
const fileSystemMock = createMock.module('fs-integration', () => {
  const fileStore = new Map<string, Uint8Array>();
  
  return {
    readFile: vi.fn(async (path: string) => {
      if (fileStore.has(path)) {
        return fileStore.get(path)!;
      }
      throw new Error(`File not found: ${path}`);
    }),
    
    writeFile: vi.fn(async (path: string, data: Uint8Array) => {
      fileStore.set(path, data);
    }),
    
    exists: vi.fn(async (path: string) => {
      return fileStore.has(path);
    }),
    
    createDir: vi.fn(async (path: string) => {}),
    
    readDir: vi.fn(async (path: string) => {
      const entries = [];
      for (const [filePath] of fileStore) {
        if (filePath.startsWith(path)) {
          entries.push({
            name: filePath.split('/').pop()!,
            path: filePath
          });
        }
      }
      return entries;
    }),
    
    // Test helper to populate files
    _setFile: (path: string, content: string) => {
      fileStore.set(path, new TextEncoder().encode(content));
    },
    
    _clear: () => {
      fileStore.clear();
    }
  };
}, { tags: ['integration', 'filesystem'] });

// Mock terminal with realistic behavior
const terminalMock = createMock.api('terminal-integration', {
  spawn: vi.fn(() => {
    const listeners = new Map<string, Set<Function>>();
    let processRunning = true;
    
    return {
      on: (event: string, handler: Function) => {
        if (!listeners.has(event)) {
          listeners.set(event, new Set());
        }
        listeners.get(event)!.add(handler);
      },
      
      write: (data: string) => {
        // Simulate command execution
        setTimeout(() => {
          if (processRunning) {
            const output = `Executing: ${data}\nOutput from command\n`;
            listeners.get('data')?.forEach(handler => handler(output));
          }
        }, 100);
      },
      
      kill: () => {
        processRunning = false;
        listeners.get('close')?.forEach(handler => handler(0));
      }
    };
  })
}, { tags: ['integration', 'terminal'] });

// Store mocks for integration testing
const storeMocks = {
  flows: createMock.store('flows-store', {
    subscribe: vi.fn((handler: Function) => {
      handler([
        { id: 1, name: 'Test Flow', description: 'Integration test flow' }
      ]);
      return () => {};
    }),
    set: vi.fn(),
    update: vi.fn()
  }, [], { tags: ['integration', 'store'] }),
  
  terminal: createMock.store('terminal-store', {
    subscribe: vi.fn((handler: Function) => {
      handler({ output: '', isRunning: false });
      return () => {};
    }),
    set: vi.fn(),
    update: vi.fn()
  }, { output: '', isRunning: false }, { tags: ['integration', 'store'] })
};

// Replace module mocks for integration tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: tauriAPI.invoke,
  convertFileSrc: vi.fn((src: string) => src),
  transformCallback: vi.fn(),
  isTauri: vi.fn(() => true),
}));

vi.mock('@tauri-apps/plugin-fs', () => fileSystemMock);

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: vi.fn(() => terminalMock.spawn())
}));

// Setup hooks for integration tests
beforeEach(() => {
  // Clear file system before each test
  fileSystemMock._clear();
  
  // Reset all mocks
  mockRegistry.reset();
  
  // Create snapshot for test isolation
  mockRegistry.createSnapshot('integration-test');
});

afterEach(() => {
  // Restore snapshot
  mockRegistry.restoreSnapshot('integration-test');
  mockRegistry.deleteSnapshot('integration-test');
});

// Export for use in tests
export {
  tauriAPI,
  fileSystemMock,
  terminalMock,
  storeMocks
};