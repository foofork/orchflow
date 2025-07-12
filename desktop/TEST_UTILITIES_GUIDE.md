# Test Utilities Usage Guide

## Overview

This guide provides comprehensive documentation for the enhanced test infrastructure, including mock factories, domain builders, and testing patterns that ensure type safety and consistency across all tests.

## Table of Contents

1. [Mock Factories](#mock-factories)
2. [Domain Builders](#domain-builders)
3. [Store Mocking](#store-mocking)
4. [Component Mocking](#component-mocking)
5. [Async Testing Utilities](#async-testing-utilities)
6. [ESLint Rules](#eslint-rules)
7. [Migration Guide](#migration-guide)
8. [Best Practices](#best-practices)

## Mock Factories

### Basic Mock Creation

```typescript
import { 
  createTypedMock, 
  createAsyncMock, 
  createSyncMock, 
  createVoidMock 
} from '@/test/mock-factory';

// ✅ Good - Typed mock with explicit signatures
const mockApiCall = createAsyncMock<[userId: string], User>();
mockApiCall.mockResolvedValue(buildUser());

// ✅ Good - Sync mock with return value
const mockCalculation = createSyncMock<[a: number, b: number], number>();
mockCalculation.mockReturnValue(42);

// ✅ Good - Void mock for side effects
const mockLogger = createVoidMock<[message: string]>();

// ❌ Bad - Raw vi.fn() without types
const badMock = vi.fn(); // ESLint error
```

### Advanced Mock Patterns

```typescript
import { MockPatterns } from '@/test/mock-factory';

// Conditional mocking based on input
const mockConditional = MockPatterns.conditionalMock([
  { args: ['user1'], returns: { name: 'John' } },
  { args: ['user2'], returns: { name: 'Jane' } },
]);

// Delayed async responses
const mockDelayed = MockPatterns.delayedMock({ data: 'result' }, 100);

// Sequence of return values
const mockSequence = createSequenceMock<[], string>(['first', 'second', 'third']);
```

## Domain Builders

### Core Domain Objects

```typescript
import { 
  buildSession, 
  buildPane, 
  buildPlugin,
  buildTerminalConfig,
  buildEditorConfig,
  buildDashboardWidget 
} from '@/test/domain-builders';

// ✅ Good - Use builders for complex objects
const testSession = buildSession({
  name: 'Custom Session',
  panes: [
    buildPane({ title: 'Terminal 1' }),
    buildPane({ title: 'Terminal 2' })
  ]
});

// ✅ Good - Override specific properties
const terminalConfig = buildTerminalConfig({
  fontSize: 16,
  theme: 'light'
});

// ❌ Bad - Inline object creation
const badSession = {
  id: 'test-session',
  name: 'Test',
  created_at: new Date().toISOString(),
  // ... many more properties
}; // ESLint warning
```

### File System Objects

```typescript
import { buildFileNode, buildDirectoryNode, testScenarios } from '@/test/domain-builders';

// Single file
const testFile = buildFileNode('app.js', '/src/app.js', {
  gitStatus: 'modified',
  size: 2048
});

// Directory with children
const srcDir = buildDirectoryNode('src', '/src', [
  buildFileNode('index.js', '/src/index.js'),
  buildFileNode('utils.js', '/src/utils.js')
]);

// Complex scenarios
const gitRepo = testScenarios.buildGitRepository([
  { path: '/src/index.js', status: 'modified' },
  { path: '/src/new-file.js', status: 'added' },
  { path: '/old-file.js', status: 'deleted' }
]);
```

### Terminal and Editor Objects

```typescript
import { 
  buildTerminalOutput, 
  buildTerminalTheme,
  createMockTerminal,
  createMockEditor 
} from '@/test/domain-builders';

// Terminal output sequence
const terminalSession = testScenarios.buildTerminalSession([
  { command: 'ls -la', output: 'total 0\ndrwxr-xr-x  2 user  staff   64 Jan  1 12:00 .' },
  { command: 'npm test', output: 'All tests passed!', exitCode: 0 }
]);

// Mock terminal instance
const mockTerminal = createMockTerminal();
mockTerminal.write.mockImplementation((data) => {
  // Custom implementation
});

// Mock editor instance  
const mockEditor = createMockEditor();
mockEditor.getValue.mockReturnValue('test content');
```

## Store Mocking

### Enhanced Store Utilities

```typescript
import { enhancedStoreMocks } from '@/test/mock-factory';
import { createMockWritable, createMockManagerStores } from '@/test/utils/mock-stores';

// ✅ Good - Typed store mocks
const mockUserStore = enhancedStoreMocks.createTypedWritable<User>({
  id: '1',
  name: 'Test User'
});

// ✅ Good - Mock manager stores
const mockStores = createMockManagerStores();
mockStores.sessions.set([buildSession(), buildSession()]);

// ✅ Good - Store with subscription tracking
const trackedStore = createTrackedStore({ count: 0 });
trackedStore.set({ count: 1 });
expect(trackedStore.getUpdateHistory()).toHaveLength(2);

// ❌ Bad - Raw store creation in tests
const badStore = writable({ data: 'test' }); // ESLint error
```

### Store Testing Patterns

```typescript
import { waitForStoreUpdate } from '@/test/utils/mock-stores';

test('store updates correctly', async () => {
  const store = createMockWritable({ loading: true });
  
  // Trigger some async operation
  someAsyncOperation();
  
  // Wait for specific store state
  await waitForStoreUpdate(store, (value) => !value.loading);
  
  expect(store.getValue()).toEqual({ loading: false });
});
```

## Component Mocking

### Svelte Component Mocks

```typescript
import { enhancedComponentMocks } from '@/test/mock-factory';
import { createSvelteComponentMock } from '@/test/setup-mocks';

// ✅ Good - Enhanced component mock
const MockComponent = enhancedComponentMocks.createSvelteComponentMock({
  title: 'Test Component'
});

// ✅ Good - Component with event simulation
const componentInstance = new MockComponent({
  target: document.body,
  props: { visible: true }
});

// Simulate events
componentInstance._mockTriggerEvent('close');
componentInstance._mockSetVisible(false);

// ✅ Good - Check component state
expect(componentInstance._mockGetProps()).toEqual({
  title: 'Test Component',
  visible: false
});
```

### Mock Component Registration

```typescript
// In test setup
vi.mock('$lib/components/CustomComponent.svelte', () => ({
  default: createSvelteComponentMock('CustomComponent', {
    defaultProp: 'default value'
  })
}));
```

## Async Testing Utilities

### Promise and Timing Utilities

```typescript
import { flushPromises, waitForAnimation } from '@/test/utils';

test('async component lifecycle', async () => {
  render(MyComponent);
  
  // Wait for all pending promises
  await flushPromises();
  
  // Wait for animations to complete
  await waitForAnimation();
  
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

### Store Synchronization

```typescript
test('multiple store coordination', async () => {
  const store1 = createMockWritable({ ready: false });
  const store2 = createMockWritable({ data: null });
  
  // Wait for multiple stores
  await waitForMultipleStores([
    { store: store1, predicate: (value) => value.ready },
    { store: store2, predicate: (value) => value.data !== null }
  ]);
  
  // Both stores are now in expected state
});
```

## ESLint Rules

### Test-Specific Rules

The project includes custom ESLint rules to enforce test utility usage:

```javascript
// .eslintrc-test.js enforces:

// ❌ Error - Raw vi.fn() usage
const mock = vi.fn(); // Use createTypedMock() instead

// ❌ Error - Raw store creation
const store = writable({}); // Use createMockWritable() instead

// ❌ Warning - Large inline objects
const largeObject = { /* 10+ properties */ }; // Use test builders

// ❌ Error - Missing cleanup
test('async test', async () => {
  store.subscribe(/* ... */);
  // Missing afterEach cleanup
});
```

### Fixing ESLint Errors

```typescript
// Before (ESLint errors)
const mockFn = vi.fn();
const store = writable({ data: 'test' });
const user = { id: 1, name: 'John', email: 'john@example.com', created: new Date() };

// After (ESLint compliant)
const mockFn = createTypedMock<[string], void>();
const store = createMockWritable({ data: 'test' });
const user = buildUser({ name: 'John', email: 'john@example.com' });
```

## Migration Guide

### Step 1: Update Imports

```typescript
// Before
import { vi } from 'vitest';
import { writable, readable } from 'svelte/store';

// After
import { 
  vi, 
  createTypedMock, 
  createMockWritable,
  buildSession,
  buildUser 
} from '@/test/utils';
```

### Step 2: Replace Mock Patterns

```typescript
// Before
const mockInvoke = vi.fn();
mockInvoke.mockResolvedValue({ success: true });

// After
const mockInvoke = createAsyncMock<[string, any], any>();
mockInvoke.mockResolvedValue({ success: true });
```

### Step 3: Use Domain Builders

```typescript
// Before
const testSession = {
  id: 'test-session-1',
  name: 'Test Session',
  created_at: new Date().toISOString(),
  panes: []
};

// After
const testSession = buildSession({
  name: 'Test Session'
});
```

### Step 4: Add Cleanup

```typescript
// Before
test('store subscription', () => {
  const unsubscribe = store.subscribe(callback);
  // Missing cleanup
});

// After
test('store subscription', () => {
  const unsubscribe = store.subscribe(callback);
  
  afterEach(() => {
    unsubscribe();
  });
});
```

## Best Practices

### 1. Use Builders for Complex Objects

```typescript
// ✅ Good
const user = buildUser({ role: 'admin' });
const session = buildSession({ user });

// ❌ Bad
const user = { id: 1, name: 'Admin', role: 'admin', /* ... */ };
```

### 2. Prefer Typed Mocks

```typescript
// ✅ Good
const mockApi = createAsyncMock<[Request], Response>();

// ❌ Bad
const mockApi = vi.fn();
```

### 3. Clean Up Resources

```typescript
// ✅ Good
test('component with subscription', () => {
  const cleanup = [];
  
  const unsubscribe = store.subscribe(/* ... */);
  cleanup.push(unsubscribe);
  
  afterEach(() => {
    cleanup.forEach(fn => fn());
  });
});
```

### 4. Use Scenario Builders

```typescript
// ✅ Good
const gitRepo = testScenarios.buildGitRepository([
  { path: '/file1.js', status: 'modified' },
  { path: '/file2.js', status: 'added' }
]);

// ❌ Bad - Manual array construction
const files = [/* manual object creation */];
```

### 5. Test Utility Organization

```typescript
// Group related utilities
import {
  // Mock factories
  createTypedMock,
  createAsyncMock,
  
  // Domain builders
  buildUser,
  buildSession,
  
  // Test scenarios
  testScenarios,
  
  // Store utilities
  createMockWritable,
  waitForStoreUpdate
} from '@/test/utils';
```

### 6. Consistent Mock Naming

```typescript
// ✅ Good naming
const mockUserService = createMockUserService();
const mockInvokeCommand = createAsyncMock<[string], CommandResult>();

// ❌ Bad naming
const userThing = vi.fn();
const cmd = vi.fn();
```

## Common Patterns

### Testing Async Components

```typescript
test('async component loading', async () => {
  const mockData = buildApiResponse({ users: [buildUser()] });
  const mockFetch = createAsyncMock<[string], ApiResponse>();
  mockFetch.mockResolvedValue(mockData);
  
  render(UserList, { props: { fetchUsers: mockFetch } });
  
  await waitFor(() => {
    expect(screen.getByText(mockData.users[0].name)).toBeInTheDocument();
  });
});
```

### Testing Store Integration

```typescript
test('component store integration', async () => {
  const userStore = createMockWritable(buildUser());
  const settingsStore = createMockWritable(buildSettings());
  
  render(UserProfile, {
    context: new Map([
      ['userStore', userStore],
      ['settingsStore', settingsStore]
    ])
  });
  
  // Update store and verify component updates
  userStore.set(buildUser({ name: 'Updated Name' }));
  
  await waitFor(() => {
    expect(screen.getByText('Updated Name')).toBeInTheDocument();
  });
});
```

### Testing Error Scenarios

```typescript
test('handles API errors gracefully', async () => {
  const mockApi = createRejectingMock<[string]>('Network error');
  
  render(DataComponent, { props: { api: mockApi } });
  
  await waitFor(() => {
    expect(screen.getByText('Error: Network error')).toBeInTheDocument();
  });
});
```

This guide provides a comprehensive foundation for using the enhanced test infrastructure. Following these patterns will result in more maintainable, type-safe, and reliable tests.