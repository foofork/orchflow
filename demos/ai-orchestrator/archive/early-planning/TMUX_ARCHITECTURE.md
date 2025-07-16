# AI Orchestrator with OrchFlow Tmux Integration

## Architecture Using OrchFlow's Tmux Backend

Since we're using OrchFlow's tmux integration, we can create a much cleaner solution that manages all terminals within a single tmux session.

## Visual Layout (Tmux)

```
┌─────────────────────────────────────────────────────────────────┐
│                    tmux: ai-orchestrator                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Pane 0: Primary  │ Pane 1: Orch     │ Pane 2-N: Workers         │
│ (claude-code)    │ (orchestrator)   │ (claude-flow)             │
├──────────────────┼──────────────────┼───────────────────────────┤
│                  │                  │ ┌─────────────────────┐   │
│ $ claude-code    │ $ orchestrator   │ │ Pane 2: API Worker  │   │
│                  │                  │ │ $ claude-flow task  │   │
│ > Build REST API │ [LISTENING]      │ │   "create routes"   │   │
│                  │                  │ └─────────────────────┘   │
│ Claude: I'll     │ [RECEIVED] Task  │                           │
│ orchestrate...   │                  │ ┌─────────────────────┐   │
│                  │ [SPAWNING] via   │ │ Pane 3: Auth Worker │   │
│ [ORCHESTRATE]    │ OrchFlow tmux    │ │ $ claude-flow swarm │   │
│ {"task":"API"}   │                  │ │   "auth system"     │   │
│                  │ Workers: 3       │ └─────────────────────┘   │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## Implementation with OrchFlow Crates

### 1. Rust Backend using OrchFlow

```rust
// src/orchestrator.rs
use orchflow_core::{Manager, Action, Event};
use orchflow_mux::{TmuxBackend, MuxBackend, Session, Pane, SplitType};
use orchflow_terminal::{PtyManager, TerminalStreamManager};
use std::sync::Arc;
use tokio::sync::mpsc;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct OrchestrationCommand {
    task: String,
    timestamp: u64,
}

pub struct AIOrchestrator {
    manager: Arc<Manager>,
    backend: Arc<TmuxBackend>,
    session_id: String,
    primary_pane: String,
    orchestrator_pane: String,
    worker_panes: Vec<String>,
}

impl AIOrchestrator {
    pub async fn new() -> Result<Self, Box<dyn std::error::Error>> {
        // Create OrchFlow components
        let backend = Arc::new(TmuxBackend::new());
        let store = Arc::new(orchflow_core::storage::MemoryStore::new());
        let state_manager = orchflow_core::state::StateManager::new(store);
        let manager = Arc::new(Manager::new(backend.clone(), state_manager));
        
        // Create tmux session
        let session_name = "ai-orchestrator";
        backend.create_session(session_name).await?;
        
        // Get root pane
        let session = backend.get_session(session_name).await?;
        let root_pane = session.panes[0].id.clone();
        
        // Split for orchestrator (33% | 67%)
        let split1 = backend.split_pane(
            &session.id,
            &root_pane,
            SplitType::Horizontal,
            Some(33)
        ).await?;
        
        // Split right pane for orchestrator vs workers (50% | 50%)
        let split2 = backend.split_pane(
            &session.id,
            &split1.id,
            SplitType::Horizontal,
            Some(50)
        ).await?;
        
        Ok(Self {
            manager,
            backend,
            session_id: session.id.clone(),
            primary_pane: root_pane,
            orchestrator_pane: split1.id,
            worker_panes: vec![split2.id],
        })
    }
    
    pub async fn start(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        // Start claude-code in primary pane
        self.start_primary_terminal().await?;
        
        // Start orchestrator in middle pane
        self.start_orchestrator().await?;
        
        // Attach to tmux session
        self.backend.attach_session(&self.session_id).await?;
        
        Ok(())
    }
    
    async fn start_primary_terminal(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Run claude-code with monitoring wrapper
        let command = "node /path/to/claude-monitor.js";
        self.backend.send_keys(&self.session_id, &self.primary_pane, command).await?;
        self.backend.send_keys(&self.session_id, &self.primary_pane, "Enter").await?;
        Ok(())
    }
    
    async fn start_orchestrator(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Run the orchestrator
        let command = "./target/debug/orchflow-orchestrator";
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, command).await?;
        self.backend.send_keys(&self.session_id, &self.orchestrator_pane, "Enter").await?;
        Ok(())
    }
    
    pub async fn spawn_worker(
        &mut self,
        worker_type: &str,
        task: &str
    ) -> Result<String, Box<dyn std::error::Error>> {
        // Get the last worker pane
        let last_worker_pane = self.worker_panes.last().unwrap();
        
        // Split it for new worker
        let new_pane = self.backend.split_pane(
            &self.session_id,
            last_worker_pane,
            SplitType::Vertical,
            None // Equal split
        ).await?;
        
        self.worker_panes.push(new_pane.id.clone());
        
        // Run claude-flow in new pane
        let command = match worker_type {
            "simple" => format!("claude-flow task \"{}\"", task),
            "sparc" => format!("claude-flow sparc run developer \"{}\"", task),
            "swarm" => format!("claude-flow swarm \"{}\" --max-agents 3", task),
            _ => format!("claude-flow task \"{}\"", task),
        };
        
        self.backend.send_keys(&self.session_id, &new_pane.id, &command).await?;
        self.backend.send_keys(&self.session_id, &new_pane.id, "Enter").await?;
        
        Ok(new_pane.id)
    }
}
```

### 2. Orchestrator Binary

```rust
// src/bin/orchestrator.rs
use tokio::net::UnixListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use serde_json;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("=== OrchFlow Orchestrator ===");
    println!("[LISTENING] Waiting for tasks...\n");
    
    // Create orchestrator instance
    let orchestrator = Arc::new(Mutex::new(
        orchflow_demo::AIOrchestrator::new().await?
    ));
    
    // Listen on Unix socket
    let listener = UnixListener::bind("/tmp/orchestrator.sock")?;
    
    loop {
        let (mut stream, _) = listener.accept().await?;
        let orchestrator = orchestrator.clone();
        
        tokio::spawn(async move {
            let mut buf = vec![0; 1024];
            match stream.read(&mut buf).await {
                Ok(n) => {
                    let command: OrchestrationCommand = 
                        serde_json::from_slice(&buf[..n]).unwrap();
                    
                    println!("[RECEIVED] Task: {}", command.task);
                    
                    // Plan workers
                    let workers = plan_workers(&command.task);
                    println!("[SPAWNING] {} workers via OrchFlow tmux", workers.len());
                    
                    // Spawn workers
                    let mut orch = orchestrator.lock().await;
                    for worker in workers {
                        match orch.spawn_worker(&worker.worker_type, &worker.task).await {
                            Ok(pane_id) => {
                                println!("[SPAWNED] {} in pane {}", worker.name, pane_id);
                            }
                            Err(e) => {
                                println!("[ERROR] Failed to spawn {}: {}", worker.name, e);
                            }
                        }
                    }
                }
                Err(e) => println!("[ERROR] Failed to read command: {}", e),
            }
        });
    }
}

fn plan_workers(task: &str) -> Vec<WorkerPlan> {
    let mut workers = vec![];
    let task_lower = task.to_lowercase();
    
    if task_lower.contains("api") || task_lower.contains("rest") {
        workers.push(WorkerPlan {
            name: "api-routes".to_string(),
            worker_type: "sparc".to_string(),
            task: format!("Design and implement REST API routes for: {}", task),
        });
    }
    
    if task_lower.contains("auth") {
        workers.push(WorkerPlan {
            name: "auth-system".to_string(),
            worker_type: "swarm".to_string(),
            task: format!("Build complete authentication system for: {}", task),
        });
    }
    
    if task_lower.contains("test") || !workers.is_empty() {
        workers.push(WorkerPlan {
            name: "testing".to_string(),
            worker_type: "sparc".to_string(),
            task: format!("Write comprehensive tests for: {}", task),
        });
    }
    
    workers
}
```

### 3. Node.js Claude Monitor (same as before but simplified)

```javascript
// claude-monitor.js
const { spawn } = require('child_process');
const net = require('net');

const claude = spawn('claude-code', process.argv.slice(2), {
  stdio: ['inherit', 'pipe', 'inherit']
});

claude.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);
  
  // Look for [ORCHESTRATE] command
  const match = output.match(/\[ORCHESTRATE\]\s*({.*})/);
  if (match) {
    try {
      const command = JSON.parse(match[1]);
      
      // Send to orchestrator via Unix socket
      const client = net.createConnection('/tmp/orchestrator.sock', () => {
        client.write(JSON.stringify({
          task: command.task,
          timestamp: Date.now()
        }));
        client.end();
      });
      
      console.log('\n[SENT TO ORCHESTRATOR]\n');
    } catch (e) {
      console.error('Failed to parse orchestration command');
    }
  }
});
```

### 4. Cargo.toml additions

```toml
[package]
name = "orchflow-ai-demo"
version = "0.1.0"
edition = "2021"

[dependencies]
orchflow-core = { path = "../../crates/orchflow-core" }
orchflow-mux = { path = "../../crates/orchflow-mux" }
orchflow-terminal = { path = "../../crates/orchflow-terminal" }
tokio = { version = "1.46", features = ["full"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
clap = "4.0"

[[bin]]
name = "orchflow-orchestrator"
path = "src/bin/orchestrator.rs"

[[bin]]
name = "orchflow-ai-demo"
path = "src/main.rs"
```

### 5. Running the Demo

```bash
# Build the demo
cd /workspaces/orchflow/demos/ai-orchestrator
cargo build

# Start tmux session with everything
cargo run --bin orchflow-ai-demo

# This will:
# 1. Create tmux session "ai-orchestrator"
# 2. Split into 3 panes (primary | orchestrator | workers)
# 3. Start claude-code in primary
# 4. Start orchestrator in middle
# 5. Attach you to the session
```

## Benefits of Tmux Integration

1. **Single Window**: Everything in one tmux session
2. **Professional**: Uses OrchFlow's production-ready tmux backend
3. **Clean Management**: OrchFlow handles all pane lifecycle
4. **Easy Navigation**: Tmux keybindings to switch between panes
5. **Persistent**: Can detach and reattach to session
6. **Scriptable**: Can automate layouts and workflows

## Tmux Commands for Users

Once in the session:
- `Ctrl-b →/←/↑/↓` - Navigate between panes
- `Ctrl-b z` - Zoom current pane
- `Ctrl-b d` - Detach from session
- `tmux attach -t ai-orchestrator` - Reattach

## Extended Features

1. **Status Bar**: Could add tmux status showing worker count
2. **Pane Titles**: Set pane titles to show worker types
3. **Layout Presets**: Save/restore common layouts
4. **Session Recording**: Use tmux logging
5. **Remote Access**: SSH + tmux for remote orchestration

This approach leverages OrchFlow's tmux integration for a professional, integrated experience!