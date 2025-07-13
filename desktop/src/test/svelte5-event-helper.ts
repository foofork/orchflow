/**
 * Svelte 5 Event Helper
 * 
 * Provides compatibility layer for Svelte 5 component event handling in tests
 */

import type { ComponentEvents } from 'svelte';

// Type for a Svelte component instance with event methods
export interface SvelteComponentWithEvents<T = any> {
  $on: (event: string, handler: (e: CustomEvent<any>) => void) => () => void;
  $set: (props: Record<string, any>) => void;
  [key: string]: any;
}

/**
 * Mock $on method for Svelte 5 components in tests
 * This captures events by setting up event listeners on the component's DOM element
 */
export function mockSvelteEvents<T = any>(component: T | undefined | null): SvelteComponentWithEvents<T> {
  // Handle undefined or null component
  if (!component) {
    const emptyComponent = {
      $on: (event: string, handler: (e: CustomEvent<any>) => void) => () => {},
      $set: (props: Record<string, any>) => {}
    } as SvelteComponentWithEvents<T>;
    return emptyComponent;
  }

  const mockComponent = component as any;
  const eventHandlers = new Map<string, ((e: CustomEvent<any>) => void)[]>();
  
  // Add mock $on method that stores event handlers
  mockComponent.$on = (event: string, handler: (e: CustomEvent<any>) => void) => {
    const handlers = eventHandlers.get(event) || [];
    handlers.push(handler);
    eventHandlers.set(event, handlers);
    
    // Return unsubscribe function
    return () => {
      const currentHandlers = eventHandlers.get(event) || [];
      const index = currentHandlers.indexOf(handler);
      if (index > -1) {
        currentHandlers.splice(index, 1);
      }
    };
  };
  
  // Add method to trigger events (for testing)
  mockComponent.$fire = (event: string, detail: any) => {
    const handlers = eventHandlers.get(event) || [];
    const customEvent = new CustomEvent(event, { detail });
    handlers.forEach(handler => handler(customEvent));
  };
  
  // Add mock $set method for property updates
  mockComponent.$set = (props: Record<string, any>) => {
    // In real Svelte 5, this would be replaced with reactive assignments
    Object.assign(mockComponent, props);
  };
  
  return mockComponent as SvelteComponentWithEvents<T>;
}

/**
 * Helper to create a component with mocked Svelte 5 methods
 */
export function createMockComponent<T = any>(component: T | undefined | null): SvelteComponentWithEvents<T> {
  return mockSvelteEvents(component);
}

/**
 * Type guard to check if a component has Svelte event methods
 */
export function hasSvelteEventMethods(component: any): component is SvelteComponentWithEvents {
  return component && (typeof component.$on === 'function' || typeof component.$set === 'function');
}