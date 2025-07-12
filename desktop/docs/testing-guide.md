# Orchflow Testing Guide

A comprehensive guide to testing in the Orchflow project, covering unit tests, integration tests, E2E tests, performance tests, and visual regression tests.

## Table of Contents

1. [Testing Architecture](#testing-architecture)
2. [Test Types](#test-types)
3. [MockRegistry Usage](#mockregistry-usage)
4. [Running Tests](#running-tests)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Performance Testing](#performance-testing)
8. [Visual Regression Testing](#visual-regression-testing)
9. [Debugging Tests](#debugging-tests)
10. [Best Practices](#best-practices)

## Testing Architecture

Our testing infrastructure is built around several key components:

- **Vitest** - Fast unit and integration test runner
- **Playwright** - E2E and visual regression testing
- **MockRegistry** - Centralized mock management
- **Port Manager** - Conflict-free test server management
- **Stryker** - Mutation testing for quality assurance

### Test Distribution

- **Unit Tests**: 65% (focused, fast feedback)
- **Integration Tests**: 35% (component interactions)
- **E2E Tests**: 5-10 critical user journeys
- **Performance Tests**: Continuous monitoring
- **Visual Tests**: UI regression prevention

## Test Types

### Unit Tests
Located in `src/**/*.test.ts` files alongside source code.

```typescript
// Example: src/lib/flow-manager.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createMock } from '../test/utils/mock-registry';
import { FlowManager } from './flow-manager';

describe('FlowManager', () => {
  it('should create a new flow', () => {
    const mockTauri = createMock.api('tauri', {
      invoke: vi.fn().mockResolvedValue({ id: 1 })
    });
    
    const manager = new FlowManager();
    // Test implementation
  });
});
```

### Integration Tests
Located in `src/**/*.integration.test.ts` files.

```typescript
// Example: src/lib/flow-execution.integration.test.ts
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { tauriAPI, fileSystemMock } from '../test/setup-integration';

describe('Flow Execution Integration', () => {
  it('should execute flow and update UI', async () => {
    // Test full component + API integration
  });
});
```

### E2E Tests
Located in `tests/e2e/**/*.e2e.test.ts`.

```typescript
// Example: tests/e2e/user-journeys.e2e.test.ts
import { test, expect } from '@playwright/test';

test('user can create and run a flow', async ({ page }) => {
  await page.goto('/');
  // Full user journey testing
});
```

### Performance Tests
Located in `src/**/*.performance.test.ts`.

```typescript
// Example: src/lib/flow-processing.performance.test.ts
import { describe, it, expect } from 'vitest';
import { perf, regression } from '../test/setup/performance-setup';

describe('Flow Processing Performance', () => {
  it('should process large flows efficiently', () => {
    perf.start();
    // Performance critical code
    const duration = perf.end('large-flow-processing');
    
    expect(duration).toBeLessThan(1000); // Max 1 second
  });
});
```

## MockRegistry Usage

The MockRegistry provides centralized mock management with advanced features:

### Basic Usage

```typescript
import { mockRegistry, createMock, mockDecorators } from '../test/utils/mock-registry';

// Create mocks
const apiMock = createMock.api('tauri-api', {
  invoke: () => Promise.resolve({ success: true })
});

const storeMock = createMock.store('flow-store', writable([]), []);

// Apply decorators
const loggedMock = createMock.function('logged-fn', myFunction, {
  decorators: [mockDecorators.withLogging('MyFunction')]
});
```

### Snapshots and Reset

```typescript
beforeEach(() => {
  mockRegistry.createSnapshot('test-start');
});

afterEach(() => {
  mockRegistry.restoreSnapshot('test-start');
  mockRegistry.deleteSnapshot('test-start');
});
```

### Mock Decorators

```typescript
// Timing analysis
const timedMock = createMock.function('timed', fn, {
  decorators: [mockDecorators.withTiming()]
});

// Call limiting
const limitedMock = createMock.function('limited', fn, {
  decorators: [mockDecorators.withCallLimit(5)]
});

// Auto-reset after each test
const autoResetMock = createMock.function('auto-reset', fn, {
  decorators: [mockDecorators.withAutoReset()]
});
```

## Running Tests

### Local Development

```bash
# Unit tests
npm run test:unit
npm run test:unit:watch
npm run test:unit:ui

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Visual regression tests
npm run test:visual
npm run test:visual:update  # Update snapshots

# Performance tests
npm run test:performance

# All tests
npm run test:all

# With coverage
npm run test:coverage
```

### CI/CD Pipeline

```bash
# Complete CI test suite
npm run test:ci

# Mutation testing
npm run test:mutation
npm run test:mutation:incremental
```

### Port Management

Tests use dedicated port ranges to prevent conflicts:

- **Development**: 5173-5180
- **Unit Tests**: 5181-5190
- **E2E Tests**: 5191-5200
- **Visual Tests**: 5201-5210

The PortManager automatically allocates available ports within these ranges.

## Writing Tests

### Unit Test Guidelines

1. **Test one thing at a time**
2. **Use descriptive test names**
3. **Follow AAA pattern** (Arrange, Act, Assert)
4. **Mock external dependencies**
5. **Test edge cases and error conditions**

```typescript
describe('FlowValidator', () => {
  describe('validateFlow', () => {
    it('should return true for valid flow with all required fields', () => {
      // Arrange
      const validFlow = { name: 'Test', steps: [{ type: 'command' }] };
      
      // Act
      const result = FlowValidator.validateFlow(validFlow);
      
      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
    
    it('should return false for flow missing required name field', () => {
      // Arrange
      const invalidFlow = { steps: [{ type: 'command' }] };
      
      // Act
      const result = FlowValidator.validateFlow(invalidFlow);
      
      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });
  });
});
```

### Integration Test Guidelines

1. **Test component interactions**
2. **Use realistic data**
3. **Test happy path and error scenarios**
4. **Verify side effects**

```typescript
describe('Flow Creation Integration', () => {
  it('should create flow, save to storage, and update UI', async () => {
    // Setup realistic environment
    const { component } = render(FlowEditor);
    
    // User interaction
    await fireEvent.input(screen.getByLabelText('Name'), {
      target: { value: 'Test Flow' }
    });
    await fireEvent.click(screen.getByText('Save'));
    
    // Verify all parts work together
    expect(tauriAPI.invoke).toHaveBeenCalledWith('save_flow', expect.any(Object));
    expect(screen.getByText('Flow saved successfully')).toBeInTheDocument();
    expect(storeMock.update).toHaveBeenCalled();
  });
});
```

### E2E Test Guidelines

1. **Test critical user journeys**
2. **Use data-testid attributes**
3. **Wait for async operations**
4. **Test across different viewports**

```typescript
test('complete flow creation and execution journey', async ({ page }) => {
  // Navigate to flows
  await page.goto('/');
  await page.click('[data-testid="flows-tab"]');
  
  // Create flow
  await page.click('[data-testid="create-flow"]');
  await page.fill('[data-testid="flow-name"]', 'E2E Test Flow');
  await page.click('[data-testid="save-flow"]');
  
  // Verify creation
  await expect(page.locator('[data-testid="flow-list"]'))
    .toContainText('E2E Test Flow');
    
  // Execute flow
  await page.click('[data-testid="run-flow"]');
  await expect(page.locator('[data-testid="execution-status"]'))
    .toContainText('Running');
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

### Test Optimization

- **Parallel execution** for independent tests
- **Test sharding** for large suites
- **Incremental testing** for mutation tests
- **Smart test selection** based on changed files

## Performance Testing

### Benchmarking

```typescript
import { bench, describe } from 'vitest';

describe('Flow Processing Benchmarks', () => {
  bench('process 100 flows', () => {
    const flows = generateTestFlows(100);
    processFlows(flows);
  });
  
  bench('parse complex flow definition', () => {
    const complexFlow = generateComplexFlow();
    parseFlowDefinition(complexFlow);
  });
});
```

### Regression Detection

```typescript
import { regression } from '../test/setup/performance-setup';

it('should not regress in performance', () => {
  const { duration } = measureSync(() => {
    expensiveOperation();
  });
  
  const result = regression.checkRegression('expensive-operation', duration);
  expect(result.isRegression).toBe(false);
});
```

### Memory Profiling

```typescript
import { measureMemory } from '../test/setup/performance-setup';

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

### Percy Integration

```bash
# Run with Percy for visual diffing
npm run test:visual:percy
```

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

### CI Debugging

- Test artifacts are saved to `test-results/`
- Screenshots and videos for failed E2E tests
- Performance reports in JSON format
- Coverage reports in multiple formats

## Best Practices

### General

1. **Write tests first** (TDD when possible)
2. **Keep tests simple and focused**
3. **Use descriptive names**
4. **Test behavior, not implementation**
5. **Maintain test independence**

### Performance

1. **Use MockRegistry** for consistent mocking
2. **Parallel test execution** where possible
3. **Lazy loading** for expensive setup
4. **Smart test selection** in CI

### Maintenance

1. **Regular test cleanup**
2. **Update snapshots** when UI changes
3. **Review mutation test results**
4. **Monitor test execution times**

### Code Coverage

- **Minimum 80%** line coverage
- **Critical paths 100%** coverage
- **Integration tests** count toward coverage
- **Exclude test files** from coverage

### Mutation Testing

- **Run incrementally** on changed code
- **Minimum 80%** mutation score
- **Review surviving mutants**
- **Add tests** for uncovered cases

## Troubleshooting

### Common Issues

1. **Port conflicts**: Use PortManager allocation
2. **Timing issues**: Increase timeouts or add waits
3. **Mock leakage**: Use MockRegistry snapshots
4. **Flaky tests**: Improve test isolation

### Performance Issues

1. **Slow tests**: Profile with timing decorators
2. **Memory leaks**: Use memory measurement tools
3. **CI timeouts**: Optimize test parallelization

### Visual Test Issues

1. **Font differences**: Use consistent font stack
2. **Animation timing**: Disable animations in tests
3. **Platform differences**: Use Docker for consistency

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Stryker Mutator](https://stryker-mutator.io/)

---

This guide is continuously updated. For questions or improvements, please open an issue or submit a PR.