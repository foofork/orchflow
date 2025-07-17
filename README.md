# OrchFlow

Natural language orchestration for command-line workflows.

[![npm](https://img.shields.io/npm/v/@orchflow/claude-flow.svg)](https://www.npmjs.com/package/@orchflow/claude-flow)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-16%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

OrchFlow transforms how you work with AI by injecting orchestration capabilities directly into Claude. Instead of managing multiple windows or sessions, you naturally orchestrate complex tasks through conversation - Claude becomes capable of working on multiple aspects of your project simultaneously.

## Quick Example

```bash
# Install OrchFlow
npm install -g @orchflow/claude-flow

# Launch Claude with orchestration powers
orchflow
```

Now in your Claude conversation:

```
You: Let's build a complete authentication system - we need the API, 
     frontend components, and comprehensive tests

Claude: I'll help you build a complete authentication system. This is 
        perfect for parallel development. Let me organize our work:
        
        ✓ API Developer - Building authentication endpoints
        ✓ Frontend Developer - Creating login/signup components
        ✓ Test Engineer - Writing comprehensive test suite
        
        Starting with the API, we'll use JWT tokens for authentication...
        [Claude naturally orchestrates while maintaining conversation flow]
```

## Features

### 🧠 Intelligent Orchestration
Claude understands when to parallelize work and orchestrates naturally:
- Automatically creates workers when you describe multiple tasks
- Seamlessly switches context when you ask about different components
- Shares knowledge and decisions across all work streams
- Maintains conversation flow while managing complex orchestration

### 💬 Natural Conversation
No special commands or syntax needed:
- Just describe what you want to build
- Ask about progress on any component
- Request changes that apply across all workers
- Claude handles the orchestration invisibly

### 🔄 Seamless Integration
OrchFlow feels like a natural extension of Claude:
- Works within your normal Claude conversation
- Context switching happens automatically
- Knowledge sharing occurs behind the scenes
- Session state persists across conversations

## Installation

### Requirements
- Node.js 16+
- [claude-flow](https://github.com/anthropics/claude-flow) 2.0.0-alpha.50+
- tmux (for terminal multiplexing)
- macOS, Linux, or Windows (WSL)

### Install
```bash
# Install claude-flow first
npm install -g claude-flow@2.0.0-alpha.50

# Install OrchFlow
npm install -g @orchflow/claude-flow

# Launch
claude-flow orchflow
```

## Usage

### Basic Commands

```bash
# Development tasks
Build a React component for user profiles
Create REST API endpoints for authentication
Implement database schema for products
Set up testing framework for the project

# Worker management
Show me all workers
Connect to the React developer
Press 1  # Quick access to worker 1
Stop all workers

# System control
Save session as "morning-work"
Restore session "morning-work"
Show system performance
```

### Real-World Workflows

#### Full-Stack Development
```bash
# Create coordinated workers for full-stack development
Build backend API with Express and PostgreSQL
Create React frontend with TypeScript
Set up authentication with JWT tokens
Deploy application to AWS

# Monitor all workers
Show me all workers
Display progress for each worker
```

#### Code Review & Testing
```bash
# Automated code review workflow
Review pull request #123 for security issues
Check test coverage for authentication module
Validate API documentation completeness
Run performance benchmarks on endpoints
```

#### Research & Learning
```bash
# Technology research
Research React vs Vue vs Angular for enterprise
Investigate microservices patterns
Analyze OAuth 2.0 implementation strategies
Study Kubernetes orchestration concepts
```

## Documentation

### Getting Started
- [Quick Start Guide](packages/orchflow-claude-flow/QUICK_START.md) - 5-minute setup
- [User Guide](packages/orchflow-claude-flow/USER_GUIDE.md) - Complete features
- [Examples](packages/orchflow-claude-flow/EXAMPLES.md) - Common workflows

### Reference
- [API Documentation](packages/orchflow-claude-flow/API.md) - Programmatic usage
- [Troubleshooting](packages/orchflow-claude-flow/TROUBLESHOOTING.md) - Problem resolution
- [Changelog](packages/orchflow-claude-flow/CHANGELOG.md) - Version history

### Advanced
- [Architecture Overview](ORCHFLOW_IMPLEMENTATION_COMPLETE.md) - Technical deep dive
- [Documentation Index](packages/orchflow-claude-flow/DOCUMENTATION.md) - All documentation

## Architecture Overview

OrchFlow is designed as a thin wrapper around claude-flow, preserving all existing functionality while adding natural language orchestration:

```
User Input (Natural Language)
    ↓
OrchFlow Terminal Interface
    ├── Natural Language Interface (via MCP injection)
    ├── Worker Management
    ├── Task Orchestration
    └── Status Monitoring
         ↓
    claude-flow (all commands preserved)
         ↓
    Terminal Multiplexer (tmux)
```

### Key Components

- **Enhanced MCP Tools**: 7 specialized tools for Claude integration
- **Smart Scheduler**: AI-powered task scheduling with learning
- **Worker Manager**: Lifecycle management with tmux integration
- **State Manager**: Persistent sessions with atomic saves
- **Conflict Detector**: Resource conflict prevention
- **Split-Screen Manager**: Professional 70/30 terminal layout

## Programmatic Usage

```typescript
import { orchestrate, createWorker, getStatus } from '@orchflow/claude-flow';

// Create a task programmatically
const worker = await createWorker({
  task: "Build authentication system",
  type: "developer"
});

// Monitor progress
const status = await getStatus(worker.id);
console.log(`Progress: ${status.progress}%`);

// Connect to worker
await connectToWorker(worker.id);
```

## Performance

- **Startup Time**: < 3 seconds
- **Memory Overhead**: < 100MB for orchestration
- **Worker Capacity**: 8 concurrent workers (configurable)
- **Response Time**: Real-time orchestration via Claude
- **TypeScript Codebase**: 264KB optimized implementation

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
git clone https://github.com/orchflow/orchflow
cd orchflow/packages/orchflow-claude-flow
npm install
npm run build
npm test
```

## Support

- **Issues**: [GitHub Issues](https://github.com/orchflow/orchflow/issues)
- **Discussions**: [GitHub Discussions](https://github.com/orchflow/orchflow/discussions)
- **Documentation**: [Full Documentation](packages/orchflow-claude-flow/DOCUMENTATION.md)

---

## Rust Implementation

OrchFlow's core orchestration engine is built in Rust for performance and reliability:

### Core Crates

#### [orchflow-core](https://crates.io/crates/orchflow-core) [![Crates.io](https://img.shields.io/crates/v/orchflow-core.svg)](https://crates.io/crates/orchflow-core)

Transport-agnostic orchestration engine for managing terminal sessions, panes, and plugins with an event-driven architecture.

**Features:**
- Manager pattern for coordinating operations
- State management with persistent storage
- Plugin system with event-driven architecture
- Backend abstraction for terminal multiplexers
- Async/await support throughout

#### [orchflow-mux](https://crates.io/crates/orchflow-mux) [![Crates.io](https://img.shields.io/crates/v/orchflow-mux.svg)](https://crates.io/crates/orchflow-mux)

Terminal multiplexer abstraction layer supporting tmux, mock backends, and custom implementations.

**Features:**
- Clean trait-based interface for terminal multiplexers
- **Production**: Full tmux integration with session and pane management
- **Testing**: Mock backend with configurable behavior for testing and development
- Factory pattern for automatic backend selection
- Comprehensive error handling

#### [orchflow-terminal](https://crates.io/crates/orchflow-terminal) [![Crates.io](https://img.shields.io/crates/v/orchflow-terminal.svg)](https://crates.io/crates/orchflow-terminal)

High-performance terminal I/O management with PTY support, buffering, and stream processing.

**Features:**
- **Production**: Real PTY creation and lifecycle management for actual terminal processes
- Async streams for non-blocking terminal operations
- Smart buffering with ring buffer and scrollback
- Stream processing and output management
- Resource cleanup with automatic Drop implementation
- **Testing**: Use `MockBackend` from `orchflow-mux` for testing without real PTYs

### Rust Architecture

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

### Rust Documentation

- [orchflow-core README](./crates/orchflow-core/README.md) - Core orchestration engine
- [orchflow-mux README](./crates/orchflow-mux/README.md) - Terminal multiplexer abstraction
- [orchflow-terminal README](./crates/orchflow-terminal/README.md) - Terminal I/O management

---

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

Built with:
- [claude-flow](https://github.com/anthropics/claude-flow) - The powerful CLI we extend
- [Model Context Protocol](https://github.com/anthropics/mcp) - For Claude integration
- [tmux](https://github.com/tmux/tmux) - Terminal multiplexing
- [TypeScript](https://www.typescriptlang.org/) - Type-safe implementation
- [Tokio](https://tokio.rs/) - Rust async runtime

---

**Created by the Hive Mind collective intelligence on July 16, 2025** 🐝