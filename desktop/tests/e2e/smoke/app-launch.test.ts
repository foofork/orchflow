/**
 * App Launch Smoke Test
 * Validates that the application launches successfully and core components are accessible
 */

import { test, describe, beforeEach, afterEach } from 'vitest';
import { expect } from '@playwright/test';
import { TestContext, withTestContext } from '../helpers/test-context';
import { WaitStrategies } from '../helpers/utils/wait-strategies';

describe('App Launch Smoke Tests', () => {
  // Each test uses its own isolated context to prevent parallel execution conflicts
  
  test('application launches successfully', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      
      // Navigate to application
      await page.goto(baseUrl);
      
      // Wait for app to be ready
      await WaitStrategies.smartWait(page, {
        networkIdle: true,
        animations: true,
        customCheck: async () => {
          const appContainer = await page.locator('.app').count();
          return appContainer > 0;
        }
      });
      
      // Verify critical elements are present
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('.main-content')).toBeVisible();
      await expect(page.locator('.welcome')).toBeVisible();
      
      // Verify welcome message
      await expect(page.locator('h1')).toContainText('Welcome to OrchFlow');
      
      // Verify quick actions are present
      await expect(page.locator('.quick-actions')).toBeVisible();
      await expect(page.locator('.quick-action')).toHaveCount(4);
    });
  });
  
  test('navigation menu is functional', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Verify welcome screen is shown initially
      await expect(page.locator('.welcome')).toBeVisible();
      
      // Test quick action buttons work
      const quickActions = await page.locator('.quick-action').all();
      expect(quickActions.length).toBeGreaterThan(0);
      
      // Test opening terminal via quick action
      const terminalAction = page.locator('.quick-action').filter({ hasText: 'Open Terminal' });
      await terminalAction.click();
      
      // Verify terminal tab was created
      await expect(page.locator('.tab-bar-container')).toBeVisible();
      await expect(page.locator('.editor-pane')).toBeVisible();
    });
  });
  
  test('critical features are accessible', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Verify basic layout components
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('.main-content')).toBeVisible();
      
      // Test command palette
      const commandPaletteAction = page.locator('.quick-action').filter({ hasText: 'Command Palette' });
      await commandPaletteAction.click();
      
      // Wait for command palette to appear (should be handled by app)
      await page.waitForTimeout(500);
      
      // Test file explorer access
      const explorerAction = page.locator('.quick-action').filter({ hasText: 'File Explorer' });
      await explorerAction.click();
      
      // Verify status bar is present
      await expect(page.locator('.status-bar')).toBeVisible();
    });
  });
  
  test('application handles deep links', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      
      // Test basic navigation and page structure
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Verify app loads correctly
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('.welcome')).toBeVisible();
      
      // Test settings page route
      await page.goto(`${baseUrl}/settings`);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Should still show the main app (SPA)
      await expect(page.locator('.app')).toBeVisible();
    });
  });
  
  test('desktop layout adapts to different window sizes', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      
      const desktopViewports = [
        { width: 1920, height: 1080, name: 'large-desktop' },
        { width: 1366, height: 768, name: 'standard-desktop' },
        { width: 1024, height: 768, name: 'small-desktop' }
      ];
      
      for (const viewport of desktopViewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(baseUrl);
        await WaitStrategies.waitForNetworkIdle(page);
        
        // Verify main app components are visible at all desktop sizes
        await expect(page.locator('.app')).toBeVisible();
        await expect(page.locator('.main-content')).toBeVisible();
        await expect(page.locator('.welcome')).toBeVisible();
      }
    });
  });
  
  test('performance metrics are acceptable', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      
      // Navigate and measure performance
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Get performance metrics for desktop app
      const metrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        return {
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          timeToInteractive: navigation.domInteractive - navigation.fetchStart
        };
      });
      
      // Assert reasonable performance thresholds for desktop app
      expect(metrics.domContentLoaded).toBeLessThan(5000); // 5 seconds (relaxed for E2E)
      expect(metrics.loadComplete).toBeLessThan(8000); // 8 seconds 
      expect(metrics.timeToInteractive).toBeLessThan(6000); // 6 seconds
    });
  });
  
  test('app loads gracefully with network issues', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      
      // Simulate network error for any potential API calls
      await page.route('**/api/**', route => {
        route.abort('failed');
      });
      
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Desktop app should still load and show welcome screen despite network issues
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('.welcome')).toBeVisible();
      await expect(page.locator('h1')).toContainText('Welcome to OrchFlow');
      
      // Quick actions should still be functional
      await expect(page.locator('.quick-actions')).toBeVisible();
    });
  });
  
  test('local storage is initialized correctly', async () => {
    await withTestContext(async (context) => {
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
  });
  
  test('keyboard navigation works', async () => {
    await withTestContext(async (context) => {
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
});

/**
 * Critical Desktop App User Journey
 * Tests the core desktop app functionality
 */
describe('Critical Desktop App Smoke Test', () => {
  test('user can open terminal and interact with the app', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Verify welcome screen is displayed
      await expect(page.locator('.welcome')).toBeVisible();
      await expect(page.locator('h1')).toContainText('Welcome to OrchFlow');
      
      // Open terminal via quick action (real user flow)
      await page.click('.quick-action:has-text("Open Terminal")');
      
      // Verify terminal tab was created and is active
      await expect(page.locator('.tab-bar-container')).toBeVisible();
      await expect(page.locator('.editor-pane')).toBeVisible();
      
      // In the desktop app, opening terminal creates a tab and shows terminal content
      // The welcome screen gets replaced by the terminal interface
      await page.waitForTimeout(1000); // Give time for terminal to initialize
      
      // Test command palette functionality
      await page.keyboard.press('Control+p');
      // Command palette should open (handled by the app's keyboard shortcuts)
      
      // Test status bar is present
      await expect(page.locator('.status-bar')).toBeVisible();
    });
  });
  
  test('user can navigate between app views', async () => {
    await withTestContext(async (context) => {
      const { page, baseUrl } = await context.createPage();
      await page.goto(baseUrl);
      await WaitStrategies.waitForNetworkIdle(page);
      
      // Start from welcome screen
      await expect(page.locator('.welcome')).toBeVisible();
      
      // Open file explorer via quick action
      await page.click('.quick-action:has-text("File Explorer")');
      
      // Should still have main app structure
      await expect(page.locator('.app')).toBeVisible();
      await expect(page.locator('.main-content')).toBeVisible();
      
      // Open settings via quick action
      await page.click('.quick-action:has-text("Settings")');
      
      // Settings modal should open (or similar functionality)
      await page.waitForTimeout(500); // Give time for settings to process
      
      // App should remain stable
      await expect(page.locator('.app')).toBeVisible();
    });
  });
});