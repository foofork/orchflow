import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe('Animation and Transition Visual Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should capture page load animations', async ({ page }) => {
    // Reload page to capture initial animations
    await page.reload();
    
    // Capture at different stages of page load
    const timestamps = [0, 100, 200, 300, 500, 1000];
    
    for (const timestamp of timestamps) {
      await page.waitForTimeout(timestamp);
      await expect(page).toHaveScreenshot(`page-load-animation-${timestamp}ms.png`, {
        fullPage: true,
      });
    }
  });

  test('should capture button hover and click animations', async ({ page }) => {
    const buttons = await page.locator('button').all();
    
    for (let i = 0; i < Math.min(buttons.length, 3); i++) {
      const button = buttons[i];
      const buttonText = await button.textContent();
      
      // Capture initial state
      await expect(button).toHaveScreenshot(`button-${i}-initial.png`);
      
      // Hover animation
      await button.hover();
      await page.waitForTimeout(50);
      await expect(button).toHaveScreenshot(`button-${i}-hover-start.png`);
      
      await page.waitForTimeout(200);
      await expect(button).toHaveScreenshot(`button-${i}-hover-complete.png`);
      
      // Click animation
      await button.click();
      await page.waitForTimeout(50);
      await expect(button).toHaveScreenshot(`button-${i}-click.png`);
      
      // Move away to reset
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);
    }
  });

  test('should capture sidebar slide animations', async ({ page }) => {
    const sidebarToggle = await page.locator('[data-testid="sidebar-toggle"], .sidebar-toggle').first();
    
    if (await sidebarToggle.count() > 0) {
      // Close sidebar with animation
      await sidebarToggle.click();
      
      // Capture at different stages of animation
      const animationStages = [0, 50, 100, 150, 200, 300];
      
      for (const stage of animationStages) {
        await page.waitForTimeout(stage);
        await expect(page).toHaveScreenshot(`sidebar-close-${stage}ms.png`, {
          fullPage: true,
        });
      }
      
      // Open sidebar with animation
      await sidebarToggle.click();
      
      for (const stage of animationStages) {
        await page.waitForTimeout(stage);
        await expect(page).toHaveScreenshot(`sidebar-open-${stage}ms.png`, {
          fullPage: true,
        });
      }
    }
  });

  test('should capture notification animations', async ({ page }) => {
    // Trigger a notification if possible
    const notificationTriggers = [
      'button:has-text("Save")',
      'button:has-text("Submit")',
      'button:has-text("Copy")',
    ];
    
    for (const trigger of notificationTriggers) {
      const button = await page.locator(trigger).first();
      if (await button.count() > 0) {
        await button.click();
        
        // Wait for notification to appear
        const notification = await page.locator('.notification, .toast, [role="alert"]').first();
        if (await notification.count() > 0) {
          // Capture slide-in animation
          for (const ms of [50, 100, 200, 300]) {
            await page.waitForTimeout(ms);
            await expect(page).toHaveScreenshot(`notification-appear-${ms}ms.png`);
          }
          
          // Wait for auto-dismiss if applicable
          await page.waitForTimeout(3000);
          
          // Capture fade-out animation
          for (const ms of [50, 100, 200]) {
            await page.waitForTimeout(ms);
            await expect(page).toHaveScreenshot(`notification-dismiss-${ms}ms.png`);
          }
          
          break;
        }
      }
    }
  });

  test('should capture accordion expand/collapse animations', async ({ page }) => {
    const accordions = await page.locator('[aria-expanded], .accordion-trigger').all();
    
    for (let i = 0; i < Math.min(accordions.length, 2); i++) {
      const accordion = accordions[i];
      
      // Expand animation
      await accordion.click();
      
      for (const ms of [0, 50, 100, 150, 200, 300]) {
        await page.waitForTimeout(ms);
        await expect(page).toHaveScreenshot(`accordion-${i}-expand-${ms}ms.png`);
      }
      
      // Collapse animation
      await accordion.click();
      
      for (const ms of [0, 50, 100, 150, 200, 300]) {
        await page.waitForTimeout(ms);
        await expect(page).toHaveScreenshot(`accordion-${i}-collapse-${ms}ms.png`);
      }
    }
  });

  test('should capture loading spinner animations', async ({ page }) => {
    // Find or trigger loading states
    const loadingTriggers = await page.locator('button:not([disabled])').all();
    
    for (let i = 0; i < Math.min(loadingTriggers.length, 2); i++) {
      const trigger = loadingTriggers[i];
      
      // Intercept requests to prolong loading
      await page.route('**/api/**', async route => {
        await page.waitForTimeout(2000);
        await route.continue();
      });
      
      // Click to trigger loading
      const clickPromise = trigger.click().catch(() => {});
      
      // Capture spinner animation frames
      for (let frame = 0; frame < 8; frame++) {
        await page.waitForTimeout(100);
        const spinner = await page.locator('.spinner, .loading, [role="progressbar"]').first();
        if (await spinner.count() > 0 && await spinner.isVisible()) {
          await expect(spinner).toHaveScreenshot(`spinner-frame-${frame}.png`);
        }
      }
      
      await clickPromise;
      await page.unroute('**/api/**');
    }
  });

  test('should capture smooth scroll animations', async ({ page }) => {
    // Add content to enable scrolling
    await page.evaluate(() => {
      const container = document.querySelector('.main-content, main, #app');
      if (container) {
        for (let i = 0; i < 20; i++) {
          const div = document.createElement('div');
          div.style.height = '200px';
          div.style.margin = '20px';
          div.style.background = `hsl(${i * 18}, 70%, 80%)`;
          div.textContent = `Section ${i + 1}`;
          container.appendChild(div);
        }
      }
    });
    
    // Scroll to bottom with smooth scrolling
    await page.evaluate(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    });
    
    // Capture scroll animation
    for (const ms of [0, 100, 200, 300, 500, 700, 1000]) {
      await page.waitForTimeout(ms);
      await expect(page).toHaveScreenshot(`smooth-scroll-${ms}ms.png`, {
        fullPage: false, // Only visible viewport
      });
    }
  });

  test('should capture fade-in animations on scroll', async ({ page }) => {
    // Look for elements with fade-in animations
    const fadeElements = await page.locator('[data-aos], .fade-in, .animate-on-scroll').all();
    
    if (fadeElements.length > 0) {
      // Scroll to trigger animations
      for (let i = 0; i < Math.min(fadeElements.length, 3); i++) {
        const element = fadeElements[i];
        await element.scrollIntoViewIfNeeded();
        
        // Capture fade-in animation
        for (const ms of [0, 100, 200, 300, 500]) {
          await page.waitForTimeout(ms);
          await expect(element).toHaveScreenshot(`fade-in-${i}-${ms}ms.png`);
        }
      }
    }
  });

  test('should capture ripple effects', async ({ page }) => {
    // Material Design ripple effects
    const rippleButtons = await page.locator('.mdc-button, .ripple, [data-ripple]').all();
    
    for (let i = 0; i < Math.min(rippleButtons.length, 2); i++) {
      const button = rippleButtons[i];
      const box = await button.boundingBox();
      
      if (box) {
        // Click at center to trigger ripple
        await button.click();
        
        // Capture ripple animation
        for (const ms of [0, 50, 100, 150, 200, 300]) {
          await page.waitForTimeout(ms);
          await expect(button).toHaveScreenshot(`ripple-${i}-${ms}ms.png`);
        }
      }
    }
  });

  test('should capture skeleton loading animations', async ({ page }) => {
    // Look for skeleton loaders
    const skeletons = await page.locator('.skeleton, .placeholder-glow, [data-skeleton]').all();
    
    if (skeletons.length > 0) {
      // Capture shimmer/pulse animation
      for (let frame = 0; frame < 10; frame++) {
        await page.waitForTimeout(200);
        await expect(page).toHaveScreenshot(`skeleton-animation-frame-${frame}.png`);
      }
    }
  });

  test('should capture parallax scrolling effects', async ({ page }) => {
    // Check for parallax elements
    const parallaxElements = await page.locator('[data-parallax], .parallax').all();
    
    if (parallaxElements.length > 0) {
      // Scroll and capture parallax effect
      const scrollPositions = [0, 100, 300, 500, 700, 1000];
      
      for (const position of scrollPositions) {
        await page.evaluate((y) => window.scrollTo(0, y), position);
        await page.waitForTimeout(100);
        await expect(page).toHaveScreenshot(`parallax-scroll-${position}px.png`, {
          fullPage: false,
        });
      }
    }
  });

  test('should capture CSS animations performance', async ({ page }) => {
    // Enable CSS animation debugging
    await page.addStyleTag({
      content: `
        * {
          animation-play-state: running !important;
        }
        
        /* Highlight animated elements */
        @keyframes debug-highlight {
          0%, 100% { outline: 2px solid red; }
          50% { outline: 2px solid blue; }
        }
        
        *:hover {
          animation: debug-highlight 1s infinite;
        }
      `
    });
    
    // Find all animated elements
    const animatedElements = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements.filter(el => {
        const style = window.getComputedStyle(el);
        return style.animationName !== 'none' || style.transitionProperty !== 'none';
      }).length;
    });
    
    await expect(page).toHaveScreenshot('css-animations-debug.png', {
      fullPage: true,
    });
    
    // Log animation count for debugging
    console.log(`Found ${animatedElements} animated elements`);
  });
});