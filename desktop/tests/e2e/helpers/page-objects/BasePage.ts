/**
 * Base Page Object
 * Provides common functionality for all page objects
 */

import type { Page, Locator } from 'playwright';

export interface WaitOptions {
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export abstract class BasePage {
  constructor(protected page: Page) {}
  
  /**
   * Wait for the page to be fully loaded
   */
  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await this.waitForElement('[data-testid="app-container"]');
  }
  
  /**
   * Navigate to a specific URL
   */
  async goto(url: string) {
    await this.page.goto(url);
    await this.waitForLoad();
  }
  
  /**
   * Wait for an element to be present
   */
  async waitForElement(selector: string, options?: WaitOptions): Promise<Locator> {
    const locator = this.page.locator(selector);
    await locator.waitFor({
      timeout: 30000,
      state: 'visible',
      ...options
    });
    return locator;
  }
  
  /**
   * Click an element with retry logic
   */
  async clickElement(selector: string, options?: { force?: boolean; timeout?: number }) {
    const element = await this.waitForElement(selector, { timeout: options?.timeout });
    await element.click({ force: options?.force });
  }
  
  /**
   * Fill an input field
   */
  async fillInput(selector: string, value: string) {
    const element = await this.waitForElement(selector);
    await element.fill(value);
  }
  
  /**
   * Select an option from a dropdown
   */
  async selectOption(selector: string, value: string | string[]) {
    const element = await this.waitForElement(selector);
    await element.selectOption(value);
  }
  
  /**
   * Get text content of an element
   */
  async getTextContent(selector: string): Promise<string> {
    const element = await this.waitForElement(selector);
    return await element.textContent() || '';
  }
  
  /**
   * Check if an element exists
   */
  async elementExists(selector: string, timeout = 5000): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'attached' });
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check if an element is visible
   */
  async isVisible(selector: string): Promise<boolean> {
    const element = this.page.locator(selector);
    return await element.isVisible();
  }
  
  /**
   * Wait for text to appear
   */
  async waitForText(text: string, options?: { timeout?: number; exact?: boolean }) {
    const selector = options?.exact 
      ? `text="${text}"` 
      : `text=${text}`;
    await this.waitForElement(selector, { timeout: options?.timeout });
  }
  
  /**
   * Press a keyboard key
   */
  async pressKey(key: string) {
    await this.page.keyboard.press(key);
  }
  
  /**
   * Take a screenshot
   */
  async screenshot(name: string) {
    await this.page.screenshot({
      path: `./test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }
  
  /**
   * Wait for navigation
   */
  async waitForNavigation(urlPattern?: string | RegExp) {
    await this.page.waitForURL(urlPattern || '**/*', {
      timeout: 30000,
      waitUntil: 'networkidle'
    });
  }
  
  /**
   * Get all matching elements
   */
  async getAllElements(selector: string): Promise<Locator[]> {
    const locator = this.page.locator(selector);
    const count = await locator.count();
    const elements: Locator[] = [];
    
    for (let i = 0; i < count; i++) {
      elements.push(locator.nth(i));
    }
    
    return elements;
  }
  
  /**
   * Wait for element count
   */
  async waitForElementCount(selector: string, expectedCount: number, timeout = 10000) {
    await this.page.waitForFunction(
      ({ selector, expectedCount }) => {
        const elements = document.querySelectorAll(selector);
        return elements.length === expectedCount;
      },
      { selector, expectedCount },
      { timeout }
    );
  }
  
  /**
   * Scroll to element
   */
  async scrollToElement(selector: string) {
    const element = await this.waitForElement(selector);
    await element.scrollIntoViewIfNeeded();
  }
  
  /**
   * Get attribute value
   */
  async getAttribute(selector: string, attribute: string): Promise<string | null> {
    const element = await this.waitForElement(selector);
    return await element.getAttribute(attribute);
  }
  
  /**
   * Wait for function to return true
   */
  async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    options?: { timeout?: number; interval?: number }
  ) {
    const { timeout = 10000, interval = 100 } = options || {};
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await this.page.waitForTimeout(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }
  
  /**
   * Clear input field
   */
  async clearInput(selector: string) {
    const element = await this.waitForElement(selector);
    await element.fill('');
  }
  
  /**
   * Double click element
   */
  async doubleClick(selector: string) {
    const element = await this.waitForElement(selector);
    await element.dblclick();
  }
  
  /**
   * Right click element
   */
  async rightClick(selector: string) {
    const element = await this.waitForElement(selector);
    await element.click({ button: 'right' });
  }
  
  /**
   * Hover over element
   */
  async hover(selector: string) {
    const element = await this.waitForElement(selector);
    await element.hover();
  }
  
  /**
   * Drag and drop
   */
  async dragAndDrop(sourceSelector: string, targetSelector: string) {
    const source = await this.waitForElement(sourceSelector);
    const target = await this.waitForElement(targetSelector);
    await source.dragTo(target);
  }
  
  /**
   * Upload file
   */
  async uploadFile(selector: string, filePath: string) {
    const element = await this.waitForElement(selector);
    await element.setInputFiles(filePath);
  }
  
  /**
   * Get current URL
   */
  getCurrentUrl(): string {
    return this.page.url();
  }
  
  /**
   * Reload page
   */
  async reload() {
    await this.page.reload();
    await this.waitForLoad();
  }
  
  /**
   * Go back in browser history
   */
  async goBack() {
    await this.page.goBack();
    await this.waitForLoad();
  }
  
  /**
   * Go forward in browser history
   */
  async goForward() {
    await this.page.goForward();
    await this.waitForLoad();
  }
}