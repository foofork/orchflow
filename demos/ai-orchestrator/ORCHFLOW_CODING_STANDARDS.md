# OrchFlow Coding Standards & Technology Stack

## Overview

OrchFlow uses a hybrid architecture combining Rust for high-performance core components and TypeScript/JavaScript for user-facing interfaces and integrations. This document defines coding standards and best practices for implementing the OrchFlow Terminal Architecture.

## Technology Stack

### Core Infrastructure (Rust)
- **Language**: Rust (2021 edition)
- **Crates**:
  - `orchflow-core`: Core orchestration logic and state management
  - `orchflow-mux`: Terminal multiplexing and tmux integration
  - `orchflow-terminal`: Terminal backend and process management
- **Key Dependencies**:
  - `tokio`: Async runtime
  - `serde/serde_json`: Serialization
  - `portable-pty`: Cross-platform terminal handling
  - `thiserror/anyhow`: Error handling

### User Interface & Integration (TypeScript/JavaScript)
- **Language**: TypeScript 5.x / Node.js 18+
- **NPM Package**: `@orchflow/cli` (distributed via npm)
- **Key Components**:
  - Primary terminal interface (claude-code integration)
  - MCP protocol implementation
  - Status pane UI
  - Natural language processing
- **Dependencies**:
  - `xterm.js`: Terminal emulation in browser/electron
  - `claude-flow`: Underlying AI orchestration
  - MCP SDK for tool registration

### Distribution Model
```
┌─────────────────────────────────────────────────────┐
│                   NPM Package                       │
│                @orchflow/cli                        │
│  ┌────────────────────────────────────────────────┐ │
│  │            TypeScript/JavaScript               │ │
│  │  • CLI entry point (./claude-flow orchflow)   │ │
│  │  • Natural language interface                  │ │
│  │  • MCP tool registration                       │ │
│  │  • Status pane UI                              │ │
│  └────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────┐ │
│  │           Rust Native Binaries                 │ │
│  │  • orchflow-mux (tmux backend)                │ │
│  │  • orchflow-core (orchestration)              │ │
│  │  • Pre-compiled for each platform              │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

## Rust Coding Standards

### General Principles
```rust
// 1. Use descriptive names
pub struct WorkerManager {  // Good
    // Not: pub struct WM {

// 2. Prefer composition over inheritance
pub struct OrchestrationEngine {
    scheduler: Box<dyn Scheduler>,
    worker_pool: WorkerPool,
}

// 3. Handle errors explicitly
pub async fn spawn_worker(&self, config: WorkerConfig) -> Result<WorkerId> {
    let worker = Worker::new(config)
        .context("Failed to create worker")?;
    
    self.pool.add(worker)
        .await
        .context("Failed to add worker to pool")
}
```

### Error Handling
```rust
use thiserror::Error;

#[derive(Error, Debug)]
pub enum OrchFlowError {
    #[error("Worker {id} failed: {reason}")]
    WorkerFailed { id: String, reason: String },
    
    #[error("Tmux backend error: {0}")]
    TmuxError(#[from] TmuxError),
    
    #[error("Invalid configuration: {0}")]
    ConfigError(String),
}

// Use anyhow for application-level errors
use anyhow::{Context, Result};

pub async fn orchestrate_task(task: Task) -> Result<()> {
    validate_task(&task)
        .context("Task validation failed")?;
    
    spawn_workers(&task)
        .await
        .context("Failed to spawn workers")?;
    
    Ok(())
}
```

### Async Best Practices
```rust
// 1. Use tokio for all async operations
#[tokio::main]
async fn main() -> Result<()> {
    let runtime = Runtime::new()?;
    runtime.spawn(async move {
        // Background tasks
    });
}

// 2. Avoid blocking in async contexts
pub async fn process_output(&mut self) -> Result<()> {
    // Good: Use tokio's async file operations
    let content = tokio::fs::read_to_string(&path).await?;
    
    // Bad: Don't use std::fs in async
    // let content = std::fs::read_to_string(&path)?;
}

// 3. Use select! for concurrent operations
tokio::select! {
    result = worker.run() => handle_worker_result(result),
    _ = shutdown_signal() => graceful_shutdown().await,
}
```

### Performance Guidelines
```rust
// 1. Zero-copy where possible
pub fn parse_worker_output(data: &[u8]) -> Result<WorkerStatus> {
    // Parse without allocating new strings
    serde_json::from_slice(data)
        .context("Failed to parse worker output")
}

// 2. Use channels for inter-task communication
use tokio::sync::mpsc;

pub struct Orchestrator {
    command_tx: mpsc::Sender<Command>,
    status_rx: mpsc::Receiver<Status>,
}

// 3. Pool resources
use tokio::sync::Mutex;

pub struct WorkerPool {
    available: Arc<Mutex<Vec<Worker>>>,
    max_workers: usize,
}
```

## TypeScript/JavaScript Standards

### General Principles
```typescript
// 1. Use TypeScript strict mode
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  }
}

// 2. Define clear interfaces
interface WorkerConfig {
  id: string;
  type: 'swarm' | 'hive-mind' | 'task';
  name: string;
  capabilities: string[];
}

// 3. Use const assertions for literals
const WORKER_STATES = ['idle', 'running', 'paused', 'completed'] as const;
type WorkerState = typeof WORKER_STATES[number];
```

### Natural Language Processing
```typescript
// Intent recognition patterns
export class IntentRecognizer {
  private patterns: Map<RegExp, IntentHandler>;
  
  registerPattern(pattern: string, handler: IntentHandler): void {
    // Convert natural language patterns to regex
    const regex = this.patternToRegex(pattern);
    this.patterns.set(regex, handler);
  }
  
  async recognize(input: string): Promise<Intent> {
    const normalized = this.normalize(input);
    
    for (const [pattern, handler] of this.patterns) {
      const match = normalized.match(pattern);
      if (match) {
        return handler.parse(match);
      }
    }
    
    return this.defaultIntent(input);
  }
}
```

### MCP Integration
```typescript
// MCP tool registration following protocol standards
export class OrchFlowMCPTools {
  async register(): Promise<void> {
    await mcp.registerTool({
      name: 'orchflow_spawn_worker',
      description: 'Spawn a new OrchFlow worker',
      parameters: {
        type: 'object',
        properties: {
          workerType: {
            type: 'string',
            enum: ['swarm', 'hive-mind', 'task']
          },
          objective: {
            type: 'string',
            description: 'Worker objective'
          }
        },
        required: ['workerType', 'objective']
      },
      handler: this.spawnWorker.bind(this)
    });
  }
}
```

### Status Pane Implementation
```typescript
// React-style component for status display
export class StatusPane {
  private updateInterval: NodeJS.Timer;
  private workers: Map<string, WorkerStatus>;
  
  async render(): Promise<void> {
    const status = await this.orchestrator.getStatus();
    
    console.clear();
    console.log('🎯 Active Workers');
    console.log('━'.repeat(50));
    
    status.workers.forEach((worker, index) => {
      const progress = this.renderProgressBar(worker.progress);
      console.log(`${index + 1}. ${worker.name} ${progress}`);
      console.log(`   └─ ${worker.currentTask}`);
    });
  }
  
  private renderProgressBar(percent: number): string {
    const filled = Math.floor(percent / 10);
    const empty = 10 - filled;
    return `[${'\u2588'.repeat(filled)}${'\u2591'.repeat(empty)}] ${percent}%`;
  }
}
```

## Integration Patterns

### Rust-JavaScript Bridge
```typescript
// TypeScript side
import { spawn } from 'child_process';
import { join } from 'path';

export class OrchFlowCore {
  private muxProcess: ChildProcess;
  
  async start(): Promise<void> {
    const binaryPath = this.getPlatformBinary();
    
    this.muxProcess = spawn(binaryPath, ['--json-rpc'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    this.setupJsonRpcCommunication();
  }
  
  private getPlatformBinary(): string {
    const platform = process.platform;
    const arch = process.arch;
    
    return join(__dirname, 'bin', `orchflow-mux-${platform}-${arch}`);
  }
}
```

### Thin Wrapper Implementation
```typescript
// Preserve claude-flow's existing behavior
export class ClaudeFlowWrapper {
  async executeCommand(task: Task): Promise<void> {
    // Build standard claude-flow command
    const command = this.buildClaudeFlowCommand(task);
    
    // Execute without modification
    const worker = await this.spawnWorker(command);
    
    // Monitor output passively
    worker.stdout.on('data', data => {
      this.parseAndUpdateStatus(data);
    });
  }
  
  private buildClaudeFlowCommand(task: Task): string {
    // Direct mapping to claude-flow commands
    switch (task.type) {
      case 'swarm':
        return `claude-flow swarm "${task.objective}" --strategy ${task.strategy}`;
      case 'hive-mind':
        return `claude-flow hive-mind "${task.objective}" --claude`;
      default:
        return `claude-flow sparc run ${task.mode} "${task.objective}"`;
    }
  }
}
```

## Testing Standards

### Rust Testing
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_worker_spawning() {
        let orchestrator = Orchestrator::new();
        let worker_id = orchestrator
            .spawn_worker(WorkerConfig::default())
            .await
            .expect("Failed to spawn worker");
        
        assert!(orchestrator.get_worker(&worker_id).is_some());
    }
    
    #[test]
    fn test_worker_name_generation() {
        let namer = WorkerNamer::new();
        let name = namer.generate("auth", "swarm");
        
        assert_eq!(name, "JWT Auth Builder");
    }
}
```

### TypeScript Testing
```typescript
// Jest tests for natural language processing
describe('IntentRecognizer', () => {
  let recognizer: IntentRecognizer;
  
  beforeEach(() => {
    recognizer = new IntentRecognizer();
  });
  
  test('recognizes worker inspection intent', async () => {
    const intent = await recognizer.recognize('show me worker 2');
    
    expect(intent.action).toBe('inspect_worker');
    expect(intent.parameters.workerId).toBe('2');
  });
  
  test('handles natural variations', async () => {
    const variations = [
      'let me see the React developer',
      'show me what the React dev is doing',
      'connect to React developer'
    ];
    
    for (const input of variations) {
      const intent = await recognizer.recognize(input);
      expect(intent.action).toBe('inspect_worker');
    }
  });
});
```

## Performance Requirements

### Response Time Targets
- **Primary terminal input**: < 50ms to acknowledge
- **Worker spawning**: < 500ms to start
- **Status updates**: 1 second refresh rate
- **Worker switching**: < 100ms transition

### Resource Limits
- **Memory per worker**: 256MB default, 1GB max
- **Total orchestrator overhead**: < 100MB
- **CPU usage (idle)**: < 1%
- **CPU usage (10 workers)**: < 10%

## Security Guidelines

### Input Validation
```typescript
// Sanitize all user input
export function sanitizeObjective(input: string): string {
  // Remove potential command injection
  return input
    .replace(/[;&|`$]/g, '')
    .trim()
    .substring(0, 1000); // Limit length
}
```

### Process Isolation
```rust
// Each worker runs in isolated environment
pub fn spawn_isolated_worker(config: WorkerConfig) -> Result<Worker> {
    let mut cmd = Command::new("claude-flow");
    
    // Drop privileges
    cmd.uid(config.uid)
       .gid(config.gid)
       .env_clear()
       .env("HOME", config.home_dir)
       .env("PATH", "/usr/bin:/bin");
    
    Ok(Worker::from_command(cmd))
}
```

## Documentation Requirements

### Code Documentation
```rust
/// Orchestrates task execution across multiple workers.
/// 
/// # Arguments
/// * `task` - The task to orchestrate
/// * `options` - Orchestration options
/// 
/// # Returns
/// * `Result<TaskResult>` - Task execution result
/// 
/// # Example
/// ```
/// let result = orchestrator
///     .orchestrate(task, Default::default())
///     .await?;
/// ```
pub async fn orchestrate(
    &self,
    task: Task,
    options: OrchestrationOptions
) -> Result<TaskResult> {
    // Implementation
}
```

### API Documentation
- All public APIs must have JSDoc/RustDoc
- Include examples for common use cases
- Document error conditions
- Specify performance characteristics

## Build and Distribution

### NPM Package Structure
```
@orchflow/cli/
├── bin/
│   ├── orchflow-mux-linux-x64
│   ├── orchflow-mux-darwin-x64
│   └── orchflow-mux-win32-x64
├── dist/
│   ├── index.js
│   ├── index.d.ts
│   └── *.js (compiled TypeScript)
├── package.json
└── README.md
```

### Platform Support
- Linux: x64, arm64
- macOS: x64 (Intel), arm64 (Apple Silicon)
- Windows: x64 (experimental)
- Node.js: 18.x, 20.x, 22.x

### Installation Flow
```bash
# User runs:
npm install -g @orchflow/cli

# Post-install script:
# 1. Detects platform
# 2. Sets execute permissions on binaries
# 3. Verifies claude-flow availability
# 4. Shows quick-start message
```

## Best Practices Summary

1. **Separation of Concerns**: Rust for performance-critical backend, TypeScript for user interface
2. **Thin Wrapper Philosophy**: Minimal interference with claude-flow's existing behavior
3. **Error Handling**: Graceful degradation with clear user messages
4. **Performance First**: Profile and optimize hot paths
5. **User Experience**: Natural language over technical commands
6. **Testing**: Comprehensive unit and integration tests
7. **Documentation**: Code is not complete without docs
8. **Security**: Never trust user input, isolate processes
9. **Compatibility**: Support multiple platforms and environments
10. **Monitoring**: Built-in observability and debugging