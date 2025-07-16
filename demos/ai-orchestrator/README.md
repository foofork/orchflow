# AI Terminal Orchestrator Demo

An intelligent terminal orchestration system where Claude-Code delegates complex tasks to specialized Claude-Flow workers, all managed within a single tmux session using OrchFlow.

## 🎯 What It Does

This demo showcases how to build an AI-powered development environment where:
- **You** interact naturally with Claude-Code in the primary terminal
- **Claude** recognizes complex tasks and delegates to an orchestrator
- **The Orchestrator** spawns specialized worker terminals running Claude-Flow
- **Everything** is beautifully managed in a single tmux window

## 🚀 Quick Start (5 minutes)

### Prerequisites
- OrchFlow repository cloned
- tmux installed (`apt install tmux` or `brew install tmux`)
- Node.js 18+ installed
- Rust toolchain installed

### 1. Build and Run
```bash
cd /workspaces/orchflow/demos/ai-orchestrator
./quickstart.sh
```

This will:
1. Check all prerequisites
2. Build the Rust components
3. Create a tmux session with proper layout
4. Start everything automatically

### 2. Try It Out
In the left pane (Claude-Code), try:
```
> Build a REST API with user authentication

> Create a todo app with React frontend

> Implement a real-time chat system
```

Watch as Claude delegates work to specialized agents in the right panes!

## 📐 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   tmux: ai-orchestrator                      │
├────────────────┬─────────────────┬──────────────────────────┤
│ Claude-Code    │ Orchestrator    │ Worker Terminals         │
│ (Your Chat)    │ (Coordinator)   │ (AI Agents)              │
├────────────────┼─────────────────┼──────────────────────────┤
│                │                  │ ┌────────────────────┐  │
│ > Build a REST │ [RECEIVED]       │ │ API-Designer       │  │
│   API please   │ Spawning workers:│ │ Designing routes...│  │
│                │ - API-Designer   │ └────────────────────┘  │
│ Claude: I'll   │ - Auth-Expert    │                          │
│ orchestrate    │ - Test-Engineer  │ ┌────────────────────┐  │
│ this for you...│                  │ │ Auth-Expert        │  │
│                │ [MONITORING]     │ │ Building JWT...    │  │
│                │ Progress: 67%    │ └────────────────────┘  │
└────────────────┴─────────────────┴──────────────────────────┘
```

### How It Works

1. **You** chat with Claude-Code normally
2. **Claude** recognizes complex tasks and says "I'll orchestrate this"
3. **Monitor Script** detects orchestration intent and notifies the orchestrator
4. **Orchestrator** plans the work and spawns appropriate workers
5. **Workers** execute tasks using Claude-Flow (can be simple tasks or full swarms)
6. **You** see everything happening in real-time

## 🛠️ Components

### 1. Claude Monitor (`claude-monitor.js`)
Watches Claude-Code output for orchestration keywords and sends tasks to the orchestrator via Unix socket.

### 2. Orchestrator (`src/bin/orchestrator.rs`)
- Receives tasks from Claude-Code
- Plans which workers to spawn
- Creates tmux panes for each worker
- Monitors progress

### 3. Worker Types
- **Task Mode**: `claude-flow task "specific task"`
- **SPARC Mode**: `claude-flow sparc run developer "task"`
- **Swarm Mode**: `claude-flow swarm "complex task" --max-agents 3`

## 🎮 Tmux Controls

- `Ctrl-b` + arrows: Navigate between panes
- `Ctrl-b z`: Zoom current pane
- `Ctrl-b d`: Detach (run `tmux attach -t ai-orchestrator` to return)
- `Ctrl-b x`: Close current pane

## 🔧 Configuration

### Customizing Worker Types
Edit `src/bin/orchestrator.rs` to modify the `plan_workers` function:

```rust
fn plan_workers(task: &str) -> Vec<WorkerPlan> {
    // Add your own worker planning logic
}
```

### Adjusting Layout
Modify `src/orchestrator.rs` to change the tmux layout:
```rust
// Change split percentages in AIOrchestrator::new()
```

## 🐛 Troubleshooting

### "tmux session already exists"
```bash
tmux kill-session -t ai-orchestrator
```

### "Cannot connect to orchestrator"
```bash
rm -f /tmp/orchestrator.sock
```

### Workers not appearing
- Check if you have `claude-flow` installed: `npm install -g claude-flow`
- Workers will show mock output if claude-flow is not available

## 🚀 Advanced Usage

### Running with Real Claude-Flow
1. Install claude-flow: `npm install -g claude-flow`
2. Ensure you have API keys configured
3. Run the demo - workers will use actual AI

### Scaling Beyond Tmux
For more than 6-8 workers, consider:
1. Using the web UI variant (see `FUTURE_WORK.md`)
2. Implementing the dashboard view (see `HIVE_MIND_RECOMMENDATIONS.md`)

## 📚 Learn More

- [Technical Architecture](TECHNICAL_DETAILS.md) - Deep dive into the implementation
- [Extending the Demo](EXTENDING.md) - Add new features and worker types
- [Future Roadmap](FUTURE_WORK.md) - Planned enhancements

---

Built with ❤️ using OrchFlow, Claude-Code, and Claude-Flow