import { screen, within } from '@testing-library/svelte';
import { vi } from 'vitest';
import axe from 'axe-core';

/**
 * Run axe accessibility tests on a container
 */
export async function checkAccessibility(
  container: HTMLElement = document.body,
  options?: {
    rules?: Record<string, any>;
    runOnly?: string | string[] | axe.RunOptions;
    reporter?: string;
  }
): Promise<axe.AxeResults> {
  const results = await axe.run(container, {
    rules: options?.rules,
    runOnly: options?.runOnly,
    reporter: options?.reporter as any,
  });

  if (results.violations.length > 0) {
    const violations = results.violations.map(v => ({
      id: v.id,
      impact: v.impact,
      description: v.description,
      nodes: v.nodes.length,
      help: v.help,
    }));

    console.error('Accessibility violations found:', violations);
  }

  return results;
}

/**
 * Assert no accessibility violations
 */
export function assertNoViolations(results: axe.AxeResults) {
  expect(results.violations).toHaveLength(0);
}

/**
 * Check for specific ARIA attributes
 */
export function checkAriaAttributes(
  element: Element,
  attributes: Record<string, string | boolean | null>
) {
  Object.entries(attributes).forEach(([attr, value]) => {
    const ariaAttr = attr.startsWith('aria-') ? attr : `aria-${attr}`;
    
    if (value === null) {
      expect(element).not.toHaveAttribute(ariaAttr);
    } else if (typeof value === 'boolean') {
      expect(element).toHaveAttribute(ariaAttr, value.toString());
    } else {
      expect(element).toHaveAttribute(ariaAttr, value);
    }
  });
}

/**
 * Check keyboard navigation
 */
export function checkKeyboardNavigation(
  container: HTMLElement,
  expectedOrder: string[]
) {
  const focusableElements = getFocusableElements(container);
  const focusableSelectors = focusableElements.map(el => 
    getElementSelector(el)
  );

  expectedOrder.forEach((selector, index) => {
    expect(focusableSelectors[index]).toBe(selector);
  });
}

/**
 * Get all focusable elements in tab order
 */
export function getFocusableElements(container: HTMLElement): Element[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'textarea:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll(selector))
    .filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .sort((a, b) => {
      const aTabIndex = parseInt(a.getAttribute('tabindex') || '0', 10);
      const bTabIndex = parseInt(b.getAttribute('tabindex') || '0', 10);
      
      if (aTabIndex !== bTabIndex) {
        if (aTabIndex === 0) return 1;
        if (bTabIndex === 0) return -1;
        return aTabIndex - bTabIndex;
      }
      
      // If tabindex is the same, use DOM order
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
}

/**
 * Get a unique selector for an element
 */
function getElementSelector(element: Element): string {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    return `.${element.className.split(' ').join('.')}`;
  }
  
  return element.tagName.toLowerCase();
}

/**
 * Test keyboard interaction
 */
export async function testKeyboardInteraction(
  element: Element,
  key: string,
  expectedBehavior: () => void | Promise<void>
) {
  element.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      bubbles: true,
      cancelable: true,
    })
  );

  await expectedBehavior();
}

/**
 * Check screen reader announcements
 */
export function setupScreenReaderTest() {
  const announcements: string[] = [];
  const liveRegions = new Map<Element, MutationObserver>();

  // Monitor ARIA live regions
  const observeLiveRegion = (element: Element) => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' || mutation.type === 'characterData') {
          const text = (element.textContent || '').trim();
          if (text) {
            announcements.push(text);
          }
        }
      });
    });

    observer.observe(element, {
      childList: true,
      characterData: true,
      subtree: true,
    });

    liveRegions.set(element, observer);
  };

  // Find and observe existing live regions
  const findLiveRegions = () => {
    const selectors = [
      '[role="alert"]',
      '[role="status"]',
      '[role="log"]',
      '[aria-live="polite"]',
      '[aria-live="assertive"]',
    ];

    selectors.forEach(selector => {
      document.querySelectorAll(selector).forEach(observeLiveRegion);
    });
  };

  // Watch for new live regions
  const documentObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          const isLiveRegion = 
            node.getAttribute('role') === 'alert' ||
            node.getAttribute('role') === 'status' ||
            node.getAttribute('role') === 'log' ||
            node.hasAttribute('aria-live');

          if (isLiveRegion) {
            observeLiveRegion(node);
          }
        }
      });
    });
  });

  documentObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  findLiveRegions();

  return {
    getAnnouncements: () => [...announcements],
    expectAnnouncement: (text: string) => {
      expect(announcements).toContain(text);
    },
    expectLastAnnouncement: (text: string) => {
      expect(announcements[announcements.length - 1]).toBe(text);
    },
    clearAnnouncements: () => {
      announcements.length = 0;
    },
    cleanup: () => {
      documentObserver.disconnect();
      liveRegions.forEach(observer => observer.disconnect());
      liveRegions.clear();
    },
  };
}

/**
 * Check focus management
 */
export function checkFocusManagement(
  container: HTMLElement,
  options: {
    initialFocus?: string;
    focusTrap?: boolean;
    restoreFocus?: Element;
  }
) {
  // Check initial focus
  if (options.initialFocus) {
    const initialElement = container.querySelector(options.initialFocus);
    expect(document.activeElement).toBe(initialElement);
  }

  // Check focus trap
  if (options.focusTrap) {
    const focusableElements = getFocusableElements(container);
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Tab from last element should go to first
    if (lastElement && firstElement) {
      lastElement.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        })
      );
      expect(document.activeElement).toBe(firstElement);

      // Shift+Tab from first element should go to last
      firstElement.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
      expect(document.activeElement).toBe(lastElement);
    }
  }

  return {
    cleanup: () => {
      if (options.restoreFocus) {
        (options.restoreFocus as HTMLElement).focus();
      }
    },
  };
}

/**
 * Check color contrast
 */
export async function checkColorContrast(
  container: HTMLElement = document.body,
  options?: {
    normalTextMinimum?: number; // Default 4.5:1
    largeTextMinimum?: number; // Default 3:1
  }
): Promise<axe.AxeResults> {
  return checkAccessibility(container, {
    runOnly: ['color-contrast'],
    rules: {
      'color-contrast': {
        enabled: true,
        options: {
          noScroll: true,
          normalTextMinimum: options?.normalTextMinimum || 4.5,
          largeTextMinimum: options?.largeTextMinimum || 3,
        },
      },
    },
  });
}

/**
 * Check heading structure
 */
export function checkHeadingStructure(container: HTMLElement) {
  const headings = Array.from(
    container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  );
  
  const levels = headings.map(h => parseInt(h.tagName[1], 10));
  
  // Check for skipped heading levels
  for (let i = 1; i < levels.length; i++) {
    const diff = levels[i] - levels[i - 1];
    if (diff > 1) {
      throw new Error(
        `Heading level skipped: h${levels[i - 1]} → h${levels[i]}`
      );
    }
  }

  // Check for multiple h1s
  const h1Count = levels.filter(level => level === 1).length;
  if (h1Count > 1) {
    console.warn(`Multiple h1 elements found (${h1Count})`);
  }

  return {
    headings: headings.map(h => ({
      level: parseInt(h.tagName[1], 10),
      text: h.textContent?.trim() || '',
      element: h,
    })),
    isValid: true,
  };
}

/**
 * Check landmark regions
 */
export function checkLandmarks(container: HTMLElement) {
  const landmarks = {
    main: container.querySelectorAll('main, [role="main"]'),
    navigation: container.querySelectorAll('nav, [role="navigation"]'),
    banner: container.querySelectorAll('header, [role="banner"]'),
    contentinfo: container.querySelectorAll('footer, [role="contentinfo"]'),
    complementary: container.querySelectorAll('aside, [role="complementary"]'),
    search: container.querySelectorAll('[role="search"]'),
  };

  // Check for required landmarks
  if (landmarks.main.length === 0) {
    console.warn('No main landmark found');
  }
  if (landmarks.main.length > 1) {
    console.warn(`Multiple main landmarks found (${landmarks.main.length})`);
  }

  return landmarks;
}

/**
 * Mock screen reader for testing
 */
export function createMockScreenReader() {
  const announcements: Array<{ text: string; priority: 'polite' | 'assertive' }> = [];
  
  return {
    announce: vi.fn((text: string, priority: 'polite' | 'assertive' = 'polite') => {
      announcements.push({ text, priority });
    }),
    
    getAnnouncements: () => [...announcements],
    
    getLastAnnouncement: () => announcements[announcements.length - 1],
    
    expectAnnounced: (text: string, priority?: 'polite' | 'assertive') => {
      const found = announcements.find(a => 
        a.text === text && (!priority || a.priority === priority)
      );
      expect(found).toBeTruthy();
    },
    
    clear: () => {
      announcements.length = 0;
    },
    
    mockClear: () => {
      vi.mocked(mockScreenReader.announce).mockClear();
    },
    
    mockReset: () => {
      announcements.length = 0;
      vi.mocked(mockScreenReader.announce).mockReset();
    },
  };
  
  const mockScreenReader = {
    announce: vi.fn((text: string, priority: 'polite' | 'assertive' = 'polite') => {
      announcements.push({ text, priority });
    }),
    
    getAnnouncements: () => [...announcements],
    getLastAnnouncement: () => announcements[announcements.length - 1],
    
    expectAnnounced: (text: string, priority?: 'polite' | 'assertive') => {
      const found = announcements.find(a => 
        a.text === text && (!priority || a.priority === priority)
      );
      expect(found).toBeTruthy();
    },
    
    clear: () => {
      announcements.length = 0;
    },
    
    mockClear: () => {
      vi.mocked(mockScreenReader.announce).mockClear();
    },
    
    mockReset: () => {
      announcements.length = 0;
      vi.mocked(mockScreenReader.announce).mockReset();
    },
  };
  
  return mockScreenReader;
}