import { EventBus, OrchflowEvents } from '../core/event-bus';
import { metricsCollector } from '../metrics/metrics-collector';
import { circuitBreakerManager } from '../core/circuit-breaker';
import { TerminalAdapter, TerminalAdapterFactory } from './terminal-adapter';

export interface TerminalSession {
  id: string;
  sessionName: string;
  paneId: string;
  status: 'idle' | 'busy' | 'warming' | 'error';
  type: string;
  createdAt: Date;
  lastUsed: Date;
  useCount: number;
  currentTask?: string;
  metadata?: Record<string, any>;
}

export interface TerminalPoolConfig {
  minSize: number;
  maxSize: number;
  idleTimeout: number;
  warmupCommand?: string;
  sessionPrefix?: string;
  enableHealthChecks?: boolean;
  healthCheckInterval?: number;
}

export class TerminalPool {
  private sessions: Map<string, TerminalSession> = new Map();
  private availableSessions: TerminalSession[] = [];
  private config: Required<TerminalPoolConfig>;
  private adapter?: TerminalAdapter;
  private warmupTimer?: NodeJS.Timer;
  private healthCheckTimer?: NodeJS.Timer;
  private cleanupTimer?: NodeJS.Timer;
  
  constructor(config: TerminalPoolConfig) {
    this.config = {
      minSize: config.minSize,
      maxSize: config.maxSize,
      idleTimeout: config.idleTimeout,
      warmupCommand: config.warmupCommand || 'echo "Terminal ready"',
      sessionPrefix: config.sessionPrefix || 'orchflow-pool',
      enableHealthChecks: config.enableHealthChecks ?? true,
      healthCheckInterval: config.healthCheckInterval || 30000, // 30 seconds
    };
    
    this.setupEventHandlers();
  }
  
  async initialize(): Promise<void> {
    console.log(`Initializing terminal pool (min: ${this.config.minSize}, max: ${this.config.maxSize})`);
    
    // Get terminal adapter
    this.adapter = await TerminalAdapterFactory.createAdapter();
    
    // Check if we can use terminal pooling
    if (this.adapter.name === 'node-process') {
      console.warn('Terminal pooling is limited with node-process adapter');
      // Reduce pool size for process adapter
      this.config.minSize = Math.min(this.config.minSize, 2);
      this.config.maxSize = Math.min(this.config.maxSize, 5);
    }
    
    // Create minimum number of terminals
    const createPromises: Promise<void>[] = [];
    for (let i = 0; i < this.config.minSize; i++) {
      createPromises.push(this.createTerminal());
    }
    
    await Promise.all(createPromises);
    
    // Start background tasks
    this.startWarmupTask();
    this.startHealthCheckTask();
    this.startCleanupTask();
    
    metricsCollector.gauge('terminal_pool.size', this.sessions.size);
    metricsCollector.gauge('terminal_pool.available', this.availableSessions.length);
  }
  
  private setupEventHandlers(): void {
    // Track terminal lifecycle
    EventBus.on(OrchflowEvents.TERMINAL_CLOSED, ({ terminalId }) => {
      const session = this.sessions.get(terminalId);
      if (session) {
        this.removeTerminal(session);
      }
    });
    
    EventBus.on(OrchflowEvents.TERMINAL_ERROR, ({ terminalId, error }) => {
      const session = this.sessions.get(terminalId);
      if (session) {
        session.status = 'error';
        this.removeFromAvailable(session);
        console.error(`Terminal ${terminalId} error: ${error}`);
      }
    });
  }
  
  async acquire(type: string = 'generic', metadata?: Record<string, any>): Promise<TerminalSession | null> {
    const timer = metricsCollector.timer('terminal_pool.acquire');
    
    try {
      // Try to find available terminal of the same type
      let session = this.availableSessions.find(s => s.type === type);
      
      // If not found, try generic terminal
      if (!session && type !== 'generic') {
        session = this.availableSessions.find(s => s.type === 'generic');
        if (session) {
          session.type = type; // Convert generic to specific type
        }
      }
      
      // If still not found, create new one if under max
      if (!session && this.sessions.size < this.config.maxSize) {
        await this.createTerminal(type);
        session = this.availableSessions.find(s => s.type === type);
      }
      
      if (session) {
        // Remove from available pool
        this.removeFromAvailable(session);
        
        // Update session
        session.status = 'busy';
        session.lastUsed = new Date();
        session.useCount++;
        session.metadata = metadata;
        
        EventBus.emit(OrchflowEvents.TERMINAL_SPAWNED, {
          terminalId: session.id,
          sessionName: session.sessionName,
          paneId: session.paneId,
        });
        
        metricsCollector.increment('terminal_pool.acquisitions.success');
        metricsCollector.gauge('terminal_pool.available', this.availableSessions.length);
        
        return session;
      }
      
      metricsCollector.increment('terminal_pool.acquisitions.failed');
      return null;
    } finally {
      timer();
    }
  }
  
  async release(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'busy') return;
    
    const timer = metricsCollector.timer('terminal_pool.release');
    
    try {
      // Clean up terminal
      await this.cleanTerminal(session);
      
      // Update session
      session.status = 'idle';
      session.currentTask = undefined;
      session.metadata = undefined;
      
      // Add back to available pool
      this.availableSessions.push(session);
      
      metricsCollector.increment('terminal_pool.releases');
      metricsCollector.gauge('terminal_pool.available', this.availableSessions.length);
    } finally {
      timer();
    }
  }
  
  private async createTerminal(type: string = 'generic'): Promise<void> {
    const id = `term-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const sessionName = `${this.config.sessionPrefix}-${id}`;
    
    try {
      // Use circuit breaker for terminal creation
      const breaker = circuitBreakerManager.getOrCreate({
        name: 'terminal-creation',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 30000,
        resetTimeout: 60000,
      });
      
      await breaker.execute(async () => {
        if (!this.adapter) {
          throw new Error('Terminal adapter not initialized');
        }
        
        // Create session
        await this.adapter.createSession(sessionName);
        
        // Create initial pane
        const paneId = await this.adapter.createPane(sessionName);
        
        const session: TerminalSession = {
          id,
          sessionName,
          paneId: paneId,
          status: 'warming',
          type,
          createdAt: new Date(),
          lastUsed: new Date(),
          useCount: 0,
        };
        
        this.sessions.set(id, session);
        
        // Run warmup command
        if (this.config.warmupCommand && this.adapter) {
          await this.adapter.sendCommand(paneId, this.config.warmupCommand);
        }
        
        // Mark as available
        session.status = 'idle';
        this.availableSessions.push(session);
        
        console.log(`Created terminal ${id} (${type})`);
        metricsCollector.increment('terminal_pool.created');
      });
    } catch (error) {
      console.error(`Failed to create terminal: ${error}`);
      metricsCollector.increment('terminal_pool.creation_failed');
      throw error;
    }
  }
  
  private async cleanTerminal(session: TerminalSession): Promise<void> {
    if (!this.adapter) return;
    
    try {
      // Clear terminal
      await this.adapter.sendCommand(session.paneId, '\x03'); // Ctrl+C
      await this.adapter.sendCommand(session.paneId, 'clear');
      
      // Reset to home directory
      await this.adapter.sendCommand(session.paneId, 'cd ~');
      
      // Run warmup command again
      if (this.config.warmupCommand) {
        await this.adapter.sendCommand(session.paneId, this.config.warmupCommand);
      }
    } catch (error) {
      console.error(`Failed to clean terminal ${session.id}: ${error}`);
      session.status = 'error';
    }
  }
  
  private async removeTerminal(session: TerminalSession): Promise<void> {
    if (this.adapter) {
      try {
        await this.adapter.killSession(session.sessionName);
      } catch {
        // Session might already be gone
      }
    }
    
    this.sessions.delete(session.id);
    this.removeFromAvailable(session);
    
    EventBus.emit(OrchflowEvents.TERMINAL_CLOSED, { terminalId: session.id });
    
    metricsCollector.increment('terminal_pool.removed');
    metricsCollector.gauge('terminal_pool.size', this.sessions.size);
    metricsCollector.gauge('terminal_pool.available', this.availableSessions.length);
  }
  
  private removeFromAvailable(session: TerminalSession): void {
    const index = this.availableSessions.indexOf(session);
    if (index !== -1) {
      this.availableSessions.splice(index, 1);
    }
  }
  
  private startWarmupTask(): void {
    // Maintain minimum pool size
    this.warmupTimer = setInterval(async () => {
      const currentSize = this.sessions.size;
      
      if (currentSize < this.config.minSize) {
        const needed = this.config.minSize - currentSize;
        console.log(`Warming up ${needed} terminals`);
        
        const promises: Promise<void>[] = [];
        for (let i = 0; i < needed; i++) {
          promises.push(this.createTerminal());
        }
        
        await Promise.all(promises);
      }
    }, 10000); // Check every 10 seconds
  }
  
  private startHealthCheckTask(): void {
    if (!this.config.enableHealthChecks) return;
    
    this.healthCheckTimer = setInterval(async () => {
      for (const session of this.sessions.values()) {
        if (session.status === 'error') continue;
        
        try {
          if (!this.adapter) continue;
          
          // Check if session exists
          const hasSession = await this.adapter.hasSession(session.sessionName);
          if (!hasSession) {
            console.log(`Terminal session ${session.id} is gone`);
            session.status = 'error';
            this.removeFromAvailable(session);
            continue;
          }
          
          // Check if pane is alive
          const isAlive = await this.adapter.isPaneAlive(session.paneId);
          if (!isAlive) {
            console.log(`Terminal pane ${session.id} is dead`);
            session.status = 'error';
            this.removeFromAvailable(session);
          }
        } catch {
          console.log(`Terminal ${session.id} health check failed`);
          session.status = 'error';
          this.removeFromAvailable(session);
        }
      }
      
      metricsCollector.gauge('terminal_pool.healthy', 
        Array.from(this.sessions.values()).filter(s => s.status !== 'error').length
      );
    }, this.config.healthCheckInterval);
  }
  
  private startCleanupTask(): void {
    // Remove idle terminals beyond minimum
    this.cleanupTimer = setInterval(async () => {
      const now = Date.now();
      const toRemove: TerminalSession[] = [];
      
      for (const session of this.availableSessions) {
        const idleTime = now - session.lastUsed.getTime();
        
        if (idleTime > this.config.idleTimeout && 
            this.sessions.size > this.config.minSize) {
          toRemove.push(session);
        }
      }
      
      for (const session of toRemove) {
        console.log(`Removing idle terminal ${session.id}`);
        await this.removeTerminal(session);
      }
    }, 60000); // Check every minute
  }
  
  async getStatus(): Promise<{
    total: number;
    available: number;
    busy: number;
    error: number;
    byType: Record<string, number>;
    averageUseCount: number;
  }> {
    const sessions = Array.from(this.sessions.values());
    
    const byType: Record<string, number> = {};
    let totalUseCount = 0;
    let busy = 0;
    let error = 0;
    
    for (const session of sessions) {
      byType[session.type] = (byType[session.type] || 0) + 1;
      totalUseCount += session.useCount;
      
      if (session.status === 'busy') busy++;
      if (session.status === 'error') error++;
    }
    
    return {
      total: this.sessions.size,
      available: this.availableSessions.length,
      busy,
      error,
      byType,
      averageUseCount: sessions.length > 0 ? totalUseCount / sessions.length : 0,
    };
  }
  
  async drain(): Promise<void> {
    console.log('Draining terminal pool...');
    
    // Stop creating new terminals
    if (this.warmupTimer) {
      clearInterval(this.warmupTimer);
    }
    
    // Wait for busy terminals to be released
    let attempts = 0;
    while (this.availableSessions.length < this.sessions.size && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }
    
    // Remove all terminals
    const allSessions = Array.from(this.sessions.values());
    for (const session of allSessions) {
      await this.removeTerminal(session);
    }
  }
  
  destroy(): void {
    if (this.warmupTimer) clearInterval(this.warmupTimer);
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    
    // Don't wait for drain in destroy
    this.drain().catch(console.error);
  }
}