# OrchFlow AI Orchestrator Demo

## Concept

A working demo that leverages OrchFlow's terminal management capabilities to create an AI-powered development environment where:
- **Claude-Code** acts as the primary interface
- **Orchestrator** manages task distribution using OrchFlow
- **Worker terminals** execute tasks via claude-flow

## OrchFlow Integration Points

### 1. Using OrchFlow-Terminal for PTY Management
```rust
// Each terminal (claude-code, orchestrator, workers) is managed by OrchFlow
use orchflow_terminal::{PtyManager, TerminalStreamManager};
use orchflow_core::{Manager, Action};
use orchflow_mux::MockBackend;

// Create terminals through OrchFlow
let claude_terminal = pty_manager.spawn_terminal("claude-code", vec![])?;
let orch_terminal = pty_manager.spawn_terminal("node", vec!["orchestrator.js"])?;
```

### 2. Using OrchFlow-Core for Session Management
```rust
// Manage the entire orchestration session
let manager = Manager::new(backend, state_manager);

// Create orchestration session
manager.execute_action(Action::CreateSession {
    name: "ai-orchestration".to_string(),
}).await?;

// Create panes for each terminal type
manager.execute_action(Action::SplitPane {
    session_id,
    pane_id: root_pane,
    direction: SplitType::Horizontal,
    size: Some(33), // 33% for claude-code
}).await?;
```

### 3. Inter-Terminal Communication via OrchFlow Events
```rust
// OrchFlow's event system handles communication
use orchflow_core::Event;

// When claude-code outputs a command
Event::TerminalOutput {
    terminal_id: "claude-code",
    data: r#"{"action":"orchestrate","task":"Build API"}"#,
}

// OrchFlow routes it to orchestrator
Event::SendToTerminal {
    terminal_id: "orchestrator",
    data: command,
}
```

## Practical Demo Implementation

### Directory Structure
```
demos/orchflow-ai-demo/
├── src/
│   ├── main.rs              # OrchFlow demo runner
│   ├── orchestrator.rs      # Orchestration logic
│   └── terminal_manager.rs  # Terminal lifecycle management
├── scripts/
│   ├── claude-proxy.js      # Intercepts claude-code output
│   └── worker-wrapper.sh    # Wraps claude-flow workers
├── Cargo.toml
└── README.md
```

### main.rs - Demo Runner
```rust
use orchflow_core::{Manager, StateManager, storage::MemoryStore};
use orchflow_mux::MockBackend;
use orchflow_terminal::PtyManager;
use std::sync::Arc;
use tokio::sync::mpsc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize OrchFlow
    let store = Arc::new(MemoryStore::new());
    let state_manager = StateManager::new(store);
    let backend = Arc::new(MockBackend::new());
    let manager = Manager::new(backend.clone(), state_manager);
    
    // Create PTY manager
    let pty_manager = Arc::new(PtyManager::new());
    
    // Create communication channels
    let (tx, mut rx) = mpsc::channel(100);
    
    // Spawn claude-code terminal with proxy
    let claude_pty = pty_manager.spawn_pty(
        "node",
        vec!["scripts/claude-proxy.js"],
        None,
    ).await?;
    
    // Spawn orchestrator terminal
    let orch_pty = pty_manager.spawn_pty(
        "cargo",
        vec!["run", "--bin", "orchestrator"],
        None,
    ).await?;
    
    // Handle communication between terminals
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            match msg {
                Message::ClaudeCommand(cmd) => {
                    // Send to orchestrator
                    orch_pty.write(cmd.as_bytes()).await?;
                },
                Message::SpawnWorker(agent_type, task) => {
                    // Spawn new worker terminal
                    let worker_pty = pty_manager.spawn_pty(
                        "scripts/worker-wrapper.sh",
                        vec![&agent_type, &task],
                        None,
                    ).await?;
                }
            }
        }
    });
    
    // Keep running
    tokio::signal::ctrl_c().await?;
    Ok(())
}
```

### claude-proxy.js - Intercepts Claude Output
```javascript
const { spawn } = require('child_process');
const readline = require('readline');

// Spawn claude-code
const claude = spawn('claude-code', ['--no-color']);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Proxy stdin to claude
rl.on('line', (input) => {
  claude.stdin.write(input + '\n');
});

// Process claude output
claude.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(output);
  
  // Look for orchestration commands
  const match = output.match(/ORCHESTRATE:\s*({.*})/);
  if (match) {
    try {
      const command = JSON.parse(match[1]);
      // Send to OrchFlow via IPC
      process.send({ type: 'orchestrate', command });
    } catch (e) {
      console.error('Failed to parse command:', e);
    }
  }
});
```

### Orchestrator Logic
```rust
// orchestrator.rs
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
struct OrchestrationCommand {
    task: String,
    agents: Vec<String>,
}

pub async fn run_orchestrator(
    pty_manager: Arc<PtyManager>,
    tx: mpsc::Sender<Message>,
) -> Result<(), Box<dyn std::error::Error>> {
    // Read commands from stdin
    let stdin = tokio::io::stdin();
    let reader = BufReader::new(stdin);
    let mut lines = reader.lines();
    
    while let Some(line) = lines.next_line().await? {
        if let Ok(cmd) = serde_json::from_str::<OrchestrationCommand>(&line) {
            println!("[ORCHESTRATOR] Received task: {}", cmd.task);
            
            // Spawn workers
            for agent in cmd.agents {
                println!("[ORCHESTRATOR] Spawning {}", agent);
                tx.send(Message::SpawnWorker(
                    agent.clone(),
                    cmd.task.clone()
                )).await?;
            }
        }
    }
    
    Ok(())
}
```

### Demo Usage

1. **Start the Demo**
```bash
cd demos/orchflow-ai-demo
cargo run
```

2. **Three Terminals Appear**
- Left: Claude-Code interface
- Middle: Orchestrator status
- Right: Worker terminals (dynamically created)

3. **User Interaction**
```
[Claude-Code Terminal]
> Build a REST API with authentication

Claude: I'll help you build a REST API. Let me break this down into tasks...

To orchestrate this work, I'll deploy specialized agents:
ORCHESTRATE: {"task":"Build REST API with auth","agents":["architect","backend-dev","auth-specialist","tester"]}

The agents are now working on your API...
```

4. **Orchestrator Shows**
```
[ORCHESTRATOR] Received task: Build REST API with auth
[ORCHESTRATOR] Spawning architect
[ORCHESTRATOR] Spawning backend-dev
[ORCHESTRATOR] Spawning auth-specialist
[ORCHESTRATOR] Spawning tester
[ORCHESTRATOR] Monitoring progress...
```

5. **Workers Execute**
```
[Worker: architect]
Running claude-flow SPARC architect mode...
Designing API structure...
✓ Created API specification

[Worker: backend-dev]
Implementing endpoints...
✓ REST routes complete
```

## Key Benefits of OrchFlow Integration

1. **Professional Terminal Management**: Real PTY handling, not just process spawning
2. **Session Persistence**: Can save/restore orchestration sessions
3. **Event-Driven Architecture**: Clean communication between components
4. **Resource Management**: Proper cleanup when terminals complete
5. **Multiplexer Abstraction**: Can use tmux backend for production

## Simplified Communication Flow

```
User Input → Claude-Code → [Proxy detects ORCHESTRATE command] → 
    ↓
OrchFlow Event System
    ↓
Orchestrator Terminal → [Parses command] → Spawns Workers via OrchFlow
    ↓
Worker Terminals → [Execute via claude-flow] → Report completion
    ↓
Orchestrator → [Aggregates results] → Updates Claude-Code
```

## Next Steps

1. Implement the basic demo with mock terminals
2. Add real claude-code integration
3. Create worker status dashboard
4. Add result aggregation
5. Package as standalone demo

This approach leverages OrchFlow's strengths while keeping the demo focused and practical.