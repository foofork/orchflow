# **🚧 OrchFlow - IN DEVELOPMENT 🚧**

**⚠️ THIS PROJECT IS ACTIVELY UNDER DEVELOPMENT AND NOT YET STABLE ⚠️**

**Natural language orchestration for command-line workflows.**

[![npm](https://img.shields.io/npm/v/@orchflow/claude-flow.svg)](https://www.npmjs.com/package/@orchflow/claude-flow)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-16%2B-green.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)

**OrchFlow transforms how you work with AI by injecting orchestration capabilities directly into Claude.** Instead of managing multiple windows or sessions, you naturally orchestrate complex tasks through conversation - Claude becomes capable of working on multiple aspects of your project simultaneously.

**🔴 IMPORTANT: This is an alpha release. APIs and features are subject to change.**

## **Quick Example (IN DEVELOPMENT)**

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

## **Features (PLANNED/IN DEVELOPMENT)**

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

## **Installation (DEVELOPMENT VERSION)**

### **Requirements**
- Node.js 16+
- [claude-flow](https://github.com/anthropics/claude-flow) 2.0.0-alpha.50+
- tmux (automatically installed if missing)
- macOS, Linux, or Windows (WSL)

### **Install (DEVELOPMENT ONLY)**

#### Option 1: Development Installation (Current)
```bash
# Install claude-flow first
npm install -g claude-flow@2.0.0-alpha.50

# Clone and build OrchFlow
git clone https://github.com/orchflow/orchflow.git
cd orchflow/packages/orchflow-claude-flow
npm install
npm run build
npm install -g .

# Launch (tmux will be automatically installed if missing)
orchflow
```

#### Option 2: Published Package (Coming Soon)
```bash
# Install claude-flow first
npm install -g claude-flow@2.0.0-alpha.50

# Install OrchFlow (when published)
npm install -g @orchflow/claude-flow

# Launch
orchflow
```

### Auto-Installation Features
- **Automatic tmux setup**: No manual tmux installation required
- **Fallback support**: Gracefully falls back to inline mode if tmux unavailable
- **Cross-platform**: Supports 9 different package managers for tmux installation
- **Configuration management**: Automatic tmux configuration with optimal settings

## **Usage (EXPERIMENTAL)**

### Basic Commands

Once OrchFlow launches, you'll see an interactive setup wizard:

```
🎯 Setup Options
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📱 VS Code Environment Detected

How would you like to use OrchFlow?

1. 🖥️  Split Terminal (tmux) - Full featured with live status pane
2. 📄 Inline Mode - Status updates in main terminal
3. 📊 VS Code Status Bar - Minimal updates in bottom bar
4. 🪟 Separate Window - Dedicated VS Code window for status
```

After setup, use natural language in Claude:

```bash
# Development tasks
Build a complete authentication system with React frontend and Node.js backend
Create comprehensive testing suite with unit and integration tests
Develop REST API with authentication and database integration
Set up CI/CD pipeline with automated testing and deployment

# Progress inquiries
How's the frontend development coming along?
Show me the status of all workers
What's the current system performance?

# Session management
Save session as "auth-system-project"
Restore session "auth-system-project"
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

## **Documentation (IN PROGRESS)**

### Getting Started
- [Quick Start Guide](docs/QUICK_START.md) - 5-minute setup with auto-installation
- [Architecture Overview](docs/ARCHITECTURE.md) - Unified architecture deep dive
- [Examples](docs/EXAMPLES.md) - Common workflows and patterns

### Reference
- [API Documentation](docs/API.md) - Programmatic usage
- [CLI Reference](docs/CLI_REFERENCE.md) - Command-line options
- [Integration Guide](docs/INTEGRATION_GUIDE.md) - MCP integration patterns
- [Troubleshooting](docs/TROUBLESHOOTING.md) - Problem resolution

### Advanced
- [Implementation Status](docs/IMPLEMENTATION_STATUS.md) - Technical implementation details
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Documentation Index](docs/DOCUMENTATION.md) - All documentation

## **Architecture Overview (SUBJECT TO CHANGE)**

OrchFlow features a unified architecture built for production-ready orchestration with comprehensive type safety and streamlined component integration:

```
User Input (Natural Language)
    ↓
OrchFlow Terminal Interface
    ├── UnifiedSetupOrchestrator (automatic tmux setup)
    ├── Enhanced MCP Tools (7 specialized tools)
    ├── Unified Manager System (5 core managers)
    └── Status Monitoring & Real-time Updates
         ↓
    claude-flow (all commands preserved)
         ↓
    Terminal Multiplexer (tmux with auto-install)
```

### Key Components

- **UnifiedSetupOrchestrator**: Single orchestrator handling all setup flows with automatic tmux installation
- **5 Core Managers**: ConfigurationManager, ContextManager, TerminalManager, WorkerManager, UIManager
- **Enhanced MCP Tools**: 7 specialized tools for Claude integration with proper type safety
- **Unified Interfaces**: Single source of truth for all type definitions in unified-interfaces.ts
- **Auto-Installation**: Automatic tmux setup with fallback to inline mode
- **Type Safety**: 100% TypeScript compliance with no production 'as any' casts

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

- **Startup Time**: < 2 seconds (improved with unified architecture)
- **Memory Overhead**: < 80MB for orchestration (reduced through consolidation)
- **Worker Capacity**: 8 concurrent workers (configurable)
- **Response Time**: Real-time orchestration via Claude
- **TypeScript Codebase**: 785KB optimized CLI bundle, 782KB library bundle
- **Build Time**: < 3 seconds for complete compilation
- **Type Safety**: 100% TypeScript compliance with zero production 'as any' casts

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

## **Rust Implementation (IN DEVELOPMENT)**

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
