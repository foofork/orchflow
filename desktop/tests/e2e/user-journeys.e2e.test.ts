/**
 * End-to-End Tests for Critical User Journeys
 * 
 * Tests complete user workflows from start to finish,
 * including navigation, interaction, and data persistence.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Page, Browser, chromium } from 'playwright';

describe('Critical User Journeys E2E', () => {
  let browser: Browser;
  let page: Page;
  let baseURL: string;

  beforeEach(async () => {
    browser = await chromium.launch({ 
      headless: process.env.CI === 'true',
      slowMo: 50 // Slow down actions for better reliability
    });
    page = await browser.newPage();
    baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
    
    // Set longer timeout for E2E tests
    page.setDefaultTimeout(30000);
    
    // Navigate to the application
    await page.goto(baseURL);
    
    // Wait for the application to load
    await page.waitForSelector('[data-testid="app-loaded"]', { timeout: 10000 });
  });

  afterEach(async () => {
    if (page) await page.close();
    if (browser) await browser.close();
  });

  describe('Journey 1: Project Setup and File Management', () => {
    it('should create new project, add files, and organize structure', async () => {
      // Step 1: Create new project
      await page.click('[data-testid="new-project-button"]');
      await page.fill('[data-testid="project-name-input"]', 'E2E Test Project');
      await page.fill('[data-testid="project-description"]', 'A project created during E2E testing');
      await page.click('[data-testid="create-project-confirm"]');

      // Wait for project creation to complete
      await page.waitForSelector('[data-testid="project-created-success"]');
      
      // Verify project appears in sidebar
      await expect(page.locator('[data-testid="project-list"]')).toContainText('E2E Test Project');

      // Step 2: Create directory structure
      await page.click('[data-testid="file-explorer-new-folder"]');
      await page.fill('[data-testid="folder-name-input"]', 'src');
      await page.press('[data-testid="folder-name-input"]', 'Enter');

      await page.click('[data-testid="file-explorer-new-folder"]');
      await page.fill('[data-testid="folder-name-input"]', 'tests');
      await page.press('[data-testid="folder-name-input"]', 'Enter');

      // Step 3: Create files
      await page.click('[data-testid="src-folder"]');
      await page.click('[data-testid="new-file-button"]');
      await page.fill('[data-testid="file-name-input"]', 'main.js');
      await page.press('[data-testid="file-name-input"]', 'Enter');

      // Step 4: Edit file content
      await page.click('[data-testid="main.js-file"]');
      
      // Wait for editor to load
      await page.waitForSelector('[data-testid="code-editor"]');
      
      // Add content to the file
      const editorContent = `
console.log('Hello, E2E Test!');

function greet(name) {
  return \`Hello, \${name}!\`;
}

export { greet };
      `.trim();
      
      await page.fill('[data-testid="code-editor"] textarea', editorContent);
      
      // Save the file
      await page.keyboard.press('Control+S');
      await page.waitForSelector('[data-testid="file-saved-indicator"]');

      // Step 5: Verify file tree structure
      const fileTree = page.locator('[data-testid="file-tree"]');
      await expect(fileTree).toContainText('src');
      await expect(fileTree).toContainText('tests');
      await expect(fileTree).toContainText('main.js');

      // Step 6: Create test file
      await page.click('[data-testid="tests-folder"]');
      await page.click('[data-testid="new-file-button"]');
      await page.fill('[data-testid="file-name-input"]', 'main.test.js');
      await page.press('[data-testid="file-name-input"]', 'Enter');

      const testContent = `
import { greet } from '../src/main.js';

describe('greet function', () => {
  it('should return greeting message', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});
      `.trim();

      await page.click('[data-testid="main.test.js-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      await page.fill('[data-testid="code-editor"] textarea', testContent);
      await page.keyboard.press('Control+S');
      await page.waitForSelector('[data-testid="file-saved-indicator"]');

      // Verify project structure is saved
      await page.reload();
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Check that structure persisted
      await expect(page.locator('[data-testid="file-tree"]')).toContainText('E2E Test Project');
      await expect(page.locator('[data-testid="file-tree"]')).toContainText('main.js');
      await expect(page.locator('[data-testid="file-tree"]')).toContainText('main.test.js');
    });
  });

  describe('Journey 2: Terminal Usage and Command Execution', () => {
    it('should open terminal, run commands, and manage multiple sessions', async () => {
      // Step 1: Open terminal panel
      await page.click('[data-testid="terminal-panel-button"]');
      await page.waitForSelector('[data-testid="terminal-container"]');

      // Step 2: Execute basic command
      const terminalInput = page.locator('[data-testid="terminal-input"]');
      await terminalInput.fill('echo "Hello from E2E test"');
      await page.keyboard.press('Enter');

      // Wait for command output
      await page.waitForSelector('[data-testid="terminal-output"]');
      await expect(page.locator('[data-testid="terminal-output"]')).toContainText('Hello from E2E test');

      // Step 3: Open second terminal tab
      await page.click('[data-testid="new-terminal-tab"]');
      await page.waitForSelector('[data-testid="terminal-tab-2"]');

      // Verify we have two terminal tabs
      const terminalTabs = page.locator('[data-testid^="terminal-tab-"]');
      await expect(terminalTabs).toHaveCount(2);

      // Step 4: Run different command in second terminal
      await terminalInput.fill('ls -la');
      await page.keyboard.press('Enter');
      
      await page.waitForTimeout(1000); // Wait for command execution

      // Step 5: Switch between terminals
      await page.click('[data-testid="terminal-tab-1"]');
      await expect(page.locator('[data-testid="terminal-output"]')).toContainText('Hello from E2E test');

      await page.click('[data-testid="terminal-tab-2"]');
      await expect(page.locator('[data-testid="terminal-output"]')).toContainText('total');

      // Step 6: Close terminal tab
      await page.click('[data-testid="close-terminal-tab-2"]');
      await expect(page.locator('[data-testid="terminal-tab-2"]')).not.toBeVisible();

      // Step 7: Clear terminal history
      await page.click('[data-testid="terminal-tab-1"]');
      await page.click('[data-testid="clear-terminal-button"]');
      
      // Verify terminal is cleared
      const terminalOutput = page.locator('[data-testid="terminal-output"]');
      await expect(terminalOutput).toBeEmpty();
    });
  });

  describe('Journey 3: Flow Creation and Execution', () => {
    it('should create automation flow, configure steps, and execute successfully', async () => {
      // Step 1: Navigate to flows section
      await page.click('[data-testid="flows-nav-button"]');
      await page.waitForSelector('[data-testid="flows-dashboard"]');

      // Step 2: Create new flow
      await page.click('[data-testid="create-new-flow"]');
      await page.fill('[data-testid="flow-name-input"]', 'E2E Test Flow');
      await page.fill('[data-testid="flow-description"]', 'Automated flow for E2E testing');
      await page.click('[data-testid="flow-create-confirm"]');

      // Wait for flow editor to load
      await page.waitForSelector('[data-testid="flow-editor"]');

      // Step 3: Add flow steps
      // Add command step
      await page.click('[data-testid="add-step-button"]');
      await page.selectOption('[data-testid="step-type-select"]', 'command');
      await page.fill('[data-testid="command-input"]', 'echo "Flow step 1 executed"');
      await page.click('[data-testid="add-step-confirm"]');

      // Add file operation step
      await page.click('[data-testid="add-step-button"]');
      await page.selectOption('[data-testid="step-type-select"]', 'file');
      await page.fill('[data-testid="file-path-input"]', '/tmp/flow-test.txt');
      await page.fill('[data-testid="file-content-input"]', 'Content created by E2E flow');
      await page.selectOption('[data-testid="file-operation-select"]', 'write');
      await page.click('[data-testid="add-step-confirm"]');

      // Step 4: Configure flow settings
      await page.click('[data-testid="flow-settings-tab"]');
      await page.check('[data-testid="enable-logging-checkbox"]');
      await page.selectOption('[data-testid="execution-mode-select"]', 'sequential');

      // Step 5: Save flow
      await page.click('[data-testid="save-flow-button"]');
      await page.waitForSelector('[data-testid="flow-saved-success"]');

      // Step 6: Execute flow
      await page.click('[data-testid="execute-flow-button"]');
      await page.waitForSelector('[data-testid="flow-execution-started"]');

      // Monitor execution progress
      await page.waitForSelector('[data-testid="flow-step-1-completed"]');
      await page.waitForSelector('[data-testid="flow-step-2-completed"]');
      await page.waitForSelector('[data-testid="flow-execution-completed"]');

      // Step 7: Verify execution results
      const executionLog = page.locator('[data-testid="execution-log"]');
      await expect(executionLog).toContainText('Flow step 1 executed');
      await expect(executionLog).toContainText('File written successfully');

      // Step 8: Check flow history
      await page.click('[data-testid="flow-history-tab"]');
      const historyItems = page.locator('[data-testid^="history-item-"]');
      await expect(historyItems).toHaveCount(1);
      
      const latestExecution = historyItems.first();
      await expect(latestExecution).toContainText('completed');
      await expect(latestExecution).toContainText('E2E Test Flow');
    });
  });

  describe('Journey 4: Git Integration and Version Control', () => {
    it('should initialize git repo, make commits, and manage branches', async () => {
      // Step 1: Open Git panel
      await page.click('[data-testid="git-panel-button"]');
      await page.waitForSelector('[data-testid="git-panel"]');

      // Step 2: Initialize repository
      await page.click('[data-testid="git-init-button"]');
      await page.waitForSelector('[data-testid="git-initialized-success"]');

      // Verify git status shows untracked files
      await expect(page.locator('[data-testid="git-status"]')).toContainText('untracked');

      // Step 3: Stage files
      await page.click('[data-testid="stage-all-button"]');
      await page.waitForSelector('[data-testid="files-staged-success"]');

      // Step 4: Make initial commit
      await page.fill('[data-testid="commit-message-input"]', 'Initial commit - E2E test setup');
      await page.click('[data-testid="commit-button"]');
      await page.waitForSelector('[data-testid="commit-success"]');

      // Step 5: Create new branch
      await page.click('[data-testid="new-branch-button"]');
      await page.fill('[data-testid="branch-name-input"]', 'feature/e2e-testing');
      await page.click('[data-testid="create-branch-confirm"]');

      // Verify we're on the new branch
      await expect(page.locator('[data-testid="current-branch"]')).toContainText('feature/e2e-testing');

      // Step 6: Make changes and commit
      // Modify a file
      await page.click('[data-testid="file-explorer-button"]');
      await page.click('[data-testid="main.js-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      
      // Add a new function
      const additionalCode = `

function multiply(a, b) {
  return a * b;
}

export { greet, multiply };`;

      await page.locator('[data-testid="code-editor"] textarea').press('Control+End');
      await page.locator('[data-testid="code-editor"] textarea').type(additionalCode);
      await page.keyboard.press('Control+S');

      // Step 7: Commit changes
      await page.click('[data-testid="git-panel-button"]');
      await expect(page.locator('[data-testid="git-status"]')).toContainText('modified');
      
      await page.click('[data-testid="stage-all-button"]');
      await page.fill('[data-testid="commit-message-input"]', 'Add multiply function');
      await page.click('[data-testid="commit-button"]');
      await page.waitForSelector('[data-testid="commit-success"]');

      // Step 8: Switch back to main branch
      await page.click('[data-testid="branch-selector"]');
      await page.click('[data-testid="branch-main"]');
      await expect(page.locator('[data-testid="current-branch"]')).toContainText('main');

      // Step 9: View commit history
      await page.click('[data-testid="git-history-tab"]');
      const commitHistory = page.locator('[data-testid="commit-history"]');
      await expect(commitHistory).toContainText('Initial commit');
      
      // Switch to feature branch and verify its commit
      await page.click('[data-testid="branch-selector"]');
      await page.click('[data-testid="branch-feature/e2e-testing"]');
      await expect(commitHistory).toContainText('Add multiply function');
    });
  });

  describe('Journey 5: Search and Replace Workflow', () => {
    it('should perform project-wide search, replace text, and verify changes', async () => {
      // Step 1: Open search panel
      await page.keyboard.press('Control+Shift+F');
      await page.waitForSelector('[data-testid="search-panel"]');

      // Step 2: Perform basic search
      await page.fill('[data-testid="search-input"]', 'greet');
      await page.click('[data-testid="search-button"]');

      // Wait for search results
      await page.waitForSelector('[data-testid="search-results"]');
      const searchResults = page.locator('[data-testid="search-result-item"]');
      await expect(searchResults).toHaveCountGreaterThan(0);

      // Step 3: Navigate to search result
      await searchResults.first().click();
      await page.waitForSelector('[data-testid="code-editor"]');
      
      // Verify the editor opened to the correct line
      const editorContent = page.locator('[data-testid="code-editor"] textarea');
      await expect(editorContent).toContainText('greet');

      // Step 4: Perform search and replace
      await page.keyboard.press('Control+H');
      await page.waitForSelector('[data-testid="replace-panel"]');

      await page.fill('[data-testid="find-input"]', 'greet');
      await page.fill('[data-testid="replace-input"]', 'welcome');

      // Step 5: Replace all occurrences
      await page.click('[data-testid="replace-all-button"]');
      await page.waitForSelector('[data-testid="replace-complete"]');

      // Step 6: Verify replacements
      await page.click('[data-testid="search-input"]');
      await page.fill('[data-testid="search-input"]', 'welcome');
      await page.click('[data-testid="search-button"]');

      await page.waitForSelector('[data-testid="search-results"]');
      const welcomeResults = page.locator('[data-testid="search-result-item"]');
      await expect(welcomeResults).toHaveCountGreaterThan(0);

      // Step 7: Verify no 'greet' instances remain
      await page.fill('[data-testid="search-input"]', 'greet');
      await page.click('[data-testid="search-button"]');
      
      await page.waitForTimeout(1000);
      await expect(page.locator('[data-testid="no-results-message"]')).toBeVisible();

      // Step 8: Use regex search
      await page.fill('[data-testid="search-input"]', 'function\\s+\\w+');
      await page.check('[data-testid="regex-search-checkbox"]');
      await page.click('[data-testid="search-button"]');

      await page.waitForSelector('[data-testid="search-results"]');
      const regexResults = page.locator('[data-testid="search-result-item"]');
      await expect(regexResults).toHaveCountGreaterThan(0);
    });
  });

  describe('Journey 6: Settings and Customization', () => {
    it('should modify application settings and persist preferences', async () => {
      // Step 1: Open settings
      await page.click('[data-testid="settings-button"]');
      await page.waitForSelector('[data-testid="settings-modal"]');

      // Step 2: Modify editor settings
      await page.click('[data-testid="editor-settings-tab"]');
      await page.selectOption('[data-testid="theme-select"]', 'dark');
      await page.selectOption('[data-testid="font-size-select"]', '14');
      await page.check('[data-testid="line-numbers-checkbox"]');
      await page.check('[data-testid="word-wrap-checkbox"]');

      // Step 3: Modify terminal settings
      await page.click('[data-testid="terminal-settings-tab"]');
      await page.selectOption('[data-testid="terminal-shell-select"]', 'bash');
      await page.fill('[data-testid="terminal-font-size"]', '12');

      // Step 4: Set up keyboard shortcuts
      await page.click('[data-testid="shortcuts-settings-tab"]');
      await page.click('[data-testid="customize-shortcut-save"]');
      await page.keyboard.press('Control+Alt+S');
      await page.click('[data-testid="shortcut-confirm"]');

      // Step 5: Save settings
      await page.click('[data-testid="save-settings-button"]');
      await page.waitForSelector('[data-testid="settings-saved-success"]');
      await page.click('[data-testid="close-settings-button"]');

      // Step 6: Verify settings applied
      // Check theme changed
      await expect(page.locator('body')).toHaveClass(/dark-theme/);

      // Check editor settings
      await page.click('[data-testid="main.js-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      
      const lineNumbers = page.locator('[data-testid="line-numbers"]');
      await expect(lineNumbers).toBeVisible();

      // Step 7: Test custom keyboard shortcut
      await page.keyboard.press('Control+Alt+S');
      await page.waitForSelector('[data-testid="file-saved-indicator"]');

      // Step 8: Verify settings persist after reload
      await page.reload();
      await page.waitForSelector('[data-testid="app-loaded"]');
      
      // Theme should still be dark
      await expect(page.locator('body')).toHaveClass(/dark-theme/);

      // Open a file and check editor settings persist
      await page.click('[data-testid="main.js-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      await expect(page.locator('[data-testid="line-numbers"]')).toBeVisible();
    });
  });

  describe('Journey 7: Error Handling and Recovery', () => {
    it('should handle errors gracefully and provide recovery options', async () => {
      // Step 1: Trigger file operation error
      await page.click('[data-testid="file-explorer-new-file"]');
      await page.fill('[data-testid="file-name-input"]', 'invalid/file\\name.txt');
      await page.press('[data-testid="file-name-input"]', 'Enter');

      // Wait for error notification
      await page.waitForSelector('[data-testid="error-notification"]');
      await expect(page.locator('[data-testid="error-notification"]')).toContainText('Invalid file name');

      // Step 2: Dismiss error and try again
      await page.click('[data-testid="dismiss-error-button"]');
      await page.fill('[data-testid="file-name-input"]', 'valid-file.txt');
      await page.press('[data-testid="file-name-input"]', 'Enter');

      await page.waitForSelector('[data-testid="file-created-success"]');

      // Step 3: Trigger network error simulation
      // Simulate offline state
      await page.context().setOffline(true);
      
      // Try to execute a flow that requires network
      await page.click('[data-testid="flows-nav-button"]');
      await page.click('[data-testid="sync-flows-button"]');

      await page.waitForSelector('[data-testid="network-error-dialog"]');
      await expect(page.locator('[data-testid="network-error-dialog"]')).toContainText('Network connection failed');

      // Step 4: Test recovery options
      await page.click('[data-testid="retry-button"]');
      
      // Still offline, should show error again
      await page.waitForSelector('[data-testid="network-error-dialog"]');

      // Go back online and retry
      await page.context().setOffline(false);
      await page.click('[data-testid="retry-button"]');
      
      // Should succeed now
      await page.waitForSelector('[data-testid="sync-success"]');

      // Step 5: Test application crash recovery
      // Simulate browser crash by reloading without saving
      await page.click('[data-testid="file-explorer-new-file"]');
      await page.fill('[data-testid="file-name-input"]', 'unsaved-file.txt');
      await page.press('[data-testid="file-name-input"]', 'Enter');

      await page.click('[data-testid="unsaved-file.txt-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      await page.fill('[data-testid="code-editor"] textarea', 'Unsaved content that should be recovered');

      // Reload without saving
      await page.reload();
      await page.waitForSelector('[data-testid="app-loaded"]');

      // Should show recovery dialog
      await page.waitForSelector('[data-testid="recovery-dialog"]');
      await expect(page.locator('[data-testid="recovery-dialog"]')).toContainText('unsaved changes');

      // Recover the content
      await page.click('[data-testid="recover-changes-button"]');
      await page.waitForSelector('[data-testid="recovery-complete"]');

      // Verify content was recovered
      await page.click('[data-testid="unsaved-file.txt-file"]');
      await page.waitForSelector('[data-testid="code-editor"]');
      await expect(page.locator('[data-testid="code-editor"] textarea')).toContainText('Unsaved content that should be recovered');
    });
  });
});