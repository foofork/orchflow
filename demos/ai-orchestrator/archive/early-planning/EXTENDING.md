# Extending the AI Terminal Orchestrator

This guide shows how to extend and customize the demo for your needs.

## Adding New Worker Types

### 1. Define Worker Patterns

Edit `src/bin/orchestrator.rs` to add new worker types:

```rust
fn plan_workers(task: &str) -> Vec<WorkerPlan> {
    let task_lower = task.to_lowercase();
    let mut workers = vec![];
    
    // Add your custom worker types
    if task_lower.contains("mobile") || task_lower.contains("app") {
        workers.push(WorkerPlan {
            name: "Mobile-Dev",
            worker_type: "sparc",
            task: format!("Develop mobile app for: {}", task),
        });
        
        workers.push(WorkerPlan {
            name: "UI-Designer", 
            worker_type: "task",
            task: "Design mobile UI/UX",
        });
    }
    
    if task_lower.contains("blockchain") || task_lower.contains("web3") {
        workers.push(WorkerPlan {
            name: "Blockchain-Expert",
            worker_type: "swarm",  // Complex topic needs swarm
            task: format!("Implement blockchain features for: {}", task),
        });
    }
    
    // Existing worker logic...
}
```

### 2. Create Specialized Claude-Flow Modes

Create custom SPARC modes for your domain:

```bash
# Create a new SPARC mode configuration
claude-flow sparc create mobile-expert --template developer

# Edit the configuration
claude-flow sparc edit mobile-expert
```

## Customizing the Orchestration Logic

### 1. Priority-Based Worker Spawning

```rust
#[derive(Debug)]
pub struct WorkerPlan {
    name: String,
    worker_type: String,
    task: String,
    priority: Priority,  // Add priority field
}

#[derive(Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Priority {
    Low,
    Medium,
    High,
    Critical,
}

impl AIOrchestrator {
    pub async fn spawn_workers_by_priority(&mut self, mut workers: Vec<WorkerPlan>) {
        // Sort by priority
        workers.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        for worker in workers {
            if self.worker_panes.len() >= 6 && worker.priority < Priority::High {
                // Run lower priority workers in background
                self.spawn_background_worker(worker).await?;
            } else {
                self.spawn_worker(&worker.worker_type, &worker.task, &worker.name).await?;
            }
        }
    }
}
```

### 2. Dynamic Worker Allocation

```rust
impl AIOrchestrator {
    pub async fn allocate_worker_intelligently(&mut self, task: &str) {
        // Analyze current workload
        let active_workers = self.get_active_workers();
        let available_slots = 6 - active_workers.len();
        
        // Get resource usage
        let cpu_usage = self.get_system_cpu_usage();
        let memory_available = self.get_available_memory();
        
        // Decide worker strategy
        let strategy = if cpu_usage > 80.0 {
            WorkerStrategy::Sequential
        } else if memory_available < 1024 {  // 1GB
            WorkerStrategy::Lightweight
        } else {
            WorkerStrategy::Parallel
        };
        
        // Spawn workers based on strategy
        match strategy {
            WorkerStrategy::Parallel => {
                // Spawn all workers at once
            }
            WorkerStrategy::Sequential => {
                // Queue workers, spawn one at a time
            }
            WorkerStrategy::Lightweight => {
                // Use task mode instead of swarm mode
            }
        }
    }
}
```

## Adding Communication Channels

### 1. WebSocket Integration

Replace Unix sockets with WebSocket for remote access:

```rust
use tokio_tungstenite::{accept_async, tungstenite::Message};

pub struct WebSocketOrchestrator {
    listener: TcpListener,
    orchestrator: Arc<Mutex<AIOrchestrator>>,
}

impl WebSocketOrchestrator {
    pub async fn start(&self) {
        while let Ok((stream, _)) = self.listener.accept().await {
            let ws_stream = accept_async(stream).await?;
            let (write, read) = ws_stream.split();
            
            // Handle WebSocket messages
            read.for_each(|msg| async {
                if let Ok(Message::Text(text)) = msg {
                    let command: OrchestrationCommand = serde_json::from_str(&text)?;
                    self.handle_command(command).await;
                }
            }).await;
        }
    }
}
```

### 2. gRPC Service

For structured communication:

```proto
// orchestrator.proto
syntax = "proto3";

service Orchestrator {
    rpc SubmitTask(TaskRequest) returns (TaskResponse);
    rpc GetStatus(StatusRequest) returns (StatusResponse);
    rpc StreamUpdates(StreamRequest) returns (stream Update);
}

message TaskRequest {
    string task = 1;
    repeated string tags = 2;
    Priority priority = 3;
}
```

## UI Enhancements

### 1. Rich Terminal Dashboard

Using `ratatui` for a TUI dashboard:

```rust
use ratatui::{
    layout::{Constraint, Direction, Layout},
    widgets::{Block, Borders, Gauge, List, ListItem},
    Terminal,
};

pub struct Dashboard {
    terminal: Terminal<CrosstermBackend<Stdout>>,
    workers: Vec<WorkerInfo>,
}

impl Dashboard {
    pub fn draw(&mut self) -> Result<()> {
        self.terminal.draw(|f| {
            let chunks = Layout::default()
                .direction(Direction::Vertical)
                .constraints([
                    Constraint::Length(3),     // Header
                    Constraint::Min(10),       // Worker list
                    Constraint::Length(3),     // Progress
                ].as_ref())
                .split(f.size());
            
            // Draw worker list
            let workers: Vec<ListItem> = self.workers
                .iter()
                .map(|w| {
                    let status = match w.status {
                        WorkerStatus::Running => "🟡",
                        WorkerStatus::Complete => "🟢",
                        WorkerStatus::Failed => "🔴",
                    };
                    ListItem::new(format!("{} {} - {}", status, w.name, w.task))
                })
                .collect();
            
            let worker_list = List::new(workers)
                .block(Block::default().borders(Borders::ALL).title("Workers"));
            
            f.render_widget(worker_list, chunks[1]);
            
            // Draw progress bar
            let progress = self.calculate_overall_progress();
            let gauge = Gauge::default()
                .block(Block::default().borders(Borders::ALL).title("Progress"))
                .gauge_style(Style::default().fg(Color::Green))
                .percent(progress);
            
            f.render_widget(gauge, chunks[2]);
        })?;
        
        Ok(())
    }
}
```

### 2. Web UI Alternative

Create a web interface using OrchFlow's capabilities:

```typescript
// frontend/src/OrchestratorUI.tsx
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';

export const OrchestratorUI: React.FC = () => {
    const [workers, setWorkers] = useState<Worker[]>([]);
    const ws = useWebSocket('ws://localhost:8080/orchestrator');
    
    useEffect(() => {
        ws.on('worker-spawned', (worker) => {
            setWorkers(prev => [...prev, worker]);
        });
        
        ws.on('worker-update', (update) => {
            setWorkers(prev => prev.map(w => 
                w.id === update.id ? { ...w, ...update } : w
            ));
        });
    }, []);
    
    return (
        <div className="orchestrator-ui">
            <ChatPanel onSubmit={task => ws.send({ type: 'submit', task })} />
            <WorkerGrid workers={workers} />
            <StatusPanel workers={workers} />
        </div>
    );
};
```

## Integration Examples

### 1. CI/CD Integration

```yaml
# .github/workflows/ai-orchestration.yml
name: AI-Assisted Development

on:
  issue_comment:
    types: [created]

jobs:
  orchestrate:
    if: contains(github.event.comment.body, '/ai-build')
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Extract task from comment
        id: task
        run: |
          TASK=$(echo "${{ github.event.comment.body }}" | sed 's/\/ai-build //')
          echo "task=$TASK" >> $GITHUB_OUTPUT
      
      - name: Run AI Orchestrator
        run: |
          ./orchestrator --headless --task "${{ steps.task.outputs.task }}"
      
      - name: Create PR with results
        uses: peter-evans/create-pull-request@v5
        with:
          title: "AI Implementation: ${{ steps.task.outputs.task }}"
          body: "Automated implementation by AI Orchestrator"
```

### 2. IDE Plugin

```typescript
// vscode-extension/src/extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('orchflow.orchestrate', async () => {
        const task = await vscode.window.showInputBox({
            prompt: 'What would you like to build?',
            placeHolder: 'e.g., REST API with authentication'
        });
        
        if (task) {
            const terminal = vscode.window.createTerminal('AI Orchestrator');
            terminal.show();
            terminal.sendText(`cd ${vscode.workspace.rootPath}`);
            terminal.sendText(`orchflow-demo --task "${task}"`);
        }
    });
    
    context.subscriptions.push(disposable);
}
```

## Advanced Patterns

### 1. Multi-Stage Orchestration

```rust
pub struct MultiStageOrchestrator {
    stages: Vec<Stage>,
    current_stage: usize,
}

pub struct Stage {
    name: String,
    workers: Vec<WorkerPlan>,
    dependencies: Vec<String>,
    validation: Box<dyn Fn(&StageResult) -> bool>,
}

impl MultiStageOrchestrator {
    pub async fn execute(&mut self) {
        for stage in &self.stages {
            println!("Executing stage: {}", stage.name);
            
            // Check dependencies
            if !self.dependencies_met(&stage.dependencies) {
                eprintln!("Dependencies not met for stage: {}", stage.name);
                continue;
            }
            
            // Execute workers
            let results = self.execute_stage_workers(&stage.workers).await;
            
            // Validate results
            if !(stage.validation)(&results) {
                eprintln!("Stage validation failed: {}", stage.name);
                break;
            }
            
            self.current_stage += 1;
        }
    }
}
```

### 2. Intelligent Task Routing

```rust
pub struct TaskRouter {
    patterns: Vec<(Regex, Box<dyn Fn(&str) -> Vec<WorkerPlan>>)>,
}

impl TaskRouter {
    pub fn new() -> Self {
        let mut patterns = vec![];
        
        // API pattern
        patterns.push((
            Regex::new(r"(?i)(rest|api|endpoint)").unwrap(),
            Box::new(|task| vec![
                WorkerPlan::new("API-Architect", "sparc", task),
                WorkerPlan::new("API-Developer", "task", task),
            ]) as Box<dyn Fn(&str) -> Vec<WorkerPlan>>
        ));
        
        // Add more patterns...
        
        Self { patterns }
    }
    
    pub fn route(&self, task: &str) -> Vec<WorkerPlan> {
        for (pattern, handler) in &self.patterns {
            if pattern.is_match(task) {
                return handler(task);
            }
        }
        
        // Default routing
        vec![WorkerPlan::new("General-Developer", "task", task)]
    }
}
```

## Testing Your Extensions

### 1. Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_worker_planning() {
        let task = "Build a mobile app with authentication";
        let workers = plan_workers(task);
        
        assert!(workers.iter().any(|w| w.name.contains("Mobile")));
        assert!(workers.iter().any(|w| w.name.contains("Auth")));
    }
    
    #[tokio::test]
    async fn test_worker_spawning() {
        let mut orchestrator = AIOrchestrator::new().await.unwrap();
        let result = orchestrator.spawn_worker("task", "test task", "test-worker").await;
        
        assert!(result.is_ok());
        assert_eq!(orchestrator.worker_panes.len(), 2); // Initial + new
    }
}
```

### 2. Integration Tests

```rust
#[tokio::test]
async fn test_full_orchestration_flow() {
    // Start orchestrator
    let orchestrator = start_test_orchestrator().await;
    
    // Submit task
    let command = OrchestrationCommand {
        task: "Build a REST API".to_string(),
        timestamp: 0,
    };
    
    orchestrator.handle_command(command).await;
    
    // Wait for workers
    tokio::time::sleep(Duration::from_secs(2)).await;
    
    // Check workers spawned
    let workers = orchestrator.get_workers();
    assert!(workers.len() > 0);
    
    // Verify tmux session
    let output = Command::new("tmux")
        .args(&["list-panes", "-t", "ai-orchestrator"])
        .output()
        .unwrap();
    
    assert!(output.status.success());
}
```

## Best Practices

1. **Keep Workers Focused**: Each worker should have a single, clear responsibility
2. **Use Appropriate Modes**: Choose task/sparc/swarm based on complexity
3. **Handle Failures Gracefully**: Workers can fail - plan for it
4. **Monitor Resources**: Don't spawn too many workers at once
5. **Document Your Extensions**: Help others understand your customizations

---

Happy orchestrating! 🎭