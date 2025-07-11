# Database Analysis Report

## Summary

The Orchflow project has multiple SQLite databases serving different purposes:

### 1. **orchflow.db** (Main Application Database)
- **Location**: `desktop/src-tauri/orchflow.db`
- **Library**: Uses `rusqlite` (not `sqlx`)
- **Purpose**: Core state management via `SimpleStateStore`
- **Contains**: Sessions, panes, layouts, modules, and key-value storage
- **Status**: Active and in use

### 2. **memory.db** (Claude Flow/Swarm Memory)
- **Locations**: 
  - `.swarm/memory.db`
  - `desktop/.swarm/memory.db`
  - Various other `.swarm` directories
- **Purpose**: Claude Flow MCP server persistent memory
- **Library**: Likely SQLite via external tool
- **Status**: External tool database, not part of core app

### 3. **hive.db** (Hive Mind Database)
- **Locations**:
  - `.hive-mind/hive.db`
  - `desktop/.hive-mind/hive.db`
- **Purpose**: Hive Mind coordination tool database
- **Library**: External tool using SQLite
- **Status**: External tool database, not part of core app

## Key Findings

### SQLx vs Rusqlite Transition
1. **Original Plan**: The codebase was transitioning from `rusqlite` to `sqlx`
2. **Current State**: 
   - `rusqlite` is commented out in Cargo.toml but still imported and used
   - `sqlx` is added as a dependency but only used in deprecated test_results.rs
   - The main app uses `rusqlite` via `SimpleStateStore`

### Deprecated Code
- `test_results.rs` uses `sqlx` but is marked as DEPRECATED
- Commands in main.rs for test results are commented out
- There's a newer `test_results_v2.rs` that uses `SimpleStateStore` instead

## Recommendations

1. **Remove SQLx Dependency**: Since the transition was incomplete and the code using it is deprecated, remove `sqlx` from Cargo.toml

2. **Clean Up Rusqlite**: Uncomment `rusqlite` in Cargo.toml since it's actively used

3. **Remove Deprecated Code**: Delete the old `test_results.rs` file that uses `sqlx`

4. **Document External DBs**: Add .gitignore entries for `.swarm/` and `.hive-mind/` directories as they're from external tools

5. **Consolidate Database Access**: All database access should go through `SimpleStateStore` for consistency

## Technical Details

### SimpleStateStore Architecture
- Uses repository pattern with separate modules for each domain
- Connection manager handles pooling and optimization
- Supports both in-memory and file-based storage
- Full CRUD operations for all entities

### External Tool Databases
- `.swarm/memory.db`: Claude Flow's persistent memory for AI coordination
- `.hive-mind/hive.db`: Hive Mind's coordination and task management database
- These are not part of the application but created by development tools