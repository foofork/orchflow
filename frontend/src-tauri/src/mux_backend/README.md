# MuxBackend Abstraction Layer

## Overview
The MuxBackend is a trait-based abstraction layer for terminal multiplexer operations in orchflow. It provides a clean, testable interface that supports multiple backend implementations (currently tmux, with muxd planned).

## Architecture

```
┌─────────────────┐
│   Orchestrator  │
└────────┬────────┘
         │ uses
┌────────┴────────┐
│   MuxBackend    │ (trait)
└────────┬────────┘
         │ implements
    ┌────┴────┐ ┌──────────┐ ┌──────────┐
    │  Tmux   │ │   Mock   │ │  Muxd    │
    │ Backend │ │ Backend  │ │ Backend  │
    └─────────┘ └──────────┘ └──────────┘
```

## Key Components

### 1. **MuxBackend Trait** (`backend.rs`)
Core trait defining all multiplexer operations:
- Session management (create, list, kill, attach/detach)
- Pane operations (create, resize, select, kill)
- I/O operations (send keys, capture output)
- Extended capabilities (optional, for advanced backends)

### 2. **TmuxBackend** (`tmux_backend.rs`)
Production implementation using tmux:
- Wraps existing TmuxManager for compatibility
- Comprehensive error handling and logging
- Smart error pattern recognition
- Input validation

### 3. **MockBackend** (`mock_backend.rs`)
Test implementation for unit testing:
- In-memory state management
- Command history tracking
- Configurable failure modes
- Custom output injection

### 4. **Factory** (`factory.rs`)
Environment-based backend selection:
- `ORCH_MUX_BACKEND` environment variable
- Automatic fallback to tmux
- Test-only mock backend access

## Usage

### Basic Usage
```rust
use orchflow::mux_backend::{create_mux_backend, MuxBackend};

// Create backend based on environment
let backend = create_mux_backend();

// Create a session
let session_id = backend.create_session("my-session").await?;

// Create a pane
let pane_id = backend.create_pane(&session_id, SplitType::None).await?;

// Send commands
backend.send_keys(&pane_id, "echo 'Hello, World!'").await?;

// Capture output
let output = backend.capture_pane(&pane_id).await?;
```

### Error Handling
```rust
match backend.create_session("").await {
    Err(MuxError::InvalidState(msg)) => {
        // Handle validation error
    }
    Err(MuxError::BackendUnavailable(msg)) => {
        // Handle backend not running
    }
    Err(e) => {
        // Handle other errors
    }
    Ok(session_id) => {
        // Success
    }
}
```

## Features

### Comprehensive Error Handling
- Specific error types for different failures
- Context-rich error messages
- Smart error pattern recognition
- Helper methods for error construction

### Logging
- INFO: Major operations
- DEBUG: Detailed execution flow
- WARN: Edge cases and degraded functionality
- ERROR: Failures with full context

### Input Validation
- Session name validation (no empty, no special chars)
- Pane dimension validation (must be positive)
- Command length warnings
- State consistency checks

### Testing Support
- MockBackend for fast unit tests
- Integration tests with real tmux
- Configurable failure modes
- Command history tracking

## Documentation

- **[Error Handling Guide](ERROR_HANDLING_GUIDE.md)** - Comprehensive error handling patterns
- **[Mock Backend Guide](MOCK_BACKEND_GUIDE.md)** - Using MockBackend for testing
- **[Integration Test Guide](INTEGRATION_TEST_GUIDE.md)** - Running tests with real backends
- **[Edge Cases and Errors](EDGE_CASES_AND_ERRORS.md)** - Known edge cases and mitigations

## Configuration

### Environment Variables
- `ORCH_MUX_BACKEND` - Select backend: "tmux" (default), "mock" (test only), "muxd" (future)
- `RUST_LOG` - Control logging level

### Socket Location
- Tmux socket: `~/.orchflow/tmux.sock`
- Automatically created if missing

## Future Enhancements

### Muxd Backend
- JSON-RPC over WebSocket
- Resource limits and quotas
- Event streaming
- Performance metrics

### Performance Optimizations
- Connection pooling
- Command batching
- Async operation queuing
- Caching strategies

### Additional Features
- Retry logic for transient failures
- Health checking
- Metrics and monitoring
- Rate limiting

## Migration from Direct TmuxManager

### Before (Direct TmuxManager)
```rust
let tmux = TmuxManager::new();
let session = tmux.create_session("my-session")?;
```

### After (MuxBackend)
```rust
let backend = create_mux_backend();
let session_id = backend.create_session("my-session").await?;
```

### Benefits
- Backend agnostic code
- Better error handling
- Improved testability
- Future-proof architecture

## Testing

### Run All Tests
```bash
cargo test mux_backend --lib
```

### Run Specific Test Categories
```bash
# Unit tests with mock
cargo test mock_backend --lib

# Integration tests (requires tmux)
cargo test tmux_integration --lib

# Factory tests
cargo test factory --lib
```

## Contributing

When adding new features:
1. Update the MuxBackend trait
2. Implement in all backends (Tmux, Mock)
3. Add comprehensive tests
4. Document edge cases
5. Update this README

## Performance Characteristics

- **TmuxBackend**: ~5-50ms per operation (process spawning overhead)
- **MockBackend**: <1ms per operation (in-memory)
- **Future MuxdBackend**: ~1-10ms expected (network overhead)

## Security Considerations

- No command injection protection (caller responsibility)
- Socket permissions follow system defaults
- No authentication/authorization built-in
- Audit logging via standard Rust log output