// Core types for the agent system

export interface AgentManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  capabilities: string[];
  requiredPermissions: Permission[];
  resourceLimits?: ResourceLimits;
  author?: string;
}

export interface AgentHandler {
  manifest: AgentManifest;
  initialize(): Promise<void>;
  execute(task: Task): Promise<AgentResponse>;
  shutdown(): Promise<void>;
}

export interface Task {
  id: string;
  type: string;
  priority: Priority;
  payload: any;
  context: TaskContext;
  createdAt: Date;
  timeout?: number;
}

export interface TaskContext {
  sessionId: string;
  workspaceId: string;
  userId?: string;
  paneId?: string;
  environment: Record<string, string>;
}

export interface AgentResponse {
  taskId: string;
  status: 'success' | 'failure' | 'partial';
  result?: any;
  error?: string;
  metrics?: AgentMetrics;
  suggestions?: string[];
}

export interface AgentMetrics {
  executionTime: number;
  memoryUsed: number;
  cpuUsage?: number;
  tokensUsed?: number;
}

export interface ResourceLimits {
  maxMemoryMB: number;
  maxCpuPercent: number;
  maxExecutionTime: number;
  maxConcurrentTasks: number;
}

export enum Priority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  CRITICAL = 3
}

export enum Permission {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  NETWORK = 'network',
  PROCESS_SPAWN = 'process:spawn',
  TERMINAL_ACCESS = 'terminal:access',
  AI_ACCESS = 'ai:access',
  STATE_READ = 'state:read',
  STATE_WRITE = 'state:write'
}

export interface AgentInstance {
  id: string;
  manifest: AgentManifest;
  handler: AgentHandler;
  status: AgentStatus;
  startedAt: Date;
  lastActivity: Date;
  metrics: {
    tasksCompleted: number;
    tasksFailed: number;
    totalExecutionTime: number;
    averageExecutionTime: number;
  };
}

export enum AgentStatus {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated'
}