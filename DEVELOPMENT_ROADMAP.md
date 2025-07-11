# Orchflow Development Roadmap

## =� Test Infrastructure Status

### Current Test Failures (2025-07-11)

#### =4 Vitest Test Failures

1. **Terminal I/O Performance Tests**
   - **Issue**: `should meet <10ms latency requirement for terminal input` - Test timeout after 30s
   - **Impact**: Terminal input performance testing not completing
   - **Priority**: HIGH
   - **Fix Required**: Investigate timeout issue, may need to adjust test expectations or mock implementation

2. **File System Event Performance Tests**
   - **Issue**: `should process file change events within latency requirements` - Test timeout after 30s
   - **Impact**: File system event performance testing not completing  
   - **Priority**: HIGH
   - **Fix Required**: Review file watcher mock implementation and test setup

3. **Editor State Synchronization Performance Tests**
   - **Issue**: `should sync cursor position with minimal latency` - Expected throughput >1000 ops/sec but got ~930
   - **Impact**: Performance benchmark not meeting targets
   - **Priority**: MEDIUM
   - **Fix Required**: Optimize cursor sync implementation or adjust performance expectations

#### =4 TypeScript Type Errors (608 errors)

1. **Missing Exports**
   - `TerminalManager` not exported from `$lib/stores/manager`
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

1. **Port Conflicts**
   - Port 5173 already in use when running Playwright tests
   - Socket file left behind from previous test runs

2. **Mock Configuration**
   - Tauri plugin mocks incomplete (missing readDir export)
   - Need proper mock setup for @tauri-apps/plugin-updater

### Next Steps

1. **Immediate Actions**
   - Fix TypeScript type errors to ensure code quality
   - Resolve test timeouts in performance tests
   - Clean up port conflicts and test infrastructure

2. **Short Term**
   - Update CodeMirror dependencies to resolve type conflicts
   - Implement proper Tauri plugin mocks
   - Configure Playwright TypeScript support

3. **Medium Term**
   - Review and optimize performance benchmarks
   - Add mutation testing once core tests pass
   - Implement visual regression testing with Percy

## =� Test Coverage Status

- **Unit Tests**: Multiple failures need resolution
- **Integration Tests**: Not run due to unit test failures
- **E2E Tests**: Blocked by port conflicts
- **Performance Tests**: 3 failures, others passing
- **Visual Tests**: Not yet running due to infrastructure issues

## <� Priority Order

1. **Fix TypeScript errors** - Blocking all development
2. **Resolve test timeouts** - Blocking CI/CD pipeline
3. **Fix mock configurations** - Needed for tests to run
4. **Clean up test infrastructure** - Port conflicts and cleanup
5. **Optimize performance tests** - Adjust targets or improve implementation

## =� Success Metrics

- [ ] All TypeScript errors resolved (0/608)
- [ ] All unit tests passing
- [ ] Performance tests meeting targets
- [ ] E2E tests running without port conflicts
- [ ] Visual regression tests configured and passing
- [ ] >90% test coverage maintained

## 🗄️ Database Architecture Cleanup

### Current State
- **orchflow.db**: Main app database using `rusqlite` via `SimpleStateStore`
- **memory.db**: Claude Flow's persistent memory (uses `sqlx`)
- **hive.db**: Hive Mind tool's database
- Incomplete transition from `rusqlite` to `sqlx` left both as dependencies

### Required Actions

1. **Consolidate Database Access**
   - All database operations should go through `SimpleStateStore` for consistency
   - Document the repository pattern architecture

2. **Clean Up Dependencies**
   - Keep both `rusqlite` (for app) and `sqlx` (for Claude Flow)
   - Remove any remaining references to deprecated SQLx-based code

3. **Documentation**
   - Document that `.swarm/` and `.hive-mind/` are external tool databases
   - Add clear separation between application data and development tool data

### Database Best Practices
- Run all development tools from project root to avoid duplicate databases
- Configure tools to use specific directories via config files
- Keep application database separate from tool databases