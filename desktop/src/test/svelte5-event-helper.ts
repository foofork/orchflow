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
 * This is a temporary solution until we fully migrate to Svelte 5 patterns
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
  
  // Add mock $on method that does nothing but doesn't throw
  mockComponent.$on = (event: string, handler: (e: CustomEvent<any>) => void) => {
    // In real Svelte 5, this would be replaced with proper event props
    // For now, just return a no-op function
    return () => {};
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