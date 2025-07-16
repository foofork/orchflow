# Final AI Terminal Orchestrator Architecture

## The Correct Understanding

1. **Primary Terminal**: Human uses claude-code here (NOT claude-flow)
2. **Orchestrator**: Receives work orders, manages worker terminals, reports back
3. **Worker Terminals**: Each runs claude-flow (can be simple task or full swarm)

## Conceptual Flow

```
Human → Claude-Code → Orchestrator → Worker Terminals (claude-flow)
                           ↑                    ↓
                           └──── Results ───────┘
```

## Visual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Terminal Layout                              │
├──────────────────┬──────────────────┬───────────────────────────┤
│ Primary Terminal │ Orchestrator     │ Worker Terminals          │
│ (Human + Claude) │ (Manager)        │ (Claude-Flow Tasks)       │
├──────────────────┼──────────────────┼───────────────────────────┤
│                  │                  │                           │
│ $ claude-code    │ $ ./orchestrator │ ┌─────────────────────┐ │
│                  │                  │ │ Worker 1            │ │
│ > Build a REST   │ [LISTENING]      │ │ $ claude-flow task  │ │
│   API please     │                  │ │   "create routes"   │ │
│                  │ [RECEIVED]       │ │ Working...          │ │
│ Claude: I'll     │ Task: Build API  │ │ ✓ Complete          │ │
│ help you build   │                  │ └─────────────────────┘ │
│ that. Let me     │ [SPAWNING]       │                           │
│ send this to     │ - API routes     │ ┌─────────────────────┐ │
│ orchestration... │ - Auth system    │ │ Worker 2            │ │
│                  │ - Tests          │ │ $ claude-flow swarm │ │
│ [ORCHESTRATE]    │                  │ │   "auth system"     │ │
│ {task:"Build     │ [MONITORING]     │ │ Coordinating...     │ │
│  REST API"}      │ Worker 1: 70%    │ └─────────────────────┘ │
│                  │ Worker 2: 45%    │                           │
│ > How's it going?│                  │ ┌─────────────────────┐ │
│                  │ [COMPLETE]       │ │ Worker 3            │ │
│ Claude: The      │ All tasks done   │ │ $ claude-flow sparc │ │
│ orchestrator     │                  │ │   run tester        │ │
│ reports: API     │ [SENDING RESULTS]│ │ Testing...          │ │
│ complete!        │                  │ └─────────────────────┘ │
└──────────────────┴──────────────────┴───────────────────────────┘
```

## Implementation Design

### 1. Primary Terminal (Human + Claude-Code)

The human interacts with claude-code normally. When claude-code recognizes a task that needs orchestration, it outputs a special marker:

```javascript
// claude-wrapper.js - Intercepts claude-code output
const { spawn } = require('child_process');
const net = require('net');

const claude = spawn('claude-code', ['--no-color']);

// Pipe stdin/stdout
process.stdin.pipe(claude.stdin);
claude.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);
  
  // Look for orchestration commands in Claude's output
  const orchestrateMatch = output.match(/\[ORCHESTRATE\]\s*({.*})/);
  if (orchestrateMatch) {
    try {
      const command = JSON.parse(orchestrateMatch[1]);
      sendToOrchestrator(command);
    } catch (e) {
      console.error('Failed to parse orchestration command');
    }
  }
});

function sendToOrchestrator(command) {
  // Send to orchestrator via socket/pipe/file
  const client = net.createConnection('/tmp/orchestrator.sock');
  client.write(JSON.stringify({
    type: 'new_task',
    ...command,
    timestamp: Date.now()
  }));
  client.end();
}
```

### 2. Orchestrator (Task Manager)

The orchestrator listens for tasks, spawns workers, monitors progress, and reports back:

```javascript
// orchestrator.js
const net = require('net');
const { spawn } = require('child_process');
const EventEmitter = require('events');

class Orchestrator extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.results = new Map();
    this.setupServer();
  }

  setupServer() {
    // Listen for tasks from primary terminal
    const server = net.createServer((socket) => {
      socket.on('data', (data) => {
        const command = JSON.parse(data.toString());
        this.handleCommand(command);
      });
    });
    
    server.listen('/tmp/orchestrator.sock');
    console.log('[ORCHESTRATOR] Listening for tasks...');
  }

  handleCommand(command) {
    switch (command.type) {
      case 'new_task':
        console.log(`[RECEIVED] Task: ${command.task}`);
        this.planAndExecute(command);
        break;
        
      case 'status_request':
        this.reportStatus();
        break;
    }
  }

  async planAndExecute(command) {
    // Decide what workers to spawn based on task
    const workers = this.planWorkers(command.task);
    
    console.log(`[SPAWNING] ${workers.length} workers`);
    
    for (const workerConfig of workers) {
      await this.spawnWorker(workerConfig);
    }
    
    // Monitor workers
    this.startMonitoring();
  }

  planWorkers(task) {
    // Simple planning logic - in reality this could be more sophisticated
    const taskLower = task.toLowerCase();
    const workers = [];
    
    if (taskLower.includes('api') || taskLower.includes('rest')) {
      workers.push({
        id: 'api-routes',
        type: 'task',
        command: 'claude-flow task "Create REST API routes with Express"'
      });
    }
    
    if (taskLower.includes('auth')) {
      workers.push({
        id: 'auth-system',
        type: 'swarm',
        command: 'claude-flow swarm "Build JWT authentication system" --max-agents 3'
      });
    }
    
    if (taskLower.includes('test') || workers.length > 0) {
      workers.push({
        id: 'testing',
        type: 'sparc',
        command: 'claude-flow sparc run tester "Write comprehensive tests"'
      });
    }
    
    return workers;
  }

  async spawnWorker(config) {
    const workerId = `${config.id}-${Date.now()}`;
    
    // Create output pipe for worker
    const outputPath = `/tmp/worker-${workerId}.out`;
    
    // Spawn terminal with claude-flow
    let spawnCommand;
    const platform = process.platform;
    
    if (platform === 'darwin') {
      // macOS
      spawnCommand = `osascript -e 'tell app "Terminal" to do script "${config.command} > ${outputPath} 2>&1"'`;
    } else if (platform === 'linux') {
      // Linux
      spawnCommand = `gnome-terminal -- bash -c "${config.command} > ${outputPath} 2>&1; read"`;
    } else {
      // Windows
      spawnCommand = `start cmd /k "${config.command} > ${outputPath} 2>&1"`;
    }
    
    const proc = spawn('sh', ['-c', spawnCommand]);
    
    this.workers.set(workerId, {
      ...config,
      process: proc,
      outputPath,
      status: 'running',
      progress: 0,
      startTime: Date.now()
    });
    
    console.log(`[SPAWNED] Worker ${workerId} (${config.type})`);
  }

  startMonitoring() {
    // Monitor worker outputs
    const monitorInterval = setInterval(() => {
      let allComplete = true;
      
      for (const [workerId, worker] of this.workers) {
        if (worker.status === 'running') {
          // Check output file for progress
          try {
            const output = fs.readFileSync(worker.outputPath, 'utf8');
            
            // Look for completion markers
            if (output.includes('✓') || output.includes('Complete') || output.includes('Done')) {
              worker.status = 'complete';
              console.log(`[COMPLETE] Worker ${workerId}`);
              this.results.set(workerId, output);
            } else {
              allComplete = false;
              // Estimate progress
              const progress = this.estimateProgress(output);
              if (progress !== worker.progress) {
                worker.progress = progress;
                console.log(`[PROGRESS] Worker ${workerId}: ${progress}%`);
              }
            }
          } catch (e) {
            allComplete = false;
          }
        }
      }
      
      if (allComplete) {
        clearInterval(monitorInterval);
        this.onAllComplete();
      }
    }, 1000);
  }

  estimateProgress(output) {
    // Simple heuristic - count task-related keywords
    const lines = output.split('\n').length;
    const completeMarkers = (output.match(/✓|done|complete|finished/gi) || []).length;
    return Math.min(Math.round((completeMarkers / Math.max(lines * 0.1, 1)) * 100), 90);
  }

  onAllComplete() {
    console.log('[COMPLETE] All workers finished');
    console.log('[RESULTS] Aggregating outputs...');
    
    // Send results back to primary terminal
    const results = {
      type: 'task_complete',
      workers: Array.from(this.workers.keys()),
      summary: this.generateSummary(),
      timestamp: Date.now()
    };
    
    // Write to shared location for claude-code to pick up
    fs.writeFileSync('/tmp/orchestrator-results.json', JSON.stringify(results, null, 2));
    
    console.log('[SENT] Results available');
  }

  generateSummary() {
    // Aggregate key results from all workers
    let summary = "Task completed successfully:\n";
    
    for (const [workerId, result] of this.results) {
      const worker = this.workers.get(workerId);
      summary += `\n${worker.id}:\n`;
      
      // Extract key accomplishments
      const accomplishments = result.match(/✓ .*/g) || [];
      accomplishments.forEach(item => {
        summary += `  ${item}\n`;
      });
    }
    
    return summary;
  }
}

// Start orchestrator
const orchestrator = new Orchestrator();
console.log('=== Orchestrator Started ===');
```

### 3. Worker Terminal Types

Each worker can run different claude-flow modes:

#### Simple Task Worker
```bash
claude-flow task "Implement user authentication endpoints"
```

#### SPARC Mode Worker
```bash
claude-flow sparc run backend "Create REST API with Express"
```

#### Full Swarm Worker
```bash
claude-flow swarm "Build complete authentication system" --max-agents 5
```

### 4. Communication Flow

```
1. Human asks Claude-Code to build something
   ↓
2. Claude-Code outputs [ORCHESTRATE] command
   ↓
3. Wrapper sends command to Orchestrator
   ↓
4. Orchestrator plans and spawns workers
   ↓
5. Workers execute with claude-flow
   ↓
6. Orchestrator monitors progress
   ↓
7. When complete, results sent back
   ↓
8. Claude-Code can access results and report to human
```

### 5. Simple Demo Setup

```bash
# setup.sh
#!/bin/bash

# Create necessary directories and files
mkdir -p /tmp/orchestrator
mkfifo /tmp/orchestrator/commands

# Start orchestrator
echo "Starting orchestrator..."
node orchestrator.js &

# Start primary terminal with wrapper
echo "Starting claude-code with orchestration support..."
node claude-wrapper.js
```

## Benefits of This Approach

1. **Separation of Concerns**: 
   - Primary terminal for human interaction
   - Orchestrator for task management
   - Workers for execution

2. **Flexibility**: 
   - Workers can be simple tasks or complex swarms
   - Easy to add new worker types

3. **Scalability**: 
   - Can spawn many workers in parallel
   - Orchestrator prevents bottlenecks

4. **Visibility**: 
   - See all workers running
   - Monitor progress in real-time

5. **Clean Interface**: 
   - Human talks to Claude normally
   - Orchestration happens transparently

## Extension Points

1. **Smarter Planning**: Orchestrator could use AI to plan better worker allocation
2. **Load Balancing**: Distribute work based on system resources
3. **Result Aggregation**: Combine worker outputs intelligently
4. **Error Recovery**: Restart failed workers
5. **Web UI**: Add browser-based monitoring

This architecture gives you exactly what you described - a human-in-the-loop primary terminal that delegates work through an orchestrator to multiple claude-flow workers!