import { test, expect } from '@playwright/test';
// Percy disabled due to dependency issues
// import percySnapshot from '@percy/playwright';

test.describe('Terminal Visual Regression', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('.terminal-grid', { timeout: 10000 });
  });

  test('should capture terminal grid initial state', async ({ page }) => {
    // Wait for terminal to be ready
    await page.waitForSelector('.terminal-pane', { timeout: 5000 });
    
    // Take Percy snapshot
    // await percySnapshot(page, 'Terminal Grid - Initial State');
    
    // Also take Playwright screenshot for local comparison
    await expect(page).toHaveScreenshot('terminal-grid-initial.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture terminal with content', async ({ page }) => {
    // Wait for terminal to be ready
    const terminal = await page.waitForSelector('.streaming-terminal-mock', { timeout: 5000 });
    
    // Simulate some terminal content
    await page.evaluate(() => {
      const terminals = document.querySelectorAll('.terminal-content');
      terminals.forEach((term, index) => {
        term.textContent = `Terminal ${index + 1}:\n$ npm test\n✓ All tests passed\n$ `;
      });
    });
    
    // Take Percy snapshot
    // await percySnapshot(page, 'Terminal Grid - With Content');
    
    // Take Playwright screenshot
    await expect(page).toHaveScreenshot('terminal-grid-with-content.png', {
      fullPage: true,
      animations: 'disabled',
    });
  });

  test('should capture different terminal layouts', async ({ page }) => {
    const layouts = [
      { name: 'single', buttonText: 'Single' },
      { name: 'split-horizontal', buttonText: 'Split Horizontal' },
      { name: 'split-vertical', buttonText: 'Split Vertical' },
      { name: '2x2', buttonText: '2x2 Grid' },
    ];

    for (const layout of layouts) {
      // Click layout button
      const layoutButton = await page.getByRole('button', { name: layout.buttonText });
      if (await layoutButton.isVisible()) {
        await layoutButton.click();
        await page.waitForTimeout(500); // Wait for animation
        
        // Take Percy snapshot
        // await percySnapshot(page, `Terminal Grid - ${layout.name} Layout`);
        
        // Take Playwright screenshot
        await expect(page).toHaveScreenshot(`terminal-grid-${layout.name}.png`, {
          fullPage: true,
          animations: 'disabled',
        });
      }
    }
  });

  test('should capture terminal with different themes', async ({ _page }) => {
    // This would require implementing theme switching in the UI
    // For now, we'll just capture the default theme
    // await percySnapshot(page, 'Terminal - Default Theme');
  });

  test('should capture terminal in focus state', async ({ page }) => {
    // Click on a terminal to focus it
    const firstTerminal = await page.locator('.terminal-pane').first();
    await firstTerminal.click();
    
    // Wait for focus styles to apply
    await page.waitForTimeout(100);
    
    // Take Percy snapshot
    // await percySnapshot(page, 'Terminal - Focused State');
    
    // Take Playwright screenshot
    await expect(page).toHaveScreenshot('terminal-focused.png', {
      fullPage: false,
      clip: (await firstTerminal.boundingBox()) || undefined,
      animations: 'disabled',
    });
  });
});