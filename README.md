# OrchFlow

> **Terminal Orchestration System for AI-Powered Development**

[![License](https://img.shields.io/badge/license-MIT%2FApache--2.0-blue.svg)](LICENSE)
[![Rust](https://img.shields.io/badge/rust-1.70%2B-orange.svg)](https://www.rust-lang.org/)
[![Crates.io](https://img.shields.io/badge/crates.io-orchflow-green.svg)](https://crates.io/search?q=orchflow)

---

OrchFlow is a modular **terminal orchestration system** that provides enterprise-grade abstractions for managing terminal sessions, panes, and multiplexers. Built in Rust with async/await throughout, it's designed for integration into applications requiring programmatic terminal control.

## 📦 Core Crates

### [orchflow-core](https://crates.io/crates/orchflow-core) [![Crates.io](https://img.shields.io/crates/v/orchflow-core.svg)](https://crates.io/crates/orchflow-core)

Transport-agnostic orchestration engine for managing terminal sessions, panes, and plugins with an event-driven architecture.

**Features:**
- Manager pattern for coordinating operations
- State management with persistent storage
- Plugin system with event-driven architecture
- Backend abstraction for terminal multiplexers
- Async/await support throughout

### [orchflow-mux](https://crates.io/crates/orchflow-mux) [![Crates.io](https://img.shields.io/crates/v/orchflow-mux.svg)](https://crates.io/crates/orchflow-mux)

Terminal multiplexer abstraction layer supporting tmux, mock backends, and custom implementations.

**Features:**
- Clean trait-based interface for terminal multiplexers
- Full tmux integration with session and pane management
- Mock backend for testing and development
- Factory pattern for automatic backend selection
- Comprehensive error handling

### [orchflow-terminal](https://crates.io/crates/orchflow-terminal) [![Crates.io](https://img.shields.io/crates/v/orchflow-terminal.svg)](https://crates.io/crates/orchflow-terminal)

High-performance terminal I/O management with PTY support, buffering, and stream processing.

**Features:**
- PTY creation and lifecycle management
- Async streams for non-blocking terminal operations
- Smart buffering with ring buffer and scrollback
- Stream processing and output management
- Resource cleanup with automatic Drop implementation

## 🚀 Quick Start

Add OrchFlow to your project:

```toml
[dependencies]
orchflow-core = "0.1"
orchflow-mux = "0.1"
orchflow-terminal = "0.1"
```

Basic usage:

```rust
use orchflow_core::{Manager, StateManager, storage::MemoryStore};
use orchflow_mux::factory;
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize components
    let store = Arc::new(MemoryStore::new());
    let state_manager = StateManager::new(store);
    let backend = Arc::from(factory::create_mux_backend_async().await);
    let manager = Manager::new(backend, state_manager);
    
    // Use the orchestration system
    // ... your application logic
    
    Ok(())
}
```

## 🏗️ Architecture

OrchFlow provides a clean separation of concerns:

- **Core Layer**: Session and state management, event system, plugin architecture
- **Mux Layer**: Terminal multiplexer abstraction (tmux, mock, custom backends)
- **Terminal Layer**: PTY management, I/O streaming, buffering

```
Application Layer
├── Your Application Code
└── OrchFlow Integration
    │
OrchFlow Core
├── Manager · State · Events · Plugins
├── Backend Abstraction
└── OrchFlow Mux
    ├── Tmux Backend
    ├── Mock Backend (testing)
    └── Custom Backends
        │
OrchFlow Terminal
├── PTY Management
├── I/O Streaming
└── Buffer Management
```

## 🎯 Use Cases

- **Terminal Applications**: Build terminal-based IDEs, dashboards, and tools
- **DevOps Tools**: Create deployment pipelines and monitoring systems
- **AI Orchestration**: Enable AI agents to control and coordinate terminals
- **Testing Frameworks**: Integrate terminal interactions into test suites
- **Remote Development**: Build cloud-based development environments

## 🚀 Key Features

- **Modular Design**: Use only the components you need
- **Transport Agnostic**: Works with any frontend (CLI, GUI, web)
- **Event-Driven**: Real-time updates and reactive architectures
- **Async/Await**: Non-blocking operations throughout
- **Enterprise Ready**: Proper error handling, logging, and testing
- **Backend Agnostic**: Supports multiple terminal multiplexers

## 📖 Documentation

- [orchflow-core README](./crates/orchflow-core/README.md) - Core orchestration engine
- [orchflow-mux README](./crates/orchflow-mux/README.md) - Terminal multiplexer abstraction
- [orchflow-terminal README](./crates/orchflow-terminal/README.md) - Terminal I/O management

## 🔮 Desktop Application (Future)

A reference implementation desktop IDE will be built using these crates, featuring:

- **Tauri-based Desktop App**: Native performance with web technologies
- **Terminal Management**: Full tmux integration
- **Plugin System**: Extensible architecture
- **AI Integration**: Designed for AI agent orchestration

## 📜 Licensing

MIT and Apache 2.0 dual-license.

## 🙌 Acknowledgments

Built with [Tokio](https://tokio.rs/), [Serde](https://serde.rs/), and the Rust ecosystem.

---

**Status:** Ready for integration. Published on [crates.io](https://crates.io/search?q=orchflow).

**Vision:** Modular terminal orchestration enabling the next generation of AI-powered development tools.
