# Git Ignore Testing Guide

## Overview
This guide describes how to test the git ignore functionality that was implemented for the File Manager.

## Test Suite Components

### 1. Unit Tests (`git_commands_test.rs`)
Tests individual git command functions:
- `test_is_git_ignored()` - Tests gitignore pattern matching
- `test_get_file_status()` - Tests git status detection
- `test_has_uncommitted_changes()` - Tests change detection
- `test_get_branch_info()` - Tests branch information
- `test_get_all_statuses()` - Tests bulk status retrieval
- `test_nested_gitignore()` - Tests nested .gitignore files
- `test_gitignore_patterns()` - Tests complex patterns

### 2. Integration Tests (`file_manager_git_test.rs`)
Tests file manager integration:
- `test_file_manager_git_ignore_integration()` - End-to-end gitignore
- `test_file_manager_git_status_integration()` - File status in trees

### 3. Manual Testing Script
- `test_git_functionality.sh` - Automated test runner

## Running Tests

### Option 1: Run All Tests
```bash
cd /workspaces/orchflow/desktop/src-tauri
./test_git_functionality.sh
```

### Option 2: Run Specific Test Categories
```bash
# Unit tests only
cargo test git_commands::tests --lib

# Integration tests only  
cargo test file_manager::integration_tests --lib

# All git-related tests
cargo test git --lib
```

### Option 3: Individual Test Functions
```bash
# Test specific functionality
cargo test test_is_git_ignored --lib
cargo test test_gitignore_patterns --lib
cargo test test_file_manager_git_ignore_integration --lib
```

## Test Scenarios Covered

### Gitignore Patterns
- `*.log` - File extension patterns
- `target/` - Directory patterns
- `!important.log` - Negation patterns
- `/root-only.txt` - Root-only patterns
- `**/any-dir/*.tmp` - Nested wildcard patterns
- Comments and blank lines

### File States
- ✅ Clean (committed, unchanged)
- 📝 Modified (tracked, changed)
- ➕ Added (staged, new)
- ❓ Untracked (new, unstaged)
- 🗑️ Deleted (removed)
- 🔄 Renamed (moved)
- ⚠️ Conflicted (merge conflicts)
- 🚫 Ignored (gitignore rules)

### Edge Cases
- Nested .gitignore files
- Global gitignore
- Absolute vs relative paths
- Non-git directories
- Empty repositories
- Complex pattern combinations

## Expected Results

### Unit Tests
All unit tests should pass, demonstrating:
- Correct gitignore pattern matching
- Accurate git status detection
- Proper handling of edge cases

### Integration Tests
Integration tests should verify:
- File tree shows correct ignore status
- Git status appears in file nodes
- Manager integrates with git properly

### Manual Verification
After tests pass, you can manually verify by:
1. Opening OrchFlow in a git repository
2. Checking that ignored files are visually distinct
3. Verifying git status appears in file panels

## Troubleshooting

### Test Failures
If tests fail, check:
- Git is available on the system
- Permissions for creating test repositories
- libgit2 compatibility
- Temporary directory access

### Integration Issues
If integration tests fail:
- Verify file manager initialization
- Check git integration setup
- Ensure proper module imports

## Performance Considerations

The tests create temporary repositories and should clean up automatically. However, for large-scale testing:
- Tests use small repositories for speed
- Real-world performance may vary with repo size
- Consider adding performance benchmarks

## Future Test Enhancements

Potential additions:
- Performance benchmarks
- Large repository tests
- Real-time file watcher integration
- Cross-platform compatibility tests
- Memory usage validation