/**
 * Mock Validation Tests
 * Ensures all Tauri API mocks are working correctly
 */

import { test, expect } from 'vitest';
import { TestContext } from '../helpers/test-context';
import { TestDataSetup } from '../helpers/test-data-setup';

describe('Tauri Mock Validation', () => {
  let testContext: TestContext;
  let testDataSetup: TestDataSetup;

  beforeEach(async () => {
    testContext = new TestContext({ headless: true });
    await testContext.setup();
    
    const { page } = await testContext.createPage();
    testDataSetup = new TestDataSetup(page);
  });

  afterEach(async () => {
    await testContext.teardown();
  });

  test('should mock basic Tauri invoke calls', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    // Test basic Tauri invoke calls
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri) return { error: 'Tauri not available' };
      
      try {
        const flows = await tauri.invoke('get_flows');
        const version = await tauri.invoke('get_app_version');
        const settings = await tauri.invoke('get_settings');
        
        return {
          flows,
          version,
          settings,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.flows).toBeInstanceOf(Array);
    expect(result.version).toBe('1.0.0-e2e');
    expect(result.settings).toBeInstanceOf(Object);
  });

  test('should mock terminal operations', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri) return { error: 'Tauri not available' };
      
      try {
        const terminalId = 'test-terminal-1';
        
        // Create terminal
        const terminal = await tauri.invoke('create_streaming_terminal', {
          terminal_id: terminalId,
          shell: '/bin/bash',
          rows: 24,
          cols: 80
        });
        
        // Get terminal state
        const state = await tauri.invoke('get_terminal_state', {
          terminal_id: terminalId
        });
        
        // Send input
        const inputResult = await tauri.invoke('send_terminal_input', {
          terminal_id: terminalId,
          input: 'echo "hello"'
        });
        
        return {
          terminal,
          state,
          inputResult,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.terminal.id).toBe('test-terminal-1');
    expect(result.terminal.shell).toBe('/bin/bash');
    expect(result.state.id).toBe('test-terminal-1');
    expect(result.state.mode).toBe('normal');
    expect(result.inputResult).toBe(true);
  });

  test('should mock file operations', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri) return { error: 'Tauri not available' };
      
      try {
        // List directory
        const entries = await tauri.invoke('list_directory', {
          path: '/test'
        });
        
        // Get current directory
        const currentDir = await tauri.invoke('get_current_dir');
        
        // Create file
        const createResult = await tauri.invoke('create_file', {
          path: '/test/new-file.txt',
          content: 'test content'
        });
        
        return {
          entries,
          currentDir,
          createResult,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.entries).toBeInstanceOf(Array);
    expect(result.entries.length).toBeGreaterThan(0);
    expect(result.currentDir).toBe('/home/user/projects');
    expect(result.createResult).toBe(true);
  });

  test('should mock WebSocket connections', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      return new Promise((resolve) => {
        try {
          const ws = new WebSocket('ws://localhost:50505');
          
          ws.onopen = () => {
            resolve({
              connected: true,
              readyState: ws.readyState,
              success: true
            });
          };
          
          ws.onerror = (error) => {
            resolve({
              connected: false,
              error: error.toString(),
              success: false
            });
          };
          
          // Timeout after 1 second
          setTimeout(() => {
            resolve({
              connected: false,
              error: 'Connection timeout',
              success: false
            });
          }, 1000);
        } catch (error: any) {
          resolve({
            connected: false,
            error: (error as Error).message,
            success: false
          });
        }
      });
    });

    // The mock should handle WebSocket connections without errors
    expect((result as any).success).toBe(true);
    expect((result as any).connected).toBe(true);
  });

  test('should mock window operations', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      try {
        const tauri = (window as any).__TAURI__;
        if (!tauri) return { error: 'Tauri not available' };
        
        // Test window operations
        await tauri.window.appWindow.setTitle('Test Title');
        await tauri.window.appWindow.show();
        
        // Test current window
        const currentWindow = tauri.window.currentWindow();
        await currentWindow.setTitle('Current Window Title');
        
        return {
          windowAvailable: !!tauri.window.appWindow,
          currentWindowAvailable: !!currentWindow,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.windowAvailable).toBe(true);
    expect(result.currentWindowAvailable).toBe(true);
  });

  test('should handle comprehensive test data setup', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    // Setup comprehensive test data
    const testData = await testDataSetup.setupComprehensiveData();
    
    // Validate the test data was created correctly
    expect(testData.user.id).toBeDefined();
    expect(testData.user.username).toBe('e2e-test-user');
    expect(testData.project.name).toBe('E2E Test Project');
    expect(testData.terminal.title).toBe('E2E Test Terminal');
    expect(testData.flow.name).toBe('E2E Test Flow');
    expect(testData.files.length).toBe(3);
    
    // Validate test data was installed in page
    const pageTestData = await page.evaluate(() => {
      return (window as any).__E2E_TEST_DATA__;
    });
    
    expect(pageTestData).toBeDefined();
    expect(pageTestData.users.length).toBe(1);
    expect(pageTestData.projects.length).toBe(1);
    expect(pageTestData.terminals.length).toBe(1);
    expect(pageTestData.flows.length).toBe(1);
    
    // Validate test data consistency
    const validation = testDataSetup.validateTestData();
    expect(validation.valid).toBe(true);
    expect(validation.errors.length).toBe(0);
  });

  test('should handle plugin operations', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri) return { error: 'Tauri not available' };
      
      try {
        const plugins = await tauri.invoke('list_plugins');
        const pluginStatuses = await tauri.invoke('get_plugin_statuses');
        
        return {
          plugins,
          pluginStatuses,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.plugins).toBeInstanceOf(Array);
    expect(result.plugins.length).toBeGreaterThan(0);
    expect(result.pluginStatuses).toBeInstanceOf(Array);
    expect(result.pluginStatuses.length).toBeGreaterThan(0);
  });

  test('should mock git operations', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto(testContext.baseUrl);
    
    const result = await page.evaluate(async () => {
      const tauri = (window as any).__TAURI__;
      if (!tauri) return { error: 'Tauri not available' };
      
      try {
        const status = await tauri.invoke('git_status');
        const commit = await tauri.invoke('git_commit', {
          message: 'Test commit'
        });
        
        return {
          status,
          commit,
          success: true
        };
      } catch (error: any) {
        return { error: error.message };
      }
    });

    expect(result.success).toBe(true);
    expect(result.status).toHaveProperty('modified');
    expect(result.status).toHaveProperty('staged');
    expect(result.status).toHaveProperty('untracked');
    expect(result.commit).toHaveProperty('hash');
    expect(result.commit).toHaveProperty('message');
    expect(result.commit.message).toBe('Test commit');
  });
});