# OrchFlow Integration Guide

Complete guide for integrating OrchFlow into your development workflow and applications.

## Table of Contents
1. [Quick Integration](#quick-integration)
2. [Development Environment Integration](#development-environment-integration)
3. [CI/CD Integration](#cicd-integration)
4. [IDE Integration](#ide-integration)
5. [Custom Application Integration](#custom-application-integration)
6. [API Integration](#api-integration)
7. [Plugin Development](#plugin-development)
8. [Enterprise Integration](#enterprise-integration)

## Quick Integration

### Basic CLI Integration

```bash
# Install OrchFlow
npm install -g @orchflow/claude-flow

# Add to your project scripts
{
  "scripts": {
    "dev": "claude-flow orchflow",
    "orchestrate": "claude-flow orchflow --config orchflow.json"
  }
}
```

### Project Configuration

Create `orchflow.json` in your project root:

```json
{
  "version": "1.0",
  "orchestrator": {
    "port": 3001,
    "maxWorkers": 8,
    "workerTimeout": 300000
  },
  "ui": {
    "theme": "dark",
    "statusPaneWidth": 30,
    "enableAnimations": true
  },
  "workers": {
    "defaults": {
      "developer": {
        "capabilities": ["javascript", "typescript", "react"],
        "resourceLimits": {
          "cpu": 50,
          "memory": 1024
        }
      },
      "tester": {
        "capabilities": ["jest", "cypress", "playwright"],
        "autoStart": ["jest --watch"]
      }
    }
  },
  "integrations": {
    "github": {
      "enabled": true,
      "token": "${GITHUB_TOKEN}"
    },
    "slack": {
      "enabled": true,
      "webhook": "${SLACK_WEBHOOK}"
    }
  }
}
```

## Development Environment Integration

### VS Code Integration

Create `.vscode/tasks.json`:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "OrchFlow: Start",
      "type": "shell",
      "command": "claude-flow orchflow",
      "presentation": {
        "reveal": "always",
        "panel": "new"
      },
      "problemMatcher": []
    },
    {
      "label": "OrchFlow: Create React Component",
      "type": "shell",
      "command": "echo 'Build a React component' | claude-flow orchflow --command",
      "problemMatcher": []
    }
  ]
}
```

Create VS Code extension settings:

```json
// .vscode/settings.json
{
  "orchflow.enable": true,
  "orchflow.defaultWorkerType": "developer",
  "orchflow.autoConnect": true,
  "orchflow.quickAccess": {
    "1": "React Developer",
    "2": "API Developer",
    "3": "Test Engineer"
  }
}
```

### Terminal Integration

#### iTerm2 (macOS)

Create profile with OrchFlow:

```bash
# ~/Library/Application Support/iTerm2/Scripts/orchflow_profile.py
#!/usr/bin/env python3
import iterm2

async def main(connection):
    app = await iterm2.async_get_app(connection)
    window = app.current_window
    
    if window is not None:
        tab = await window.async_create_tab()
        session = tab.current_session
        
        await session.async_send_text('claude-flow orchflow\n')
        await session.async_set_name('OrchFlow')

iterm2.run_until_complete(main)
```

#### Windows Terminal

Add to `settings.json`:

```json
{
  "profiles": {
    "list": [
      {
        "guid": "{61c54bbd-c2c6-5271-96e7-009a87ff44bf}",
        "name": "OrchFlow",
        "commandline": "wsl.exe claude-flow orchflow",
        "icon": "🎯",
        "colorScheme": "OrchFlow Dark"
      }
    ]
  },
  "schemes": [
    {
      "name": "OrchFlow Dark",
      "background": "#0C0C0C",
      "foreground": "#CCCCCC",
      "black": "#0C0C0C",
      "blue": "#0037DA",
      "brightBlack": "#767676",
      "brightBlue": "#3B78FF",
      "brightCyan": "#61D6D6",
      "brightGreen": "#16C60C",
      "brightPurple": "#B4009E",
      "brightRed": "#E74856",
      "brightWhite": "#F2F2F2",
      "brightYellow": "#F9F1A5",
      "cyan": "#3A96DD",
      "green": "#13A10E",
      "purple": "#881798",
      "red": "#C50F1F",
      "white": "#CCCCCC",
      "yellow": "#C19C00"
    }
  ]
}
```

### Shell Integration

#### Bash/Zsh

Add to `~/.bashrc` or `~/.zshrc`:

```bash
# OrchFlow aliases
alias of='claude-flow orchflow'
alias ofw='claude-flow orchflow --command "Show me all workers"'
alias ofc='claude-flow orchflow --command "Connect to $1"'
alias ofs='claude-flow orchflow --command "Save session as $1"'
alias ofr='claude-flow orchflow --command "Restore session $1"'

# OrchFlow functions
orchflow_task() {
  echo "$*" | claude-flow orchflow --command
}

orchflow_connect() {
  local worker_name="$1"
  claude-flow orchflow --command "Connect to $worker_name"
}

# Auto-completion
if [[ -n $ZSH_VERSION ]]; then
  _orchflow_complete() {
    local -a options
    options=(
      'start:Start OrchFlow'
      'task:Create a new task'
      'workers:List all workers'
      'connect:Connect to a worker'
      'save:Save current session'
      'restore:Restore a session'
    )
    _describe 'orchflow' options
  }
  compdef _orchflow_complete orchflow
fi
```

#### PowerShell

Add to PowerShell profile:

```powershell
# OrchFlow PowerShell integration
function Start-OrchFlow {
    claude-flow orchflow
}

function New-OrchFlowTask {
    param([string]$Task)
    $Task | claude-flow orchflow --command
}

function Get-OrchFlowWorkers {
    "Show me all workers" | claude-flow orchflow --command
}

function Connect-OrchFlowWorker {
    param([string]$WorkerName)
    "Connect to $WorkerName" | claude-flow orchflow --command
}

# Aliases
Set-Alias -Name of -Value Start-OrchFlow
Set-Alias -Name oft -Value New-OrchFlowTask
Set-Alias -Name ofw -Value Get-OrchFlowWorkers
Set-Alias -Name ofc -Value Connect-OrchFlowWorker
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/orchflow-tasks.yml
name: OrchFlow Automated Tasks

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  code-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup OrchFlow
        run: |
          npm install -g @orchflow/claude-flow
          npm install -g claude-flow@2.0.0-alpha.50
      
      - name: Automated Code Review
        run: |
          claude-flow orchflow --headless <<EOF
          Review pull request for code quality
          Check for security vulnerabilities
          Validate test coverage
          EOF
      
      - name: Post Review Results
        uses: actions/github-script@v7
        with:
          script: |
            const results = require('./orchflow-results.json');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: results.summary
            });

  automated-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run OrchFlow Test Suite
        run: |
          claude-flow orchflow --headless --config ci-orchflow.json <<EOF
          Run comprehensive test suite
          Generate coverage report
          Check for performance regressions
          EOF
      
      - name: Upload Results
        uses: actions/upload-artifact@v3
        with:
          name: orchflow-test-results
          path: .orchflow/results/
```

### GitLab CI

```yaml
# .gitlab-ci.yml
stages:
  - orchestrate
  - test
  - deploy

variables:
  ORCHFLOW_CONFIG: ci-orchflow.json

orchestrate:development:
  stage: orchestrate
  image: node:18
  before_script:
    - npm install -g @orchflow/claude-flow claude-flow@2.0.0-alpha.50
  script:
    - |
      claude-flow orchflow --headless <<EOF
      Prepare development environment
      Set up feature branch workers
      Initialize testing framework
      EOF
  artifacts:
    paths:
      - .orchflow/
    expire_in: 1 day

orchestrate:testing:
  stage: test
  dependencies:
    - orchestrate:development
  script:
    - |
      claude-flow orchflow --headless <<EOF
      Run unit tests
      Execute integration tests
      Perform security scan
      EOF
  artifacts:
    reports:
      junit: .orchflow/results/junit.xml
      coverage: .orchflow/results/coverage.xml
```

### Jenkins Integration

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        ORCHFLOW_HOME = "${WORKSPACE}/.orchflow"
    }
    
    stages {
        stage('Setup') {
            steps {
                sh 'npm install -g @orchflow/claude-flow claude-flow@2.0.0-alpha.50'
            }
        }
        
        stage('Orchestrate Build') {
            steps {
                script {
                    sh '''
                        claude-flow orchflow --headless <<EOF
                        Build application components
                        Optimize assets
                        Generate documentation
                        EOF
                    '''
                }
            }
        }
        
        stage('Orchestrate Tests') {
            parallel {
                stage('Unit Tests') {
                    steps {
                        sh 'claude-flow orchflow --task "Run unit test suite"'
                    }
                }
                stage('Integration Tests') {
                    steps {
                        sh 'claude-flow orchflow --task "Run integration tests"'
                    }
                }
                stage('E2E Tests') {
                    steps {
                        sh 'claude-flow orchflow --task "Run end-to-end tests"'
                    }
                }
            }
        }
    }
    
    post {
        always {
            archiveArtifacts artifacts: '.orchflow/results/**/*'
            publishHTML([
                allowMissing: false,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: '.orchflow/results/coverage',
                reportFiles: 'index.html',
                reportName: 'OrchFlow Coverage Report'
            ])
        }
    }
}
```

## IDE Integration

### IntelliJ IDEA / WebStorm

Create Run Configuration:

```xml
<!-- .idea/runConfigurations/OrchFlow.xml -->
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="OrchFlow" type="ShConfigurationType">
    <option name="SCRIPT_TEXT" value="claude-flow orchflow" />
    <option name="INDEPENDENT_SCRIPT_PATH" value="true" />
    <option name="SCRIPT_PATH" value="" />
    <option name="SCRIPT_OPTIONS" value="" />
    <option name="INDEPENDENT_SCRIPT_WORKING_DIRECTORY" value="true" />
    <option name="SCRIPT_WORKING_DIRECTORY" value="$PROJECT_DIR$" />
    <option name="INDEPENDENT_INTERPRETER_PATH" value="true" />
    <option name="INTERPRETER_PATH" value="/bin/bash" />
    <option name="INTERPRETER_OPTIONS" value="" />
    <option name="EXECUTE_IN_TERMINAL" value="true" />
    <option name="EXECUTE_SCRIPT_FILE" value="false" />
    <envs />
    <method v="2" />
  </configuration>
</component>
```

### Vim/Neovim Integration

```vim
" ~/.config/nvim/plugin/orchflow.vim

" OrchFlow commands
command! OrchFlow terminal claude-flow orchflow
command! -nargs=* OrchFlowTask call OrchFlowSendTask(<q-args>)
command! OrchFlowWorkers call OrchFlowSendCommand('Show me all workers')
command! -nargs=1 OrchFlowConnect call OrchFlowSendCommand('Connect to ' . <q-args>)

" Functions
function! OrchFlowSendTask(task)
    let cmd = 'echo "' . a:task . '" | claude-flow orchflow --command'
    execute 'terminal ' . cmd
endfunction

function! OrchFlowSendCommand(command)
    let cmd = 'echo "' . a:command . '" | claude-flow orchflow --command'
    execute 'terminal ' . cmd
endfunction

" Keybindings
nnoremap <leader>of :OrchFlow<CR>
nnoremap <leader>ot :OrchFlowTask 
nnoremap <leader>ow :OrchFlowWorkers<CR>
nnoremap <leader>oc :OrchFlowConnect 

" Lua configuration for Neovim
lua << EOF
require('which-key').register({
  o = {
    name = "OrchFlow",
    f = { "<cmd>OrchFlow<cr>", "Start OrchFlow" },
    t = { ":OrchFlowTask ", "Create Task" },
    w = { "<cmd>OrchFlowWorkers<cr>", "List Workers" },
    c = { ":OrchFlowConnect ", "Connect to Worker" },
  },
}, { prefix = "<leader>" })
EOF
```

### Emacs Integration

```elisp
;; ~/.emacs.d/orchflow.el

(defun orchflow-start ()
  "Start OrchFlow in a new terminal."
  (interactive)
  (term "claude-flow orchflow"))

(defun orchflow-task (task)
  "Send a task to OrchFlow."
  (interactive "sTask: ")
  (shell-command 
    (format "echo '%s' | claude-flow orchflow --command" task)))

(defun orchflow-workers ()
  "List all OrchFlow workers."
  (interactive)
  (orchflow-task "Show me all workers"))

(defun orchflow-connect (worker)
  "Connect to an OrchFlow worker."
  (interactive "sWorker name: ")
  (orchflow-task (format "Connect to %s" worker)))

;; Keybindings
(global-set-key (kbd "C-c o f") 'orchflow-start)
(global-set-key (kbd "C-c o t") 'orchflow-task)
(global-set-key (kbd "C-c o w") 'orchflow-workers)
(global-set-key (kbd "C-c o c") 'orchflow-connect)

;; Hydra for OrchFlow
(defhydra hydra-orchflow (:color blue :hint nil)
  "
  OrchFlow Commands
  ----------------------------------------------------------------
  _f_: Start OrchFlow    _t_: Create Task    _w_: List Workers
  _c_: Connect Worker    _s_: Save Session   _r_: Restore Session
  _q_: Quit
  "
  ("f" orchflow-start)
  ("t" orchflow-task)
  ("w" orchflow-workers)
  ("c" orchflow-connect)
  ("s" (orchflow-task "Save session"))
  ("r" (orchflow-task "Restore session"))
  ("q" nil))

(global-set-key (kbd "C-c o") 'hydra-orchflow/body)
```

## Custom Application Integration

### Node.js/TypeScript Integration

```typescript
// orchflow-integration.ts
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

export interface OrchFlowOptions {
  config?: string;
  port?: number;
  headless?: boolean;
  maxWorkers?: number;
}

export interface Worker {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'paused' | 'stopped';
  progress: number;
}

export class OrchFlowClient extends EventEmitter {
  private process: any;
  private options: OrchFlowOptions;

  constructor(options: OrchFlowOptions = {}) {
    super();
    this.options = options;
  }

  async start(): Promise<void> {
    const args = ['orchflow'];
    
    if (this.options.config) {
      args.push('--config', this.options.config);
    }
    
    if (this.options.headless) {
      args.push('--headless');
    }
    
    this.process = spawn('claude-flow', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      this.parseOutput(output);
    });

    this.process.on('error', (error: Error) => {
      this.emit('error', error);
    });

    this.process.on('exit', (code: number) => {
      this.emit('exit', code);
    });

    // Wait for ready
    await this.waitForReady();
  }

  async createTask(description: string): Promise<string> {
    return this.sendCommand(description);
  }

  async listWorkers(): Promise<Worker[]> {
    const response = await this.sendCommand('Show me all workers');
    return this.parseWorkers(response);
  }

  async connectToWorker(workerName: string): Promise<void> {
    await this.sendCommand(`Connect to ${workerName}`);
  }

  async saveSession(name: string): Promise<void> {
    await this.sendCommand(`Save session as "${name}"`);
  }

  async restoreSession(name: string): Promise<void> {
    await this.sendCommand(`Restore session "${name}"`);
  }

  private async sendCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.process.stdin.write(command + '\n');
      
      const timeout = setTimeout(() => {
        reject(new Error('Command timeout'));
      }, 5000);

      const handler = (data: string) => {
        clearTimeout(timeout);
        this.removeListener('output', handler);
        resolve(data);
      };

      this.once('output', handler);
    });
  }

  private parseOutput(output: string): void {
    // Parse different output types
    if (output.includes('Created worker:')) {
      const match = output.match(/Created worker: (.+)/);
      if (match) {
        this.emit('workerCreated', { name: match[1] });
      }
    }

    this.emit('output', output);
  }

  private parseWorkers(output: string): Worker[] {
    const workers: Worker[] = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/\[(\d+)\] (.+?)\s+([🟢🟡🔴])\s+(\w+)\s+\((\d+)%\)/);
      if (match) {
        workers.push({
          id: match[1],
          name: match[2],
          type: 'unknown', // Would need to parse from name
          status: match[4].toLowerCase() as any,
          progress: parseInt(match[5])
        });
      }
    }
    
    return workers;
  }

  private async waitForReady(): Promise<void> {
    return new Promise((resolve) => {
      const handler = (output: string) => {
        if (output.includes('OrchFlow ready')) {
          this.removeListener('output', handler);
          resolve();
        }
      };
      
      this.on('output', handler);
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      await new Promise(resolve => this.process.on('exit', resolve));
    }
  }
}

// Usage example
async function main() {
  const orchflow = new OrchFlowClient({
    headless: true,
    maxWorkers: 5
  });

  orchflow.on('workerCreated', (event) => {
    console.log(`New worker: ${event.name}`);
  });

  await orchflow.start();

  // Create tasks
  await orchflow.createTask('Build a complete authentication system with JWT tokens, password reset, and email verification');
  await orchflow.createTask('Create comprehensive test suite for all API endpoints with performance benchmarks');

  // List workers
  const workers = await orchflow.listWorkers();
  console.log('Active workers:', workers);

  // Connect to first worker
  if (workers.length > 0) {
    await orchflow.connectToWorker(workers[0].name);
  }

  // Save session
  await orchflow.saveSession('my-session');

  // Clean up
  await orchflow.stop();
}
```

### Python Integration

```python
# orchflow_client.py
import subprocess
import json
import asyncio
from typing import List, Dict, Optional
from dataclasses import dataclass
from enum import Enum

class WorkerStatus(Enum):
    RUNNING = "running"
    PAUSED = "paused"
    STOPPED = "stopped"

@dataclass
class Worker:
    id: str
    name: str
    type: str
    status: WorkerStatus
    progress: int

class OrchFlowClient:
    def __init__(self, config: Optional[str] = None, headless: bool = False):
        self.config = config
        self.headless = headless
        self.process = None
        
    async def start(self):
        """Start OrchFlow process."""
        cmd = ['orchflow']
        
        if self.config:
            cmd.extend(['--config', self.config])
            
        if self.headless:
            cmd.append('--headless')
            
        self.process = await asyncio.create_subprocess_exec(
            *cmd,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        # Wait for ready
        await self._wait_for_ready()
        
    async def create_task(self, description: str) -> str:
        """Create a new task."""
        response = await self._send_command(description)
        return self._parse_task_id(response)
        
    async def list_workers(self) -> List[Worker]:
        """List all active workers."""
        response = await self._send_command("Show me all workers")
        return self._parse_workers(response)
        
    async def connect_to_worker(self, worker_name: str):
        """Connect to a specific worker."""
        await self._send_command(f"Connect to {worker_name}")
        
    async def save_session(self, name: str):
        """Save current session."""
        await self._send_command(f'Save session as "{name}"')
        
    async def restore_session(self, name: str):
        """Restore a saved session."""
        await self._send_command(f'Restore session "{name}"')
        
    async def _send_command(self, command: str) -> str:
        """Send command to OrchFlow and get response."""
        if not self.process:
            raise RuntimeError("OrchFlow not started")
            
        self.process.stdin.write(f"{command}\n".encode())
        await self.process.stdin.drain()
        
        # Read response (simplified - real implementation needs better parsing)
        response = await asyncio.wait_for(
            self.process.stdout.readline(),
            timeout=5.0
        )
        
        return response.decode().strip()
        
    def _parse_workers(self, output: str) -> List[Worker]:
        """Parse worker list from output."""
        workers = []
        lines = output.split('\n')
        
        for line in lines:
            # Parse format: [1] React Developer 🟢 Running (45%)
            import re
            match = re.match(r'\[(\d+)\] (.+?)\s+[🟢🟡🔴]\s+(\w+)\s+\((\d+)%\)', line)
            if match:
                workers.append(Worker(
                    id=match.group(1),
                    name=match.group(2),
                    type='unknown',  # Would need to infer from name
                    status=WorkerStatus(match.group(3).lower()),
                    progress=int(match.group(4))
                ))
                
        return workers
        
    async def _wait_for_ready(self):
        """Wait for OrchFlow to be ready."""
        while True:
            line = await self.process.stdout.readline()
            if b"OrchFlow ready" in line:
                break
                
    async def stop(self):
        """Stop OrchFlow process."""
        if self.process:
            self.process.terminate()
            await self.process.wait()

# Usage example
async def main():
    client = OrchFlowClient(headless=True)
    
    try:
        await client.start()
        
        # Create tasks
        await client.create_task("Build a complete Python API with FastAPI, including authentication, database integration, and documentation")
        await client.create_task("Create comprehensive unit tests with pytest, including mocking, fixtures, and coverage reporting")
        
        # List workers
        workers = await client.list_workers()
        for worker in workers:
            print(f"{worker.name}: {worker.status.value} ({worker.progress}%)")
            
        # Connect to first worker
        if workers:
            await client.connect_to_worker(workers[0].name)
            
        # Save session
        await client.save_session("python-dev-session")
        
    finally:
        await client.stop()

if __name__ == "__main__":
    asyncio.run(main())
```

### REST API Wrapper

```typescript
// orchflow-api-server.ts
import express from 'express';
import { OrchFlowClient } from './orchflow-integration';

const app = express();
app.use(express.json());

const orchflow = new OrchFlowClient({ 
  headless: true,
  mode: 'inline' // Use inline mode for server integration
});

// Start OrchFlow on server start
orchflow.start().then(() => {
  console.log('OrchFlow started with unified architecture');
});

// API Endpoints
app.post('/api/tasks', async (req, res) => {
  try {
    const { description, priority = 'medium' } = req.body;
    const taskId = await orchflow.createTask(description);
    res.json({ 
      taskId, 
      description, 
      priority,
      architecture: 'unified',
      naturalLanguage: true
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/workers', async (req, res) => {
  try {
    const workers = await orchflow.listWorkers();
    res.json({ workers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/workers/:name/connect', async (req, res) => {
  try {
    const { name } = req.params;
    await orchflow.connectToWorker(name);
    res.json({ message: `Connected to ${name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { name } = req.body;
    await orchflow.saveSession(name);
    res.json({ message: `Session saved as ${name}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sessions/:name/restore', async (req, res) => {
  try {
    const { name } = req.params;
    await orchflow.restoreSession(name);
    res.json({ message: `Session ${name} restored` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for real-time updates
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

orchflow.on('workerCreated', (event) => {
  // Broadcast to all connected clients
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify({
        type: 'workerCreated',
        data: event
      }));
    }
  });
});

app.listen(3000, () => {
  console.log('OrchFlow API Server running on port 3000');
});
```

## Plugin Development

### OrchFlow Plugin Structure

```typescript
// orchflow-plugin.ts
export interface OrchFlowPlugin {
  name: string;
  version: string;
  description: string;
  
  // Lifecycle hooks
  onInit?(context: PluginContext): Promise<void>;
  onTaskCreated?(task: Task): Promise<void>;
  onWorkerSpawned?(worker: Worker): Promise<void>;
  onWorkerCompleted?(worker: Worker, result: any): Promise<void>;
  onSessionSaved?(sessionName: string): Promise<void>;
  onSessionRestored?(sessionName: string): Promise<void>;
  
  // Unified architecture hooks
  onUnifiedSetup?(orchestrator: UnifiedSetupOrchestrator): Promise<void>;
  onManagerInitialized?(managerType: string, manager: any): Promise<void>;
  onMCPToolRegistered?(toolName: string, tool: any): Promise<void>;
  
  // Command extensions
  commands?: PluginCommand[];
  
  // MCP tool extensions
  mcpTools?: PluginMCPTool[];
  
  // Legacy tool extensions (deprecated)
  tools?: PluginTool[];
}

export interface PluginContext {
  orchflow: OrchFlowAPI;
  config: any;
  logger: Logger;
}

export interface PluginCommand {
  name: string;
  description: string;
  pattern: RegExp;
  handler: (match: RegExpMatchArray, context: PluginContext) => Promise<void>;
}

export interface PluginMCPTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  handler: (params: any, context: PluginContext) => Promise<any>;
  naturalLanguage?: boolean; // Support natural language processing
  unified?: boolean; // Uses unified architecture features
}

export interface PluginTool {
  name: string;
  description: string;
  parameters: any; // JSON Schema
  handler: (params: any, context: PluginContext) => Promise<any>;
}
```

### Example Plugin: GitHub Integration

```typescript
// plugins/orchflow-github-plugin.ts
import { Octokit } from '@octokit/rest';
import { OrchFlowPlugin, PluginContext } from '../orchflow-plugin';

export class GitHubPlugin implements OrchFlowPlugin {
  name = 'github-integration';
  version = '2.0.0';
  description = 'GitHub integration for OrchFlow with unified architecture support';
  
  private octokit: Octokit;
  
  async onInit(context: PluginContext): Promise<void> {
    const token = context.config.github?.token || process.env.GITHUB_TOKEN;
    
    if (!token) {
      context.logger.warn('GitHub token not configured');
      return;
    }
    
    this.octokit = new Octokit({ auth: token });
    context.logger.info('GitHub plugin initialized');
  }
  
  commands = [
    {
      name: 'create-issue',
      description: 'Create GitHub issue from task',
      pattern: /create issue for (.+)/i,
      handler: async (match: RegExpMatchArray, context: PluginContext) => {
        const title = match[1];
        const { owner, repo } = context.config.github;
        
        const issue = await this.octokit.issues.create({
          owner,
          repo,
          title,
          body: `Created by OrchFlow task`,
          labels: ['orchflow']
        });
        
        context.logger.info(`Created issue #${issue.data.number}`);
      }
    },
    {
      name: 'list-prs',
      description: 'List open pull requests',
      pattern: /show( me)? (open )?pull requests/i,
      handler: async (match: RegExpMatchArray, context: PluginContext) => {
        const { owner, repo } = context.config.github;
        
        const prs = await this.octokit.pulls.list({
          owner,
          repo,
          state: 'open'
        });
        
        const prList = prs.data.map(pr => 
          `#${pr.number}: ${pr.title} by @${pr.user?.login}`
        ).join('\n');
        
        await context.orchflow.sendToTerminal(prList);
      }
    }
  ];
  
  mcpTools = [
    {
      name: 'github_create_pr',
      description: 'Create a pull request using natural language',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
          head: { type: 'string' },
          base: { type: 'string', default: 'main' }
        },
        required: ['title', 'head']
      },
      naturalLanguage: true,
      unified: true,
      handler: async (params: any, context: PluginContext) => {
        const { owner, repo } = context.config.github;
        
        const pr = await this.octokit.pulls.create({
          owner,
          repo,
          ...params
        });
        
        return {
          number: pr.data.number,
          url: pr.data.html_url,
          state: pr.data.state,
          architecture: 'unified'
        };
      }
    },
    {
      name: 'github_natural_task',
      description: 'Process natural language GitHub tasks',
      parameters: {
        type: 'object',
        properties: {
          task: { type: 'string' },
          context: { type: 'object' }
        },
        required: ['task']
      },
      naturalLanguage: true,
      unified: true,
      handler: async (params: any, context: PluginContext) => {
        // Process natural language GitHub tasks
        const { task } = params;
        const { owner, repo } = context.config.github;
        
        if (task.toLowerCase().includes('create issue')) {
          const match = task.match(/create issue.+?["'](.+?)["']/i);
          if (match) {
            const issue = await this.octokit.issues.create({
              owner,
              repo,
              title: match[1],
              body: `Created via OrchFlow natural language processing\n\nOriginal task: ${task}`,
              labels: ['orchflow', 'auto-created']
            });
            return {
              type: 'issue',
              number: issue.data.number,
              url: issue.data.html_url
            };
          }
        }
        
        return { message: 'GitHub task processed', task };
      }
    }
  ];
  
  async onTaskCreated(task: Task): Promise<void> {
    // Auto-create issue for high-priority tasks
    if (task.priority === 'high' && this.octokit) {
      const { owner, repo } = this.config.github;
      
      await this.octokit.issues.create({
        owner,
        repo,
        title: task.description,
        body: `OrchFlow Task ID: ${task.id}`,
        labels: ['orchflow', 'auto-created']
      });
    }
  }
}

// Register plugin
export default GitHubPlugin;
```

### Plugin Installation

```bash
# Install plugin
npm install orchflow-github-plugin@2.0.0

# Configure in orchflow.json
{
  "version": "2.0",
  "unifiedArchitecture": true,
  "plugins": [
    {
      "name": "orchflow-github-plugin",
      "version": "2.0.0",
      "config": {
        "github": {
          "owner": "myorg",
          "repo": "myrepo",
          "token": "${GITHUB_TOKEN}"
        },
        "unified": {
          "enabled": true,
          "naturalLanguage": true,
          "mcpIntegration": true
        }
      }
    }
  ]
}
```

## Enterprise Integration

### LDAP/Active Directory Integration

```typescript
// enterprise/ldap-integration.ts
import * as ldap from 'ldapjs';

export class LDAPIntegration {
  private client: ldap.Client;
  
  constructor(private config: LDAPConfig) {
    this.client = ldap.createClient({
      url: config.url
    });
  }
  
  async authenticateUser(username: string, password: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.client.bind(`cn=${username},${this.config.baseDN}`, password, (err) => {
        if (err) {
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  }
  
  async getUserGroups(username: string): Promise<string[]> {
    const opts = {
      filter: `(&(objectClass=user)(sAMAccountName=${username}))`,
      scope: 'sub',
      attributes: ['memberOf']
    };
    
    return new Promise((resolve, reject) => {
      this.client.search(this.config.baseDN, opts, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        
        const groups: string[] = [];
        
        res.on('searchEntry', (entry) => {
          const memberOf = entry.object.memberOf;
          if (Array.isArray(memberOf)) {
            groups.push(...memberOf);
          } else if (memberOf) {
            groups.push(memberOf);
          }
        });
        
        res.on('end', () => {
          resolve(groups);
        });
      });
    });
  }
  
  async getWorkerPermissions(username: string): Promise<WorkerPermissions> {
    const groups = await this.getUserGroups(username);
    
    // Map AD groups to OrchFlow permissions
    const permissions: WorkerPermissions = {
      maxWorkers: 3,
      allowedWorkerTypes: ['developer', 'tester'],
      resourceLimits: {
        cpu: 50,
        memory: 1024
      }
    };
    
    if (groups.includes('CN=Developers,OU=Groups,DC=company,DC=com')) {
      permissions.maxWorkers = 8;
      permissions.allowedWorkerTypes.push('architect', 'reviewer');
    }
    
    if (groups.includes('CN=Admins,OU=Groups,DC=company,DC=com')) {
      permissions.maxWorkers = -1; // Unlimited
      permissions.allowedWorkerTypes = ['*']; // All types
      permissions.resourceLimits = {
        cpu: 100,
        memory: 8192
      };
    }
    
    return permissions;
  }
}
```

### SSO Integration (SAML/OAuth)

```typescript
// enterprise/sso-integration.ts
import * as passport from 'passport';
import { Strategy as SamlStrategy } from 'passport-saml';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';

export class SSOIntegration {
  configureSAML(app: Express) {
    passport.use(new SamlStrategy({
      path: '/auth/saml/callback',
      entryPoint: process.env.SAML_ENTRYPOINT,
      issuer: 'orchflow',
      cert: process.env.SAML_CERT
    }, (profile, done) => {
      // Map SAML attributes to OrchFlow user
      const user = {
        id: profile.nameID,
        email: profile.email,
        name: profile.displayName,
        permissions: this.mapPermissions(profile.groups)
      };
      
      return done(null, user);
    }));
    
    app.get('/auth/saml', 
      passport.authenticate('saml', { failureRedirect: '/', failureFlash: true })
    );
    
    app.post('/auth/saml/callback',
      passport.authenticate('saml', { failureRedirect: '/', failureFlash: true }),
      (req, res) => {
        // Store user session
        req.session.user = req.user;
        res.redirect('/orchflow');
      }
    );
  }
  
  configureOAuth2(app: Express) {
    passport.use(new OAuth2Strategy({
      authorizationURL: process.env.OAUTH2_AUTH_URL,
      tokenURL: process.env.OAUTH2_TOKEN_URL,
      clientID: process.env.OAUTH2_CLIENT_ID,
      clientSecret: process.env.OAUTH2_CLIENT_SECRET,
      callbackURL: '/auth/oauth2/callback'
    }, async (accessToken, refreshToken, profile, done) => {
      // Fetch user info
      const userInfo = await this.fetchUserInfo(accessToken);
      
      const user = {
        id: userInfo.sub,
        email: userInfo.email,
        name: userInfo.name,
        permissions: await this.fetchPermissions(userInfo.sub)
      };
      
      return done(null, user);
    }));
  }
  
  private mapPermissions(groups: string[]): OrchFlowPermissions {
    // Map enterprise groups to OrchFlow permissions
    const permissions: OrchFlowPermissions = {
      canCreateWorkers: true,
      maxWorkers: 5,
      allowedWorkerTypes: ['developer', 'tester'],
      canSaveSessions: true,
      canRestoreSessions: true,
      resourceQuota: {
        cpu: 50,
        memory: 2048,
        storage: 10240
      }
    };
    
    // Enhance permissions based on groups
    if (groups.includes('developers')) {
      permissions.maxWorkers = 10;
      permissions.allowedWorkerTypes.push('architect', 'reviewer');
    }
    
    if (groups.includes('admins')) {
      permissions.maxWorkers = -1;
      permissions.allowedWorkerTypes = ['*'];
      permissions.canManageOthers = true;
      permissions.resourceQuota = {
        cpu: 100,
        memory: 16384,
        storage: -1
      };
    }
    
    return permissions;
  }
}
```

### Audit Logging

```typescript
// enterprise/audit-logger.ts
export class AuditLogger {
  constructor(private config: AuditConfig) {}
  
  async logEvent(event: AuditEvent): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: event.userId,
      action: event.action,
      resource: event.resource,
      details: event.details,
      ip: event.ip,
      sessionId: event.sessionId,
      result: event.result
    };
    
    // Log to multiple destinations
    await Promise.all([
      this.logToFile(entry),
      this.logToDatabase(entry),
      this.logToSIEM(entry)
    ]);
    
    // Trigger alerts for sensitive actions
    if (this.isSensitiveAction(event.action)) {
      await this.triggerAlert(entry);
    }
  }
  
  private async logToFile(entry: AuditLogEntry): Promise<void> {
    const filename = `audit-${new Date().toISOString().split('T')[0]}.log`;
    const logLine = JSON.stringify(entry) + '\n';
    
    await fs.appendFile(
      path.join(this.config.logDir, filename),
      logLine
    );
  }
  
  private async logToDatabase(entry: AuditLogEntry): Promise<void> {
    // Store in database for querying
    await this.db.collection('audit_logs').insertOne(entry);
  }
  
  private async logToSIEM(entry: AuditLogEntry): Promise<void> {
    // Send to SIEM system (e.g., Splunk, ELK)
    await fetch(this.config.siemEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.siemToken}`
      },
      body: JSON.stringify(entry)
    });
  }
  
  private isSensitiveAction(action: string): boolean {
    const sensitiveActions = [
      'session.restore',
      'worker.stop_all',
      'config.update',
      'user.permission_change'
    ];
    
    return sensitiveActions.includes(action);
  }
  
  private async triggerAlert(entry: AuditLogEntry): Promise<void> {
    // Send alert via multiple channels
    await Promise.all([
      this.sendEmail(entry),
      this.sendSlack(entry),
      this.sendPagerDuty(entry)
    ]);
  }
}

// Integration with OrchFlow
orchflow.on('taskCreated', async (task) => {
  await auditLogger.logEvent({
    userId: currentUser.id,
    action: 'task.create',
    resource: `task:${task.id}`,
    details: {
      description: task.description,
      type: task.type
    },
    ip: request.ip,
    sessionId: session.id,
    result: 'success'
  });
});
```

---

## Migration from v1.x to v2.0

### Key Changes in v2.0

1. **Unified Architecture**: Consolidated from 11 managers to 5 core managers
2. **Auto-Installation**: Automatic tmux installation with 9 package manager support
3. **Enhanced MCP Tools**: 7 new natural language tools replacing legacy tools
4. **Type Safety**: 100% TypeScript compliance with no production 'as any' casts
5. **Performance**: < 2 seconds startup, < 80MB memory overhead
6. **Command Changes**: `claude-flow orchflow` → `orchflow`

### Migration Steps

```bash
# 1. Update dependencies
npm uninstall -g @orchflow/claude-flow
npm install -g claude-flow@2.0.0-alpha.50
npm install -g @orchflow/claude-flow@latest

# 2. Update configuration
# orchflow.json: version "1.0" → "2.0"
# Add: "unifiedArchitecture": true
# Add: "autoInstallTmux": true
# Add: "mcpTools" configuration

# 3. Update scripts
# "claude-flow orchflow" → "orchflow"
# Add mode options: --mode=tmux, --mode=inline

# 4. Update integrations
# Use new MCP tools: orchflow_natural_task, orchflow_smart_connect
# Enable natural language processing features
```

### Breaking Changes

- **Command**: `claude-flow orchflow` → `orchflow`
- **Configuration**: New unified architecture configuration format
- **MCP Tools**: Legacy tools deprecated in favor of enhanced natural language tools
- **Plugin API**: New plugin format with MCP tool support

### Backward Compatibility

- Legacy MCP tools still work but are deprecated
- Old configuration format is automatically migrated
- Existing plugins continue to work with compatibility layer

---

This comprehensive integration guide provides everything needed to integrate OrchFlow v2.0 with unified architecture into any development workflow, CI/CD pipeline, IDE, or enterprise environment.