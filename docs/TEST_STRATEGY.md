# orchflow Test Strategy

## Overview

This document outlines the professional testing approach for all parts of orchflow - frontend components, backend services, and integration points. It serves as the single source of truth for testing practices across the codebase.

## Maintenance Rules

**When to Update:**
- New test patterns emerge
- Coverage requirements change
- Framework updates affect testing

**How to Update:**
1. Add real examples from working tests
2. Document patterns, not theory
3. Keep examples concise and focused

## Test Categories

### 1. Unit Tests (`.unit.test.ts`)
- **Purpose**: Test individual functions, utilities, and simple components
- **Environment**: jsdom
- **Mocking**: Minimal, only external dependencies
- **Run**: `npm run test:unit`

### 2. Component Tests (`.test.ts`)
- **Purpose**: Test Svelte components with user interactions
- **Environment**: jsdom with enhanced mocking
- **Mocking**: Canvas, Terminal, Tauri APIs
- **Run**: `npm run test`

### 3. Integration Tests (`.integration.test.ts`)
- **Purpose**: Test component interactions and data flow
- **Environment**: jsdom or node
- **Mocking**: Backend APIs, file system
- **Run**: `npm run test:integration`

### 4. E2E Tests (`.e2e.test.ts`)
- **Purpose**: Test full application flows
- **Environment**: Real browser (Playwright/WebdriverIO)
- **Mocking**: None, uses test backend
- **Run**: `npm run test:e2e`

## Handling Environment Issues

### Canvas/WebGL Components

For components using canvas (terminals, charts, visualizations):

```typescript
import { renderComponent } from '@/test/helpers/componentTest';

it('renders terminal without canvas errors', () => {
  const { container } = renderComponent(TerminalPanel, {
    mocks: { canvas: true, terminal: true }
  });
  
  expect(container.querySelector('.terminal-container')).toBeInTheDocument();
});
```

### Tauri API Calls

For components making Tauri API calls:

```typescript
it('loads data from backend', async () => {
  const { getByText } = renderComponent(FileExplorer, {
    mocks: {
      tauri: {
        get_file_tree: [
          { name: 'src', type: 'directory', children: [] }
        ]
      }
    }
  });
  
  await waitFor(() => {
    expect(getByText('src')).toBeInTheDocument();
  });
});
```

### ResizeObserver

For responsive components:

```typescript
import { mockResizeObserver } from '@/test/helpers/componentTest';

it('responds to resize', async () => {
  const { triggerResize } = mockResizeObserver();
  const { container } = render(ResponsiveComponent);
  
  const element = container.querySelector('.resizable');
  triggerResize(element!, { width: 1200, height: 800 });
  
  await waitFor(() => {
    expect(element).toHaveClass('large-screen');
  });
});
```

## Professional Testing Approach

### Core Principles

1. **Never Skip Tests to Hide Problems**: Failing tests reveal real functionality issues that need fixing
2. **Test Actual Functionality**: Use `testMode` only for DOM-specific issues (focus, positioning), never disable core logic
3. **Fix Components, Not Just Tests**: If tests fail, examine if the component has real problems
4. **Mock at Boundaries**: Mock external dependencies (Canvas, Tauri, network), not internal component logic

### TestMode Best Practices

**✅ GOOD - Use testMode to avoid DOM limitations:**
```typescript
function focusItem(index: number) {
  // Core logic always runs
  const item = menuItems[focusedIndex];
  if (item) {
    item.classList.add('focused');
    item.setAttribute('aria-selected', 'true');
    // Only skip DOM focus() in test mode
    if (!testMode) {
      item.focus();
    }
  }
}
```

**❌ BAD - Disabling core functionality:**
```typescript
function focusItem(index: number) {
  if (testMode) return; // ❌ Disables ALL functionality
  // ... rest of logic
}
```

### Component Testing Strategy

1. **Event Handlers**: Test that events are attached and work correctly
2. **Keyboard Navigation**: Verify focus management (classes, aria-selected) works
3. **State Management**: Test that component state updates correctly
4. **Slot Content**: Add DOM elements manually to test slot functionality
5. **Accessibility**: Verify ARIA attributes and roles are correct

### Example: Professional Component Test

```typescript
it('handles keyboard navigation', async () => {
  const { getByTestId } = render(ContextMenu, {
    props: { x: 100, y: 200, testMode: true },
    target: document.body
  });
  
  const menu = getByTestId('context-menu');
  
  // Add actual menu items to test with
  const button1 = document.createElement('button');
  button1.textContent = 'Item 1';
  menu.appendChild(button1);
  
  // Wait for event handlers to be attached
  await new Promise(resolve => setTimeout(resolve, 0));
  
  // Test keyboard navigation (document receives keydown events)
  await fireEvent.keyDown(document, { key: 'ArrowDown' });
  
  // Verify focus management works (CSS classes, not DOM focus)
  expect(button1).toHaveClass('focused');
  expect(button1).toHaveAttribute('aria-selected', 'true');
});
```

### Slot Testing Strategy

Since testing-library/svelte doesn't support slot syntax well, create DOM elements manually:

```typescript
it('renders menu items from slot', () => {
  const { getByTestId } = render(ContextMenu, {
    props: { x: 100, y: 200, testMode: true },
    target: document.body
  });
  
  // Create and add content to simulate slot
  const menu = getByTestId('context-menu');
  const item1 = document.createElement('button');
  item1.textContent = 'Item 1';
  menu.appendChild(item1);
  
  expect(menu.querySelector('button')).toHaveTextContent('Item 1');
});
```

### Common Anti-Patterns to Avoid

1. **Mocking entire components**: Test the real component, not a mock
2. **Skipping "complex" tests**: Complex tests often reveal the most important bugs
3. **Using invalid CSS selectors**: `:has-text()` doesn't work in jsdom
4. **Testing implementation details**: Test user-visible behavior
5. **Disabling functionality in testMode**: Use testMode for DOM limitations only

## Best Practices

1. **Test Real Component Behavior**: Mock external dependencies, not component logic
2. **Use Test IDs**: Add `data-testid` attributes for reliable element selection
3. **Mock at Boundaries**: Mock Canvas, Tauri APIs, network calls - not internal modules
4. **Parallel Test Execution**: Keep tests independent for parallel execution
5. **Professional Debugging**: Fix the component when tests fail, don't skip the test

## Backend Testing Strategy

### Rust Unit Tests

For Rust backend components in `src-tauri/`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_terminal_creation() {
        let manager = TerminalManager::new();
        let terminal = manager.create_terminal(Default::default());
        assert!(terminal.is_ok());
    }
    
    #[tokio::test]
    async fn test_async_operations() {
        let result = process_command("ls").await;
        assert!(result.is_ok());
    }
}
```

### Rust Integration Tests

Located in `src-tauri/tests/`:

```rust
use orchflow::prelude::*;

#[test]
fn test_full_terminal_lifecycle() {
    let app = create_test_app();
    let terminal = app.create_terminal();
    terminal.send_input("echo test\n");
    assert_eq!(terminal.read_output(), "test\n");
}
```

### Tauri Command Tests

Test IPC commands:

```rust
#[tauri::test]
async fn test_get_file_tree_command() {
    let app = tauri::test::mock_app();
    let result: FileTree = tauri::test::call_command(
        &app,
        "get_file_tree",
        json!({"path": "/tmp"})
    ).await.unwrap();
    assert!(result.entries.len() > 0);
}
```

## Coverage Requirements

- **Frontend Components**: 85% minimum
- **Rust Backend**: 80% minimum  
- **Integration Tests**: All critical paths
- **E2E Tests**: Happy paths + key error scenarios

## CI/CD Integration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      test-type: [unit, integration, e2e]
      platform: [frontend, backend]
  steps:
    - name: Run ${{ matrix.platform }} ${{ matrix.test-type }} tests
      run: |
        if [ "${{ matrix.platform }}" = "frontend" ]; then
          cd frontend && npm run test:${{ matrix.test-type }}
        else
          cd frontend/src-tauri && cargo test
        fi
```

## Performance Considerations

1. **Use `vitest` for speed**: Faster than Jest with better ESM support
2. **Selective test runs**: Use `.only` during development
3. **Parallel execution**: Tests run in parallel by default
4. **Shared setup**: Use `beforeAll` for expensive setup

## Debugging Failed Tests

```bash
# Run with UI
npm run test:unit:ui

# Run specific test file
npm test -- src/lib/components/Terminal.test.ts

# Run with coverage
npm test -- --coverage

# Debug in VS Code
# Add breakpoint and use "Debug Test" lens
```