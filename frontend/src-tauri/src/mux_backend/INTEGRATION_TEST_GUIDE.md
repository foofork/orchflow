# MuxBackend Integration Tests Guide

## Overview
The MuxBackend includes comprehensive integration tests that verify the actual behavior with real terminal multiplexers. These tests require the backend to be installed on the system.

## Test Structure

### 1. **TMux Integration Tests** (`tmux_integration_tests.rs`)
Tests the actual tmux backend implementation with a real tmux server.

#### Features Tested:
- Session lifecycle (create, list, kill)
- Pane operations (create, send keys, capture output)
- Multiple panes management
- Error handling with invalid IDs
- Session attach/detach operations
- Concurrent operations

#### Requirements:
- tmux must be installed on the system
- Tests automatically skip if tmux is not available
- Uses unique session names to avoid conflicts

### 2. **Mock Integration Tests** (`integration_tests.rs`)
Tests the integration between factory, backend trait, and orchestrator.

## Running Integration Tests

### With TMux Installed
```bash
# Install tmux first
brew install tmux  # macOS
sudo apt-get install tmux  # Ubuntu/Debian

# Run all integration tests
cargo test mux_backend --lib

# Run only tmux integration tests
cargo test tmux_integration_tests --lib -- --nocapture
```

### Without TMux
Tests will automatically skip with message: "Skipping test: tmux not available"

## Test Safety

### Cleanup Mechanisms
- Tests use unique session names with UUIDs
- `cleanup_test_sessions()` kills all test sessions before/after tests
- Sessions are prefixed with "test-" for easy identification
- No interference with user's tmux sessions

### Error Recovery
- All tests clean up even if assertions fail
- Concurrent test safety through unique naming
- Timeout handling for command execution

## Test Categories

### 1. Basic Operations
```rust
test_tmux_session_lifecycle()  // Create, list, kill sessions
test_tmux_pane_operations()     // Create panes, send keys, capture output
```

### 2. Advanced Features
```rust
test_tmux_multiple_panes()      // Multiple panes in one session
test_tmux_concurrent_operations() // Parallel session creation
test_tmux_session_attach_detach() // Client attachment handling
```

### 3. Error Handling
```rust
test_tmux_error_handling()      // Invalid IDs, non-existent resources
```

## Writing New Integration Tests

### Template
```rust
#[tokio::test]
async fn test_new_feature() {
    if !tmux_available() {
        eprintln!("Skipping test: tmux not available");
        return;
    }
    
    cleanup_test_sessions().await;
    let backend = TmuxBackend::new();
    
    // Use unique names
    let session_name = format!("test-feature-{}", uuid::Uuid::new_v4());
    
    // Your test logic here
    
    // Always clean up
    let _ = backend.kill_session(&session_name).await;
    cleanup_test_sessions().await;
}
```

### Best Practices
1. Always check if backend is available
2. Use unique session/pane names
3. Clean up before and after tests
4. Handle timing issues with small delays
5. Don't assume initial state

## CI/CD Considerations

### GitHub Actions
```yaml
- name: Install tmux
  run: sudo apt-get update && sudo apt-get install -y tmux
  
- name: Run integration tests
  run: cargo test mux_backend --lib
```

### Docker
```dockerfile
RUN apt-get update && apt-get install -y tmux
```

## Debugging Failed Tests

### Enable Debug Output
```bash
RUST_LOG=debug cargo test test_name -- --nocapture
```

### Check TMux State
```bash
tmux ls  # List all sessions
tmux kill-server  # Reset tmux completely
```

### Common Issues
- **Permission errors**: Run tests as regular user, not root
- **Socket conflicts**: Check ~/.orchflow/tmux.sock
- **Hanging tests**: Usually timing issues, add delays
- **Resource limits**: Check system ulimits

## Performance Considerations

- Integration tests are slower than unit tests
- Each test creates/destroys tmux sessions
- Use MockBackend for fast unit tests
- Only run integration tests when necessary

## Future Enhancements

1. **Muxd Integration Tests**: When muxd backend is implemented
2. **Performance Benchmarks**: Measure operation latencies
3. **Stress Tests**: Many sessions/panes
4. **Platform Tests**: Windows Terminal, other multiplexers