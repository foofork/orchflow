# Simple Working Demo - AI Terminal Orchestrator

## Quick Overview

A minimal demo that shows the concept in action with just 3 files:

1. **claude-monitor.js** - Watches claude-code output for orchestration commands
2. **orchestrator.js** - Manages worker terminals
3. **demo.sh** - Starts everything

## File 1: claude-monitor.js

```javascript
#!/usr/bin/env node

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== Claude-Code with Orchestration Support ===');
console.log('When Claude offers to build something complex, it can delegate to workers');
console.log('');

// Start claude-code
const claude = spawn('claude-code', process.argv.slice(2), {
  stdio: ['inherit', 'pipe', 'inherit']
});

// Monitor output
claude.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);
  
  // Look for orchestration patterns in Claude's responses
  if (output.includes('I\'ll orchestrate') || 
      output.includes('I\'ll coordinate') ||
      output.includes('Let me delegate')) {
    
    // Extract task from context
    const task = extractTask(output);
    
    if (task) {
      console.log('\n[ORCHESTRATION DETECTED]');
      
      // Send to orchestrator
      const command = {
        type: 'orchestrate',
        task: task,
        timestamp: Date.now()
      };
      
      fs.writeFileSync('/tmp/orchestrate-command.json', JSON.stringify(command));
      console.log('[SENT TO ORCHESTRATOR]\n');
    }
  }
  
  // Check for status requests
  if (output.includes('orchestration status') || output.includes('check progress')) {
    const statusFile = '/tmp/orchestrate-status.json';
    if (fs.existsSync(statusFile)) {
      const status = JSON.parse(fs.readFileSync(statusFile, 'utf8'));
      console.log('\n[ORCHESTRATION STATUS]');
      console.log(JSON.stringify(status, null, 2));
      console.log('');
    }
  }
});

function extractTask(output) {
  // Simple extraction - look for build/create/implement keywords
  const patterns = [
    /build (?:a |an )?(.+?)(?:\.|,|$)/i,
    /create (?:a |an )?(.+?)(?:\.|,|$)/i,
    /implement (?:a |an )?(.+?)(?:\.|,|$)/i,
    /orchestrate (?:a |an )?(.+?)(?:\.|,|$)/i
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }
  
  return null;
}

claude.on('exit', () => {
  process.exit();
});
```

## File 2: orchestrator.js

```javascript
#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');

class SimpleOrchestrator {
  constructor() {
    this.workers = new Map();
    this.commandFile = '/tmp/orchestrate-command.json';
    this.statusFile = '/tmp/orchestrate-status.json';
    
    // Clean up old files
    [this.commandFile, this.statusFile].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });
  }

  start() {
    console.log('=== Orchestrator Started ===');
    console.log('Waiting for orchestration commands...\n');

    // Watch for commands
    setInterval(() => {
      if (fs.existsSync(this.commandFile)) {
        const command = JSON.parse(fs.readFileSync(this.commandFile, 'utf8'));
        fs.unlinkSync(this.commandFile);
        this.handleCommand(command);
      }
      
      // Update status
      this.updateStatus();
    }, 1000);
  }

  handleCommand(command) {
    console.log(`[RECEIVED] Task: ${command.task}`);
    
    // Plan workers based on task
    const workers = this.planWorkers(command.task);
    
    console.log(`[PLANNING] Will spawn ${workers.length} workers:`);
    workers.forEach(w => console.log(`  - ${w.name}: ${w.type}`));
    
    // Spawn workers
    workers.forEach(worker => this.spawnWorker(worker));
  }

  planWorkers(task) {
    const workers = [];
    const taskLower = task.toLowerCase();
    
    // Simple keyword-based planning
    if (taskLower.includes('api') || taskLower.includes('rest')) {
      workers.push({
        name: 'api-designer',
        type: 'architect',
        task: `Design REST API structure for: ${task}`
      });
      workers.push({
        name: 'api-builder',
        type: 'backend',
        task: `Implement REST endpoints for: ${task}`
      });
    }
    
    if (taskLower.includes('auth') || taskLower.includes('user')) {
      workers.push({
        name: 'auth-specialist',
        type: 'auth',
        task: `Implement authentication for: ${task}`
      });
    }
    
    if (taskLower.includes('frontend') || taskLower.includes('ui')) {
      workers.push({
        name: 'ui-developer',
        type: 'frontend',
        task: `Build frontend for: ${task}`
      });
    }
    
    // Always add a tester if we have other workers
    if (workers.length > 0) {
      workers.push({
        name: 'test-engineer',
        type: 'tester',
        task: `Write tests for: ${task}`
      });
    }
    
    // Default worker if no specific ones matched
    if (workers.length === 0) {
      workers.push({
        name: 'general-dev',
        type: 'developer',
        task: task
      });
    }
    
    return workers;
  }

  spawnWorker(worker) {
    const workerId = `${worker.name}-${Date.now()}`;
    const outputFile = `/tmp/worker-${workerId}.log`;
    
    console.log(`[SPAWNING] ${worker.name}`);
    
    // Build claude-flow command
    const claudeFlowCmd = `claude-flow sparc run ${worker.type} "${worker.task}" > ${outputFile} 2>&1`;
    
    // Platform-specific terminal spawning
    let spawnCmd;
    const platform = os.platform();
    
    if (platform === 'darwin') {
      // macOS - Terminal.app
      spawnCmd = `osascript -e 'tell app "Terminal" to do script "echo \\"=== Worker: ${worker.name} ===\\"; ${claudeFlowCmd}; echo \\"\\nPress any key to close...\\"; read -n 1"'`;
    } else if (platform === 'linux') {
      // Linux - try gnome-terminal, xterm, or konsole
      const terminals = [
        `gnome-terminal --title="${worker.name}" -- bash -c 'echo "=== Worker: ${worker.name} ==="; ${claudeFlowCmd}; echo; read -p "Press enter to close..."'`,
        `xterm -title "${worker.name}" -e bash -c 'echo "=== Worker: ${worker.name} ==="; ${claudeFlowCmd}; echo; read -p "Press enter to close..."'`,
        `konsole --title "${worker.name}" -e bash -c 'echo "=== Worker: ${worker.name} ==="; ${claudeFlowCmd}; echo; read -p "Press enter to close..."'`
      ];
      
      // Try terminals in order
      for (const term of terminals) {
        try {
          exec(term);
          spawnCmd = term;
          break;
        } catch (e) {
          continue;
        }
      }
    } else {
      // Windows
      spawnCmd = `start "${worker.name}" cmd /k "echo === Worker: ${worker.name} === && ${claudeFlowCmd} && pause"`;
    }
    
    if (spawnCmd) {
      exec(spawnCmd);
      
      this.workers.set(workerId, {
        ...worker,
        id: workerId,
        status: 'running',
        outputFile,
        startTime: Date.now()
      });
      
      console.log(`[SPAWNED] Terminal window opened for ${worker.name}`);
    } else {
      console.error(`[ERROR] Could not spawn terminal for ${worker.name}`);
    }
  }

  updateStatus() {
    // Check worker outputs
    let updated = false;
    
    for (const [workerId, worker] of this.workers) {
      if (worker.status === 'running' && fs.existsSync(worker.outputFile)) {
        try {
          const output = fs.readFileSync(worker.outputFile, 'utf8');
          
          // Check for completion
          if (output.includes('✓') || 
              output.includes('Complete') || 
              output.includes('Finished') ||
              output.includes('Done')) {
            worker.status = 'complete';
            console.log(`[COMPLETE] ${worker.name}`);
            updated = true;
          }
        } catch (e) {
          // File might be locked, ignore
        }
      }
    }
    
    // Write status file
    const status = {
      workers: Array.from(this.workers.values()).map(w => ({
        name: w.name,
        type: w.type,
        status: w.status,
        runtime: Date.now() - w.startTime
      })),
      summary: this.getSummary()
    };
    
    fs.writeFileSync(this.statusFile, JSON.stringify(status, null, 2));
    
    if (updated) {
      console.log('[STATUS] Updated');
    }
  }

  getSummary() {
    const total = this.workers.size;
    const complete = Array.from(this.workers.values()).filter(w => w.status === 'complete').length;
    const running = total - complete;
    
    return {
      total,
      complete,
      running,
      status: running === 0 ? 'All workers complete' : `${running} workers still running`
    };
  }
}

// Start orchestrator
const orchestrator = new SimpleOrchestrator();
orchestrator.start();

// Keep running
process.stdin.resume();
```

## File 3: demo.sh

```bash
#!/bin/bash

echo "=== AI Terminal Orchestrator Demo ==="
echo ""
echo "This demo shows how Claude-Code can orchestrate work across multiple terminals"
echo ""

# Check for claude-flow
if ! command -v claude-flow &> /dev/null; then
  echo "ERROR: claude-flow not found. Please install it first:"
  echo "  npm install -g claude-flow"
  exit 1
fi

# Clean up any existing files
rm -f /tmp/orchestrate-*.json /tmp/worker-*.log

# Start orchestrator in background
echo "Starting orchestrator..."
node orchestrator.js &
ORCH_PID=$!

# Give it a moment to start
sleep 2

# Start claude-code with monitor
echo ""
echo "Starting Claude-Code with orchestration support..."
echo "Try asking Claude to build something complex!"
echo ""
echo "Example prompts:"
echo "  - 'Build a REST API with user authentication'"
echo "  - 'Create a todo app with React frontend'"
echo "  - 'Implement a chat application'"
echo ""
echo "When Claude says it will orchestrate/coordinate, watch for new terminals!"
echo ""

node claude-monitor.js

# Cleanup
kill $ORCH_PID 2>/dev/null
```

## How to Run

1. **Save the files**:
```bash
mkdir orchflow-demo
cd orchflow-demo
# Save the three files above
chmod +x demo.sh
```

2. **Install claude-flow** (if not already):
```bash
npm install -g claude-flow
```

3. **Run the demo**:
```bash
./demo.sh
```

## What Happens

1. You interact with Claude-Code normally
2. When you ask for something complex, Claude might say "I'll orchestrate this"
3. The monitor detects this and sends the task to the orchestrator
4. The orchestrator spawns worker terminals running claude-flow
5. Each worker handles its specific part (API, auth, tests, etc.)
6. You can check progress by asking Claude about "orchestration status"

## Example Session

```
> Build a REST API with user authentication

Claude: I'll help you build a REST API with user authentication. This is a complex 
task that I'll orchestrate across specialized workers...

[ORCHESTRATION DETECTED]
[SENT TO ORCHESTRATOR]

Claude: I've initiated the orchestration. You should see worker terminals opening:
- API designer for the overall structure
- Backend developer for implementation  
- Auth specialist for the authentication system
- Test engineer for comprehensive testing

You can check the orchestration status at any time.

> What's the orchestration status?

[ORCHESTRATION STATUS]
{
  "workers": [
    {"name": "api-designer", "status": "complete"},
    {"name": "api-builder", "status": "running"},
    {"name": "auth-specialist", "status": "running"},
    {"name": "test-engineer", "status": "running"}
  ],
  "summary": {
    "total": 4,
    "complete": 1,
    "running": 3,
    "status": "3 workers still running"
  }
}
```

## Why This Works

1. **Simple**: Just 3 files, ~200 lines of code total
2. **Visual**: See actual terminals spawn for each worker
3. **Flexible**: Easy to modify planning logic
4. **Real**: Uses actual claude-flow for worker tasks
5. **Transparent**: Human sees everything happening

This minimal demo shows the core concept without overwhelming complexity!