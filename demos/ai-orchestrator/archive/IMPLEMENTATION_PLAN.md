# AI Terminal Orchestrator Implementation Plan

## Phase 1: Foundation Setup

### 1.1 Project Structure
```
demos/ai-orchestrator/
├── frontend/
│   ├── index.html
│   ├── src/
│   │   ├── main.js
│   │   ├── terminal-manager.js
│   │   ├── websocket-client.js
│   │   └── styles.css
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── server.js
│   │   ├── orchestrator.js
│   │   ├── terminal-service.js
│   │   ├── claude-flow-integration.js
│   │   └── orchflow-bindings.js
│   ├── package.json
│   └── tsconfig.json
├── shared/
│   └── protocol.ts
└── docker-compose.yml
```

### 1.2 Core Dependencies

#### Frontend
```json
{
  "dependencies": {
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-web-links": "^0.9.0",
    "socket.io-client": "^4.7.0"
  }
}
```

#### Backend
```json
{
  "dependencies": {
    "express": "^4.19.0",
    "socket.io": "^4.7.0",
    "node-pty": "^1.0.0",
    "@anthropic-ai/claude-code": "latest",
    "claude-flow": "^2.0.0",
    "napi-rs": "^2.0.0"
  }
}
```

## Phase 2: Terminal Infrastructure

### 2.1 Terminal Manager Class
```javascript
class TerminalManager {
  constructor() {
    this.terminals = new Map();
    this.chatTerminal = null;
    this.orchestratorTerminal = null;
    this.workerTerminals = new Map();
  }

  createChatTerminal() {
    // Initialize claude-flow chat interface
  }

  createOrchestratorTerminal() {
    // Create orchestrator display terminal
  }

  spawnWorkerTerminal(agentId, agentType) {
    // Dynamically create worker terminals
  }
}
```

### 2.2 OrchFlow Rust Bindings
```rust
// Node.js bindings for OrchFlow
use napi_derive::napi;
use orchflow_core::{Manager, StateManager};
use orchflow_terminal::{PtyManager, TerminalStreamManager};

#[napi]
pub struct OrchFlowBindings {
    manager: Manager,
    pty_manager: PtyManager,
}

#[napi]
impl OrchFlowBindings {
    #[napi(constructor)]
    pub fn new() -> Self {
        // Initialize OrchFlow components
    }

    #[napi]
    pub async fn create_terminal(&self, id: String) -> Result<String> {
        // Create new terminal session
    }
}
```

## Phase 3: Communication Protocol

### 3.1 WebSocket Message Types
```typescript
// shared/protocol.ts
export enum MessageType {
  // Chat Terminal Events
  CHAT_INPUT = 'chat:input',
  CHAT_OUTPUT = 'chat:output',
  
  // Orchestrator Events
  ORCH_INSTRUCTION = 'orch:instruction',
  ORCH_STATUS = 'orch:status',
  
  // Worker Events  
  WORKER_SPAWN = 'worker:spawn',
  WORKER_OUTPUT = 'worker:output',
  WORKER_STATUS = 'worker:status',
  WORKER_COMPLETE = 'worker:complete',
  
  // System Events
  TERMINAL_READY = 'terminal:ready',
  ERROR = 'system:error'
}

export interface WorkerSpawnPayload {
  agentId: string;
  agentType: 'architect' | 'coder' | 'tester' | 'reviewer';
  task: string;
  dependencies?: string[];
}
```

### 3.2 Event Flow Implementation
```javascript
// Orchestrator receives instruction from chat
socket.on(MessageType.ORCH_INSTRUCTION, async (data) => {
  const { task, plan } = data;
  
  // Parse plan and spawn workers
  for (const step of plan.steps) {
    const agentId = await orchestrator.spawnAgent({
      type: step.agentType,
      task: step.task
    });
    
    // Notify frontend
    socket.emit(MessageType.WORKER_SPAWN, {
      agentId,
      terminalId: `worker-${agentId}`
    });
  }
});
```

## Phase 4: Claude-Flow Integration

### 4.1 Chat Terminal Integration
```javascript
class ClaudeFlowChat {
  constructor(terminalId) {
    this.terminalId = terminalId;
    this.claudeFlow = null;
  }

  async initialize() {
    // Spawn claude-flow process
    this.claudeFlow = spawn('npx', [
      'claude-flow@alpha',
      'chat',
      '--mode', 'orchestrator'
    ]);

    // Pipe I/O to terminal
    this.claudeFlow.stdout.on('data', (data) => {
      this.sendToTerminal(data);
      this.parseForOrchestration(data);
    });
  }

  parseForOrchestration(output) {
    // Extract orchestration commands
    if (output.includes('[ORCHESTRATE]')) {
      const instruction = this.extractInstruction(output);
      this.sendToOrchestrator(instruction);
    }
  }
}
```

### 4.2 Orchestrator Logic
```javascript
class Orchestrator {
  constructor() {
    this.agents = new Map();
    this.taskQueue = [];
  }

  async processInstruction(instruction) {
    // Convert natural language to execution plan
    const plan = await this.createExecutionPlan(instruction);
    
    // Spawn agents based on plan
    for (const task of plan.tasks) {
      const agent = await this.spawnAgent(task);
      this.agents.set(agent.id, agent);
    }
    
    // Start execution
    this.executeTasksInParallel();
  }

  async spawnAgent(task) {
    const agentId = `${task.type}-${Date.now()}`;
    
    // Use claude-flow to spawn specialized agent
    const agentProcess = spawn('npx', [
      'claude-flow@alpha',
      'agent',
      'spawn',
      '--type', task.type,
      '--task', task.description
    ]);

    return {
      id: agentId,
      process: agentProcess,
      status: 'spawning'
    };
  }
}
```

## Phase 5: Frontend Implementation

### 5.1 Layout Manager
```javascript
class LayoutManager {
  constructor() {
    this.container = document.getElementById('app');
    this.setupLayout();
  }

  setupLayout() {
    this.container.innerHTML = `
      <div class="terminal-grid">
        <div class="chat-panel">
          <div class="panel-header">Claude-Flow Chat</div>
          <div id="chat-terminal"></div>
        </div>
        <div class="orchestrator-panel">
          <div class="panel-header">Orchestrator</div>
          <div id="orchestrator-terminal"></div>
        </div>
        <div class="workers-panel">
          <div class="panel-header">Worker Agents</div>
          <div id="workers-container"></div>
        </div>
      </div>
    `;
  }

  addWorkerTerminal(agentId, agentType) {
    const workerHtml = `
      <div class="worker-terminal" id="worker-${agentId}">
        <div class="worker-header">
          <span class="agent-name">${agentId}</span>
          <span class="agent-status">Initializing...</span>
        </div>
        <div class="worker-terminal-content"></div>
      </div>
    `;
    
    document.getElementById('workers-container')
      .insertAdjacentHTML('beforeend', workerHtml);
  }
}
```

### 5.2 Terminal Styling
```css
.terminal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 2fr;
  height: 100vh;
  gap: 1px;
  background: #1a1a1a;
}

.chat-panel, .orchestrator-panel, .workers-panel {
  background: #0d1117;
  display: flex;
  flex-direction: column;
}

.panel-header {
  background: #161b22;
  color: #58a6ff;
  padding: 10px;
  font-weight: bold;
  border-bottom: 1px solid #30363d;
}

.workers-panel {
  overflow-y: auto;
}

.worker-terminal {
  border: 1px solid #30363d;
  margin: 8px;
  border-radius: 6px;
  overflow: hidden;
}

.worker-header {
  background: #161b22;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}

.agent-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
}

.agent-status.active {
  background: #1f6feb;
  color: white;
}

.agent-status.completed {
  background: #2ea043;
  color: white;
}
```

## Phase 6: Demo Scenarios

### 6.1 Basic REST API Demo
```javascript
const demoScenarios = {
  restApi: {
    userInput: "Build a REST API with user authentication",
    expectedAgents: [
      { type: 'architect', task: 'Design API structure' },
      { type: 'coder', task: 'Implement auth middleware' },
      { type: 'coder', task: 'Create user endpoints' },
      { type: 'tester', task: 'Write API tests' }
    ]
  }
};
```

### 6.2 Complex Application Demo
```javascript
const complexDemo = {
  userInput: "Create a full-stack todo application with React and Node.js",
  orchestrationPlan: {
    phases: [
      {
        name: "Architecture",
        agents: ['architect-01', 'architect-02']
      },
      {
        name: "Backend Development",
        agents: ['backend-01', 'backend-02', 'db-specialist']
      },
      {
        name: "Frontend Development", 
        agents: ['frontend-01', 'frontend-02', 'ui-designer']
      },
      {
        name: "Testing & Deployment",
        agents: ['tester-01', 'devops-01']
      }
    ]
  }
};
```

## Phase 7: Testing & Optimization

### 7.1 Performance Considerations
- Terminal output buffering (max 10K lines per terminal)
- Virtual scrolling for worker panel
- WebSocket message batching
- Resource cleanup on agent completion

### 7.2 Error Handling
```javascript
class ErrorHandler {
  handleAgentFailure(agentId, error) {
    // Update UI status
    // Log to orchestrator
    // Attempt recovery or reassignment
  }

  handleConnectionLoss() {
    // Reconnect WebSocket
    // Restore terminal states
    // Resume operations
  }
}
```

## Phase 8: Deployment

### 8.1 Docker Configuration
```dockerfile
# Frontend Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]

# Backend Dockerfile
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ .
EXPOSE 3001
CMD ["npm", "start"]
```

### 8.2 Docker Compose
```yaml
version: '3.8'
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - BACKEND_URL=http://backend:3001

  backend:
    build: ./backend
    ports:
      - "3001:3001"
    volumes:
      - ./orchflow-bindings:/app/bindings
    environment:
      - NODE_ENV=production
```

## Timeline

- **Week 1**: Foundation setup, basic terminal infrastructure
- **Week 2**: WebSocket communication, OrchFlow integration
- **Week 3**: Claude-Flow integration, orchestration logic
- **Week 4**: Frontend polish, demo scenarios, testing

This implementation plan provides a comprehensive roadmap for building the AI Terminal Orchestrator demo, combining OrchFlow's terminal management capabilities with claude-flow's AI orchestration features.