# E2E Test Helpers

This directory contains comprehensive test utilities and helpers for E2E testing with Playwright.

## Structure

### Page Objects (`/page-objects`)
- **TerminalPage**: Interact with terminal components
- **FileExplorerPage**: Handle file explorer operations
- **GitPanelPage**: Manage Git operations
- **SettingsPage**: Configure application settings
- **CommandPalettePage**: Use command palette features

### Test Utilities (`/utilities`)
- **NetworkInterceptor**: Mock API responses and monitor network traffic
- **TestDatabase**: Manage test data and fixtures
- **PerformanceMonitor**: Track performance metrics and assert thresholds
- **ErrorHandler**: Capture and analyze errors during tests
- **StateValidator**: Validate application state transitions

### Custom Assertions (`/assertions`)
- Terminal output and command assertions
- File system state assertions
- Git repository assertions
- Performance metric assertions

## Usage Examples

### Basic Test Setup

```typescript
import { test } from '@playwright/test';
import { setupTest, teardownTest, waitForAppReady } from './helpers';

test.describe('My Feature', () => {
  test('should perform action', async ({ page, context }) => {
    // Setup test with monitoring enabled
    const testContext = await setupTest(page, context, {
      startMonitoring: true,
      mockAPIs: true,
      seedDatabase: true
    });

    // Wait for app to be ready
    await waitForAppReady(testContext);

    // Use page objects
    await testContext.terminal.executeCommand('ls -la');
    await testContext.terminal.assertCommandSuccess('npm test');

    // Cleanup
    await teardownTest(testContext, {
      saveReports: true,
      cleanupDatabase: true
    });
  });
});
```

### Terminal Operations

```typescript
const { terminal } = testContext;

// Execute commands
await terminal.executeCommand('npm install');
await terminal.waitForOutput('added');

// Assert output
await terminal.toHaveOutput(/Successfully installed/);
await terminal.toHaveExitCode(0);

// Work with multiple tabs
await terminal.createNewTab();
await terminal.switchToTab(1);
```

### File Operations

```typescript
const { fileExplorer } = testContext;

// Create files and folders
await fileExplorer.createNewFile('test.js');
await fileExplorer.createNewFolder('components');

// Navigate
await fileExplorer.navigateToFolder('src/components');

// Assert file structure
await fileExplorer.toHaveFileStructure({
  'src': {
    'components': 'folder',
    'index.js': 'file',
    'styles.css': 'file'
  }
});
```

### Git Operations

```typescript
const { gitPanel } = testContext;

// Stage and commit
await gitPanel.stageAll();
await gitPanel.commit('feat: add new feature');

// Assert Git state
await gitPanel.toBeOnBranch('main');
await gitPanel.toHaveNoChanges();
await gitPanel.toBeSynchronized();
```

### Network Mocking

```typescript
const { network } = testContext;

// Mock API responses
await network.mockAPI('/api/users', {
  status: 200,
  body: [{ id: 1, name: 'Test User' }]
});

// Mock errors
await network.mockError('/api/submit', 500);

// Assert API calls
await network.assertAPICalled('/api/users', 2);
await network.assertAPICalledWith('/api/login', { username: 'test' });
```

### Performance Monitoring

```typescript
const { performance } = testContext;

// Start monitoring
await performance.startMonitoring();

// Perform actions
await testContext.terminal.executeCommand('npm run build');

// Assert performance
await performance.toHaveLoadTimeUnder(3000);
await performance.toHaveAverageFPSAbove(55);
await performance.toHaveNoMemoryLeaks();
```

### Error Handling

```typescript
const { errorHandler } = testContext;

// Configure error handling
errorHandler.addIgnorePattern(/ResizeObserver/);
errorHandler.setErrorThreshold(10);

// Monitor errors
errorHandler.startMonitoring();

// Perform actions...

// Assert no critical errors
await errorHandler.assertNoCriticalErrors();
```

### State Validation

```typescript
const { stateValidator } = testContext;

// Define states
stateValidator.defineState('logged-in', [
  { selector: '[data-testid="user-menu"]', condition: 'visible' },
  { selector: '[data-testid="login-form"]', condition: 'hidden' }
]);

// Validate transitions
await stateValidator.validateTransition(
  'logged-out',
  async () => await page.click('[data-testid="login-button"]'),
  'logged-in'
);
```

### Parallel Test Execution

```typescript
import { runParallelTests } from './helpers';

const results = await runParallelTests([
  async () => await testContext.terminal.executeCommand('test1'),
  async () => await testContext.fileExplorer.createNewFile('test2.js'),
  async () => await testContext.gitPanel.commit('test3')
], {
  maxConcurrency: 3,
  continueOnError: true
});
```

### Test Data Management

```typescript
const { database } = testContext;

// Create test users
const users = await database.createUsers(5, {
  role: 'user'
});

// Create test project
const project = await database.createProject({
  name: 'Test Project',
  ownerId: users[0].id
});

// Add files to project
await database.addFileToProject(project.id, {
  name: 'index.js',
  content: database.generateFileContent('javascript')
});
```

## Best Practices

1. **Always use page objects** instead of direct selectors
2. **Set up monitoring** at the beginning of tests
3. **Clean up resources** in teardown
4. **Use custom assertions** for better error messages
5. **Mock external dependencies** for reliability
6. **Validate state transitions** for complex workflows
7. **Monitor performance** for critical user paths
8. **Handle errors gracefully** with proper error handling
9. **Use parallel execution** for independent tests
10. **Seed test data** for consistent test environments

## Configuration

### Environment Variables

- `E2E_SLOWMO`: Slow down operations (ms)
- `E2E_HEADLESS`: Run in headless mode
- `E2E_VIDEO`: Record test videos
- `E2E_TRACE`: Enable trace recording
- `E2E_SCREENSHOT`: Take screenshots on failure

### Test Timeouts

Configure in your test files:
```typescript
test.setTimeout(60000); // 60 seconds
```

### Custom Matchers

Register custom matchers in your test setup:
```typescript
import { registerCustomMatchers } from './helpers';

registerCustomMatchers();
```