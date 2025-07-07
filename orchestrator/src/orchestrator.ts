// orchflow Unified Orchestrator
// Combines all features with optional enablement

import { EventEmitter } from 'events';
import { AgentManager, Agent } from './agent-manager';
import { AgentRouter } from './agent-router';
import { EventBus, OrchflowEvents } from './core/event-bus';
import { outputStreamManager, WebSocketStreamAdapter } from './streaming/output-stream';
import { WebSocketServer, WebSocket } from 'ws';
import * as http from 'http';

// Enhanced features
import { SessionManager } from './core/session-manager';
import { ProtocolManager, Protocol } from './core/protocol-manager';
import { ModeManager } from './modes/mode-manager';
import { circuitBreakerManager, CircuitBreaker } from './core/circuit-breaker';
import { resourceManager } from './core/resource-manager';
import { AdvancedMemoryManager } from './memory/advanced-memory-manager';
import { metricsCollector } from './metrics/metrics-collector';
import { TaskScheduler } from './coordination/task-scheduler';
import { PriorityStrategy } from './coordination/scheduling-strategies';
import { LoadBalancer } from './coordination/load-balancer';
import { TerminalPool } from './terminal/terminal-pool';
import { mcpRegistry, MCPRegistry } from './mcp/mcp-registry';
import { MCPServerConfig } from './mcp/mcp-registry';
import { SwarmCoordinator, SwarmTask } from './coordination/swarm-coordinator';
import * as fs from 'fs/promises';
import * as path from 'path';
import { LayoutManager } from './layouts/layout-manager';
import { TabManager } from './tabs/tab-manager';
import { GUIStateManager } from './gui/gui-state-manager';

export interface OrchestratorConfig {
  // Core config
  sessionName?: string;
  port?: number;
  dataDir?: string;
  
  // Feature flags (all optional, with smart defaults)
  enableWebSocket?: boolean;
  enableSessions?: boolean;
  enableProtocols?: boolean;
  enableCache?: boolean;
  enableModes?: boolean;
  enableCircuitBreakers?: boolean;
  enableResourceManager?: boolean;
  enableMemory?: boolean;
  enableMetrics?: boolean;
  enableScheduler?: boolean;
  enableTerminalPool?: boolean;
  enableMCP?: boolean;
  enableSwarm?: boolean;
  enableGUI?: boolean;
  
  // Feature-specific config
  mcpServers?: MCPServerConfig[];
  cacheConfig?: {
    defaultTTL?: number;
    maxSize?: number;
  };
  terminalPoolConfig?: {
    minSize?: number;
    maxSize?: number;
    idleTimeout?: number;
  };
}

interface CacheEntry {
  key: string;
  value: any;
  expires: Date;
  hits: number;
}

export class Orchestrator extends EventEmitter {
  private config: Required<OrchestratorConfig>;
  
  // Core components (always present)
  private agentManager: AgentManager;
  private router: AgentRouter;
  
  // Optional components
  private wsServer?: WebSocketServer;
  private httpServer?: http.Server;
  private sessionManager?: SessionManager;
  private protocolManager?: ProtocolManager;
  private modeManager?: ModeManager;
  private memoryManager?: AdvancedMemoryManager;
  private taskScheduler?: TaskScheduler;
  private loadBalancer?: LoadBalancer;
  private terminalPool?: TerminalPool;
  private mcpRegistry?: MCPRegistry;
  private swarmCoordinator?: SwarmCoordinator;
  private layoutManager?: LayoutManager;
  private tabManager?: TabManager;
  private guiStateManager?: GUIStateManager;
  
  // Internal state
  private cache: Map<string, CacheEntry> = new Map();
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private cleanupTimers: Set<NodeJS.Timer> = new Set();

  constructor(config: OrchestratorConfig = {}) {
    super();
    
    // Apply smart defaults
    this.config = {
      sessionName: config.sessionName || 'orchflow',
      port: config.port || 8080,
      dataDir: config.dataDir || '.orchflow',
      
      // Feature defaults - start with essentials enabled
      enableWebSocket: config.enableWebSocket ?? true,
      enableSessions: config.enableSessions ?? true,
      enableProtocols: config.enableProtocols ?? true,
      enableCache: config.enableCache ?? true,
      enableModes: config.enableModes ?? true,
      enableCircuitBreakers: config.enableCircuitBreakers ?? true,
      enableResourceManager: config.enableResourceManager ?? true,
      enableMemory: config.enableMemory ?? false, // Off by default (requires storage)
      enableMetrics: config.enableMetrics ?? true,
      enableScheduler: config.enableScheduler ?? false, // Off by default (overhead)
      enableTerminalPool: config.enableTerminalPool ?? false, // Off by default (tmux)
      enableMCP: config.enableMCP ?? false, // Off by default (requires servers)
      enableSwarm: config.enableSwarm ?? false, // Off by default (requires scheduler)
      enableGUI: config.enableGUI ?? false, // Off by default
      
      mcpServers: config.mcpServers || [],
      cacheConfig: {
        defaultTTL: config.cacheConfig?.defaultTTL || 300000, // 5 minutes
        maxSize: config.cacheConfig?.maxSize || 1000,
      },
      terminalPoolConfig: {
        minSize: config.terminalPoolConfig?.minSize || 2,
        maxSize: config.terminalPoolConfig?.maxSize || 10,
        idleTimeout: config.terminalPoolConfig?.idleTimeout || 300000, // 5 minutes
      },
    };

    // Initialize core components
    this.agentManager = new AgentManager(this.config.sessionName);
    this.router = new AgentRouter(this.agentManager);
    
    // Initialize optional components based on config
    this.initializeComponents();
    this.setupEventHandlers();
  }
  
  private initializeComponents(): void {
    // Sessions
    if (this.config.enableSessions) {
      this.sessionManager = new SessionManager(
        path.join(this.config.dataDir, 'sessions')
      );
    }
    
    // Protocols
    if (this.config.enableProtocols) {
      this.protocolManager = new ProtocolManager(
        path.join(this.config.dataDir, 'protocols')
      );
    }
    
    // Modes
    if (this.config.enableModes) {
      this.modeManager = new ModeManager(
        path.join(this.config.dataDir, 'modes')
      );
    }
    
    // Memory
    if (this.config.enableMemory) {
      this.memoryManager = new AdvancedMemoryManager({
        backend: undefined, // Use default markdown backend
        enableIndexing: true,
      });
    }
    
    // Scheduler and dependent features
    if (this.config.enableScheduler) {
      this.taskScheduler = new TaskScheduler(new PriorityStrategy());
      this.loadBalancer = new LoadBalancer();
      
      // Swarm requires scheduler
      if (this.config.enableSwarm) {
        this.swarmCoordinator = new SwarmCoordinator(
          this.agentManager,
          this.taskScheduler,
          this.loadBalancer
        );
      }
    }
    
    // Terminal pool
    if (this.config.enableTerminalPool) {
      this.terminalPool = new TerminalPool(this.config.terminalPoolConfig);
    }
    
    // MCP
    if (this.config.enableMCP) {
      this.mcpRegistry = mcpRegistry;
    }
    
    // Circuit breakers
    if (this.config.enableCircuitBreakers) {
      this.setupCircuitBreakers();
    }
    
    // WebSocket server
    if (this.config.enableWebSocket) {
      this.setupWebSocketServer();
    }
    
    // GUI components
    if (this.config.enableGUI) {
      this.tabManager = new TabManager();
      this.layoutManager = new LayoutManager(
        this.agentManager.getAdapter(),
        this.agentManager
      );
      this.guiStateManager = new GUIStateManager(
        this.tabManager,
        this.layoutManager
      );
    }
  }
  
  async initialize(): Promise<void> {
    // Create data directory
    await fs.mkdir(this.config.dataDir, { recursive: true });
    
    // Initialize agent manager
    await this.agentManager.initialize();
    
    // Initialize optional components
    if (this.sessionManager) {
      await this.sessionManager.initialize();
    }
    
    if (this.protocolManager) {
      await this.protocolManager.initialize();
    }
    
    if (this.modeManager) {
      await this.modeManager.initialize();
    }
    
    if (this.config.enableResourceManager) {
      this.setupResourceManager();
    }
    
    if (this.memoryManager) {
      await this.memoryManager.initialize();
    }
    
    if (this.config.enableCache) {
      const timer = setInterval(() => this.cleanupCache(), 60000);
      this.cleanupTimers.add(timer);
    }
    
    // Initialize MCP servers
    if (this.mcpRegistry && this.config.mcpServers.length > 0) {
      for (const serverConfig of this.config.mcpServers) {
        try {
          await this.mcpRegistry.registerServer(serverConfig);
        } catch (error) {
          console.error(`Failed to register MCP server ${serverConfig.id}:`, error);
        }
      }
    }
    
    // Initialize terminal pool
    if (this.terminalPool) {
      await this.terminalPool.initialize();
    }
    
    // Initialize swarm
    if (this.swarmCoordinator) {
      await this.swarmCoordinator.initialize();
    }
    
    console.log('Orchestrator initialized with features:', this.getEnabledFeatures());
  }

  private setupEventHandlers(): void {
    // Core event forwarding
    this.agentManager.on('agent:created', (agent) => {
      EventBus.emit(OrchflowEvents.AGENT_CREATED, {
        agentId: agent.id,
        name: agent.name,
        type: agent.type,
        config: agent.config,
      });
      this.broadcast({ type: 'agent:created', data: agent });
    });

    this.agentManager.on('agent:stopped', (agent) => {
      EventBus.emit(OrchflowEvents.AGENT_STOPPED, { agentId: agent.id });
      this.broadcast({ type: 'agent:stopped', data: agent });
    });

    this.agentManager.on('agent:failed', (agent) => {
      EventBus.emit(OrchflowEvents.AGENT_ERROR, {
        agentId: agent.id,
        error: agent.error || 'Agent failed',
      });
      this.broadcast({ type: 'agent:failed', data: agent });
    });

    this.router.on('intent:parsed', (intent) => {
      EventBus.emit(OrchflowEvents.COMMAND_EXECUTED, {
        command: intent.command,
        args: intent.args,
      });
      this.broadcast({ type: 'intent:parsed', data: intent });
    });

    this.router.on('route:success', (data) => {
      EventBus.emit(OrchflowEvents.COMMAND_COMPLETED, {
        command: data.command,
        result: data,
      });
      this.broadcast({ type: 'route:success', data });
    });
    
    // Enhanced feature event handlers
    if (this.config.enableProtocols) {
      EventBus.on(OrchflowEvents.COMMAND_EXECUTED, ({ command }) => {
        const blockCheck = this.protocolManager!.isCommandBlocked(command);
        if (blockCheck.blocked) {
          EventBus.emit(OrchflowEvents.COMMAND_FAILED, {
            command,
            error: `Command blocked by protocol: ${blockCheck.reason}`,
          });
          throw new Error(blockCheck.reason);
        }
        
        // Suggest mode based on command
        if (this.modeManager && !this.modeManager.getActiveMode()) {
          const suggestedMode = this.modeManager.getModeForCommand(command);
          if (suggestedMode) {
            console.log(`💡 Suggestion: Activate ${suggestedMode.name} mode for this task`);
          }
        }
      });
    }
    
    // Cache invalidation on file changes
    if (this.config.enableCache) {
      EventBus.on(OrchflowEvents.FILE_OPENED, ({ filePath }) => {
        this.invalidateCache(`file:${filePath}`);
      });
      
      EventBus.on(OrchflowEvents.FILE_SAVED, ({ filePath }) => {
        this.invalidateCache(`file:${filePath}`);
      });
    }
  }

  private setupCircuitBreakers(): void {
    // Agent creation circuit breaker
    const agentBreaker = circuitBreakerManager.create({
      name: 'agent-creation',
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 60000,
    });
    this.circuitBreakers.set('agent-creation', agentBreaker);
    
    // Command execution circuit breaker
    const commandBreaker = circuitBreakerManager.create({
      name: 'command-execution',
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 20000,
      resetTimeout: 45000,
    });
    this.circuitBreakers.set('command-execution', commandBreaker);
  }
  
  private setupResourceManager(): void {
    // Register common resources
    resourceManager.registerResource({
      id: 'tmux-session',
      type: 'process',
      name: 'Tmux Session',
      metadata: { sessionName: this.config.sessionName },
    });
    
    // Register file resources dynamically
    EventBus.on(OrchflowEvents.FILE_OPENED, ({ filePath }) => {
      resourceManager.registerResource({
        id: `file:${filePath}`,
        type: 'file',
        name: filePath,
      });
    });
  }

  private setupWebSocketServer(): void {
    this.httpServer = http.createServer();
    this.wsServer = new WebSocketServer({ server: this.httpServer });

    this.wsServer.on('connection', (ws) => {
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      (ws as any).clientId = clientId;
      
      // Set up streaming adapter
      const streamAdapter = new WebSocketStreamAdapter(outputStreamManager, ws as any);
      (ws as any).streamAdapter = streamAdapter;
      
      console.log('New WebSocket connection:', clientId);
      EventBus.emit(OrchflowEvents.WS_CLIENT_CONNECTED, { clientId });

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'error',
            error: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed:', clientId);
        
        // Clean up streaming adapter
        const adapter = (ws as any).streamAdapter;
        if (adapter) {
          adapter.cleanup();
        }
        
        EventBus.emit(OrchflowEvents.WS_CLIENT_DISCONNECTED, { clientId });
      });

      // Send initial state
      this.sendState(ws);
    });

    this.httpServer.listen(this.config.port, () => {
      console.log(`OrchFlow WebSocket server listening on port ${this.config.port}`);
      EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    });
  }

  private async handleWebSocketMessage(ws: WebSocket, data: any): Promise<void> {
    const clientId = (ws as any).clientId;
    EventBus.emit(OrchflowEvents.WS_MESSAGE_RECEIVED, {
      clientId,
      type: data.type,
      data,
    });
    
    switch (data.type) {
      case 'execute':
        const agent = await this.execute(data.command);
        ws.send(JSON.stringify({
          type: 'execute:result',
          agent,
          requestId: data.requestId,
        }));
        break;

      case 'agent:command':
        await this.agentManager.sendCommand(data.agentId, data.command);
        ws.send(JSON.stringify({
          type: 'command:sent',
          agentId: data.agentId,
          requestId: data.requestId,
        }));
        break;

      case 'agent:output':
        const output = await this.agentManager.getOutput(data.agentId, data.lines);
        ws.send(JSON.stringify({
          type: 'agent:output',
          agentId: data.agentId,
          output,
          requestId: data.requestId,
        }));
        break;
        
      case 'stream:subscribe':
      case 'stream:unsubscribe':
      case 'stream:recent':
        // Handled by WebSocketStreamAdapter
        break;

      case 'agent:stop':
        await this.stopAgent(data.agentId);
        break;

      case 'list:agents':
        const agents = await this.listAgents();
        ws.send(JSON.stringify({
          type: 'agents:list',
          agents,
          requestId: data.requestId,
        }));
        break;

      case 'suggestions':
        const suggestions = this.router.getSuggestions(data.partial);
        ws.send(JSON.stringify({
          type: 'suggestions',
          suggestions,
          requestId: data.requestId,
        }));
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          error: `Unknown message type: ${data.type}`,
        }));
    }
  }

  private async sendState(ws: WebSocket): Promise<void> {
    const agents = await this.agentManager.listAgents();
    ws.send(JSON.stringify({
      type: 'state',
      data: {
        agents,
        session: this.config.sessionName,
        features: this.getEnabledFeatures(),
      },
    }));
  }

  private broadcast(message: any): void {
    if (!this.wsServer) return;
    
    const data = JSON.stringify(message);
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  // Core methods
  async execute(command: string): Promise<any> {
    // Use circuit breaker if enabled
    if (this.config.enableCircuitBreakers) {
      const breaker = this.circuitBreakers.get('command-execution');
      if (breaker) {
        return breaker.execute(async () => {
          return this.executeWithEnhancements(command);
        });
      }
    }
    
    return this.executeWithEnhancements(command);
  }
  
  private async executeWithEnhancements(command: string): Promise<any> {
    // Check protocols for suggestions
    if (this.protocolManager) {
      const context = this.inferContext(command);
      const suggestions = this.protocolManager.getSuggestions(context);
      
      if (suggestions.length > 0) {
        console.log('Protocol suggestions:', suggestions);
      }
    }
    
    // Check cache
    const cacheKey = `command:${command}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log('Using cached result for:', command);
      return cached;
    }
    
    // Execute through router
    const result = await this.router.route(command);
    
    // Cache result if appropriate
    if (this.shouldCache(command)) {
      this.addToCache(cacheKey, result, this.config.cacheConfig.defaultTTL);
    }
    
    return result;
  }

  async createAgent(name: string, type: string, command?: string): Promise<any> {
    // Use circuit breaker if enabled
    if (this.config.enableCircuitBreakers) {
      const breaker = this.circuitBreakers.get('agent-creation');
      if (breaker) {
        return breaker.execute(async () => {
          return this.agentManager.createAgent({
            name,
            type: type as any,
            command,
          });
        });
      }
    }
    
    return this.agentManager.createAgent({
      name,
      type: type as any,
      command,
    });
  }

  async getAgentOutput(agentId: string, lines?: number): Promise<string> {
    return this.agentManager.getOutput(agentId, lines);
  }

  async sendToAgent(agentId: string, command: string): Promise<void> {
    return this.agentManager.sendCommand(agentId, command);
  }
  
  async stopAgent(agentId: string): Promise<void> {
    await this.agentManager.stopAgent(agentId);
  }

  async listAgents(): Promise<any[]> {
    return this.agentManager.listAgents();
  }
  
  async getAgent(agentId: string): Promise<any> {
    return this.agentManager.getAgent(agentId);
  }
  
  // Session management
  async startSession(name: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.sessionManager) {
      throw new Error('Sessions not enabled');
    }
    await this.sessionManager.createSession(name, metadata);
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
  }
  
  async resumeSession(sessionId?: string): Promise<void> {
    if (!this.sessionManager) return;
    
    if (sessionId) {
      this.sessionManager.resumeSession(sessionId);
    } else {
      // Resume most recent session
      const sessions = this.sessionManager.listSessions();
      if (sessions.length > 0) {
        this.sessionManager.resumeSession(sessions[0].id);
      }
    }
  }
  
  async generateHandoff(): Promise<string> {
    if (!this.sessionManager) {
      return 'Sessions not enabled';
    }
    return this.sessionManager.generateHandoff();
  }
  
  // Protocol management
  async addProtocol(protocol: Omit<Protocol, 'id' | 'createdAt'>): Promise<void> {
    if (!this.protocolManager) {
      throw new Error('Protocols not enabled');
    }
    const id = `custom-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    await this.protocolManager.addProtocol({
      ...protocol,
      id,
      createdAt: new Date(),
    });
  }
  
  listProtocols(filter?: any): Protocol[] {
    if (!this.protocolManager) return [];
    return this.protocolManager.listProtocols(filter);
  }
  
  // Mode management
  async activateMode(modeName: string, metadata?: Record<string, any>): Promise<void> {
    if (!this.modeManager) {
      throw new Error('Modes not enabled');
    }
    await this.modeManager.activateMode(modeName, metadata);
  }
  
  async endMode(): Promise<any> {
    if (!this.modeManager) return null;
    return this.modeManager.endMode();
  }
  
  listModes(filter?: any): any[] {
    if (!this.modeManager) return [];
    return this.modeManager.listModes(filter);
  }
  
  getActiveMode(): any {
    if (!this.modeManager) return null;
    return this.modeManager.getActiveMode();
  }
  
  // Resource management
  async acquireResource(
    resourceId: string,
    ownerId: string,
    lockType: 'shared' | 'exclusive' = 'exclusive',
    timeout?: number
  ): Promise<boolean> {
    if (!this.config.enableResourceManager) return true;
    return resourceManager.acquireLock(resourceId, ownerId, lockType, 0, timeout);
  }
  
  releaseResource(resourceId: string, ownerId: string): boolean {
    if (!this.config.enableResourceManager) return true;
    return resourceManager.releaseLock(resourceId, ownerId);
  }
  
  // Memory management
  async remember(key: string, value: any, metadata?: Record<string, any>): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory not enabled');
    }
    await this.memoryManager.remember(key, value, metadata);
  }
  
  async recall(key: string): Promise<any | null> {
    if (!this.memoryManager) {
      throw new Error('Memory not enabled');
    }
    return this.memoryManager.recall(key);
  }
  
  async searchMemory(query: string, limit: number = 10): Promise<any[]> {
    if (!this.memoryManager) {
      throw new Error('Memory not enabled');
    }
    return this.memoryManager.search(query, limit);
  }
  
  async forget(key: string): Promise<void> {
    if (!this.memoryManager) {
      throw new Error('Memory not enabled');
    }
    await this.memoryManager.forget(key);
  }
  
  // Task management
  async submitTask(task: any): Promise<string> {
    if (!this.taskScheduler) {
      throw new Error('Scheduler not enabled');
    }
    return this.taskScheduler.submitTask(task);
  }
  
  async getTaskStatus(taskId: string): Promise<any> {
    if (!this.taskScheduler) {
      throw new Error('Scheduler not enabled');
    }
    return this.taskScheduler.getTaskStatus(taskId);
  }
  
  async cancelTask(taskId: string): Promise<void> {
    if (!this.taskScheduler) {
      throw new Error('Scheduler not enabled');
    }
    await this.taskScheduler.cancelTask(taskId);
  }
  
  // MCP methods
  async registerMCPServer(config: MCPServerConfig): Promise<void> {
    if (!this.mcpRegistry) {
      throw new Error('MCP not enabled');
    }
    await this.mcpRegistry.registerServer(config);
  }
  
  async callMCPTool(toolName: string, args: any, serverId?: string): Promise<any> {
    if (!this.mcpRegistry) {
      throw new Error('MCP not enabled');
    }
    return this.mcpRegistry.callTool(toolName, args, serverId);
  }
  
  getMCPTools(): Array<{ serverId: string; tool: any }> {
    if (!this.mcpRegistry) return [];
    return this.mcpRegistry.getAllTools();
  }
  
  // Swarm methods
  async submitSwarmTask(task: Omit<SwarmTask, 'id' | 'status' | 'results' | 'errors'>): Promise<string> {
    if (!this.swarmCoordinator) {
      throw new Error('Swarm not enabled (requires scheduler)');
    }
    return this.swarmCoordinator.submitSwarmTask(task);
  }
  
  async getSwarmTask(taskId: string): Promise<SwarmTask | undefined> {
    if (!this.swarmCoordinator) return undefined;
    return this.swarmCoordinator.getSwarmTask(taskId);
  }
  
  // GUI methods
  async createLayout(templateId: string, customizations?: any): Promise<any> {
    if (!this.layoutManager) {
      throw new Error('GUI not enabled');
    }
    const layout = await this.layoutManager.createLayout(
      this.config.sessionName,
      templateId,
      customizations
    );
    if (this.guiStateManager) {
      this.guiStateManager.updateLayout(layout);
    }
    return layout;
  }
  
  async addPane(paneConfig: any): Promise<any> {
    if (!this.layoutManager) {
      throw new Error('GUI not enabled');
    }
    return this.layoutManager.addPane(this.config.sessionName, paneConfig);
  }
  
  async focusPane(paneId: string): Promise<void> {
    if (!this.layoutManager) {
      throw new Error('GUI not enabled');
    }
    await this.layoutManager.focusPane(this.config.sessionName, paneId);
  }
  
  getLayoutTemplates(): any[] {
    if (!this.layoutManager) return [];
    return this.layoutManager.getTemplates();
  }
  
  saveLayoutTemplate(template: any): void {
    if (!this.layoutManager) {
      throw new Error('GUI not enabled');
    }
    this.layoutManager.saveTemplate(template);
  }
  
  // Tab management
  createTab(options: { type: 'file' | 'terminal' | 'dashboard'; title: string; path?: string; agentId?: string }): any {
    if (!this.tabManager) {
      throw new Error('GUI not enabled');
    }
    
    switch (options.type) {
      case 'file':
        return this.tabManager.createFileTab(options.path || '');
      case 'terminal':
        return this.tabManager.createTerminalTab({
          title: options.title,
          agentId: options.agentId,
        });
      case 'dashboard':
        return this.tabManager.createDashboardTab(options.title);
    }
  }
  
  getTabs(): any[] {
    if (!this.tabManager) return [];
    return this.tabManager.getTabs();
  }
  
  activateTab(tabId: string): void {
    if (!this.tabManager) {
      throw new Error('GUI not enabled');
    }
    this.tabManager.activateTab(tabId);
  }
  
  closeTab(tabId: string, force?: boolean): boolean {
    if (!this.tabManager) {
      throw new Error('GUI not enabled');
    }
    return this.tabManager.closeTab(tabId, force);
  }
  
  // GUI WebSocket integration
  attachGUIClient(ws: WebSocket): void {
    if (!this.guiStateManager) {
      throw new Error('GUI not enabled');
    }
    this.guiStateManager.addClient(ws);
  }
  
  // Cache management
  private addToCache(key: string, value: any, ttl: number): void {
    if (!this.config.enableCache) return;
    
    this.cache.set(key, {
      key,
      value,
      expires: new Date(Date.now() + ttl),
      hits: 0,
    });
    
    // Enforce max size
    if (this.cache.size > this.config.cacheConfig.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
  }
  
  private getFromCache(key: string): any | null {
    if (!this.config.enableCache) return null;
    
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (entry.expires < new Date()) {
      this.cache.delete(key);
      return null;
    }
    
    entry.hits++;
    return entry.value;
  }
  
  private invalidateCache(pattern: string): void {
    if (!this.config.enableCache) return;
    
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
  
  private cleanupCache(): void {
    const now = new Date();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }
  
  // Helper methods
  private inferContext(command: string): Record<string, any> {
    const context: Record<string, any> = { command };
    
    if (command.includes('test')) {
      context.taskType = 'test';
      context.scope = 'development';
    } else if (command.includes('build') || command.includes('compile')) {
      context.taskType = 'build';
      context.scope = 'development';
    } else if (command.includes('git')) {
      context.scope = 'git';
    } else if (command.includes('debug')) {
      context.taskType = 'debug';
      context.scope = 'development';
    }
    
    return context;
  }
  
  private shouldCache(command: string): boolean {
    // Don't cache commands that have side effects
    const noCache = ['git', 'npm install', 'build', 'test'];
    return !noCache.some(nc => command.includes(nc));
  }
  
  private getEnabledFeatures(): string[] {
    const features = ['core'];
    
    if (this.config.enableWebSocket) features.push('websocket');
    if (this.config.enableSessions) features.push('sessions');
    if (this.config.enableProtocols) features.push('protocols');
    if (this.config.enableCache) features.push('cache');
    if (this.config.enableModes) features.push('modes');
    if (this.config.enableCircuitBreakers) features.push('circuit-breakers');
    if (this.config.enableResourceManager) features.push('resources');
    if (this.config.enableMemory) features.push('memory');
    if (this.config.enableMetrics) features.push('metrics');
    if (this.config.enableScheduler) features.push('scheduler');
    if (this.config.enableTerminalPool) features.push('terminal-pool');
    if (this.config.enableMCP) features.push('mcp');
    if (this.config.enableSwarm) features.push('swarm');
    if (this.config.enableGUI) features.push('gui');
    
    return features;
  }
  
  // System status
  async getStatus(): Promise<any> {
    const status: any = {
      agents: await this.listAgents(),
      features: this.getEnabledFeatures(),
      cache: {
        enabled: this.config.enableCache,
        entries: this.cache.size,
        maxSize: this.config.cacheConfig.maxSize,
      },
    };
    
    if (this.sessionManager) {
      const currentSession = this.sessionManager.getCurrentSession();
      status.session = currentSession ? {
        id: currentSession.id,
        name: currentSession.name,
        duration: Date.now() - currentSession.startTime.getTime(),
        agents: currentSession.agents.size,
        tasks: currentSession.tasks.size,
      } : null;
    }
    
    if (this.protocolManager) {
      status.protocols = {
        total: this.protocolManager.listProtocols().length,
        enabled: this.protocolManager.listProtocols({ enabled: true }).length,
      };
    }
    
    if (this.modeManager) {
      const activeMode = this.modeManager.getActiveMode();
      status.mode = activeMode ? {
        name: activeMode.name,
        category: activeMode.category,
        context: this.modeManager.getModeContext(),
      } : null;
      status.availableModes = this.modeManager.listModes({ enabled: true }).length;
    }
    
    if (this.swarmCoordinator) {
      status.swarm = await this.swarmCoordinator.getSwarmStatus();
    }
    
    if (this.config.enableCircuitBreakers) {
      status.circuitBreakers = {};
      for (const [name, breaker] of this.circuitBreakers) {
        status.circuitBreakers[name] = breaker.getStats();
      }
    }
    
    if (this.config.enableResourceManager) {
      const resourceState = resourceManager.getState();
      status.resources = {
        total: resourceState.resources.length,
        locks: resourceState.locks.length,
        waitQueue: resourceState.waitQueue.length,
      };
    }
    
    if (this.mcpRegistry) {
      const servers = this.mcpRegistry.getServers();
      status.mcp = {
        servers: servers.length,
        connected: servers.filter(s => s.status === 'connected').length,
        tools: this.mcpRegistry.getAllTools().length,
        prompts: this.mcpRegistry.getAllPrompts().length,
        resources: this.mcpRegistry.getAllResources().length,
      };
    }
    
    return status;
  }

  // Shutdown
  async shutdown(): Promise<void> {
    // Generate handoff if session is active
    if (this.sessionManager) {
      const handoff = await this.generateHandoff();
      if (handoff !== 'Sessions not enabled') {
        console.log('\nSession Handoff:\n', handoff);
      }
    }
    
    // End active mode
    if (this.modeManager) {
      await this.endMode();
    }
    
    // Clear cache
    this.cache.clear();
    
    // Stop all timers
    for (const timer of this.cleanupTimers) {
      clearInterval(timer);
    }
    this.cleanupTimers.clear();
    
    // Shutdown components
    if (this.config.enableCircuitBreakers) {
      circuitBreakerManager.destroy();
    }
    
    if (this.config.enableResourceManager) {
      resourceManager.destroy();
    }
    
    if (this.mcpRegistry) {
      await this.mcpRegistry.shutdown();
    }
    
    if (this.terminalPool) {
      this.terminalPool.destroy();
    }
    
    if (this.swarmCoordinator) {
      await this.swarmCoordinator.shutdown();
    }
    
    if (this.guiStateManager) {
      this.guiStateManager.destroy();
    }
    
    if (this.wsServer) {
      this.wsServer.close();
    }
    
    if (this.httpServer) {
      this.httpServer.close();
    }
    
    EventBus.emit(OrchflowEvents.SYSTEM_SHUTDOWN, undefined);
    await this.agentManager.shutdown();
    this.router.shutdown();
  }
}

// Export convenience function
export async function createOrchestrator(config?: OrchestratorConfig): Promise<Orchestrator> {
  const orchestrator = new Orchestrator(config);
  await orchestrator.initialize();
  return orchestrator;
}

// Re-export new GUI components
export { LayoutManager, type LayoutTemplate, type PaneConfig } from './layouts/layout-manager';
export { TabManager, type Tab, type TabType } from './tabs/tab-manager';
export { GUIStateManager, type GUIState, type GUIEvents } from './gui/gui-state-manager';