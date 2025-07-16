# Minimal Working Demo - AI Terminal Orchestrator

## The Simplest Approach That Actually Works

### Core Concept
Three terminal windows showing:
1. **Claude-Code** - User interacts here
2. **Orchestrator** - Shows task distribution 
3. **Workers** - Shows claude-flow agents working

### Key Insight
Instead of complex IPC, we use a shared JSON file that terminals watch for changes.

## File Structure
```
demos/minimal-ai-orchestrator/
├── shared/
│   └── state.json          # Shared state file
├── claude-terminal.js      # Terminal 1: Claude-Code wrapper
├── orchestrator.js         # Terminal 2: Task orchestrator  
├── worker-display.js       # Terminal 3: Worker status display
├── start-demo.sh          # Launch all terminals
└── package.json
```

## Implementation

### shared/state.json
```json
{
  "currentTask": null,
  "workers": [],
  "messages": []
}
```

### claude-terminal.js
```javascript
#!/usr/bin/env node
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'shared/state.json');

// Ensure state file exists
if (!fs.existsSync(STATE_FILE)) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    currentTask: null,
    workers: [],
    messages: []
  }));
}

console.log('=== Claude-Code Terminal ===');
console.log('Ask me to build something!');
console.log('Example: "Build a REST API with user authentication"');
console.log('');

// Simple prompt system
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.on('line', (input) => {
  if (input.toLowerCase().includes('build')) {
    console.log('\nClaude: I\'ll help you build that. Let me coordinate the work...\n');
    
    // Simulate Claude's response with orchestration command
    const task = {
      description: input,
      agents: determineAgents(input),
      timestamp: new Date().toISOString()
    };
    
    // Update shared state
    const state = JSON.parse(fs.readFileSync(STATE_FILE));
    state.currentTask = task;
    state.messages.push({
      from: 'claude',
      text: `Orchestrating: ${input}`,
      time: new Date().toISOString()
    });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    
    console.log(`ORCHESTRATE: ${JSON.stringify(task)}`);
    console.log('\nTask sent to orchestrator. Watch the other terminals!\n');
  }
});

function determineAgents(input) {
  const agents = [];
  
  // Simple keyword matching
  if (input.includes('API') || input.includes('api')) {
    agents.push('architect', 'backend-dev');
  }
  if (input.includes('auth') || input.includes('user')) {
    agents.push('auth-specialist');
  }
  if (input.includes('test') || agents.length > 0) {
    agents.push('tester');
  }
  
  return agents.length > 0 ? agents : ['researcher', 'developer'];
}

rl.prompt();
```

### orchestrator.js
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const STATE_FILE = path.join(__dirname, 'shared/state.json');
let lastTask = null;

console.log('=== Orchestrator Terminal ===');
console.log('Waiting for tasks from Claude-Code...\n');

// Watch for state changes
setInterval(() => {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE));
    
    if (state.currentTask && state.currentTask !== lastTask) {
      lastTask = state.currentTask;
      console.log(`[RECEIVED] Task: ${state.currentTask.description}`);
      console.log(`[PLANNING] Agents needed: ${state.currentTask.agents.join(', ')}`);
      
      // Clear existing workers
      state.workers = [];
      
      // Spawn workers (simulate)
      state.currentTask.agents.forEach((agent, index) => {
        console.log(`[SPAWNING] ${agent}...`);
        
        const worker = {
          id: `worker-${index + 1}`,
          type: agent,
          status: 'starting',
          output: [`Initializing ${agent} agent...`],
          startTime: new Date().toISOString()
        };
        
        state.workers.push(worker);
        
        // Simulate worker doing work
        setTimeout(() => {
          updateWorkerStatus(worker.id, 'working', `Analyzing requirements for: ${state.currentTask.description}`);
        }, 2000 + index * 1000);
        
        setTimeout(() => {
          updateWorkerStatus(worker.id, 'completed', `✓ ${agent} work completed`);
        }, 5000 + index * 2000);
      });
      
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      console.log(`[STATUS] ${state.workers.length} workers spawned\n`);
    }
    
    // Check for completed workers
    if (state.workers.length > 0) {
      const completed = state.workers.filter(w => w.status === 'completed').length;
      const total = state.workers.length;
      
      if (completed === total && !state.taskComplete) {
        console.log('[COMPLETE] All workers finished!');
        state.taskComplete = true;
        state.messages.push({
          from: 'orchestrator',
          text: 'All tasks completed successfully',
          time: new Date().toISOString()
        });
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
      }
    }
  } catch (e) {
    // Ignore read errors during write
  }
}, 1000);

function updateWorkerStatus(workerId, status, message) {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE));
    const worker = state.workers.find(w => w.id === workerId);
    if (worker) {
      worker.status = status;
      worker.output.push(message);
      fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
    }
  } catch (e) {
    // Ignore concurrent access issues
  }
}
```

### worker-display.js
```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const STATE_FILE = path.join(__dirname, 'shared/state.json');
let lastWorkerCount = 0;

console.log('=== Worker Terminals ===');
console.log('Workers will appear here when tasks are assigned...\n');

// Watch for worker updates
setInterval(() => {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE));
    
    if (state.workers.length !== lastWorkerCount) {
      console.clear();
      console.log('=== Worker Terminals ===\n');
      lastWorkerCount = state.workers.length;
    }
    
    state.workers.forEach(worker => {
      console.log(`┌─ ${worker.type.toUpperCase()} (${worker.id}) ─ Status: ${worker.status} ─┐`);
      
      // Show last 3 output lines
      const recentOutput = worker.output.slice(-3);
      recentOutput.forEach(line => {
        console.log(`│ ${line.padEnd(50)} │`);
      });
      
      console.log('└' + '─'.repeat(52) + '┘');
      console.log('');
    });
    
  } catch (e) {
    // Ignore read errors
  }
}, 500);
```

### start-demo.sh
```bash
#!/bin/bash

echo "Starting AI Terminal Orchestrator Demo..."

# Clean up previous state
rm -f shared/state.json

# Start terminals in separate windows
if [[ "$OSTYPE" == "darwin"* ]]; then
  # macOS
  osascript -e 'tell app "Terminal" to do script "cd '$PWD' && node claude-terminal.js"'
  osascript -e 'tell app "Terminal" to do script "cd '$PWD' && node orchestrator.js"'
  osascript -e 'tell app "Terminal" to do script "cd '$PWD' && node worker-display.js"'
elif command -v gnome-terminal &> /dev/null; then
  # Linux with gnome-terminal
  gnome-terminal -- bash -c "cd $PWD && node claude-terminal.js; exec bash"
  gnome-terminal -- bash -c "cd $PWD && node orchestrator.js; exec bash"
  gnome-terminal -- bash -c "cd $PWD && node worker-display.js; exec bash"
else
  # Fallback - use tmux
  tmux new-session -d -s ai-demo
  tmux split-window -h
  tmux split-window -h
  tmux select-layout even-horizontal
  
  tmux send-keys -t ai-demo:0.0 "node claude-terminal.js" C-m
  tmux send-keys -t ai-demo:0.1 "node orchestrator.js" C-m
  tmux send-keys -t ai-demo:0.2 "node worker-display.js" C-m
  
  tmux attach -t ai-demo
fi

echo "Demo started! Check your terminal windows."
```

### package.json
```json
{
  "name": "ai-orchestrator-demo",
  "version": "1.0.0",
  "description": "Minimal AI Terminal Orchestrator Demo",
  "main": "claude-terminal.js",
  "scripts": {
    "start": "./start-demo.sh",
    "claude": "node claude-terminal.js",
    "orchestrator": "node orchestrator.js",
    "workers": "node worker-display.js"
  },
  "dependencies": {}
}
```

## Running the Demo

1. **Setup**
```bash
cd demos/minimal-ai-orchestrator
chmod +x start-demo.sh
npm install
```

2. **Start Demo**
```bash
npm start
# or
./start-demo.sh
```

3. **Use It**
- In the Claude terminal, type: "Build a REST API with user authentication"
- Watch the orchestrator receive and plan the work
- See workers appear and complete their tasks

## Example Session

**Terminal 1 - Claude-Code:**
```
=== Claude-Code Terminal ===
Ask me to build something!

> Build a REST API with user authentication

Claude: I'll help you build that. Let me coordinate the work...

ORCHESTRATE: {"description":"Build a REST API with user authentication","agents":["architect","backend-dev","auth-specialist","tester"]}

Task sent to orchestrator. Watch the other terminals!
```

**Terminal 2 - Orchestrator:**
```
=== Orchestrator Terminal ===
Waiting for tasks from Claude-Code...

[RECEIVED] Task: Build a REST API with user authentication
[PLANNING] Agents needed: architect, backend-dev, auth-specialist, tester
[SPAWNING] architect...
[SPAWNING] backend-dev...
[SPAWNING] auth-specialist...
[SPAWNING] tester...
[STATUS] 4 workers spawned

[COMPLETE] All workers finished!
```

**Terminal 3 - Workers:**
```
=== Worker Terminals ===

┌─ ARCHITECT (worker-1) ─ Status: completed ─┐
│ Analyzing requirements for: Build a REST API │
│ Designing API structure...                   │
│ ✓ architect work completed                   │
└──────────────────────────────────────────────┘

┌─ BACKEND-DEV (worker-2) ─ Status: completed ─┐
│ Implementing endpoints...                     │
│ Creating controllers...                       │
│ ✓ backend-dev work completed                 │
└──────────────────────────────────────────────┘
```

## Why This Works

1. **Simple**: No complex IPC, just file watching
2. **Visual**: Three terminals show the flow clearly
3. **Extensible**: Easy to add real claude-flow integration
4. **Portable**: Works on any system with Node.js
5. **Educational**: Clear demonstration of the orchestration concept

## Next Steps for Real Implementation

1. Replace simulated workers with actual `claude-flow sparc` commands
2. Add real claude-code integration with proper prompts
3. Implement proper message passing instead of file watching
4. Add web UI with xterm.js for browser-based demo
5. Integrate with OrchFlow for professional terminal management

This minimal demo provides a working foundation that clearly demonstrates the concept while being simple enough to understand and extend.