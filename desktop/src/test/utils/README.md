# Test Utilities Documentation

This directory contains shared test utilities and mocks for the orchflow desktop application test suite.

## Files Overview

### `component-test-utils.ts`
Enhanced utilities for testing Svelte components:
- `renderWithContext()` - Render components with stores and context
- `simulateKeyboard()` - Simulate keyboard events with proper key codes
- `simulateMouse()` - Simulate mouse events with coordinates
- `simulateDragAndDrop()` - Test drag and drop interactions
- `createMockResizeObserver()` - Mock resize observer for testing responsive behavior
- `createMockIntersectionObserver()` - Mock intersection observer for visibility testing
- `createTestHarness()` - Create reusable test setups

### `mock-stores.ts`
Mock Svelte stores for testing:
- `createMockWritable()` - Writable store with spy functions
- `createMockReadable()` - Readable store with spy functions
- `createMockDerived()` - Derived store with spy functions
- `createMockTerminalStore()` - Mock terminal management store
- `createMockSettingsStore()` - Mock settings store
- `createMockFileExplorerStore()` - Mock file explorer store
- `createMockCommandPaletteStore()` - Mock command palette store
- `createTrackedStore()` - Store that tracks all updates and subscriptions

### `mock-tauri.ts`
Complete Tauri API mocks:
- `createMockWindow()` - Mock window API with event handling
- `createMockFs()` - Mock file system with in-memory storage
- `createMockDialog()` - Mock dialog API
- `createMockShell()` - Mock shell/process API
- `createMockClipboard()` - Mock clipboard API
- `createMockInvoke()` - Mock Tauri invoke function
- `setupTauriMocks()` - Set up all mocks in global scope

### `accessibility-utils.ts`
Accessibility testing utilities:
- `checkAccessibility()` - Run axe-core accessibility tests
- `assertNoViolations()` - Assert no a11y violations
- `checkAriaAttributes()` - Verify ARIA attributes
- `checkKeyboardNavigation()` - Test keyboard navigation order
- `setupScreenReaderTest()` - Monitor screen reader announcements
- `checkFocusManagement()` - Test focus trap and restore
- `checkColorContrast()` - Verify color contrast ratios
- `checkHeadingStructure()` - Validate heading hierarchy
- `checkLandmarks()` - Check landmark regions

### `test-fixtures.ts`
Common test data and fixtures:
- File system fixtures (basic and nested projects)
- Terminal session fixtures
- Editor state fixtures
- Settings configurations
- Command palette data
- Mock component props
- Event fixtures
- Test data generators

### `canvas.ts` (existing)
Canvas testing utilities for terminal rendering

## Usage Examples

### Testing a Component with Context

```typescript
import { renderWithContext, createMockSettingsStore } from '@/test/utils';

test('component renders with custom settings', () => {
  const settings = createMockSettingsStore();
  settings.setSetting('theme', 'light');

  const { component } = renderWithContext(MyComponent, {
    someProp: 'value'
  }, {
    stores: { settings }
  });

  expect(component).toBeTruthy();
  expect(settings.setSetting).toHaveBeenCalledWith('theme', 'light');
});
```

### Testing Keyboard Interactions

```typescript
import { simulateKeyboard, waitForComponentUpdate } from '@/test/utils';

test('handles keyboard shortcuts', async () => {
  const { getByRole } = render(CommandPalette);
  const input = getByRole('searchbox');

  simulateKeyboard(input, 'k', { ctrlKey: true });
  
  await waitForComponentUpdate(() => {
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
```

### Testing Accessibility

```typescript
import { checkAccessibility, assertNoViolations, checkKeyboardNavigation } from '@/test/utils';

test('modal is accessible', async () => {
  const { container } = render(Modal, { isOpen: true });
  
  // Check for violations
  const results = await checkAccessibility(container);
  assertNoViolations(results);
  
  // Check keyboard navigation
  checkKeyboardNavigation(container, [
    'button[aria-label="Close"]',
    'input[type="text"]',
    'button[type="submit"]'
  ]);
});
```

### Testing with Tauri Mocks

```typescript
import { setupTauriMocks } from '@/test/utils';

beforeEach(() => {
  const tauri = setupTauriMocks();
  
  // Set up specific behavior
  tauri.fs.mockAddFile('/config.json', JSON.stringify({ theme: 'dark' }));
});

test('loads configuration from file', async () => {
  const config = await loadConfig();
  
  expect(window.__TAURI__.fs.readTextFile).toHaveBeenCalledWith('/config.json');
  expect(config.theme).toBe('dark');
});
```

### Testing with Mock Stores

```typescript
import { createMockTerminalStore, waitForStoreUpdate } from '@/test/utils';

test('terminal management', async () => {
  const store = createMockTerminalStore();
  
  // Create a terminal
  const terminal = store.createTerminal('term-1', 'bash');
  
  // Wait for store update
  await waitForStoreUpdate(
    store.terminals,
    terminals => terminals.size > 0
  );
  
  expect(store.createTerminal).toHaveBeenCalledWith('term-1', 'bash');
  expect(terminal.id).toBe('term-1');
});
```

### Using Test Fixtures

```typescript
import { fileSystemFixtures, terminalFixtures, createMockContext } from '@/test/utils';

test('file explorer displays project structure', () => {
  const context = createMockContext({
    files: writable(fileSystemFixtures.nestedProject)
  });

  const { container } = render(FileExplorer, {}, { context });
  
  expect(container.querySelector('[data-path="/workspace/frontend"]')).toBeTruthy();
  expect(container.querySelector('[data-path="/workspace/backend"]')).toBeTruthy();
});
```

### Testing Drag and Drop

```typescript
import { simulateDragAndDrop, fileSystemFixtures } from '@/test/utils';

test('file can be dragged to folder', async () => {
  const { getByTestId } = render(FileTree, {
    files: fileSystemFixtures.basicProject
  });

  const file = getByTestId('file-/project/src/index.ts');
  const folder = getByTestId('folder-/project/dist');

  await simulateDragAndDrop(file, folder);

  expect(onFileMoved).toHaveBeenCalledWith(
    '/project/src/index.ts',
    '/project/dist/index.ts'
  );
});
```

## Best Practices

1. **Always clean up mocks** - Use `mockReset()` in `afterEach()` hooks
2. **Use type-safe mocks** - The mocks implement partial interfaces for type safety
3. **Test accessibility** - Run a11y checks on all interactive components
4. **Use fixtures for consistency** - Reuse test data across tests
5. **Mock at the right level** - Mock external APIs, not internal functions
6. **Test user interactions** - Focus on how users interact with components

## Adding New Utilities

When adding new test utilities:

1. Create focused, single-purpose utilities
2. Add TypeScript types for all parameters and returns
3. Include JSDoc comments with examples
4. Export from the index file
5. Update this README with usage examples