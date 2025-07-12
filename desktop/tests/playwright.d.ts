/// <reference types="@playwright/test" />

import { test as base, expect } from '@playwright/test';

// Extend Playwright test with custom fixtures if needed
export const test = base.extend({
  // Add custom fixtures here if needed
  // Example:
  // customPage: async ({ page }, use) => {
  //   // Setup custom page configurations
  //   await page.setViewportSize({ width: 1280, height: 720 });
  //   await use(page);
  // }
});

export { expect };

// Re-export Playwright types for convenience
export type { Page, Browser, BrowserContext } from '@playwright/test';

// Custom types for our tests
export interface TestContext {
  baseURL: string;
  port: number;
}

// Declare global types for our test utilities
declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveScreenshot(options?: { 
        fullPage?: boolean; 
        animations?: 'disabled' | 'allow';
        threshold?: number;
        maxDiffPixels?: number;
      }): R;
    }
  }
}

export {};