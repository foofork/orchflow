import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ComponentProps } from 'svelte';

// Test flow builder for user interactions
export class TestFlowBuilder {
  private steps: Array<() => Promise<void>> = [];
  private context: Record<string, any> = {};

  constructor(private name: string) {}

  // Setup methods
  setup(fn: () => void | Promise<void>) {
    this.steps.push(async () => {
      await fn();
    });
    return this;
  }

  // User interaction methods
  click(selector: string) {
    this.steps.push(async () => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) throw new Error(`Element not found: ${selector}`);
      element.click();
      await this.wait(100);
    });
    return this;
  }

  type(selector: string, text: string) {
    this.steps.push(async () => {
      const input = document.querySelector(selector) as HTMLInputElement;
      if (!input) throw new Error(`Input not found: ${selector}`);
      input.value = text;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await this.wait(100);
    });
    return this;
  }

  keypress(key: string, options: KeyboardEventInit = {}) {
    this.steps.push(async () => {
      const event = new KeyboardEvent('keydown', {
        key,
        ...options
      });
      document.dispatchEvent(event);
      await this.wait(100);
    });
    return this;
  }

  hover(selector: string) {
    this.steps.push(async () => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) throw new Error(`Element not found: ${selector}`);
      element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
      await this.wait(100);
    });
    return this;
  }

  focus(selector: string) {
    this.steps.push(async () => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) throw new Error(`Element not found: ${selector}`);
      element.focus();
      await this.wait(100);
    });
    return this;
  }

  blur(selector: string) {
    this.steps.push(async () => {
      const element = document.querySelector(selector) as HTMLElement;
      if (!element) throw new Error(`Element not found: ${selector}`);
      element.blur();
      await this.wait(100);
    });
    return this;
  }

  // Drag and drop
  dragAndDrop(sourceSelector: string, targetSelector: string) {
    this.steps.push(async () => {
      const source = document.querySelector(sourceSelector) as HTMLElement;
      const target = document.querySelector(targetSelector) as HTMLElement;
      
      if (!source || !target) throw new Error('Source or target element not found');

      // Simulate drag start
      source.dispatchEvent(new DragEvent('dragstart', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      }));

      // Simulate drag over
      target.dispatchEvent(new DragEvent('dragover', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      }));

      // Simulate drop
      target.dispatchEvent(new DragEvent('drop', {
        bubbles: true,
        dataTransfer: new DataTransfer()
      }));

      await this.wait(200);
    });
    return this;
  }

  // Wait methods
  wait(ms: number) {
    this.steps.push(async () => {
      await new Promise(resolve => setTimeout(resolve, ms));
    });
    return this;
  }

  waitFor(selector: string, timeout = 5000) {
    this.steps.push(async () => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (document.querySelector(selector)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for element: ${selector}`);
    });
    return this;
  }

  waitForText(text: string, timeout = 5000) {
    this.steps.push(async () => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        if (document.body.textContent?.includes(text)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for text: ${text}`);
    });
    return this;
  }

  // Assertion methods
  expect(selector: string) {
    const assertions = {
      toExist: () => {
        this.steps.push(async () => {
          const element = document.querySelector(selector);
          expect(element).toBeTruthy();
        });
        return this;
      },
      toHaveText: (text: string) => {
        this.steps.push(async () => {
          const element = document.querySelector(selector);
          expect(element?.textContent).toContain(text);
        });
        return this;
      },
      toHaveValue: (value: string) => {
        this.steps.push(async () => {
          const input = document.querySelector(selector) as HTMLInputElement;
          expect(input?.value).toBe(value);
        });
        return this;
      },
      toBeVisible: () => {
        this.steps.push(async () => {
          const element = document.querySelector(selector) as HTMLElement;
          expect(element).toBeTruthy();
          const style = window.getComputedStyle(element);
          expect(style.display).not.toBe('none');
          expect(style.visibility).not.toBe('hidden');
        });
        return this;
      },
      toHaveClass: (className: string) => {
        this.steps.push(async () => {
          const element = document.querySelector(selector);
          expect(element?.classList.contains(className)).toBe(true);
        });
        return this;
      }
    };
    return assertions;
  }

  // Context methods
  setContext(key: string, value: any) {
    this.context[key] = value;
    return this;
  }

  getContext(key: string) {
    return this.context[key];
  }

  // Execute flow
  async run() {
    console.log(`Running test flow: ${this.name}`);
    for (const step of this.steps) {
      await step();
    }
  }

  // Create test from flow
  createTest() {
    return it(this.name, async () => {
      await this.run();
    });
  }
}

// Component test flow builder
export class ComponentTestFlow<T extends Record<string, any>> {
  private component: any;
  private props: Partial<T> = {};
  private container: HTMLElement | null = null;

  constructor(private Component: any) {}

  withProps(props: Partial<T>) {
    this.props = { ...this.props, ...props };
    return this;
  }

  mount() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
    
    this.component = new this.Component({
      target: this.container,
      props: this.props
    });
    
    return this;
  }

  unmount() {
    if (this.component) {
      this.component.$destroy();
    }
    if (this.container) {
      document.body.removeChild(this.container);
    }
    return this;
  }

  updateProps(props: Partial<T>) {
    if (this.component) {
      this.component.$set(props);
    }
    return this;
  }

  getElement(selector: string): HTMLElement | null {
    return this.container?.querySelector(selector) || null;
  }

  getAllElements(selector: string): NodeListOf<Element> {
    return this.container?.querySelectorAll(selector) || new NodeList();
  }

  // Common test scenarios
  testAccessibility() {
    it('should be accessible', async () => {
      this.mount();
      const axe = await import('axe-core');
      const results = await axe.run(this.container!);
      expect(results.violations).toHaveLength(0);
      this.unmount();
    });
    return this;
  }

  testSnapshot() {
    it('should match snapshot', () => {
      this.mount();
      expect(this.container?.innerHTML).toMatchSnapshot();
      this.unmount();
    });
    return this;
  }

  testPropChange(propName: keyof T, oldValue: any, newValue: any) {
    it(`should update when ${String(propName)} changes`, () => {
      this.withProps({ [propName]: oldValue } as Partial<T>).mount();
      
      // Get initial state
      const initialHTML = this.container?.innerHTML;
      
      // Update prop
      this.updateProps({ [propName]: newValue } as Partial<T>);
      
      // Check that something changed
      expect(this.container?.innerHTML).not.toBe(initialHTML);
      
      this.unmount();
    });
    return this;
  }
}

// API test flow builder
export class ApiTestFlow {
  private mockResponses: Map<string, any> = new Map();
  private callHistory: Array<{ url: string; method: string; body?: any }> = [];

  constructor(private baseUrl: string) {
    this.setupMocks();
  }

  private setupMocks() {
    vi.mock('@tauri-apps/api/core', () => ({
      invoke: vi.fn(async (cmd: string, args?: any) => {
        const key = `${cmd}:${JSON.stringify(args)}`;
        if (this.mockResponses.has(key)) {
          return this.mockResponses.get(key);
        }
        throw new Error(`No mock response for: ${key}`);
      })
    }));
  }

  whenInvoking(command: string, args?: any) {
    const key = `${command}:${JSON.stringify(args)}`;
    return {
      thenReturn: (response: any) => {
        this.mockResponses.set(key, response);
        return this;
      },
      thenThrow: (error: Error | string) => {
        this.mockResponses.set(key, Promise.reject(error));
        return this;
      }
    };
  }

  expectCalled(command: string, times?: number) {
    const calls = this.callHistory.filter(call => call.url === command);
    if (times !== undefined) {
      expect(calls).toHaveLength(times);
    } else {
      expect(calls.length).toBeGreaterThan(0);
    }
    return this;
  }

  reset() {
    this.mockResponses.clear();
    this.callHistory = [];
    return this;
  }
}

// Utility to create test scenarios
export function createTestScenario(name: string) {
  return {
    flow: new TestFlowBuilder(name),
    
    // Predefined scenarios
    loginFlow: () => {
      return new TestFlowBuilder('User login flow')
        .type('#username', 'testuser')
        .type('#password', 'testpass')
        .click('#login-button')
        .waitForText('Welcome')
        .expect('.dashboard').toExist();
    },

    searchFlow: (query: string) => {
      return new TestFlowBuilder('Search flow')
        .click('.search-button')
        .type('.search-input', query)
        .keypress('Enter')
        .waitFor('.search-results')
        .expect('.search-results').toExist();
    },

    navigationFlow: (path: string) => {
      return new TestFlowBuilder('Navigation flow')
        .click(`[href="${path}"]`)
        .waitFor('[data-page]')
        .expect('[data-page]').toExist();
    }
  };
}

// VS Code snippet generator
export function generateVSCodeSnippet(name: string, code: string) {
  return {
    [name]: {
      prefix: name.toLowerCase().replace(/\s+/g, '-'),
      body: code.split('\n'),
      description: `Test pattern: ${name}`
    }
  };
}

// Export test patterns as snippets
export const testSnippets = {
  ...generateVSCodeSnippet('Component Test', `
describe('${1:ComponentName}', () => {
  const flow = new ComponentTestFlow(${1:ComponentName});
  
  flow
    .withProps({ ${2:prop}: ${3:value} })
    .testAccessibility()
    .testSnapshot()
    .testPropChange('${2:prop}', ${3:value}, ${4:newValue});
});
  `),
  
  ...generateVSCodeSnippet('User Flow Test', `
const flow = new TestFlowBuilder('${1:Test flow name}')
  .setup(() => {
    // Setup code
  })
  .${2:click}('${3:selector}')
  .wait(100)
  .expect('${4:selector}').to${5:Exist}()
  .createTest();
  `),
  
  ...generateVSCodeSnippet('API Mock Test', `
const api = new ApiTestFlow('${1:baseUrl}');

api
  .whenInvoking('${2:command}', { ${3:args} })
  .thenReturn({ ${4:response} });

// Test code here

api.expectCalled('${2:command}', ${5:1});
  `)
};