/**
 * App Launch Smoke Test
 * Validates that the application launches successfully and core components are accessible
 */

import { test, expect, describe } from 'vitest';
import { TestContext, withTestContext } from '../helpers/test-context';
import { WaitStrategies } from '../helpers/utils/wait-strategies';

describe('App Launch Smoke Tests', () => {
  let context: TestContext;
  
  beforeEach(async () => {
    context = new TestContext({
      headless: true,
      viewport: { width: 1280, height: 720 }
    });
    await context.setup();
  });
  
  afterEach(async () => {
    // Capture state on failure
    if (expect.getState().currentTestName && 
        expect.getState().assertionCalls > 0 &&
        expect.getState().numPassingAsserts !== expect.getState().assertionCalls) {
      await context.captureState(expect.getState().currentTestName);
    }
    
    await context.teardown();
  });
  
  test('application launches successfully', async () => {
    const { page, baseUrl } = await context.createPage();
    
    // Navigate to application
    await page.goto(baseUrl);
    
    // Wait for app to be ready
    await WaitStrategies.smartWait(page, {
      networkIdle: true,
      animations: true,
      customCheck: async () => {
        const appContainer = await page.locator('[data-testid="app-container"]').count();
        return appContainer > 0;
      }
    });
    
    // Verify critical elements are present
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="navigation-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="main-content"]')).toBeVisible();
    
    // Verify no error boundaries triggered
    const errorBoundaries = await page.locator('[data-testid="error-boundary"]').count();
    expect(errorBoundaries).toBe(0);
    
    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(1000);
    expect(consoleErrors).toHaveLength(0);
  });
  
  test('navigation menu is functional', async () => {
    const { page, baseUrl } = await context.createPage();
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // Check main navigation items
    const navItems = [
      { selector: '[data-testid="flows-tab"]', section: 'flows-section' },
      { selector: '[data-testid="terminal-tab"]', section: 'terminal-section' },
      { selector: '[data-testid="files-tab"]', section: 'files-section' },
      { selector: '[data-testid="settings-tab"]', section: 'settings-section' }
    ];
    
    for (const item of navItems) {
      // Click navigation item
      await page.click(item.selector);
      
      // Wait for section to be visible
      await expect(page.locator(`[data-testid="${item.section}"]`)).toBeVisible({
        timeout: 5000
      });
      
      // Verify URL changed (if applicable)
      const currentUrl = page.url();
      expect(currentUrl).toContain(baseUrl);
    }
  });
  
  test('critical features are accessible', async () => {
    const { page, baseUrl } = await context.createPage();
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // Check flows section
    await page.click('[data-testid="flows-tab"]');
    await expect(page.locator('[data-testid="create-flow-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="flow-list"]')).toBeVisible();
    
    // Check terminal section
    await page.click('[data-testid="terminal-tab"]');
    await expect(page.locator('[data-testid="terminal-container"]')).toBeVisible();
    
    // Check files section
    await page.click('[data-testid="files-tab"]');
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
  });
  
  test('application handles deep links', async () => {
    const { page, baseUrl } = await context.createPage();
    
    // Test direct navigation to different sections
    const deepLinks = [
      { path: '/flows', expectedElement: '[data-testid="flows-section"]' },
      { path: '/terminal', expectedElement: '[data-testid="terminal-section"]' },
      { path: '/settings', expectedElement: '[data-testid="settings-section"]' }
    ];
    
    for (const link of deepLinks) {
      await page.goto(`${baseUrl}${link.path}`);
      await WaitStrategies.waitForNetworkIdle(page);
      await expect(page.locator(link.expectedElement)).toBeVisible();
    }
  });
  
  test('responsive design works', async () => {
    const { page, baseUrl } = await context.createPage();
    
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 1024, height: 768, name: 'tablet-landscape' },
      { width: 768, height: 1024, name: 'tablet-portrait' },
      { width: 375, height: 667, name: 'mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Verify app container is visible at all sizes
      await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
      
      // Check if mobile menu appears on small screens
      if (viewport.width < 768) {
        await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();
      }
    }
  });
  
  test('performance metrics are acceptable', async () => {
    const { page, baseUrl } = await context.createPage();
    
    // Navigate and measure performance
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // Get performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByName('first-contentful-paint')[0];
      
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstContentfulPaint: paint ? paint.startTime : 0,
        timeToInteractive: navigation.domInteractive - navigation.fetchStart
      };
    });
    
    // Assert performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(3000); // 3 seconds
    expect(metrics.loadComplete).toBeLessThan(5000); // 5 seconds
    expect(metrics.firstContentfulPaint).toBeLessThan(2000); // 2 seconds
    expect(metrics.timeToInteractive).toBeLessThan(4000); // 4 seconds
  });
  
  test('error recovery works', async () => {
    const { page, baseUrl } = await context.createPage();
    
    // Simulate network error
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // App should still load despite API errors
    await expect(page.locator('[data-testid="app-container"]')).toBeVisible();
    
    // Should show appropriate error handling
    const offlineIndicator = await page.locator('[data-testid="offline-indicator"]').count();
    const errorMessage = await page.locator('[data-testid="error-message"]').count();
    
    // At least one error handling mechanism should be visible
    expect(offlineIndicator + errorMessage).toBeGreaterThan(0);
  });
  
  test('local storage is initialized correctly', async () => {
    const { page, baseUrl } = await context.createPage();
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // Check local storage initialization
    const localStorage = await page.evaluate(() => {
      return {
        theme: window.localStorage.getItem('theme'),
        language: window.localStorage.getItem('language'),
        settings: window.localStorage.getItem('settings')
      };
    });
    
    // Verify default values are set
    expect(localStorage.theme).toBeTruthy();
    expect(localStorage.language).toBeTruthy();
  });
  
  test('keyboard navigation works', async () => {
    const { page, baseUrl } = await context.createPage();
    await page.goto(baseUrl);
    await WaitStrategies.waitForNetworkIdle(page);
    
    // Tab through main navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check if an element has focus
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el?.tagName,
        testId: el?.getAttribute('data-testid')
      };
    });
    
    expect(focusedElement.tagName).toBeTruthy();
    
    // Test Enter key on focused element
    await page.keyboard.press('Enter');
    
    // Verify no JavaScript errors occurred
    const jsErrors = await page.evaluate(() => {
      return (window as any).__errors || [];
    });
    expect(jsErrors).toHaveLength(0);
  });
});

/**
 * Critical Path Smoke Test
 * Tests the most important user journey quickly
 */
describe('Critical Path Smoke Test', () => {
  test('user can create and execute a simple flow', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Navigate to flows
      await page.click('[data-testid="flows-tab"]');
      await page.waitForSelector('[data-testid="flows-section"]');
      
      // Create new flow
      await page.click('[data-testid="create-flow-button"]');
      await page.fill('[data-testid="flow-name-input"]', 'Smoke Test Flow');
      
      // Add a simple command
      await page.click('[data-testid="add-step-button"]');
      await page.selectOption('[data-testid="step-type-select"]', 'command');
      await page.fill('[data-testid="step-command-input"]', 'echo "Smoke test passed"');
      
      // Save flow
      await page.click('[data-testid="save-flow-button"]');
      await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
      
      // Execute flow
      await page.click('[data-testid="flow-item"]:has-text("Smoke Test Flow")');
      await page.click('[data-testid="run-flow-button"]');
      
      // Wait for execution
      await expect(page.locator('[data-testid="execution-status"]')).toContainText('Running');
      await expect(page.locator('[data-testid="terminal-output"]')).toContainText('Smoke test passed', {
        timeout: 10000
      });
      await expect(page.locator('[data-testid="execution-status"]')).toContainText('Completed');
    });
  });
});