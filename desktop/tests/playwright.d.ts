/// <reference types="@playwright/test" />

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toHaveScreenshot(name?: string, options?: Parameters<typeof expect.toHaveScreenshot>[1]): R;
    }
  }
}

export {};