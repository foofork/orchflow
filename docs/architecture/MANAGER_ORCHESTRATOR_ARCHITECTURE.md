# Manager + Orchestrator Architecture Decision Guide

> **Last Updated**: January 2025  
> **Status**: Current architecture decision guide  
> **Companion to**: [ORCHFLOW_UNIFIED_ARCHITECTURE.md](./ORCHFLOW_UNIFIED_ARCHITECTURE.md)

## Purpose

This document helps you understand when and how to use orchflow's Manager vs Orchestrator components. For comprehensive implementation details, see the [Unified Architecture](./ORCHFLOW_UNIFIED_ARCHITECTURE.md) and [Component Responsibilities](./COMPONENT_RESPONSIBILITIES.md) documents.

## Architecture Overview

orchflow uses a **dual-component architecture** that provides flexibility for different use cases:

1. **Rust Manager** - Core infrastructure for terminal management, file operations, and system integration
2. **TypeScript Orchestrator** - Optional AI-powered coordination, agent management, and workflow automation

## Component Responsibilities

### Rust Manager (`frontend/src-tauri/src/manager/`)

**What it does:**
- Terminal lifecycle management (create, destroy, stream)
- File system operations (read, write, watch, search)
- State persistence (SQLite)
- Plugin system (load, execute, manage)
- MuxBackend abstraction (tmux, muxd)
- WebSocket server for external clients

**What it doesn't do:**
- AI agent coordination
- Task scheduling and routing
- Inter-agent communication
- Complex workflow orchestration

### TypeScript Orchestrator (`orchestrator/src/`)

**What it does:**
- AI agent management and coordination
- Intelligent task routing and scheduling
- Swarm coordination (multiple agents working together)
- Command adapters (claude-flow, GPT tools)
- Memory and context management
- Workflow automation

**What it doesn't do:**
- Terminal process management
- File system operations
- State persistence
- Low-level system integration

## Usage Decision Matrix

### Use Manager Only When:

✅ **You want a fast, lightweight terminal IDE**
- Startup time: <100ms
- Memory usage: <10MB base
- No external dependencies

✅ **You don't need AI assistance**
- Manual terminal management
- Direct command execution
- Simple file operations

✅ **You prefer minimal complexity**
- Single binary deployment
- No additional services
- Straightforward configuration

**Example Use Cases:**
- System administration
- Simple development tasks
- Resource-constrained environments
- Quick terminal sessions

### Use Manager + Orchestrator When:

🤖 **You want AI-powered development assistance**
- Natural language task requests
- Intelligent command routing
- Context-aware suggestions

🔄 **You need multi-agent coordination**
- Complex build processes
- Parallel task execution
- Specialized agent roles (architect, frontend dev, tester)

📊 **You want visual workflow monitoring**
- Real-time agent status in tmux panes
- Swarm progress visualization
- Task dependency tracking

**Example Use Cases:**
- Full-stack development
- Large project management
- Team collaboration
- Complex deployment workflows

## AI Swarm Architecture

When using Manager + Orchestrator, you get access to the **AI Swarm** features:

### Visual Agent Separation
```
┌─────────────────────────────────────────────────────────┐
│                 Swarm Monitor Grid                       │
├─────────────────┬─────────────────┬─────────────────────┤
│ 👑 Architect    │ 💻 Frontend Dev │ 📘 TypeScript      │
│ ✅ Structure    │ 🔄 Building     │ ✅ Types defined   │
│ [tmux pane 1]   │ [tmux pane 2]   │ [tmux pane 3]      │
├─────────────────┼─────────────────┼─────────────────────┤
│ 🧪 Tester       │ 🔨 Builder      │ 📊 Monitor         │
│ ⏳ Waiting...   │ ⏳ Waiting...   │ System metrics     │
│ [tmux pane 4]   │ [tmux pane 5]   │ [tmux pane 6]      │
└─────────────────┴─────────────────┴─────────────────────┘
```

### Natural AI Interaction
```
User: "Build a React app with TypeScript and tests"
  ↓
AI Chat Interface
  ↓
Orchestrator creates specialized agents:
  → Architect (designs structure)
  → Frontend Dev (implements React)
  → TypeScript Expert (adds types)
  → Test Engineer (writes tests)
  → Build Engineer (configures bundling)
  ↓
Manager creates tmux panes for each agent
  ↓
User sees all agents working in real-time
```

## Communication Architecture

### Manager ↔ Orchestrator Bridge

The two components communicate via **JSON-RPC over stdio/socket**:

```rust
// Manager (Rust) - src-tauri/src/bridge/orchestrator_bridge.rs
pub struct OrchestratorBridge {
    rpc_client: JsonRpcClient,
    event_bus: Arc<EventBus>,
}

impl OrchestratorBridge {
    pub async fn create_swarm(&self, task: &str) -> Result<String, OrchflowError> {
        // Request swarm creation from orchestrator
        let result = self.rpc_client.call("swarm.create", json!({
            "task": task,
            "agent_count": 5,
        })).await?;
        
        // Create visual tmux session for swarm
        let swarm_id = result["swarmId"].as_str().unwrap();
        self.create_visual_swarm_session(swarm_id).await?;
        
        Ok(swarm_id.to_string())
    }
}
```

```typescript
// Orchestrator (TypeScript) - orchestrator/src/bridge/manager-bridge.ts
export class ManagerBridge {
    private rpcServer: JsonRpcServer;
    
    constructor(private orchestrator: Orchestrator) {
        this.setupHandlers();
    }
    
    private setupHandlers() {
        this.rpcServer.method('swarm.create', async (params) => {
            const { task, agent_count } = params;
            
            // Create AI swarm
            const swarm = await this.orchestrator.createSwarm(task, {
                agentCount: agent_count,
                roles: ['Architect', 'Frontend Dev', 'TypeScript Expert', 'Test Engineer', 'Build Engineer']
            });
            
            return { swarmId: swarm.id };
        });
    }
}
```

## Deployment Configurations

### 1. Manager Only (Embedded Mode)
```toml
# .orchflow.toml
[orchestrator]
enabled = false

[manager]
mode = "standalone"
features = ["terminals", "files", "plugins", "search"]
```

### 2. Manager + Orchestrator (Sidecar Mode)
```toml
# .orchflow.toml
[orchestrator]
enabled = true
mode = "sidecar"
startup_timeout = 30
bridge_protocol = "stdio"

[manager]
mode = "bridge"
orchestrator_bridge = true

[ai]
enabled = true
default_provider = "claude"
swarm_coordination = true
```

### 3. Orchestrator as Service (Future)
```toml
# .orchflow.toml
[orchestrator]
enabled = true
mode = "service"
service_url = "ws://localhost:3000"
auto_reconnect = true

[manager]
mode = "client"
service_discovery = true
```

## Integration Patterns

### 1. Terminal Creation with AI Context

```typescript
// User requests via AI chat
const userRequest = "Set up a development environment";

// Orchestrator determines needed agents
const agents = await orchestrator.analyzeTask(userRequest);
// Returns: [{ role: 'Frontend Dev', tools: ['node', 'npm'] }]

// Manager creates terminals for each agent
for (const agent of agents) {
    const terminalId = await manager.createTerminal({
        agent_id: agent.id,
        agent_role: agent.role,
        shell: agent.preferredShell,
        working_dir: agent.workingDir,
        tmux_pane_title: agent.role
    });
    
    // Link terminal to agent
    await orchestrator.attachTerminal(agent.id, terminalId);
}
```

### 2. Command Routing

```typescript
// User types command in terminal
const command = "npm test";

// Manager detects command and asks orchestrator for routing
const intent = await orchestrator.parseIntent(command);
// Returns: { purpose: 'test', confidence: 0.95, agentId: 'test-agent-123' }

// Manager routes to appropriate agent terminal
if (intent.confidence > 0.8) {
    await manager.sendToTerminal(intent.agentId, command);
} else {
    await manager.sendToTerminal(activeTerminalId, command);
}
```

## Performance Characteristics

### Manager Performance
- **Startup time**: <100ms
- **Memory usage**: ~10MB base
- **Command latency**: <5ms
- **File operations**: <10ms

### Orchestrator Performance  
- **Agent spawn time**: <20ms (with ruv-FANN)
- **Task routing**: <50ms
- **Swarm coordination**: <100ms for 5 agents
- **Memory per agent**: <5MB

### Combined Performance
- **AI-enhanced startup**: <2 seconds
- **Swarm creation**: <5 seconds
- **Multi-agent coordination**: Sub-second response times

## Migration Path

### From Manager-Only to Manager+Orchestrator

1. **Install orchestrator dependencies**:
   ```bash
   cd orchestrator && npm install
   ```

2. **Update configuration**:
   ```toml
   [orchestrator]
   enabled = true
   mode = "sidecar"
   ```

3. **Restart orchflow**:
   - Manager will automatically spawn orchestrator
   - AI features become available
   - Existing terminals continue working

4. **No code changes required**:
   - All existing functionality preserved
   - AI features added progressively
   - Backwards compatible

## Troubleshooting

### Common Issues

**Manager won't start orchestrator**:
- Check Node.js installation
- Verify orchestrator dependencies
- Review orchestrator logs

**Bridge communication fails**:
- Check JSON-RPC protocol logs
- Verify stdio/socket connectivity
- Restart both components

**AI features not working**:
- Confirm orchestrator is running
- Check AI provider configuration
- Verify API keys and permissions

### Debug Commands

```bash
# Check orchestrator process
ps aux | grep orchestrator

# View bridge communication
tail -f ~/.config/orchflow/bridge.log

# Test JSON-RPC manually
echo '{"jsonrpc":"2.0","method":"swarm.create","params":{"task":"test"},"id":1}' | nc localhost 3000
```

## Future Enhancements

### Planned Features
- **ruv-FANN integration**: Ephemeral neural networks for agent coordination
- **Command adapters**: Support for claude-flow, GPT tools, custom adapters
- **Web deployment**: Orchestrator as shared service across multiple IDEs
- **Advanced scheduling**: Cron-like task automation
- **Metrics dashboard**: Real-time performance monitoring

### Evolution Path
1. **Phase 1**: Current Manager + Orchestrator bridge
2. **Phase 2**: ruv-FANN neural coordination
3. **Phase 3**: Command adapter ecosystem
4. **Phase 4**: Web deployment and multi-tenant support

## Related Documentation

- [ORCHFLOW_UNIFIED_ARCHITECTURE.md](./ORCHFLOW_UNIFIED_ARCHITECTURE.md) - Comprehensive architecture overview
- [COMPONENT_RESPONSIBILITIES.md](./COMPONENT_RESPONSIBILITIES.md) - Detailed component boundaries
- [TERMINAL_MANAGER_ENHANCEMENTS.md](./TERMINAL_MANAGER_ENHANCEMENTS.md) - Implementation roadmap
- [TODO_REPORT.md](./TODO_REPORT.md) - Outstanding implementation tasks

---

*This document serves as a decision guide for choosing between Manager-only and Manager+Orchestrator configurations. For implementation details, see the companion architecture documents.*