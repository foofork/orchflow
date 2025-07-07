// Terminal adapter interface to abstract away tmux dependency

export interface TerminalAdapter {
  name: string;
  
  // Session management
  createSession(sessionName: string): Promise<void>;
  hasSession(sessionName: string): Promise<boolean>;
  killSession(sessionName: string): Promise<void>;
  
  // Pane management
  createPane(sessionName: string, command?: string): Promise<string>;
  killPane(paneId: string): Promise<void>;
  sendCommand(paneId: string, command: string): Promise<void>;
  captureOutput(paneId: string, lines: number): Promise<string>;
  listPanes(sessionName: string): Promise<string[]>;
  isPaneAlive(paneId: string): Promise<boolean>;
  
  // Check if the adapter is available
  isAvailable(): Promise<boolean>;
}

// Node.js child_process based adapter (no external dependencies)
import { spawn, ChildProcess } from 'child_process';
import { randomUUID } from 'crypto';

interface ProcessPane {
  id: string;
  process: ChildProcess;
  output: string[];
  sessionName: string;
}

export class NodeProcessAdapter implements TerminalAdapter {
  name = 'node-process';
  private sessions: Map<string, Set<string>> = new Map();
  private panes: Map<string, ProcessPane> = new Map();
  
  async createSession(sessionName: string): Promise<void> {
    if (!this.sessions.has(sessionName)) {
      this.sessions.set(sessionName, new Set());
    }
  }
  
  async hasSession(sessionName: string): Promise<boolean> {
    return this.sessions.has(sessionName);
  }
  
  async killSession(sessionName: string): Promise<void> {
    const paneIds = this.sessions.get(sessionName);
    if (paneIds) {
      for (const paneId of paneIds) {
        await this.killPane(paneId);
      }
      this.sessions.delete(sessionName);
    }
  }
  
  async createPane(sessionName: string, command?: string): Promise<string> {
    const paneId = `pane-${randomUUID()}`;
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    
    const proc = spawn(shell, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env },
    });
    
    const pane: ProcessPane = {
      id: paneId,
      process: proc,
      output: [],
      sessionName,
    };
    
    // Capture output
    proc.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      pane.output.push(...lines);
      // Keep last 10000 lines
      if (pane.output.length > 10000) {
        pane.output = pane.output.slice(-5000);
      }
    });
    
    proc.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      pane.output.push(...lines);
    });
    
    proc.on('exit', () => {
      this.panes.delete(paneId);
      const session = this.sessions.get(sessionName);
      if (session) {
        session.delete(paneId);
      }
    });
    
    this.panes.set(paneId, pane);
    
    const session = this.sessions.get(sessionName);
    if (session) {
      session.add(paneId);
    }
    
    // Execute initial command if provided
    if (command) {
      await this.sendCommand(paneId, command);
    }
    
    return paneId;
  }
  
  async killPane(paneId: string): Promise<void> {
    const pane = this.panes.get(paneId);
    if (pane) {
      pane.process.kill();
      this.panes.delete(paneId);
      
      const session = this.sessions.get(pane.sessionName);
      if (session) {
        session.delete(paneId);
      }
    }
  }
  
  async sendCommand(paneId: string, command: string): Promise<void> {
    const pane = this.panes.get(paneId);
    if (pane && pane.process.stdin) {
      pane.process.stdin.write(command + '\n');
    }
  }
  
  async captureOutput(paneId: string, lines: number): Promise<string> {
    const pane = this.panes.get(paneId);
    if (!pane) return '';
    
    return pane.output.slice(-lines).join('\n');
  }
  
  async listPanes(sessionName: string): Promise<string[]> {
    const paneIds = this.sessions.get(sessionName);
    return paneIds ? Array.from(paneIds) : [];
  }
  
  async isPaneAlive(paneId: string): Promise<boolean> {
    const pane = this.panes.get(paneId);
    return pane ? !pane.process.killed : false;
  }
  
  async isAvailable(): Promise<boolean> {
    return true; // Always available
  }
}

// Tmux adapter (original implementation)
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class TmuxAdapter implements TerminalAdapter {
  name = 'tmux';
  
  async createSession(sessionName: string): Promise<void> {
    await execAsync(`tmux new-session -d -s ${sessionName}`);
  }
  
  async hasSession(sessionName: string): Promise<boolean> {
    try {
      await execAsync(`tmux has-session -t ${sessionName}`);
      return true;
    } catch {
      return false;
    }
  }
  
  async killSession(sessionName: string): Promise<void> {
    try {
      await execAsync(`tmux kill-session -t ${sessionName}`);
    } catch {
      // Session might already be gone
    }
  }
  
  async createPane(sessionName: string, command?: string): Promise<string> {
    const { stdout } = await execAsync(
      `tmux split-window -t ${sessionName} -d -P -F "#{pane_id}" ${command || ''}`
    );
    return stdout.trim();
  }
  
  async killPane(paneId: string): Promise<void> {
    await execAsync(`tmux kill-pane -t ${paneId}`);
  }
  
  async sendCommand(paneId: string, command: string): Promise<void> {
    await execAsync(`tmux send-keys -t ${paneId} "${command}" Enter`);
  }
  
  async captureOutput(paneId: string, lines: number): Promise<string> {
    const { stdout } = await execAsync(
      `tmux capture-pane -t ${paneId} -p -S -${lines}`
    );
    return stdout;
  }
  
  async listPanes(sessionName: string): Promise<string[]> {
    const { stdout } = await execAsync(
      `tmux list-panes -t ${sessionName} -F "#{pane_id}"`
    );
    return stdout.trim().split('\n').filter(Boolean);
  }
  
  async isPaneAlive(paneId: string): Promise<boolean> {
    try {
      await execAsync(`tmux list-panes -t ${paneId} -F "#{pane_id}"`);
      return true;
    } catch {
      return false;
    }
  }
  
  async isAvailable(): Promise<boolean> {
    try {
      await execAsync('tmux -V');
      return true;
    } catch {
      return false;
    }
  }
}

// Factory to create the appropriate adapter
export class TerminalAdapterFactory {
  private static adapters: Map<string, TerminalAdapter> = new Map([
    ['tmux', new TmuxAdapter()],
    ['node-process', new NodeProcessAdapter()],
  ]);
  
  static async createAdapter(preferred?: string): Promise<TerminalAdapter> {
    // Try preferred adapter first
    if (preferred) {
      const adapter = this.adapters.get(preferred);
      if (adapter && await adapter.isAvailable()) {
        console.log(`Using ${adapter.name} terminal adapter`);
        return adapter;
      }
    }
    
    // Try tmux first (best option)
    const tmux = this.adapters.get('tmux')!;
    if (await tmux.isAvailable()) {
      console.log('Using tmux terminal adapter');
      return tmux;
    }
    
    // Fallback to node process
    console.log('Tmux not available, using node-process terminal adapter');
    return this.adapters.get('node-process')!;
  }
  
  static registerAdapter(name: string, adapter: TerminalAdapter): void {
    this.adapters.set(name, adapter);
  }
}