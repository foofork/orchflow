import type { SvelteComponent } from 'svelte';

// Svelte component internal types for mocking
export interface SvelteComponentInternals {
  $$: {
    fragment: any;
    ctx: any[];
    props: Record<string, any>;
    update: () => void;
    dirty: any[];
    after_update: any[];
    before_update: any[];
    context: Map<any, any>;
    callbacks: Record<string, any>;
    skip_bound: boolean;
    root: any;
    on_mount: any[];
    on_destroy: any[];
  };
  $set: (props: any) => void;
  $on: (event: string, handler: Function) => () => void;
  $destroy: () => void;
}

// Base class for mock Svelte components
export class MockSvelteComponent implements SvelteComponentInternals {
  $$: SvelteComponentInternals['$$'];
  $set: (props: any) => void;
  $on: (event: string, handler: Function) => () => void;
  $destroy: () => void;
  
  constructor(options: { target?: any; props?: any } = {}) {
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
    
    this.$set = (newProps: any) => {
      Object.assign(props, newProps);
    };
    
    this.$on = (_event: string, _handler: Function) => {
      return () => {}; // Return unsubscribe function
    };
    
    this.$destroy = () => {};
  }
}