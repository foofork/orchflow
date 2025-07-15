# Error Handling Review - Core Crates

## Summary

After reviewing the orchflow-terminal, orchflow-mux, and orchflow-core crates, I've identified several critical error handling issues that need to be addressed.

## Critical Issues

### 1. Excessive Use of `.unwrap()` in Production Code

#### orchflow-terminal
- **File**: `src/buffer.rs`
  - Line 320: `assert_eq!(flushed.unwrap().len(), 110);` - Using unwrap in tests
  - Line 354: `let first_line = String::from_utf8(lines[0].content.to_vec()).unwrap();` - Could panic on invalid UTF-8

#### orchflow-mux
- **File**: `src/mock_backend.rs`
  - Line 292: `let session_id = panes.get(pane_id).unwrap().pane.session_id.clone();` - No validation that pane exists
  - Multiple test files use `.unwrap()` excessively

#### orchflow-core
- **File**: `src/state/mod.rs`
  - Line 56: `.set(&key, serde_json::to_value(&session).unwrap())` - Could panic on serialization failure
  - Line 86: `.set(&key, serde_json::to_value(&session).unwrap())` - Same issue
  - Line 126: `.set(&key, serde_json::to_value(&pane).unwrap())` - Same issue
  - Line 158: `.set(&key, serde_json::to_value(&pane).unwrap())` - Same issue

### 2. Poor Error Context

#### orchflow-terminal/src/pty_manager.rs
- Generic error messages without context:
  ```rust
  .map_err(|_| "Terminal input channel closed".to_string())  // Line 26
  .map_err(|_| "Terminal control channel closed".to_string()) // Line 40
  .map_err(|_| "Terminal control channel closed".to_string()) // Line 47
  .map_err(|_| "Process info channel closed".to_string())     // Line 55
  .map_err(|_| "Failed to get process info".to_string())      // Line 57
  ```
  These should include the terminal ID for debugging.

### 3. Resource Cleanup Issues

#### orchflow-terminal/src/pty_manager.rs
- Line 297: `let _ = child.kill();` - Ignores kill errors
- Line 303: Cleanup spawns async task but doesn't await completion
- No explicit Drop implementation for PtyHandle to ensure cleanup

### 4. Missing Input Validation

#### orchflow-terminal
- `create_pty()` doesn't validate:
  - Terminal ID format/uniqueness
  - Row/column counts (could be 0 or extremely large)
  - Shell path validity

#### orchflow-mux
- Backend trait methods don't validate:
  - Session names (empty, duplicates)
  - Pane IDs format
  - Size constraints for resize operations

#### orchflow-core
- State management lacks validation for:
  - Session/pane IDs (format, uniqueness)
  - State transitions (e.g., can't delete active session)

### 5. Inconsistent Error Types

- Some functions return `Result<_, String>`
- Others return `Result<_, Box<dyn std::error::Error>>`
- No custom error types with proper context

## Recommendations

### 1. Replace `.unwrap()` with Proper Error Handling
```rust
// Instead of:
serde_json::to_value(&session).unwrap()

// Use:
serde_json::to_value(&session)
    .map_err(|e| StateError::SerializationFailed {
        entity: "session",
        id: session.id.clone(),
        source: e,
    })?
```

### 2. Add Contextual Error Messages
```rust
// Instead of:
.map_err(|_| "Terminal input channel closed".to_string())

// Use:
.map_err(|_| format!("Terminal {} input channel closed", self.id))
```

### 3. Implement Proper Resource Cleanup
```rust
impl Drop for PtyHandle {
    fn drop(&mut self) {
        // Best effort cleanup
        let _ = self.control_tx.send(ControlMsg::Shutdown);
    }
}
```

### 4. Add Input Validation
```rust
pub async fn create_pty(
    &self,
    terminal_id: String,
    shell: Option<String>,
    rows: u16,
    cols: u16,
) -> Result<PtyHandle, TerminalError> {
    // Validate inputs
    if terminal_id.is_empty() {
        return Err(TerminalError::InvalidInput("Terminal ID cannot be empty"));
    }
    if rows == 0 || cols == 0 {
        return Err(TerminalError::InvalidInput("Terminal size must be non-zero"));
    }
    if rows > 1000 || cols > 1000 {
        return Err(TerminalError::InvalidInput("Terminal size exceeds maximum"));
    }
    // ... rest of implementation
}
```

### 5. Define Custom Error Types
```rust
#[derive(Debug, thiserror::Error)]
pub enum TerminalError {
    #[error("Invalid input: {0}")]
    InvalidInput(&'static str),
    
    #[error("Terminal {id} channel closed: {channel}")]
    ChannelClosed { id: String, channel: &'static str },
    
    #[error("PTY operation failed for terminal {id}")]
    PtyError { id: String, #[source] source: Box<dyn std::error::Error> },
    
    #[error("Resource cleanup failed")]
    CleanupError(#[source] Box<dyn std::error::Error>),
}
```

## Priority Actions

1. **High Priority**: Fix `.unwrap()` calls in orchflow-core state management - these could crash in production
2. **High Priority**: Add resource cleanup for PTY handles to prevent resource leaks
3. **Medium Priority**: Add input validation to prevent invalid state
4. **Medium Priority**: Improve error messages with context
5. **Low Priority**: Standardize error types across crates

## Files Requiring Immediate Attention

1. `/crates/orchflow-core/src/state/mod.rs` - Remove unwraps in serialization
2. `/crates/orchflow-terminal/src/pty_manager.rs` - Add Drop impl and better error context
3. `/crates/orchflow-mux/src/mock_backend.rs` - Add validation before unwrap on line 292
4. `/crates/orchflow-terminal/src/buffer.rs` - Handle UTF-8 conversion errors