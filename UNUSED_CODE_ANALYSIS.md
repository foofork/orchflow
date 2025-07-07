# Unused Code Analysis Report

## Overview
This report analyzes unused code in orchflow to help make informed decisions about what to keep, wire up, or remove.

## Categories of Unused Code

### 1. **Methods That Should Be Wired Up** 🔌

#### MuxBackend
- `select_pane()` - Focus on a specific pane (useful for navigation)
  - **Decision**: Add Tauri command for pane selection

#### StateManager  
- `update_session()` - Update session metadata
  - **Decision**: May be needed for session renaming/modification
- `persist_all()` - Force persist all state
  - **Decision**: Useful for shutdown/backup scenarios

#### Plugin System
- `plugin.metadata()` - Get plugin information
  - **Decision**: Needed for plugin management UI
- `plugin.shutdown()` - Clean plugin shutdown
  - **Decision**: Important for graceful shutdown
- `PluginRegistry.list()` - List available plugins
  - **Decision**: Needed for plugin discovery UI

### 2. **Internal/Helper Methods** 🔧

#### File Watcher
- `get_watched_paths()` - Debug helper
- `recv_event()` - Internal event handling
- `set_debounce_duration()` - Configuration option
- `clear_buffer()` - Internal buffer management
- **Decision**: Keep for debugging/configuration

#### Project Search
- `search_simple()` - Convenience wrapper around advanced search
- `get_cached_results()` - Cache access
- **Decision**: Keep as internal helpers

#### Terminal Search
- `highlight_matches()` - Format search results with highlights
- **Decision**: Wire up for enhanced search display

### 3. **Future Features (Not Ready)** 🚀

#### Sharing Service
- Entire `SharingService` class - Collaboration features
- `share_session()`, `get_shared_session()`, `list_shared_sessions()`
- **Decision**: Keep for future collaboration features

#### Search History
- `SearchHistory` class - Store search history
- **Decision**: Keep for future search enhancement

#### Language Config
- `load_language_config()`, `save_language_config()` - LSP configuration
- **Decision**: Keep for LSP plugin enhancement

### 4. **Legacy/Deprecated Code** 🗑️

#### SimpleStateStore
- Session/pane methods already removed (using StateManager)
- `initialize_sqlx_pool()` - Old initialization method
- **Decision**: Can be removed

#### Experimental
- `test_parsers.rs` - Already removed (replaced by test_parser_commands)
- **Decision**: Already handled

### 5. **Unused Types/Constants** 📦

#### Types
- `WsStream` in muxd_backend - Type alias
- `EventStream` in backend - Type alias for event streaming
- `ContextualResult` in error.rs - Alternative error type
- **Decision**: Keep for future use

#### Constants
- `MAX_HISTORY_SIZE` in command_history - Not enforced
- **Decision**: Implement size limiting

## Recommended Actions

### Immediate (Wire Up Now)
1. **Add select_pane command** - Useful for pane navigation
2. **Wire up plugin.metadata()** - Needed for plugin UI
3. **Implement persist_all command** - For manual saves
4. **Add PluginRegistry.list command** - For plugin discovery

### Keep for Debugging/Config
1. File watcher helper methods
2. Project search cache methods
3. Terminal search highlight method

### Keep for Future
1. SharingService - Collaboration features
2. SearchHistory - Enhanced search
3. Language config - LSP improvements
4. Type aliases - May be needed

### Remove
1. `initialize_sqlx_pool()` in SimpleStateStore
2. Any other legacy session/pane methods if found

## Code Quality Observations

### Positive
- Good separation of concerns with unused future features
- Helper methods available for debugging
- Type aliases prepared for future use

### Areas for Improvement
- Some constants defined but not enforced (MAX_HISTORY_SIZE)
- Some methods could be marked as `#[cfg(debug_assertions)]` if only for debugging
- Future features could be behind feature flags

## Summary

Most "unused" code falls into three categories:
1. **Features that need wiring** - Plugin metadata, pane selection
2. **Future features** - Collaboration, enhanced search
3. **Internal helpers** - Debugging and configuration

Very little code should actually be removed. Most should either be wired up now or kept for future use.