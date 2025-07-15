# OrchFlow Demo Application

## Overview

A focused demonstration application that showcases OrchFlow's AI terminal orchestration capabilities, including Claude integration for live demos.

## Demo Application Structure

```
orchflow-demo/
├── src/
│   ├── main.rs              # Tauri app entry
│   ├── ai_agent.rs          # Claude integration
│   └── demo_scenarios.rs    # Pre-built demos
├── ui/
│   ├── routes/
│   │   ├── +page.svelte     # Main demo interface
│   │   └── +layout.svelte   # Minimal layout
│   ├── components/
│   │   ├── TerminalGrid.svelte      # Show multiple terminals
│   │   ├── AgentControl.svelte      # AI agent controls
│   │   ├── SecurityMonitor.svelte   # Real-time security
│   │   └── ResourceGraph.svelte     # CPU/Memory usage
│   └── lib/
│       └── claude-integration.ts     # Claude API integration
└── demos/
    ├── basic-orchestration.md        # Simple examples
    ├── ai-code-review.md            # Claude reviews code
    ├── multi-agent-testing.md       # Parallel test execution
    └── security-sandbox.md          # Isolation demo
```

## Core Demo Features

### 1. **Live Claude Integration**
```typescript
// Claude can orchestrate terminals directly
async function claudeDemo() {
    const response = await claude.complete({
        prompt: "Create 3 terminals and run parallel tests",
        tools: [{
            name: "orchflow",
            description: "Terminal orchestration",
            commands: [
                "spawn_terminal",
                "execute_command",
                "stream_output"
            ]
        }]
    });
    
    // Claude's response:
    // "I'll create 3 terminals and run tests in parallel..."
    // Terminal 1: npm test -- --group=unit
    // Terminal 2: npm test -- --group=integration  
    // Terminal 3: npm test -- --group=e2e
}
```

### 2. **Visual Terminal Grid**
```svelte
<script lang="ts">
    import { orchestrator } from '$lib/stores';
    import StreamingTerminal from './StreamingTerminal.svelte';
    
    $: terminals = $orchestrator.terminals;
    $: aiAgents = $orchestrator.agents;
</script>

<div class="demo-container">
    <header>
        <h1>🔧 OrchFlow Demo</h1>
        <div class="stats">
            <span>{terminals.length} terminals</span>
            <span>{aiAgents.length} AI agents</span>
        </div>
    </header>
    
    <div class="control-panel">
        <button on:click={runClaudeDemo}>
            🤖 Run Claude Demo
        </button>
        <button on:click={runMultiAgentDemo}>
            👥 Multi-Agent Demo
        </button>
        <button on:click={runSecurityDemo}>
            🔒 Security Demo
        </button>
    </div>
    
    <div class="terminal-grid">
        {#each terminals as terminal}
            <div class="terminal-wrapper" data-agent={terminal.agentId}>
                <div class="terminal-header">
                    <span class="agent-badge">{terminal.agentId}</span>
                    <span class="status">{terminal.status}</span>
                    <button on:click={() => kill(terminal.id)}>❌</button>
                </div>
                <StreamingTerminal 
                    terminalId={terminal.id}
                    showOutput={true}
                />
            </div>
        {/each}
    </div>
    
    <SecurityMonitor />
    <ResourceGraph />
</div>
```

### 3. **Pre-built Demo Scenarios**

#### **Demo 1: Basic Orchestration**
```rust
pub async fn basic_orchestration_demo(orchestrator: &Orchestrator) {
    // Spawn multiple terminals
    let terms = vec![
        orchestrator.spawn_terminal("worker-1").await?,
        orchestrator.spawn_terminal("worker-2").await?,
        orchestrator.spawn_terminal("worker-3").await?,
    ];
    
    // Execute commands in parallel
    let futures: Vec<_> = terms.iter().enumerate().map(|(i, term)| {
        term.execute(&format!("echo 'Worker {} ready' && sleep {}", i+1, i+1))
    }).collect();
    
    futures::future::join_all(futures).await;
}
```

#### **Demo 2: Claude Code Review**
```typescript
async function claudeCodeReviewDemo() {
    // Claude spawns terminals to review code
    const claude = new ClaudeWithOrchflow();
    
    await claude.prompt(`
        Review this codebase for security issues:
        1. Clone the repo
        2. Run security scanners
        3. Check for vulnerabilities
        4. Generate a report
    `);
    
    // Claude's actions (shown in UI):
    // Terminal 1: git clone https://github.com/example/repo
    // Terminal 2: npm audit
    // Terminal 3: cargo audit
    // Terminal 4: semgrep --config=auto
}
```

#### **Demo 3: Multi-Agent Testing**
```typescript
async function multiAgentTestDemo() {
    const agents = [
        { id: "test-runner", role: "Run test suites" },
        { id: "log-monitor", role: "Watch for errors" },
        { id: "perf-analyzer", role: "Monitor performance" }
    ];
    
    for (const agent of agents) {
        const terminal = await orchestrator.spawnTerminal(agent.id);
        // Each agent works independently
    }
}
```

#### **Demo 4: Security Sandbox**
```rust
pub async fn security_sandbox_demo(orchestrator: &Orchestrator) {
    // Demonstrate isolation levels
    let secure = orchestrator.spawn_terminal_with_policy("secure", 
        SecurityPolicy {
            isolation_level: IsolationLevel::Container,
            network_access: false,
            file_system_access: ReadOnly,
            max_execution_time: Duration::from_secs(30),
        }
    ).await?;
    
    // This will fail (no network)
    secure.execute("curl google.com").await; // ❌ Blocked
    
    // This will fail (read-only FS)
    secure.execute("echo 'test' > /tmp/test.txt").await; // ❌ Blocked
}
```

## Demo UI Components

### **Agent Control Panel**
```svelte
<script>
    let agents = [
        { id: 'claude', name: 'Claude Assistant', active: false },
        { id: 'gpt-4', name: 'GPT-4 Coder', active: false },
        { id: 'local-llm', name: 'Local LLM', active: false }
    ];
    
    async function activateAgent(agent) {
        const terminal = await orchestrator.spawnTerminal(agent.id);
        agent.active = true;
        agent.terminalId = terminal.id;
    }
</script>

<div class="agent-control">
    <h3>AI Agents</h3>
    {#each agents as agent}
        <div class="agent-card" class:active={agent.active}>
            <span>{agent.name}</span>
            <button on:click={() => activateAgent(agent)}>
                {agent.active ? 'Active' : 'Activate'}
            </button>
        </div>
    {/each}
</div>
```

### **Security Monitor**
```svelte
<script>
    import { securityEvents } from '$lib/stores';
    
    $: events = $securityEvents.slice(-10); // Last 10 events
</script>

<div class="security-monitor">
    <h3>🔒 Security Events</h3>
    <div class="event-list">
        {#each events as event}
            <div class="event" class:blocked={event.action === 'blocked'}>
                <span class="time">{event.time}</span>
                <span class="agent">{event.agentId}</span>
                <span class="action">{event.action}</span>
                <span class="detail">{event.detail}</span>
            </div>
        {/each}
    </div>
</div>
```

### **Resource Graph**
```svelte
<script>
    import { metrics } from '$lib/stores';
    import { Line } from 'svelte-chartjs';
    
    $: chartData = {
        labels: $metrics.timestamps,
        datasets: [
            {
                label: 'CPU %',
                data: $metrics.cpu,
                borderColor: 'rgb(255, 99, 132)'
            },
            {
                label: 'Memory MB',
                data: $metrics.memory,
                borderColor: 'rgb(54, 162, 235)'
            }
        ]
    };
</script>

<div class="resource-graph">
    <h3>📊 Resource Usage</h3>
    <Line data={chartData} options={{ responsive: true }} />
</div>
```

## Running the Demo

### Quick Start
```bash
# Clone the demo
git clone https://github.com/orchflow/demo
cd orchflow-demo

# Install dependencies
npm install
cargo build --release

# Run the demo
npm run demo

# Opens at http://localhost:3000
```

### Docker Version
```dockerfile
FROM rust:latest as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM ubuntu:latest
RUN apt-get update && apt-get install -y nodejs npm
COPY --from=builder /app/target/release/orchflow-demo /usr/local/bin/
COPY --from=builder /app/ui /app/ui
EXPOSE 3000 7777
CMD ["orchflow-demo"]
```

### Live Demo Site
Host at `demo.orchflow.dev` with:
- Interactive examples
- Claude integration (bring your own API key)
- Sandboxed environment
- No installation required

## Demo Scripts

### **1. Introduction Demo**
```javascript
// Narrator: "OrchFlow lets AI agents orchestrate terminals"
await orchestrator.spawnTerminal("demo-1");
await terminal.execute("echo 'Hello from OrchFlow!'");

// Narrator: "Multiple terminals can work in parallel"
const terminals = await Promise.all([
    orchestrator.spawnTerminal("worker-1"),
    orchestrator.spawnTerminal("worker-2"),
    orchestrator.spawnTerminal("worker-3")
]);

// Show them all executing
```

### **2. AI Integration Demo**
```javascript
// Narrator: "Claude can control terminals naturally"
const claude = new ClaudeIntegration(apiKey);

await claude.complete({
    prompt: "Set up a new React project with tests",
    tools: ['orchflow']
});

// Claude's actions appear in real-time:
// - Terminal 1: npx create-react-app my-app
// - Terminal 2: cd my-app && npm test
// - Terminal 3: npm run build
```

### **3. Security Demo**
```javascript
// Narrator: "Each agent runs in isolation"
const malicious = await orchestrator.spawnTerminal("untrusted", {
    security: "strict"
});

// These all fail with security notices
await malicious.execute("rm -rf /"); // ❌ Blocked
await malicious.execute("curl evil.com"); // ❌ No network
await malicious.execute("cd /etc"); // ❌ No access
```

## Marketing Value

This demo shows:
1. **AI + Terminal Orchestration** - The future of development
2. **Security First** - Safe for production use
3. **Simple Integration** - Works with any AI/LLM
4. **Real-time Monitoring** - See everything happening
5. **Production Ready** - Not just a toy

## Technical Implementation

The demo uses:
- **Minimal UI**: Just enough to show the concepts
- **Real OrchFlow**: Actual crates, not mocked
- **Claude Integration**: Via API with tool use
- **WebSocket Streaming**: Real-time terminal output
- **Security Policies**: Actual sandboxing

This demo app would be ~5% of the current codebase but show 95% of the value!