# OrchFlow Integration for AI Terminal Orchestrator

## Leveraging OrchFlow for Professional Terminal Management

Since we're building this demo within the OrchFlow project, let's integrate OrchFlow's powerful terminal management capabilities with claude-flow's AI orchestration.

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OrchFlow + Claude-Flow                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OrchFlow Layer:                                                 │
│  - PTY Management (orchflow-terminal)                            │
│  - Session Management (orchflow-core)                            │
│  - Multiplexer Abstraction (orchflow-mux)                        │
│                           ↕                                      │
│  Claude-Flow Layer:                                              │
│  - AI Orchestration                                              │
│  - Memory Management (SQLite)                                    │
│  - Task Coordination                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### 1. OrchFlow Terminal Manager
```rust
// src/ai_orchestrator.rs
use orchflow_terminal::{PtyManager, TerminalStreamManager};
use orchflow_core::{Manager, Action, Event};
use orchflow_mux::{MuxBackend, Session, Pane};
use std::sync::Arc;
use tokio::sync::mpsc;

pub struct AIOrchestrator {
    orchflow_manager: Arc<Manager>,
    pty_manager: Arc<PtyManager>,
    terminal_stream_manager: Arc<TerminalStreamManager>,
    claude_flow_sessions: HashMap<String, ClaudeFlowSession>,
}

struct ClaudeFlowSession {
    session_id: String,
    pty_handle: PtyHandle,
    session_type: SessionType,
    ipc_channel: Arc<dyn IpcChannel>,
}

enum SessionType {
    Primary,      // Main claude-flow swarm
    Orchestrator, // Monitoring terminal
    Worker(String), // Worker terminals with type
}

impl AIOrchestrator {
    pub async fn new(backend: Arc<dyn MuxBackend>) -> Result<Self, Error> {
        let store = Arc::new(MemoryStore::new());
        let state_manager = StateManager::new(store);
        let orchflow_manager = Arc::new(Manager::new(backend, state_manager));
        let pty_manager = Arc::new(PtyManager::new());
        let terminal_stream_manager = Arc::new(TerminalStreamManager::new(
            pty_manager.clone(),
            Arc::new(DirectChannel::new()),
        ));
        
        Ok(Self {
            orchflow_manager,
            pty_manager,
            terminal_stream_manager,
            claude_flow_sessions: HashMap::new(),
        })
    }

    pub async fn start_orchestration(&mut self, task: &str) -> Result<(), Error> {
        // Create OrchFlow session
        let session_action = Action::CreateSession {
            name: format!("ai-orchestration-{}", chrono::Utc::now().timestamp()),
        };
        
        let session_result = self.orchflow_manager.execute_action(session_action).await?;
        let session_id = extract_session_id(session_result)?;
        
        // Create three panes layout
        self.create_layout(&session_id).await?;
        
        // Start primary claude-flow terminal
        self.start_primary_terminal(&session_id, task).await?;
        
        // Start orchestrator monitor
        self.start_orchestrator_terminal(&session_id).await?;
        
        Ok(())
    }

    async fn create_layout(&self, session_id: &str) -> Result<(), Error> {
        // Split horizontally for three panels
        let root_pane = self.get_root_pane(session_id).await?;
        
        // First split: 33% for primary terminal
        let split1 = Action::SplitPane {
            session_id: session_id.to_string(),
            pane_id: root_pane.clone(),
            direction: SplitType::Horizontal,
            size: Some(33),
        };
        self.orchflow_manager.execute_action(split1).await?;
        
        // Second split: 50% of remaining for orchestrator
        let panes = self.get_panes(session_id).await?;
        let second_pane = panes[1].id.clone();
        let split2 = Action::SplitPane {
            session_id: session_id.to_string(),
            pane_id: second_pane,
            direction: SplitType::Horizontal,
            size: Some(50),
        };
        self.orchflow_manager.execute_action(split2).await?;
        
        Ok(())
    }

    async fn start_primary_terminal(&mut self, session_id: &str, task: &str) -> Result<(), Error> {
        // Create PTY for claude-flow
        let env_vars = HashMap::from([
            ("CLAUDE_FLOW_IPC".to_string(), "/tmp/orchflow/ipc".to_string()),
            ("CLAUDE_FLOW_DB".to_string(), "/tmp/orchflow/memory.db".to_string()),
            ("ORCHFLOW_SESSION_ID".to_string(), session_id.to_string()),
        ]);
        
        let pty_handle = self.pty_manager.spawn_pty(
            "claude-flow",
            vec!["swarm", task, "--monitor", "--enable-terminal-spawn"],
            Some(env_vars),
        ).await?;
        
        // Set up output streaming
        let mut output_stream = pty_handle.output_stream();
        let session_id_clone = session_id.to_string();
        let orchestrator = self.clone();
        
        tokio::spawn(async move {
            while let Some(data) = output_stream.next().await {
                // Parse claude-flow output for commands
                if let Some(command) = parse_claude_command(&data) {
                    orchestrator.handle_claude_command(command).await;
                }
                
                // Stream to UI
                orchestrator.stream_to_ui(&session_id_clone, "primary", data).await;
            }
        });
        
        // Store session
        self.claude_flow_sessions.insert(
            "primary".to_string(),
            ClaudeFlowSession {
                session_id: session_id.to_string(),
                pty_handle,
                session_type: SessionType::Primary,
                ipc_channel: Arc::new(DirectChannel::new()),
            },
        );
        
        Ok(())
    }

    async fn handle_claude_command(&self, command: ClaudeCommand) -> Result<(), Error> {
        match command {
            ClaudeCommand::SpawnWorker { worker_type, task } => {
                self.spawn_worker_terminal(&worker_type, &task).await?;
            }
            ClaudeCommand::MemoryStore { key, value } => {
                self.update_shared_memory(&key, &value).await?;
            }
            ClaudeCommand::StatusUpdate { worker_id, status } => {
                self.update_worker_status(&worker_id, &status).await?;
            }
        }
        Ok(())
    }

    async fn spawn_worker_terminal(&mut self, worker_type: &str, task: &str) -> Result<(), Error> {
        let worker_id = format!("{}-{}", worker_type, uuid::Uuid::new_v4());
        
        // Create new pane in workers area
        let workers_pane = self.get_workers_pane().await?;
        let split_action = Action::SplitPane {
            session_id: self.current_session_id.clone(),
            pane_id: workers_pane,
            direction: SplitType::Vertical,
            size: None, // Equal split
        };
        
        let new_pane = self.orchflow_manager.execute_action(split_action).await?;
        
        // Spawn claude-flow worker
        let pty_handle = self.pty_manager.spawn_pty(
            "claude-flow",
            vec!["sparc", "run", worker_type, task, "--worker-id", &worker_id],
            Some(self.get_worker_env(&worker_id)),
        ).await?;
        
        // Store worker session
        self.claude_flow_sessions.insert(
            worker_id.clone(),
            ClaudeFlowSession {
                session_id: self.current_session_id.clone(),
                pty_handle,
                session_type: SessionType::Worker(worker_type.to_string()),
                ipc_channel: Arc::new(DirectChannel::new()),
            },
        );
        
        Ok(())
    }
}
```

### 2. Web UI Integration
```typescript
// frontend/src/OrchFlowTerminalView.tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { useOrchFlowConnection } from './hooks/useOrchFlowConnection';

export const OrchFlowTerminalView: React.FC = () => {
  const { sessions, sendInput, onOutput } = useOrchFlowConnection();
  const terminalsRef = useRef<Map<string, Terminal>>(new Map());

  useEffect(() => {
    // Subscribe to OrchFlow events
    onOutput((sessionId, data) => {
      const terminal = terminalsRef.current.get(sessionId);
      if (terminal) {
        terminal.write(data);
      }
    });
  }, [onOutput]);

  const createTerminalForSession = (sessionId: string, container: HTMLElement) => {
    const terminal = new Terminal({
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
      },
      fontFamily: 'JetBrains Mono, Consolas, monospace',
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    
    terminal.open(container);
    fitAddon.fit();

    terminal.onData(data => {
      sendInput(sessionId, data);
    });

    terminalsRef.current.set(sessionId, terminal);
    return terminal;
  };

  return (
    <div className="orchflow-terminal-grid">
      <div className="primary-terminal">
        <div className="terminal-header">
          <span className="terminal-title">Claude-Flow Primary</span>
          <span className="terminal-status">{sessions.primary?.status}</span>
        </div>
        <div ref={primaryRef} className="terminal-content" />
      </div>

      <div className="orchestrator-terminal">
        <div className="terminal-header">
          <span className="terminal-title">Orchestrator Monitor</span>
        </div>
        <div ref={orchestratorRef} className="terminal-content" />
      </div>

      <div className="workers-area">
        <div className="workers-header">Active Workers</div>
        <div className="workers-grid">
          {sessions.workers?.map(worker => (
            <WorkerTerminal key={worker.id} worker={worker} />
          ))}
        </div>
      </div>
    </div>
  );
};
```

### 3. IPC Bridge
```rust
// src/ipc_bridge.rs
use orchflow_terminal::protocol::{ControlMessage, TerminalOutput};
use tokio::sync::mpsc;
use std::collections::HashMap;

pub struct IPCBridge {
    // OrchFlow channels
    orchflow_tx: mpsc::Sender<ControlMessage>,
    orchflow_rx: mpsc::Receiver<TerminalOutput>,
    
    // Claude-flow IPC
    claude_pipes: HashMap<String, NamedPipe>,
    sqlite_conn: SqliteConnection,
}

impl IPCBridge {
    pub async fn start(&mut self) -> Result<(), Error> {
        // Monitor OrchFlow output for claude commands
        tokio::spawn(async move {
            while let Some(output) = self.orchflow_rx.recv().await {
                if let Some(cmd) = parse_claude_output(&output.data) {
                    self.handle_claude_to_orchflow(cmd).await?;
                }
            }
        });
        
        // Monitor claude-flow IPC
        tokio::spawn(async move {
            while let Some(msg) = self.read_claude_ipc().await {
                self.handle_ipc_to_orchflow(msg).await?;
            }
        });
        
        Ok(())
    }
    
    async fn handle_claude_to_orchflow(&self, cmd: ClaudeCommand) -> Result<(), Error> {
        match cmd {
            ClaudeCommand::SpawnTerminal { config } => {
                // Use OrchFlow to create proper managed terminal
                let action = Action::CreatePane {
                    session_id: config.session_id,
                    command: config.command,
                };
                self.orchflow_tx.send(ControlMessage::ExecuteAction(action)).await?;
            }
            ClaudeCommand::WriteToTerminal { terminal_id, data } => {
                // Route through OrchFlow's terminal management
                self.orchflow_tx.send(ControlMessage::TerminalInput {
                    terminal_id,
                    data: data.into_bytes(),
                }).await?;
            }
        }
        Ok(())
    }
}
```

## Benefits of OrchFlow Integration

1. **Professional PTY Management**: OrchFlow handles all the complex PTY lifecycle
2. **Session Persistence**: Can save/restore entire orchestration sessions
3. **Multiplexer Support**: Works with tmux, screen, or OrchFlow's mock backend
4. **Event-Driven Architecture**: Clean separation of concerns
5. **Resource Management**: Proper cleanup when sessions end
6. **Cross-Platform**: OrchFlow abstracts platform differences

## Running the Integrated Demo

```bash
# 1. Build OrchFlow with AI orchestrator
cd /workspaces/orchflow
cargo build --features ai-orchestrator

# 2. Start the orchestrator
./target/debug/orchflow-ai-demo "Build a REST API"

# 3. OrchFlow will:
#    - Create managed session
#    - Spawn claude-flow in primary terminal
#    - Handle all terminal lifecycle
#    - Coordinate through proper IPC
#    - Display in tmux or web UI
```

This integration provides a production-ready AI terminal orchestrator that combines:
- OrchFlow's robust terminal management
- Claude-flow's AI orchestration capabilities
- Professional session handling
- Clean architecture

The result is a powerful demo that showcases both projects working together seamlessly!