# Revised AI Orchestrator Architecture

## Based on Claude-Flow's Actual Technique

### The Correct Understanding

Claude-flow orchestrates a **single claude-code instance** that acts as multiple virtual agents through context switching and role playing. This is fundamentally different from spawning multiple separate processes.

## New Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    OrchFlow AI Orchestrator                     │
├───────────────────┬────────────────────┬───────────────────────┤
│ Primary Terminal  │ Orchestrator View  │ Agent Activity Log   │
│ (User Input)      │ (Status/Control)   │ (Virtual Agents)     │
├───────────────────┼────────────────────┼───────────────────────┤
│                   │                    │                       │
│ > Build a REST    │ [STATUS] Active    │ ╔═══════════════════╗ │
│   API with auth   │ Mode: Swarm        │ ║ Architect Agent   ║ │
│                   │ Agents: 4          │ ║ Designing API...  ║ │
│ [Claude-Flow]:    │ Progress: 45%      │ ║ ✓ Design complete ║ │
│ I'll coordinate   │                    │ ╚═══════════════════╝ │
│ the team...       │ [CONTROL]          │                       │
│                   │ ⏸ Pause ▶ Resume   │ ╔═══════════════════╗ │
│ > Show progress   │ 🔄 Restart ⏹ Stop  │ ║ Backend Agent     ║ │
│                   │                    │ ║ Implementing...   ║ │
│ [Claude-Flow]:    │ [MEMORY]           │ ║ - User routes     ║ │
│ Backend: 60%      │ api_design: stored │ ║ - Auth middleware ║ │
│ Auth: 80%         │ test_plan: stored  │ ╚═══════════════════╝ │
│ Tests: pending    │                    │                       │
│                   │ [COMMANDS]         │ ╔═══════════════════╗ │
│                   │ Switch to: Coder   │ ║ Auth Specialist   ║ │
│                   │ Add agent: DBA     │ ║ JWT implementation║ │
│                   │ Export: Results    │ ║ ✓ Auth complete   ║ │
│                   │                    │ ╚═══════════════════╝ │
└───────────────────┴────────────────────┴───────────────────────┘
```

## Implementation Strategy

### 1. Single Claude-Flow Process
```javascript
// backend/src/claude-orchestrator.js
const { spawn } = require('child_process');
const EventEmitter = require('events');

class ClaudeOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.claudeFlow = null;
    this.agents = new Map();
    this.mode = 'idle';
  }

  async startSwarm(task, options = {}) {
    // Launch claude-flow swarm with monitoring
    this.claudeFlow = spawn('claude-flow', [
      'swarm',
      task,
      '--max-agents', options.maxAgents || '5',
      '--strategy', options.strategy || 'development',
      '--monitor',
      '--output', 'stream-json'
    ]);

    this.mode = 'swarm';
    this.setupOutputParsing();
  }

  setupOutputParsing() {
    let buffer = '';
    
    this.claudeFlow.stdout.on('data', (data) => {
      buffer += data.toString();
      
      // Parse streaming JSON events
      const lines = buffer.split('\n');
      buffer = lines.pop(); // Keep incomplete line
      
      lines.forEach(line => {
        try {
          const event = JSON.parse(line);
          this.handleClaudeEvent(event);
        } catch (e) {
          // Regular text output
          this.emit('output', { type: 'text', data: line });
        }
      });
    });
  }

  handleClaudeEvent(event) {
    switch (event.type) {
      case 'agent_active':
        this.emit('agent-update', {
          agent: event.agent,
          status: 'active',
          message: event.message
        });
        break;
        
      case 'task_complete':
        this.emit('task-complete', {
          agent: event.agent,
          result: event.result
        });
        break;
        
      case 'memory_stored':
        this.emit('memory-update', {
          key: event.key,
          value: event.value
        });
        break;
        
      case 'progress':
        this.emit('progress', {
          overall: event.overall,
          agents: event.agents
        });
        break;
    }
  }
}
```

### 2. Three-Panel Web UI

#### Panel 1: Primary Terminal (User Interaction)
```typescript
// frontend/src/PrimaryTerminal.tsx
export const PrimaryTerminal: React.FC = ({ orchestrator }) => {
  const terminalRef = useRef<Terminal>();
  
  useEffect(() => {
    const term = new Terminal({
      prompt: '> ',
      theme: { background: '#1a1b26' }
    });
    
    term.onData((data) => {
      if (data === '\r') {
        const command = term.buffer.active.getLine(term.buffer.active.cursorY).translateToString();
        handleCommand(command);
        term.write('\r\n> ');
      } else {
        term.write(data);
      }
    });
    
    terminalRef.current = term;
  }, []);

  const handleCommand = (cmd: string) => {
    if (cmd.toLowerCase().includes('build')) {
      orchestrator.startSwarm(cmd);
      term.writeln('\\n[Claude-Flow]: Starting swarm coordination...');
    }
  };
};
```

#### Panel 2: Orchestrator Control
```typescript
// frontend/src/OrchestratorPanel.tsx
export const OrchestratorPanel: React.FC = ({ orchestrator }) => {
  const [status, setStatus] = useState({
    mode: 'idle',
    agents: [],
    progress: 0,
    memory: {}
  });

  useEffect(() => {
    orchestrator.on('progress', (data) => {
      setStatus(prev => ({ ...prev, progress: data.overall }));
    });

    orchestrator.on('agent-update', (data) => {
      setStatus(prev => ({
        ...prev,
        agents: updateAgentInList(prev.agents, data)
      }));
    });

    orchestrator.on('memory-update', (data) => {
      setStatus(prev => ({
        ...prev,
        memory: { ...prev.memory, [data.key]: data.value }
      }));
    });
  }, [orchestrator]);

  return (
    <div className="orchestrator-panel">
      <StatusDisplay status={status} />
      <ControlButtons orchestrator={orchestrator} />
      <MemoryView memory={status.memory} />
    </div>
  );
};
```

#### Panel 3: Virtual Agent Display
```typescript
// frontend/src/AgentActivityLog.tsx
export const AgentActivityLog: React.FC = ({ orchestrator }) => {
  const [agents, setAgents] = useState<AgentActivity[]>([]);

  useEffect(() => {
    orchestrator.on('agent-update', (data) => {
      setAgents(prev => {
        const existing = prev.find(a => a.name === data.agent);
        if (existing) {
          return prev.map(a => 
            a.name === data.agent 
              ? { ...a, logs: [...a.logs, data.message], status: data.status }
              : a
          );
        } else {
          return [...prev, {
            name: data.agent,
            status: data.status,
            logs: [data.message],
            startTime: Date.now()
          }];
        }
      });
    });
  }, [orchestrator]);

  return (
    <div className="agent-log">
      {agents.map(agent => (
        <AgentCard key={agent.name} agent={agent} />
      ))}
    </div>
  );
};
```

### 3. OrchFlow Integration for Terminal Management

```rust
// Use OrchFlow to manage the primary claude-flow terminal
use orchflow_terminal::{PtyManager, TerminalStreamManager};
use orchflow_core::{Event, Manager};

pub struct OrchFlowAIDemo {
    manager: Arc<Manager>,
    pty_manager: Arc<PtyManager>,
    claude_flow_pty: Option<PtyHandle>,
}

impl OrchFlowAIDemo {
    pub async fn start_orchestration(&mut self, task: &str) -> Result<()> {
        // Create managed PTY for claude-flow
        let pty = self.pty_manager.spawn_pty(
            "claude-flow",
            vec!["swarm", task, "--monitor", "--output", "stream-json"],
            None
        ).await?;
        
        // Stream output through OrchFlow's event system
        let mut output_stream = pty.output_stream();
        tokio::spawn(async move {
            while let Some(data) = output_stream.next().await {
                // Parse and emit events
                self.handle_claude_output(data).await;
            }
        });
        
        self.claude_flow_pty = Some(pty);
        Ok(())
    }
}
```

## Key Differences from Original Design

### 1. Single Process, Multiple Agents
- ❌ **Not**: Multiple terminals each running claude-flow
- ✅ **Actually**: One claude-flow process simulating multiple agents

### 2. Virtual Agent Display
- ❌ **Not**: Separate terminal windows for each worker
- ✅ **Actually**: Activity log showing agent context switches

### 3. Orchestration Control
- ❌ **Not**: IPC between separate processes
- ✅ **Actually**: Parsing claude-flow's streaming output

### 4. Memory Coordination
- ❌ **Not**: Shared files or pipes between terminals
- ✅ **Actually**: Claude's built-in memory system

## Benefits of Correct Approach

1. **Simpler**: One process to manage instead of many
2. **Efficient**: Single Claude API connection
3. **Coherent**: Shared context between all "agents"
4. **Observable**: Easy to monitor all activity
5. **Controllable**: Can pause/resume/redirect easily

## Demo Flow

1. **User Input**: "Build a REST API with authentication"
2. **Claude-Flow**: Launches with swarm mode
3. **Virtual Agents**: Take turns working on the task
4. **Activity Log**: Shows each agent's contributions
5. **Orchestrator**: Displays overall progress and control
6. **Completion**: Results available in memory/export

This revised architecture aligns with how claude-flow actually works and will create a more accurate and impressive demo!