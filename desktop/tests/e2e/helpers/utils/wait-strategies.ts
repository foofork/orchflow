/**
 * Wait Strategies for E2E Tests
 * Provides robust waiting mechanisms to reduce flakiness
 */

import type { Page, Locator } from 'playwright';

export class WaitStrategies {
  /**
   * Wait for network to be idle
   */
  static async waitForNetworkIdle(page: Page, timeout = 30000) {
    await page.waitForLoadState('networkidle', { timeout });
  }
  
  /**
   * Wait for all animations to complete
   */
  static async waitForAnimations(page: Page) {
    await page.evaluate(() => {
      return Promise.all(
        Array.from(document.querySelectorAll('*'))
          .map(element => 
            element.getAnimations().map(animation => animation.finished)
          )
          .flat()
          .filter(promise => promise instanceof Promise)
      );
    });
  }
  
  /**
   * Wait for text content to change
   */
  static async waitForTextChange(
    page: Page, 
    selector: string, 
    options?: { timeout?: number; exact?: boolean }
  ): Promise<string> {
    const { timeout = 10000, exact = false } = options || {};
    const element = await page.waitForSelector(selector);
    const initialText = await element.textContent();
    
    await page.waitForFunction(
      ({ selector, initialText, exact }) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const currentText = el.textContent;
        return exact 
          ? currentText !== initialText 
          : currentText?.trim() !== initialText?.trim();
      },
      { selector, initialText, exact },
      { timeout }
    );
    
    return await element.textContent() || '';
  }
  
  /**
   * Retry a function until it succeeds
   */
  static async retryUntilSuccess<T>(
    fn: () => Promise<T>,
    options?: { 
      retries?: number; 
      delay?: number; 
      timeout?: number;
      onRetry?: (attempt: number, error: Error) => void;
    }
  ): Promise<T> {
    const { 
      retries = 3, 
      delay = 1000, 
      timeout = 30000,
      onRetry 
    } = options || {};
    
    const startTime = Date.now();
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Check timeout
        if (Date.now() - startTime > timeout) {
          throw new Error(`Timeout after ${timeout}ms`);
        }
        
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Retry failed');
  }
  
  /**
   * Wait for element to be stable (not moving)
   */
  static async waitForElementStability(
    locator: Locator,
    options?: { timeout?: number; threshold?: number }
  ) {
    const { timeout = 5000, threshold = 5 } = options || {};
    const startTime = Date.now();
    let previousBox = await locator.boundingBox();
    
    while (Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentBox = await locator.boundingBox();
      
      if (!previousBox || !currentBox) {
        previousBox = currentBox;
        continue;
      }
      
      const moved = 
        Math.abs(previousBox.x - currentBox.x) > threshold ||
        Math.abs(previousBox.y - currentBox.y) > threshold ||
        Math.abs(previousBox.width - currentBox.width) > threshold ||
        Math.abs(previousBox.height - currentBox.height) > threshold;
      
      if (!moved) {
        return;
      }
      
      previousBox = currentBox;
    }
    
    throw new Error(`Element did not stabilize within ${timeout}ms`);
  }
  
  /**
   * Wait for multiple conditions
   */
  static async waitForAllConditions(
    page: Page,
    conditions: Array<() => Promise<boolean>>,
    timeout = 30000
  ) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(
        conditions.map(condition => 
          condition().catch(() => false)
        )
      );
      
      if (results.every(result => result === true)) {
        return;
      }
      
      await page.waitForTimeout(100);
    }
    
    throw new Error(`Not all conditions met within ${timeout}ms`);
  }
  
  /**
   * Wait for any of multiple conditions
   */
  static async waitForAnyCondition(
    page: Page,
    conditions: Array<() => Promise<boolean>>,
    timeout = 30000
  ): Promise<number> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const results = await Promise.all(
        conditions.map(condition => 
          condition().catch(() => false)
        )
      );
      
      const metIndex = results.findIndex(result => result === true);
      if (metIndex !== -1) {
        return metIndex;
      }
      
      await page.waitForTimeout(100);
    }
    
    throw new Error(`No conditions met within ${timeout}ms`);
  }
  
  /**
   * Wait for element count to match
   */
  static async waitForElementCount(
    page: Page,
    selector: string,
    expectedCount: number,
    options?: { timeout?: number; comparison?: 'exact' | 'min' | 'max' }
  ) {
    const { timeout = 10000, comparison = 'exact' } = options || {};
    
    await page.waitForFunction(
      ({ selector, expectedCount, comparison }) => {
        const elements = document.querySelectorAll(selector);
        const count = elements.length;
        
        switch (comparison) {
          case 'exact':
            return count === expectedCount;
          case 'min':
            return count >= expectedCount;
          case 'max':
            return count <= expectedCount;
          default:
            return false;
        }
      },
      { selector, expectedCount, comparison },
      { timeout }
    );
  }
  
  /**
   * Wait for attribute value
   */
  static async waitForAttribute(
    locator: Locator,
    attributeName: string,
    expectedValue: string | RegExp,
    timeout = 10000
  ) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const actualValue = await locator.getAttribute(attributeName);
      
      if (actualValue) {
        if (expectedValue instanceof RegExp) {
          if (expectedValue.test(actualValue)) return actualValue;
        } else {
          if (actualValue === expectedValue) return actualValue;
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error(
      `Attribute '${attributeName}' did not match expected value within ${timeout}ms`
    );
  }
  
  /**
   * Wait for console message
   */
  static async waitForConsoleMessage(
    page: Page,
    messagePattern: string | RegExp,
    options?: { timeout?: number; type?: 'log' | 'error' | 'warning' | 'info' }
  ): Promise<string> {
    const { timeout = 10000, type } = options || {};
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        page.off('console', handler);
        reject(new Error(`Console message not found within ${timeout}ms`));
      }, timeout);
      
      const handler = (msg: any) => {
        if (type && msg.type() !== type) return;
        
        const text = msg.text();
        const matches = messagePattern instanceof RegExp
          ? messagePattern.test(text)
          : text.includes(messagePattern);
        
        if (matches) {
          clearTimeout(timeoutId);
          page.off('console', handler);
          resolve(text);
        }
      };
      
      page.on('console', handler);
    });
  }
  
  /**
   * Wait for URL to match pattern
   */
  static async waitForUrl(
    page: Page,
    urlPattern: string | RegExp,
    timeout = 30000
  ) {
    await page.waitForURL(urlPattern, { timeout, waitUntil: 'load' });
  }
  
  /**
   * Wait for download
   */
  static async waitForDownload(
    page: Page,
    triggerDownload: () => Promise<void>,
    timeout = 30000
  ) {
    const downloadPromise = page.waitForEvent('download', { timeout });
    await triggerDownload();
    return await downloadPromise;
  }
  
  /**
   * Wait for popup window
   */
  static async waitForPopup(
    page: Page,
    triggerPopup: () => Promise<void>,
    timeout = 10000
  ) {
    const popupPromise = page.waitForEvent('popup', { timeout });
    await triggerPopup();
    return await popupPromise;
  }
  
  /**
   * Wait for function result
   */
  static async waitForFunction<T>(
    page: Page,
    fn: () => T | Promise<T>,
    options?: { timeout?: number; polling?: number }
  ): Promise<T> {
    const { timeout = 10000, polling = 100 } = options || {};
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const result = await page.evaluate(fn);
        if (result !== null && result !== undefined && result !== false) {
          return result;
        }
      } catch {
        // Continue waiting
      }
      
      await page.waitForTimeout(polling);
    }
    
    throw new Error(`Function did not return truthy value within ${timeout}ms`);
  }
  
  /**
   * Smart wait - tries multiple strategies
   */
  static async smartWait(
    page: Page,
    options?: {
      networkIdle?: boolean;
      animations?: boolean;
      timeout?: number;
      customCheck?: () => Promise<boolean>;
    }
  ) {
    const { 
      networkIdle = true, 
      animations = true, 
      timeout = 30000,
      customCheck 
    } = options || {};
    
    const conditions: Array<() => Promise<void>> = [];
    
    if (networkIdle) {
      conditions.push(() => this.waitForNetworkIdle(page, timeout));
    }
    
    if (animations) {
      conditions.push(() => this.waitForAnimations(page));
    }
    
    if (customCheck) {
      conditions.push(async () => {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
          if (await customCheck()) return;
          await page.waitForTimeout(100);
        }
        throw new Error('Custom check failed');
      });
    }
    
    await Promise.all(conditions);
  }
}