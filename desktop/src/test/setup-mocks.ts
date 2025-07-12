import { vi, type MockedFunction, type Mock } from 'vitest';

/**
 * Enhanced Svelte component mocking to fix 'block.c is not a function' errors
 * This provides proper Svelte component structure for testing
 */

// Svelte component type definition
interface MockedSvelteComponent {
  $set: any;
  $on: any;
  $destroy: any;
  $$: {
    fragment: {
      c: () => {},
      m: () => {},
      p: () => {},
      d: () => {}
    };
    ctx: any[];
    props: Record<string, any>;
    update: () => void;
    not_equal: (a: any, b: any) => boolean;
    bound: Record<string, any>;
    on_mount: Function[];
    on_destroy: Function[];
    on_disconnect: Function[];
    before_update: Function[];
    after_update: Function[];
    context: Map<any, any>;
    callbacks: Record<string, Function[]>;
    dirty: number[];
    skip_bound: boolean;
    root: HTMLElement;
  };
  element: HTMLElement;
  _mockTriggerEvent: (event: string, detail?: any) => void;
  _mockGetProps: () => Record<string, any>;
  _mockSetVisible: (visible: boolean) => void;
}

// Helper function to create proper Svelte component mocks
function createSvelteComponentMock(
  componentName: string, 
  defaultProps: Record<string, any> = {}
): any {
  return vi.fn().mockImplementation((options: any) => {
    const { target, props = {}, anchor, intro } = options;
    const mergedProps = { ...defaultProps, ...props };
    
    // Create actual DOM element
    const element = document.createElement('div');
    element.className = `mock-${componentName.toLowerCase()}`;
    element.setAttribute('data-testid', componentName);
    
    // Add content based on props
    if (mergedProps.title) {
      element.setAttribute('title', mergedProps.title);
    }
    
    // For Modal/Dialog components, render children if show/open is true
    const isVisible = mergedProps.show !== false && mergedProps.open !== false;
    if (isVisible) {
      element.style.display = 'block';
    } else {
      element.style.display = 'none';
    }
    
    // Add to target if provided
    if (target) {
      if (anchor) {
        target.insertBefore(element, anchor);
      } else {
        target.appendChild(element);
      }
    }
    
    // Create proper Svelte component interface
    const component: MockedSvelteComponent = {
      // Standard Svelte component methods
      $set: vi.fn((newProps: any) => {
        Object.assign(mergedProps, newProps);
        // Update DOM based on props
        if (newProps.show !== undefined || newProps.open !== undefined) {
          const shouldShow = newProps.show !== false && newProps.open !== false;
          element.style.display = shouldShow ? 'block' : 'none';
        }
        if (newProps.title !== undefined) {
          element.setAttribute('title', newProps.title);
        }
      }),
      
      $on: vi.fn((event: string, handler: Function) => {
        element.addEventListener(event, handler as EventListener);
        return () => element.removeEventListener(event, handler as EventListener);
      }),
      
      $destroy: vi.fn(() => {
        if (element.parentNode) {
          element.parentNode.removeChild(element);
        }
      }),
      
      // Svelte internal properties
      $$: {
        fragment: {
          c: vi.fn(() => ({})), // create
          m: vi.fn(() => ({})), // mount
          p: vi.fn(() => ({})), // update  
          d: vi.fn(() => ({}))  // destroy
        },
        ctx: [],
        props: mergedProps,
        update: vi.fn(() => ({})),
        not_equal: (a: any, b: any) => a !== b,
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
