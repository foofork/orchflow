/**
 * OrchFlow Type Definitions
 */

export type WorkerType = 
  | 'coordinator' 
  | 'researcher' 
  | 'coder' 
  | 'developer'
  | 'analyst' 
  | 'architect' 
  | 'tester' 
  | 'reviewer' 
  | 'optimizer' 
  | 'documenter' 
  | 'monitor' 
  | 'specialist';

export type WorkerStatus = 'idle' | 'active' | 'busy' | 'completed' | 'error';

export interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  task: string;
  status: WorkerStatus;
  context: WorkerContext;
  progress: number;
  createdAt: Date;
  lastActive: Date;
  parentId?: string;
  children: string[];
  metadata?: Record<string, any>;
}

export interface WorkerContext {
  conversationHistory: Message[];
  sharedKnowledge: SharedKnowledge;
  codeArtifacts: CodeArtifact[];
  decisions: Decision[];
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  workerId: string;
}

export interface CodeArtifact {
  id: string;
  filename: string;
  content: string;
  language: string;
  version: number;
  workerId: string;
  timestamp: Date;
}

export interface Decision {
  id: string;
  description: string;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
  workerId: string;
  timestamp: Date;
}

export interface SharedKnowledge {
  [domain: string]: any;
}

export type TaskType = 'development' | 'research' | 'analysis' | 'testing' | 'documentation';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Task {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: string;
  dependencies: string[];
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

export interface OrchFlowConfig {
  port: number;
  host: string;
  enablePersistence: boolean;
  persistencePath: string;
  enableWebSocket: boolean;
  maxWorkers: number;
  security?: SecurityConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface SecurityConfig {
  enableAuth: boolean;
  apiKeys?: string[];
  jwtSecret?: string;
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  contentSecurityPolicy: boolean;
  encryption: {
    enabled: boolean;
    algorithm: string;
    key?: string;
  };
}

export interface LaunchOptions {
  debug?: boolean;
  port?: number;
  host?: string;
  ui?: boolean;
  noCore?: boolean;
  restore?: string;
  dataDir?: string;
  config?: string;
}

export type EventType = 
  | 'worker:created'
  | 'worker:updated'
  | 'worker:deleted'
  | 'worker:context:switched'
  | 'knowledge:shared'
  | 'task:created'
  | 'task:updated'
  | 'task:completed'
  | 'system:ready'
  | 'system:error';

export interface OrchFlowEvent {
  type: EventType;
  timestamp: Date;
  data: any;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  handler?: (input: any) => Promise<any>;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: any;
}

// MCP specific types
export interface MCPRequest {
  method: string;
  params?: any;
}

export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}