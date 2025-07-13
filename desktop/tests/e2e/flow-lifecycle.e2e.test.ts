import { test, expect } from 'vitest';
import type { chromium, type Browser, type Page } from 'playwright';
import { PortManager } from '../../scripts/port-manager.js';

/**
 * End-to-End Tests for Flow Lifecycle
 * 
 * Tests complete user journeys through the application
 */

describe('Flow Lifecycle E2E Tests', () => {
  let browser: Browser;
  let page: Page;
  let portManager: PortManager;
  let testPort: number;
  let baseURL: string;

  beforeAll(async () => {
    // Initialize port manager and get dedicated E2E port
    portManager = new PortManager();
    await portManager.init();
    testPort = await portManager.findAvailablePort('e2e');
    baseURL = `http://localhost:${testPort}`;
    
    // Launch browser
    browser = await chromium.launch({ 
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser?.close();
    if (portManager && testPort) {
      await portManager.releasePort(testPort);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();
    
    // Set viewport for consistency
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Navigate to the application
    await page.goto(baseURL);
  });

  afterEach(async () => {
    await page?.close();
  });

  test('User can create a new flow', async () => {
    // Wait for app to load
    await page.waitForSelector('[data-testid="app-container"]', { timeout: 30000 });
    
    // Navigate to flows section
    await page.click('[data-testid="flows-tab"]');
    
    // Click create new flow button
    await page.click('[data-testid="create-flow-button"]');
    
    // Fill in flow details
    await page.fill('[data-testid="flow-name-input"]', 'E2E Test Flow');
    await page.fill('[data-testid="flow-description-input"]', 'A flow created during E2E testing');
    
    // Add a step to the flow
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type-select"]', 'command');
    await page.fill('[data-testid="step-command-input"]', 'echo "Hello from E2E test"');
    
    // Save the flow
    await page.click('[data-testid="save-flow-button"]');
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toHaveText('Flow saved successfully');
    
    // Verify flow appears in the list
    await expect(page.locator('[data-testid="flow-list"]')).toHaveText('E2E Test Flow');
  });

  test('User can execute a flow and see output', async () => {
    // Setup: Create a flow first
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Create a simple flow
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    await page.fill('[data-testid="flow-name-input"]', 'Execute Test Flow');
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type-select"]', 'command');
    await page.fill('[data-testid="step-command-input"]', 'echo "Test execution output"');
    await page.click('[data-testid="save-flow-button"]');
    
    // Execute the flow
    await page.click('[data-testid="flow-item"]:has-text("Execute Test Flow")');
    await page.click('[data-testid="run-flow-button"]');
    
    // Wait for execution to start
    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('Running');
    
    // Wait for execution to complete and verify output
    await expect(page.locator('[data-testid="terminal-output"]')).toHaveText('Test execution output', { timeout: 10000 });
    
    // Verify status changes to completed
    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('Completed');
  });

  test('User can edit an existing flow', async () => {
    // Setup: Create a flow
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    await page.fill('[data-testid="flow-name-input"]', 'Edit Test Flow');
    await page.click('[data-testid="save-flow-button"]');
    
    // Edit the flow
    await page.click('[data-testid="flow-item"]:has-text("Edit Test Flow")');
    await page.click('[data-testid="edit-flow-button"]');
    
    // Modify the flow
    await page.fill('[data-testid="flow-name-input"]', 'Edited Test Flow');
    await page.fill('[data-testid="flow-description-input"]', 'Updated description');
    
    // Add a step
    await page.click('[data-testid="add-step-button"]');
    await page.selectOption('[data-testid="step-type-select"]', 'command');
    await page.fill('[data-testid="step-command-input"]', 'echo "Edited flow output"');
    
    // Save changes
    await page.click('[data-testid="save-flow-button"]');
    
    // Verify changes
    await expect(page.locator('[data-testid="flow-list"]')).toHaveText('Edited Test Flow');
    await expect(page.locator('[data-testid="flow-description"]')).toHaveText('Updated description');
  });

  test('User can delete a flow', async () => {
    // Setup: Create a flow
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    await page.fill('[data-testid="flow-name-input"]', 'Delete Test Flow');
    await page.click('[data-testid="save-flow-button"]');
    
    // Delete the flow
    await page.click('[data-testid="flow-item"]:has-text("Delete Test Flow")');
    await page.click('[data-testid="delete-flow-button"]');
    
    // Confirm deletion
    await page.click('[data-testid="confirm-delete-button"]');
    
    // Verify flow is removed
    await expect(page.locator('[data-testid="flow-list"]')).not.toHaveText('Delete Test Flow');
    await expect(page.locator('[data-testid="success-message"]')).toHaveText('Flow deleted successfully');
  });

  test('User can navigate between different sections', async () => {
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Test navigation to flows
    await page.click('[data-testid="flows-tab"]');
    await expect(page.locator('[data-testid="flows-section"]')).toBeVisible();
    
    // Test navigation to terminal
    await page.click('[data-testid="terminal-tab"]');
    await expect(page.locator('[data-testid="terminal-section"]')).toBeVisible();
    
    // Test navigation to settings
    await page.click('[data-testid="settings-tab"]');
    await expect(page.locator('[data-testid="settings-section"]')).toBeVisible();
    
    // Return to flows
    await page.click('[data-testid="flows-tab"]');
    await expect(page.locator('[data-testid="flows-section"]')).toBeVisible();
  });

  test('Application handles errors gracefully', async () => {
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Try to create a flow with invalid data
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    
    // Leave name empty and try to save
    await page.click('[data-testid="save-flow-button"]');
    
    // Verify error message
    await expect(page.locator('[data-testid="error-message"]')).toHaveText('Flow name is required');
    
    // Verify form remains interactive
    await expect(page.locator('[data-testid="flow-name-input"]')).toBeEnabled();
  });

  test('Terminal displays command output correctly', async () => {
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Navigate to terminal
    await page.click('[data-testid="terminal-tab"]');
    
    // Execute a command
    await page.fill('[data-testid="terminal-input"]', 'echo "Terminal test output"');
    await page.press('[data-testid="terminal-input"]', 'Enter');
    
    // Verify output appears
    await expect(page.locator('[data-testid="terminal-output"]')).toHaveText('Terminal test output', { timeout: 5000 });
    
    // Test command history
    await page.press('[data-testid="terminal-input"]', 'ArrowUp');
    await expect(page.locator('[data-testid="terminal-input"]')).toHaveValue('echo "Terminal test output"');
  });

  test('Application maintains state across page refreshes', async () => {
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Create a flow
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    await page.fill('[data-testid="flow-name-input"]', 'Persistence Test Flow');
    await page.click('[data-testid="save-flow-button"]');
    
    // Refresh the page
    await page.reload();
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Verify flow still exists
    await page.click('[data-testid="flows-tab"]');
    await expect(page.locator('[data-testid="flow-list"]')).toHaveText('Persistence Test Flow');
  });

  test('Complex flow with multiple steps executes correctly', async () => {
    await page.goto(baseURL);
    await page.waitForSelector('[data-testid="app-container"]');
    
    // Create complex flow
    await page.click('[data-testid="flows-tab"]');
    await page.click('[data-testid="create-flow-button"]');
    await page.fill('[data-testid="flow-name-input"]', 'Complex Test Flow');
    
    // Add multiple steps
    const steps = [
      { type: 'command', command: 'echo "Step 1"' },
      { type: 'command', command: 'echo "Step 2"' },
      { type: 'command', command: 'echo "Step 3"' }
    ];
    
    for (const step of steps) {
      await page.click('[data-testid="add-step-button"]');
      await page.selectOption('[data-testid="step-type-select"]', step.type);
      await page.fill('[data-testid="step-command-input"]', step.command);
    }
    
    await page.click('[data-testid="save-flow-button"]');
    
    // Execute the flow
    await page.click('[data-testid="flow-item"]:has-text("Complex Test Flow")');
    await page.click('[data-testid="run-flow-button"]');
    
    // Verify all steps execute
    for (let i = 1; i <= 3; i++) {
      await expect(page.locator('[data-testid="terminal-output"]')).toHaveText(`Step ${i}`, { timeout: 10000 });
    }
    
    // Verify completion
    await expect(page.locator('[data-testid="execution-status"]')).toHaveText('Completed');
  });
});