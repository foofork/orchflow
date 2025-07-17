# OrchFlow Rust Crates Developer Guide

Complete guide for using OrchFlow's Rust crates to build terminal orchestration systems.

## Table of Contents
1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [orchflow-core](#orchflow-core)
4. [orchflow-mux](#orchflow-mux)
5. [orchflow-terminal](#orchflow-terminal)
6. [Building Applications](#building-applications)
7. [Advanced Patterns](#advanced-patterns)
8. [Performance Optimization](#performance-optimization)
9. [Testing Strategies](#testing-strategies)
10. [Production Deployment](#production-deployment)

## Overview

OrchFlow provides three core Rust crates for building terminal orchestration systems:

- **orchflow-core**: High-level orchestration engine with state management
- **orchflow-mux**: Terminal multiplexer abstraction (tmux, mock, custom)
- **orchflow-terminal**: Low-level PTY and terminal I/O management

### Architecture

```
Your Application
      ↓
orchflow-core (Orchestration Layer)
      ↓
orchflow-mux (Multiplexer Abstraction)
      ↓
orchflow-terminal (Terminal I/O)
      ↓
Operating System (PTY/Terminal)
```

## Getting Started

### Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
orchflow-core = "0.1"
orchflow-mux = "0.1"
orchflow-terminal = "0.1"

# Async runtime
tokio = { version = "1", features = ["full"] }

# Optional dependencies
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tracing = "0.1"
tracing-subscriber = "0.3"
```

### Basic Example

```rust
use orchflow_core::{Manager, StateManager, storage::MemoryStore};
use orchflow_mux::factory::BackendFactory;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    // Create storage backend
    let store = Arc::new(MemoryStore::new());
    let state_manager = StateManager::new(store);
    
    // Create terminal backend (auto-detects tmux or uses mock)
    let backend = Arc::new(BackendFactory::create_backend().await?);
    
    // Create orchestration manager
    let manager = Manager::new(backend, state_manager);
    
    // Create a session
    let session_id = manager.create_session("my-app").await?;
    
    // Create panes
    let pane1 = manager.create_pane(&session_id, None).await?;
    let pane2 = manager.split_pane(&session_id, &pane1, false, 50).await?;
    
    // Send commands
    manager.send_to_pane(&session_id, &pane1, "echo 'Hello from pane 1'").await?;
    manager.send_to_pane(&session_id, &pane2, "echo 'Hello from pane 2'").await?;
    
    Ok(())
}
```

## orchflow-core

The core orchestration engine providing high-level abstractions.

### Manager

The main entry point for orchestration:

```rust
use orchflow_core::{Manager, Config};
use orchflow_mux::TmuxBackend;
use std::sync::Arc;

// Custom configuration
let config = Config {
    max_sessions: 10,
    max_panes_per_session: 20,
    default_shell: Some("/bin/zsh".to_string()),
    enable_persistence: true,
    ..Default::default()
};

// Create manager with specific backend
let backend = Arc::new(TmuxBackend::new());
let manager = Manager::with_config(backend, state_manager, config);

// Session management
let session = manager.create_session("dev-env").await?;
manager.rename_session(&session, "prod-env").await?;
manager.attach_session(&session).await?;

// Pane management
let main_pane = manager.create_pane(&session, Some("main")).await?;
let log_pane = manager.split_pane(&session, &main_pane, true, 30).await?;

// Layout management
manager.set_layout(&session, Layout::EvenHorizontal).await?;
manager.resize_pane(&session, &log_pane, Direction::Up, 10).await?;
```

### State Management

Persistent state across sessions:

```rust
use orchflow_core::{StateManager, storage::FileStore};
use std::path::PathBuf;

// File-based persistence
let store = Arc::new(FileStore::new(PathBuf::from("/var/lib/orchflow")));
let state_manager = StateManager::new(store);

// Save session state
#[derive(Serialize, Deserialize)]
struct AppState {
    sessions: Vec<SessionInfo>,
    user_preferences: UserPrefs,
    last_command: String,
}

let app_state = AppState {
    sessions: vec![/* ... */],
    user_preferences: UserPrefs::default(),
    last_command: "build project".to_string(),
};

state_manager.save_state("app", &app_state).await?;

// Restore state
let restored: AppState = state_manager.load_state("app").await?;

// Atomic operations
state_manager.transaction(|tx| async move {
    tx.set("counter", 1).await?;
    let val: i32 = tx.get("counter").await?;
    tx.set("counter", val + 1).await?;
    Ok(())
}).await?;
```

### Event System

React to terminal events:

```rust
use orchflow_core::{Event, EventHandler};

// Define custom events
#[derive(Debug, Clone)]
enum CustomEvent {
    TaskCompleted { task_id: String, result: String },
    WorkerSpawned { worker_id: String },
}

// Implement event handler
struct MyEventHandler;

#[async_trait]
impl EventHandler for MyEventHandler {
    async fn handle_event(&self, event: Event) -> Result<(), Error> {
        match event {
            Event::PaneOutput { session_id, pane_id, data } => {
                println!("Output from {}/{}: {}", session_id, pane_id, data);
                
                // Parse output for completion markers
                if data.contains("TASK_COMPLETE") {
                    // Trigger custom event
                }
            }
            Event::PaneClosed { session_id, pane_id } => {
                println!("Pane closed: {}/{}", session_id, pane_id);
            }
            _ => {}
        }
        Ok(())
    }
}

// Register handler
manager.register_event_handler(Arc::new(MyEventHandler)).await;

// Subscribe to specific events
let mut event_stream = manager.subscribe_events(vec![
    EventType::PaneOutput,
    EventType::SessionCreated,
]).await;

while let Some(event) = event_stream.next().await {
    // Process events
}
```

### Plugin System

Extend functionality with plugins:

```rust
use orchflow_core::{Plugin, PluginContext, PluginResult};

#[derive(Debug)]
struct GitPlugin {
    config: GitConfig,
}

#[async_trait]
impl Plugin for GitPlugin {
    fn name(&self) -> &str {
        "git-integration"
    }
    
    fn version(&self) -> &str {
        "0.1.0"
    }
    
    async fn initialize(&mut self, context: &PluginContext) -> PluginResult<()> {
        // Setup plugin
        Ok(())
    }
    
    async fn execute(&self, command: &str, context: &PluginContext) -> PluginResult<String> {
        match command {
            "status" => {
                let output = context.run_command("git status").await?;
                Ok(output)
            }
            "commit" => {
                // Interactive commit flow
                let message = context.prompt("Commit message: ").await?;
                let output = context.run_command(&format!("git commit -m '{}'", message)).await?;
                Ok(output)
            }
            _ => Err("Unknown command".into())
        }
    }
}

// Register plugin
manager.register_plugin(Arc::new(GitPlugin::new(config))).await?;

// Use plugin
let result = manager.execute_plugin("git-integration", "status").await?;
```

## orchflow-mux

Terminal multiplexer abstraction layer.

### Backend Trait

Implement custom backends:

```rust
use orchflow_mux::{Backend, Session, Pane, Result};
use async_trait::async_trait;

struct CustomBackend {
    // Your implementation
}

#[async_trait]
impl Backend for CustomBackend {
    async fn create_session(&self, name: &str) -> Result<Session> {
        // Create session in your system
        Ok(Session {
            id: generate_id(),
            name: name.to_string(),
            created_at: SystemTime::now(),
        })
    }
    
    async fn list_sessions(&self) -> Result<Vec<Session>> {
        // List active sessions
        Ok(vec![])
    }
    
    async fn create_pane(&self, session_id: &str, window_id: Option<&str>) -> Result<Pane> {
        // Create new pane
        Ok(Pane {
            id: generate_id(),
            session_id: session_id.to_string(),
            window_id: window_id.unwrap_or("0").to_string(),
            index: 0,
        })
    }
    
    async fn send_keys(&self, session_id: &str, pane_id: &str, keys: &str) -> Result<()> {
        // Send input to pane
        Ok(())
    }
    
    async fn capture_pane(&self, session_id: &str, pane_id: &str) -> Result<String> {
        // Capture pane content
        Ok(String::new())
    }
    
    // ... implement other required methods
}
```

### Tmux Backend

Production-ready tmux integration:

```rust
use orchflow_mux::{TmuxBackend, TmuxConfig};

let config = TmuxConfig {
    socket_path: Some("/tmp/orchflow.sock".to_string()),
    default_shell: Some("/bin/zsh".to_string()),
    base_index: 1,
    pane_base_index: 1,
    mouse: true,
    colors_256: true,
};

let tmux = TmuxBackend::with_config(config);

// Advanced tmux operations
tmux.set_option("status-style", "bg=blue fg=white").await?;
tmux.set_pane_option(&session_id, &pane_id, "remain-on-exit", "on").await?;

// Custom layouts
tmux.select_layout(&session_id, "tiled").await?;

// Hooks
tmux.set_hook("after-new-session", "run-shell 'notify-send \"Session created\"'").await?;
```

### Mock Backend

For testing and development:

```rust
use orchflow_mux::{MockBackend, MockBehavior};

let mut mock = MockBackend::new();

// Configure behavior
mock.configure(MockBehavior {
    should_fail_on_create: false,
    artificial_delay: Some(Duration::from_millis(10)),
    max_sessions: 5,
    max_panes_per_session: 10,
});

// Add expected outputs
mock.add_pane_output("session1", "pane1", "Hello from mock!");

// Use in tests
let captured = mock.capture_pane("session1", "pane1").await?;
assert_eq!(captured, "Hello from mock!");

// Verify interactions
let history = mock.get_command_history();
assert_eq!(history.len(), 1);
```

## orchflow-terminal

Low-level terminal I/O management.

### PTY Management

Create and manage pseudo-terminals:

```rust
use orchflow_terminal::{Pty, PtyConfig, Size};

let config = PtyConfig {
    shell: Some("/bin/bash".to_string()),
    args: vec!["-l".to_string()],
    env: vec![
        ("TERM".to_string(), "xterm-256color".to_string()),
        ("LANG".to_string(), "en_US.UTF-8".to_string()),
    ],
    cwd: Some("/home/user/projects".to_string()),
    size: Size { rows: 24, cols: 80 },
};

let mut pty = Pty::new(config)?;

// Write to PTY
pty.write(b"echo 'Hello, PTY!'\r\n").await?;

// Read from PTY
let mut output = vec![0u8; 1024];
let n = pty.read(&mut output).await?;
println!("Output: {}", String::from_utf8_lossy(&output[..n]));

// Resize PTY
pty.resize(Size { rows: 30, cols: 120 }).await?;

// Clean shutdown
pty.close().await?;
```

### Stream Processing

Process terminal output streams:

```rust
use orchflow_terminal::{OutputStream, StreamProcessor, AnsiParser};
use futures::StreamExt;

// Create output stream
let mut stream = OutputStream::new(pty);

// Add processors
stream.add_processor(AnsiParser::new());
stream.add_processor(LineBuffer::new());

// Process output
while let Some(chunk) = stream.next().await {
    match chunk {
        OutputChunk::Text(text) => {
            println!("Text: {}", text);
        }
        OutputChunk::AnsiSequence(seq) => {
            println!("ANSI: {:?}", seq);
        }
        OutputChunk::Line(line) => {
            println!("Complete line: {}", line);
        }
    }
}
```

### Advanced Terminal Control

```rust
use orchflow_terminal::{TerminalControl, Color, Style, CursorShape};

let mut term = TerminalControl::new(pty);

// Styling
term.set_foreground(Color::Blue).await?;
term.set_background(Color::Black).await?;
term.set_style(Style::Bold | Style::Underline).await?;

// Cursor control
term.move_cursor(10, 5).await?;
term.set_cursor_shape(CursorShape::Block).await?;
term.hide_cursor().await?;

// Screen control
term.clear_screen().await?;
term.clear_line().await?;
term.scroll_up(5).await?;

// Alternative screen
term.enter_alternate_screen().await?;
// ... do work
term.leave_alternate_screen().await?;
```

## Building Applications

### CLI Application

Complete terminal application example:

```rust
use clap::{App, Arg, SubCommand};
use orchflow_core::Manager;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let matches = App::new("MyTerminalApp")
        .version("1.0")
        .author("Your Name")
        .about("Terminal orchestration application")
        .subcommand(
            SubCommand::with_name("session")
                .about("Manage sessions")
                .subcommand(
                    SubCommand::with_name("create")
                        .about("Create new session")
                        .arg(Arg::with_name("name")
                            .required(true)
                            .help("Session name"))
                )
                .subcommand(
                    SubCommand::with_name("list")
                        .about("List sessions")
                )
        )
        .subcommand(
            SubCommand::with_name("run")
                .about("Run command in pane")
                .arg(Arg::with_name("session")
                    .short("s")
                    .long("session")
                    .required(true))
                .arg(Arg::with_name("command")
                    .required(true))
        )
        .get_matches();

    // Initialize OrchFlow
    let manager = create_manager().await?;

    match matches.subcommand() {
        ("session", Some(session_matches)) => {
            match session_matches.subcommand() {
                ("create", Some(create_matches)) => {
                    let name = create_matches.value_of("name").unwrap();
                    let session_id = manager.create_session(name).await?;
                    println!("Created session: {}", session_id);
                }
                ("list", _) => {
                    let sessions = manager.list_sessions().await?;
                    for session in sessions {
                        println!("{}: {}", session.id, session.name);
                    }
                }
                _ => {}
            }
        }
        ("run", Some(run_matches)) => {
            let session = run_matches.value_of("session").unwrap();
            let command = run_matches.value_of("command").unwrap();
            
            let pane = manager.get_or_create_pane(session, "main").await?;
            manager.send_to_pane(session, &pane, command).await?;
            
            // Wait for output
            tokio::time::sleep(Duration::from_secs(1)).await;
            
            let output = manager.capture_pane(session, &pane).await?;
            println!("{}", output);
        }
        _ => {}
    }

    Ok(())
}
```

### TUI Application

Terminal UI with ratatui:

```rust
use ratatui::{
    backend::CrosstermBackend,
    layout::{Constraint, Direction, Layout},
    widgets::{Block, Borders, List, ListItem, Paragraph},
    Terminal,
};
use crossterm::{
    event::{self, Event, KeyCode},
    terminal::{disable_raw_mode, enable_raw_mode},
};

struct TerminalUI {
    manager: Arc<Manager>,
    sessions: Vec<SessionInfo>,
    selected: usize,
}

impl TerminalUI {
    async fn run(&mut self) -> Result<()> {
        enable_raw_mode()?;
        let mut terminal = Terminal::new(CrosstermBackend::new(std::io::stdout()))?;
        
        loop {
            terminal.draw(|f| self.draw(f))?;
            
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') => break,
                    KeyCode::Up => self.previous(),
                    KeyCode::Down => self.next(),
                    KeyCode::Enter => self.connect_session().await?,
                    KeyCode::Char('n') => self.new_session().await?,
                    KeyCode::Char('d') => self.delete_session().await?,
                    _ => {}
                }
            }
            
            self.refresh_sessions().await?;
        }
        
        disable_raw_mode()?;
        Ok(())
    }
    
    fn draw(&self, f: &mut Frame) {
        let chunks = Layout::default()
            .direction(Direction::Horizontal)
            .constraints([Constraint::Percentage(30), Constraint::Percentage(70)])
            .split(f.size());
        
        // Session list
        let sessions: Vec<ListItem> = self.sessions
            .iter()
            .map(|s| ListItem::new(s.name.clone()))
            .collect();
            
        let sessions_list = List::new(sessions)
            .block(Block::default().borders(Borders::ALL).title("Sessions"))
            .highlight_style(Style::default().bg(Color::Blue));
            
        f.render_stateful_widget(sessions_list, chunks[0], &mut self.list_state());
        
        // Session details
        if let Some(session) = self.sessions.get(self.selected) {
            let details = Paragraph::new(format!(
                "ID: {}\nName: {}\nPanes: {}\nCreated: {:?}",
                session.id, session.name, session.pane_count, session.created_at
            ))
            .block(Block::default().borders(Borders::ALL).title("Details"));
            
            f.render_widget(details, chunks[1]);
        }
    }
}
```

### Web Terminal Server

Expose terminals via WebSocket:

```rust
use axum::{
    extract::{ws::WebSocketUpgrade, State},
    response::Response,
    routing::get,
    Router,
};
use orchflow_terminal::Pty;

struct AppState {
    manager: Arc<Manager>,
}

async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(mut socket: WebSocket, state: Arc<AppState>) {
    // Create PTY for this connection
    let pty = Pty::new(Default::default()).unwrap();
    let pty_read = pty.clone();
    
    // Forward PTY output to WebSocket
    tokio::spawn(async move {
        let mut buffer = vec![0u8; 1024];
        loop {
            match pty_read.read(&mut buffer).await {
                Ok(n) => {
                    let data = &buffer[..n];
                    if socket.send(Message::Binary(data.to_vec())).await.is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }
    });
    
    // Forward WebSocket input to PTY
    while let Some(msg) = socket.recv().await {
        if let Ok(msg) = msg {
            match msg {
                Message::Text(text) => {
                    pty.write(text.as_bytes()).await.ok();
                }
                Message::Binary(data) => {
                    pty.write(&data).await.ok();
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let state = Arc::new(AppState {
        manager: create_manager().await.unwrap(),
    });
    
    let app = Router::new()
        .route("/ws", get(websocket_handler))
        .route("/", get(|| async { include_str!("../static/index.html") }))
        .with_state(state);
    
    axum::Server::bind(&"0.0.0.0:3000".parse().unwrap())
        .serve(app.into_make_service())
        .await
        .unwrap();
}
```

## Advanced Patterns

### Session Templates

Pre-configured session layouts:

```rust
use orchflow_core::{Template, TemplateBuilder};

let dev_template = TemplateBuilder::new("development")
    .add_pane("editor", PaneConfig {
        command: Some("nvim"),
        cwd: Some("${PROJECT_ROOT}"),
        size: 60,
    })
    .add_pane("terminal", PaneConfig {
        command: None,
        cwd: Some("${PROJECT_ROOT}"),
        size: 25,
    })
    .add_pane("logs", PaneConfig {
        command: Some("tail -f ${LOG_FILE}"),
        cwd: None,
        size: 15,
    })
    .layout(Layout::MainVertical)
    .build();

// Apply template
manager.apply_template(&session_id, &dev_template, vars).await?;
```

### Command Macros

Reusable command sequences:

```rust
use orchflow_core::{Macro, MacroStep};

let build_macro = Macro::new("build-project")
    .add_step(MacroStep::Command("cargo clean"))
    .add_step(MacroStep::Command("cargo build --release"))
    .add_step(MacroStep::WaitFor("Finished release"))
    .add_step(MacroStep::Conditional {
        condition: "success",
        then_step: Box::new(MacroStep::Command("cargo test")),
        else_step: Box::new(MacroStep::Command("echo 'Build failed!'")),
    });

// Execute macro
manager.execute_macro(&session_id, &pane_id, &build_macro).await?;
```

### Distributed Orchestration

Coordinate across multiple machines:

```rust
use orchflow_core::{RemoteBackend, SSHConfig};

// Connect to remote machines
let remote1 = RemoteBackend::new(SSHConfig {
    host: "server1.example.com",
    user: "deploy",
    key_file: Some("/home/user/.ssh/id_rsa"),
    ..Default::default()
});

let remote2 = RemoteBackend::new(SSHConfig {
    host: "server2.example.com",
    user: "deploy",
    key_file: Some("/home/user/.ssh/id_rsa"),
    ..Default::default()
});

// Create distributed manager
let dist_manager = DistributedManager::new()
    .add_node("server1", remote1)
    .add_node("server2", remote2)
    .build();

// Run commands across nodes
dist_manager.broadcast("docker pull myapp:latest").await?;

// Coordinate deployment
dist_manager.orchestrate(|node| async move {
    match node.name() {
        "server1" => {
            node.run("docker stop myapp || true").await?;
            node.run("docker run -d --name myapp myapp:latest").await?;
        }
        "server2" => {
            node.run("docker stop myapp-replica || true").await?;
            node.run("docker run -d --name myapp-replica myapp:latest").await?;
        }
        _ => {}
    }
    Ok(())
}).await?;
```

## Performance Optimization

### Connection Pooling

Reuse backend connections:

```rust
use orchflow_mux::{ConnectionPool, PoolConfig};

let pool = ConnectionPool::new(PoolConfig {
    min_connections: 2,
    max_connections: 10,
    connection_timeout: Duration::from_secs(5),
    idle_timeout: Duration::from_secs(300),
});

// Get connection from pool
let conn = pool.get().await?;
conn.create_session("pooled-session").await?;

// Connection returned to pool on drop
```

### Buffering Strategies

Optimize I/O performance:

```rust
use orchflow_terminal::{BufferedPty, BufferConfig};

let config = BufferConfig {
    read_buffer_size: 8192,
    write_buffer_size: 4096,
    flush_interval: Duration::from_millis(10),
    high_water_mark: 65536,
};

let mut buffered_pty = BufferedPty::new(pty, config);

// Batch writes
buffered_pty.write_all(b"command1\r\n").await?;
buffered_pty.write_all(b"command2\r\n").await?;
buffered_pty.write_all(b"command3\r\n").await?;
buffered_pty.flush().await?; // Send all at once

// Efficient reading
let mut reader = buffered_pty.reader();
let mut line = String::new();
reader.read_line(&mut line).await?;
```

### Async Patterns

Concurrent operations:

```rust
use futures::future::join_all;

// Parallel session creation
let session_futures: Vec<_> = (0..10)
    .map(|i| manager.create_session(&format!("session-{}", i)))
    .collect();

let sessions = join_all(session_futures).await;

// Parallel command execution
let command_futures: Vec<_> = sessions
    .into_iter()
    .zip(commands.iter())
    .map(|(session, cmd)| async move {
        let pane = manager.create_pane(&session, None).await?;
        manager.send_to_pane(&session, &pane, cmd).await?;
        Ok::<_, Error>((session, pane))
    })
    .collect();

let results = join_all(command_futures).await;
```

## Testing Strategies

### Unit Testing

Test individual components:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use orchflow_mux::MockBackend;

    #[tokio::test]
    async fn test_session_creation() {
        let backend = Arc::new(MockBackend::new());
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let manager = Manager::new(backend.clone(), state_manager);
        
        let session_id = manager.create_session("test").await.unwrap();
        
        assert!(!session_id.is_empty());
        assert_eq!(backend.session_count(), 1);
    }

    #[tokio::test]
    async fn test_command_execution() {
        let mut backend = MockBackend::new();
        backend.add_pane_output("session1", "pane1", "command output");
        
        let backend = Arc::new(backend);
        let manager = create_test_manager(backend);
        
        manager.send_to_pane("session1", "pane1", "test command").await.unwrap();
        let output = manager.capture_pane("session1", "pane1").await.unwrap();
        
        assert_eq!(output, "command output");
    }
}
```

### Integration Testing

Test component interactions:

```rust
#[tokio::test]
async fn test_full_workflow() {
    // Use real tmux if available, mock otherwise
    let backend = Arc::new(BackendFactory::create_backend().await.unwrap());
    let manager = create_manager(backend).await.unwrap();
    
    // Create session with multiple panes
    let session = manager.create_session("integration-test").await.unwrap();
    let main_pane = manager.create_pane(&session, None).await.unwrap();
    let log_pane = manager.split_pane(&session, &main_pane, true, 30).await.unwrap();
    
    // Run commands
    manager.send_to_pane(&session, &main_pane, "echo 'Main'").await.unwrap();
    manager.send_to_pane(&session, &log_pane, "echo 'Logs'").await.unwrap();
    
    // Wait for execution
    tokio::time::sleep(Duration::from_millis(100)).await;
    
    // Verify outputs
    let main_output = manager.capture_pane(&session, &main_pane).await.unwrap();
    let log_output = manager.capture_pane(&session, &log_pane).await.unwrap();
    
    assert!(main_output.contains("Main"));
    assert!(log_output.contains("Logs"));
    
    // Cleanup
    manager.kill_session(&session).await.unwrap();
}
```

### Benchmarking

Performance testing:

```rust
use criterion::{criterion_group, criterion_main, Criterion};

fn benchmark_session_creation(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let manager = rt.block_on(create_test_manager());
    
    c.bench_function("create_session", |b| {
        b.to_async(&rt).iter(|| async {
            let session = manager.create_session("bench").await.unwrap();
            manager.kill_session(&session).await.unwrap();
        });
    });
}

fn benchmark_command_execution(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let manager = rt.block_on(create_test_manager());
    let session = rt.block_on(manager.create_session("bench")).unwrap();
    let pane = rt.block_on(manager.create_pane(&session, None)).unwrap();
    
    c.bench_function("send_command", |b| {
        b.to_async(&rt).iter(|| async {
            manager.send_to_pane(&session, &pane, "echo 'test'").await.unwrap();
        });
    });
}

criterion_group!(benches, benchmark_session_creation, benchmark_command_execution);
criterion_main!(benches);
```

## Production Deployment

### Configuration

Production-ready configuration:

```toml
# orchflow.toml
[core]
max_sessions = 100
max_panes_per_session = 50
session_timeout = 3600  # 1 hour
enable_persistence = true
persistence_interval = 300  # 5 minutes

[backend]
type = "tmux"
socket_path = "/var/run/orchflow/tmux.sock"
config_file = "/etc/orchflow/tmux.conf"

[security]
enable_command_filtering = true
allowed_commands = [
    "ls", "cd", "pwd", "echo", "cat", "grep",
    "docker", "kubectl", "git"
]
forbidden_patterns = [
    "rm -rf /",
    ":(){ :|:& };:",  # Fork bomb
]

[monitoring]
enable_metrics = true
metrics_port = 9090
enable_tracing = true
jaeger_endpoint = "http://localhost:14268/api/traces"

[logging]
level = "info"
format = "json"
output = "/var/log/orchflow/orchflow.log"
max_size = "100MB"
max_backups = 10
```

### Systemd Service

```ini
# /etc/systemd/system/orchflow.service
[Unit]
Description=OrchFlow Terminal Orchestration
After=network.target

[Service]
Type=notify
User=orchflow
Group=orchflow
ExecStart=/usr/local/bin/orchflow-server
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5s

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/lib/orchflow /var/log/orchflow

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
MemoryLimit=2G
CPUQuota=200%

[Install]
WantedBy=multi-user.target
```

### Monitoring

Prometheus metrics:

```rust
use prometheus::{IntCounter, Histogram, Registry};

lazy_static! {
    static ref SESSION_COUNTER: IntCounter = IntCounter::new(
        "orchflow_sessions_total", "Total sessions created"
    ).unwrap();
    
    static ref COMMAND_DURATION: Histogram = Histogram::with_opts(
        HistogramOpts::new("orchflow_command_duration_seconds", "Command execution time")
    ).unwrap();
}

// Instrument code
SESSION_COUNTER.inc();

let timer = COMMAND_DURATION.start_timer();
manager.send_to_pane(&session, &pane, command).await?;
timer.observe_duration();

// Expose metrics
let app = Router::new()
    .route("/metrics", get(|| async {
        let encoder = TextEncoder::new();
        let metric_families = prometheus::gather();
        let mut buffer = vec![];
        encoder.encode(&metric_families, &mut buffer).unwrap();
        String::from_utf8(buffer).unwrap()
    }));
```

### High Availability

Multi-instance deployment:

```rust
use orchflow_core::{ClusterConfig, ConsensusBackend};

let cluster_config = ClusterConfig {
    node_id: "node1",
    peers: vec![
        "node2.example.com:7000",
        "node3.example.com:7000",
    ],
    consensus_backend: ConsensusBackend::Raft,
    replication_factor: 2,
};

let ha_manager = Manager::with_cluster(backend, state_manager, cluster_config).await?;

// Sessions replicated across nodes
let session = ha_manager.create_session("distributed").await?;

// Automatic failover
ha_manager.on_leader_change(|new_leader| {
    log::info!("New leader elected: {}", new_leader);
});
```

### Security

Production security measures:

```rust
use orchflow_core::{SecurityConfig, CommandFilter};

let security_config = SecurityConfig {
    enable_tls: true,
    cert_path: "/etc/orchflow/tls/cert.pem",
    key_path: "/etc/orchflow/tls/key.pem",
    
    enable_auth: true,
    auth_backend: AuthBackend::LDAP {
        url: "ldaps://ldap.example.com",
        base_dn: "dc=example,dc=com",
    },
    
    command_filter: CommandFilter::new()
        .allow_commands(vec!["ls", "cat", "echo"])
        .deny_patterns(vec!["rm -rf", "dd if="])
        .sandbox_mode(true),
    
    audit_log: Some("/var/log/orchflow/audit.log"),
};

let secure_manager = Manager::with_security(backend, state_manager, security_config)?;
```

---

This comprehensive guide provides everything needed to build production-ready terminal orchestration systems with OrchFlow's Rust crates. The modular design allows you to use exactly what you need, from simple terminal automation to complex distributed orchestration systems.