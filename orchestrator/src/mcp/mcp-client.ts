import { EventEmitter } from 'events';
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { metricsCollector } from '../metrics/metrics-collector';
import {
  MCPRequest,
  MCPResponse,
  MCPNotification,
  MCPTransport,
  MCPClientConfig,
  MCPMethods,
  MCPTool,
  MCPPrompt,
  MCPResource,
  MCPCapabilities,
} from './types';

export class MCPClient extends EventEmitter {
  private transport: MCPTransport;
  private config: MCPClientConfig;
  private requestId = 0;
  private pendingRequests: Map<string | number, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timer?: NodeJS.Timeout;
  }> = new Map();
  
  private serverCapabilities?: MCPCapabilities;
  private tools: Map<string, MCPTool> = new Map();
  private prompts: Map<string, MCPPrompt> = new Map();
  private resources: Map<string, MCPResource> = new Map();
  
  constructor(config: MCPClientConfig) {
    super();
    this.config = config;
    this.transport = config.transport;
    this.setupTransportHandlers();
  }
  
  private setupTransportHandlers(): void {
    this.transport.onMessage((message) => {
      if ('method' in message) {
        this.handleNotification(message as MCPNotification);
      } else {
        this.handleResponse(message as MCPResponse);
      }
    });
    
    this.transport.onError((error) => {
      console.error('MCP transport error:', error);
      EventBus.emit(OrchflowEvents.SYSTEM_ERROR, {
        error: `MCP transport error: ${error.message}`,
      });
    });
    
    this.transport.onClose(() => {
      this.emit('disconnected');
      // Reject all pending requests
      for (const [id, pending] of this.pendingRequests) {
        pending.reject(new Error('Transport closed'));
        if (pending.timer) clearTimeout(pending.timer);
      }
      this.pendingRequests.clear();
    });
  }
  
  async connect(): Promise<void> {
    const timer = metricsCollector.timer('mcp.connect');
    
    try {
      // Initialize session
      const result = await this.request(MCPMethods.INITIALIZE, {
        protocolVersion: '2024-11-05',
        capabilities: this.config.capabilities,
        clientInfo: {
          name: this.config.name,
          version: this.config.version,
        },
      });
      
      this.serverCapabilities = result.capabilities;
      this.emit('connected', result);
      
      // Send initialized notification
      await this.notify(MCPMethods.INITIALIZED, {});
      
      // Load available tools, prompts, and resources
      await this.loadServerFeatures();
      
      metricsCollector.increment('mcp.connections.success');
    } catch (error) {
      metricsCollector.increment('mcp.connections.failed');
      throw error;
    } finally {
      timer();
    }
  }
  
  private async loadServerFeatures(): Promise<void> {
    const promises: Promise<any>[] = [];
    
    if (this.serverCapabilities?.tools) {
      promises.push(this.loadTools());
    }
    
    if (this.serverCapabilities?.prompts) {
      promises.push(this.loadPrompts());
    }
    
    if (this.serverCapabilities?.resources) {
      promises.push(this.loadResources());
    }
    
    await Promise.all(promises);
  }
  
  private async loadTools(): Promise<void> {
    const result = await this.request(MCPMethods.TOOLS_LIST, {});
    this.tools.clear();
    
    for (const tool of result.tools || []) {
      this.tools.set(tool.name, tool);
    }
    
    console.log(`Loaded ${this.tools.size} MCP tools`);
  }
  
  private async loadPrompts(): Promise<void> {
    const result = await this.request(MCPMethods.PROMPTS_LIST, {});
    this.prompts.clear();
    
    for (const prompt of result.prompts || []) {
      this.prompts.set(prompt.name, prompt);
    }
    
    console.log(`Loaded ${this.prompts.size} MCP prompts`);
  }
  
  private async loadResources(): Promise<void> {
    const result = await this.request(MCPMethods.RESOURCES_LIST, {});
    this.resources.clear();
    
    for (const resource of result.resources || []) {
      this.resources.set(resource.uri, resource);
    }
    
    console.log(`Loaded ${this.resources.size} MCP resources`);
  }
  
  async callTool(name: string, args: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    const timer = metricsCollector.timer('mcp.tool_call', { tool: name });
    
    try {
      const result = await this.request(MCPMethods.TOOLS_CALL, {
        name,
        arguments: args,
      });
      
      metricsCollector.increment('mcp.tool_calls.success', 1, { tool: name });
      return result;
    } catch (error) {
      metricsCollector.increment('mcp.tool_calls.failed', 1, { tool: name });
      throw error;
    } finally {
      timer();
    }
  }
  
  async getPrompt(name: string, args?: Record<string, any>): Promise<any> {
    const prompt = this.prompts.get(name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    
    const result = await this.request(MCPMethods.PROMPTS_GET, {
      name,
      arguments: args,
    });
    
    return result;
  }
  
  async readResource(uri: string): Promise<any> {
    const resource = this.resources.get(uri);
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    const result = await this.request(MCPMethods.RESOURCES_READ, { uri });
    return result;
  }
  
  async subscribeToResource(uri: string): Promise<void> {
    await this.request(MCPMethods.RESOURCES_SUBSCRIBE, { uri });
  }
  
  async unsubscribeFromResource(uri: string): Promise<void> {
    await this.request(MCPMethods.RESOURCES_UNSUBSCRIBE, { uri });
  }
  
  private async request(method: string, params?: any, timeout = 30000): Promise<any> {
    const id = ++this.requestId;
    
    const request: MCPRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };
    
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, timeout);
      
      this.pendingRequests.set(id, { resolve, reject, timer });
      
      this.transport.send(request).catch((error) => {
        this.pendingRequests.delete(id);
        clearTimeout(timer);
        reject(error);
      });
    });
  }
  
  private async notify(method: string, params?: any): Promise<void> {
    const notification: MCPNotification = {
      jsonrpc: '2.0',
      method,
      params,
    };
    
    await this.transport.send(notification);
  }
  
  private handleResponse(response: MCPResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) return;
    
    this.pendingRequests.delete(response.id);
    if (pending.timer) clearTimeout(pending.timer);
    
    if (response.error) {
      pending.reject(new Error(response.error.message));
    } else {
      pending.resolve(response.result);
    }
  }
  
  private handleNotification(notification: MCPNotification): void {
    switch (notification.method) {
      case MCPMethods.NOTIFICATION_PROGRESS:
        this.emit('progress', notification.params);
        break;
        
      case MCPMethods.NOTIFICATION_TOOLS_LIST_CHANGED:
        this.loadTools().catch(console.error);
        break;
        
      case MCPMethods.NOTIFICATION_PROMPTS_LIST_CHANGED:
        this.loadPrompts().catch(console.error);
        break;
        
      case MCPMethods.NOTIFICATION_RESOURCES_LIST_CHANGED:
        this.loadResources().catch(console.error);
        break;
        
      default:
        this.emit('notification', notification);
    }
  }
  
  getTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }
  
  getPrompts(): MCPPrompt[] {
    return Array.from(this.prompts.values());
  }
  
  getResources(): MCPResource[] {
    return Array.from(this.resources.values());
  }
  
  getCapabilities(): MCPCapabilities | undefined {
    return this.serverCapabilities;
  }
  
  async disconnect(): Promise<void> {
    try {
      await this.notify(MCPMethods.SHUTDOWN, {});
    } catch {
      // Ignore errors during shutdown
    }
    
    await this.transport.close();
    this.emit('disconnected');
  }
}