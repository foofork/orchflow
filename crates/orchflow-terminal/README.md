# OrchFlow Terminal

High-performance terminal I/O management with PTY support, buffering, and stream processing.

## Features

- **PTY Management**: Full pseudo-terminal lifecycle management
- **Async Streams**: Non-blocking terminal I/O with tokio streams
- **Smart Buffering**: Ring buffer and scrollback buffer implementations
- **Stream Processing**: Terminal output processing and management
- **Resource Management**: Automatic cleanup and resource handling
- **Cross-Platform**: Works on Unix-like systems with PTY support

## Components

### PTY Manager

Handles pseudo-terminal creation and lifecycle:

```rust
use orchflow_terminal::pty_manager::PtyManager;
use std::collections::HashMap;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut pty_manager = PtyManager::new();
    
    // Create a new terminal
    let terminal_id = "term-1".to_string();
    let handle = pty_manager.create_terminal(
        terminal_id.clone(),
        80,  // width
        24,  // height
        "/bin/bash".to_string(),
        HashMap::new(), // environment variables
    ).await?;
    
    // Write to terminal
    pty_manager.write_to_terminal(&terminal_id, "echo 'Hello World'\n").await?;
    
    // Read from terminal
    if let Some(output) = pty_manager.read_from_terminal(&terminal_id).await? {
        println!("Terminal output: {}", output);
    }
    
    // Resize terminal
    pty_manager.resize_terminal(&terminal_id, 120, 40).await?;
    
    // Kill terminal
    pty_manager.kill_terminal(&terminal_id).await?;
    
    Ok(())
}
```

### Stream Manager

Manages terminal I/O streams:

```rust
use orchflow_terminal::stream::TerminalStreamManager;
use orchflow_terminal::state::TerminalState;

let state = TerminalState::new("term-1".to_string(), 80, 24);
let mut stream_manager = TerminalStreamManager::new(state);

// Write data to terminal
stream_manager.write_input("ls -la\n").await?;

// Read output
let output = stream_manager.read_output().await?;
println!("Output: {}", output);
```

### Buffering System

Efficient buffering for terminal output:

```rust
use orchflow_terminal::buffer::{RingBuffer, ScrollbackBuffer};

// Ring buffer for streaming data
let mut ring_buffer = RingBuffer::new(4096);
ring_buffer.write(b"Hello World");
let data = ring_buffer.read_chunk(100);

// Scrollback buffer for terminal history
let mut scrollback = ScrollbackBuffer::new(1000, 100); // 1000 lines, 100 chars per line
scrollback.add_line("First line");
scrollback.add_line("Second line");

// Search through history
let results = scrollback.search_pattern("First", false);
```

## Advanced Usage

### Custom Terminal Configuration

```rust
use orchflow_terminal::pty_manager::PtyManager;
use std::collections::HashMap;

let mut pty_manager = PtyManager::new();

// Custom environment variables
let mut env = HashMap::new();
env.insert("TERM".to_string(), "xterm-256color".to_string());
env.insert("SHELL".to_string(), "/bin/zsh".to_string());

// Create terminal with custom config
let handle = pty_manager.create_terminal(
    "custom-term".to_string(),
    120,  // width
    40,   // height
    "/bin/zsh".to_string(),
    env,
).await?;
```

### Stream Processing

```rust
use orchflow_terminal::stream::TerminalStreamManager;
use orchflow_terminal::state::TerminalState;

let state = TerminalState::new("proc-term".to_string(), 80, 24);
let mut stream_manager = TerminalStreamManager::new(state);

// Process multiple commands
let commands = vec![
    "cd /home/user",
    "ls -la",
    "git status",
    "cat README.md"
];

for cmd in commands {
    stream_manager.write_input(&format!("{}\n", cmd)).await?;
    
    // Wait for command completion
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    
    // Read output
    let output = stream_manager.read_output().await?;
    println!("Command '{}' output: {}", cmd, output);
}
```

### Buffer Management

```rust
use orchflow_terminal::buffer::{OutputBuffer, ScrollbackBuffer};

// Create output buffer for streaming
let mut output_buffer = OutputBuffer::new(8192);

// Stream data in chunks
let data = b"Large amount of terminal output data...";
output_buffer.write(data);

// Read in manageable chunks
while let Some(chunk) = output_buffer.read_chunk(1024) {
    process_chunk(chunk);
}

// Scrollback for history
let mut scrollback = ScrollbackBuffer::new(5000, 120);

// Add terminal output lines
scrollback.add_line("$ git log --oneline");
scrollback.add_line("abc123 Add new feature");
scrollback.add_line("def456 Fix bug in parser");

// Search command history
let git_commands = scrollback.search_pattern("git", false);
```

## Error Handling

The crate provides comprehensive error handling:

```rust
use orchflow_terminal::pty_manager::{PtyManager, PtyError};

let mut pty_manager = PtyManager::new();

match pty_manager.create_terminal("test".to_string(), 80, 24, "/bin/bash".to_string(), HashMap::new()).await {
    Ok(handle) => println!("Terminal created successfully"),
    Err(PtyError::InvalidDimensions(w, h)) => {
        eprintln!("Invalid terminal dimensions: {}x{}", w, h);
    }
    Err(PtyError::InvalidShell(shell)) => {
        eprintln!("Invalid shell path: {}", shell);
    }
    Err(PtyError::ProcessSpawnError(e)) => {
        eprintln!("Failed to spawn process: {}", e);
    }
    Err(PtyError::IoError(e)) => {
        eprintln!("I/O error: {}", e);
    }
}
```

## Integration with OrchFlow Ecosystem

This crate integrates with the broader OrchFlow ecosystem:

```rust
use orchflow_core::{Manager, state::StateManager, storage::MemoryStore};
use orchflow_mux::backend::TmuxBackend;
use orchflow_terminal::pty_manager::PtyManager;
use std::sync::Arc;

// Create the full stack
let store = Arc::new(MemoryStore::new());
let state_manager = StateManager::new(store);
let backend = Arc::new(TmuxBackend::new());
let manager = Manager::new(backend, state_manager);

// Terminal management is handled by the core manager
// but you can use orchflow-terminal directly for custom scenarios
let mut pty_manager = PtyManager::new();
```

## Performance Considerations

- **Ring Buffer**: Efficient for streaming data with minimal allocations
- **Scrollback Buffer**: Optimized for searching large terminal histories
- **Async I/O**: Non-blocking operations for responsive applications
- **Resource Cleanup**: Automatic cleanup prevents resource leaks

## License

Licensed under either of

- Apache License, Version 2.0
- MIT license

at your option.