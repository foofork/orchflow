import { EventEmitter } from 'events';
import { MCPClient } from './mcp-client';
import { MCPServer, MCPClientConfig, MCPTool, MCPPrompt, MCPResource } from './types';
import { HTTPTransport, WebSocketTransport, StdioTransport } from './transports';
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { metricsCollector } from '../metrics/metrics-collector';

export interface MCPServerConfig {
  id: string;
  name: string;
  version: string;
  endpoint: string;
  transport: 'http' | 'websocket' | 'stdio';
  transportConfig?: {
    command?: string;
    args?: string[];
  };
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export class MCPRegistry extends EventEmitter {
  private servers: Map<string, MCPServer> = new Map();
  private clients: Map<string, MCPClient> = new Map();
  private reconnectTimers: Map<string, NodeJS.Timer> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  
  // Aggregated capabilities
  private allTools: Map<string, { serverId: string; tool: MCPTool }> = new Map();
  private allPrompts: Map<string, { serverId: string; prompt: MCPPrompt }> = new Map();
  private allResources: Map<string, { serverId: string; resource: MCPResource }> = new Map();
  
  constructor() {
    super();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Monitor for tool/prompt/resource changes
    EventBus.on(OrchflowEvents.MCP_TOOLS_CHANGED, ({ serverId }) => {
      this.updateAggregatedTools();
    });
    
    EventBus.on(OrchflowEvents.MCP_PROMPTS_CHANGED, ({ serverId }) => {
      this.updateAggregatedPrompts();
    });
    
    EventBus.on(OrchflowEvents.MCP_RESOURCES_CHANGED, ({ serverId }) => {
      this.updateAggregatedResources();
    });
  }
  
  async registerServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new Error(`Server already registered: ${config.id}`);
    }
    
    console.log(`Registering MCP server: ${config.name} (${config.id})`);
    
    // Create server entry
    const server: MCPServer = {
      id: config.id,
      name: config.name,
      version: config.version,
      capabilities: {},
      status: 'disconnected',
      endpoint: config.endpoint,
      transport: config.transport,
    };
    
    this.servers.set(config.id, server);
    
    // Create transport
    const transport = this.createTransport(config);
    
    // Create client
    const clientConfig: MCPClientConfig = {
      name: `orchflow-${config.id}`,
      version: '1.0.0',
      transport,
      capabilities: {
        tools: true,
        prompts: true,
        resources: true,
        logging: true,
        sampling: true,
      },
    };
    
    const client = new MCPClient(clientConfig);
    this.clients.set(config.id, client);
    
    // Set up client event handlers
    this.setupClientHandlers(config.id, client);
    
    // Auto-connect if requested
    if (config.autoConnect !== false) {
      await this.connectServer(config.id);
    }
    
    EventBus.emit(OrchflowEvents.MCP_SERVER_REGISTERED, { serverId: config.id, server });
  }
  
  private createTransport(config: MCPServerConfig): any {
    switch (config.transport) {
      case 'http':
        return new HTTPTransport(config.endpoint);
        
      case 'websocket':
        return new WebSocketTransport(config.endpoint);
        
      case 'stdio':
        if (!config.transportConfig?.command) {
          throw new Error('Stdio transport requires command in transportConfig');
        }
        return new StdioTransport(
          config.transportConfig.command,
          config.transportConfig.args
        );
        
      default:
        throw new Error(`Unknown transport type: ${config.transport}`);
    }
  }
  
  private setupClientHandlers(serverId: string, client: MCPClient): void {
    client.on('connected', (data) => {
      const server = this.servers.get(serverId);
      if (server) {
        server.status = 'connected';
        server.capabilities = data.capabilities || {};
        this.reconnectAttempts.set(serverId, 0);
      }
      
      EventBus.emit(OrchflowEvents.MCP_SERVER_CONNECTED, { serverId });
      
      // Update aggregated data
      this.updateAggregatedTools();
      this.updateAggregatedPrompts();
      this.updateAggregatedResources();
    });
    
    client.on('disconnected', () => {
      const server = this.servers.get(serverId);
      if (server) {
        server.status = 'disconnected';
      }
      
      EventBus.emit(OrchflowEvents.MCP_SERVER_DISCONNECTED, { serverId });
      
      // Start reconnect if configured
      const serverConfig = this.getServerConfig(serverId);
      if (serverConfig && serverConfig.reconnectInterval) {
        this.scheduleReconnect(serverId);
      }
    });
    
    client.on('error', (error) => {
      console.error(`MCP client error (${serverId}):`, error);
      EventBus.emit(OrchflowEvents.MCP_SERVER_ERROR, { serverId, error });
    });
    
    client.on('notification', (notification) => {
      EventBus.emit(OrchflowEvents.MCP_NOTIFICATION, { serverId, notification });
    });
    
    client.on('progress', (progress) => {
      EventBus.emit(OrchflowEvents.MCP_PROGRESS, { serverId, progress });
    });
  }
  
  private scheduleReconnect(serverId: string): void {
    const serverConfig = this.getServerConfig(serverId);
    if (!serverConfig || !serverConfig.reconnectInterval) return;
    
    const attempts = this.reconnectAttempts.get(serverId) || 0;
    const maxAttempts = serverConfig.maxReconnectAttempts || 10;
    
    if (attempts >= maxAttempts) {
      console.error(`Max reconnect attempts reached for ${serverId}`);
      const server = this.servers.get(serverId);
      if (server) {
        server.status = 'error';
      }
      return;
    }
    
    const timer = setTimeout(async () => {
      console.log(`Attempting to reconnect to ${serverId} (attempt ${attempts + 1})`);
      this.reconnectAttempts.set(serverId, attempts + 1);
      
      try {
        await this.connectServer(serverId);
      } catch (error) {
        console.error(`Reconnect failed for ${serverId}:`, error);
        this.scheduleReconnect(serverId);
      }
    }, serverConfig.reconnectInterval);
    
    this.reconnectTimers.set(serverId, timer);
  }
  
  async connectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) {
      throw new Error(`Server not found: ${serverId}`);
    }
    
    const timer = metricsCollector.timer('mcp.registry.connect', { serverId });
    
    try {
      await client.connect();
      
      // Cancel any pending reconnect
      const reconnectTimer = this.reconnectTimers.get(serverId);
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        this.reconnectTimers.delete(serverId);
      }
      
      metricsCollector.increment('mcp.registry.connections.success');
    } catch (error) {
      metricsCollector.increment('mcp.registry.connections.failed');
      throw error;
    } finally {
      timer();
    }
  }
  
  async disconnectServer(serverId: string): Promise<void> {
    const client = this.clients.get(serverId);
    if (!client) return;
    
    // Cancel any pending reconnect
    const reconnectTimer = this.reconnectTimers.get(serverId);
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      this.reconnectTimers.delete(serverId);
    }
    
    await client.disconnect();
  }
  
  async unregisterServer(serverId: string): Promise<void> {
    await this.disconnectServer(serverId);
    
    this.servers.delete(serverId);
    this.clients.delete(serverId);
    this.reconnectAttempts.delete(serverId);
    
    // Update aggregated data
    this.updateAggregatedTools();
    this.updateAggregatedPrompts();
    this.updateAggregatedResources();
    
    EventBus.emit(OrchflowEvents.MCP_SERVER_UNREGISTERED, { serverId });
  }
  
  private updateAggregatedTools(): void {
    this.allTools.clear();
    
    for (const [serverId, client] of this.clients) {
      const server = this.servers.get(serverId);
      if (server?.status !== 'connected') continue;
      
      for (const tool of client.getTools()) {
        const key = `${serverId}:${tool.name}`;
        this.allTools.set(key, { serverId, tool });
      }
    }
    
    console.log(`Updated tool registry: ${this.allTools.size} tools available`);
  }
  
  private updateAggregatedPrompts(): void {
    this.allPrompts.clear();
    
    for (const [serverId, client] of this.clients) {
      const server = this.servers.get(serverId);
      if (server?.status !== 'connected') continue;
      
      for (const prompt of client.getPrompts()) {
        const key = `${serverId}:${prompt.name}`;
        this.allPrompts.set(key, { serverId, prompt });
      }
    }
    
    console.log(`Updated prompt registry: ${this.allPrompts.size} prompts available`);
  }
  
  private updateAggregatedResources(): void {
    this.allResources.clear();
    
    for (const [serverId, client] of this.clients) {
      const server = this.servers.get(serverId);
      if (server?.status !== 'connected') continue;
      
      for (const resource of client.getResources()) {
        const key = `${serverId}:${resource.uri}`;
        this.allResources.set(key, { serverId, resource });
      }
    }
    
    console.log(`Updated resource registry: ${this.allResources.size} resources available`);
  }
  
  // Tool execution
  async callTool(toolName: string, args: any, serverId?: string): Promise<any> {
    // If serverId provided, use specific server
    if (serverId) {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not found: ${serverId}`);
      }
      return client.callTool(toolName, args);
    }
    
    // Otherwise, find first server with the tool
    for (const [key, { serverId: sid, tool }] of this.allTools) {
      if (tool.name === toolName) {
        const client = this.clients.get(sid);
        if (client) {
          return client.callTool(toolName, args);
        }
      }
    }
    
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  // Prompt execution
  async getPrompt(promptName: string, args?: Record<string, any>, serverId?: string): Promise<any> {
    // If serverId provided, use specific server
    if (serverId) {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not found: ${serverId}`);
      }
      return client.getPrompt(promptName, args);
    }
    
    // Otherwise, find first server with the prompt
    for (const [key, { serverId: sid, prompt }] of this.allPrompts) {
      if (prompt.name === promptName) {
        const client = this.clients.get(sid);
        if (client) {
          return client.getPrompt(promptName, args);
        }
      }
    }
    
    throw new Error(`Prompt not found: ${promptName}`);
  }
  
  // Resource access
  async readResource(uri: string, serverId?: string): Promise<any> {
    // If serverId provided, use specific server
    if (serverId) {
      const client = this.clients.get(serverId);
      if (!client) {
        throw new Error(`Server not found: ${serverId}`);
      }
      return client.readResource(uri);
    }
    
    // Otherwise, find server with the resource
    for (const [key, { serverId: sid, resource }] of this.allResources) {
      if (resource.uri === uri) {
        const client = this.clients.get(sid);
        if (client) {
          return client.readResource(uri);
        }
      }
    }
    
    throw new Error(`Resource not found: ${uri}`);
  }
  
  // Getters
  getServers(): MCPServer[] {
    return Array.from(this.servers.values());
  }
  
  getServer(serverId: string): MCPServer | undefined {
    return this.servers.get(serverId);
  }
  
  getClient(serverId: string): MCPClient | undefined {
    return this.clients.get(serverId);
  }
  
  getAllTools(): Array<{ serverId: string; tool: MCPTool }> {
    return Array.from(this.allTools.values());
  }
  
  getAllPrompts(): Array<{ serverId: string; prompt: MCPPrompt }> {
    return Array.from(this.allPrompts.values());
  }
  
  getAllResources(): Array<{ serverId: string; resource: MCPResource }> {
    return Array.from(this.allResources.values());
  }
  
  private getServerConfig(serverId: string): MCPServerConfig | undefined {
    // This would need to be stored during registration
    // For now, return a basic config
    const server = this.servers.get(serverId);
    if (!server) return undefined;
    
    return {
      id: server.id,
      name: server.name,
      version: server.version,
      endpoint: server.endpoint,
      transport: server.transport,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
    };
  }
  
  async shutdown(): Promise<void> {
    console.log('Shutting down MCP registry...');
    
    // Cancel all reconnect timers
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
    
    // Disconnect all servers
    const promises: Promise<void>[] = [];
    for (const serverId of this.servers.keys()) {
      promises.push(this.disconnectServer(serverId));
    }
    
    await Promise.all(promises);
    
    this.servers.clear();
    this.clients.clear();
    this.allTools.clear();
    this.allPrompts.clear();
    this.allResources.clear();
  }
}

// Singleton instance
export const mcpRegistry = new MCPRegistry();