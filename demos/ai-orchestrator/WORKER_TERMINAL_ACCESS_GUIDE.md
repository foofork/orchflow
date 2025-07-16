# Worker Terminal Access Guide

## Overview

This guide details how users can access and interact with running worker terminals in the OrchFlow Terminal Architecture. Workers run in isolated tmux panes, and users can seamlessly switch between the primary terminal and any worker terminal.

## Access Methods

### 1. Natural Language Access (Primary Method)

Users can access worker terminals through natural conversation in the primary terminal:

```bash
# Natural language commands
User: "Let me see what worker 2 is doing"
User: "Show me the React developer"
User: "Connect me to the worker building the authentication component"
User: "Switch to the researcher"

# System responds by connecting to the appropriate worker
Claude: "Connecting you to the React Developer (Worker 2)..."
```

### 2. Interactive Status Dashboard

Users can view all workers and connect directly:

```bash
User: "Show me all workers"

Claude: "Here are your active workers:

🎯 Active Workers (3 running)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Research Agent [45% █████░░░░░░░] 
   └─ Task: Analyzing authentication patterns
   └─ Status: Reviewing security best practices
   └─ Pane: worker-1 | Press '1' to connect

2. React Developer [78% ████████░░░░]
   └─ Task: Building authentication component  
   └─ Status: Implementing form validation
   └─ Pane: worker-2 | Press '2' to connect

3. Test Engineer [23% ███░░░░░░░░░]
   └─ Task: Creating test suite
   └─ Status: Setting up test environment
   └─ Pane: worker-3 | Press '3' to connect

Press number to connect, or ask me to connect to any worker."
```

### 3. Direct Tmux Access

Advanced users can use standard tmux commands:

```bash
# Standard tmux navigation
tmux list-panes        # See all active panes
tmux select-pane -t 2  # Switch to worker pane 2
tmux choose-tree       # Interactive pane selector

# Tmux keyboard shortcuts
Ctrl+B then 0         # Switch to primary terminal (pane 0)
Ctrl+B then 1         # Switch to worker 1 (pane 1)
Ctrl+B then 2         # Switch to worker 2 (pane 2)
```

## Worker Terminal Experience

### Connection Process

When a user connects to a worker terminal:

```bash
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Connected to React Developer (Worker 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tmux Pane: worker-2 | Status: Building auth component
Claude-Flow Session: sparc run coder "Build React authentication component"

Worker Claude: "Hello! I'm currently working on the React authentication 
component. Here's what I'm doing:

✓ Created component structure
✓ Added TypeScript interfaces  
⚡ Currently: Implementing form validation
○ Next: Adding error handling
○ Next: Writing unit tests

You can:
- Chat with me about the implementation
- Ask me to modify the approach
- See my full progress
- Type 'back' to return to the main terminal

What would you like to do?"
```

### Interactive Worker Session

Users can fully interact with the worker's claude-flow session:

```bash
# User can give instructions to the worker
User: "Add password strength validation to the form"

Worker Claude: "Great idea! I'll add password strength validation. This will include:
- Minimum length requirements (8+ characters)
- Character complexity rules (uppercase, lowercase, numbers, symbols)
- Real-time strength indicators
- Visual feedback for users

Implementing now..."

# User can ask for details
User: "Show me the current component code"

Worker Claude: "Here's the current authentication component:

```typescript
const AuthForm: React.FC<AuthFormProps> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });

  const [passwordStrength, setPasswordStrength] = useState(0);
  
  const validatePassword = (password: string): number => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[!@#$%^&*]/.test(password)) strength++;
    return strength;
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setFormData(prev => ({ ...prev, password: newPassword }));
    setPasswordStrength(validatePassword(newPassword));
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
        placeholder="Email"
        required
      />
      <input
        type="password"
        value={formData.password}
        onChange={handlePasswordChange}
        placeholder="Password"
        required
      />
      <PasswordStrengthIndicator strength={passwordStrength} />
      <button type="submit">Login</button>
    </form>
  );
};
```

The password strength validation is now integrated. Should I continue with the next step?"
```

### Returning to Primary Terminal

Users can return to the primary terminal easily:

```bash
# Natural language return
User: "back"
User: "return to main"
User: "go back to primary terminal"

# Or use tmux shortcuts
User: [presses Ctrl+B then 0]

# System responds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔙 Returned to Primary Terminal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude: "Welcome back! I see you updated the React Developer with password 
strength validation. They're implementing that now.

Current system status:
- Research Agent: 52% complete
- React Developer: 83% complete (added password validation)
- Test Engineer: 34% complete

The React Developer is now adding the PasswordStrengthIndicator component.
Anything else you'd like to check or modify?"
```

## Technical Implementation

### Worker Connection Manager

```typescript
// src/worker-access/connection-manager.ts
export class WorkerConnectionManager {
  private activeConnections: Map<string, WorkerConnection> = new Map();
  private tmuxBackend: TmuxBackend;
  private orchestrator: DistributedOrchestrator;

  constructor(tmuxBackend: TmuxBackend, orchestrator: DistributedOrchestrator) {
    this.tmuxBackend = tmuxBackend;
    this.orchestrator = orchestrator;
  }

  async connectToWorker(workerId: string): Promise<void> {
    const worker = await this.orchestrator.getWorker(workerId);
    
    // Store current pane for return navigation
    const currentPane = await this.tmuxBackend.getCurrentPane();
    
    // Switch to worker pane
    await this.tmuxBackend.selectPane(worker.paneId);
    
    // Setup connection context
    this.activeConnections.set(workerId, {
      workerId,
      paneId: worker.paneId,
      returnPane: currentPane,
      connectedAt: new Date(),
      workerType: worker.type,
      taskDescription: worker.currentTask?.description
    });
    
    // Display connection UI
    await this.displayWorkerConnection(workerId);
  }

  async connectToWorkerByIndex(index: number): Promise<void> {
    const workers = await this.orchestrator.getActiveWorkers();
    if (index >= 0 && index < workers.length) {
      await this.connectToWorker(workers[index].id);
    }
  }

  async returnToPrimaryTerminal(workerId?: string): Promise<void> {
    const connection = workerId ? 
      this.activeConnections.get(workerId) : 
      this.getCurrentConnection();
    
    if (connection) {
      await this.tmuxBackend.selectPane(connection.returnPane);
      this.activeConnections.delete(connection.workerId);
      await this.displayReturnMessage(connection);
    }
  }

  private async displayWorkerConnection(workerId: string): Promise<void> {
    const connection = this.activeConnections.get(workerId);
    if (!connection) return;

    const worker = await this.orchestrator.getWorker(workerId);
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔗 Connected to ${worker.name} (${workerId})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Tmux Pane: ${connection.paneId} | Status: ${worker.status}`);
    console.log(`Claude-Flow Session: ${worker.command}`);
    console.log(`Task: ${worker.currentTask?.description || 'No active task'}`);
    console.log(`Connected at: ${connection.connectedAt.toLocaleTimeString()}`);
    console.log();
  }

  private async displayReturnMessage(connection: WorkerConnection): Promise<void> {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🔙 Returned to Primary Terminal`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Previous connection: ${connection.workerId}`);
    console.log(`Session duration: ${this.getSessionDuration(connection)}`);
    console.log();
  }

  private getCurrentConnection(): WorkerConnection | undefined {
    const connections = Array.from(this.activeConnections.values());
    return connections.find(conn => this.isCurrentPaneConnection(conn));
  }

  private getSessionDuration(connection: WorkerConnection): string {
    const duration = Date.now() - connection.connectedAt.getTime();
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

interface WorkerConnection {
  workerId: string;
  paneId: string;
  returnPane: string;
  connectedAt: Date;
  workerType: string;
  taskDescription?: string;
}
```

### Natural Language Navigation

```typescript
// src/primary-terminal/navigation-handler.ts
export class NavigationHandler {
  private connectionManager: WorkerConnectionManager;
  private intentRecognizer: NLIntentRecognizer;

  constructor(connectionManager: WorkerConnectionManager) {
    this.connectionManager = connectionManager;
    this.intentRecognizer = new NLIntentRecognizer();
    this.setupNavigationPatterns();
  }

  private setupNavigationPatterns(): void {
    // Worker connection patterns
    this.intentRecognizer.registerIntentHandler(
      'connect.*worker|show.*worker|let.*see.*worker',
      this.handleWorkerConnection.bind(this)
    );

    this.intentRecognizer.registerIntentHandler(
      'show.*all.*workers|list.*workers|worker.*status',
      this.handleWorkerList.bind(this)
    );

    // Return patterns
    this.intentRecognizer.registerIntentHandler(
      'back|return.*main|go.*back|primary.*terminal',
      this.handleReturnToPrimary.bind(this)
    );

    // Numeric navigation
    this.intentRecognizer.registerIntentHandler(
      '^[1-9]$',
      this.handleNumericNavigation.bind(this)
    );
  }

  async handleWorkerConnection(intent: Intent): Promise<void> {
    const workerId = this.extractWorkerId(intent);
    if (workerId) {
      await this.connectionManager.connectToWorker(workerId);
    } else {
      await this.showWorkerSelectionMenu();
    }
  }

  async handleWorkerList(intent: Intent): Promise<void> {
    const workers = await this.orchestrator.getActiveWorkers();
    await this.displayWorkerDashboard(workers);
  }

  async handleReturnToPrimary(intent: Intent): Promise<void> {
    await this.connectionManager.returnToPrimaryTerminal();
  }

  async handleNumericNavigation(intent: Intent): Promise<void> {
    const index = parseInt(intent.parameters.input) - 1;
    await this.connectionManager.connectToWorkerByIndex(index);
  }

  private extractWorkerId(intent: Intent): string | null {
    const input = intent.parameters.input.toLowerCase();
    
    // Extract worker number (e.g., "worker 2", "worker two")
    const numberMatch = input.match(/worker\s+(\d+|one|two|three|four|five|six|seven|eight|nine)/);
    if (numberMatch) {
      return this.convertToWorkerId(numberMatch[1]);
    }
    
    // Extract worker type (e.g., "react developer", "researcher")
    const typeMatch = input.match(/(react|researcher|coder|tester|analyst|developer)/);
    if (typeMatch) {
      return this.findWorkerByType(typeMatch[1]);
    }
    
    return null;
  }

  private async displayWorkerDashboard(workers: WorkerInfo[]): Promise<void> {
    console.log(`🎯 Active Workers (${workers.length} running)`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    workers.forEach((worker, index) => {
      const progressBar = this.createProgressBar(worker.progress);
      console.log(`${index + 1}. ${worker.name} [${worker.progress}% ${progressBar}]`);
      console.log(`   └─ Task: ${worker.currentTask?.description || 'No active task'}`);
      console.log(`   └─ Status: ${worker.status}`);
      console.log(`   └─ Pane: ${worker.paneId} | Press '${index + 1}' to connect`);
      console.log();
    });
    
    console.log(`Press number to connect, or ask me to connect to any worker.`);
  }

  private createProgressBar(progress: number): string {
    const filled = Math.floor(progress / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
}
```

### Keyboard Shortcuts Integration

```typescript
// src/primary-terminal/keyboard-shortcuts.ts
export class KeyboardShortcuts {
  private connectionManager: WorkerConnectionManager;
  private isEnabled: boolean = true;

  constructor(connectionManager: WorkerConnectionManager) {
    this.connectionManager = connectionManager;
    this.setupKeyboardHandlers();
  }

  private setupKeyboardHandlers(): void {
    // Enable raw mode for key detection
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
    }

    process.stdin.on('data', (key: string) => {
      if (!this.isEnabled) return;

      // Handle numeric keys (1-9) for worker selection
      if (key >= '1' && key <= '9') {
        const workerIndex = parseInt(key) - 1;
        this.connectionManager.connectToWorkerByIndex(workerIndex);
        return;
      }

      // Handle special keys
      switch (key) {
        case '\u0003': // Ctrl+C
          process.exit();
          break;
        case '\u0008': // Backspace
        case '\u007f': // Delete
          // Handle backspace/delete
          break;
        case '\r':     // Enter
        case '\n':     // New line
          // Handle enter
          break;
      }
    });
  }

  enable(): void {
    this.isEnabled = true;
  }

  disable(): void {
    this.isEnabled = false;
  }
}
```

## System Architecture

### Tmux Pane Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Session: natural-language-terminal                            │
├─────────────────────────────────────────────────────────────────┤
│  Pane 0: Primary Terminal                                      │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  🎯 Natural Language Terminal System                       │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │                                                             │  │
│  │  Claude: "Hello! I'm ready to help with development."      │  │
│  │  User: "Build a React authentication component"            │  │
│  │  Claude: "I'll create that for you..."                     │  │
│  │                                                             │  │
│  │  > _                                                        │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Pane 1: Worker 1 - Research Agent                             │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  claude-flow sparc run researcher "analyze auth patterns"  │  │
│  │                                                             │  │
│  │  Researcher: "I'm analyzing authentication patterns..."    │  │
│  │  ✓ Reviewed OAuth 2.0 implementations                      │  │
│  │  ✓ Analyzed JWT token strategies                           │  │
│  │  ⚡ Currently: Examining security best practices           │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Pane 2: Worker 2 - React Developer                            │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  claude-flow sparc run coder "build React auth component"  │  │
│  │                                                             │  │
│  │  Coder: "Building the React authentication component..."   │  │
│  │  ✓ Created component structure                             │  │
│  │  ✓ Added TypeScript interfaces                             │  │
│  │  ⚡ Currently: Implementing form validation                │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Pane 3: Worker 3 - Test Engineer                              │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │  claude-flow sparc run tester "create auth test suite"     │  │
│  │                                                             │  │
│  │  Tester: "Creating comprehensive test suite..."            │  │
│  │  ✓ Set up testing environment                              │  │
│  │  ⚡ Currently: Writing unit tests                          │  │
│  │  ○ Next: Integration tests                                 │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## User Flow Examples

### Example 1: Connecting to a Worker

```bash
# In Primary Terminal (Pane 0)
User: "Let me see what the React developer is working on"

Claude: "Connecting you to the React Developer (Worker 2)..."

# System switches to Pane 2
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 Connected to React Developer (Worker 2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# User now in Worker 2's terminal
Worker Claude: "Hello! I'm working on the React authentication component..."
```

### Example 2: Modifying Worker Behavior

```bash
# In Worker Terminal (Pane 2)
User: "Add two-factor authentication support"

Worker Claude: "Great addition! I'll integrate 2FA support. This will include:
- TOTP (Time-based One-Time Password) generation
- QR code display for authenticator apps
- Backup codes for recovery
- 2FA settings management

Implementing now..."

# User can see the work happening in real-time
```

### Example 3: Returning to Primary

```bash
# In Worker Terminal (Pane 2)
User: "back"

# System switches to Pane 0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔙 Returned to Primary Terminal
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Claude: "Welcome back! I see you added 2FA support to the React component. 
The developer is implementing that now. Current progress:
- React Developer: 85% complete (now adding 2FA)
- Research Agent: 67% complete  
- Test Engineer: 45% complete"
```

## Benefits of This Approach

1. **Seamless Integration**: Natural language navigation eliminates need to learn tmux commands
2. **Context Preservation**: System remembers where you came from and what you were doing
3. **Direct Interaction**: Full access to worker's claude-flow session when needed
4. **Flexible Access**: Both natural language and manual tmux access work simultaneously
5. **Non-Disruptive**: Workers continue their tasks while providing access when requested
6. **Intuitive UX**: Feels like managing a team of developers rather than terminal processes

## Implementation Priority

This worker access functionality should be implemented in **Phase 2** of the development roadmap, as it requires:

1. ✅ Basic tmux backend integration (Phase 1)
2. ✅ Worker spawning and management (Phase 1)
3. ✅ Primary terminal natural language processing (Phase 1)
4. **🔄 Worker connection management (Phase 2)**
5. **🔄 Navigation intent recognition (Phase 2)**
6. **🔄 Keyboard shortcuts integration (Phase 2)**

This feature significantly enhances the user experience by providing transparent access to the underlying work being performed by the distributed system.