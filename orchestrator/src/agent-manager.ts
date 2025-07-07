// orchflow Agent Manager
// Manages the lifecycle of terminal-based agents

import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { TerminalAdapter, TerminalAdapterFactory } from './terminal/terminal-adapter';
import { outputStreamManager } from './streaming/output-stream';
import { EventBus, OrchflowEvents } from './core/event-bus';

const execAsync = promisify(exec);

export interface Agent {
  id: string;
  name: string;
  type: 'dev' | 'test' | 'repl' | 'lint' | 'build' | 'custom' | 'command' | 'file' | 'web' | 'editor' | 'dev-server' | 'logger' | 'test-runner' | 'notebook' | 'python-repl' | 'data-explorer' | string;
  status: 'idle' | 'busy' | 'failed' | 'stopped' | 'running';
  tmuxPane?: string;
  tmuxSession?: string;
  terminalId?: string;  // For compatibility with streaming
  command?: string;
  workDir?: string;
  createdAt: Date;
  lastActivity?: Date;
  metadata?: Record<string, any>;
  error?: string;
}

export interface AgentConfig {
  name: string;
  type: Agent['type'];
  command?: string;
  workDir?: string;
  autoRestart?: boolean;
  env?: Record<string, string>;
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, Agent> = new Map();
  private sessionName: string;
  private agentCounter = 0;
  private adapter: TerminalAdapter | null = null;

  constructor(sessionName: string = 'orchflow') {
    super();
    this.sessionName = sessionName;
  }

  async initialize(): Promise<void> {
    // Get the best available terminal adapter
    this.adapter = await TerminalAdapterFactory.createAdapter();
    await this.ensureSession();
  }

  private async ensureSession(): Promise<void> {
    if (!this.adapter) {
      throw new Error('Terminal adapter not initialized');
    }
    
    const hasSession = await this.adapter.hasSession(this.sessionName);
    if (!hasSession) {
      await this.adapter.createSession(this.sessionName);
    }
  }

  async createAgent(config: AgentConfig): Promise<Agent> {
    const id = `agent-${++this.agentCounter}`;
    
    // Create pane using terminal adapter
    const paneId = await this.adapter.createPane(
      this.sessionName, 
      config.command || ''
    );
    
    // Set working directory if specified
    if (config.workDir && paneId) {
      await this.adapter.sendCommand(paneId, `cd ${config.workDir}`);
    }

    const agent: Agent = {
      id,
      name: config.name,
      type: config.type,
      status: 'idle',
      tmuxPane: paneId,
      tmuxSession: this.sessionName,
      terminalId: paneId, // Add terminalId for compatibility
      command: config.command,
      workDir: config.workDir,
      createdAt: new Date(),
    };

    this.agents.set(id, agent);
    this.emit('agent:created', agent);
    
    // Start monitoring the agent
    this.monitorAgent(id);
    
    return agent;
  }

  async sendCommand(agentId: string, command: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.tmuxPane) {
      throw new Error(`Agent ${agentId} not found`);
    }

    agent.status = 'busy';
    agent.lastActivity = new Date();
    
    try {
      await this.adapter.sendCommand(agent.tmuxPane, command);
      this.emit('agent:command', { agent, command });
    } catch (error) {
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  async getOutput(agentId: string, lines: number = 50): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.tmuxPane) {
      throw new Error(`Agent ${agentId} not found`);
    }

    // Try to get from stream first
    const recentOutput = await outputStreamManager.getRecentOutput(agentId, lines);
    if (recentOutput.length > 0) {
      return recentOutput.join('\n');
    }
    
    // Fallback to adapter
    try {
      const output = await this.adapter.getOutput(agent.tmuxPane, lines);
      return output || '';
    } catch (error) {
      console.error(`Failed to get output for agent ${agentId}:`, error);
      return '';
    }
  }
  
  // Subscribe to real-time output
  subscribeToOutput(agentId: string, callback: (chunk: any) => void): () => void {
    return outputStreamManager.subscribe(agentId, callback);
  }

  async stopAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent || !agent.tmuxPane) {
      throw new Error(`Agent ${agentId} not found`);
    }

    try {
      await this.adapter.killPane(agent.tmuxPane);
      agent.status = 'stopped';
    } catch (error) {
      console.error(`Failed to stop agent ${agentId}:`, error);
      agent.status = 'failed';
      agent.error = error instanceof Error ? error.message : 'Unknown error';
    }
    
    // Close output stream
    outputStreamManager.closeStream(agentId);
    
    this.emit('agent:stopped', agent);
    EventBus.emit(OrchflowEvents.AGENT_STOPPED, { agentId });
    
    this.agents.delete(agentId);
  }

  async listAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(agentId: string): Promise<Agent | undefined> {
    return this.agents.get(agentId);
  }

  private async monitorAgent(agentId: string): Promise<void> {
    const checkInterval = setInterval(async () => {
      const agent = this.agents.get(agentId);
      if (!agent || agent.status === 'stopped') {
        clearInterval(checkInterval);
        return;
      }

      try {
        // Check if pane still exists
        await execAsync(`tmux list-panes -t ${agent.tmuxPane} -F "#{pane_id}"`);
      } catch {
        // Pane no longer exists
        agent.status = 'failed';
        this.emit('agent:failed', agent);
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds
  }

  // Predefined agent templates
  async createDevAgent(name: string, command: string = 'npm run dev'): Promise<Agent> {
    return this.createAgent({
      name,
      type: 'dev',
      command,
      workDir: process.cwd(),
    });
  }

  async createTestAgent(name: string, command: string = 'npm test'): Promise<Agent> {
    return this.createAgent({
      name,
      type: 'test',
      command,
      workDir: process.cwd(),
    });
  }

  async createReplAgent(name: string, language: 'node' | 'python' | 'ruby' = 'node'): Promise<Agent> {
    const commands = {
      node: 'node',
      python: 'python3',
      ruby: 'irb',
    };
    
    return this.createAgent({
      name,
      type: 'repl',
      command: commands[language],
      workDir: process.cwd(),
    });
  }

  // Cleanup
  async shutdown(): Promise<void> {
    // Stop all agents
    for (const agent of this.agents.values()) {
      if (agent.status !== 'stopped') {
        await this.stopAgent(agent.id);
      }
    }
    
    // Close all output streams
    outputStreamManager.closeAll();
    
    // Kill the terminal session
    if (this.adapter) {
      await this.adapter.killSession(this.sessionName);
    }
    
    this.removeAllListeners();
  }
  
  // Get the terminal adapter (for layout manager)
  getAdapter(): TerminalAdapter {
    if (!this.adapter) {
      throw new Error('Terminal adapter not initialized');
    }
    return this.adapter;
  }
}