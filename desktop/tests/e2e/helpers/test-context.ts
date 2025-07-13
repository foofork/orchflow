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
      // Install Tauri mock if not already present
      if (typeof window !== 'undefined' && !window.__TAURI__) {
        const mockInvoke = async (cmd, args) => {
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
              // Return array that supports filter method
              const plugins = [
                { name: 'test-plugin', status: 'active', version: '1.0.0' }
              ];
              return plugins;
            
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
              // Return array that supports sort method
              const entries = [
                { name: 'test-file.txt', type: 'file', size: 1024 },
                { name: 'test-folder', type: 'directory', size: 0 }
              ];
              return entries;
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
            
            // Workspace operations  
            case 'get_workspace_info':
              return {
                path: '/mock/workspace',
                name: 'E2E Test Workspace'
              };
            
            default:
              console.warn(`[TauriMock] Unhandled command: ${cmd}`);
              // Return empty object instead of null to prevent null reference errors
              return {};
          }
        };

        const mockTransformCallback = (callback) => callback;

        // Mock the window object for Tauri app
        window.__TAURI__ = { 
          invoke: mockInvoke,
          convertFileSrc: (src) => src,
          transformCallback: mockTransformCallback
        };
        window.__TAURI_INTERNALS__ = { 
          invoke: mockInvoke,
          transformCallback: mockTransformCallback
        };
        
        // Mock Tauri app window API
        window.__TAURI_METADATA__ = {
          __currentWindow: {
            label: 'main',
            currentWindow: () => ({
              label: 'main',
              isFullscreen: () => Promise.resolve(false),
              setFullscreen: (fullscreen) => Promise.resolve(),
              listen: (event, handler) => Promise.resolve(() => {}),
              emit: (event, payload) => Promise.resolve()
            })
          }
        };
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