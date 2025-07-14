/**
 * Test Context Manager for E2E Tests
 * Provides isolated test environments with unique ports and data directories
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { PortManager } from '../../../scripts/port-manager.js';
import { DevServerManager, createDevServer } from './dev-server.js';
import { installTauriMock, type TauriMockConfig } from './tauri-mock.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

export interface TestContextOptions {
  headless?: boolean;
  slowMo?: number;
  video?: boolean;
  trace?: boolean;
  viewport?: { width: number; height: number };
  tauriMock?: TauriMockConfig;
}

export class TestContext {
  private browser?: Browser;
  private context?: BrowserContext;
  private port?: number;
  private dataDir?: string;
  private pages: Page[] = [];
  private devServer?: DevServerManager;
  
  public baseUrl: string = '';
  
  constructor(private options: TestContextOptions = {}) {
    this.options = {
      headless: true, // Always use headless mode in test environment
      slowMo: 0,
      video: false,
      trace: false,
      viewport: { width: 1280, height: 720 },
      ...options
    };
  }
  
  async setup() {
    // Allocate unique port
    const portManager = PortManager.getInstance();
    this.port = await portManager.allocatePort();
    this.baseUrl = `http://localhost:${this.port}`;
    
    // Start dev server on allocated port
    console.log(`🔧 Setting up test context with port ${this.port}`);
    this.devServer = await createDevServer({ port: this.port });
    
    // Create isolated data directory
    this.dataDir = path.join(tmpdir(), `orchflow-test-${Date.now()}-${Math.random().toString(36).substring(7)}`);
    await fs.mkdir(this.dataDir, { recursive: true });
    
    // Launch browser with persistent context
    this.context = await chromium.launchPersistentContext(this.dataDir, {
      headless: this.options.headless,
      slowMo: this.options.slowMo,
      viewport: this.options.viewport,
      recordVideo: this.options.video ? { dir: './test-results/videos' } : undefined,
      ignoreHTTPSErrors: true,
      locale: 'en-US',
      timezoneId: 'UTC',
      permissions: ['clipboard-read', 'clipboard-write'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });
    
    // No separate browser instance when using persistent context
    
    if (this.options.trace) {
      await this.context.tracing.start({
        screenshots: true,
        snapshots: true,
        sources: true
      });
    }
  }
  
  async teardown() {
    console.log(`🧹 Tearing down test context (port: ${this.port})...`);
    
    // Close all pages first
    for (const page of this.pages) {
      try {
        await page.close();
      } catch (error) {
        console.error('Error closing page:', error);
      }
    }
    this.pages = [];
    
    // Stop tracing if enabled
    if (this.options.trace && this.context) {
      try {
        await this.context.tracing.stop({
          path: `./test-results/traces/trace-${Date.now()}.zip`
        });
      } catch (error) {
        console.error('Error stopping trace:', error);
      }
    }
    
    // Close context (browser closes automatically with persistent context)
    try {
      await this.context?.close();
    } catch (error) {
      console.error('Error closing context:', error);
    }
    this.context = undefined;
    
    // Stop dev server with error handling
    if (this.devServer) {
      try {
        await this.devServer.stop();
      } catch (error) {
        console.error('Error stopping dev server:', error);
      }
      this.devServer = undefined;
    }
    
    // Clean up data directory
    if (this.dataDir) {
      try {
        await fs.rm(this.dataDir, { recursive: true, force: true });
      } catch (error) {
        console.error('Error cleaning data directory:', error);
      }
      this.dataDir = undefined;
    }
    
    // Release port
    if (this.port) {
      try {
        const portManager = PortManager.getInstance();
        await portManager.releasePort(this.port);
      } catch (error) {
        console.error('Error releasing port:', error);
      }
      this.port = undefined;
    }
    
    console.log(`✅ Test context teardown complete`);
  }
  
  async createPage(): Promise<{ page: Page; baseUrl: string }> {
    if (!this.context) {
      throw new Error('Context not initialized. Call setup() first.');
    }
    
    const page = await this.context.newPage();
    this.pages.push(page);
    
    // Install Tauri mock before navigating
    await page.addInitScript(() => {
      // Mock WebSocket to prevent connection errors
      class MockWebSocket {
        url: string;
        readyState: number = 1; // OPEN
        onopen: any = null;
        onclose: any = null;
        onerror: any = null;
        onmessage: any = null;
        
        constructor(url: string) {
          this.url = url;
          console.log(`[MockWebSocket] Creating WebSocket connection to ${url}`);
          setTimeout(() => {
            if (this.onopen) this.onopen(new Event('open'));
          }, 0);
        }
        
        send(data: any) {
          console.log(`[MockWebSocket] Sending:`, data);
        }
        
        close() {
          this.readyState = 3; // CLOSED
          if (this.onclose) this.onclose(new CloseEvent('close'));
        }
        
        addEventListener(event: string, handler: any) {
          if (event === 'open') this.onopen = handler;
          else if (event === 'close') this.onclose = handler;
          else if (event === 'error') this.onerror = handler;
          else if (event === 'message') this.onmessage = handler;
        }
        
        removeEventListener() {}
      }
      
      (window as any).WebSocket = MockWebSocket;
      
      // Install Tauri mock if not already present
      if (typeof window !== 'undefined' && !(window as any).__TAURI__) {
        const mockInvoke = async (cmd: string, args?: any) => {
          console.log(`[TauriMock] invoke called: ${cmd}`, args);
          
          switch (cmd) {
            // Flow management
            case 'get_flows':
              return [{ id: 1, name: 'Test Flow', description: 'E2E test flow' }];
            case 'create_flow':
              return { id: 2, ...args, created_at: new Date().toISOString() };
            
            // App info
            case 'get_app_version':
              return '1.0.0-e2e';
            case 'get_settings':
              return {};
            
            // Plugin management
            case 'get_plugin_statuses':
            case 'load_plugin_statuses':
            case 'get_plugins':
            case 'load_plugins':
            case 'list_plugins':
              // Return array that supports filter method
              const plugins = [
                { 
                  id: 'test-plugin',
                  name: 'test-plugin', 
                  status: 'active', 
                  version: '1.0.0', 
                  enabled: true,
                  loaded: true
                }
              ];
              // Ensure it's a proper array with all methods
              return Array.from(plugins);
            
            // Update management
            case 'check_for_updates':
              return { 
                available: false, 
                version: '1.0.0-e2e',
                current_version: '1.0.0-e2e'
              };
            
            // Session management
            case 'subscribe':
              return { success: true, data: [] };
            case 'get_sessions':
            case 'refresh_sessions':
              return [];
            case 'manager_client_subscribe':
              return { sessions: [] };
            case 'get_current_session':
              return { 
                id: 'e2e-session',
                name: 'E2E Test Session',
                active: true
              };
            
            // File system operations
            case 'read_directory':
            case 'load_directory':
            case 'read_file_tree':
            case 'get_directory_entries':
              // Return array that supports sort method
              const entries = [
                { name: 'test-file.txt', type: 'file', size: 1024, path: '/test-file.txt' },
                { name: 'test-folder', type: 'directory', size: 0, path: '/test-folder' }
              ];
              // Ensure it's a proper array with all methods
              return Array.from(entries);
            case 'read_file':
              return 'Mock file content';
            case 'write_file':
              return true;
            case 'file_exists':
              return true;
            
            // Git operations
            case 'git_status':
              return {
                modified: ['src/test.js'],
                staged: [],
                untracked: ['new-file.txt']
              };
            case 'git_commit':
              return {
                hash: 'abc123',
                message: args?.message || 'Test commit',
                timestamp: new Date().toISOString()
              };
            
            // Terminal operations
            case 'run_command':
            case 'execute_command':
              return {
                stdout: 'Mock command output',
                stderr: '',
                exit_code: 0
              };
            
            // Terminal streaming operations
            case 'create_streaming_terminal':
              return {
                id: args?.terminal_id || 'mock-terminal-1',
                title: `Terminal ${args?.terminal_id || '1'}`,
                shell: args?.shell || '/bin/bash',
                rows: args?.rows || 24,
                cols: args?.cols || 80,
                created_at: new Date().toISOString(),
                last_activity: new Date().toISOString(),
                process_id: Math.floor(Math.random() * 10000)
              };
            
            case 'send_terminal_input':
            case 'send_terminal_key':
            case 'resize_streaming_terminal':
            case 'clear_terminal_scrollback':
            case 'stop_streaming_terminal':
            case 'restart_terminal_process':
            case 'broadcast_terminal_input':
              return true;
              
            case 'get_terminal_state':
              return {
                id: args?.terminal_id || 'mock-terminal-1',
                rows: 24,
                cols: 80,
                cursor: { x: 0, y: 0, visible: true, blinking: true },
                mode: 'normal',
                title: 'Terminal',
                active: true,
                last_activity: new Date().toISOString()
              };
              
            case 'get_terminal_process_info':
              return {
                pid: 1234,
                name: 'bash',
                command: '/bin/bash',
                status: { Running: null }
              };
              
            case 'monitor_terminal_health':
              return {
                terminal_id: args?.terminal_id || 'mock-terminal-1',
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
            
            // Workspace operations  
            case 'get_workspace_info':
              return {
                path: '/mock/workspace',
                name: 'E2E Test Workspace'
              };
            case 'get_current_dir':
              return '/home/user/projects';
            
            // Manager operations
            case 'manager_execute':
            case 'manager_subscribe':
            case 'select_backend_pane':
            case 'persist_state':
              return true;
              
            case 'get_session':
              return null;
              
            case 'get_panes':
              return [];
              
            case 'get_pane':
              return null;
              
            // File operations
            case 'save_file':
            case 'create_file':
              return true;
              
            case 'list_directory':
              return [
                { name: 'file1.txt', path: `${args?.path || '.'}/file1.txt`, is_dir: false, size: 1024 },
                { name: 'file2.js', path: `${args?.path || '.'}/file2.js`, is_dir: false, size: 2048 },
                { name: 'subfolder', path: `${args?.path || '.'}/subfolder`, is_dir: true, size: 0 }
              ];
              
            case 'watch_file':
            case 'unwatch_file':
              return true;
              
            // Command history
            case 'get_command_history':
            case 'search_command_history':
              return [];
              
            // Module operations
            case 'module_scan':
            case 'module_list':
              return [{ name: 'test-module', enabled: true, version: '1.0.0' }];
              
            case 'module_enable':
            case 'module_execute':
              return true;
              
            // Layout operations
            case 'create_layout':
            case 'get_layout':
              return { id: 'layout-1', session_id: args?.sessionId || 'default', panes: [] };
              
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
              
            // Tmux operations
            case 'tmux_create_session':
            case 'tmux_list_sessions':
            case 'tmux_create_pane':
            case 'tmux_send_keys':
            case 'tmux_capture_pane':
            case 'tmux_resize_pane':
            case 'tmux_kill_pane':
              return true;
              
            case 'update_settings':
              return {};
            
            default:
              console.warn(`[TauriMock] Unhandled command: ${cmd}`);
              // Return empty object instead of null to prevent null reference errors
              return {};
          }
        };

        const mockTransformCallback = (callback: any) => callback;

        // Mock the window object for Tauri app
        (window as any).__TAURI__ = { 
          invoke: mockInvoke,
          convertFileSrc: (src: string) => src,
          transformCallback: mockTransformCallback
        };
        (window as any).__TAURI_INTERNALS__ = { 
          invoke: mockInvoke,
          transformCallback: mockTransformCallback
        };
        
        // Mock Tauri plugin-fs module
        if (!(window as any).__TAURI_PLUGIN_FS__) {
          (window as any).__TAURI_PLUGIN_FS__ = {
            readDir: async (path: string) => {
              // Return array with proper structure for FileExplorer
              const entries = [
                { 
                  name: 'test-file.txt', 
                  path: `${path}/test-file.txt`,
                  isDirectory: false,
                  isFile: true
                },
                { 
                  name: 'test-folder', 
                  path: `${path}/test-folder`,
                  isDirectory: true,
                  isFile: false
                }
              ];
              return Array.from(entries);
            }
          };
        }
        
        // Mock Tauri app window API
        (window as any).__TAURI_METADATA__ = {
          __currentWindow: {
            label: 'main',
            currentWindow: () => ({
              label: 'main',
              isFullscreen: () => Promise.resolve(false),
              setFullscreen: (_fullscreen: boolean) => Promise.resolve(),
              listen: (_event: string, _handler: any) => Promise.resolve(() => {}),
              emit: (_event: string, _payload?: any) => Promise.resolve()
            })
          }
        };
        
        // Mock window.currentWindow directly for components that access it
        if (!(window as any).currentWindow) {
          (window as any).currentWindow = () => ({
            label: 'main',
            listen: (_event: string, _handler: any) => Promise.resolve(() => {}),
            emit: (_event: string, _payload?: any) => Promise.resolve(),
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
          });
        }
        console.log('[TauriMock] Tauri mock installed for E2E testing');
      }
    });
    
    // Set up default event handlers
    page.on('pageerror', (error) => {
      console.error(`Page error: ${error.message}`);
    });
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`);
      }
    });
    
    return { page, baseUrl: this.baseUrl };
  }
  
  async reset() {
    // Close all pages except the first
    while (this.pages.length > 1) {
      const page = this.pages.pop();
      await page?.close();
    }
    
    // Clear cookies and local storage
    if (this.context) {
      await this.context.clearCookies();
      await this.context.clearPermissions();
    }
    
    // Navigate first page to blank
    if (this.pages[0]) {
      await this.pages[0].goto('about:blank');
    }
  }
  
  getPort(): number | undefined {
    return this.port;
  }
  
  getDataDir(): string | undefined {
    return this.dataDir;
  }
  
  async takeScreenshot(name: string) {
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      await page.screenshot({
        path: `./test-results/screenshots/${name}-page-${i}.png`,
        fullPage: true
      });
    }
  }
  
  async captureState(testName: string) {
    const stateDir = `./test-results/state/${testName}-${Date.now()}`;
    await fs.mkdir(stateDir, { recursive: true });
    
    // Screenshot all pages
    await this.takeScreenshot(`${stateDir}/screenshot`);
    
    // Save page content
    for (let i = 0; i < this.pages.length; i++) {
      const page = this.pages[i];
      const html = await page.content();
      await fs.writeFile(`${stateDir}/page-${i}.html`, html);
      
      // Save console logs
      const logs = await page.evaluate(() => {
        return (window as any).__consoleLogs || [];
      });
      await fs.writeFile(`${stateDir}/console-${i}.json`, JSON.stringify(logs, null, 2));
    }
  }
}

// Helper function for quick test setup
export async function withTestContext<T>(
  testFn: (context: TestContext) => Promise<T>,
  options?: TestContextOptions
): Promise<T> {
  const context = new TestContext(options);
  try {
    await context.setup();
    return await testFn(context);
  } finally {
    await context.teardown();
  }
}