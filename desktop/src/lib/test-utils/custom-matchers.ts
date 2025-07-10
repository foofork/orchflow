import { expect } from 'vitest'
import type { MatcherFunction } from 'expect'

// Extend the matchers interface
interface CustomMatchers<R = unknown> {
  toBeAccessible(): R
  toHaveFocus(): R
  toBeVisible(): R
  toHaveClass(className: string): R
  toHaveNoClass(className: string): R
  toBeDisabled(): R
  toBeEnabled(): R
  toHaveAttribute(attribute: string, value?: string): R
  toHaveNoAttribute(attribute: string): R
  toHaveTextContent(text: string | RegExp): R
  toBeWithinRange(min: number, max: number): R
  toHaveBeenCalledWithDelay(delay: number): R
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}

// Custom matcher implementations
const matchers: Record<keyof CustomMatchers, MatcherFunction<any>> = {
  toBeAccessible(received: HTMLElement) {
    const hasRole = received.hasAttribute('role')
    const hasAriaLabel = received.hasAttribute('aria-label') || 
                        received.hasAttribute('aria-labelledby')
    const isInteractive = ['button', 'a', 'input', 'select', 'textarea'].includes(
      received.tagName.toLowerCase()
    )

    const pass = hasRole || hasAriaLabel || isInteractive

    return {
      pass,
      message: () =>
        pass
          ? `expected element not to be accessible`
          : `expected element to be accessible (have role, aria-label, or be interactive)`,
    }
  },

  toHaveFocus(received: HTMLElement) {
    const pass = document.activeElement === received

    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have focus`
          : `expected element to have focus`,
    }
  },

  toBeVisible(received: HTMLElement) {
    const style = window.getComputedStyle(received)
    const isVisible = 
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      style.opacity !== '0' &&
      received.offsetParent !== null

    return {
      pass: isVisible,
      message: () =>
        isVisible
          ? `expected element not to be visible`
          : `expected element to be visible`,
    }
  },

  toHaveClass(received: HTMLElement, className: string) {
    const pass = received.classList.contains(className)

    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have class "${className}"`
          : `expected element to have class "${className}"`,
    }
  },

  toHaveNoClass(received: HTMLElement, className: string) {
    const pass = !received.classList.contains(className)

    return {
      pass,
      message: () =>
        pass
          ? `expected element to have class "${className}"`
          : `expected element not to have class "${className}"`,
    }
  },

  toBeDisabled(received: HTMLElement) {
    const isDisabled = 
      received.hasAttribute('disabled') ||
      received.getAttribute('aria-disabled') === 'true'

    return {
      pass: isDisabled,
      message: () =>
        isDisabled
          ? `expected element not to be disabled`
          : `expected element to be disabled`,
    }
  },

  toBeEnabled(received: HTMLElement) {
    const isEnabled = 
      !received.hasAttribute('disabled') &&
      received.getAttribute('aria-disabled') !== 'true'

    return {
      pass: isEnabled,
      message: () =>
        isEnabled
          ? `expected element not to be enabled`
          : `expected element to be enabled`,
    }
  },

  toHaveAttribute(received: HTMLElement, attribute: string, value?: string) {
    const hasAttribute = received.hasAttribute(attribute)
    const attributeValue = received.getAttribute(attribute)
    const pass = value === undefined 
      ? hasAttribute 
      : hasAttribute && attributeValue === value

    return {
      pass,
      message: () => {
        if (value === undefined) {
          return pass
            ? `expected element not to have attribute "${attribute}"`
            : `expected element to have attribute "${attribute}"`
        }
        return pass
          ? `expected element not to have attribute "${attribute}" with value "${value}"`
          : `expected element to have attribute "${attribute}" with value "${value}", but got "${attributeValue}"`
      },
    }
  },

  toHaveNoAttribute(received: HTMLElement, attribute: string) {
    const pass = !received.hasAttribute(attribute)

    return {
      pass,
      message: () =>
        pass
          ? `expected element to have attribute "${attribute}"`
          : `expected element not to have attribute "${attribute}"`,
    }
  },

  toHaveTextContent(received: HTMLElement, text: string | RegExp) {
    const content = received.textContent || ''
    const pass = typeof text === 'string' 
      ? content.includes(text)
      : text.test(content)

    return {
      pass,
      message: () =>
        pass
          ? `expected element not to have text content matching "${text}"`
          : `expected element to have text content matching "${text}", but got "${content}"`,
    }
  },

  toBeWithinRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max

    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be within range ${min}-${max}`
          : `expected ${received} to be within range ${min}-${max}`,
    }
  },

  toHaveBeenCalledWithDelay(received: any, expectedDelay: number) {
    if (!vi.isMockFunction(received)) {
      return {
        pass: false,
        message: () => 'expected a mock function',
      }
    }

    const calls = received.mock.calls
    if (calls.length < 2) {
      return {
        pass: false,
        message: () => 'expected function to be called at least twice to measure delay',
      }
    }

    // Get timestamps from mock (this assumes we're tracking them)
    const timestamps = received.mock.timestamps || []
    if (timestamps.length < 2) {
      return {
        pass: false,
        message: () => 'mock function does not have timestamp tracking',
      }
    }

    const actualDelay = timestamps[1] - timestamps[0]
    const tolerance = 50 // 50ms tolerance
    const pass = Math.abs(actualDelay - expectedDelay) <= tolerance

    return {
      pass,
      message: () =>
        pass
          ? `expected function not to be called with ~${expectedDelay}ms delay`
          : `expected function to be called with ~${expectedDelay}ms delay, but was ${actualDelay}ms`,
    }
  },
}

// Register all matchers
expect.extend(matchers)

// Helper function to add timestamp tracking to mocks
export const trackMockTimestamps = (mockFn: any) => {
  mockFn.mock.timestamps = []
  const originalImplementation = mockFn.getMockImplementation()
  
  mockFn.mockImplementation((...args: any[]) => {
    mockFn.mock.timestamps.push(Date.now())
    return originalImplementation?.(...args)
  })
  
  return mockFn
}

// Accessibility testing helper
export const expectAccessible = async (element: HTMLElement) => {
  // Check for basic accessibility
  expect(element).toBeAccessible()
  
  // Check for keyboard navigation
  const focusableElements = element.querySelectorAll(
    'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  
  if (focusableElements.length > 0) {
    expect(focusableElements[0]).toHaveAttribute('tabindex')
  }
  
  // Check for ARIA landmarks
  const hasLandmark = element.querySelector('[role]') !== null
  if (!hasLandmark && element.children.length > 3) {
    console.warn('Complex element without ARIA landmarks')
  }
}

// Focus management testing helper
export const expectFocusTrap = (container: HTMLElement) => {
  const focusableElements = Array.from(
    container.querySelectorAll(
      'a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ) as HTMLElement[]

  if (focusableElements.length === 0) {
    throw new Error('No focusable elements found in container')
  }

  // Check first element can receive focus
  focusableElements[0].focus()
  expect(focusableElements[0]).toHaveFocus()

  // Check last element can receive focus
  focusableElements[focusableElements.length - 1].focus()
  expect(focusableElements[focusableElements.length - 1]).toHaveFocus()

  return focusableElements
}

// Animation testing helper
export const expectSmoothTransition = async (
  element: HTMLElement,
  property: string,
  duration: number
) => {
  const initialValue = window.getComputedStyle(element).getPropertyValue(property)
  
  // Wait for transition
  await new Promise(resolve => setTimeout(resolve, duration + 50))
  
  const finalValue = window.getComputedStyle(element).getPropertyValue(property)
  
  expect(initialValue).not.toBe(finalValue)
}

// Export helpers
export default {
  trackMockTimestamps,
  expectAccessible,
  expectFocusTrap,
  expectSmoothTransition,
}