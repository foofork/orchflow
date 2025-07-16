# System Visibility Design - Status Pane Architecture

## Overview

The OrchFlow Terminal Architecture uses a **Dedicated Status Pane** approach to provide continuous visibility into system activity without interrupting the natural conversation flow in the primary terminal.

## Layout Design

### Split-Screen Configuration
```
┌─────────────────────┬─────────────────────────┐
│ Primary Terminal    │ Live Status Pane        │
│ (70% width)         │ (30% width)             │
│                     │                         │
│ User: "Build auth"  │ 🎯 Active Workers      │
│ Claude: "Starting..." │ ━━━━━━━━━━━━━━━━━━━━━━━ │
│                     │ 1. JWT Auth Builder     │
│                     │    [████████░░░░] 67%  │
│                     │    └─ Implementing login│
│                     │                         │
│                     │ 2. React Component Dev │
│                     │    [███░░░░░░░░░] 23%   │
│                     │    └─ Building forms   │
│                     │                         │
│                     │ 3. Security Tester     │
│                     │    [██████████░] 90%   │
│                     │    └─ Running pen tests│
│                     │                         │
│                     │ 4. API Docs Writer     │
│                     │    [░░░░░░░░░░░] Queued │
│                     │    └─ Waiting for auth │
│                     │                         │
│                     │ Press 1-4 to inspect   │
│                     │ 'r' to refresh         │
└─────────────────────┴─────────────────────────┘
```

## Key Features

### 1. Descriptive Worker Names
- **Context-aware**: "JWT Auth Builder" not "worker-1"
- **Task-specific**: "React Login Form" not "React Developer"
- **Progress-aware**: "API Docs (Finalizing)" not "Docs Writer"
- **Domain-specific**: "Database Migration" not "Coder"

### 2. Real-time Status Updates
- Live progress bars with percentage
- Current activity description
- Queue status and dependencies
- Resource usage indicators
- Error/warning alerts

### 3. Instant Navigation
```bash
# Natural language (in primary terminal)
User: "Let me see what the React developer is doing"
Claude: "Connecting you to React Component Dev..."

# Quick numeric shortcuts
User: "2"
# [instantly switches to worker 2]

# Direct worker name recognition
User: "Show me the JWT builder"
Claude: "Connecting you to JWT Auth Builder..."
```

### 4. Visual Hierarchy
```
🎯 Active Workers (3 running, 1 queued)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. JWT Auth Builder [████████░░░░] 67%
   └─ Task: Building authentication endpoints
   └─ Status: Implementing /api/auth/login
   └─ Started: 8 mins ago | Est: 4 mins remaining

2. React Component Dev [███░░░░░░░░░] 23%
   └─ Task: Creating login form components
   └─ Status: Setting up form validation
   └─ Started: 3 mins ago | Est: 12 mins remaining

3. Security Tester [██████████░] 90%
   └─ Task: Running security penetration tests
   └─ Status: Final vulnerability scan
   └─ Started: 15 mins ago | Est: 2 mins remaining

4. API Docs Writer [░░░░░░░░░░░] Queued
   └─ Task: Generate API documentation
   └─ Status: Waiting for JWT Auth Builder
   └─ Dependency: Authentication endpoints complete

📊 System Resources
CPU: [██████░░░░] 60%
Memory: [████░░░░░░] 40%
Disk I/O: [██░░░░░░░░] 20%

🔔 Recent Events
• 14:32 - JWT Auth Builder: Login endpoint complete
• 14:30 - React Component Dev: Form validation started
• 14:28 - Security Tester: Port scan complete
```

## Technical Implementation

### Status Pane Process
```typescript
// status-monitor.ts
export class StatusPane {
  private orchestrator: DistributedOrchestrator;
  private refreshInterval: number = 1000; // 1 second
  private display: Display;

  async start(): Promise<void> {
    this.display = new Display();
    this.startRefreshLoop();
    this.setupKeyboardHandlers();
  }

  private async startRefreshLoop(): Promise<void> {
    setInterval(async () => {
      const status = await this.orchestrator.getSystemStatus();
      this.display.render(status);
    }, this.refreshInterval);
  }

  private setupKeyboardHandlers(): void {
    process.stdin.on('keypress', (str, key) => {
      if (key.name >= '1' && key.name <= '9') {
        const workerIndex = parseInt(key.name) - 1;
        this.orchestrator.connectToWorkerByIndex(workerIndex);
      }
      if (key.name === 'r') {
        this.forceRefresh();
      }
    });
  }
}
```

### Worker Name Generation
```typescript
export class WorkerNameGenerator {
  generateName(config: WorkerConfig): string {
    const { type, task, domain } = config;
    
    // Generate contextual names
    if (type === 'swarm' && task.includes('auth')) {
      return 'JWT Auth Builder';
    }
    if (type === 'agent' && domain === 'react') {
      return 'React Component Dev';
    }
    if (type === 'tester' && task.includes('security')) {
      return 'Security Tester';
    }
    if (type === 'documenter') {
      return 'API Docs Writer';
    }
    
    // Fallback to descriptive default
    return `${this.capitalizeType(type)} ${this.extractTaskName(task)}`;
  }
}
```

### Tmux Integration
```bash
# Initialize split-screen layout
tmux split-window -h -p 30 'node ./status-monitor.js'
tmux select-pane -t 0  # Focus on primary terminal
```

## Benefits

1. **Continuous Visibility** - Always see what's happening
2. **Zero Interruption** - Primary conversation flow unaffected
3. **Instant Recognition** - Descriptive names enable quick identification
4. **Quick Navigation** - Press number to inspect any worker
5. **Resource Awareness** - See system load and bottlenecks
6. **Dependency Tracking** - Understand why work is queued
7. **Progress Estimation** - Know when tasks will complete

## User Experience Flow

1. **Start Work**: User makes request in primary terminal
2. **See Progress**: Status pane immediately shows new worker with descriptive name
3. **Monitor**: Watch progress bars and status updates in real-time
4. **Inspect**: Press number or ask to see specific worker
5. **Control**: Natural language commands to pause/resume/stop from primary terminal

This design eliminates the need for users to ask "what's running?" or "how's the progress?" while maintaining the natural conversation experience in the primary terminal.