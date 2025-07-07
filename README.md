# orchflow

A VS Code-style developer environment combining tmux's powerful terminal multiplexing with AI-driven orchestration and a modern GUI.

## Vision

Combine the power of Neovim with intelligent terminal orchestration to create a VS Code-like experience that's faster, more keyboard-driven, and respects the terminal-first workflow.

## Core Features

- **Terminal Orchestration**: Spawn, control, and monitor multiple terminals via tmux
- **AI Agent Router**: Intelligent task delegation to specialized terminal agents
- **Modern GUI**: SvelteKit + Tauri frontend with VS Code-like experience
- **IDE Capabilities**: Full language support, debugging, git integration via Neovim
- **Smart Coordination**: Automated workflows based on AI intent parsing
- **Real-time Dashboard**: Live monitoring of agents, resources, and logs

## Architecture

```
orchflow/
├── lua/orchflow/
│   ├── core/          # Core functionality
│   ├── orchestrator/  # Terminal management
│   ├── ui/            # UI components
│   └── plugins/       # Plugin configurations
├── scripts/           # Helper scripts
├── templates/         # Project and config templates
└── docs/              # Documentation
```

## Development Status

🚧 Under active development

### Completed
- ✅ Tmux integration for terminal management
- ✅ Basic orchestration commands in Neovim
- ✅ Terminal dashboard UI
- ✅ Layout templates for different workflows

### In Progress
- ✅ AI agent router implementation
- ✅ WebSocket communication layer
- ✅ Frontend GUI development (SvelteKit + Tauri)

### Next Steps
- 📋 Enhanced AI intent parsing
- 📋 Terminal output streaming
- 📋 Agent persistence and recovery
- 📋 Multi-project support
- 📋 Plugin system for custom agents

### Future
- 📋 Agent marketplace
- 📋 Cloud synchronization
- 📋 Collaborative features

## Quick Start

### Prerequisites
- Neovim 0.9+
- Tmux 3.0+
- Node.js 18+ (for orchestrator)
- Rust (optional, for performance-critical components)

### Testing the Neovim Plugin
```bash
# Test orchflow in isolation
cd projects/orchflow
./test.sh

# In Neovim:
:OrchSpawn          # Create a new terminal
:OrchDashboard      # View terminal dashboard
<leader>tn          # Quick spawn terminal
```

### Testing the AI Orchestrator
```bash
# Run the orchestrator demo
./test-orchestrator.sh

# Example commands in the demo:
> help                    # Show available commands
> start dev server        # Launch development server
> run tests              # Run test suite
> open node repl         # Start Node.js REPL
> list                   # Show all active agents
> output agent-1         # View agent output
```

### Running the GUI Frontend
```bash
# Setup frontend (first time only)
./setup-frontend.sh

# Start orchestrator in one terminal
cd orchestrator && tsx demo.ts

# Start frontend in another terminal
cd frontend && npm run dev

# Or run as desktop app with Tauri
cd frontend && npm run tauri:dev
```

### Using Tmux Layouts
```bash
# Development session
./layouts/dev-session.sh

# AI orchestration session
./layouts/ai-session.sh
```

## License

Licensed under either of

 * Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in orchflow by you, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.