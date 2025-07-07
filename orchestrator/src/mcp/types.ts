// MCP (Model Context Protocol) types for OrchFlow

export interface MCPServer {
  id: string;
  name: string;
  version: string;
  capabilities: MCPCapabilities;
  status: 'connected' | 'disconnected' | 'error';
  endpoint: string;
  transport: 'http' | 'stdio' | 'websocket';
}

export interface MCPCapabilities {
  tools?: boolean;
  prompts?: boolean;
  resources?: boolean;
  logging?: boolean;
  sampling?: boolean;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Methods
export enum MCPMethods {
  // Session
  INITIALIZE = 'initialize',
  INITIALIZED = 'initialized',
  SHUTDOWN = 'shutdown',
  
  // Tools
  TOOLS_LIST = 'tools/list',
  TOOLS_CALL = 'tools/call',
  
  // Prompts
  PROMPTS_LIST = 'prompts/list',
  PROMPTS_GET = 'prompts/get',
  
  // Resources
  RESOURCES_LIST = 'resources/list',
  RESOURCES_READ = 'resources/read',
  RESOURCES_SUBSCRIBE = 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE = 'resources/unsubscribe',
  
  // Sampling
  SAMPLING_CREATE = 'sampling/createMessage',
  
  // Logging
  LOGGING_SET_LEVEL = 'logging/setLevel',
  
  // Notifications
  NOTIFICATION_PROGRESS = 'notifications/progress',
  NOTIFICATION_TOOLS_LIST_CHANGED = 'notifications/tools/list_changed',
  NOTIFICATION_RESOURCES_LIST_CHANGED = 'notifications/resources/list_changed',
  NOTIFICATION_PROMPTS_LIST_CHANGED = 'notifications/prompts/list_changed',
}

// Transport interfaces
export interface MCPTransport {
  send(message: MCPRequest | MCPNotification): Promise<void>;
  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void;
  onError(handler: (error: Error) => void): void;
  onClose(handler: () => void): void;
  close(): Promise<void>;
}

export interface MCPClientConfig {
  name: string;
  version: string;
  transport: MCPTransport;
  capabilities?: MCPCapabilities;
}