# orchflow Test Strategy

## Overview

This document outlines the professional testing approach for orchflow, addressing environment-related issues and ensuring comprehensive test coverage.

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

## Best Practices

1. **Isolate Canvas Rendering**: Use mock canvas contexts for unit tests
2. **Test Behavior, Not Implementation**: Focus on user interactions and outcomes
3. **Use Test IDs**: Add `data-testid` attributes for reliable element selection
4. **Mock at Boundaries**: Mock external dependencies, not internal modules
5. **Parallel Test Execution**: Keep tests independent for parallel execution

## CI/CD Integration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  strategy:
    matrix:
      test-type: [unit, integration, e2e]
  steps:
    - name: Run ${{ matrix.test-type }} tests
      run: npm run test:${{ matrix.test-type }}
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