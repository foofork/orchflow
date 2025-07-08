# Frontend TODO Report

## Overview
This report catalogs all TODO/FIXME/HACK comments found in the orchflow frontend codebase, organized by priority and component.

## Summary Statistics
- **Total TODOs**: 51
- **Rust Backend**: 43
- **TypeScript/Svelte Frontend**: 8

## High Priority Items

### 1. File Manager UI Operations (4 TODOs)
**Location**: `src/lib/components/FileExplorerEnhanced.svelte`
- Line 169: Implement new file dialog
- Line 174: Implement new folder dialog  
- Line 185: Implement rename functionality
- Line 191: Implement delete functionality

**Impact**: Core file management features are non-functional in the UI

### 2. Search Functionality (5 TODOs)
**Location**: `src-tauri/src/search_commands.rs`
- Line 90: Implement replace_in_files functionality
- Line 107: Implement search history functionality
- Line 125: Implement save_search functionality
- Line 142: Implement load_search functionality
- Line 207: Implement syntax highlighting for search results

**Impact**: Search and replace features are incomplete

### 3. Module System (4 TODOs)
**Location**: `src-tauri/src/module_commands.rs`
- Line 181: Validate config against module.manifest.config_schema
- Line 221: Implement module registry search
- Line 232: Implement fetching module details from registry
- Line 255: Implement module template generation

**Impact**: Module marketplace and development features are missing

## Medium Priority Items

### 4. Terminal Features (6 TODOs)
- Terminal active tracking
- Process ID tracking from PTY
- Scrollback search implementation
- Session ID retrieval for terminals

### 5. File Manager Backend (5 TODOs)
- Git ignore checking
- Git status checking
- File permissions retrieval
- Trash functionality (move to trash instead of permanent delete)

### 6. Plugin System (7 TODOs)
- WASM plugin loading
- Native plugin loading
- Activation event checking
- LSP request forwarding
- Syntax folding ranges

## Low Priority Items

### 7. UI Polish (3 TODOs)
- Error toast notifications in CommandBar
- Error notifications in PluginCommandPalette
- Pane info action in orchestrator store

### 8. Testing & Migration (2 TODOs)
- Complete migration to SimpleStateStore API
- Fix tests after error system updates

## Implementation Plan

### Phase 1: Core File Operations
1. Implement file/folder creation dialogs
2. Add rename functionality with inline editing
3. Add delete confirmation dialog
4. Integrate with backend file_commands

### Phase 2: Search Enhancement
1. Implement replace functionality
2. Add search history persistence
3. Create saved searches feature
4. Add syntax highlighting to results

### Phase 3: Module System Completion
1. Add config validation
2. Create module registry client
3. Implement module templates
4. Add module development tools

### Phase 4: Terminal Improvements
1. Track active terminal
2. Add process monitoring
3. Implement scrollback search
4. Improve session management

## Technical Debt

### Backend
- Legacy SQLx code needs complete removal
- Some test files still have compilation issues
- Unused functions and variables need cleanup

### Frontend
- TypeScript types need stricter enforcement
- Component prop validation could be improved
- Store actions need better error handling

## Recommendations

1. **Prioritize File Operations**: These are core features that users expect to work
2. **Complete Search Feature**: Search/replace is essential for a code editor
3. **Stabilize Module System**: Critical for extensibility
4. **Add Error Boundaries**: Improve error handling throughout the UI
5. **Implement Progress Indicators**: For long-running operations

## Next Steps

1. Create GitHub issues for each high-priority TODO group
2. Assign priorities based on user impact
3. Start with file operation dialogs (most visible to users)
4. Add comprehensive tests for each new feature
5. Update documentation as features are completed