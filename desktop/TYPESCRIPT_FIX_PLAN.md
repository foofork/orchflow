# TypeScript Fix Plan with Code Examples

## Phase 1: Fix Store Mocking Infrastructure

### 1.1 Create Store Test Utilities
Create `/workspaces/orchflow/desktop/src/test/store-mocks.ts`:

```typescript
import { writable, type Writable, type Readable } from 'svelte/store';
import { vi } from 'vitest';

// Helper to create a mock writable store that mimics a derived store
export function createMockDerivedStore<T>(initialValue: T): Writable<T> & { _isDerived: boolean } {
  const store = writable(initialValue);
  return {
    ...store,
    _isDerived: true, // Mark as derived for testing purposes
  };
}

// Helper to create properly typed mock stores for manager
export function createMockManagerStores() {
  const mockSessions = createMockDerivedStore<Session[]>([]);
  const mockPanes = createMockDerivedStore<Map<string, Pane>>(new Map());
  const mockActiveSession = createMockDerivedStore<Session | undefined>(undefined);
  const mockPlugins = createMockDerivedStore<PluginInfo[]>([]);
  const mockIsConnected = createMockDerivedStore<boolean>(false);
  
  return {
    sessions: mockSessions,
    panes: mockPanes,
    activeSession: mockActiveSession,
    plugins: mockPlugins,
    isConnected: mockIsConnected,
  };
}
```

### 1.2 Update Manager Store Mock
Update the mock in test files to use the new utilities:

```typescript
// In test files, replace the current mock with:
vi.mock('$lib/stores/manager', async () => {
  const { createMockManagerStores } = await import('../test/store-mocks');
  const { vi } = await import('vitest');
  
  const stores = createMockManagerStores();
  
  const mockManager = {
    createTerminal: vi.fn<[], Promise<void>>(),
    createSession: vi.fn<[string], Promise<Session>>(),
    refreshSessions: vi.fn<[], Promise<void>>(),
    refreshPlugins: vi.fn<[], Promise<void>>(),
    searchProject: vi.fn<[string, any?], Promise<any>>(),
    listDirectory: vi.fn<[string], Promise<any>>(),
    sendInput: vi.fn<[string, string], Promise<void>>(),
    subscribe: vi.fn(),
  };
  
  return {
    manager: mockManager,
    sessions: stores.sessions,
    panes: stores.panes,
    activeSession: stores.activeSession,
    plugins: stores.plugins,
    isConnected: stores.isConnected,
  };
});
```

## Phase 2: Fix Mock Function Types

### 2.1 Create Typed Mock Factory
Create `/workspaces/orchflow/desktop/src/test/mock-factory.ts`:

```typescript
import { vi, type MockedFunction } from 'vitest';

// Factory to create properly typed mock functions
export function createMockFunction<T extends (...args: any[]) => any>(
  implementation?: T
): MockedFunction<T> {
  return vi.fn(implementation) as MockedFunction<T>;
}

// Specific mock creators for common patterns
export function createAsyncMock<TArgs extends any[], TReturn>(
  defaultResolve?: TReturn
): MockedFunction<(...args: TArgs) => Promise<TReturn>> {
  const mock = vi.fn<TArgs, Promise<TReturn>>();
  if (defaultResolve !== undefined) {
    mock.mockResolvedValue(defaultResolve);
  }
  return mock;
}
```

## Phase 3: Fix Component Mock Types

### 3.1 Update Component Mock Helper
Update `/workspaces/orchflow/desktop/src/test/setup-mocks.ts`:

```typescript
// Add proper Svelte component type
interface MockedSvelteComponent {
  $set: MockedFunction<(props: any) => void>;
  $on: MockedFunction<(event: string, handler: Function) => () => void>;
  $destroy: MockedFunction<() => void>;
  $$: {
    fragment: {
      c: MockedFunction<() => void>;
      m: MockedFunction<(target: HTMLElement, anchor?: Node) => void>;
      p: MockedFunction<(ctx: any[], dirty: number[]) => void>;
      d: MockedFunction<(detaching: boolean) => void>;
    };
    ctx: any[];
    props: Record<string, any>;
    update: MockedFunction<() => void>;
    not_equal: (a: any, b: any) => boolean;
    bound: Record<string, any>;
    on_mount: Function[];
    on_destroy: Function[];
    callbacks: Record<string, Function[]>;
    root: HTMLElement;
  };
  element: HTMLElement;
}

function createSvelteComponentMock(
  componentName: string, 
  defaultProps = {}
): MockedFunction<(options: any) => MockedSvelteComponent> {
  // ... existing implementation but return typed component
}
```

## Phase 4: Fix Test Data Builders

### 4.1 Create Type-Safe Test Data Builders
Create `/workspaces/orchflow/desktop/src/test/test-data-builders.ts`:

```typescript
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';

// Session builder
export function buildSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-1',
    name: 'Test Session',
    created_at: new Date().toISOString(),
    last_active: new Date().toISOString(),
    is_persistent: false,
    metadata: {},
    ...overrides,
  };
}

// Pane builder
export function buildPane(overrides?: Partial<Pane>): Pane {
  return {
    id: 'test-pane-1',
    session_id: 'test-session-1',
    pane_type: 'Terminal',
    title: 'Test Terminal',
    rows: 24,
    cols: 80,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Plugin builder
export function buildPlugin(overrides?: Partial<PluginInfo>): PluginInfo {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    enabled: true,
    config: {},
    ...overrides,
  };
}
```

## Phase 5: Fix Global Types

### 5.1 Update TypeScript Configuration
Add to `/workspaces/orchflow/desktop/tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    // ... existing options
  },
  "include": [
    "src/**/*.ts",
    "src/**/*.svelte",
    "src/**/*.d.ts",
    "vitest.config.ts"
  ]
}
```

### 5.2 Create Global Type Definitions
Create `/workspaces/orchflow/desktop/src/test/global.d.ts`:

```typescript
/// <reference types="vitest/globals" />
/// <reference types="@testing-library/jest-dom" />

declare global {
  // Ensure vitest globals are available
  const vi: typeof import('vitest').vi;
  const expect: typeof import('vitest').expect;
  const describe: typeof import('vitest').describe;
  const it: typeof import('vitest').it;
  const beforeEach: typeof import('vitest').beforeEach;
  const afterEach: typeof import('vitest').afterEach;
}

export {};
```

## Implementation Order

1. **Week 1**: Implement store mocking infrastructure (Phase 1)
   - Create store-mocks.ts
   - Update all test files using manager stores
   - Run tests to verify store errors are fixed

2. **Week 1**: Fix mock function types (Phase 2)
   - Create mock-factory.ts
   - Update test files to use typed mock creators
   - Verify mockResolvedValue errors are resolved

3. **Week 2**: Fix component mocks (Phase 3)
   - Update setup-mocks.ts with proper types
   - Ensure all component mocks have $$ property
   - Test component mounting works correctly

4. **Week 2**: Create test data builders (Phase 4)
   - Implement all builders
   - Replace inline mock data with builders
   - Ensure type safety throughout

5. **Week 3**: Fix global type recognition (Phase 5)
   - Update tsconfig.json
   - Create global type definitions
   - Verify all global errors are resolved

## Success Metrics

- TypeScript errors reduced from 528 to < 50
- All tests passing with proper types
- No use of `as any` type assertions
- Improved test maintainability
- Better IDE autocomplete in tests