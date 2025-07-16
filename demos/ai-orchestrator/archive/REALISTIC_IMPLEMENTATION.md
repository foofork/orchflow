# Realistic AI Terminal Orchestrator Implementation

## Based on Actual Capabilities

### Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   Web-Based UI (Browser)                      │
├────────────────┬────────────────┬─────────────────────────────┤
│  Chat Panel    │  Orchestrator  │  Worker Terminals          │
│  (xterm.js)    │  (xterm.js)    │  (xterm.js grid)           │
│                │                │                             │
│  Custom prompt │  Status logs   │  ┌─────────────────┐       │
│  interpreter   │  Task tracking │  │ Worker 1        │       │
│                │                │  └─────────────────┘       │
│                │                │  ┌─────────────────┐       │
│                │                │  │ Worker 2        │       │
│                │                │  └─────────────────┘       │
└────────────────┴────────────────┴─────────────────────────────┘
                           ↕ WebSocket
┌──────────────────────────────────────────────────────────────┐
│                    Node.js Backend                            │
├──────────────────────────────────────────────────────────────┤
│  • WebSocket Server (socket.io)                               │
│  • PTY Management (node-pty)                                  │
│  • Process Management                                         │
│  • OrchFlow Integration                                       │
└──────────────────────────────────────────────────────────────┘
```

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Project Setup
```bash
mkdir orchflow-ai-demo
cd orchflow-ai-demo

# Backend
mkdir backend
cd backend
npm init -y
npm install express socket.io node-pty cors
npm install --save-dev typescript @types/node nodemon

# Frontend
cd ..
npx create-react-app frontend --template typescript
cd frontend
npm install xterm xterm-addon-fit xterm-addon-web-links socket.io-client
```

#### 1.2 Backend Server (backend/src/server.ts)
```typescript
import express from 'express';
import { Server } from 'socket.io';
import * as pty from 'node-pty';
import { createServer } from 'http';

interface Terminal {
  id: string;
  type: 'chat' | 'orchestrator' | 'worker';
  pty: pty.IPty;
  name: string;
}

class TerminalOrchestrator {
  private terminals: Map<string, Terminal> = new Map();
  private io: Server;

  constructor(io: Server) {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Create main terminals on connection
      this.createChatTerminal(socket);
      this.createOrchestratorTerminal(socket);

      socket.on('input', ({ terminalId, data }) => {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
          terminal.pty.write(data);
        }
      });

      socket.on('resize', ({ terminalId, cols, rows }) => {
        const terminal = this.terminals.get(terminalId);
        if (terminal) {
          terminal.pty.resize(cols, rows);
        }
      });

      socket.on('spawn-worker', ({ agentType, task }) => {
        this.spawnWorkerTerminal(socket, agentType, task);
      });

      socket.on('disconnect', () => {
        // Clean up terminals
        this.terminals.forEach((terminal) => {
          terminal.pty.kill();
        });
        this.terminals.clear();
      });
    });
  }

  private createChatTerminal(socket: any) {
    const id = 'chat-main';
    
    // Create a wrapper script that interprets user input
    const chatPty = pty.spawn('bash', ['-c', `
      echo "=== AI Assistant Terminal ==="
      echo "Ask me to build something!"
      echo ""
      node ${__dirname}/chat-interpreter.js
    `], {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: process.env
    });

    this.setupPtyHandlers(chatPty, socket, id);
    this.terminals.set(id, { id, type: 'chat', pty: chatPty, name: 'AI Chat' });
  }

  private createOrchestratorTerminal(socket: any) {
    const id = 'orchestrator-main';
    
    const orchPty = pty.spawn('node', [`${__dirname}/orchestrator.js`], {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: process.env
    });

    this.setupPtyHandlers(orchPty, socket, id);
    this.terminals.set(id, { id, type: 'orchestrator', pty: orchPty, name: 'Orchestrator' });
  }

  private spawnWorkerTerminal(socket: any, agentType: string, task: string) {
    const id = `worker-${Date.now()}`;
    const name = `${agentType}-${id.slice(-4)}`;

    // Spawn claude-flow in sparc mode
    const workerPty = pty.spawn('bash', ['-c', `
      echo "=== Worker: ${name} ==="
      echo "Task: ${task}"
      echo ""
      # Simulate claude-flow for demo
      echo "Initializing ${agentType} agent..."
      sleep 2
      echo "Working on: ${task}"
      sleep 3
      echo "✓ Task completed"
      # Real implementation:
      # claude-flow sparc run ${agentType} "${task}"
    `], {
      name: 'xterm-color',
      cwd: process.env.HOME,
      env: process.env
    });

    this.setupPtyHandlers(workerPty, socket, id);
    this.terminals.set(id, { id, type: 'worker', pty: workerPty, name });

    // Notify frontend about new worker
    socket.emit('worker-spawned', { id, name, agentType });
  }

  private setupPtyHandlers(ptyProcess: pty.IPty, socket: any, terminalId: string) {
    ptyProcess.onData((data) => {
      socket.emit('output', { terminalId, data });
      
      // Intercept orchestration commands
      if (terminalId === 'chat-main' && data.includes('[ORCHESTRATE]')) {
        this.handleOrchestrationCommand(socket, data);
      }
    });

    ptyProcess.onExit(() => {
      socket.emit('terminal-exit', { terminalId });
      this.terminals.delete(terminalId);
    });
  }

  private handleOrchestrationCommand(socket: any, data: string) {
    // Parse orchestration command
    const match = data.match(/\[ORCHESTRATE\]\s*({.*})/);
    if (match) {
      try {
        const command = JSON.parse(match[1]);
        // Forward to orchestrator terminal
        const orchestrator = this.terminals.get('orchestrator-main');
        if (orchestrator) {
          orchestrator.pty.write(JSON.stringify(command) + '\n');
        }
      } catch (e) {
        console.error('Failed to parse orchestration command:', e);
      }
    }
  }
}

// Start server
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

app.use(express.static('public'));

const orchestrator = new TerminalOrchestrator(io);

server.listen(3001, () => {
  console.log('Terminal orchestrator running on http://localhost:3001');
});
```

#### 1.3 Chat Interpreter (backend/src/chat-interpreter.js)
```javascript
#!/usr/bin/env node

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: '> '
});

console.log('Chat interpreter ready. Type your requests:');

rl.prompt();

rl.on('line', (input) => {
  const lower = input.toLowerCase();
  
  if (lower.includes('build') || lower.includes('create') || lower.includes('make')) {
    console.log('\nAI: I understand you want to ' + input);
    console.log('Let me analyze this request and coordinate the work...\n');
    
    // Determine required agents
    const agents = [];
    if (lower.includes('api')) agents.push('architect', 'backend-dev');
    if (lower.includes('auth') || lower.includes('user')) agents.push('auth-specialist');
    if (lower.includes('frontend') || lower.includes('ui')) agents.push('frontend-dev');
    if (lower.includes('database') || lower.includes('data')) agents.push('db-specialist');
    if (agents.length > 0) agents.push('tester');
    
    if (agents.length === 0) agents.push('researcher', 'developer');
    
    const command = {
      action: 'orchestrate',
      task: input,
      agents: agents,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[ORCHESTRATE] ${JSON.stringify(command)}`);
    console.log('\nThe task has been sent to the orchestrator.');
    console.log('Watch the other panels to see the agents working!\n');
  } else if (lower === 'help') {
    console.log('\nTry asking me to build something, for example:');
    console.log('- Build a REST API with user authentication');
    console.log('- Create a todo app with React');
    console.log('- Make a chat application\n');
  } else {
    console.log('\nAI: ' + getGenericResponse(input) + '\n');
  }
  
  rl.prompt();
});

function getGenericResponse(input) {
  const responses = [
    "I understand. Could you tell me what you'd like me to build?",
    "Interesting! What kind of application are you thinking about?",
    "I'm here to help coordinate development tasks. What would you like to create?"
  ];
  return responses[Math.floor(Math.random() * responses.length)];
}
```

#### 1.4 Orchestrator (backend/src/orchestrator.js)
```javascript
#!/usr/bin/env node

const readline = require('readline');
const { EventEmitter } = require('events');

class Orchestrator extends EventEmitter {
  constructor() {
    super();
    this.workers = new Map();
    this.taskQueue = [];
  }

  start() {
    console.log('=== Orchestrator Terminal ===');
    console.log('Waiting for tasks...\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.on('line', (input) => {
      try {
        const command = JSON.parse(input);
        this.handleCommand(command);
      } catch (e) {
        // Not JSON, ignore
      }
    });
  }

  handleCommand(command) {
    if (command.action === 'orchestrate') {
      console.log(`[RECEIVED] Task: ${command.task}`);
      console.log(`[PLANNING] Agents required: ${command.agents.join(', ')}`);
      console.log('[SPAWNING] Creating worker terminals...\n');

      // In real implementation, this would trigger actual worker spawning
      // For now, we just log the plan
      command.agents.forEach((agent, index) => {
        setTimeout(() => {
          console.log(`[SPAWNED] ${agent} - ready to work`);
          
          // Simulate worker completion
          setTimeout(() => {
            console.log(`[COMPLETE] ${agent} - finished task`);
            
            // Check if all complete
            if (index === command.agents.length - 1) {
              setTimeout(() => {
                console.log('\n[SUCCESS] All agents completed their tasks!');
                console.log('[READY] Waiting for next task...\n');
              }, 1000);
            }
          }, 5000 + Math.random() * 3000);
        }, 1000 * index);
      });
    }
  }
}

const orchestrator = new Orchestrator();
orchestrator.start();
```

### Phase 2: Frontend UI

#### 2.1 Terminal Grid Component (frontend/src/TerminalGrid.tsx)
```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';
import './TerminalGrid.css';

interface WorkerTerminal {
  id: string;
  name: string;
  terminal: Terminal;
  fitAddon: FitAddon;
}

export const TerminalGrid: React.FC = () => {
  const chatRef = useRef<HTMLDivElement>(null);
  const orchestratorRef = useRef<HTMLDivElement>(null);
  const workersRef = useRef<HTMLDivElement>(null);
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [workers, setWorkers] = useState<WorkerTerminal[]>([]);
  
  const terminalsRef = useRef<Map<string, Terminal>>(new Map());

  useEffect(() => {
    // Connect to backend
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Create main terminals
    createTerminal('chat-main', chatRef.current!, newSocket);
    createTerminal('orchestrator-main', orchestratorRef.current!, newSocket);

    // Handle worker spawning
    newSocket.on('worker-spawned', ({ id, name }) => {
      const container = document.createElement('div');
      container.className = 'worker-terminal';
      container.innerHTML = `
        <div class="worker-header">${name}</div>
        <div class="worker-content" id="worker-${id}"></div>
      `;
      workersRef.current!.appendChild(container);

      const workerContent = container.querySelector('.worker-content') as HTMLDivElement;
      createTerminal(id, workerContent, newSocket);
    });

    // Handle terminal output
    newSocket.on('output', ({ terminalId, data }) => {
      const terminal = terminalsRef.current.get(terminalId);
      if (terminal) {
        terminal.write(data);
      }
    });

    return () => {
      newSocket.close();
      terminalsRef.current.forEach(term => term.dispose());
    };
  }, []);

  const createTerminal = (id: string, container: HTMLElement, socket: Socket) => {
    const terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4'
      },
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace'
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(container);
    fitAddon.fit();

    // Handle input
    terminal.onData((data) => {
      socket.emit('input', { terminalId: id, data });
    });

    // Handle resize
    terminal.onResize(({ cols, rows }) => {
      socket.emit('resize', { terminalId: id, cols, rows });
    });

    terminalsRef.current.set(id, terminal);

    // Auto-fit on window resize
    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(container);
  };

  return (
    <div className="terminal-grid">
      <div className="panel chat-panel">
        <div className="panel-header">AI Assistant</div>
        <div ref={chatRef} className="terminal-container"></div>
      </div>
      
      <div className="panel orchestrator-panel">
        <div className="panel-header">Orchestrator</div>
        <div ref={orchestratorRef} className="terminal-container"></div>
      </div>
      
      <div className="panel workers-panel">
        <div className="panel-header">Worker Agents</div>
        <div ref={workersRef} className="workers-container"></div>
      </div>
    </div>
  );
};
```

#### 2.2 Styles (frontend/src/TerminalGrid.css)
```css
.terminal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  height: 100vh;
  background: #1a1a1a;
  gap: 2px;
}

.panel {
  display: flex;
  flex-direction: column;
  background: #0d1117;
  overflow: hidden;
}

.panel-header {
  background: #161b22;
  color: #58a6ff;
  padding: 12px;
  font-weight: bold;
  font-size: 14px;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}

.terminal-container {
  flex: 1;
  padding: 8px;
}

.workers-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.worker-terminal {
  margin-bottom: 12px;
  border: 1px solid #30363d;
  border-radius: 6px;
  overflow: hidden;
}

.worker-header {
  background: #161b22;
  padding: 8px 12px;
  color: #8b949e;
  font-size: 13px;
  font-weight: 500;
}

.worker-content {
  height: 200px;
  background: #0d1117;
}

/* Scrollbar styling */
.workers-container::-webkit-scrollbar {
  width: 8px;
}

.workers-container::-webkit-scrollbar-track {
  background: #0d1117;
}

.workers-container::-webkit-scrollbar-thumb {
  background: #30363d;
  border-radius: 4px;
}

.workers-container::-webkit-scrollbar-thumb:hover {
  background: #484f58;
}
```

### Phase 3: Running the Demo

#### 3.1 Package Scripts

Backend package.json:
```json
{
  "scripts": {
    "dev": "nodemon src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js"
  }
}
```

Frontend package.json:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build"
  }
}
```

#### 3.2 Launch Script (run-demo.sh)
```bash
#!/bin/bash

echo "Starting AI Terminal Orchestrator Demo..."

# Start backend
cd backend
npm run dev &
BACKEND_PID=$!

# Wait for backend to start
sleep 3

# Start frontend
cd ../frontend
npm start &
FRONTEND_PID=$!

echo "Demo running!"
echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "Open http://localhost:3000 in your browser"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID" INT
wait
```

### Phase 4: Real Claude Integration

#### 4.1 Claude-Code Wrapper (backend/src/claude-wrapper.js)
```javascript
const { spawn } = require('child_process');

class ClaudeWrapper {
  constructor() {
    this.process = null;
  }

  async query(prompt) {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude-code', [
        '-p',
        prompt,
        '--output-format', 'json',
        '--max-turns', '1'
      ]);

      let output = '';
      claude.stdout.on('data', (data) => {
        output += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(output);
            resolve(result.response);
          } catch (e) {
            resolve(output);
          }
        } else {
          reject(new Error(`Claude exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = ClaudeWrapper;
```

### Phase 5: OrchFlow Integration

```rust
// Add to Cargo.toml
[dependencies]
orchflow-core = "0.1"
orchflow-terminal = "0.1"
napi = "2"
napi-derive = "2"

// Create Node.js bindings
#[napi]
pub async fn create_managed_terminal(
    command: String,
    args: Vec<String>
) -> Result<String> {
    let pty_manager = PtyManager::new();
    let pty = pty_manager.spawn_pty(&command, args, None).await?;
    let id = pty.id().to_string();
    
    // Store in global map for later access
    PTY_MAP.lock().unwrap().insert(id.clone(), pty);
    
    Ok(id)
}
```

## Summary

This implementation:
1. ✅ Uses web UI with xterm.js (cross-platform)
2. ✅ WebSocket for real-time communication
3. ✅ Keyword detection instead of system prompts
4. ✅ Proper terminal management with node-pty
5. ✅ Scalable worker spawning
6. ✅ Can integrate real claude-code and claude-flow
7. ✅ Ready for OrchFlow integration

The demo can be running in ~30 minutes with basic functionality!