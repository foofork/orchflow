import { vi } from 'vitest';

/**
 * Enhanced Svelte component mocking to fix 'block.c is not a function' errors
 * This provides proper Svelte component structure for testing
 */

// Helper function to create proper Svelte component mocks
function createSvelteComponentMock(componentName: string, defaultProps = {}) {
  return vi.fn().mockImplementation((options: any) => {
    const { target, props = {} } = options;
    const mergedProps = { ...defaultProps, ...props };
    
    // Create actual DOM element
    const element = document.createElement('div');
    element.className = `mock-${componentName.toLowerCase()}`;
    element.setAttribute('data-testid', componentName);
    
    // Add content based on props
    if (mergedProps.title) {
      element.setAttribute('title', mergedProps.title);
    }
    
    if (mergedProps.show !== false && mergedProps.open !== false) {
      element.style.display = 'block';
    } else {
      element.style.display = 'none';
    }
    
    // Add to target if provided
    if (target) {
      target.appendChild(element);
    }
    
    // Create proper Svelte component interface
    const component = {
      // Standard Svelte component methods
      $set: vi.fn((newProps: any) => {
        Object.assign(mergedProps, newProps);
        // Update DOM based on props
        if (newProps.show !== undefined) {
          element.style.display = newProps.show ? 'block' : 'none';
        }
        if (newProps.open !== undefined) {
          element.style.display = newProps.open ? 'block' : 'none';
        }
        if (newProps.title !== undefined) {
          element.setAttribute('title', newProps.title);
        }
      }),
      
      $on: vi.fn((event: string, handler: Function) => {
        element.addEventListener(event, handler);
        return () => element.removeEventListener(event, handler);
      }),
      
      $destroy: vi.fn(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }),
      
      // Svelte internal properties (this fixes the block.c error)
      $$: {
        fragment: null,
        ctx: [],
        props: mergedProps,
        update: vi.fn(),
        not_equal: vi.fn(),
        bound: {},
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(),
        callbacks: {},
        dirty: [],
        skip_bound: false,
        root: element
      },
      
      // Component element for testing
      element,
      
      // Helper methods for testing
      _mockTriggerEvent: (event: string, detail?: any) => {
        const customEvent = new CustomEvent(event, { detail });
        element.dispatchEvent(customEvent);
      },
      
      _mockGetProps: () => ({ ...mergedProps }),
      
      _mockSetVisible: (visible: boolean) => {
        element.style.display = visible ? 'block' : 'none';
      }
    };
    
    return component;
  });
}

// Mock frequently used components
vi.mock('$lib/components/PluginStatusBar.svelte', () => ({
  default: createSvelteComponentMock('PluginStatusBar')
}));

vi.mock('$lib/components/Icon.svelte', () => ({
  default: createSvelteComponentMock('Icon', { name: 'icon' })
}));

vi.mock('$lib/components/Modal.svelte', () => ({
  default: createSvelteComponentMock('Modal', { show: false })
}));

vi.mock('$lib/components/Button.svelte', () => ({
  default: createSvelteComponentMock('Button', { variant: 'primary' })
}));

vi.mock('$lib/components/Dialog.svelte', () => ({
  default: createSvelteComponentMock('Dialog', { open: false })
}));

// Export the helper for other tests
export { createSvelteComponentMock };

