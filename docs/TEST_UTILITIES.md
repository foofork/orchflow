# Test Utilities Developer Reference

## Overview

This document provides comprehensive documentation for Orchflow's enhanced test infrastructure, including mock factories, domain builders, and testing patterns that ensure type safety and consistency across all tests.

## Mock Factories

### Typed Mock Creation

Always use typed mocks instead of raw `vi.fn()` for better type safety and IntelliSense support:

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

Use builders for consistent test data creation:

```typescript
import { 
  buildSession, 
  buildPane, 
  buildPlugin,
  buildTerminalConfig,
  buildEditorConfig,
  buildDashboardWidget,
  buildUser,
  buildGitStatus,
  buildFileNode,
  buildDirectoryNode
} from '@/test/mock-factory';

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
import { buildFileNode, buildDirectoryNode, testScenarios } from '@/test/mock-factory';

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
} from '@/test/mock-factory';

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
import { createMockWritable, createMockManagerStores, waitForStoreUpdate } from '@/test/mock-factory';

// ✅ Good - Typed store mocks
const mockUserStore = createMockWritable(buildUser());

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
test('store updates correctly', async () => {
  const store = createMockWritable({ loading: true });
  
  // Trigger some async operation
  someAsyncOperation();
  
  // Wait for specific store state
  await waitForStoreUpdate(store, (value) => !value.loading);
  
  expect(store.getValue()).toEqual({ loading: false });
});

// Wait for multiple stores
await waitForMultipleStores([
  { store: store1, predicate: (value) => value.ready },
  { store: store2, predicate: (value) => value.data !== null }
]);
```

## Component Mocking

### Svelte Component Mocks

```typescript
import { createSvelteComponentMock } from '@/test/mock-factory';

// ✅ Good - Enhanced component mock
const MockComponent = createSvelteComponentMock('TestComponent', {
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
import { flushPromises, waitForAnimation } from '@/test/mock-factory';

test('async component lifecycle', async () => {
  render(MyComponent);
  
  // Wait for all pending promises
  await flushPromises();
  
  // Wait for animations to complete
  await waitForAnimation();
  
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

## Cleanup Patterns

### Proper Resource Management

```typescript
describe('Component Tests', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.restoreAllMocks();
  });

  it('test with subscriptions', () => {
    const { unmount } = render(Component);
    cleanup.push(unmount);
    
    const unsubscribe = store.subscribe(callback);
    cleanup.push(unsubscribe);
  });
});
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
} from '@/test/mock-factory';
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

### 5. Consistent Mock Naming

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

## ESLint Rules

The project includes custom ESLint rules to enforce test utility usage:

### Test-Specific Rules

```javascript
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

## Test Utilities Organization

### Import Structure

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
} from '@/test/mock-factory';
```

## Validation

### Running Pattern Validation

```bash
# Check compliance with new patterns
npm run test:validate-patterns
```

The validation script checks for:
- **No raw vi.fn()** - Use typed mock factories
- **Cleanup array declaration** - Required in every test suite
- **Import from mock-factory** - Required import statement
- **Avoid mockImplementation** - Warning only, use sparingly

## Resources

- [Main Testing Guide](./TESTING_GUIDE.md) - Overview and best practices
- [E2E Testing Guide](../tests/e2e/README.md) - End-to-end testing specifics
- [Pre-commit Hooks](./PRE_COMMIT_HOOKS.md) - Quality gates and automation

---

This reference provides a comprehensive foundation for using the enhanced test infrastructure. Following these patterns will result in more maintainable, type-safe, and reliable tests.