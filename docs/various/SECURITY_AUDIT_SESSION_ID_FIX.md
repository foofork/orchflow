# Security Audit Session ID Fix

## Summary

Fixed missing session IDs in security audit context by implementing a proper session lookup mechanism in the `TerminalSecurityManager`.

## Changes Made

### 1. Enhanced TerminalSecurityManager

- Added `SessionLookup` trait for abstracting session ID lookups
- Added `StateManagerSessionLookup` implementation that uses the state manager
- Modified `TerminalSecurityManager` to accept an optional session lookup implementation
- Added helper method `get_session_id()` to retrieve session IDs for terminals

### 2. Fixed Audit Event Generation

- **Terminal Creation Events**: Now properly includes session ID from terminal/pane context
- **Command Execution Events**: Now properly includes session ID from terminal/pane context
- **Fallback Behavior**: Returns empty string if no session lookup is configured (maintains backward compatibility)

### 3. Session ID Lookup Strategy

The implementation uses a two-step lookup strategy:

1. **Direct Pane Lookup**: First attempts to find the pane directly by ID
2. **Backend ID Lookup**: If not found, searches all panes for one with a matching `backend_id`

This covers both cases where the terminal ID might be:
- A direct pane ID
- A backend-specific terminal ID (like tmux pane ID or muxd pane ID)

## Integration Guide

### Setting up Security Manager with Session Lookup

```rust
use crate::security::{TerminalSecurityManager, SecurityTier, StateManagerSessionLookup};
use std::sync::Arc;

// In your Manager initialization
let session_lookup = Arc::new(StateManagerSessionLookup::new(
    Arc::clone(&state_manager)
));

let security_manager = TerminalSecurityManager::new(SecurityTier::Basic)
    .with_session_lookup(session_lookup)
    .with_audit_logger(audit_logger); // if you have audit logging configured
```

### Using in Tauri Commands

```rust
#[tauri::command]
pub async fn create_terminal_security_context(
    terminal_id: String,
    workspace_path: Option<String>,
    override_tier: Option<SecurityTier>,
    security_manager: State<'_, TerminalSecurityManager>,
) -> Result<SecurityContext, String> {
    security_manager
        .create_context(&terminal_id, workspace_path.as_deref().map(Path::new), override_tier)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_terminal_command(
    terminal_id: String,
    command: String,
    working_dir: Option<String>,
    security_manager: State<'_, TerminalSecurityManager>,
) -> Result<CommandCheckResult, String> {
    security_manager
        .check_command(&terminal_id, &command, working_dir.as_deref().map(Path::new))
        .await
        .map_err(|e| e.to_string())
}
```

## Files Modified

1. `/desktop/src-tauri/src/security/terminal_security.rs`
   - Added `SessionLookup` trait
   - Added `StateManagerSessionLookup` implementation
   - Enhanced `TerminalSecurityManager` with session lookup capability
   - Fixed audit event session ID population
   - Added comprehensive tests

2. `/desktop/src-tauri/src/security/mod.rs`
   - Exported new types: `SessionLookup` and `StateManagerSessionLookup`

## Testing

Added comprehensive tests covering:

1. **Session ID Population**: Verifies that audit events contain correct session IDs when session lookup is configured
2. **Fallback Behavior**: Verifies that empty session IDs are used when no lookup is available
3. **Multiple Event Types**: Tests both terminal creation and command execution events
4. **Mock Infrastructure**: Created mock implementations for testing without full state manager dependency

### Running the Tests

```bash
cd desktop/src-tauri
cargo test security::terminal_security
```

## Security Benefits

- **Improved Audit Trail**: Security events now contain session context, enabling better incident investigation
- **Session-based Analysis**: Security teams can now correlate terminal activities by session
- **Compliance**: Better supports compliance requirements that mandate session tracking in audit logs
- **Debugging**: Easier to debug security issues by correlating events within sessions

## Backward Compatibility

The changes maintain full backward compatibility:
- Existing code without session lookup will continue to work (empty session IDs)
- The session lookup is optional and defaults to None
- No breaking changes to existing APIs

## Future Enhancements

1. **User Context**: Could be extended to include user information in session lookups
2. **Workspace Context**: Could include workspace/project information in session context
3. **Session Metadata**: Could be extended to include additional session metadata like creation time, workspace trust level, etc.