/**
 * Type definitions for setup-mocks.ts
 */

import type { MockedFunction } from 'vitest';

// Component options interface
export interface ComponentOptions {
  target?: HTMLElement;
  props?: Record<string, unknown>;
  anchor?: HTMLElement | null;
  intro?: boolean;
}

// Component props interface
export interface ComponentProps extends Record<string, unknown> {
  show?: boolean;
  open?: boolean;
  title?: string;
  name?: string;
  variant?: string;
}

// Svelte fragment interface
export interface SvelteFragment {
  c: MockedFunction<any>; // create
  m: MockedFunction<any>; // mount
  p: MockedFunction<any>; // update  
  d: MockedFunction<any>; // destroy
}

// Svelte component lifecycle callbacks
export type SvelteLifecycleCallback = (...args: unknown[]) => void;

// Svelte component $$ property
export interface SvelteInternals {
  fragment: SvelteFragment;
  ctx: unknown[];
  props: ComponentProps;
  update: MockedFunction<any>;
  not_equal: (a: unknown, b: unknown) => boolean;
  bound: Record<string, unknown>;
  on_mount: SvelteLifecycleCallback[];
  on_destroy: SvelteLifecycleCallback[];
  on_disconnect: SvelteLifecycleCallback[];
  before_update: SvelteLifecycleCallback[];
  after_update: SvelteLifecycleCallback[];
  context: Map<unknown, unknown>;
  callbacks: Record<string, SvelteLifecycleCallback[]>;
  dirty: number[];
  skip_bound: boolean;
  root: HTMLElement;
}

// Event handler type
export type EventHandler = (...args: unknown[]) => void;

// Mock event handler type
export type MockEventHandler = (event: string, detail?: unknown) => void;

// Mocked Svelte component interface
export interface MockedSvelteComponent {
  $set: MockedFunction<any>;
  $on: MockedFunction<any>;
  $destroy: MockedFunction<any>;
  $$: SvelteInternals;
  element: HTMLElement;
  _mockTriggerEvent: MockEventHandler;
  _mockGetProps: () => ComponentProps;
  _mockSetVisible: (visible: boolean) => void;
}

// Component constructor type
export type SvelteComponentConstructor = MockedFunction<any>;

// Component mock factory type
export type ComponentMockFactory = (componentName: string, defaultProps?: ComponentProps) => SvelteComponentConstructor;