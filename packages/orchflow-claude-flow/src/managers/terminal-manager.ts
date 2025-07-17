/**
 * Unified Terminal Manager
 * Combines TerminalManager and TerminalStateManager functionality
 * Provides centralized terminal operations and state management
 */

import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import * as pty from 'node-pty';
import chalk from 'chalk';

export interface TerminalState {
  terminalId: string;
  name: string;
  status: 'active' | 'idle' | 'busy' | 'disconnected';
  process?: ChildProcess | pty.IPty;
  currentCommand?: string;
  history: string[];
  startTime: Date;
  lastActivity: Date;
  windowId?: number;
  paneId?: string;
  sessionData?: any;
}

export interface TerminalOptions {
  name?: string;
  shell?: string;
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  usePty?: boolean;
}

export interface TerminalSession {
  sessionId: string;
  terminals: Map<string, TerminalState>;
  createdAt: Date;
  lastSaved?: Date;
}

/**
 * Unified TerminalManager handling terminal lifecycle and state
 */
export class TerminalManager extends EventEmitter {
  private static instance: TerminalManager;
  private terminals: Map<string, TerminalState> = new Map();
  private sessions: Map<string, TerminalSession> = new Map();
  private currentSessionId?: string;
  private terminalCounter = 0;

  private constructor() {
    super();
    this.initializeDefaultSession();
  }

  static getInstance(): TerminalManager {
    if (!TerminalManager.instance) {
      TerminalManager.instance = new TerminalManager();
    }
    return TerminalManager.instance;
  }

  /**
   * Initialize default session
   */
  private initializeDefaultSession(): void {
    this.currentSessionId = `session-${Date.now()}`;
    this.sessions.set(this.currentSessionId, {
      sessionId: this.currentSessionId,
      terminals: new Map(),
      createdAt: new Date()
    });
  }

  /**
   * Create a new terminal
   */
  async createTerminal(options: TerminalOptions = {}): Promise<string> {
    const terminalId = `terminal-${++this.terminalCounter}`;
    const name = options.name || `Terminal ${this.terminalCounter}`;

    console.log(chalk.cyan(`Creating ${name}...`));

    try {
      let terminalProcess: ChildProcess | pty.IPty;

      if (options.usePty !== false) {
        // Use node-pty for better terminal emulation
        terminalProcess = pty.spawn(options.shell || process.env.SHELL || 'bash', [], {
          name: 'xterm-256color',
          cols: options.cols || 80,
          rows: options.rows || 24,
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env }
        });

        // Handle pty events
        (terminalProcess).onData((data: string) => {
          this.emit('terminal:output', { terminalId, data });
        });

        (terminalProcess).onExit(({ exitCode, signal }) => {
          this.handleTerminalExit(terminalId, exitCode, signal?.toString());
        });
      } else {
        // Use standard child_process
        terminalProcess = spawn(options.shell || process.env.SHELL || 'bash', [], {
          cwd: options.cwd || process.cwd(),
          env: { ...process.env, ...options.env },
          stdio: ['pipe', 'pipe', 'pipe']
        });

        // Handle standard process events
        const cp = terminalProcess;

        cp.stdout?.on('data', (data: Buffer) => {
          this.emit('terminal:output', { terminalId, data: data.toString() });
        });

        cp.stderr?.on('data', (data: Buffer) => {
          this.emit('terminal:error', { terminalId, data: data.toString() });
        });

        cp.on('exit', (code, signal) => {
          this.handleTerminalExit(terminalId, code || 0, signal || undefined);
        });
      }

      // Create terminal state
      const state: TerminalState = {
        terminalId,
        name,
        status: 'active',
        process: terminalProcess,
        history: [],
        startTime: new Date(),
        lastActivity: new Date()
      };

      // Store terminal
      this.terminals.set(terminalId, state);

      // Add to current session
      if (this.currentSessionId) {
        const session = this.sessions.get(this.currentSessionId);
        if (session) {
          session.terminals.set(terminalId, state);
        }
      }

      this.emit('terminal:created', { terminalId, name });
      console.log(chalk.green(`✓ ${name} created successfully`));

      return terminalId;
    } catch (error) {
      console.error(chalk.red(`Failed to create terminal: ${error}`));
      this.emit('terminal:error', { terminalId, error });
      throw error;
    }
  }

  /**
   * Send command to terminal
   */
  async sendCommand(terminalId: string, command: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      throw new Error(`Terminal ${terminalId} not found`);
    }

    if (terminal.status === 'disconnected') {
      throw new Error(`Terminal ${terminalId} is disconnected`);
    }

    // Update state
    terminal.currentCommand = command;
    terminal.status = 'busy';
    terminal.lastActivity = new Date();
    terminal.history.push(command);

    // Send command
    if ('write' in terminal.process!) {
      // PTY interface
      (terminal.process).write(`${command}\r`);
    } else {
      // Standard process interface
      const cp = terminal.process as ChildProcess;
      cp.stdin?.write(`${command}\n`);
    }

    this.emit('terminal:command', { terminalId, command });
  }

  /**
   * Get terminal state
   */
  getTerminalState(terminalId: string): TerminalState | undefined {
    return this.terminals.get(terminalId);
  }

  /**
   * Get all terminals
   */
  getAllTerminals(): TerminalState[] {
    return Array.from(this.terminals.values());
  }

  /**
   * Get active terminals
   */
  getActiveTerminals(): TerminalState[] {
    return this.getAllTerminals().filter(t => t.status !== 'disconnected');
  }

  /**
   * Close terminal
   */
  async closeTerminal(terminalId: string): Promise<void> {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) {
      return;
    }

    console.log(chalk.yellow(`Closing ${terminal.name}...`));

    // Kill process
    if (terminal.process) {
      if ('kill' in terminal.process) {
        (terminal.process as pty.IPty).kill();
      } else {
        (terminal.process as ChildProcess).kill();
      }
    }

    // Update state
    terminal.status = 'disconnected';
    terminal.process = undefined;

    // Remove from active terminals but keep in history
    this.terminals.delete(terminalId);

    this.emit('terminal:closed', { terminalId });
    console.log(chalk.green(`✓ ${terminal.name} closed`));
  }

  /**
   * Close all terminals
   */
  async closeAllTerminals(): Promise<void> {
    const terminalIds = Array.from(this.terminals.keys());
    await Promise.all(terminalIds.map(id => this.closeTerminal(id)));
  }

  /**
   * Resize terminal
   */
  resizeTerminal(terminalId: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || !terminal.process) {
      return;
    }

    if ('resize' in terminal.process) {
      (terminal.process).resize(cols, rows);
      this.emit('terminal:resized', { terminalId, cols, rows });
    }
  }

  /**
   * Save session state
   */
  async saveSession(sessionId?: string): Promise<void> {
    const sid = sessionId || this.currentSessionId;
    if (!sid) {return;}

    const session = this.sessions.get(sid);
    if (!session) {return;}

    session.lastSaved = new Date();

    // Convert terminal states to serializable format
    const sessionData = {
      sessionId: session.sessionId,
      createdAt: session.createdAt,
      lastSaved: session.lastSaved,
      terminals: Array.from(session.terminals.values()).map(t => ({
        terminalId: t.terminalId,
        name: t.name,
        status: t.status,
        history: t.history,
        startTime: t.startTime,
        lastActivity: t.lastActivity,
        windowId: t.windowId,
        paneId: t.paneId,
        sessionData: t.sessionData
      }))
    };

    this.emit('session:saved', sessionData);
  }

  /**
   * Restore session state
   */
  async restoreSession(sessionData: any): Promise<void> {
    const session: TerminalSession = {
      sessionId: sessionData.sessionId,
      terminals: new Map(),
      createdAt: new Date(sessionData.createdAt),
      lastSaved: sessionData.lastSaved ? new Date(sessionData.lastSaved) : undefined
    };

    this.sessions.set(session.sessionId, session);
    this.currentSessionId = session.sessionId;

    // Restore terminals (without processes - those need to be recreated)
    for (const terminalData of sessionData.terminals) {
      const state: TerminalState = {
        ...terminalData,
        status: 'disconnected',
        process: undefined,
        startTime: new Date(terminalData.startTime),
        lastActivity: new Date(terminalData.lastActivity)
      };

      session.terminals.set(state.terminalId, state);
    }

    this.emit('session:restored', session);
  }

  /**
   * Create tmux session
   */
  async createTmuxSession(sessionName: string): Promise<string> {
    const terminalId = await this.createTerminal({
      name: `tmux-${sessionName}`,
      usePty: true
    });

    // Create tmux session
    await this.sendCommand(terminalId, `tmux new-session -d -s ${sessionName}`);

    // Store tmux session info
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.sessionData = { tmuxSession: sessionName };
    }

    return terminalId;
  }

  /**
   * Attach to tmux session
   */
  async attachTmuxSession(sessionName: string): Promise<string> {
    const terminalId = await this.createTerminal({
      name: `tmux-attach-${sessionName}`,
      usePty: true
    });

    await this.sendCommand(terminalId, `tmux attach-session -t ${sessionName}`);

    return terminalId;
  }

  /**
   * List tmux sessions
   */
  async listTmuxSessions(): Promise<string[]> {
    const terminalId = await this.createTerminal({ name: 'tmux-list', usePty: false });

    return new Promise((resolve, reject) => {
      const _sessions: string[] = [];
      let output = '';

      const handleOutput = (data: { terminalId: string; data: string }) => {
        if (data.terminalId === terminalId) {
          output += data.data;
        }
      };

      this.on('terminal:output', handleOutput);

      this.sendCommand(terminalId, 'tmux list-sessions -F "#{session_name}"')
        .then(() => {
          setTimeout(() => {
            this.off('terminal:output', handleOutput);
            this.closeTerminal(terminalId);

            const sessionList = output.trim().split('\n').filter(s => s.length > 0);
            resolve(sessionList);
          }, 500);
        })
        .catch(reject);
    });
  }

  /**
   * Get session statistics
   */
  getSessionStats(): any {
    const stats = {
      totalSessions: this.sessions.size,
      currentSessionId: this.currentSessionId,
      terminals: {
        total: this.terminals.size,
        active: this.getActiveTerminals().length,
        disconnected: this.getAllTerminals().filter(t => t.status === 'disconnected').length
      },
      uptime: this.currentSessionId ?
        (Date.now() - this.sessions.get(this.currentSessionId)!.createdAt.getTime()) / 1000 : 0
    };

    return stats;
  }

  /**
   * Handle terminal exit
   */
  private handleTerminalExit(terminalId: string, exitCode: number, signal?: string): void {
    const terminal = this.terminals.get(terminalId);
    if (terminal) {
      terminal.status = 'disconnected';
      terminal.process = undefined;

      this.emit('terminal:exited', { terminalId, exitCode, signal });

      if (exitCode !== 0) {
        console.warn(chalk.yellow(`${terminal.name} exited with code ${exitCode}`));
      }
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.closeAllTerminals();
    this.sessions.clear();
    this.removeAllListeners();
  }
}

export default TerminalManager;