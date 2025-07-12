import { test, expect } from '@playwright/test';

// Import our custom types
import type { Page } from '@playwright/test';

test.describe('Application Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should capture full application layout', async ({ page }) => {
    // Wait for main components to be visible
    await page.waitForSelector('.app-container', { timeout: 10000 });
    
    // Take Percy snapshot (disabled for now)
    // // await percySnapshot(page, 'Application - Full Layout');
    
    // Take Playwright screenshot
    await expect(page).toHaveScreenshot('app-full-layout.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture file explorer panel', async ({ page }) => {
    // Wait for file explorer
    const fileExplorer = await page.waitForSelector('.file-explorer', { 
      timeout: 10000,
      state: 'visible' 
    });
    
    if (fileExplorer) {
      // Take Percy snapshot
      // await percySnapshot(page, 'File Explorer Panel');
      
      // Take Playwright screenshot
      await expect(fileExplorer).toHaveScreenshot('file-explorer.png', {
        animations: 'disabled',
      });
    }
  });

  test('should capture different viewport sizes', async ({ page }) => {
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop HD' },
      { width: 1366, height: 768, name: 'Laptop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' },
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Wait for responsive adjustments
      
      // Take Percy snapshot
      // await percySnapshot(page, `Application - ${viewport.name}`);
      
      // Take Playwright screenshot
      await expect(page).toHaveScreenshot(`app-${viewport.name.toLowerCase().replace(' ', '-')}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should capture sidebar states', async ({ page }) => {
    // Test with sidebar open (default)
    // await percySnapshot(page, 'Application - Sidebar Open');
    
    // Toggle sidebar if there's a toggle button
    const sidebarToggle = await page.locator('[data-testid="sidebar-toggle"]');
    if (await sidebarToggle.count() > 0) {
      await sidebarToggle.click();
      await page.waitForTimeout(300); // Wait for animation
      
      // Take Percy snapshot with sidebar closed
      // await percySnapshot(page, 'Application - Sidebar Closed');
      
      // Take Playwright screenshot
      await expect(page).toHaveScreenshot('app-sidebar-closed.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should capture menu states', async ({ page }) => {
    // Look for menu buttons
    const menuButtons = await page.locator('[role="menu"], [aria-haspopup="menu"]');
    
    if (await menuButtons.count() > 0) {
      // Click first menu
      await menuButtons.first().click();
      await page.waitForTimeout(200); // Wait for menu animation
      
      // Take Percy snapshot with menu open
      // await percySnapshot(page, 'Application - Menu Open');
      
      // Take Playwright screenshot
      await expect(page).toHaveScreenshot('app-menu-open.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should capture dialog/modal states', async ({ page }) => {
    // Look for buttons that might open dialogs
    const dialogTriggers = await page.locator('button:has-text("Settings"), button:has-text("Preferences"), button:has-text("New")');
    
    if (await dialogTriggers.count() > 0) {
      await dialogTriggers.first().click();
      
      // Wait for dialog to appear
      const dialog = await page.waitForSelector('[role="dialog"], .modal, .dialog', {
        timeout: 5000,
        state: 'visible'
      }).catch(() => null);
      
      if (dialog) {
        await page.waitForTimeout(300); // Wait for animation
        
        // Take Percy snapshot with dialog open
        // await percySnapshot(page, 'Application - Dialog Open');
        
        // Take Playwright screenshot
        await expect(page).toHaveScreenshot('app-dialog-open.png', {
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  });

  test('should capture dark mode', async ({ page }) => {
    // Toggle dark mode if available
    const darkModeToggle = await page.locator('[data-testid="theme-toggle"], [aria-label*="theme"], button:has-text("Dark")');
    
    if (await darkModeToggle.count() > 0) {
      await darkModeToggle.click();
      await page.waitForTimeout(300); // Wait for theme transition
      
      // Take Percy snapshot in dark mode
      // await percySnapshot(page, 'Application - Dark Mode');
      
      // Take Playwright screenshot
      await expect(page).toHaveScreenshot('app-dark-mode.png', {
        fullPage: true,
        animations: 'disabled',
      });
    } else {
      // Fallback: Add dark class directly
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      await page.waitForTimeout(300);
      
      // await percySnapshot(page, 'Application - Dark Mode (Forced)');
    }
  });

  test('should capture loading states', async ({ page }) => {
    // Refresh to capture loading state
    const responsePromise = page.waitForResponse(response => response.status() === 200);
    await page.reload();
    
    // Try to capture loading state quickly
    // await percySnapshot(page, 'Application - Loading State');
    
    // Wait for load to complete
    await responsePromise;
    await page.waitForLoadState('networkidle');
  });

  test('should capture error states', async ({ page }) => {
    // Simulate an error condition
    await page.route('**/api/**', route => {
      route.abort('failed');
    });
    
    // Trigger an action that would cause an error
    const errorTrigger = await page.locator('button').first();
    if (await errorTrigger.count() > 0) {
      await errorTrigger.click().catch(() => {});
      await page.waitForTimeout(1000);
      
      // Look for error messages
      const errorMessage = await page.waitForSelector('.error, [role="alert"], .toast-error', {
        timeout: 5000,
        state: 'visible'
      }).catch(() => null);
      
      if (errorMessage) {
        // Take Percy snapshot with error state
        // await percySnapshot(page, 'Application - Error State');
        
        // Take Playwright screenshot
        await expect(page).toHaveScreenshot('app-error-state.png', {
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  });
});