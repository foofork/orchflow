// Page Objects
export * from './page-objects';

// Test Utilities
export * from './utilities';

// Custom Assertions
export * from './assertions';

// Test Setup Helpers
import type { Page, BrowserContext } from '@playwright/test';
import { expect } from '@playwright/test';
import { TerminalPage, FileExplorerPage, GitPanelPage, SettingsPage, CommandPalettePage } from './page-objects';
import { NetworkInterceptor, TestDatabase, PerformanceMonitor, ErrorHandler, StateValidator } from './utilities';
import { customMatchers } from './assertions';

export interface TestContext {
  page: Page;
  context: BrowserContext;
  terminal: TerminalPage;
  fileExplorer: FileExplorerPage;
  gitPanel: GitPanelPage;
  settings: SettingsPage;
  commandPalette: CommandPalettePage;
  network: NetworkInterceptor;
  database: TestDatabase;
  performance: PerformanceMonitor;
  errorHandler: ErrorHandler;
  stateValidator: StateValidator;
}

/**
 * Initialize all test helpers for a page
 */
export async function initializeTestHelpers(page: Page, context: BrowserContext): Promise<TestContext> {
  // Initialize page objects
  const terminal = new TerminalPage(page);
  const fileExplorer = new FileExplorerPage(page);
  const gitPanel = new GitPanelPage(page);
  const settings = new SettingsPage(page);
  const commandPalette = new CommandPalettePage(page);

  // Initialize utilities
  const network = new NetworkInterceptor(page);
  const database = new TestDatabase();
  const performance = new PerformanceMonitor(page);
  const errorHandler = new ErrorHandler(page);
  const stateValidator = new StateValidator(page);

  // Initialize all components
  await network.initialize();
  await database.initialize();
  await performance.initialize();
  await errorHandler.initialize();

  return {
    page,
    context,
    terminal,
    fileExplorer,
    gitPanel,
    settings,
    commandPalette,
    network,
    database,
    performance,
    errorHandler,
    stateValidator
  };
}

/**
 * Register custom matchers with Playwright expect
 */
export function registerCustomMatchers(): void {
  expect.extend(customMatchers);
}

/**
 * Common test setup function
 */
export async function setupTest(page: Page, context: BrowserContext, options?: {
  startMonitoring?: boolean;
  mockAPIs?: boolean;
  seedDatabase?: boolean;
}): Promise<TestContext> {
  const testContext = await initializeTestHelpers(page, context);

  if (options?.startMonitoring) {
    testContext.performance.startMonitoring();
    testContext.errorHandler.startMonitoring();
    testContext.network.startRecording();
  }

  if (options?.mockAPIs) {
    // Add common API mocks
    await testContext.network.mockAPI('/api/health', { status: 200, body: { status: 'ok' } });
    await testContext.network.mockAPI('/api/version', { status: 200, body: { version: '1.0.0' } });
  }

  if (options?.seedDatabase) {
    await testContext.database.reset(); // This seeds default data
  }

  return testContext;
}

/**
 * Common test teardown function
 */
export async function teardownTest(testContext: TestContext, options?: {
  saveReports?: boolean;
  cleanupDatabase?: boolean;
}): Promise<void> {
  if (options?.saveReports) {
    // Save performance report
    if (testContext.performance) {
      await testContext.performance.exportReport('performance-report.json');
    }

    // Save error report
    if (testContext.errorHandler && testContext.errorHandler.hasErrors()) {
      await testContext.errorHandler.exportReport('error-report.json');
    }

    // Save network logs
    if (testContext.network) {
      await testContext.network.exportHAR('network.har');
    }
  }

  // Stop monitoring
  await testContext.performance.stopMonitoring();
  testContext.errorHandler.stopMonitoring();
  testContext.network.stopRecording();

  if (options?.cleanupDatabase) {
    await testContext.database.cleanup();
  }
}

/**
 * Wait for application to be ready
 */
export async function waitForAppReady(testContext: TestContext): Promise<void> {
  // Wait for key components to be visible
  await testContext.terminal.waitForReady();
  await testContext.fileExplorer.waitForReady();
  
  // Wait for any initial loading to complete
  await testContext.page.waitForLoadState('networkidle');
  
  // Ensure no critical errors during startup
  await testContext.errorHandler.assertNoCriticalErrors();
}

/**
 * Common parallel test execution helper
 */
export async function runParallelTests<T>(
  tests: Array<() => Promise<T>>,
  options?: {
    maxConcurrency?: number;
    continueOnError?: boolean;
  }
): Promise<Array<{ success: boolean; result?: T; error?: Error }>> {
  const maxConcurrency = options?.maxConcurrency || 5;
  const results: Array<{ success: boolean; result?: T; error?: Error }> = [];
  
  for (let i = 0; i < tests.length; i += maxConcurrency) {
    const batch = tests.slice(i, i + maxConcurrency);
    const batchResults = await Promise.allSettled(batch.map(test => test()));
    
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push({ success: true, result: result.value });
      } else {
        results.push({ success: false, error: result.reason });
        if (!options?.continueOnError) {
          throw result.reason;
        }
      }
    }
  }
  
  return results;
}

/**
 * Retry helper for flaky operations
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    delay?: number;
    backoff?: boolean;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries || 3;
  const baseDelay = options?.delay || 1000;
  
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (i < maxRetries - 1) {
        const delay = options?.backoff ? baseDelay * Math.pow(2, i) : baseDelay;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}