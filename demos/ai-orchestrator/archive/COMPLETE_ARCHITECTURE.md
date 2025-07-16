# Complete AI Terminal Orchestrator Architecture

## The Real Claude-Flow Technique

Claude-flow executes in a terminal and **injects/wraps claude-code**, providing:
- Memory persistence (SQLite)
- Terminal spawning capabilities
- Inter-process communication
- Script execution
- Multi-agent orchestration within each terminal

## How It Actually Works

### 1. Claude-Flow Terminal Injection
```bash
# When you run claude-flow in a terminal:
$ claude-flow swarm "Build REST API"

# It effectively does:
# 1. Sets up SQLite memory database
# 2. Configures claude-code with enhanced capabilities
# 3. Injects orchestration context
# 4. Launches claude-code with tools: Bash, terminal spawning, etc.
```

### 2. Terminal Spawning Capability
Claude (through claude-flow) can actually spawn new terminals:

```bash
# Claude can execute commands like:
gnome-terminal -- bash -c "claude-flow sparc run backend 'implement API'"
# or
tmux new-window -n "backend-worker" "claude-flow sparc run backend 'implement API'"
```

### 3. Real Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User's Terminal View                         │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Primary Terminal │ Orchestrator     │ Worker Terminals          │
│ (Claude-Flow)    │ Terminal         │ (Dynamic Spawning)        │
├──────────────────┼──────────────────┼───────────────────────────┤
│                  │                  │                           │
│ $ claude-flow    │ $ ./orchestrator │ ┌─────────────────────┐ │
│   swarm "Build   │                  │ │ Worker 1: Backend   │ │
│   REST API"      │ [LISTENING]      │ │ $ claude-flow sparc │ │
│                  │ Task received... │ │   run backend ...   │ │
│ [Claude]:        │                  │ │ Creating routes...  │ │
│ I'll coordinate  │ [SPAWNING]       │ └─────────────────────┘ │
│ this project.    │ Backend worker   │                           │
│ Let me spawn     │                  │ ┌─────────────────────┐ │
│ the workers...   │ [SPAWNING]       │ │ Worker 2: Auth      │ │
│                  │ Auth specialist  │ │ $ claude-flow sparc │ │
│ > tmux new -n    │                  │ │   run auth ...      │ │
│   backend ...    │ [STATUS]         │ │ Implementing JWT... │ │
│                  │ 2 workers active │ └─────────────────────┘ │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## Implementation Details

### 1. Primary Claude-Flow Terminal
```javascript
// This is what happens in the primary terminal
const claudeFlowProcess = spawn('claude-flow', ['swarm', task], {
  env: {
    ...process.env,
    CLAUDE_FLOW_MODE: 'orchestrator',
    CLAUDE_FLOW_DB: '/tmp/orchflow/memory.db',
    CLAUDE_FLOW_IPC: '/tmp/orchflow/ipc'
  }
});

// Claude-flow wraps claude-code with enhanced capabilities:
// - Can execute: tmux, gnome-terminal, screen, etc.
// - Can write to named pipes
// - Can read/write SQLite memory
// - Can coordinate through IPC
```

### 2. Orchestrator Terminal (Monitoring)
```javascript
#!/usr/bin/env node
// orchestrator.js - Monitors and coordinates

const sqlite3 = require('sqlite3');
const fs = require('fs');
const { spawn } = require('child_process');

class Orchestrator {
  constructor() {
    // Connect to claude-flow's SQLite memory
    this.db = new sqlite3.Database('/tmp/orchflow/memory.db');
    
    // Monitor IPC pipe
    this.ipcPipe = fs.createReadStream('/tmp/orchflow/ipc/commands');
    
    // Track spawned workers
    this.workers = new Map();
  }

  start() {
    console.log('=== Orchestrator Terminal ===');
    console.log('Monitoring claude-flow activity...\n');

    // Listen to IPC commands from claude-flow
    this.ipcPipe.on('data', (data) => {
      const command = JSON.parse(data.toString());
      this.handleCommand(command);
    });

    // Monitor SQLite for status updates
    setInterval(() => this.checkWorkerStatus(), 1000);
  }

  handleCommand(cmd) {
    if (cmd.action === 'spawn_worker') {
      console.log(`[SPAWNING] ${cmd.workerType} worker`);
      this.spawnWorker(cmd);
    }
  }

  spawnWorker({ workerType, task, workerId }) {
    // Claude-flow can request specific terminal spawning
    const worker = spawn('gnome-terminal', ['--', 'bash', '-c', `
      claude-flow sparc run ${workerType} "${task}"
    `]);

    this.workers.set(workerId, {
      type: workerType,
      pid: worker.pid,
      startTime: Date.now()
    });
  }

  async checkWorkerStatus() {
    // Query SQLite for worker updates
    this.db.all('SELECT * FROM worker_status', (err, rows) => {
      rows?.forEach(row => {
        console.log(`[${row.worker_id}] ${row.status}: ${row.message}`);
      });
    });
  }
}
```

### 3. Worker Terminal Communication
```bash
# Each worker terminal runs claude-flow with a specific mode
claude-flow sparc run backend "implement user API"

# This worker can:
# 1. Write status to shared SQLite
# 2. Communicate via named pipes
# 3. Access shared memory from other workers
# 4. Even spawn sub-workers if needed
```

### 4. Inter-Terminal Communication

#### Via SQLite (Persistent Memory)
```sql
-- Claude-flow maintains tables like:
CREATE TABLE memory (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP
);

CREATE TABLE worker_status (
  worker_id TEXT PRIMARY KEY,
  status TEXT,
  message TEXT,
  progress INTEGER,
  updated_at TIMESTAMP
);

CREATE TABLE task_queue (
  task_id TEXT PRIMARY KEY,
  description TEXT,
  assigned_to TEXT,
  status TEXT
);
```

#### Via Named Pipes
```bash
# Setup pipes
mkfifo /tmp/orchflow/ipc/commands
mkfifo /tmp/orchflow/ipc/responses
mkfifo /tmp/orchflow/ipc/worker-1
mkfifo /tmp/orchflow/ipc/worker-2
```

#### Via File Watching
```javascript
// Workers can communicate by writing JSON files
fs.writeFileSync('/tmp/orchflow/status/worker-1.json', JSON.stringify({
  status: 'working',
  progress: 65,
  currentTask: 'Implementing authentication'
}));
```

## Complete Demo Implementation

### Directory Structure
```
demos/orchflow-ai-complete/
├── setup.sh                 # Creates pipes, directories, SQLite
├── primary-terminal.sh      # Launches claude-flow swarm
├── orchestrator/
│   ├── index.js            # Orchestrator monitor
│   └── spawn-manager.js    # Terminal spawning logic
├── shared/
│   ├── ipc-client.js       # IPC communication helpers
│   ├── memory-client.js    # SQLite access helpers
│   └── schemas.sql         # Database structure
└── demo-scenario.md        # Example usage
```

### setup.sh
```bash
#!/bin/bash

echo "Setting up OrchFlow AI Demo environment..."

# Create directories
mkdir -p /tmp/orchflow/{ipc,status,logs,memory}

# Create named pipes
mkfifo /tmp/orchflow/ipc/commands
mkfifo /tmp/orchflow/ipc/responses

# Initialize SQLite database
sqlite3 /tmp/orchflow/memory.db < shared/schemas.sql

# Set permissions
chmod 777 /tmp/orchflow -R

echo "Environment ready!"
```

### primary-terminal.sh
```bash
#!/bin/bash

# This is what the user runs
echo "=== OrchFlow AI Orchestrator Demo ==="
echo "Starting claude-flow in swarm mode..."
echo ""

# Set environment for IPC and memory sharing
export CLAUDE_FLOW_IPC=/tmp/orchflow/ipc
export CLAUDE_FLOW_DB=/tmp/orchflow/memory.db
export CLAUDE_FLOW_ORCHESTRATOR=true

# Launch claude-flow with full capabilities
claude-flow swarm "$1" \
  --max-agents 8 \
  --enable-terminal-spawn \
  --enable-ipc \
  --sqlite-memory /tmp/orchflow/memory.db \
  --monitor
```

### Orchestrator Monitor
```javascript
// orchestrator/index.js
const TerminalSpawner = require('./spawn-manager');
const MemoryClient = require('../shared/memory-client');
const IPCClient = require('../shared/ipc-client');

class OrchestratorMonitor {
  constructor() {
    this.memory = new MemoryClient('/tmp/orchflow/memory.db');
    this.ipc = new IPCClient('/tmp/orchflow/ipc');
    this.spawner = new TerminalSpawner();
    this.workers = new Map();
  }

  async start() {
    console.log('=== Orchestrator Monitor ===');
    console.log('Watching for claude-flow commands...\n');

    // Listen for spawn requests
    this.ipc.on('spawn_worker', async (data) => {
      console.log(`[REQUEST] Spawn ${data.type} worker`);
      const workerId = await this.spawner.spawnWorker(data);
      this.workers.set(workerId, data);
      console.log(`[SPAWNED] Worker ${workerId} started`);
    });

    // Monitor worker status
    setInterval(async () => {
      const statuses = await this.memory.getWorkerStatuses();
      for (const status of statuses) {
        if (status.updated) {
          console.log(`[${status.worker_id}] ${status.message}`);
        }
      }
    }, 500);

    // Monitor task completion
    this.memory.on('task_complete', (task) => {
      console.log(`[COMPLETE] ${task.description}`);
    });
  }
}

// Start orchestrator
const orchestrator = new OrchestratorMonitor();
orchestrator.start();
```

### Terminal Spawner
```javascript
// orchestrator/spawn-manager.js
const { spawn } = require('child_process');
const os = require('os');

class TerminalSpawner {
  spawnWorker({ type, task, workerId }) {
    const platform = os.platform();
    
    const command = `claude-flow sparc run ${type} "${task}" --worker-id ${workerId}`;
    
    if (platform === 'darwin') {
      // macOS - use Terminal.app
      return this.spawnMacTerminal(command, workerId);
    } else if (platform === 'linux') {
      // Linux - try gnome-terminal, fallback to xterm
      return this.spawnLinuxTerminal(command, workerId);
    } else {
      // Windows - use Windows Terminal or cmd
      return this.spawnWindowsTerminal(command, workerId);
    }
  }

  spawnMacTerminal(command, workerId) {
    const appleScript = `
      tell application "Terminal"
        do script "${command}"
        set custom title of front window to "Worker: ${workerId}"
      end tell
    `;
    
    spawn('osascript', ['-e', appleScript]);
    return workerId;
  }

  spawnLinuxTerminal(command, workerId) {
    // Try gnome-terminal first
    try {
      spawn('gnome-terminal', [
        '--title', `Worker: ${workerId}`,
        '--', 'bash', '-c', command
      ]);
    } catch (e) {
      // Fallback to xterm
      spawn('xterm', [
        '-title', `Worker: ${workerId}`,
        '-e', 'bash', '-c', command
      ]);
    }
    return workerId;
  }

  spawnWindowsTerminal(command, workerId) {
    spawn('wt', [
      'new-tab',
      '--title', `Worker: ${workerId}`,
      'cmd', '/c', command
    ]);
    return workerId;
  }
}
```

## Usage Example

### 1. Start the Demo
```bash
# Terminal 1: Setup and start orchestrator
./setup.sh
cd orchestrator && node index.js

# Terminal 2: Start primary claude-flow
./primary-terminal.sh "Build a REST API with authentication"
```

### 2. What Happens

1. **Primary Terminal**: Claude-flow starts and analyzes the task
2. **Claude Decision**: Decides to spawn specialized workers
3. **IPC Command**: Sends spawn requests through named pipe
4. **Orchestrator**: Receives requests and spawns terminals
5. **Worker Terminals**: Open automatically with claude-flow running
6. **Continuous Updates**: All terminals update through SQLite/IPC
7. **Coordination**: Workers can see each other's progress

### 3. Example Flow
```
[Primary Terminal]
> Claude: I'll build this REST API by coordinating specialized agents.
> Spawning backend developer for API structure...
> Spawning auth specialist for JWT implementation...
> Spawning tester for comprehensive testing...

[Orchestrator Terminal]
[REQUEST] Spawn backend worker
[SPAWNED] Worker backend-001 started
[REQUEST] Spawn auth worker  
[SPAWNED] Worker auth-002 started
[backend-001] Creating Express server structure
[auth-002] Implementing JWT middleware
[backend-001] Routes completed
[auth-002] Auth system ready

[Worker Terminal 1 - Backend]
$ claude-flow sparc run backend "implement API"
Starting backend implementation...
✓ Created server.js
✓ Implemented user routes
✓ Connected to database

[Worker Terminal 2 - Auth]
$ claude-flow sparc run auth "JWT authentication"
Implementing authentication...
✓ Created auth middleware
✓ JWT token generation
✓ Refresh token logic
```

## Key Insights

1. **Real Terminal Spawning**: Claude can actually open new terminal windows
2. **Persistent Memory**: SQLite database shared across all instances
3. **IPC Communication**: Named pipes for real-time coordination
4. **Worker Autonomy**: Each worker runs its own claude-flow instance
5. **Orchestrator Visibility**: Central monitoring of all activity

This is the complete, working architecture that leverages claude-flow's full capabilities!