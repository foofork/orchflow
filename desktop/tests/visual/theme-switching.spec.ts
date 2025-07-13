import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Theme Switching Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should capture theme transition animations', async ({ page }) => {
    // Capture initial light theme
    await expect(page).toHaveScreenshot('theme-light-initial.png', {
      fullPage: true,
      animations: 'disabled',
    });

    // Find theme toggle
    const themeToggle = await page.locator('[data-testid="theme-toggle"], [aria-label*="theme"], button:has-text("Theme")').first();
    
    if (await themeToggle.count() > 0) {
      // Enable animations for transition capture
      await page.evaluate(() => {
        document.documentElement.style.transition = 'all 0.3s ease';
      });

      // Click to switch to dark theme
      await themeToggle.click();
      
      // Capture during transition
      await page.waitForTimeout(150); // Mid-transition
      await expect(page).toHaveScreenshot('theme-transition-mid.png', {
        fullPage: true,
      });

      // Wait for transition complete
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('theme-dark-complete.png', {
        fullPage: true,
        animations: 'disabled',
      });

      // Switch back to light
      await themeToggle.click();
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('theme-light-restored.png', {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should maintain theme across different components', async ({ page }) => {
    // Switch to dark theme
    const themeToggle = await page.locator('[data-testid="theme-toggle"]').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }

    // Test various components in dark theme
    const components = [
      { selector: '.file-explorer', name: 'file-explorer' },
      { selector: '.cm-editor', name: 'code-editor' },
      { selector: '.terminal', name: 'terminal' },
      { selector: '[role="dialog"]', name: 'dialog', action: async () => {
        const dialogTrigger = await page.locator('button:has-text("Settings")').first();
        if (await dialogTrigger.count() > 0) {
          await dialogTrigger.click();
          await page.waitForTimeout(200);
        }
      }},
      { selector: '[role="menu"]', name: 'menu', action: async () => {
        const menuTrigger = await page.locator('[aria-haspopup="menu"]').first();
        if (await menuTrigger.count() > 0) {
          await menuTrigger.click();
          await page.waitForTimeout(200);
        }
      }},
    ];

    for (const component of components) {
      if (component.action) {
        await component.action();
      }

      const element = await page.locator(component.selector).first();
      if (await element.count() > 0) {
        await expect(element).toHaveScreenshot(`theme-dark-${component.name}.png`);
      }

      // Close if needed
      if (component.action) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should handle system preference changes', async ({ page }) => {
    // Test prefers-color-scheme media query
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('theme-system-dark.png', {
      fullPage: true,
      animations: 'disabled',
    });

    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('theme-system-light.png', {
      fullPage: true,
      animations: 'disabled',
    });

    // Test with no preference
    await page.emulateMedia({ colorScheme: 'no-preference' });
    await page.waitForTimeout(300);
    await expect(page).toHaveScreenshot('theme-system-default.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should maintain contrast ratios in both themes', async ({ page }) => {
    const testElements = [
      { selector: 'button', name: 'buttons' },
      { selector: 'input', name: 'inputs' },
      { selector: 'a', name: 'links' },
      { selector: '.text-primary', name: 'primary-text' },
      { selector: '.text-secondary', name: 'secondary-text' },
    ];

    // Test in light theme
    for (const element of testElements) {
      const el = await page.locator(element.selector).first();
      if (await el.count() > 0) {
        await expect(el).toHaveScreenshot(`contrast-light-${element.name}.png`);
      }
    }

    // Switch to dark theme
    const themeToggle = await page.locator('[data-testid="theme-toggle"]').first();
    if (await themeToggle.count() > 0) {
      await themeToggle.click();
      await page.waitForTimeout(300);
    }

    // Test in dark theme
    for (const element of testElements) {
      const el = await page.locator(element.selector).first();
      if (await el.count() > 0) {
        await expect(el).toHaveScreenshot(`contrast-dark-${element.name}.png`);
      }
    }
  });
});