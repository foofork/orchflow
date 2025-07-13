import { test, expect, devices } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Responsive Design Visual Tests', () => {
  const viewports = [
    { name: 'Mobile-XS', width: 320, height: 568 },
    { name: 'Mobile-S', width: 375, height: 667 },
    { name: 'Mobile-M', width: 390, height: 844 },
    { name: 'Mobile-L', width: 428, height: 926 },
    { name: 'Tablet', width: 768, height: 1024 },
    { name: 'Tablet-Landscape', width: 1024, height: 768 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Desktop', width: 1920, height: 1080 },
    { name: 'Desktop-4K', width: 3840, height: 2160 },
  ];

  const deviceProfiles = [
    { name: 'iPhone-SE', device: devices['iPhone SE'] },
    { name: 'iPhone-12', device: devices['iPhone 12'] },
    { name: 'iPhone-14-Pro-Max', device: devices['iPhone 14 Pro Max'] },
    { name: 'Pixel-5', device: devices['Pixel 5'] },
    { name: 'Galaxy-S20', device: devices['Galaxy S20'] },
    { name: 'iPad-Mini', device: devices['iPad Mini'] },
    { name: 'iPad-Pro', device: devices['iPad Pro'] },
  ];

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should capture all viewport breakpoints', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Wait for responsive adjustments
      
      await expect(page).toHaveScreenshot(`responsive-${viewport.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should handle layout transitions between breakpoints', async ({ page }) => {
    // Start with mobile
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Gradually increase width to capture breakpoint transitions
    const transitionPoints = [375, 480, 640, 768, 1024, 1280, 1536, 1920];
    
    for (const width of transitionPoints) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(300);
      
      await expect(page).toHaveScreenshot(`responsive-transition-${width}px.png`, {
        fullPage: true,
        animations: 'disabled',
      });
    }
  });

  test('should test responsive navigation menu', async ({ page }) => {
    // Test mobile hamburger menu
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const hamburger = await page.locator('[data-testid="mobile-menu-toggle"], .hamburger-menu');
    if (await hamburger.count() > 0) {
      await expect(page).toHaveScreenshot('responsive-mobile-menu-closed.png');
      
      await hamburger.click();
      await page.waitForTimeout(300);
      await expect(page).toHaveScreenshot('responsive-mobile-menu-open.png');
    }
    
    // Test desktop navigation
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('responsive-desktop-navigation.png');
  });

  test('should test responsive grid layouts', async ({ page }) => {
    // Navigate to a page with grid layout (if exists)
    const gridContainer = await page.locator('.grid, [class*="grid"]').first();
    
    if (await gridContainer.count() > 0) {
      const gridBreakpoints = [
        { name: 'mobile-1-col', width: 375 },
        { name: 'tablet-2-col', width: 768 },
        { name: 'desktop-3-col', width: 1280 },
        { name: 'wide-4-col', width: 1920 },
      ];
      
      for (const breakpoint of gridBreakpoints) {
        await page.setViewportSize({ width: breakpoint.width, height: 800 });
        await page.waitForTimeout(500);
        
        await expect(gridContainer).toHaveScreenshot(`responsive-grid-${breakpoint.name}.png`);
      }
    }
  });

  test('should test responsive text and typography', async ({ page }) => {
    const typographyViewports = [
      { name: 'mobile', width: 375 },
      { name: 'tablet', width: 768 },
      { name: 'desktop', width: 1920 },
    ];
    
    for (const viewport of typographyViewports) {
      await page.setViewportSize({ width: viewport.width, height: 800 });
      await page.waitForTimeout(500);
      
      // Test different text elements
      const textElements = [
        { selector: 'h1', name: 'heading1' },
        { selector: 'h2', name: 'heading2' },
        { selector: 'p', name: 'paragraph' },
        { selector: '.button, button', name: 'button' },
      ];
      
      for (const element of textElements) {
        const el = await page.locator(element.selector).first();
        if (await el.count() > 0) {
          await expect(el).toHaveScreenshot(`responsive-typography-${viewport.name}-${element.name}.png`);
        }
      }
    }
  });

  test('should test responsive sidebar behavior', async ({ page }) => {
    const sidebar = await page.locator('.sidebar, [data-testid="sidebar"]').first();
    
    if (await sidebar.count() > 0) {
      // Mobile: sidebar should be hidden or overlay
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('responsive-sidebar-mobile.png');
      
      // Tablet: sidebar might be collapsible
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('responsive-sidebar-tablet.png');
      
      // Desktop: sidebar should be visible
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(500);
      await expect(page).toHaveScreenshot('responsive-sidebar-desktop.png');
    }
  });

  test('should test responsive modals and dialogs', async ({ page }) => {
    const dialogTrigger = await page.locator('button:has-text("Settings"), button:has-text("New")').first();
    
    if (await dialogTrigger.count() > 0) {
      const modalViewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 },
      ];
      
      for (const viewport of modalViewports) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.waitForTimeout(500);
        
        await dialogTrigger.click();
        await page.waitForTimeout(300);
        
        const dialog = await page.locator('[role="dialog"], .modal').first();
        if (await dialog.count() > 0) {
          await expect(page).toHaveScreenshot(`responsive-modal-${viewport.name}.png`, {
            fullPage: true,
            animations: 'disabled',
          });
        }
        
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should test responsive touch targets', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Verify touch target sizes
    const touchTargets = await page.locator('button, a, input, select, [role="button"]').all();
    
    for (let i = 0; i < Math.min(touchTargets.length, 5); i++) {
      const target = touchTargets[i];
      const box = await target.boundingBox();
      
      if (box) {
        // Touch targets should be at least 44x44 pixels on mobile
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
    
    await expect(page).toHaveScreenshot('responsive-touch-targets.png');
  });

  test('should test responsive overflow handling', async ({ page }) => {
    const overflowViewports = [
      { name: 'mobile-portrait', width: 375, height: 667 },
      { name: 'mobile-landscape', width: 667, height: 375 },
      { name: 'tablet-portrait', width: 768, height: 1024 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
    ];
    
    for (const viewport of overflowViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Test horizontal scrolling
      const scrollableElements = await page.locator('[style*="overflow"], .scrollable').all();
      
      for (let i = 0; i < Math.min(scrollableElements.length, 3); i++) {
        const element = scrollableElements[i];
        await expect(element).toHaveScreenshot(`responsive-overflow-${viewport.name}-${i}.png`);
      }
    }
  });

  // Test with actual device emulation
  for (const profile of deviceProfiles) {
    test(`should render correctly on ${profile.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...profile.device,
      });
      const page = await context.newPage();
      
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      await expect(page).toHaveScreenshot(`responsive-device-${profile.name}.png`, {
        fullPage: true,
        animations: 'disabled',
      });
      
      await context.close();
    });
  }
});