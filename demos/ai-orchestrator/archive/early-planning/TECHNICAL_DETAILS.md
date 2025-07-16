# Technical Architecture Details

This document provides a deep dive into the AI Terminal Orchestrator implementation.

## System Components

### 1. OrchFlow Integration

The demo leverages OrchFlow's production-ready crates:

```rust
// Using OrchFlow's tmux backend
use orchflow_mux::{TmuxBackend, MuxBackend, SplitType};
use orchflow_core::{Manager, StateManager};
use orchflow_terminal::{PtyManager};
```

**Key Benefits:**
- Professional tmux session management
- Proper PTY lifecycle handling
- Event-driven architecture
- Resource cleanup

### 2. Communication Architecture

```
┌─────────────┐     Unix      ┌──────────────┐     Tmux      ┌─────────────┐
│Claude-Code  │────Socket────▶│ Orchestrator │────Panes─────▶│  Workers    │
│(Primary)    │               │   (Rust)     │               │(Claude-Flow)│
└─────────────┘               └──────────────┘               └─────────────┘
      │                              │                              │
      └──────────── Keyword ─────────┘                              │
                   Detection                                        │
                                                                   │
      ┌────────────────── Status Updates ──────────────────────────┘
      ▼
┌─────────────┐
│   User UI   │
└─────────────┘
```

### 3. Orchestrator State Machine

```rust
pub struct AIOrchestrator {
    // Core OrchFlow components
    manager: Arc<Manager>,
    backend: Arc<TmuxBackend>,
    
    // Session management
    session_id: String,
    primary_pane: String,
    orchestrator_pane: String,
    worker_panes: Vec<String>,
    
    // Worker tracking
    workers: HashMap<String, WorkerInfo>,
}

pub enum WorkerStatus {
    Running,
    Complete,
    Failed,
}
```

### 4. Worker Planning Algorithm

The orchestrator analyzes tasks and spawns appropriate workers:

```rust
fn plan_workers(task: &str) -> Vec<WorkerPlan> {
    let task_lower = task.to_lowercase();
    let mut workers = vec![];
    
    // Pattern matching for worker types
    if task_lower.contains("api") || task_lower.contains("rest") {
        workers.push(WorkerPlan {
            name: "API-Designer",
            worker_type: "sparc",  // SPARC mode for architecture
            task: format!("Design REST API architecture for: {}", task),
        });
    }
    
    // Add specialized workers based on keywords
    if task_lower.contains("auth") {
        workers.push(WorkerPlan {
            name: "Auth-System",
            worker_type: "swarm",  // Full swarm for complex auth
            task: format!("Build authentication system for: {}", task),
        });
    }
    
    // Always add testing
    if !workers.is_empty() {
        workers.push(WorkerPlan {
            name: "Test-Engineer",
            worker_type: "sparc",
            task: format!("Write tests for: {}", task),
        });
    }
    
    workers
}
```

### 5. Claude-Code Monitoring

The monitoring script uses pattern matching to detect orchestration intent:

```javascript
const orchestrationKeywords = [
    'orchestrate',
    'coordinate', 
    'delegate',
    'I\'ll have the team',
    'Let me coordinate'
];

// Also supports explicit markers
const explicitMatch = output.match(/\[ORCHESTRATE\]\s*({.*?})/s);
```

### 6. Tmux Layout Management

Dynamic pane creation with proper sizing:

```rust
pub async fn spawn_worker(&mut self, worker_type: &str, task: &str, worker_name: &str) {
    // Get current layout
    let last_pane = self.worker_panes.last().unwrap().clone();
    
    // Split for new worker (vertical split for side-by-side)
    let new_pane = self.backend.split_pane(
        &self.session_id,
        &last_pane,
        SplitType::Vertical,
        None  // Equal split
    ).await?;
    
    // Track new pane
    self.worker_panes.push(new_pane.id.clone());
    
    // Set descriptive title
    self.backend.run_command(&format!(
        "tmux select-pane -t {}:{} -T '{}'"
    , &self.session_id, &new_pane.id, worker_name)).await?;
}
```

## Performance Considerations

### Resource Management
- Each worker runs in its own process
- Tmux provides natural isolation
- OrchFlow handles cleanup on exit

### Scaling Limits
- Practical limit: 6-8 visible panes
- Solution: Dashboard for many workers
- Future: Web UI for unlimited scale

### Communication Overhead
- Unix sockets: ~0.1ms latency
- Tmux commands: ~5-10ms
- Acceptable for orchestration use case

## Security Considerations

1. **Unix Socket Permissions**
   - Created with user-only access
   - Cleaned up on exit
   - No network exposure

2. **Process Isolation**
   - Each worker in separate process
   - Tmux provides additional isolation
   - No shared memory between workers

3. **Input Validation**
   - Task strings are sanitized
   - JSON parsing with error handling
   - Command injection prevention

## Error Handling

The system handles failures gracefully:

1. **Missing Dependencies**
   - Falls back to mock mode
   - Clear error messages
   - Continues with available features

2. **Worker Failures**
   - Logged in orchestrator
   - Doesn't affect other workers
   - User notified of issues

3. **Communication Errors**
   - Automatic reconnection attempts
   - Buffered messages
   - Timeout handling

## Extension Points

### Adding New Worker Types

1. Edit `plan_workers` function:
```rust
if task_lower.contains("frontend") {
    workers.push(WorkerPlan {
        name: "Frontend-Dev",
        worker_type: "sparc",
        task: "Build UI components",
    });
}
```

2. Configure Claude-Flow mode:
- `task`: Simple single task
- `sparc`: Specialized mode
- `swarm`: Full hive-mind

### Custom Communication Protocols

Replace Unix sockets with:
- TCP sockets for remote orchestration
- gRPC for structured communication
- Message queues for async patterns

### Alternative Frontends

The orchestrator is frontend-agnostic:
- Web UI with xterm.js
- Native GUI with egui
- CLI with different layouts

## Debugging Tips

### Enable Verbose Logging
```bash
RUST_LOG=debug cargo run --bin orchflow-orchestrator
```

### Monitor Tmux Events
```bash
tmux pipe-pane -t ai-orchestrator:0 'cat >> /tmp/claude.log'
```

### Test Without AI
Use the mock mode in quickstart.sh to test the orchestration flow without API keys.

## Future Enhancements

1. **Smart Worker Management**
   - Priority-based pane allocation
   - Background worker support
   - Worker pooling

2. **Enhanced Monitoring**
   - Real-time progress tracking
   - Resource usage metrics
   - Performance analytics

3. **Advanced Orchestration**
   - Dependency graphs
   - Parallel execution plans
   - Failure recovery strategies