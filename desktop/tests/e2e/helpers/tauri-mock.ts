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
  const mockTerminals = new Map();
  const mockSessions = [];
  const mockPanes = [];

  // Mock Tauri invoke function
  const mockInvoke = async (cmd: string, args?: any) => {
    console.log(`[TauriMock] invoke called: ${cmd}`, args);
    
    switch (cmd) {
      // Flow management
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
      
      // Terminal management
      case 'create_streaming_terminal':
        const terminal = {
          id: args.terminal_id,
          title: `Terminal ${args.terminal_id}`,
          shell: args.shell || '/bin/bash',
          rows: args.rows || 24,
          cols: args.cols || 80,
          created_at: new Date().toISOString(),
          last_activity: new Date().toISOString(),
          process_id: Math.floor(Math.random() * 10000)
        };
        mockTerminals.set(args.terminal_id, terminal);
        return terminal;
      
      case 'send_terminal_input':
      case 'send_terminal_key':
        if (mockTerminals.has(args.terminal_id)) {
          mockTerminals.get(args.terminal_id).last_activity = new Date().toISOString();
          return true;
        }
        return false;
      
      case 'resize_streaming_terminal':
        if (mockTerminals.has(args.terminal_id)) {
          const resizeTerminal = mockTerminals.get(args.terminal_id);
          resizeTerminal.rows = args.rows;
          resizeTerminal.cols = args.cols;
          return true;
        }
        return false;
      
      case 'clear_terminal_scrollback':
      case 'stop_streaming_terminal':
        return mockTerminals.delete(args.terminal_id);
      
      case 'get_terminal_state':
        const stateTerminal = mockTerminals.get(args.terminal_id);
        if (!stateTerminal) return null;
        return {
          id: stateTerminal.id,
          rows: stateTerminal.rows,
          cols: stateTerminal.cols,
          cursor: { x: 0, y: 0, visible: true, blinking: true },
          mode: 'normal',
          title: stateTerminal.title,
          active: true,
          last_activity: stateTerminal.last_activity
        };
      
      case 'get_terminal_output':
        return 'Mock terminal output\n';
      
      // File operations
      case 'read_file':
        if (mockFiles[args.path]) {
          return mockFiles[args.path];
        }
        throw new Error(`File not found: ${args.path}`);
      
      case 'write_file':
      case 'save_file':
        mockFiles[args.path] = args.content;
        return true;
      
      case 'file_exists':
        return mockFiles.hasOwnProperty(args.path);
      
      case 'list_directory':
        // Return a properly formatted array that supports sort
        const entries = [
          { name: 'file1.txt', path: `${args.path}/file1.txt`, is_dir: false, size: 1024 },
          { name: 'file2.js', path: `${args.path}/file2.js`, is_dir: false, size: 2048 },
          { name: 'subfolder', path: `${args.path}/subfolder`, is_dir: true, size: 0 }
        ];
        return entries;
      
      case 'get_current_dir':
        return '/home/user/projects';
      
      case 'create_file':
        mockFiles[args.path] = args.content || '';
        return true;
      
      // Git operations
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
      
      // Manager operations
      case 'manager_execute':
      case 'manager_subscribe':
        return true;
      
      case 'get_sessions':
        return mockSessions;
      
      case 'get_session':
        return mockSessions.find(s => s.id === args.session_id) || null;
      
      case 'get_panes':
        return mockPanes.filter(p => p.session_id === args.session_id);
      
      case 'get_pane':
        return mockPanes.find(p => p.id === args.pane_id) || null;
      
      case 'select_backend_pane':
      case 'persist_state':
        return true;
      
      // Plugin management
      case 'list_plugins':
      case 'get_plugins':
      case 'get_plugin_statuses':
      case 'load_plugins':
      case 'load_plugin_statuses':
        return [
          { 
            id: 'test-plugin',
            name: 'test-plugin', 
            status: 'active', 
            version: '1.0.0', 
            enabled: true,
            loaded: true
          }
        ];
      
      case 'get_plugin_metadata':
        return {
          id: args.plugin_id,
          name: args.plugin_id,
          version: '1.0.0',
          description: 'Test plugin'
        };
      
      // Module operations
      case 'module_scan':
      case 'module_list':
        return [
          { name: 'test-module', enabled: true, version: '1.0.0' }
        ];
      
      case 'module_enable':
      case 'module_execute':
        return true;
      
      // Layout operations
      case 'create_layout':
      case 'get_layout':
        return { id: 'layout-1', session_id: args.sessionId, panes: [] };
      
      case 'split_layout_pane':
      case 'close_layout_pane':
      case 'resize_layout_pane':
        return true;
      
      case 'get_layout_leaf_panes':
        return [];
      
      // Test results
      case 'get_test_history':
        return [];
      
      // Security operations
      case 'update_terminal_security_tier':
      case 'trust_workspace':
      case 'import_security_configuration':
        return true;
      
      // Command history
      case 'get_command_history':
        return [];
      
      case 'search_command_history':
        return [];
      
      // File watching
      case 'watch_file':
      case 'unwatch_file':
        return true;
      
      // App info
      case 'get_app_version':
        return '1.0.0-e2e';
      
      case 'get_settings':
        return mockSettings;
      
      case 'update_settings':
        Object.assign(mockSettings, args);
        return mockSettings;
      
      // Tmux operations
      case 'tmux_create_session':
      case 'tmux_list_sessions':
      case 'tmux_create_pane':
      case 'tmux_send_keys':
      case 'tmux_capture_pane':
      case 'tmux_resize_pane':
      case 'tmux_kill_pane':
        return true;
      
      // Process operations
      case 'get_terminal_process_info':
        return {
          pid: 1234,
          name: 'bash',
          command: '/bin/bash',
          status: { Running: null }
        };
      
      case 'monitor_terminal_health':
        return {
          terminal_id: args.terminal_id,
          status: { type: 'Healthy' },
          process_info: {
            pid: 1234,
            name: 'bash',
            command: '/bin/bash',
            status: { Running: null }
          },
          last_activity: new Date().toISOString(),
          uptime_seconds: 3600
        };
      
      case 'restart_terminal_process':
      case 'broadcast_terminal_input':
        return true;
      
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
      listen: (event: string, _handler: Function) => {
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
        listen: (event: string, _handler: (...args: any[]) => any) => {
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
        },
        show: () => Promise.resolve(),
        hide: () => Promise.resolve(),
        minimize: () => Promise.resolve(),
        maximize: () => Promise.resolve(),
        unmaximize: () => Promise.resolve(),
        isMaximized: () => Promise.resolve(false),
        close: () => Promise.resolve()
      },
      currentWindow: () => ({
        listen: (event: string, _handler: (...args: any[]) => any) => {
          console.log(`[TauriMock] Current window listener registered: ${event}`);
          return Promise.resolve(() => {});
        },
        emit: (event: string, payload?: any) => {
          console.log(`[TauriMock] Current window event emitted: ${event}`, payload);
          return Promise.resolve();
        },
        setTitle: (title: string) => {
          document.title = title;
          return Promise.resolve();
        },
        show: () => Promise.resolve(),
        hide: () => Promise.resolve(),
        minimize: () => Promise.resolve(),
        maximize: () => Promise.resolve(),
        unmaximize: () => Promise.resolve(),
        isMaximized: () => Promise.resolve(false),
        close: () => Promise.resolve()
      })
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