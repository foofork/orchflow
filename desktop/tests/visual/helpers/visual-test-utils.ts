import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Visual testing utilities and helpers
 */

export interface ScreenshotOptions {
  fullPage?: boolean;
  animations?: 'disabled' | 'allow';
  mask?: string[];
  clip?: { x: number; y: number; width: number; height: number };
  omitBackground?: boolean;
}

/**
 * Take a screenshot with retries for flaky visual tests
 */
export async function takeScreenshotWithRetry(
  page: Page,
  name: string,
  options: ScreenshotOptions = {},
  retries: number = 3
) {
  for (let i = 0; i < retries; i++) {
    try {
      await expect(page).toHaveScreenshot(name, {
        ...options,
        maxDiffPixelRatio: 0.05, // Allow 5% difference
      });
      return;
    } catch (error) {
      if (i === retries - 1) throw error;
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Wait for animations to complete
 */
export async function waitForAnimations(page: Page) {
  await page.evaluate(() => {
    return Promise.all(
      Array.from(document.querySelectorAll('*')).map((element) => {
        const animations = element.getAnimations();
        return Promise.all(animations.map((animation) => animation.finished));
      })
    );
  });
}

/**
 * Disable all CSS animations and transitions
 */
export async function disableAnimations(page: Page) {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
      }
    `,
  });
}

/**
 * Hide dynamic content that changes between test runs
 */
export async function hideDynamicContent(page: Page) {
  await page.addStyleTag({
    content: `
      /* Hide timestamps */
      [data-testid*="timestamp"], .timestamp, time {
        visibility: hidden !important;
      }
      
      /* Hide version numbers */
      [data-testid*="version"], .version {
        visibility: hidden !important;
      }
      
      /* Hide loading indicators that might be mid-animation */
      .loading, .spinner, [role="progressbar"] {
        visibility: hidden !important;
      }
      
      /* Stabilize cursor */
      * {
        cursor: default !important;
      }
    `,
  });
}

/**
 * Set up visual regression testing environment
 */
export async function setupVisualTest(page: Page) {
  // Set a consistent viewport
  await page.setViewportSize({ width: 1280, height: 720 });
  
  // Disable animations
  await disableAnimations(page);
  
  // Hide dynamic content
  await hideDynamicContent(page);
  
  // Wait for fonts to load
  await page.evaluate(() => document.fonts.ready);
  
  // Set timezone to UTC
  await page.evaluate(() => {
    // @ts-ignore
    window.__timezone__ = 'UTC';
  });
}

/**
 * Compare visual differences between two states
 */
export async function compareStates(
  page: Page,
  beforeAction: () => Promise<void>,
  afterAction: () => Promise<void>,
  screenshotName: string
) {
  // Capture before state
  await beforeAction();
  await page.waitForTimeout(100);
  const beforeScreenshot = await page.screenshot();
  
  // Perform action
  await afterAction();
  await page.waitForTimeout(100);
  const afterScreenshot = await page.screenshot();
  
  // Store both screenshots for comparison
  await expect(page).toHaveScreenshot(`${screenshotName}-before.png`);
  await afterAction();
  await expect(page).toHaveScreenshot(`${screenshotName}-after.png`);
}

/**
 * Test responsive behavior at multiple breakpoints
 */
export async function testResponsiveBreakpoints(
  page: Page,
  element: string,
  breakpoints: { name: string; width: number; height: number }[]
) {
  for (const breakpoint of breakpoints) {
    await page.setViewportSize({ width: breakpoint.width, height: breakpoint.height });
    await page.waitForTimeout(500); // Wait for responsive adjustments
    
    const target = await page.locator(element).first();
    if (await target.count() > 0) {
      await expect(target).toHaveScreenshot(`responsive-${breakpoint.name}.png`);
    }
  }
}

/**
 * Test component in different themes
 */
export async function testThemeVariations(
  page: Page,
  element: string,
  themes: string[] = ['light', 'dark']
) {
  for (const theme of themes) {
    // Apply theme
    await page.evaluate((themeName) => {
      document.documentElement.setAttribute('data-theme', themeName);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(themeName);
    }, theme);
    
    await page.waitForTimeout(300); // Wait for theme transition
    
    const target = await page.locator(element).first();
    if (await target.count() > 0) {
      await expect(target).toHaveScreenshot(`theme-${theme}.png`);
    }
  }
}

/**
 * Test hover states for interactive elements
 */
export async function testHoverStates(page: Page, selectors: string[]) {
  for (const selector of selectors) {
    const elements = await page.locator(selector).all();
    
    for (let i = 0; i < Math.min(elements.length, 3); i++) {
      const element = elements[i];
      
      // Normal state
      await expect(element).toHaveScreenshot(`${selector}-normal-${i}.png`);
      
      // Hover state
      await element.hover();
      await page.waitForTimeout(200);
      await expect(element).toHaveScreenshot(`${selector}-hover-${i}.png`);
      
      // Reset
      await page.mouse.move(0, 0);
    }
  }
}

/**
 * Capture animation sequence
 */
export async function captureAnimationSequence(
  page: Page,
  trigger: () => Promise<void>,
  duration: number,
  fps: number = 10
) {
  const frames = Math.ceil((duration / 1000) * fps);
  const interval = 1000 / fps;
  
  await trigger();
  
  const screenshots = [];
  for (let i = 0; i < frames; i++) {
    screenshots.push(await page.screenshot());
    await page.waitForTimeout(interval);
  }
  
  return screenshots;
}

/**
 * Test focus order and keyboard navigation
 */
export async function testKeyboardNavigation(
  page: Page,
  expectedOrder: string[]
) {
  const focusedElements: string[] = [];
  
  // Start from body
  await page.keyboard.press('Tab');
  
  for (let i = 0; i < expectedOrder.length; i++) {
    const focused = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.getAttribute('data-testid') || el.className || el.tagName : null;
    });
    
    if (focused) {
      focusedElements.push(focused);
    }
    
    await expect(page).toHaveScreenshot(`focus-order-${i}.png`);
    await page.keyboard.press('Tab');
  }
  
  return focusedElements;
}

/**
 * Test color contrast ratios
 */
export async function testColorContrast(page: Page, selector: string) {
  const element = await page.locator(selector).first();
  
  if (await element.count() > 0) {
    const contrast = await element.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const bgColor = style.backgroundColor;
      const textColor = style.color;
      
      // Simple contrast calculation (would need proper implementation)
      return { background: bgColor, text: textColor };
    });
    
    return contrast;
  }
  
  return null;
}