# Legacy Code Review - MuxBackend Migration

## Overview
This document tracks legacy code that should be migrated to use the MuxBackend abstraction layer.

## Completed Refactoring ✅

### 1. **Orchestrator Migration**
- **Status**: COMPLETE
- **Changes**: 
  - Updated to use MuxBackend trait instead of TmuxManager
  - Maintains backward-compatible constructor
  - All tmux operations go through MuxBackend

### 2. **Removed Dead Code**
- **Status**: COMPLETE
- **Changes**:
  - Removed unused `convert_pane` function from TmuxBackend
  - Removed unused TmuxPane import
  - Fixed all unused variable warnings in tests

## Pending Refactoring 🔄

### 1. **startup.rs**
- **Current State**: Creates TmuxManager and passes to Orchestrator
- **Impact**: LOW - Orchestrator ignores the parameter
- **Recommendation**: Can be cleaned up but not urgent
- **Changes Needed**:
  ```rust
  // Remove TmuxManager creation
  let orchestrator = Arc::new(Orchestrator::new(
      app.clone(),
      state_store.clone(),
  ));
  ```

### 2. **layout_commands.rs**
- **Current State**: Uses TmuxManager directly for pane operations
- **Impact**: MEDIUM - Bypasses orchestrator abstraction
- **Recommendation**: Should use Orchestrator or MuxBackend
- **Issues**:
  - Direct tmux operations in `split_layout_pane`
  - Direct tmux operations in `close_layout_pane`
  - Missing implementation for `resize_layout_pane`

### 3. **tmux.rs Module**
- **Current State**: Original TmuxManager implementation
- **Impact**: LOW - Still needed by TmuxBackend
- **Recommendation**: Keep for now, consider making private to mux_backend

## Migration Strategy

### Phase 1: Immediate (Complete) ✅
- [x] Create MuxBackend trait
- [x] Implement TmuxBackend
- [x] Update Orchestrator
- [x] Add comprehensive tests
- [x] Remove dead code

### Phase 2: Short Term 🔄
- [ ] Update layout_commands.rs to use Orchestrator
- [ ] Clean up startup.rs TmuxManager usage
- [ ] Move tmux.rs into mux_backend module

### Phase 3: Long Term 📋
- [ ] Implement MuxdBackend
- [ ] Remove backward compatibility in Orchestrator
- [ ] Consider abstracting layout management

## Technical Debt

### 1. **Layout System**
The layout system directly manipulates tmux, breaking the abstraction:
- Should communicate through Orchestrator
- Layout state should be synchronized with Orchestrator state
- Consider moving layout logic into a plugin

### 2. **State Management**
Multiple state stores exist:
- SimpleStateStore (SQLite)
- AppState (in-memory layouts)
- Orchestrator state (sessions/panes)

Consider unifying state management.

### 3. **Error Handling**
Some areas still use string errors instead of typed errors:
- layout_commands returns `Result<_, String>`
- Should use proper error types

## Benefits of Migration

1. **Testability**: Can test layout commands with MockBackend
2. **Flexibility**: Easy to switch backends (tmux → muxd)
3. **Consistency**: All terminal operations go through one interface
4. **Maintainability**: Centralized terminal logic

## Risks

1. **Breaking Changes**: Layout system may have hidden dependencies
2. **Performance**: Additional abstraction layer (minimal impact)
3. **Complexity**: More indirection for simple operations

## Recommendations

1. **Priority**: Focus on layout_commands.rs migration
2. **Testing**: Add integration tests for layout operations
3. **Documentation**: Update architecture docs with MuxBackend
4. **Monitoring**: Add metrics to MuxBackend operations

## Code Metrics

- **Files using TmuxManager directly**: 3
  - startup.rs (can be ignored)
  - layout_commands.rs (needs refactoring)
  - tmux.rs (the implementation itself)

- **Files using MuxBackend**: 2
  - orchestrator.rs ✅
  - mux_backend/* ✅

- **Test Coverage**:
  - Unit tests: ✅ MockBackend
  - Integration tests: ✅ TmuxBackend
  - Layout tests: ❌ Missing