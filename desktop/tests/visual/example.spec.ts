import { test, expect } from '@playwright/test';

test.describe('Visual Testing Setup Verification', () => {
  test('should verify Playwright is working', async ({ page }) => {
    // Navigate to Playwright's example page
    await page.goto('https://playwright.dev');
    
    // Take a screenshot to verify setup
    await expect(page).toHaveScreenshot('playwright-homepage.png', {
      fullPage: false,
      animations: 'disabled',
    });
    
    // Verify page title
    await expect(page).toHaveTitle(/Playwright/);
  });

  test('should test viewport responsiveness', async ({ page }) => {
    await page.goto('https://playwright.dev');
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'desktop' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 375, height: 667, name: 'mobile' },
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Wait for responsive adjustments
      
      await expect(page).toHaveScreenshot(`playwright-${viewport.name}.png`, {
        fullPage: false,
        animations: 'disabled',
      });
    }
  });
});