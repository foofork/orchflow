# E2E Testing Guide for Orchflow

## Overview

This guide covers end-to-end (E2E) testing for the Orchflow desktop application using Vitest and Playwright. E2E tests validate complete user journeys and ensure the application works correctly from a user's perspective.

## Quick Start

### Running E2E Tests
```bash
# Run all E2E tests
npm run test:e2e

# Run smoke tests only (quick critical path validation)
npm run test:e2e:smoke

# Run regression tests (comprehensive feature validation)
npm run test:e2e:regression

# Run critical path tests (business-critical workflows)
npm run test:e2e:critical

# Run with debugging enabled
npm run test:e2e:debug

# Watch mode for development
npm run test:e2e:watch

# Run with UI
npm run test:e2e:ui
```

## Test Architecture

### Directory Structure
```
tests/e2e/
├── smoke/                    # Quick critical path tests (<5 min)
│   ├── app-launch.test.ts
│   ├── basic-navigation.test.ts
│   └── core-features.test.ts
├── regression/               # Comprehensive feature tests (15-30 min)  
│   ├── flow-management.test.ts
│   ├── terminal-operations.test.ts
│   ├── file-operations.test.ts
│   └── settings-persistence.test.ts
├── critical/                 # Business-critical tests (10-15 min)
│   ├── data-integrity.test.ts
│   ├── security-features.test.ts
│   └── performance-benchmarks.test.ts
├── flows/                    # User flow tests
│   ├── authentication.e2e.test.ts
│   ├── terminal-management.e2e.test.ts
│   ├── file-operations.e2e.test.ts
│   ├── git-integration.e2e.test.ts
│   ├── plugin-system.e2e.test.ts
│   ├── settings-management.e2e.test.ts
│   ├── search-functionality.e2e.test.ts
│   └── multi-window.e2e.test.ts
└── helpers/
    ├── test-context.ts       # Test isolation and port management
    ├── test-data-builders.ts # Fluent builders for test data
    ├── wait-strategies.ts    # Smart wait utilities
    └── page-objects/         # Page Object Models
        ├── BasePage.ts
        ├── AuthPage.ts
        ├── DashboardPage.ts
        ├── TerminalPage.ts
        ├── FileExplorerPage.ts
        ├── EditorPage.ts
        ├── GitPage.ts
        ├── PluginPage.ts
        ├── SettingsPage.ts
        ├── SearchPage.ts
        ├── CommandPalettePage.ts
        └── WindowManager.ts
```

### Test Categories

#### 1. Smoke Tests (< 5 minutes)
- **Purpose**: Quick validation of core functionality
- **Frequency**: Run on every commit
- **Coverage**: Application startup, basic navigation, no critical errors

#### 2. Regression Tests (15-30 minutes)
- **Purpose**: Comprehensive feature validation
- **Frequency**: Run on PR creation and merge
- **Coverage**: All user workflows, feature interactions, edge cases

#### 3. Critical Path Tests (10-15 minutes)
- **Purpose**: Validate business-critical functionality
- **Frequency**: Run before releases
- **Coverage**: Data integrity, security features, performance requirements

## Critical User Flows

### 1. Authentication Flow (`authentication.e2e.test.ts`)
- User login with valid/invalid credentials
- Session management and persistence
- Multi-tab session synchronization
- Security features (XSS, CSRF protection)
- Password requirements validation
- Remember me functionality
- Logout and session cleanup

### 2. Terminal Management (`terminal-management.e2e.test.ts`)
- Creating and closing terminals
- Terminal splitting (horizontal/vertical)
- Command execution and output
- Terminal scrolling and search
- Copy/paste operations
- Terminal settings and themes
- Performance with large outputs

### 3. File Operations (`file-operations.e2e.test.ts`)
- File creation, editing, saving, deletion
- Folder management
- File search and navigation
- Concurrent editing handling
- Auto-save functionality
- File templates
- Trash and restoration

### 4. Git Integration (`git-integration.e2e.test.ts`)
- Repository initialization and cloning
- File staging and committing
- Branch management and merging
- Remote operations (push/pull/fetch)
- Conflict resolution
- Stash operations
- Git history and tags

### 5. Plugin System (`plugin-system.e2e.test.ts`)
- Plugin discovery and search
- Installation and updates
- Configuration management
- Theme and formatter plugins
- Development plugin loading
- Permission handling
- Plugin store integration

### 6. Settings Management (`settings-management.e2e.test.ts`)
- General, editor, terminal settings
- Theme and appearance customization
- Keybinding configuration
- Settings import/export
- Cross-window synchronization
- Validation and persistence

### 7. Search Functionality (`search-functionality.e2e.test.ts`)
- Global file content search
- File name search with fuzzy matching
- Command palette operations
- Search and replace in files
- Regex and case-sensitive search
- Search history and persistence

### 8. Multi-window Support (`multi-window.e2e.test.ts`)
- Window creation and management
- State synchronization across windows
- Window-specific layouts
- Window arrangement options
- Session restoration
- Performance with multiple windows

## Writing E2E Tests

### Basic Test Structure

```typescript
import { test, expect } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { TestContext } from '../helpers/test-context';

describe('Feature E2E Tests', () => {
  let testContext: TestContext;

  beforeEach(async () => {
    testContext = new TestContext({
      headless: process.env.CI === 'true',
      trace: true
    });
    await testContext.setup();
  });

  afterEach(async () => {
    await testContext.captureState('feature-name');
    await testContext.teardown();
  });

  test('user completes a workflow', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto('/');
    await page.click('[data-testid="create-flow"]');
    await page.fill('[data-testid="flow-name"]', 'E2E Test Flow');
    await page.click('[data-testid="save-flow"]');
    
    await expect(page.locator('[data-testid="flow-list"]'))
      .toContainText('E2E Test Flow');
  });
});
```

### Using Test Context for Isolation

The `TestContext` class provides:
- Isolated test environments with unique ports
- Temporary data directories
- Browser context management
- Automatic cleanup
- Screenshot and state capture on failure

### Page Object Model

#### BasePage Class
All page objects extend from `BasePage`:

```typescript
// helpers/page-objects/BasePage.ts
export abstract class BasePage {
  constructor(protected page: Page) {}
  
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.waitForElement('[data-testid="app-container"]');
  }
  
  async waitForElement(selector: string, options?: WaitOptions): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({ timeout: 30000, state: 'visible', ...options });
    return locator;
  }
  
  async clickElement(selector: string, options?: { force?: boolean }) {
    const element = await this.waitForElement(selector);
    await element.click({ force: options?.force });
  }
}
```

#### Specialized Page Objects

**TerminalPage** - Terminal management:
```typescript
export class TerminalPage extends BasePage {
  async createNewTerminal(): Promise<string | null> {
    await this.clickElement('[data-testid="new-terminal-button"]');
    return await this.getActiveTerminalId();
  }
  
  async executeCommand(terminalId: string, command: string) {
    await this.switchToTerminal(terminalId);
    const input = await this.waitForElement(`[data-terminal-id="${terminalId}"] [data-testid="terminal-input"]`);
    await input.type(command);
    await input.press('Enter');
  }
}
```

**GitPage** - Git operations:
```typescript
export class GitPage extends BasePage {
  async initializeRepository() {
    await this.clickElement('[data-testid="init-repo"]');
    await this.waitForElement('[data-testid="git-panel"]');
  }
  
  async stageFile(fileName: string) {
    const fileItem = `[data-testid="file-item"][data-file="${fileName}"]`;
    await this.hover(fileItem);
    await this.clickElement(`${fileItem} [data-testid="stage-file"]`);
  }
}
```

### Test Data Builders

Use fluent builders for consistent test data:

```typescript
// helpers/test-data-builders.ts
export class FlowBuilder {
  private flow = {
    name: 'Default Flow',
    description: 'Default Description',
    steps: []
  };

  withName(name: string) {
    this.flow.name = name;
    return this;
  }

  withStep(type: string, command: string) {
    this.flow.steps.push({ type, command });
    return this;
  }

  build() {
    return this.flow;
  }
}

// Usage
const testFlow = new FlowBuilder()
  .withName('Complex Flow')
  .withStep('command', 'echo "Step 1"')
  .withStep('command', 'echo "Step 2"')
  .build();
```

## Best Practices

### 1. Use Data-testid Attributes
```typescript
// Good: Use data-testid attributes
await page.click('[data-testid="submit-button"]');

// Avoid: Fragile selectors
await page.click('.btn.primary'); // Can break with CSS changes
```

### 2. Implement Smart Wait Strategies
```typescript
// Wait for element to be visible
await page.waitForSelector('[data-testid="loading"]', { 
  state: 'hidden' 
});

// Wait for network idle
await page.waitForLoadState('networkidle');

// Custom wait condition
await page.waitForFunction(() => {
  return document.querySelector('[data-testid="counter"]')?.textContent === '5';
});
```

### 3. Handle Async Operations
```typescript
test('real-time terminal output', async ({ page }) => {
  // Start long-running command
  await page.fill('[data-testid="terminal-input"]', 'ping -c 5 google.com');
  await page.press('[data-testid="terminal-input"]', 'Enter');
  
  // Verify incremental output
  for (let i = 1; i <= 5; i++) {
    await expect(page.locator('[data-testid="terminal-output"]'))
      .toContainText(`64 bytes from`, { timeout: 10000 });
  }
  
  // Verify completion
  await expect(page.locator('[data-testid="terminal-output"]'))
    .toContainText('5 packets transmitted');
});
```

### 4. Test Error Scenarios
```typescript
test('handles network errors gracefully', async ({ page }) => {
  // Simulate offline state
  await page.context().setOffline(true);
  
  // Attempt operation
  await page.click('[data-testid="sync-button"]');
  
  // Verify error handling
  await expect(page.locator('[data-testid="error-message"]'))
    .toContainText('Network connection failed');
});
```

## Parallel Execution Support

### Port Management
Tests use dynamic port allocation to prevent conflicts:

```typescript
// port-manager.js
export class PortManager {
  async allocatePort(): Promise<number> {
    for (let i = 0; i < this.maxPorts; i++) {
      const port = this.basePort + i;
      if (!this.allocatedPorts.has(port) && await this.isPortAvailable(port)) {
        this.allocatedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available ports');
  }
}
```

### Test Isolation
Each test gets:
- Unique browser context
- Isolated data directory
- Dedicated port allocation
- Independent cleanup

## Performance Testing

### Load Time Testing
```typescript
test('page load performance', async ({ page }) => {
  const startTime = Date.now();
  
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  const loadTime = Date.now() - startTime;
  expect(loadTime).toBeLessThan(3000); // 3 seconds
  
  // Measure specific metrics
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0];
    return {
      domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
      loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
    };
  });
  
  console.log('Performance metrics:', metrics);
});
```

### Memory Leak Detection
```typescript
test('no memory leaks during flow execution', async ({ page }) => {
  // Get initial memory
  const initialMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize;
  });
  
  // Perform operations
  for (let i = 0; i < 10; i++) {
    await page.click('[data-testid="create-flow-button"]');
    await page.click('[data-testid="cancel-button"]');
  }
  
  // Force garbage collection
  await page.evaluate(() => {
    if ((global as any).gc) {
      (global as any).gc();
    }
  });
  
  // Check memory hasn't grown significantly
  const finalMemory = await page.evaluate(() => {
    return (performance as any).memory?.usedJSHeapSize;
  });
  
  const memoryGrowth = finalMemory - initialMemory;
  expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024); // 10MB
});
```

## Debugging E2E Tests

### Debug Mode
```bash
# Run Playwright in headed mode with debug
npm run test:e2e:debug

# Use Playwright Inspector
PWDEBUG=1 npm run test:e2e

# Run specific test with debug
npx vitest run tests/e2e/flows/authentication.e2e.test.ts --reporter=verbose
```

### Common Issues and Solutions

#### Port Conflicts
Use the PortManager for dynamic port allocation:
```typescript
import { PortManager } from './scripts/port-manager.js';

const portManager = new PortManager();
const port = await portManager.findAvailablePort('e2e');
```

#### Flaky Tests
Add retries for unstable operations:
```typescript
await expect(async () => {
  await page.click('[data-testid="flaky-button"]');
  await expect(page.locator('[data-testid="result"]'))
    .toBeVisible();
}).toPass({ timeout: 30000 });
```

#### Timeout Issues
```typescript
test('slow operation', async ({ page }) => {
  test.setTimeout(120000); // 2 minutes
  
  await page.goto('/heavy-page', { 
    waitUntil: 'networkidle',
    timeout: 60000 
  });
});
```

## Configuration

### Vitest E2E Configuration
```typescript
// vitest.config.e2e.ts
export default defineConfig({
  test: {
    name: 'e2e',
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.{js,ts}'],
    testTimeout: 120000,
    hookTimeout: 120000,
    setupFiles: ['./tests/setup/e2e-setup.ts'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
});
```

### Environment Variables
```bash
# .env.test
NODE_ENV=test
CI=false
HEADLESS=true
BASE_URL=http://localhost:5174
TEST_TIMEOUT=120000
E2E_SLOWMO=0
E2E_VIDEO=false
E2E_TRACE=false
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  e2e-smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Install Playwright browsers
        run: npx playwright install chromium
        
      - name: Run smoke tests
        run: npm run test:e2e:smoke
        
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: test-results/
```

## Resources

- [Main Testing Guide](../../docs/TESTING_GUIDE.md) - Overview and best practices
- [Test Utilities Guide](../../docs/TEST_UTILITIES.md) - Mock factories and helpers
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)

---

This guide provides everything needed to write, run, and maintain E2E tests for Orchflow. Follow these patterns and best practices to ensure reliable, maintainable, and efficient test suites.