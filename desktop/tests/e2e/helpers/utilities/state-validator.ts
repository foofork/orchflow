import type { Page, Locator } from '@playwright/test';

export interface ValidationRule {
  name: string;
  selector?: string;
  locator?: Locator;
  condition: 'visible' | 'hidden' | 'enabled' | 'disabled' | 'checked' | 'unchecked' | 'custom';
  customValidator?: (element: Locator) => Promise<boolean>;
  expectedValue?: any;
  timeout?: number;
}

export interface StateSnapshot {
  timestamp: Date;
  url: string;
  title: string;
  elements: Array<{
    selector: string;
    visible: boolean;
    enabled: boolean;
    value: any;
    text: string;
    attributes: Record<string, string>;
  }>;
  localStorage: Record<string, string>;
  sessionStorage: Record<string, string>;
  cookies: Array<{ name: string; value: string }>;
}

export interface ValidationResult {
  passed: boolean;
  failures: Array<{
    rule: string;
    expected: any;
    actual: any;
    error?: string;
  }>;
  duration: number;
}

export class StateValidator {
  private page: Page;
  private rules: Map<string, ValidationRule[]> = new Map();
  private snapshots: StateSnapshot[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  defineState(stateName: string, rules: ValidationRule[]): void {
    this.rules.set(stateName, rules);
  }

  async validateState(stateName: string): Promise<ValidationResult> {
    const startTime = Date.now();
    const rules = this.rules.get(stateName);
    
    if (!rules) {
      throw new Error(`State '${stateName}' is not defined`);
    }

    const failures: ValidationResult['failures'] = [];

    for (const rule of rules) {
      try {
        const passed = await this.validateRule(rule);
        
        if (!passed) {
          failures.push({
            rule: rule.name,
            expected: rule.condition,
            actual: 'failed validation'
          });
        }
      } catch (error) {
        failures.push({
          rule: rule.name,
          expected: rule.condition,
          actual: 'error',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      passed: failures.length === 0,
      failures,
      duration: Date.now() - startTime
    };
  }

  private async validateRule(rule: ValidationRule): Promise<boolean> {
    const locator = rule.locator || (rule.selector ? this.page.locator(rule.selector) : null);
    
    if (!locator) {
      throw new Error('No locator or selector provided for rule');
    }

    const timeout = rule.timeout || 5000;

    switch (rule.condition) {
      case 'visible':
        return await locator.isVisible({ timeout }).catch(() => false);
      
      case 'hidden':
        return await locator.isHidden({ timeout }).catch(() => true);
      
      case 'enabled':
        return await locator.isEnabled({ timeout }).catch(() => false);
      
      case 'disabled':
        return !(await locator.isEnabled({ timeout }).catch(() => true));
      
      case 'checked':
        return await locator.isChecked({ timeout }).catch(() => false);
      
      case 'unchecked':
        return !(await locator.isChecked({ timeout }).catch(() => true));
      
      case 'custom':
        if (!rule.customValidator) {
          throw new Error('Custom validator function required for custom condition');
        }
        return await rule.customValidator(locator);
      
      default:
        throw new Error(`Unknown condition: ${rule.condition}`);
    }
  }

  async captureSnapshot(name?: string): Promise<StateSnapshot> {
    const elements = await this.captureElements();
    const [localStorage, sessionStorage] = await this.captureStorage();
    const cookies = await this.page.context().cookies();

    const snapshot: StateSnapshot = {
      timestamp: new Date(),
      url: this.page.url(),
      title: await this.page.title(),
      elements,
      localStorage,
      sessionStorage,
      cookies: cookies.map(c => ({ name: c.name, value: c.value }))
    };

    this.snapshots.push(snapshot);
    
    if (name) {
      (snapshot as any).name = name;
    }

    return snapshot;
  }

  private async captureElements(): Promise<StateSnapshot['elements']> {
    const selectors = [
      'input', 'textarea', 'select', 'button',
      '[data-testid]', '[role]', 'a', 'img'
    ];

    const elements: StateSnapshot['elements'] = [];

    for (const selector of selectors) {
      const locators = await this.page.locator(selector).all();
      
      for (const locator of locators) {
        try {
          const element = {
            selector,
            visible: await locator.isVisible(),
            enabled: await locator.isEnabled().catch(() => false),
            value: await this.getElementValue(locator),
            text: await locator.textContent() || '',
            attributes: await this.getElementAttributes(locator)
          };
          
          elements.push(element);
        } catch {
          // Skip elements that cause errors
        }
      }
    }

    return elements;
  }

  private async getElementValue(locator: Locator): Promise<any> {
    const tagName = await locator.evaluate(el => el.tagName.toLowerCase());
    
    switch (tagName) {
      case 'input':
        const type = await locator.getAttribute('type');
        if (type === 'checkbox' || type === 'radio') {
          return await locator.isChecked();
        }
        return await locator.inputValue();
      
      case 'textarea':
        return await locator.inputValue();
      
      case 'select':
        return await locator.inputValue();
      
      default:
        return await locator.textContent();
    }
  }

  private async getElementAttributes(locator: Locator): Promise<Record<string, string>> {
    return await locator.evaluate(el => {
      const attrs: Record<string, string> = {};
      for (const attr of el.attributes) {
        attrs[attr.name] = attr.value;
      }
      return attrs;
    });
  }

  private async captureStorage(): Promise<[Record<string, string>, Record<string, string>]> {
    return await this.page.evaluate(() => {
      const getStorage = (storage: Storage) => {
        const items: Record<string, string> = {};
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            items[key] = storage.getItem(key) || '';
          }
        }
        return items;
      };
      
      return [
        getStorage(window.localStorage),
        getStorage(window.sessionStorage)
      ];
    });
  }

  async compareSnapshots(snapshot1: StateSnapshot, snapshot2: StateSnapshot): {
    identical: boolean;
    differences: Array<{
      type: string;
      path: string;
      value1: any;
      value2: any;
    }>;
  } {
    const differences: Array<{
      type: string;
      path: string;
      value1: any;
      value2: any;
    }> = [];

    // Compare URLs
    if (snapshot1.url !== snapshot2.url) {
      differences.push({
        type: 'url',
        path: 'url',
        value1: snapshot1.url,
        value2: snapshot2.url
      });
    }

    // Compare titles
    if (snapshot1.title !== snapshot2.title) {
      differences.push({
        type: 'title',
        path: 'title',
        value1: snapshot1.title,
        value2: snapshot2.title
      });
    }

    // Compare storage
    this.compareObjects(snapshot1.localStorage, snapshot2.localStorage, 'localStorage', differences);
    this.compareObjects(snapshot1.sessionStorage, snapshot2.sessionStorage, 'sessionStorage', differences);

    // Compare cookies
    const cookies1Map = new Map(snapshot1.cookies.map(c => [c.name, c.value]));
    const cookies2Map = new Map(snapshot2.cookies.map(c => [c.name, c.value]));
    
    for (const [name, value] of cookies1Map) {
      if (!cookies2Map.has(name)) {
        differences.push({
          type: 'cookie',
          path: `cookies.${name}`,
          value1: value,
          value2: undefined
        });
      } else if (cookies2Map.get(name) !== value) {
        differences.push({
          type: 'cookie',
          path: `cookies.${name}`,
          value1: value,
          value2: cookies2Map.get(name)
        });
      }
    }

    return {
      identical: differences.length === 0,
      differences
    };
  }

  private compareObjects(
    obj1: Record<string, any>,
    obj2: Record<string, any>,
    basePath: string,
    differences: Array<any>
  ): void {
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    const allKeys = new Set([...keys1, ...keys2]);

    for (const key of allKeys) {
      const path = `${basePath}.${key}`;
      
      if (!(key in obj1)) {
        differences.push({
          type: basePath,
          path,
          value1: undefined,
          value2: obj2[key]
        });
      } else if (!(key in obj2)) {
        differences.push({
          type: basePath,
          path,
          value1: obj1[key],
          value2: undefined
        });
      } else if (obj1[key] !== obj2[key]) {
        differences.push({
          type: basePath,
          path,
          value1: obj1[key],
          value2: obj2[key]
        });
      }
    }
  }

  async waitForState(stateName: string, timeout = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const result = await this.validateState(stateName);
      
      if (result.passed) {
        return true;
      }
      
      await this.page.waitForTimeout(500);
    }
    
    return false;
  }

  async assertState(stateName: string): Promise<void> {
    const result = await this.validateState(stateName);
    
    if (!result.passed) {
      const failureMessages = result.failures.map(f => 
        `  - ${f.rule}: expected ${f.expected}, got ${f.actual}${f.error ? ` (${f.error})` : ''}`
      ).join('\n');
      
      throw new Error(`State validation failed for '${stateName}':\n${failureMessages}`);
    }
  }

  async validateTransition(
    fromState: string,
    action: () => Promise<void>,
    toState: string
  ): Promise<{
    success: boolean;
    fromValidation: ValidationResult;
    toValidation: ValidationResult;
    transitionDuration: number;
  }> {
    // Validate initial state
    const fromValidation = await this.validateState(fromState);
    
    if (!fromValidation.passed) {
      return {
        success: false,
        fromValidation,
        toValidation: { passed: false, failures: [], duration: 0 },
        transitionDuration: 0
      };
    }

    // Perform action
    const transitionStart = Date.now();
    await action();
    const transitionDuration = Date.now() - transitionStart;

    // Validate final state
    const toValidation = await this.validateState(toState);

    return {
      success: toValidation.passed,
      fromValidation,
      toValidation,
      transitionDuration
    };
  }

  createCustomValidator(
    name: string,
    validator: (page: Page) => Promise<boolean>
  ): ValidationRule {
    return {
      name,
      condition: 'custom',
      customValidator: async () => validator(this.page)
    };
  }

  async validateUrl(pattern: string | RegExp): Promise<boolean> {
    const url = this.page.url();
    
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    
    return pattern.test(url);
  }

  async validateTitle(pattern: string | RegExp): Promise<boolean> {
    const title = await this.page.title();
    
    if (typeof pattern === 'string') {
      return title.includes(pattern);
    }
    
    return pattern.test(title);
  }

  async validateLocalStorage(key: string, expectedValue?: string): Promise<boolean> {
    const value = await this.page.evaluate((k) => localStorage.getItem(k), key);
    
    if (expectedValue !== undefined) {
      return value === expectedValue;
    }
    
    return value !== null;
  }

  async validateCookie(name: string, expectedValue?: string): Promise<boolean> {
    const cookies = await this.page.context().cookies();
    const cookie = cookies.find(c => c.name === name);
    
    if (!cookie) return false;
    
    if (expectedValue !== undefined) {
      return cookie.value === expectedValue;
    }
    
    return true;
  }

  clearSnapshots(): void {
    this.snapshots = [];
  }

  getSnapshots(): StateSnapshot[] {
    return [...this.snapshots];
  }

  exportState(stateName: string): ValidationRule[] | undefined {
    return this.rules.get(stateName);
  }

  importState(stateName: string, rules: ValidationRule[]): void {
    this.rules.set(stateName, rules);
  }
}