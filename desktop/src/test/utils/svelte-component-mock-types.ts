import type { SvelteComponent } from 'svelte';

// Type definitions for Svelte component mocking
export type SvelteLifecycleCallback = () => void;
export type SvelteEventHandler = (...args: unknown[]) => void;
export type SvelteEventUnsubscriber = () => void;
export type SvelteFragment = {
  c: () => void; // create
  m: (target: Element, anchor?: Element | null) => void; // mount
  p: (ctx: unknown[], dirty: number[]) => void; // update
  d: (detaching: boolean) => void; // destroy
} | null;

// Svelte component internal types for mocking
export interface SvelteComponentInternals {
  $$: {
    fragment: SvelteFragment;
    ctx: unknown[];
    props: Record<string, unknown>;
    update: () => void;
    dirty: number[];
    after_update: SvelteLifecycleCallback[];
    before_update: SvelteLifecycleCallback[];
    context: Map<string, unknown>;
    callbacks: Record<string, SvelteEventHandler[]>;
    skip_bound: boolean;
    root: Element | null;
    on_mount: SvelteLifecycleCallback[];
    on_destroy: SvelteLifecycleCallback[];
  };
  $set: (props: Record<string, unknown>) => void;
  $on: (event: string, handler: SvelteEventHandler) => SvelteEventUnsubscriber;
  $destroy: () => void;
}

// Constructor options for mock Svelte components
export interface MockSvelteComponentOptions {
  target?: Element | null;
  props?: Record<string, unknown>;
  anchor?: Element | null;
  intro?: boolean;
}

// Base class for mock Svelte components
export class MockSvelteComponent implements SvelteComponentInternals {
  $$: SvelteComponentInternals['$$'];
  $set: (props: Record<string, unknown>) => void;
  $on: (event: string, handler: SvelteEventHandler) => SvelteEventUnsubscriber;
  $destroy: () => void;
  
  constructor(options: MockSvelteComponentOptions = {}) {
    const { target, props = {} } = options;
    
    this.$$ = {
      fragment: null,
      ctx: [],
      props: {},
      update: () => {},
      dirty: [],
      after_update: [],
      before_update: [],
      context: new Map(),
      callbacks: {},
      skip_bound: false,
      root: target,
      on_mount: [],
      on_destroy: []
    };
    
    this.$set = (newProps: Record<string, unknown>) => {
      Object.assign(props, newProps);
    };
    
    this.$on = (_event: string, _handler: SvelteEventHandler): SvelteEventUnsubscriber => {
      return () => {}; // Return unsubscribe function
    };
    
    this.$destroy = () => {};
  }
}