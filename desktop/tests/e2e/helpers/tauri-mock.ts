/**
 * Tauri API Mock for E2E Tests
 * Provides browser-compatible mocks for Tauri APIs
 */

export interface TauriMockConfig {
  flows?: any[];
  files?: Record<string, string>;
  settings?: Record<string, any>;
}

export function createTauriMock(config: TauriMockConfig = {}) {
  const mockFiles = config.files || {};
  const mockFlows = config.flows || [
    { id: 1, name: 'Test Flow', description: 'E2E test flow' }
  ];
  const mockSettings = config.settings || {};

  // Mock Tauri invoke function
  const mockInvoke = async (cmd: string, args?: any) => {
    console.log(`[TauriMock] invoke called: ${cmd}`, args);
    
    switch (cmd) {
      case 'get_flows':
        return mockFlows;
      
      case 'create_flow':
        const newFlow = { 
          id: mockFlows.length + 1, 
          ...args,
          created_at: new Date().toISOString()
        };
        mockFlows.push(newFlow);
        return newFlow;
      
      case 'update_flow':
        const flowIndex = mockFlows.findIndex(f => f.id === args.id);
        if (flowIndex >= 0) {
          mockFlows[flowIndex] = { ...mockFlows[flowIndex], ...args };
          return mockFlows[flowIndex];
        }
        throw new Error(`Flow ${args.id} not found`);
      
      case 'delete_flow':
        const deleteIndex = mockFlows.findIndex(f => f.id === args.id);
        if (deleteIndex >= 0) {
          mockFlows.splice(deleteIndex, 1);
          return true;
        }
        return false;
      
      case 'run_flow':
        return {
          id: args.flowId,
          status: 'running',
          started_at: new Date().toISOString()
        };
      
      case 'get_terminal_output':
        return 'Mock terminal output\n';
      
      case 'read_file':
        if (mockFiles[args.path]) {
          return mockFiles[args.path];
        }
        throw new Error(`File not found: ${args.path}`);
      
      case 'write_file':
        mockFiles[args.path] = args.content;
        return true;
      
      case 'file_exists':
        return mockFiles.hasOwnProperty(args.path);
      
      case 'git_status':
        return {
          modified: ['src/main.js'],
          staged: [],
          untracked: []
        };
      
      case 'git_commit':
        return {
          hash: 'abc123',
          message: args.message,
          timestamp: new Date().toISOString()
        };
      
      case 'get_app_version':
        return '1.0.0-e2e';
      
      case 'get_settings':
        return mockSettings;
      
      case 'update_settings':
        Object.assign(mockSettings, args);
        return mockSettings;
      
      default:
        console.warn(`[TauriMock] Unhandled command: ${cmd}`);
        return null;
    }
  };

  // Mock other Tauri APIs
  const mockTauri = {
    invoke: mockInvoke,
    convertFileSrc: (src: string) => src,
    transformCallback: () => {},
    
    // Event system mock
    event: {
      listen: (event: string, handler: Function) => {
        console.log(`[TauriMock] Event listener registered: ${event}`);
        return Promise.resolve(() => {});
      },
      emit: (event: string, payload?: any) => {
        console.log(`[TauriMock] Event emitted: ${event}`, payload);
        return Promise.resolve();
      }
    },

    // FS mock
    fs: {
      readTextFile: (path: string) => {
        if (mockFiles[path]) {
          return Promise.resolve(mockFiles[path]);
        }
        return Promise.reject(new Error(`File not found: ${path}`));
      },
      writeTextFile: (path: string, content: string) => {
        mockFiles[path] = content;
        return Promise.resolve();
      },
      exists: (path: string) => {
        return Promise.resolve(mockFiles.hasOwnProperty(path));
      }
    },

    // Shell mock
    shell: {
      Command: class MockCommand {
        private cmd: string;
        private args: string[];
        
        constructor(cmd: string, args: string[] = []) {
          this.cmd = cmd;
          this.args = args;
        }
        
        async execute() {
          return {
            code: 0,
            stdout: `Mock output for: ${this.cmd} ${this.args.join(' ')}`,
            stderr: ''
          };
        }
      }
    },

    // Window mock
    window: {
      appWindow: {
        listen: (event: string, handler: Function) => {
          console.log(`[TauriMock] Window listener registered: ${event}`);
          return Promise.resolve(() => {});
        },
        emit: (event: string, payload?: any) => {
          console.log(`[TauriMock] Window event emitted: ${event}`, payload);
          return Promise.resolve();
        },
        setTitle: (title: string) => {
          document.title = title;
          return Promise.resolve();
        }
      }
    }
  };

  return mockTauri;
}

export function installTauriMock(config: TauriMockConfig = {}) {
  const mock = createTauriMock(config);
  
  // Install on window object
  (window as any).__TAURI__ = mock;
  (window as any).__TAURI_INTERNALS__ = {
    invoke: mock.invoke,
    transformCallback: mock.transformCallback
  };

  console.log('[TauriMock] Tauri mock installed');
  return mock;
}

export function uninstallTauriMock() {
  delete (window as any).__TAURI__;
  delete (window as any).__TAURI_INTERNALS__;
  console.log('[TauriMock] Tauri mock uninstalled');
}

// Auto-install detection script
export const AUTO_INSTALL_SCRIPT = `
// Auto-install Tauri mock if not in actual Tauri environment
if (typeof window !== 'undefined' && !window.__TAURI__) {
  ${installTauriMock.toString()}
  ${createTauriMock.toString()}
  
  window.__tauriMock = installTauriMock();
  console.log('[TauriMock] Auto-installed Tauri mock for E2E testing');
}
`;