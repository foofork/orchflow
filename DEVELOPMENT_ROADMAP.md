# Orchflow Development Roadmap

## =� Test Infrastructure Status

### Current Test Failures (2025-07-11)

#### =4 Vitest Test Failures

1. **Terminal I/O Performance Tests**
   - **Issue**: `should meet <10ms latency requirement for terminal input` 
   - **Priority**: HIGH

2. **File System Event Performance Tests**
   - **Issue**: `should process file change events within latency requirements` 
   - **Priority**: HIGH
   - **Fix Required**: Review file watcher mock implementation and test setup

3. **Editor State Synchronization Performance Tests**
   - **Issue**: `should sync cursor position with minimal latency` - Expected throughput >1000 ops/sec but got ~930
   - **Impact**: Performance benchmark not meeting targets
   - **Priority**: MEDIUM
   - **Fix Required**: Optimize cursor sync implementation or adjust performance expectations

#### 4 Ensure these have been resolved

1. **Ensure Exports**
   - `TerminalManager` should be exported from `$lib/stores/manager`
   - Multiple components trying to import non-existent exports

2. **CodeMirror Type Conflicts**
   - KeyBinding type incompatibilities between different @codemirror packages
   - Version mismatch causing type errors in CodeMirrorEditor.svelte

3. **Component Prop Type Issues**
   - Multiple components with incorrect prop types
   - Optional types not properly handled (string | undefined � string)
   - Missing ARIA roles for keyboard handlers

4. **Playwright Type Issues**
   - `toHaveScreenshot` method not recognized on expect matchers
   - Need to properly configure Playwright TypeScript types

#### =4 Test Infrastructure Issues


1. **Mock Configuration**
   - Ensure Tauri plugin mocks are complete (eg missing readDir export)
   - Need proper mock setup for @tauri-apps/plugin-updater

## =� Test Coverage Status

- **Unit Tests**: Multiple failures need resolution
- **Integration Tests**: Not run due to unit test failures
- **E2E Tests**: Blocked by port conflicts
- **Performance Tests**: 3 failures, others passing
- **Visual Tests**: Not yet running due to infrastructure issues


## =� Success Metrics

- [ ] All TypeScript errors resolved
- [ ] All unit tests passing
- [ ] Performance tests meeting targets
- [ ] E2E tests running without port conflicts
- [ ] Visual regression tests configured and passing
- [ ] >90% test coverage maintained



-----


## 🧪 Advanced Testing Infrastructure Improvements

### Mock Factory Enhancement
- [ ] Add auto-mocking capabilities to mock-factory.ts
- [ ] Create Svelte component mock factory with proper $$ support
- [ ] Implement store mock factory with auto-sync functionality
- [ ] Export proper TypeScript types for all mock utilities

### Mock Registry Implementation
- [ ] Create central MockRegistry class for all mocks
- [ ] Add reset and snapshot functionality
- [ ] Implement mock decorators for cleaner test syntax
- [ ] Document mock registry patterns

### Testing Pyramid Rebalancing
- [ ] Audit current unit tests for integration test candidates
- [ ] Create integration tests for Tauri API interactions
- [ ] Add critical user journey e2e tests (5-10 flows)
- [ ] Move appropriate unit tests to integration tests (target: 35% integration)

### Test Organization & Consistency
- [ ] Create test-preset.ts with all common imports
- [ ] Standardize all tests to use mock-factory pattern
- [ ] Create test fixtures for common scenarios
- [ ] Add component-test-utils.ts for standardized rendering

### TypeScript & Import Fixes
- [ ] Ensure @/test path alias works in all test files
- [ ] Fix mock type exports in mock-factory.ts
- [ ] Update all test imports to use path aliases
- [ ] Create proper type declarations for test globals

### Quality & Documentation
- [ ] Enable mutation testing (Stryker) in CI pipeline
- [ ] Create comprehensive testing guide in docs/
- [ ] Add test complexity analysis tools
- [ ] Implement test coverage gates (min 80% for new code)

### Performance & Monitoring
- [ ] Fix performance test timeouts (Terminal I/O, File System)
- [ ] Adjust cursor sync performance expectations
- [ ] Add performance regression detection
- [ ] Create performance testing dashboard
