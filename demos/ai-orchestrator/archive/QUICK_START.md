# Quick Start Guide - AI Terminal Orchestrator Demo

## 5-Minute Setup

### Prerequisites
- Node.js 18+ installed
- npm or yarn
- Git

### Step 1: Create Demo Directory
```bash
mkdir orchflow-ai-demo && cd orchflow-ai-demo
```

### Step 2: Backend Setup (2 minutes)
```bash
# Create backend
mkdir backend && cd backend
npm init -y

# Install dependencies
npm install express socket.io node-pty cors

# Create minimal server
cat > server.js << 'EOF'
const express = require('express');
const { Server } = require('socket.io');
const pty = require('node-pty');
const http = require('http');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

const terminals = new Map();

io.on('connection', (socket) => {
  console.log('Client connected');
  
  // Create chat terminal
  const chatPty = pty.spawn('bash', ['-c', `
    echo "=== AI Chat Terminal ==="
    echo "Type 'build <something>' to orchestrate work"
    echo ""
    while read line; do
      if [[ $line == build* ]]; then
        echo "AI: I'll orchestrate that task!"
        echo "[ORCHESTRATE] {\\\"task\\\":\\\"$line\\\",\\\"agents\\\":[\\\"architect\\\",\\\"coder\\\"]}"
      else
        echo "AI: Type 'build' followed by what you want"
      fi
    done
  `]);
  
  terminals.set('chat', chatPty);
  
  // Create orchestrator terminal
  const orchPty = pty.spawn('bash', ['-c', `
    echo "=== Orchestrator Terminal ==="
    echo "Waiting for tasks..."
    while read line; do
      echo "[RECEIVED] Task"
      echo "[SPAWNING] Workers..."
      sleep 2
      echo "[COMPLETE] Done!"
    done
  `]);
  
  terminals.set('orchestrator', orchPty);
  
  // Handle terminal I/O
  chatPty.onData(data => {
    socket.emit('output', { id: 'chat', data });
    if (data.includes('[ORCHESTRATE]')) {
      orchPty.write('Task received\n');
      // Spawn worker
      spawnWorker(socket);
    }
  });
  
  orchPty.onData(data => {
    socket.emit('output', { id: 'orchestrator', data });
  });
  
  socket.on('input', ({ id, data }) => {
    const term = terminals.get(id);
    if (term) term.write(data);
  });
});

function spawnWorker(socket) {
  const workerPty = pty.spawn('bash', ['-c', `
    echo "=== Worker Terminal ==="
    echo "Working on task..."
    sleep 3
    echo "✓ Task completed"
  `]);
  
  workerPty.onData(data => {
    socket.emit('output', { id: 'worker', data });
  });
  
  socket.emit('worker-spawned', { id: 'worker' });
}

server.listen(3001, () => {
  console.log('Backend running on :3001');
});
EOF

cd ..
```

### Step 3: Frontend Setup (2 minutes)
```bash
# Create frontend
mkdir frontend && cd frontend

# Create HTML file
cat > index.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <title>AI Terminal Orchestrator</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css">
  <style>
    body { margin: 0; font-family: Arial, sans-serif; }
    .container {
      display: grid;
      grid-template-columns: 1fr 1fr 2fr;
      height: 100vh;
      gap: 2px;
      background: #000;
    }
    .panel {
      background: #1e1e1e;
      display: flex;
      flex-direction: column;
    }
    .header {
      background: #2d2d2d;
      color: #fff;
      padding: 10px;
      font-size: 14px;
    }
    .terminal {
      flex: 1;
      padding: 5px;
    }
    .workers {
      overflow-y: auto;
    }
    .worker {
      border: 1px solid #444;
      margin: 5px;
      height: 200px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="panel">
      <div class="header">AI Chat</div>
      <div id="chat" class="terminal"></div>
    </div>
    <div class="panel">
      <div class="header">Orchestrator</div>
      <div id="orchestrator" class="terminal"></div>
    </div>
    <div class="panel">
      <div class="header">Workers</div>
      <div id="workers" class="workers"></div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.js"></script>
  <script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>
  <script>
    const socket = io('http://localhost:3001');
    const terminals = {};
    
    // Create terminals
    function createTerminal(id, container) {
      const term = new Terminal({
        theme: { background: '#1e1e1e' }
      });
      term.open(container);
      terminals[id] = term;
      
      term.onData(data => {
        socket.emit('input', { id, data });
      });
      
      return term;
    }
    
    // Initialize main terminals
    createTerminal('chat', document.getElementById('chat'));
    createTerminal('orchestrator', document.getElementById('orchestrator'));
    
    // Handle output
    socket.on('output', ({ id, data }) => {
      if (terminals[id]) {
        terminals[id].write(data);
      }
    });
    
    // Handle worker spawning
    socket.on('worker-spawned', ({ id }) => {
      const workerDiv = document.createElement('div');
      workerDiv.className = 'worker';
      workerDiv.innerHTML = '<div class="header">Worker</div><div id="' + id + '"></div>';
      document.getElementById('workers').appendChild(workerDiv);
      createTerminal(id, document.getElementById(id));
    });
  </script>
</body>
</html>
EOF

# Simple Python HTTP server
cat > serve.py << 'EOF'
import http.server
import socketserver

PORT = 3000
Handler = http.server.SimpleHTTPRequestHandler

with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Frontend running at http://localhost:{PORT}")
    httpd.serve_forever()
EOF

cd ..
```

### Step 4: Run the Demo (1 minute)
```bash
# Terminal 1: Start backend
cd backend
node server.js

# Terminal 2: Start frontend
cd frontend
python3 serve.py

# Open browser to http://localhost:3000
```

### Step 5: Use the Demo
1. In the AI Chat panel, type: `build a REST API`
2. Watch the Orchestrator receive the task
3. See Worker terminals spawn automatically
4. Workers complete their tasks

## What You'll See

```
┌─────────────────┬──────────────────┬────────────────────┐
│ AI Chat         │ Orchestrator     │ Workers            │
├─────────────────┼──────────────────┼────────────────────┤
│ > build REST API│ [RECEIVED] Task  │ ┌────────────────┐ │
│                 │ [SPAWNING]       │ │ Worker 1       │ │
│ AI: I'll        │ Workers...       │ │ Working...     │ │
│ orchestrate!    │                  │ │ ✓ Completed    │ │
│                 │ [COMPLETE] Done! │ └────────────────┘ │
└─────────────────┴──────────────────┴────────────────────┘
```

## Next Steps

### Add Real Claude-Code
Replace the bash mock with actual claude-code:
```javascript
const chatPty = pty.spawn('claude-code', ['--no-color']);
```

### Add Real Claude-Flow
Replace worker mock with claude-flow:
```javascript
const workerPty = pty.spawn('claude-flow', [
  'sparc', 'run', agentType, task
]);
```

### Add OrchFlow
Integrate OrchFlow for better terminal management:
```javascript
// Use OrchFlow Node bindings instead of node-pty
const { createManagedTerminal } = require('./orchflow-bindings');
```

## Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
lsof -ti:3000 | xargs kill
lsof -ti:3001 | xargs kill
```

### Permission Denied
```bash
chmod +x server.js
```

### CORS Issues
Make sure backend has CORS enabled for your frontend URL.

## Total Time: ~5 minutes

You now have a working demo showing:
- ✅ Three-panel terminal layout
- ✅ Chat → Orchestrator communication
- ✅ Dynamic worker spawning
- ✅ Real terminal emulation
- ✅ WebSocket communication

Ready to extend with real AI capabilities!