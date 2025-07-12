# Comprehensive Testing Guide

## Overview

This document describes the comprehensive testing infrastructure for the OrchFlow desktop application, including unit tests, integration tests, end-to-end tests, and mutation testing.

## Test Architecture

### Test Distribution Strategy

- **Unit Tests (60%)**: Fast, isolated component testing
- **Integration Tests (30%)**: Component interaction and Tauri API integration
- **End-to-End Tests (10%)**: Complete user journey validation

### Infrastructure Components

1. **MockRegistry**: Centralized mock management with decorators and performance tracking
2. **Integration Test Setup**: Real Tauri API simulation with file system and terminal mocks
3. **E2E Test Framework**: Playwright-based user journey testing
4. **Mutation Testing**: Stryker.js for test quality validation
5. **Test Audit Tools**: Automated analysis and migration recommendations

## Quick Start

### Running Tests

```bash
# Run all unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run complete test suite
npm run test:quality

# Run mutation testing
npm run test:mutation
```

### Test Development

```bash
# Watch mode for unit tests
npm run test:unit:watch

# Watch mode for integration tests
npm run test:integration:watch

# Test with UI
npm run test:unit:ui
```

## Test Types and Examples

### Unit Tests

Located in `src/**/*.test.ts` files alongside components.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { mockRegistry, createMock } from '../test/utils/mock-registry';
import MyComponent from './MyComponent.svelte';

describe('MyComponent', () => {
  beforeEach(() => {
    mockRegistry.reset();
  });

  it('should render correctly', () => {
    const { container } = render(MyComponent, {
      props: { title: 'Test' }
    });
    
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
    const { container } = render(FileManager);
    
    // Test file loading
    fireEvent.click(screen.getByText('Load File'));
    await waitFor(() => {
      expect(tauriAPI.invoke).toHaveBeenCalledWith('read_file');
    });
    
    // Verify file content appears
    expect(screen.getByDisplayValue('content')).toBeInTheDocument();
  });
});
```

### End-to-End Tests

Located in `tests/e2e/*.e2e.test.ts` files.

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Page, Browser, chromium } from 'playwright';

describe('User Journey: Project Creation', () => {
  let browser: Browser;
  let page: Page;

  beforeEach(async () => {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('http://localhost:5173');
  });

  it('should create project and add files', async () => {
    // Navigate through complete user workflow
    await page.click('[data-testid="new-project"]');
    await page.fill('[data-testid="project-name"]', 'Test Project');
    await page.click('[data-testid="create-project"]');
    
    // Verify project creation
    await expect(page.locator('[data-testid="project-list"]'))
      .toContainText('Test Project');
  });
});
```

## MockRegistry Usage

### Basic Mock Creation

```typescript
import { mockRegistry, createMock } from '../test/utils/mock-registry';

// Create function mock
const mockFn = createMock.function('api-call', async () => ({ data: 'test' }));

// Create module mock
const mockModule = createMock.module('tauri-api', () => ({
  invoke: vi.fn(),
  readFile: vi.fn()
}));

// Create component mock
const mockComponent = createMock.component('editor', MockEditor);
```

### Advanced Mock Decorators

```typescript
// Mock with logging
const loggedMock = createMock.function('logged-fn', implementation, {
  decorators: [mockDecorators.withLogging('API Call')]
});

// Mock with timing
const timedMock = createMock.function('timed-fn', implementation, {
  decorators: [mockDecorators.withTiming('api-call')]
});

// Mock with retry logic
const retryMock = createMock.function('retry-fn', implementation, {
  decorators: [mockDecorators.withRetry(3)]
});

// Mock with circuit breaker
const circuitMock = createMock.function('circuit-fn', implementation, {
  decorators: [mockDecorators.withCircuitBreaker(5, 60000)]
});
```

### Snapshot Management

```typescript
describe('Complex Test Suite', () => {
  beforeEach(() => {
    mockRegistry.createSnapshot('test-start');
  });

  afterEach(() => {
    mockRegistry.restoreSnapshot('test-start');
    mockRegistry.deleteSnapshot('test-start');
  });

  it('should maintain test isolation', () => {
    // Test implementation
  });
});
```

## Integration Test Patterns

### Tauri API Integration

```typescript
import { tauriAPI, fileSystemMock, terminalMock } from '../test/setup-integration';

describe('Tauri Integration', () => {
  it('should coordinate file operations', async () => {
    // Setup
    fileSystemMock._setFile('/project/file.txt', 'initial content');
    
    // Execute
    await component.loadFile('/project/file.txt');
    
    // Verify
    expect(tauriAPI.invoke).toHaveBeenCalledWith('read_file', {
      path: '/project/file.txt'
    });
  });
});
```

### Cross-Component Workflows

```typescript
describe('Dashboard + FileExplorer Integration', () => {
  it('should create project and update file tree', async () => {
    // Create project through dashboard
    await dashboard.createProject('Test Project');
    
    // Verify file explorer updates
    await waitFor(() => {
      expect(fileExplorer.getProjectList()).toContain('Test Project');
    });
  });
});
```

## E2E Test Best Practices

### Page Object Pattern

```typescript
class ProjectPage {
  constructor(private page: Page) {}

  async createProject(name: string) {
    await this.page.click('[data-testid="new-project"]');
    await this.page.fill('[data-testid="project-name"]', name);
    await this.page.click('[data-testid="create-project"]');
  }

  async getProjectList() {
    return this.page.locator('[data-testid="project-list"]');
  }
}
```

### Error Handling

```typescript
it('should handle network errors gracefully', async () => {
  // Simulate offline state
  await page.context().setOffline(true);
  
  // Attempt operation
  await page.click('[data-testid="sync-button"]');
  
  // Verify error handling
  await expect(page.locator('[data-testid="error-message"]'))
    .toContainText('Network connection failed');
});
```

## Mutation Testing

### Configuration

Mutation testing is configured in `stryker.conf.json`:

```json
{
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "thresholds": {
    "high": 90,
    "low": 80,
    "break": 75
  }
}
```

### Running Mutation Tests

```bash
# Full mutation testing
npm run test:mutation

# Incremental mutation testing
npm run test:mutation:incremental

# CI-optimized mutation testing
npm run test:mutation:ci
```

### Interpreting Results

- **Mutation Score**: Percentage of mutants killed by tests
- **High Threshold (90%)**: Excellent test quality
- **Low Threshold (80%)**: Acceptable test quality
- **Break Threshold (75%)**: Minimum acceptable quality

## Test Audit and Migration

### Automated Test Audit

```bash
# Analyze current test suite
npm run test:audit
```

The audit provides:
- Test distribution analysis
- Coverage gap identification
- Migration candidates
- Quality metrics
- Actionable recommendations

### Test Migration

```bash
# Dry run migration
npm run test:migrate -- --dry-run

# Execute migration
npm run test:migrate

# Force migration (overwrite existing)
npm run test:migrate -- --force
```

## Performance Testing

### Test Execution Performance

```typescript
import { mockDecorators } from '../test/utils/mock-registry';

const performanceMock = createMock.function('slow-operation', implementation, {
  decorators: [mockDecorators.withTiming('performance-test')]
});

// Check timing after test
const timings = performanceMock.getTimings();
expect(Math.max(...timings)).toBeLessThan(1000); // Max 1 second
```

### Load Testing Components

```typescript
describe('Performance Tests', () => {
  it('should handle large datasets efficiently', async () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: i,
      name: `Item ${i}`
    }));

    const startTime = performance.now();
    render(DataTable, { props: { data: largeDataset } });
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(100); // Max 100ms render
  });
});
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Test Quality Pipeline

on: [push, pull_request]

jobs:
  test-quality:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run test audit
        run: npm run test:audit
        
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Run integration tests
        run: npm run test:integration
        
      - name: Run E2E tests
        run: npm run test:e2e:ci
        
      - name: Run mutation testing
        run: npm run test:mutation:ci
        
      - name: Upload test results
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: test-results/
```

### Test Coverage Requirements

- **Unit Test Coverage**: 90%+
- **Integration Test Coverage**: 70%+
- **Mutation Score**: 80%+
- **E2E Coverage**: Critical user journeys

## Best Practices

### Test Naming

```typescript
// Good: Descriptive and specific
it('should display error message when API call fails')

// Bad: Vague
it('should work correctly')
```

### Test Organization

```typescript
describe('Component', () => {
  describe('when user is authenticated', () => {
    describe('and has admin permissions', () => {
      it('should show admin panel')
    });
  });
});
```

### Mock Lifecycle

```typescript
describe('Component Tests', () => {
  beforeEach(() => {
    mockRegistry.createSnapshot('test-start');
  });

  afterEach(() => {
    mockRegistry.restoreSnapshot('test-start');
    mockRegistry.clearCalls();
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

## Troubleshooting

### Common Issues

1. **Test Isolation**: Use `mockRegistry.reset()` and snapshots
2. **Async Operations**: Always use `waitFor()` for async assertions
3. **File System Tests**: Use `fileSystemMock._clear()` between tests
4. **Terminal Tests**: Properly setup terminal mock listeners

### Debug Mode

```bash
# Run tests with debug output
DEBUG=1 npm run test:unit

# Run specific test file
npm run test:unit -- src/components/MyComponent.test.ts

# Run tests with UI for debugging
npm run test:unit:ui
```

### Performance Issues

```bash
# Check test performance
npm run test:audit

# Run with timing information
npm run test:unit -- --reporter=verbose
```

## Continuous Improvement

### Metrics to Track

- Test execution time
- Test distribution ratios
- Mutation score trends
- Coverage percentages
- Failed test patterns

### Regular Maintenance

1. **Weekly**: Review test audit reports
2. **Monthly**: Analyze test distribution and migrate candidates
3. **Quarterly**: Update test infrastructure and tools
4. **Release**: Full test quality pipeline validation

---

For detailed examples and advanced patterns, see the test files in `src/` and `tests/` directories.