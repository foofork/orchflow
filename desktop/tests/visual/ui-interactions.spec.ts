import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Complex UI Interactions Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should capture drag and drop interactions', async ({ page }) => {
    // Look for draggable elements
    const draggable = await page.locator('[draggable="true"], .draggable').first();
    const dropzone = await page.locator('.dropzone, [data-drop-zone]').first();
    
    if (await draggable.count() > 0 && await dropzone.count() > 0) {
      // Capture initial state
      await expect(page).toHaveScreenshot('drag-drop-initial.png');
      
      // Start drag
      await draggable.hover();
      await page.mouse.down();
      await page.waitForTimeout(100);
      
      // Capture during drag
      const box = await dropzone.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await expect(page).toHaveScreenshot('drag-drop-dragging.png');
        
        // Drop
        await page.mouse.up();
        await page.waitForTimeout(300);
        await expect(page).toHaveScreenshot('drag-drop-completed.png');
      }
    }
  });

  test('should capture tooltip interactions', async ({ page }) => {
    // Find elements with tooltips
    const tooltipTriggers = await page.locator('[title], [data-tooltip], [aria-describedby]').all();
    
    for (let i = 0; i < Math.min(tooltipTriggers.length, 3); i++) {
      const trigger = tooltipTriggers[i];
      
      // Hover to show tooltip
      await trigger.hover();
      await page.waitForTimeout(500); // Wait for tooltip animation
      
      // Check if tooltip is visible
      const tooltip = await page.locator('.tooltip, [role="tooltip"]').first();
      if (await tooltip.count() > 0 && await tooltip.isVisible()) {
        await expect(page).toHaveScreenshot(`tooltip-visible-${i}.png`);
      }
      
      // Move away to hide tooltip
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    }
  });

  test('should capture modal interactions and focus trap', async ({ page }) => {
    const modalTrigger = await page.locator('button:has-text("Settings"), button:has-text("Create"), button:has-text("New")').first();
    
    if (await modalTrigger.count() > 0) {
      // Open modal
      await modalTrigger.click();
      await page.waitForTimeout(300);
      
      const modal = await page.locator('[role="dialog"], .modal').first();
      if (await modal.count() > 0) {
        // Capture modal open state
        await expect(page).toHaveScreenshot('modal-open.png', {
          fullPage: true,
          animations: 'disabled',
        });
        
        // Test focus trap by tabbing
        await page.keyboard.press('Tab');
        await expect(page).toHaveScreenshot('modal-focus-first.png');
        
        await page.keyboard.press('Tab');
        await expect(page).toHaveScreenshot('modal-focus-second.png');
        
        // Test backdrop click
        const backdrop = await page.locator('.modal-backdrop, .overlay').first();
        if (await backdrop.count() > 0) {
          await backdrop.click({ position: { x: 10, y: 10 } });
          await page.waitForTimeout(300);
          await expect(page).toHaveScreenshot('modal-after-backdrop-click.png');
        }
      }
    }
  });

  test('should capture dropdown and select interactions', async ({ page }) => {
    // Test native select
    const select = await page.locator('select').first();
    if (await select.count() > 0) {
      await select.click();
      await page.waitForTimeout(200);
      await expect(select).toHaveScreenshot('select-open.png');
      
      await select.selectOption({ index: 1 });
      await expect(select).toHaveScreenshot('select-selected.png');
    }
    
    // Test custom dropdown
    const dropdown = await page.locator('[role="combobox"], .dropdown').first();
    if (await dropdown.count() > 0) {
      await dropdown.click();
      await page.waitForTimeout(300);
      
      const dropdownMenu = await page.locator('[role="listbox"], .dropdown-menu').first();
      if (await dropdownMenu.count() > 0) {
        await expect(page).toHaveScreenshot('dropdown-open.png');
        
        // Hover over options
        const options = await dropdownMenu.locator('[role="option"], .dropdown-item').all();
        if (options.length > 0) {
          await options[0].hover();
          await expect(dropdownMenu).toHaveScreenshot('dropdown-hover.png');
          
          await options[0].click();
          await page.waitForTimeout(200);
          await expect(page).toHaveScreenshot('dropdown-selected.png');
        }
      }
    }
  });

  test('should capture accordion and collapsible interactions', async ({ page }) => {
    const accordionHeaders = await page.locator('[role="button"][aria-expanded], .accordion-header').all();
    
    for (let i = 0; i < Math.min(accordionHeaders.length, 3); i++) {
      const header = accordionHeaders[i];
      
      // Capture closed state
      await expect(header).toHaveScreenshot(`accordion-closed-${i}.png`);
      
      // Click to expand
      await header.click();
      await page.waitForTimeout(300); // Wait for animation
      
      // Capture open state
      const panel = await header.locator('~ [role="region"], ~ .accordion-panel').first();
      if (await panel.count() > 0) {
        await expect(page).toHaveScreenshot(`accordion-open-${i}.png`);
      }
      
      // Click to collapse
      await header.click();
      await page.waitForTimeout(300);
    }
  });

  test('should capture tab navigation', async ({ page }) => {
    const tabList = await page.locator('[role="tablist"]').first();
    
    if (await tabList.count() > 0) {
      const tabs = await tabList.locator('[role="tab"]').all();
      
      for (let i = 0; i < Math.min(tabs.length, 4); i++) {
        await tabs[i].click();
        await page.waitForTimeout(300);
        
        await expect(page).toHaveScreenshot(`tabs-active-${i}.png`);
        
        // Test keyboard navigation
        if (i === 0) {
          await tabs[i].press('ArrowRight');
          await page.waitForTimeout(200);
          await expect(page).toHaveScreenshot('tabs-keyboard-nav.png');
        }
      }
    }
  });

  test('should capture slider and range input interactions', async ({ page }) => {
    const sliders = await page.locator('input[type="range"], [role="slider"]').all();
    
    for (let i = 0; i < Math.min(sliders.length, 2); i++) {
      const slider = sliders[i];
      const box = await slider.boundingBox();
      
      if (box) {
        // Capture initial state
        await expect(slider).toHaveScreenshot(`slider-initial-${i}.png`);
        
        // Drag to middle
        await slider.hover();
        await page.mouse.down();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.up();
        await expect(slider).toHaveScreenshot(`slider-middle-${i}.png`);
        
        // Drag to end
        await slider.hover();
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 10, box.y + box.height / 2);
        await page.mouse.up();
        await expect(slider).toHaveScreenshot(`slider-end-${i}.png`);
      }
    }
  });

  test('should capture context menu interactions', async ({ page }) => {
    // Find elements that might have context menus
    const contextTargets = await page.locator('.file-item, .list-item, [data-context-menu]').all();
    
    for (let i = 0; i < Math.min(contextTargets.length, 2); i++) {
      const target = contextTargets[i];
      
      // Right-click to open context menu
      await target.click({ button: 'right' });
      await page.waitForTimeout(200);
      
      const contextMenu = await page.locator('.context-menu, [role="menu"]').first();
      if (await contextMenu.count() > 0 && await contextMenu.isVisible()) {
        await expect(page).toHaveScreenshot(`context-menu-${i}.png`);
        
        // Hover over menu items
        const menuItems = await contextMenu.locator('[role="menuitem"], .menu-item').all();
        if (menuItems.length > 0) {
          await menuItems[0].hover();
          await expect(contextMenu).toHaveScreenshot(`context-menu-hover-${i}.png`);
        }
        
        // Close menu
        await page.keyboard.press('Escape');
        await page.waitForTimeout(200);
      }
    }
  });

  test('should capture loading and progress indicators', async ({ page }) => {
    // Look for buttons that might trigger loading states
    const actionButtons = await page.locator('button:has-text("Save"), button:has-text("Submit"), button:has-text("Load")').all();
    
    for (let i = 0; i < Math.min(actionButtons.length, 2); i++) {
      const button = actionButtons[i];
      
      // Intercept network requests to simulate loading
      await page.route('**/api/**', async route => {
        await page.waitForTimeout(1000); // Simulate delay
        await route.continue();
      });
      
      // Click and capture loading state
      const clickPromise = button.click();
      await page.waitForTimeout(100); // Small delay to capture loading state
      
      // Look for loading indicators
      const spinner = await page.locator('.spinner, .loading, [role="progressbar"]').first();
      if (await spinner.count() > 0 && await spinner.isVisible()) {
        await expect(page).toHaveScreenshot(`loading-state-${i}.png`);
      }
      
      await clickPromise;
      await page.unroute('**/api/**');
    }
  });

  test('should capture form validation states', async ({ page }) => {
    const forms = await page.locator('form').all();
    
    for (let i = 0; i < Math.min(forms.length, 2); i++) {
      const form = forms[i];
      
      // Find required inputs
      const requiredInputs = await form.locator('input[required], select[required], textarea[required]').all();
      
      if (requiredInputs.length > 0) {
        // Try to submit empty form
        const submitButton = await form.locator('button[type="submit"], input[type="submit"]').first();
        if (await submitButton.count() > 0) {
          await submitButton.click();
          await page.waitForTimeout(300);
          
          // Capture validation errors
          await expect(form).toHaveScreenshot(`form-validation-errors-${i}.png`);
          
          // Fill first input and capture
          await requiredInputs[0].fill('Test Value');
          await expect(form).toHaveScreenshot(`form-partial-valid-${i}.png`);
        }
      }
    }
  });

  test('should capture keyboard shortcuts and focus indicators', async ({ page }) => {
    // Test global keyboard shortcuts
    await page.keyboard.press('Control+k'); // Common search shortcut
    await page.waitForTimeout(300);
    
    const searchModal = await page.locator('[role="search"], .search-modal').first();
    if (await searchModal.count() > 0 && await searchModal.isVisible()) {
      await expect(page).toHaveScreenshot('keyboard-shortcut-search.png');
      await page.keyboard.press('Escape');
    }
    
    // Test focus indicators
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-indicator-1.png');
    
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-indicator-2.png');
    
    await page.keyboard.press('Tab');
    await expect(page).toHaveScreenshot('focus-indicator-3.png');
  });
});