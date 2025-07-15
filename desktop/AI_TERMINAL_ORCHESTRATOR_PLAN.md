# AI Terminal Orchestrator - Extraction Plan

## Vision
Transform OrchFlow's valuable terminal orchestration components into a focused system for AI agents to spawn, control, and coordinate terminal work with human-in-the-loop oversight.

## Phase 1: Core Extraction (The Gold)

### 1.1 Create `orchflow-core` Crate
Extract these components into a standalone Rust crate:

```
orchflow-core/
├── src/
│   ├── terminal_stream/     # Complete terminal I/O streaming
│   ├── manager/            # Event-driven orchestration (stripped down)
│   ├── mux_backend/        # Terminal multiplexer abstraction
│   ├── error/              # Comprehensive error system
│   └── lib.rs             # Clean public API
```

### 1.2 Simplify the Manager
Remove IDE-specific actions, keep only:
- Terminal lifecycle (spawn, kill, restart)
- Session management
- Event broadcasting
- Plugin system (for AI agents)

### 1.3 Create AI-Friendly API
```rust
pub struct Orchestrator {
    // Simplified from Manager
}

impl Orchestrator {
    pub async fn spawn_terminal(&self, agent_id: &str) -> Result<Terminal>;
    pub async fn execute(&self, terminal_id: &str, command: &str) -> Result<Output>;
    pub async fn stream_output(&self, terminal_id: &str) -> OutputStream;
    pub async fn kill_terminal(&self, terminal_id: &str) -> Result<()>;
}
```

## Phase 2: AI Agent Interface

### 2.1 WebSocket API for AI Agents
Revive and simplify the WebSocket server:
```json
{
  "action": "spawn_terminal",
  "agent_id": "gpt-4-worker-1",
  "capabilities": ["read", "write", "execute"]
}
```

### 2.2 REST API Alternative
```
POST /api/terminals
GET  /api/terminals/{id}/output
POST /api/terminals/{id}/input
DELETE /api/terminals/{id}
```

### 2.3 Event Streaming
Server-Sent Events for real-time output:
```
GET /api/terminals/{id}/stream
```

## Phase 3: Minimal UI for Human Oversight

### 3.1 Terminal Grid View
Just the essentials:
```svelte
<TerminalGrid>
  {#each terminals as terminal}
    <StreamingTerminal 
      id={terminal.id}
      agentId={terminal.agentId}
      status={terminal.status}
    />
  {/each}
</TerminalGrid>
```

### 3.2 Agent Dashboard
```svelte
<AgentDashboard>
  <ActiveAgents />
  <TerminalMetrics />
  <SecurityAlerts />
</AgentDashboard>
```

### 3.3 Human Controls
- Pause/resume agent
- Kill runaway processes
- Approve sensitive operations
- View agent intentions

## Phase 4: Security & Sandboxing

### 4.1 Terminal Security
- Resource limits per agent
- Command whitelisting
- Filesystem restrictions
- Network isolation options

### 4.2 Audit Trail
```rust
pub struct AuditEntry {
    agent_id: String,
    terminal_id: String,
    command: String,
    timestamp: DateTime<Utc>,
    approved_by: Option<String>,
}
```

## Implementation Steps

### Week 1: Core Extraction
1. Create new `orchflow-core` crate
2. Copy terminal_stream module
3. Extract minimal Manager without IDE features
4. Clean up dependencies

### Week 2: API Layer
1. Implement Orchestrator API
2. Create WebSocket server for agents
3. Add REST endpoints
4. Set up SSE streaming

### Week 3: Minimal UI
1. Strip current UI to essentials
2. Implement TerminalGrid
3. Create AgentDashboard
4. Add human oversight controls

### Week 4: Testing & Documentation
1. Integration tests with mock AI agents
2. API documentation
3. Example AI agent implementations
4. Security guidelines

## Example Usage

### AI Agent Connection
```python
# AI agent code
import websocket
import json

ws = websocket.WebSocket()
ws.connect("ws://localhost:7777")

# Spawn a terminal
ws.send(json.dumps({
    "action": "spawn_terminal",
    "agent_id": "researcher-1"
}))

# Execute command
ws.send(json.dumps({
    "action": "execute",
    "terminal_id": "term-123",
    "command": "git clone https://github.com/user/repo"
}))

# Stream output
# ... handle streaming responses
```

### Human Oversight UI
```typescript
// Minimal UI for monitoring
<script>
  import { terminals$ } from '$lib/stores/orchestrator';
  
  $: activeTerminals = $terminals$.filter(t => t.active);
</script>

<div class="orchestrator-view">
  <header>
    <h1>AI Terminal Orchestrator</h1>
    <span>{activeTerminals.length} active agents</span>
  </header>
  
  <TerminalGrid terminals={activeTerminals} />
  
  <ControlPanel>
    <button on:click={pauseAll}>Pause All</button>
    <button on:click={killAll}>Emergency Stop</button>
  </ControlPanel>
</div>
```

## Success Metrics

1. **Simplicity**: < 10k LOC (vs current 100k+)
2. **Performance**: Handle 100+ concurrent terminals
3. **Latency**: < 10ms command execution
4. **Security**: Zero unauthorized operations
5. **Reliability**: 99.9% uptime for long-running agents

## What Gets Removed

- All IDE features (file explorer, editors, git UI)
- Complex UI components
- Tab management
- Plugin marketplace
- Theme system
- Most Tauri commands (keep ~20 core ones)

## What Stays Pure

- Terminal orchestration
- Event-driven architecture  
- Security monitoring
- Human oversight
- AI agent interface

This plan focuses on extracting the 20% of your codebase that provides 80% of the value for AI terminal orchestration.