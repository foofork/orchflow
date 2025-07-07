import * as fs from 'fs/promises';
import * as path from 'path';
import { EventBus, OrchflowEvents } from './event-bus';

export interface Session {
  id: string;
  name: string;
  startTime: Date;
  lastActive: Date;
  agents: Set<string>;
  tasks: Map<string, TaskInfo>;
  metadata: Record<string, any>;
}

export interface TaskInfo {
  id: string;
  command: string;
  agentId?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  result?: any;
  error?: string;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private currentSession: Session | null = null;
  private persistPath: string;
  
  constructor(persistPath: string = '.orchflow/sessions') {
    this.persistPath = persistPath;
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Track agent lifecycle
    EventBus.on(OrchflowEvents.AGENT_CREATED, ({ agentId }) => {
      if (this.currentSession) {
        this.currentSession.agents.add(agentId);
        this.currentSession.lastActive = new Date();
        this.persist();
      }
    });
    
    EventBus.on(OrchflowEvents.AGENT_STOPPED, ({ agentId }) => {
      if (this.currentSession) {
        this.currentSession.agents.delete(agentId);
        this.currentSession.lastActive = new Date();
        this.persist();
      }
    });
    
    // Track commands
    EventBus.on(OrchflowEvents.COMMAND_EXECUTED, ({ command, agentId }) => {
      if (this.currentSession) {
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        const task: TaskInfo = {
          id: taskId,
          command,
          agentId,
          status: 'running',
          startTime: new Date(),
        };
        this.currentSession.tasks.set(taskId, task);
        this.currentSession.lastActive = new Date();
        this.persist();
      }
    });
    
    EventBus.on(OrchflowEvents.COMMAND_COMPLETED, ({ command, result }) => {
      if (this.currentSession) {
        // Find the matching task
        for (const [taskId, task] of this.currentSession.tasks) {
          if (task.command === command && task.status === 'running') {
            task.status = 'completed';
            task.endTime = new Date();
            task.result = result;
            this.currentSession.lastActive = new Date();
            this.persist();
            break;
          }
        }
      }
    });
    
    EventBus.on(OrchflowEvents.COMMAND_FAILED, ({ command, error }) => {
      if (this.currentSession) {
        // Find the matching task
        for (const [taskId, task] of this.currentSession.tasks) {
          if (task.command === command && task.status === 'running') {
            task.status = 'failed';
            task.endTime = new Date();
            task.error = error;
            this.currentSession.lastActive = new Date();
            this.persist();
            break;
          }
        }
      }
    });
  }
  
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.persistPath, { recursive: true });
      await this.loadSessions();
    } catch (error) {
      console.error('Failed to initialize session manager:', error);
    }
  }
  
  async createSession(name: string, metadata: Record<string, any> = {}): Promise<Session> {
    const id = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const session: Session = {
      id,
      name,
      startTime: new Date(),
      lastActive: new Date(),
      agents: new Set(),
      tasks: new Map(),
      metadata,
    };
    
    this.sessions.set(id, session);
    this.currentSession = session;
    await this.persist();
    
    return session;
  }
  
  resumeSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.currentSession = session;
      session.lastActive = new Date();
      this.persist();
    }
    return session;
  }
  
  getCurrentSession(): Session | null {
    return this.currentSession;
  }
  
  listSessions(): Session[] {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime());
  }
  
  addAgent(agentId: string, metadata?: any): void {
    if (this.currentSession) {
      this.currentSession.agents.add(agentId);
      this.currentSession.lastActive = new Date();
      this.persist();
    }
  }
  
  addTask(taskId: string, info: TaskInfo): void {
    if (this.currentSession) {
      this.currentSession.tasks.set(taskId, info);
      this.currentSession.lastActive = new Date();
      this.persist();
    }
  }
  
  updateTaskStatus(taskId: string, status: TaskInfo['status']): void {
    if (this.currentSession) {
      const task = this.currentSession.tasks.get(taskId);
      if (task) {
        task.status = status;
        if (status === 'completed' || status === 'failed') {
          task.endTime = new Date();
        }
        this.currentSession.lastActive = new Date();
        this.persist();
      }
    }
  }
  
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
    await this.persist();
  }
  
  private async loadSessions(): Promise<void> {
    try {
      const sessionFiles = await fs.readdir(this.persistPath);
      
      for (const file of sessionFiles) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.persistPath, file), 'utf-8');
          const sessionData = JSON.parse(content);
          
          // Reconstruct session object
          const session: Session = {
            ...sessionData,
            startTime: new Date(sessionData.startTime),
            lastActive: new Date(sessionData.lastActive),
            agents: new Set(sessionData.agents),
            tasks: new Map(sessionData.tasks),
          };
          
          this.sessions.set(session.id, session);
        }
      }
      
      // Resume most recent session if it's less than 1 hour old
      const recentSessions = this.listSessions();
      if (recentSessions.length > 0) {
        const mostRecent = recentSessions[0];
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (mostRecent.lastActive > hourAgo) {
          this.currentSession = mostRecent;
        }
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }
  
  private async persist(): Promise<void> {
    try {
      for (const session of this.sessions.values()) {
        const sessionData = {
          ...session,
          agents: Array.from(session.agents),
          tasks: Array.from(session.tasks.entries()),
        };
        
        const filePath = path.join(this.persistPath, `${session.id}.json`);
        await fs.writeFile(filePath, JSON.stringify(sessionData, null, 2));
      }
    } catch (error) {
      console.error('Failed to persist sessions:', error);
    }
  }
  
  // Generate handoff summary for next conversation
  async generateHandoff(): Promise<string> {
    if (!this.currentSession) {
      return 'No active session to hand off.';
    }
    
    const session = this.currentSession;
    const activeAgents = Array.from(session.agents);
    const completedTasks = Array.from(session.tasks.values())
      .filter(t => t.status === 'completed');
    const failedTasks = Array.from(session.tasks.values())
      .filter(t => t.status === 'failed');
    
    let handoff = `# OrchFlow Session Handoff\n\n`;
    handoff += `**Session**: ${session.name}\n`;
    handoff += `**Duration**: ${Math.round((Date.now() - session.startTime.getTime()) / 60000)} minutes\n\n`;
    
    if (activeAgents.length > 0) {
      handoff += `## Active Agents\n`;
      activeAgents.forEach(id => {
        handoff += `- ${id}\n`;
      });
      handoff += '\n';
    }
    
    if (completedTasks.length > 0) {
      handoff += `## Completed Tasks\n`;
      completedTasks.forEach(task => {
        handoff += `- ${task.command}\n`;
      });
      handoff += '\n';
    }
    
    if (failedTasks.length > 0) {
      handoff += `## Failed Tasks\n`;
      failedTasks.forEach(task => {
        handoff += `- ${task.command}: ${task.error}\n`;
      });
      handoff += '\n';
    }
    
    return handoff;
  }
}