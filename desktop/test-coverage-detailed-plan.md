# Orchflow Test Coverage Detailed Plan

## Current State Analysis
- **Current Coverage**: 26.91%
- **Target Coverage**: >90%
- **Tests Status**: 404 passing, 19 failing (store tests)
- **Priority**: Fix failing tests first, then add coverage for untested components

## Failing Tests Analysis

### 1. Store Tests (19 failures)
**Files with failing tests:**
- `manager.test.ts` - Issue: getSessions() returns undefined, expects array
- `orchestrator.test.ts` - Issue: sessions is not iterable
- `tauri-orchestrator.test.ts` - Issue: Failed to create pane errors

**Root Cause**: Mock implementations not matching expected data structures

## Coverage Improvement Plan

### Phase 1: Fix Failing Tests (Priority: CRITICAL)
**Timeline**: 1 day
**Coverage Impact**: Stabilize existing 26.91%

1. **Fix manager.test.ts**
   - Ensure getSessions() returns array, not undefined
   - Fix refreshSessions error handling
   - Verify all mock return values match expected types

2. **Fix orchestrator.test.ts**
   - Fix sessions iterable issue
   - Ensure listSessions returns proper structure
   - Fix pane property access issues

3. **Fix tauri-orchestrator.test.ts**
   - Fix pane creation error handling
   - Ensure proper mock setup for Tauri commands

### Phase 2: Service Layer Tests (Priority: HIGH)
**Timeline**: 1-2 days
**Coverage Impact**: +4-5% (to ~31%)

1. **metrics.ts (273 lines, 0% coverage)**
   - Test metric collection and aggregation
   - Test WebSocket connection handling
   - Test error handling for invalid URLs
   - Mock fetch and WebSocket APIs

2. **terminal-ipc.ts (263 lines, 0% coverage)**
   - Test IPC message handling
   - Test terminal stream management
   - Mock Tauri IPC events

3. **theme.ts (46 lines, 0% coverage)**
   - Test theme loading and switching
   - Test CSS variable application
   - Test persistence

### Phase 3: Major UI Components (Priority: HIGH)
**Timeline**: 3-4 days
**Coverage Impact**: +35-40% (to ~66-71%)

1. **Terminal Components**
   - Terminal.svelte (0% coverage)
   - TerminalGrid.svelte (0% coverage)
   - StreamingTerminal.svelte (0% coverage)
   - Test terminal creation, input, output display

2. **Editor Components**
   - Editor.svelte (0% coverage)
   - CodeMirrorEditor.svelte (0% coverage)
   - NeovimEditor.svelte (0% coverage)
   - Test file loading, editing, saving

3. **File Management Components**
   - FileExplorerEnhanced.svelte (needs improvement)
   - FileTree.svelte (has tests but needs more)
   - Test file operations, tree navigation

4. **Git Integration**
   - GitPanel.svelte (0% coverage)
   - Test git status display, commit operations

### Phase 4: Dashboard Components (Priority: MEDIUM)
**Timeline**: 1-2 days
**Coverage Impact**: +10-15% (to ~76-86%)

1. **Dashboard.svelte** - Test layout, data display
2. **DashboardEnhanced.svelte** - Test enhanced features
3. **SettingsModal.svelte** - Test settings management
4. **PluginManager.svelte** - Test plugin operations

### Phase 5: Remaining Components (Priority: MEDIUM)
**Timeline**: 1-2 days
**Coverage Impact**: +5-10% (to ~81-96%)

1. **SymbolOutline.svelte** - Test symbol navigation
2. **TrashManager.svelte** - Test trash operations
3. **Toast.svelte** - Test notifications
4. **Other small components**

### Phase 6: Integration Tests (Priority: LOW)
**Timeline**: 1 day
**Coverage Impact**: +3-5% (to >90%)

1. End-to-end user workflows
2. Component interaction tests
3. Full application scenarios

## Test Implementation Strategy

### TDD Approach for New Tests
1. Write failing test first
2. Implement minimal code to pass
3. Refactor with confidence
4. Document test scenarios

### Testing Patterns to Use
1. **Component Testing**: Use @testing-library/svelte
2. **Store Testing**: Test state mutations and subscriptions
3. **Service Testing**: Mock external dependencies
4. **Integration Testing**: Test component interactions

### Mock Strategy
1. Mock all external APIs (Tauri, WebSocket, fetch)
2. Use consistent mock data structures
3. Test both success and error paths
4. Verify mock calls and parameters

## Success Metrics
- All tests passing (0 failures)
- Coverage >90% across all modules
- No untested critical paths
- Clear test documentation

## Estimated Timeline
- **Total**: 8-11 days
- **Phase 1**: 1 day (fix failures)
- **Phase 2**: 1-2 days (services)
- **Phase 3**: 3-4 days (UI components)
- **Phase 4**: 1-2 days (dashboard)
- **Phase 5**: 1-2 days (remaining)
- **Phase 6**: 1 day (integration)

## Next Immediate Steps
1. Fix failing store tests (manager, orchestrator, tauri-orchestrator)
2. Run coverage report to verify baseline
3. Start with service layer tests (highest impact)
4. Progress through UI components systematically