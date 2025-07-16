# Simplified AI Terminal Orchestrator Demo

## Overview

A practical demo showing claude-code as the primary interface that sends work to an orchestrator terminal, which spawns claude-flow worker terminals. Communication happens through named pipes for simplicity.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Three Terminal System                            │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Claude-Code      │ Orchestrator     │ Worker Terminals         │
│ (Primary)        │ (Dispatcher)     │ (Claude-Flow)            │
│                  │                  │                          │
│ > Build a REST   │ [RECEIVED]       │ ┌────────────────────┐  │
│   API            │ Task: Build API  │ │ Worker-1: Architect│  │
│                  │                  │ │ Status: Planning   │  │
│ [Analyzing...]   │ Spawning:        │ └────────────────────┘  │
│                  │ - architect      │                          │
│ I'll help you    │ - coder          │ ┌────────────────────┐  │
│ build that API.  │ - tester         │ │ Worker-2: Coder    │  │
│ Sending to       │                  │ │ Status: Waiting    │  │
│ orchestrator...  │ Workers spawned. │ └────────────────────┘  │
│                  │ Waiting...       │                          │
│ [SENT]           │                  │ ┌────────────────────┐  │
│                  │ [COMPLETE]       │ │ Worker-3: Tester   │  │
│ Task completed!  │ All done.        │ │ Status: Waiting    │  │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## Simple Communication Flow

### 1. Named Pipe Setup
```bash
# Create named pipes for communication
mkfifo /tmp/orchflow/claude-to-orch
mkfifo /tmp/orchflow/orch-to-claude
mkfifo /tmp/orchflow/worker-1-to-orch
mkfifo /tmp/orchflow/worker-2-to-orch
# ... etc
```

### 2. Claude-Code Terminal
```bash
# Run claude-code with custom system prompt
claude-code --system-prompt "When user asks to build something, output JSON command to orchestrator like: {\"action\":\"orchestrate\",\"task\":\"description\",\"agents\":[\"architect\",\"coder\",\"tester\"]}"
```

### 3. Orchestrator Script
```javascript
// orchestrator.js - Simple dispatcher
const fs = require('fs');
const { spawn } = require('child_process');

// Listen to claude-code pipe
const claudePipe = fs.createReadStream('/tmp/orchflow/claude-to-orch');

claudePipe.on('data', (data) => {
  const command = JSON.parse(data.toString());
  
  if (command.action === 'orchestrate') {
    console.log(`[RECEIVED] Task: ${command.task}`);
    
    // Spawn worker terminals
    command.agents.forEach((agentType, index) => {
      console.log(`Spawning: ${agentType}`);
      
      // Create new terminal with claude-flow
      spawn('xterm', ['-e', `claude-flow sparc run ${agentType} "${command.task}" > /tmp/orchflow/worker-${index}-to-orch`]);
    });
    
    console.log('Workers spawned. Waiting...');
  }
});

// Listen to worker pipes
fs.readdirSync('/tmp/orchflow')
  .filter(f => f.startsWith('worker-'))
  .forEach(pipe => {
    fs.createReadStream(`/tmp/orchflow/${pipe}`).on('data', (data) => {
      console.log(`[WORKER UPDATE] ${data.toString()}`);
    });
  });
```

## Practical Implementation

### Directory Structure
```
demos/ai-orchestrator-simple/
├── setup.sh              # Creates pipes and directories
├── orchestrator.js       # Simple Node.js orchestrator
├── claude-wrapper.sh     # Wrapper to intercept claude-code output
├── worker-monitor.js     # Display worker status
└── demo.sh              # Run the demo
```

### setup.sh
```bash
#!/bin/bash
# Create communication directory
mkdir -p /tmp/orchflow

# Create named pipes
mkfifo /tmp/orchflow/claude-to-orch
mkfifo /tmp/orchflow/orch-to-claude

# Create worker pipes dynamically
for i in {1..5}; do
  mkfifo /tmp/orchflow/worker-$i-to-orch
done
```

### claude-wrapper.sh
```bash
#!/bin/bash
# Wrapper script that tees claude-code output to orchestrator

# Start claude-code and pipe output
claude-code 2>&1 | while read line; do
  echo "$line"  # Display to user
  
  # Check if line contains orchestration command
  if [[ "$line" =~ \{\"action\":\"orchestrate\" ]]; then
    echo "$line" > /tmp/orchflow/claude-to-orch
  fi
done
```

### Simple Worker Template
```bash
#!/bin/bash
# worker.sh - Template for worker terminal

WORKER_ID=$1
AGENT_TYPE=$2
TASK=$3

echo "{\"worker\": \"$WORKER_ID\", \"status\": \"starting\"}" > /tmp/orchflow/worker-$WORKER_ID-to-orch

# Run claude-flow
claude-flow sparc run $AGENT_TYPE "$TASK" 2>&1 | while read line; do
  echo "$line"  # Display in terminal
  
  # Send status updates
  if [[ "$line" =~ "Completed" ]]; then
    echo "{\"worker\": \"$WORKER_ID\", \"status\": \"completed\"}" > /tmp/orchflow/worker-$WORKER_ID-to-orch
  fi
done
```

## Demo Flow

### 1. Start the System
```bash
# Terminal 1: Setup and start orchestrator
./setup.sh
node orchestrator.js

# Terminal 2: Start claude-code wrapper
./claude-wrapper.sh

# Terminal 3-N: Will be spawned automatically
```

### 2. User Interaction
```
[Claude-Code Terminal]
> Build a REST API with user authentication

Claude: I'll help you build a REST API with authentication. Let me coordinate the work...

{"action":"orchestrate","task":"Build REST API with user auth","agents":["architect","coder","tester"]}

The task has been sent to the orchestrator. Worker agents are being deployed...
```

### 3. Orchestrator Response
```
[Orchestrator Terminal]
[RECEIVED] Task: Build REST API with user auth
Spawning: architect
Spawning: coder  
Spawning: tester
Workers spawned. Waiting...

[WORKER UPDATE] {"worker": "1", "status": "starting"}
[WORKER UPDATE] {"worker": "2", "status": "starting"}
[WORKER UPDATE] {"worker": "3", "status": "starting"}

[WORKER UPDATE] {"worker": "1", "status": "completed"}
[WORKER UPDATE] {"worker": "2", "status": "completed"}
[WORKER UPDATE] {"worker": "3", "status": "completed"}

[COMPLETE] All done.
```

### 4. Worker Terminal Example
```
[Worker-1: Architect]
Claude-Flow SPARC Architect Mode
Task: Build REST API with user auth

Analyzing requirements...
Designing API structure...
- /auth/register
- /auth/login
- /auth/refresh
- /users/profile

Creating architecture document...
✓ Architecture complete
```

## Key Simplifications

1. **Named Pipes**: Simple file-based IPC, no complex networking
2. **JSON Messages**: Structured communication between terminals
3. **Terminal Spawning**: Use system's xterm to create visible terminals
4. **Status Updates**: Simple JSON status messages
5. **No Complex UI**: Just three terminal windows side by side

## Minimal Dependencies

- Node.js (for orchestrator)
- claude-code CLI
- claude-flow CLI  
- xterm or any terminal emulator
- Basic Unix tools (mkfifo, bash)

## Running the Demo

```bash
# 1. Install dependencies
npm install -g @anthropic-ai/claude-code
npm install -g claude-flow

# 2. Set up the demo
cd demos/ai-orchestrator-simple
chmod +x *.sh
./setup.sh

# 3. Start orchestrator (Terminal 1)
node orchestrator.js

# 4. Start claude-code (Terminal 2)
./claude-wrapper.sh

# 5. Workers will spawn automatically
```

## Extending the Demo

1. **Better Status Display**: Create a worker-monitor.js that shows live status
2. **Result Aggregation**: Collect worker outputs and send back to claude-code
3. **Error Handling**: Handle worker failures and retry logic
4. **Task Dependencies**: Allow workers to depend on each other's output
5. **Web UI**: Add a simple web interface using xterm.js

This simplified architecture focuses on demonstrating the core concept with minimal complexity while maintaining the ability to show real terminal orchestration in action.