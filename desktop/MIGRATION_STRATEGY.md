# Test Infrastructure Migration Strategy

## Overview

This document outlines the strategy for migrating existing test files to use the enhanced test infrastructure patterns. The migration is designed to be incremental, allowing for immediate benefits while minimizing disruption.

## Migration Phases

### Phase 1: Core Infrastructure (✅ Complete)
- [x] Enhanced mock factories
- [x] Domain builders
- [x] Store mocking utilities
- [x] Component mocking framework
- [x] ESLint rules and validation

### Phase 2: Critical Test Files (🔄 In Progress)
Priority order based on impact and complexity:

#### High Priority (Immediate Migration)
1. **Terminal.test.ts** ✅ - Updated with full patterns
2. **FileExplorer.test.ts** - Complex Tauri API mocking
3. **StatusBar.test.ts** - Store integration patterns
4. **CommandPalette.test.ts** - Event handling and commands
5. **manager.test.ts** - Critical store with complex state

#### Medium Priority (Next Sprint)
6. **settings.test.ts** - localStorage and persistence
7. **terminal-ipc.test.ts** - IPC communication patterns
8. **metrics.test.ts** - System metrics and async data
9. **PluginManager.test.ts** - Plugin lifecycle management
10. **Dashboard.test.ts** - Widget system and layout

#### Lower Priority (Following Sprints)
- Remaining component tests
- Service layer tests
- Utility function tests

### Phase 3: Validation and Enforcement (📋 Planned)
- Automated migration verification
- CI/CD integration
- Developer training and documentation

## File-by-File Migration Guide

### 1. Terminal.test.ts ✅
**Status**: Complete
**Patterns Applied**:
- Typed mock factories for all vi.fn() usage
- Domain builders (buildTerminalConfig, createMockTerminal)
- Enhanced store mocking
- Proper cleanup patterns

**Before/After Example**:
```typescript
// Before
const mockWrite = vi.fn();
const config = { fontSize: 14, theme: 'dark' };

// After
const mockWrite = createSyncMock<[string], void>();
const config = buildTerminalConfig({ theme: 'dark' });
```

### 2. FileExplorer.test.ts 📋
**Estimated Effort**: 4-6 hours
**Key Changes Needed**:
- Replace Tauri API mocks with enhanced utilities
- Use buildFileNode/buildDirectoryNode for test data
- Implement proper file operation mocking
- Add async cleanup patterns

**Migration Steps**:
1. Replace vi.fn() with createAsyncMock for Tauri APIs
2. Use testScenarios.buildGitRepository for complex structures
3. Add proper cleanup for file watchers and subscriptions
4. Update event simulation patterns

### 3. StatusBar.test.ts 📋
**Estimated Effort**: 2-3 hours
**Key Changes Needed**:
- Store mocking with enhancedStoreMocks
- Status update patterns
- Theme integration testing

**Migration Steps**:
1. Replace writable() with createMockWritable()
2. Use buildSettings for configuration data
3. Add proper store subscription cleanup
4. Enhance status change validation

### 4. CommandPalette.test.ts 📋
**Estimated Effort**: 3-4 hours
**Key Changes Needed**:
- Command registration mocking
- Keyboard event simulation
- Search functionality testing

**Migration Steps**:
1. Use buildCommandPaletteItem for test commands
2. Replace event mocks with createEventMock
3. Add proper keyboard shortcut testing
4. Implement search result validation

### 5. manager.test.ts 📋
**Estimated Effort**: 5-7 hours (Complex)
**Key Changes Needed**:
- Complete store refactoring
- Session/pane lifecycle testing
- IPC communication mocking

**Migration Steps**:
1. Use createMockManagerStores for all stores
2. Apply buildSession/buildPane throughout
3. Enhance async operation testing
4. Add comprehensive cleanup patterns

## Migration Checklist

For each test file, ensure the following patterns are applied:

### ✅ Mock Factories
- [ ] Replace all `vi.fn()` with typed factories
- [ ] Use `createAsyncMock` for Promise-returning functions
- [ ] Use `createSyncMock` for synchronous functions
- [ ] Use `createVoidMock` for side-effect functions

### ✅ Domain Builders
- [ ] Replace inline objects with appropriate builders
- [ ] Use `buildSession`, `buildPane`, `buildPlugin` for core entities
- [ ] Use `buildTerminalConfig`, `buildEditorConfig` for configurations
- [ ] Use `testScenarios` for complex test data

### ✅ Store Mocking
- [ ] Replace `writable()` with `createMockWritable()`
- [ ] Replace `readable()` with `createMockReadable()`
- [ ] Replace `derived()` with `createMockDerived()`
- [ ] Use `enhancedStoreMocks` for typed stores

### ✅ Component Mocking
- [ ] Use `createSvelteComponentMock` for components
- [ ] Implement proper `$$` property mocking
- [ ] Add event simulation capabilities
- [ ] Include proper DOM cleanup

### ✅ Cleanup Patterns
- [ ] Add `afterEach` for async operations
- [ ] Clean up subscriptions and event listeners
- [ ] Dispose of mock instances (terminals, editors)
- [ ] Reset mock states between tests

### ✅ Type Safety
- [ ] Import types from test utilities
- [ ] Use `MockedFunction` for all mocks
- [ ] Ensure proper TypeScript coverage
- [ ] Add explicit return type annotations

## Automated Migration Tools

### ESLint Auto-Fix
```bash
# Fix automatically fixable issues
npm run lint:test:fix
```

### Pattern Validation
```bash
# Validate all test patterns
npm run test:validate-patterns
```

### Manual Migration Helper
```bash
# Generate migration suggestions for a specific file
node scripts/migration-helper.js src/path/to/test.ts
```

## Common Migration Patterns

### 1. Mock Function Replacement
```typescript
// Before
const mockInvoke = vi.fn();
mockInvoke.mockResolvedValue({ success: true });

// After
const mockInvoke = createAsyncMock<[string, any], ApiResponse>();
mockInvoke.mockResolvedValue({ success: true });
```

### 2. Store Mock Replacement
```typescript
// Before
const mockStore = writable({ data: null });
vi.mock('$lib/stores', () => ({ 
  dataStore: mockStore 
}));

// After
const mockStore = createMockWritable({ data: null });
vi.mock('$lib/stores', () => ({ 
  dataStore: mockStore 
}));
```

### 3. Test Data Replacement
```typescript
// Before
const testUser = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  created_at: '2024-01-01T00:00:00Z',
  settings: { theme: 'dark', notifications: true }
};

// After
const testUser = buildUser({
  name: 'Test User',
  email: 'test@example.com',
  settings: buildUserSettings({ theme: 'dark' })
});
```

### 4. Cleanup Pattern Addition
```typescript
// Before
test('subscription test', () => {
  const unsubscribe = store.subscribe(callback);
  // No cleanup
});

// After
test('subscription test', () => {
  const unsubscribe = store.subscribe(callback);
  
  afterEach(() => {
    unsubscribe();
  });
});
```

## Quality Gates

Before marking a file as "migrated", it must pass:

1. **ESLint Validation**: No errors from test-specific rules
2. **Pattern Validation**: Passes automated pattern checker
3. **Type Safety**: Full TypeScript compilation without errors
4. **Test Execution**: All tests pass with new patterns
5. **Code Review**: Peer review confirms pattern compliance

## Benefits Tracking

Track these metrics for each migrated file:

### Developer Experience
- **Type Safety**: Number of type errors eliminated
- **IntelliSense**: Improved autocomplete and documentation
- **Test Reliability**: Reduction in mock-related test failures

### Code Quality
- **Consistency**: Standardized patterns across tests
- **Maintainability**: Easier to update and extend tests
- **Readability**: Clear intent and better organization

### Performance
- **Test Speed**: Faster test execution (measured)
- **Memory Usage**: Reduced memory leaks from proper cleanup
- **CI/CD Time**: Faster build and test cycles

## Risk Mitigation

### Backwards Compatibility
- Old patterns continue to work during migration
- Gradual migration reduces regression risk
- Comprehensive test coverage for migration changes

### Team Coordination
- Clear communication about migration status
- Documentation of new patterns
- Training sessions for complex patterns

### Rollback Plan
- Git history preservation for easy rollback
- Feature flags for enabling/disabling new patterns
- Monitoring for test reliability during migration

## Timeline

### Week 1-2: High Priority Files
- FileExplorer.test.ts
- StatusBar.test.ts
- CommandPalette.test.ts

### Week 3-4: Medium Priority Files
- manager.test.ts
- settings.test.ts
- terminal-ipc.test.ts

### Week 5-6: Remaining Files
- Complete remaining component tests
- Service and utility tests
- Final validation and cleanup

### Week 7: Enforcement
- Enable strict ESLint rules
- Update CI/CD pipelines
- Complete documentation

## Success Criteria

The migration is considered successful when:

1. **All test files pass pattern validation**
2. **Zero ESLint errors for test-specific rules**
3. **95%+ test reliability (no flaky tests)**
4. **Developer satisfaction survey shows improvement**
5. **Measurable reduction in test maintenance time**

## Support and Resources

### Documentation
- [Test Utilities Guide](./TEST_UTILITIES_GUIDE.md)
- [Domain Builders Reference](./src/test/domain-builders.ts)
- [Mock Factory Documentation](./src/test/mock-factory.ts)

### Tools
- ESLint configuration for tests
- Automated pattern validation
- Migration helper scripts

### Support Channels
- Code review feedback
- Team knowledge sharing sessions
- Pair programming for complex migrations

This migration strategy ensures a systematic, low-risk approach to modernizing the test infrastructure while delivering immediate benefits to developer productivity and code quality.