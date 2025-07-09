# orchflow Documentation Index

## API References
- **[api/README.md](api/README.md)** - Complete orchflow API reference
- **[api/MANAGER_API.md](api/MANAGER_API.md)** - Rust Manager API for orchestration
- **[api/TERMINAL_STREAMING_API.md](api/TERMINAL_STREAMING_API.md)** - PTY streaming APIs
- **[api/PLUGIN_API.md](api/PLUGIN_API.md)** - Plugin development API

## Core Documentation

### Development Guides
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Setup, workflow, standards, and testing for contributors
- **[TEST_STRATEGY.md](TEST_STRATEGY.md)** - TDD approach, test types, coverage requirements
- **[PERFORMANCE_GUIDE.md](PERFORMANCE_GUIDE.md)** - Optimization strategies and benchmarking

### Component Documentation
- **[COMPONENT_RESPONSIBILITIES.md](COMPONENT_RESPONSIBILITIES.md)** - Manager vs Orchestrator usage decisions
- **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Feature implementation roadmap with AI vision

## Architecture Documentation

### System Architecture
- **[architecture/UNIFIED_ARCHITECTURE.md](architecture/UNIFIED_ARCHITECTURE.md)** - Complete desktop/web platform vision
- **[architecture/MANAGER_ORCHESTRATOR_ARCHITECTURE.md](architecture/MANAGER_ORCHESTRATOR_ARCHITECTURE.md)** - When to use Manager vs Orchestrator

### Core Components
- **[architecture/PTY_ARCHITECTURE.md](architecture/PTY_ARCHITECTURE.md)** - Terminal implementation with portable-pty
- **[architecture/MANAGER_PATTERN_ARCHITECTURE.md](architecture/MANAGER_PATTERN_ARCHITECTURE.md)** - Central orchestration pattern
- **[architecture/STATE_MANAGEMENT_ARCHITECTURE.md](architecture/STATE_MANAGEMENT_ARCHITECTURE.md)** - Unified state with SQLite

### Communication & Integration
- **[architecture/IPC_COMMAND_ARCHITECTURE.md](architecture/IPC_COMMAND_ARCHITECTURE.md)** - Frontend-backend Tauri IPC
- **[architecture/MUXD_PROTOCOL_ARCHITECTURE.md](architecture/MUXD_PROTOCOL_ARCHITECTURE.md)** - Multiplexer daemon protocol
- **[architecture/SEARCH_INTEGRATION_ARCHITECTURE.md](architecture/SEARCH_INTEGRATION_ARCHITECTURE.md)** - Ripgrep integration

### Extensibility
- **[architecture/PLUGIN_SYSTEM_ARCHITECTURE.md](architecture/PLUGIN_SYSTEM_ARCHITECTURE.md)** - Plugin framework design

---
*For AI agents: Start with [../DEVELOPMENT.md](../DEVELOPMENT.md) at root*