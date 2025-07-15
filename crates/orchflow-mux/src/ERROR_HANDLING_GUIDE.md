# MuxBackend Error Handling and Logging Guide

## Overview
This document describes the comprehensive error handling and logging strategy implemented in the MuxBackend abstraction layer.

## Error Types

### MuxError Enum
Located in `backend.rs`, the `MuxError` enum provides specific error types for all multiplexer operations:

```rust
pub enum MuxError {
    SessionCreationFailed(String),
    SessionNotFound(String),
    PaneNotFound(String),
    CommandFailed(String),
    BackendUnavailable(String),
    NotSupported(String),
    InvalidState(String),
    ConnectionError(String),
    ParseError(String),
    IoError(#[from] std::io::Error),
    SerializationError(#[from] serde_json::Error),
    Other(String),
}
```

### Error Helper Methods
The `MuxError` type includes convenient constructor methods:
- `session_creation_failed()` - For session creation failures
- `session_not_found()` - When a session doesn't exist
- `pane_not_found()` - When a pane doesn't exist
- `command_failed()` - For command execution failures
- `backend_unavailable()` - When backend is unreachable
- `not_supported()` - For unsupported operations
- `invalid_state()` - For invalid state conditions
- `connection_error()` - For connection issues
- `parse_error()` - For parsing failures
- `other()` - For miscellaneous errors

## Logging Strategy

### Log Levels Used
- **INFO**: Major operations (session/pane creation, deletion)
- **DEBUG**: Detailed operations (command execution, output)
- **WARN**: Non-critical issues (unsupported features, large inputs)
- **ERROR**: Failures and error conditions

### Logging Patterns

#### Operation Start/End
```rust
info!("Creating tmux session: {}", name);
// ... operation ...
info!("Successfully created session: {}", session.name);
```

#### Error Context
```rust
.map_err(|e| {
    error!("Failed to create session '{}': {:?}", name, e);
    Self::convert_error(e)
})?;
```

#### Debug Details
```rust
debug!("Executing tmux command: {:?}", args);
debug!("Using tmux socket path: {:?}", socket_path);
debug!("Tmux command output: {}", stdout);
```

#### Warnings for Edge Cases
```rust
if !matches!(split, SplitType::None) {
    warn!("Split type {:?} not yet implemented, using default split", split);
}
```

## Input Validation

### Session Name Validation
- Empty names are rejected
- Names containing ':' or '.' are rejected (tmux limitations)

### Pane Size Validation
- Width and height must be > 0
- Very large sizes (>9999) trigger warnings

### Key Sequence Validation
- Empty pane IDs are rejected
- Very long key sequences (>10000 chars) trigger warnings
- Long sequences are truncated in logs for readability

## Error Pattern Recognition

The TmuxBackend includes smart error pattern recognition:

```rust
if stderr.contains("session not found") || stderr.contains("can't find session") {
    return Err(MuxError::session_not_found(stderr.trim().to_string()));
} else if stderr.contains("pane not found") || stderr.contains("can't find pane") {
    return Err(MuxError::pane_not_found(stderr.trim().to_string()));
} else if stderr.contains("server not found") || stderr.contains("no server running") {
    return Err(MuxError::backend_unavailable("Tmux server is not running"));
}
```

## Integration with Orchestrator

The orchestrator converts MuxError to String for Tauri commands:

```rust
self.mux_backend.create_session(&name).await
    .map_err(|e| e.to_string())?;
```

## Best Practices

1. **Always log before operations**: Use info! for major operations
2. **Log errors with context**: Include relevant IDs and operation details
3. **Use appropriate log levels**: Don't spam info!, use debug! for details
4. **Validate inputs early**: Check for invalid states before operations
5. **Provide helpful error messages**: Include what went wrong and why
6. **Handle edge cases gracefully**: Log warnings but continue when possible

## Example Usage

```rust
// Good error handling example
async fn create_session(&self, name: &str) -> Result<String, MuxError> {
    // Validate input
    if name.is_empty() {
        error!("Attempted to create session with empty name");
        return Err(MuxError::invalid_state("Session name cannot be empty"));
    }
    
    // Log operation start
    info!("Creating tmux session: {}", name);
    
    // Perform operation with error context
    let session = self.do_create(name)
        .map_err(|e| {
            error!("Failed to create session '{}': {:?}", name, e);
            MuxError::session_creation_failed(format!("Could not create session '{}': {}", name, e))
        })?;
    
    // Log success
    info!("Successfully created session: {}", session.id);
    Ok(session.id)
}
```

## Testing Error Cases

The test suite includes comprehensive error case testing:
- Invalid session/pane IDs
- Backend unavailable scenarios
- Parse errors
- State validation failures

See `tmux_backend::tests::test_error_handling` for examples.