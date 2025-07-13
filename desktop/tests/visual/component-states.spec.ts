import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Component States Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should capture all button states', async ({ page }) => {
    const buttonTypes = [
      'button:not([disabled])',
      'button[disabled]',
      '[role="button"]',
      'a.button',
      'input[type="submit"]',
      'input[type="button"]',
    ];

    for (const selector of buttonTypes) {
      const buttons = await page.locator(selector).all();
      
      for (let i = 0; i < Math.min(buttons.length, 2); i++) {
        const button = buttons[i];
        
        // Normal state
        await expect(button).toHaveScreenshot(`button-state-normal-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Hover state
        await button.hover();
        await page.waitForTimeout(100);
        await expect(button).toHaveScreenshot(`button-state-hover-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Focus state
        await button.focus();
        await expect(button).toHaveScreenshot(`button-state-focus-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Active state (mousedown)
        const box = await button.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await expect(button).toHaveScreenshot(`button-state-active-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
          await page.mouse.up();
        }
        
        // Reset
        await page.mouse.move(0, 0);
        await button.blur();
      }
    }
  });

  test('should capture all input states', async ({ page }) => {
    const inputTypes = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="password"]',
      'input[type="number"]',
      'input[type="search"]',
      'input[type="tel"]',
      'input[type="url"]',
      'textarea',
    ];

    for (const selector of inputTypes) {
      const inputs = await page.locator(selector).all();
      
      for (let i = 0; i < Math.min(inputs.length, 2); i++) {
        const input = inputs[i];
        
        // Empty state
        await expect(input).toHaveScreenshot(`input-empty-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Focus state
        await input.focus();
        await expect(input).toHaveScreenshot(`input-focus-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Typing state
        await input.fill('Test');
        await expect(input).toHaveScreenshot(`input-typing-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Filled state
        await input.fill('Test content for input field');
        await input.blur();
        await expect(input).toHaveScreenshot(`input-filled-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        
        // Error state (if validation exists)
        await input.fill('');
        const form = await input.locator('xpath=ancestor::form').first();
        if (await form.count() > 0) {
          const submitButton = await form.locator('button[type="submit"]').first();
          if (await submitButton.count() > 0) {
            await submitButton.click();
            await page.waitForTimeout(200);
            await expect(input).toHaveScreenshot(`input-error-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
          }
        }
        
        // Disabled state (if applicable)
        const isDisabled = await input.isDisabled();
        if (isDisabled) {
          await expect(input).toHaveScreenshot(`input-disabled-${selector.replace(/[\[\]:="]/g, '-')}-${i}.png`);
        }
      }
    }
  });

  test('should capture checkbox and radio states', async ({ page }) => {
    // Checkboxes
    const checkboxes = await page.locator('input[type="checkbox"]').all();
    
    for (let i = 0; i < Math.min(checkboxes.length, 3); i++) {
      const checkbox = checkboxes[i];
      const label = await checkbox.locator('xpath=following-sibling::label|preceding-sibling::label|parent::label').first();
      const container = (await label.count() > 0) ? label : checkbox;
      
      // Unchecked state
      await expect(container).toHaveScreenshot(`checkbox-unchecked-${i}.png`);
      
      // Hover state
      await container.hover();
      await expect(container).toHaveScreenshot(`checkbox-hover-${i}.png`);
      
      // Checked state
      await checkbox.check();
      await expect(container).toHaveScreenshot(`checkbox-checked-${i}.png`);
      
      // Focus state
      await checkbox.focus();
      await expect(container).toHaveScreenshot(`checkbox-focus-${i}.png`);
      
      // Disabled state (if applicable)
      if (await checkbox.isDisabled()) {
        await expect(container).toHaveScreenshot(`checkbox-disabled-${i}.png`);
      }
    }
    
    // Radio buttons
    const radios = await page.locator('input[type="radio"]').all();
    
    for (let i = 0; i < Math.min(radios.length, 3); i++) {
      const radio = radios[i];
      const label = await radio.locator('xpath=following-sibling::label|preceding-sibling::label|parent::label').first();
      const container = (await label.count() > 0) ? label : radio;
      
      // Unselected state
      await expect(container).toHaveScreenshot(`radio-unselected-${i}.png`);
      
      // Hover state
      await container.hover();
      await expect(container).toHaveScreenshot(`radio-hover-${i}.png`);
      
      // Selected state
      await radio.check();
      await expect(container).toHaveScreenshot(`radio-selected-${i}.png`);
      
      // Focus state
      await radio.focus();
      await expect(container).toHaveScreenshot(`radio-focus-${i}.png`);
    }
  });

  test('should capture toggle/switch states', async ({ page }) => {
    const toggles = await page.locator('[role="switch"], .toggle, .switch').all();
    
    for (let i = 0; i < Math.min(toggles.length, 3); i++) {
      const toggle = toggles[i];
      
      // Off state
      await expect(toggle).toHaveScreenshot(`toggle-off-${i}.png`);
      
      // Hover state
      await toggle.hover();
      await expect(toggle).toHaveScreenshot(`toggle-hover-${i}.png`);
      
      // Transition to on
      await toggle.click();
      await page.waitForTimeout(50);
      await expect(toggle).toHaveScreenshot(`toggle-transition-${i}.png`);
      
      await page.waitForTimeout(250);
      // On state
      await expect(toggle).toHaveScreenshot(`toggle-on-${i}.png`);
      
      // Focus state
      await toggle.focus();
      await expect(toggle).toHaveScreenshot(`toggle-focus-${i}.png`);
      
      // Disabled state (if applicable)
      const isDisabled = await toggle.getAttribute('aria-disabled');
      if (isDisabled === 'true') {
        await expect(toggle).toHaveScreenshot(`toggle-disabled-${i}.png`);
      }
    }
  });

  test('should capture link states', async ({ page }) => {
    const links = await page.locator('a[href]').all();
    
    for (let i = 0; i < Math.min(links.length, 5); i++) {
      const link = links[i];
      
      // Normal state
      await expect(link).toHaveScreenshot(`link-normal-${i}.png`);
      
      // Hover state
      await link.hover();
      await expect(link).toHaveScreenshot(`link-hover-${i}.png`);
      
      // Focus state
      await link.focus();
      await expect(link).toHaveScreenshot(`link-focus-${i}.png`);
      
      // Active state
      const box = await link.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down();
        await expect(link).toHaveScreenshot(`link-active-${i}.png`);
        await page.mouse.up();
      }
      
      // Visited state (simulate by adding class)
      await link.evaluate(el => el.classList.add('visited'));
      await expect(link).toHaveScreenshot(`link-visited-${i}.png`);
      await link.evaluate(el => el.classList.remove('visited'));
    }
  });

  test('should capture card and panel states', async ({ page }) => {
    const cards = await page.locator('.card, [role="article"], .panel').all();
    
    for (let i = 0; i < Math.min(cards.length, 3); i++) {
      const card = cards[i];
      
      // Normal state
      await expect(card).toHaveScreenshot(`card-normal-${i}.png`);
      
      // Hover state (if interactive)
      await card.hover();
      await page.waitForTimeout(200);
      await expect(card).toHaveScreenshot(`card-hover-${i}.png`);
      
      // Selected/active state (if applicable)
      const isClickable = await card.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style.cursor === 'pointer';
      });
      
      if (isClickable) {
        await card.click();
        await page.waitForTimeout(200);
        await expect(card).toHaveScreenshot(`card-selected-${i}.png`);
      }
    }
  });

  test('should capture badge and chip states', async ({ page }) => {
    const badges = await page.locator('.badge, .chip, .tag, [role="status"]').all();
    
    for (let i = 0; i < Math.min(badges.length, 5); i++) {
      const badge = badges[i];
      
      // Normal state
      await expect(badge).toHaveScreenshot(`badge-normal-${i}.png`);
      
      // Check if interactive
      const isInteractive = await badge.evaluate(el => {
        return el.tagName === 'BUTTON' || el.hasAttribute('onclick') || el.style.cursor === 'pointer';
      });
      
      if (isInteractive) {
        // Hover state
        await badge.hover();
        await expect(badge).toHaveScreenshot(`badge-hover-${i}.png`);
        
        // Active state
        await badge.click();
        await expect(badge).toHaveScreenshot(`badge-active-${i}.png`);
      }
    }
  });

  test('should capture progress indicator states', async ({ page }) => {
    // Progress bars
    const progressBars = await page.locator('[role="progressbar"], .progress-bar, progress').all();
    
    for (let i = 0; i < Math.min(progressBars.length, 3); i++) {
      const progress = progressBars[i];
      
      // Different progress values
      const values = [0, 25, 50, 75, 100];
      
      for (const value of values) {
        await progress.evaluate((el, val) => {
          if (el.tagName === 'PROGRESS') {
            el.value = val;
            el.max = 100;
          } else {
            el.setAttribute('aria-valuenow', val.toString());
            el.style.width = `${val}%`;
          }
        }, value);
        
        await page.waitForTimeout(100);
        await expect(progress).toHaveScreenshot(`progress-bar-${value}-percent-${i}.png`);
      }
    }
    
    // Spinners/loaders
    const spinners = await page.locator('.spinner, .loader, [role="status"]:has-text("Loading")').all();
    
    for (let i = 0; i < Math.min(spinners.length, 2); i++) {
      const spinner = spinners[i];
      
      // Capture multiple frames of spinner animation
      for (let frame = 0; frame < 4; frame++) {
        await page.waitForTimeout(250);
        await expect(spinner).toHaveScreenshot(`spinner-frame-${frame}-${i}.png`);
      }
    }
  });

  test('should capture alert and message states', async ({ page }) => {
    const messageTypes = ['info', 'success', 'warning', 'error', 'danger'];
    const alerts = await page.locator('[role="alert"], .alert, .message, .notification').all();
    
    for (let i = 0; i < Math.min(alerts.length, messageTypes.length); i++) {
      const alert = alerts[i];
      
      // Check if it has a close button
      const closeButton = await alert.locator('button[aria-label*="close"], .close').first();
      
      // Normal state
      await expect(alert).toHaveScreenshot(`alert-${messageTypes[i % messageTypes.length]}.png`);
      
      if (await closeButton.count() > 0) {
        // Hover on close button
        await closeButton.hover();
        await expect(alert).toHaveScreenshot(`alert-${messageTypes[i % messageTypes.length]}-close-hover.png`);
      }
    }
  });

  test('should capture table states', async ({ page }) => {
    const tables = await page.locator('table').all();
    
    for (let i = 0; i < Math.min(tables.length, 2); i++) {
      const table = tables[i];
      
      // Normal state
      await expect(table).toHaveScreenshot(`table-normal-${i}.png`);
      
      // Hover on rows
      const rows = await table.locator('tbody tr').all();
      if (rows.length > 0) {
        await rows[0].hover();
        await expect(table).toHaveScreenshot(`table-row-hover-${i}.png`);
      }
      
      // Selected row (if applicable)
      const selectableRow = await table.locator('tr[aria-selected], tr.selectable').first();
      if (await selectableRow.count() > 0) {
        await selectableRow.click();
        await expect(table).toHaveScreenshot(`table-row-selected-${i}.png`);
      }
      
      // Sortable headers
      const sortableHeaders = await table.locator('th[aria-sort], th.sortable').all();
      if (sortableHeaders.length > 0) {
        await sortableHeaders[0].click();
        await page.waitForTimeout(300);
        await expect(table).toHaveScreenshot(`table-sorted-${i}.png`);
      }
    }
  });
});