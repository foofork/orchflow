# Orchflow Testing Guide

## Overview

This is the comprehensive testing guide for the Orchflow project, covering all test types, infrastructure, and best practices for developers.

## Quick Start

### Running Tests
```bash
# Unit tests
npm run test:unit
npm run test:unit:watch
npm run test:unit:ui

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
npm run test:e2e:smoke
npm run test:e2e:debug

# Visual regression tests
npm run test:visual
npm run test:visual:update

# Performance tests
npm run test:performance

# All tests with coverage
npm run test:coverage

# Mutation testing
npm run test:mutation
```

## Test Architecture

### Test Distribution Strategy
- **Unit Tests (65%)**: Fast, isolated component testing
- **Integration Tests (30%)**: Component interaction and API integration
- **E2E Tests (5%)**: Critical user journeys

### Infrastructure Components
1. **Vitest** - Fast unit and integration test runner
2. **Playwright** - E2E and visual regression testing
3. **MockRegistry** - Centralized mock management with TypeScript safety
4. **Port Manager** - Conflict-free test server management
5. **Stryker** - Mutation testing for quality assurance

### Port Management
Tests use dedicated port ranges to prevent conflicts:
- **Development**: 5173-5180
- **Unit Tests**: 5181-5190
- **E2E Tests**: 5191-5200
- **Visual Tests**: 5201-5210

## Test Types and Patterns

### Unit Tests
Located in `src/**/*.test.ts` files alongside source code.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { createTypedMock, buildSession } from '@/test/mock-factory';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  let cleanup: Array<() => void> = [];

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.restoreAllMocks();
  });

  it('should render correctly', () => {
    const { unmount } = render(MyComponent, {
      props: { session: buildSession({ name: 'Test' }) }
    });
    cleanup.push(unmount);
    
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
```

### Integration Tests
Located in `src/**/*.integration.test.ts` files.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { tauriAPI, fileSystemMock } from '../test/setup-integration';
import FileManager from './FileManager.svelte';

describe('FileManager Integration', () => {
  beforeEach(() => {
    fileSystemMock._clear();
    fileSystemMock._setFile('/test.txt', 'content');
  });

  it('should load and save files through Tauri API', async () => {
    render(FileManager);
    
    fireEvent.click(screen.getByText('Load File'));
    await waitFor(() => {
      expect(tauriAPI.invoke).toHaveBeenCalledWith('read_file');
    });
    
    expect(screen.getByDisplayValue('content')).toBeInTheDocument();
  });
});
```

### E2E Tests
Located in `tests/e2e/**/*.e2e.test.ts` files.

```typescript
import { test, expect } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright';
import { TestContext } from '../helpers/test-context';

describe('User Journey: Flow Creation', () => {
  let testContext: TestContext;

  beforeEach(async () => {
    testContext = new TestContext();
    await testContext.setup();
  });

  afterEach(async () => {
    await testContext.teardown();
  });

  test('user can create and run a flow', async () => {
    const { page } = await testContext.createPage();
    
    await page.goto('/');
    await page.click('[data-testid="create-flow"]');
    await page.fill('[data-testid="flow-name"]', 'E2E Test Flow');
    await page.click('[data-testid="save-flow"]');
    
    await expect(page.locator('[data-testid="flow-list"]'))
      .toContainText('E2E Test Flow');
  });
});
```

## Testing Utilities and Patterns

### Typed Mock Creation
Always use typed mocks instead of raw `vi.fn()`:

```typescript
import { createTypedMock, createAsyncMock, createSyncMock } from '@/test/mock-factory';

// ✅ Good - Typed mocks
const mockApiCall = createAsyncMock<[userId: string], User>();
mockApiCall.mockResolvedValue(buildUser());

const mockCalculation = createSyncMock<[a: number, b: number], number>();
mockCalculation.mockReturnValue(42);

// ❌ Bad - Raw vi.fn() without types
const badMock = vi.fn(); // ESLint error
```

### Domain Builders
Use builders for consistent test data:

```typescript
import { buildSession, buildPane, buildUser, buildTerminalConfig } from '@/test/mock-factory';

// ✅ Good - Use builders
const testSession = buildSession({
  name: 'Custom Session',
  panes: [
    buildPane({ title: 'Terminal 1' }),
    buildPane({ title: 'Terminal 2' })
  ]
});

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

### Cleanup Patterns
Always implement proper cleanup:

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

### Store Mocking
Use enhanced store utilities:

```typescript
import { createMockWritable, createMockManagerStores } from '@/test/mock-factory';

// ✅ Good - Typed store mocks
const mockUserStore = createMockWritable(buildUser());
const mockStores = createMockManagerStores();

mockStores.sessions.set([buildSession(), buildSession()]);

// ❌ Bad - Raw store creation
const badStore = writable({ data: 'test' }); // ESLint error
```

## Best Practices

### General Testing Principles
1. **Write tests first** (TDD when possible)
2. **Keep tests simple and focused**
3. **Use descriptive names** that explain the expected behavior
4. **Test behavior, not implementation**
5. **Maintain test independence**

### Code Organization
```typescript
describe('Component', () => {
  describe('when user is authenticated', () => {
    describe('and has admin permissions', () => {
      it('should show admin panel')
    });
  });
});
```

### Data-Driven Tests
```typescript
describe.each([
  { input: 'valid@email.com', expected: true },
  { input: 'invalid-email', expected: false },
  { input: '', expected: false }
])('Email validation', ({ input, expected }) => {
  it(`should return ${expected} for "${input}"`, () => {
    expect(validateEmail(input)).toBe(expected);
  });
});
```

### Async Testing
```typescript
test('async component lifecycle', async () => {
  render(MyComponent);
  
  // Wait for all pending promises
  await flushPromises();
  
  // Wait for animations to complete
  await waitForAnimation();
  
  expect(screen.getByText('Loaded')).toBeInTheDocument();
});
```

## Performance Testing

### Benchmarking
```typescript
import { bench, describe } from 'vitest';

describe('Flow Processing Benchmarks', () => {
  bench('process 100 flows', () => {
    const flows = generateTestFlows(100);
    processFlows(flows);
  });
});
```

### Memory Leak Detection
```typescript
it('should not leak memory', () => {
  const { memoryDelta } = measureMemory(() => {
    for (let i = 0; i < 1000; i++) {
      createAndDestroyComponent();
    }
  });
  
  expect(memoryDelta).toBeLessThan(1024 * 1024); // Less than 1MB
});
```

## Visual Regression Testing

### Playwright Visual Tests
```typescript
import { test, expect } from '@playwright/test';

test('flow editor appearance', async ({ page }) => {
  await page.goto('/flows/editor');
  await page.waitForLoadState('networkidle');
  
  // Full page screenshot
  await expect(page).toHaveScreenshot('flow-editor.png');
  
  // Component screenshot
  await expect(page.locator('[data-testid="flow-canvas"]'))
    .toHaveScreenshot('flow-canvas.png');
});
```

## CI/CD Integration

### GitHub Actions
Our CI pipeline runs:
1. **Lint and Type Check**
2. **Unit Tests** (parallel)
3. **Integration Tests** (parallel)
4. **Build Application**
5. **E2E Tests** (sequential)
6. **Visual Regression Tests**
7. **Performance Tests**
8. **Mutation Testing** (incremental)

### Test Coverage Requirements
- **Unit Test Coverage**: 90%+
- **Integration Test Coverage**: 70%+
- **Mutation Score**: 80%+
- **E2E Coverage**: Critical user journeys

## Debugging Tests

### Local Debugging
```bash
# Run single test file
npx vitest run src/lib/flow-manager.test.ts

# Debug mode
npx vitest --inspect-brk

# UI mode for interactive debugging
npm run test:unit:ui

# Playwright debug mode
npx playwright test --debug
```

### Debug Information
- Test artifacts are saved to `test-results/`
- Screenshots and videos for failed E2E tests
- Performance reports in JSON format
- Coverage reports in multiple formats

## Troubleshooting

### Common Issues
1. **Port conflicts**: Use PortManager allocation
2. **Timing issues**: Increase timeouts or add waits
3. **Mock leakage**: Use proper cleanup patterns
4. **Flaky tests**: Improve test isolation

### Performance Issues
1. **Slow tests**: Profile with timing decorators
2. **Memory leaks**: Use memory measurement tools
3. **CI timeouts**: Optimize test parallelization

### Visual Test Issues
1. **Font differences**: Use consistent font stack
2. **Animation timing**: Disable animations in tests
3. **Platform differences**: Use Docker for consistency

## Migration Guide

### From Old Patterns to New
```typescript
// Before
const mockFn = vi.fn();
const store = writable({ data: 'test' });
const user = { id: 1, name: 'John', email: 'john@example.com' };

// After
const mockFn = createTypedMock<[string], void>();
const store = createMockWritable({ data: 'test' });
const user = buildUser({ name: 'John', email: 'john@example.com' });
```

### Validation Script
Run the validation script to check pattern compliance:
```bash
npm run test:validate-patterns
```

## Resources and Links

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Stryker Mutator](https://stryker-mutator.io/)
- [Test Utilities Guide](./TEST_UTILITIES.md) - Detailed reference for test helpers
- [E2E Testing Guide](../tests/e2e/README.md) - E2E specific documentation

---

This guide is continuously updated. For questions or improvements, please open an issue or submit a PR.