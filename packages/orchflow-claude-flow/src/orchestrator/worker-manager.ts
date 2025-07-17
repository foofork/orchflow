import { EventEmitter } from 'events';
import { spawn } from 'child_process';
// Mock UUID implementation
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
import path from 'path';
import os from 'os';
import type { Task } from './orchflow-orchestrator';
import type { Worker, WorkerType } from '../types/unified-interfaces';

export interface WorkerConfig {
  maxWorkers: number;
  workerTimeout?: number;
  resourceLimits?: {
    maxCpu?: number;
    maxMemory?: number;
  };
}

export class WorkerManager extends EventEmitter {
  private workers: Map<string, Worker> = new Map();
  private workersByName: Map<string, Worker> = new Map();
  private config: WorkerConfig;
  private _claudeFlowPath: string;
  private resourceMonitorInterval?: NodeJS.Timeout;

  constructor(config: WorkerConfig) {
    super();
    this.config = config;
    this._claudeFlowPath = this.findClaudeFlowPath();
    this.startResourceMonitoring();
  }

  private findClaudeFlowPath(): string {
    // Look for claude-flow in various locations
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', '.bin', 'claude-flow'),
      path.join(process.cwd(), '..', '..', 'node_modules', '.bin', 'claude-flow'),
      path.join(os.homedir(), '.npm', 'bin', 'claude-flow'),
      'claude-flow' // Assume it's in PATH
    ];

    // In production, we'd check if these exist
    return possiblePaths[0];
  }

  async spawnWorker(type: string, config: any): Promise<string> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error(`Maximum worker limit (${this.config.maxWorkers}) reached`);
    }

    const workerId = `worker_${uuidv4()}`;
    const worker: Worker = {
      id: workerId,
      name: config.descriptiveName || `${type} Worker`,
      type: type as WorkerType,
      task: config.task || `${type} work`,
      status: 'spawning',
      context: {
        conversationHistory: [],
        sharedKnowledge: {
          facts: {},
          patterns: {},
          insights: {},
          bestPractices: {}
        },
        codeArtifacts: [],
        decisions: []
      },
      progress: 0,
      createdAt: new Date(),
      lastActive: new Date(),
      children: [],
      descriptiveName: config.descriptiveName || `${type} Worker`,
      quickAccessKey: config.quickAccessKey,
      resources: {
        cpuUsage: 0,
        memoryUsage: 0
      },
      capabilities: this.getCapabilitiesForType(type),
      startTime: new Date(),
      output: [],
      config
    };

    this.workers.set(workerId, worker);
    this.workersByName.set(worker.descriptiveName.toLowerCase(), worker);

    try {
      if (this.isTmuxAvailable()) {
        await this.spawnTmuxWorker(worker, config.command);
      } else {
        await this.spawnProcessWorker(worker, config.command);
      }

      worker.status = 'running';
      this.emit('workerSpawned', worker);
    } catch (error) {
      worker.status = 'error';
      this.emit('workerError', { worker, error });
      throw error;
    }

    return workerId;
  }

  private async spawnTmuxWorker(worker: Worker, command: string): Promise<void> {
    const sessionName = `orchflow_${worker.id}`;
    worker.tmuxSession = sessionName;

    // Create tmux session with descriptive name
    const tmuxCommand = `tmux new-session -d -s ${sessionName} -n "${worker.descriptiveName}" ${command}`;

    await this.execCommand(tmuxCommand);

    worker.connection = {
      type: 'tmux',
      sessionName
    };
  }

  private async spawnProcessWorker(worker: Worker, command: string): Promise<void> {
    const [cmd, ...args] = command.split(' ');

    const process = spawn(cmd, args, {
      shell: true,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    worker.process = process;
    worker.connection = {
      type: 'process',
      pid: process.pid
    };

    // Capture output
    process.stdout?.on('data', (data) => {
      const output = data.toString();
      worker.output.push(output);
      worker.lastActive = new Date();
      this.emit('workerOutput', { worker, output });
    });

    process.stderr?.on('data', (data) => {
      const output = data.toString();
      worker.output.push(`[ERROR] ${output}`);
      this.emit('workerError', { worker, error: output });
    });

    process.on('exit', (code) => {
      worker.status = 'stopped';
      this.emit('workerStopped', { worker, code });
    });
  }

  private isTmuxAvailable(): boolean {
    // Check if tmux is available
    try {
      const result = require('child_process').execSync('which tmux', { stdio: 'pipe' });
      return !!result;
    } catch {
      return false;
    }
  }

  async assignTask(workerId: string, task: Task): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (worker.currentTask) {
      throw new Error(`Worker ${workerId} is already assigned to a task`);
    }

    worker.currentTask = task;
    worker.lastActive = new Date();

    // Send task to worker (implementation depends on worker type)
    if (worker.tmuxSession) {
      // Send command to tmux session
      const command = this.buildTaskCommand(task);
      await this.execCommand(`tmux send-keys -t ${worker.tmuxSession} "${command}" Enter`);
    } else if (worker.process) {
      // Send to process stdin
      const command = this.buildTaskCommand(task);
      worker.process.stdin?.write(`${command}\n`);
    }

    this.emit('taskAssigned', { worker, task });
  }

  private buildTaskCommand(task: Task): string {
    // Convert task to claude-flow command
    // This is a simplified version - real implementation would be more sophisticated
    return task.claudeFlowCommand || `Execute task: ${task.description}`;
  }

  async pauseWorker(workerIdOrName: string): Promise<void> {
    const worker = this.findWorker(workerIdOrName);
    if (!worker) {
      throw new Error(`Worker ${workerIdOrName} not found`);
    }

    if (worker.tmuxSession) {
      // Send Ctrl+Z to pause
      await this.execCommand(`tmux send-keys -t ${worker.tmuxSession} C-z`);
    } else if (worker.process) {
      // Send SIGSTOP to pause process
      process.kill(worker.process.pid, 'SIGSTOP');
    }

    worker.status = 'paused';
    this.emit('workerPaused', worker);
  }

  async resumeWorker(workerIdOrName: string): Promise<void> {
    const worker = this.findWorker(workerIdOrName);
    if (!worker) {
      throw new Error(`Worker ${workerIdOrName} not found`);
    }

    if (worker.tmuxSession) {
      // Send 'fg' to resume
      await this.execCommand(`tmux send-keys -t ${worker.tmuxSession} "fg" Enter`);
    } else if (worker.process) {
      // Send SIGCONT to resume process
      process.kill(worker.process.pid, 'SIGCONT');
    }

    worker.status = 'running';
    this.emit('workerResumed', worker);
  }

  async stopWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) {
      throw new Error(`Worker ${workerId} not found`);
    }

    if (worker.tmuxSession) {
      await this.execCommand(`tmux kill-session -t ${worker.tmuxSession}`);
    } else if (worker.process) {
      worker.process.kill();
    }

    worker.status = 'stopped';
    this.workers.delete(workerId);
    this.workersByName.delete(worker.descriptiveName.toLowerCase());
    this.emit('workerStopped', worker);
  }

  async getWorker(workerIdOrName: string): Promise<Worker | undefined> {
    return this.findWorker(workerIdOrName);
  }

  private findWorker(workerIdOrName: string): Worker | undefined {
    // Try to find by ID first
    let worker = this.workers.get(workerIdOrName);
    if (worker) {return worker;}

    // Try to find by name (case-insensitive)
    worker = this.workersByName.get(workerIdOrName.toLowerCase());
    if (worker) {return worker;}

    // Try fuzzy match on descriptive name
    const searchTerm = workerIdOrName.toLowerCase();
    for (const [name, w] of this.workersByName) {
      if (name.includes(searchTerm)) {
        return w;
      }
    }

    return undefined;
  }

  async listWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  getWorkers(): Worker[] {
    return Array.from(this.workers.values());
  }

  private getCapabilitiesForType(type: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      'research': ['analyze', 'search', 'summarize', 'investigate'],
      'code': ['typescript', 'javascript', 'python', 'git', 'develop'],
      'test': ['jest', 'mocha', 'pytest', 'testing', 'validation'],
      'analysis': ['data-analysis', 'visualization', 'reporting', 'metrics'],
      'swarm': ['coordination', 'parallel-execution', 'orchestration'],
      'hive-mind': ['collective-intelligence', 'consensus', 'distributed']
    };

    return capabilityMap[type] || ['general'];
  }

  private startResourceMonitoring(): void {
    this.resourceMonitorInterval = setInterval(() => {
      this.updateResourceUsage();
    }, 5000); // Update every 5 seconds
  }

  private async updateResourceUsage(): Promise<void> {
    for (const worker of this.workers.values()) {
      if (worker.process?.pid) {
        // In a real implementation, we'd get actual CPU/memory usage
        // For now, simulate with random values
        worker.resources.cpuUsage = Math.random() * 100;
        worker.resources.memoryUsage = Math.random() * 1024; // MB
      }
    }
  }

  private async execCommand(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      require('child_process').exec(command, (error: any, stdout: string, stderr: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async shutdown(): Promise<void> {
    // Stop resource monitoring
    if (this.resourceMonitorInterval) {
      clearInterval(this.resourceMonitorInterval);
    }

    // Stop all workers
    const stopPromises = Array.from(this.workers.keys()).map(id =>
      this.stopWorker(id).catch(err => console.error(`Failed to stop worker ${id}:`, err))
    );

    await Promise.all(stopPromises);
    this.removeAllListeners();
  }
}