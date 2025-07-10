# MockBackend Testing Guide

## Overview
The MockBackend is a test implementation of the MuxBackend trait that simulates terminal multiplexer behavior without requiring actual tmux or other external dependencies. This enables fast, reliable unit testing of components that depend on MuxBackend.

## Features

### 1. **Full MuxBackend Implementation**
- Implements all required MuxBackend trait methods
- Maintains internal state for sessions and panes
- Simulates command execution and output capture

### 2. **Testing Utilities**
- `set_fail_mode()` - Enable/disable failure mode for error testing
- `get_command_history()` - Track all commands sent to panes
- `clear()` - Reset all state between tests
- `set_pane_output()` - Set custom output for specific test scenarios

### 3. **Realistic Behavior Simulation**
- Session and pane ID generation
- Active pane tracking
- Command output simulation for common commands (echo, pwd, ls)
- Proper error conditions (duplicate sessions, missing panes, etc.)

## Usage Examples

### Basic Usage
```rust
#[tokio::test]
async fn test_basic_operations() {
    let backend = MockBackend::new();
    
    // Create session
    let session_id = backend.create_session("test").await.unwrap();
    
    // Create pane
    let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
    
    // Send command
    backend.send_keys(&pane_id, "echo hello").await.unwrap();
    
    // Capture output
    let output = backend.capture_pane(&pane_id).await.unwrap();
    assert!(output.contains("hello"));
}
```

### Testing Error Conditions
```rust
#[tokio::test]
async fn test_error_handling() {
    let backend = MockBackend::new();
    
    // Enable fail mode
    backend.set_fail_mode(true).await;
    
    // All operations will fail
    assert!(backend.create_session("test").await.is_err());
    
    // Test specific error conditions
    backend.set_fail_mode(false).await;
    let result = backend.create_session("").await;
    assert!(matches!(result, Err(MuxError::InvalidState(_))));
}
```

### Command History Tracking
```rust
#[tokio::test]
async fn test_command_tracking() {
    let backend = MockBackend::new();
    let session_id = backend.create_session("test").await.unwrap();
    let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
    
    // Send multiple commands
    backend.send_keys(&pane_id, "command1").await.unwrap();
    backend.send_keys(&pane_id, "command2").await.unwrap();
    
    // Verify history
    let history = backend.get_command_history().await;
    assert_eq!(history.len(), 2);
    assert_eq!(history[0].1, "command1");
    assert_eq!(history[1].1, "command2");
}
```

### Custom Output Simulation
```rust
#[tokio::test]
async fn test_custom_output() {
    let backend = MockBackend::new();
    let session_id = backend.create_session("test").await.unwrap();
    let pane_id = backend.create_pane(&session_id, SplitType::None).await.unwrap();
    
    // Set custom output for testing
    backend.set_pane_output(&pane_id, "Custom test output").await.unwrap();
    
    let output = backend.capture_pane(&pane_id).await.unwrap();
    assert_eq!(output, "Custom test output");
}
```

## Simulated Commands

The MockBackend simulates output for common commands:

- **echo**: Returns the echoed text
- **pwd**: Returns `/mock/working/directory`
- **ls**: Returns a sample file listing
- Other commands: Just show the command prompt

## Using with Factory

To use MockBackend via the factory in tests:

```rust
#[test]
fn test_with_mock_backend() {
    std::env::set_var("ORCH_MUX_BACKEND", "mock");
    let backend = create_mux_backend();
    // backend is now a MockBackend in test builds
    std::env::remove_var("ORCH_MUX_BACKEND");
}
```

## Best Practices

1. **Use `clear()` between tests** to ensure clean state
2. **Test both success and failure paths** using fail_mode
3. **Verify command history** for integration tests
4. **Set custom output** for specific test scenarios
5. **Always clean up** sessions after tests

## Limitations

- MockBackend is only available in test builds (`#[cfg(test)]`)
- Command simulation is basic - complex shell commands won't work
- No real process execution or PTY handling
- No persistence between test runs

## Benefits

- **Fast**: No external process spawning
- **Reliable**: Deterministic behavior
- **Isolated**: No system dependencies
- **Flexible**: Easy to simulate various scenarios
- **Debuggable**: Full visibility into internal state