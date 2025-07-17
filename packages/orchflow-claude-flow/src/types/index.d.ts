/**
 * OrchFlow Type Definitions
 * Enterprise-grade TypeScript types for the OrchFlow system
 */

// Core Types
export interface Task {
  id: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority?: TaskPriority;
  workerId?: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  deadline?: Date;
  metadata?: Record<string, unknown>;
}

export type TaskType = 'development' | 'testing' | 'research' | 'analysis' | 'deployment' | 'monitoring';
export type TaskStatus = 'pending' | 'assigned' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  status: WorkerStatus;
  task?: Task;
  capabilities: string[];
  resourceUsage: ResourceUsage;
  quickAccessKey?: number;
  createdAt: Date;
  lastActive: Date;
  sessionId?: string;
  paneId?: string;
}

export type WorkerType = 'developer' | 'tester' | 'researcher' | 'analyst' | 'architect' | 'reviewer' | 'coordinator';
export type WorkerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'crashed';

export interface ResourceUsage {
  cpu: number;
  memory: number;
  diskIO?: number;
  networkIO?: number;
}

export interface SessionState {
  id: string;
  name: string;
  workers: Worker[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

// Natural Language Types
export interface NLIntent {
  intent: IntentType;
  confidence: number;
  entities: Record<string, any>;
  originalText: string;
}

export type IntentType = 
  | 'create_task'
  | 'list_workers'
  | 'connect_worker'
  | 'stop_worker'
  | 'quick_access'
  | 'save_session'
  | 'restore_session'
  | 'show_status'
  | 'help'
  | 'unknown';

// MCP Tool Types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  handler: (input: any) => Promise<any>;
}

// Configuration Types
export interface OrchFlowConfig {
  orchestrator: {
    port: number;
    host: string;
    maxWorkers: number;
    workerTimeout: number;
    enableSSL?: boolean;
    sslCert?: string;
    sslKey?: string;
  };
  ui: {
    theme: 'light' | 'dark';
    statusPaneWidth: number;
    enableAnimations: boolean;
    fontSize?: number;
    fontFamily?: string;
  };
  storage: {
    type: 'memory' | 'file' | 'redis';
    path?: string;
    connectionString?: string;
    encryptionKey?: string;
  };
  security: {
    enableAuth: boolean;
    authProvider?: 'local' | 'ldap' | 'oauth2' | 'saml';
    allowedCommands?: string[];
    forbiddenPatterns?: string[];
    maxSessionDuration?: number;
  };
  monitoring: {
    enableMetrics: boolean;
    metricsPort?: number;
    enableTracing: boolean;
    jaegerEndpoint?: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Event Types
export interface OrchFlowEvent {
  type: EventType;
  timestamp: Date;
  source: string;
  data: any;
}

export type EventType =
  | 'worker.created'
  | 'worker.started'
  | 'worker.stopped'
  | 'worker.crashed'
  | 'task.created'
  | 'task.assigned'
  | 'task.completed'
  | 'task.failed'
  | 'session.saved'
  | 'session.restored'
  | 'system.error'
  | 'system.warning';

// Error Types
export class OrchFlowError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: any
  ) {
    super(message);
    this.name = 'OrchFlowError';
  }
}

export type ErrorCode =
  | 'WORKER_LIMIT_EXCEEDED'
  | 'WORKER_NOT_FOUND'
  | 'TASK_NOT_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'INVALID_CONFIGURATION'
  | 'TMUX_NOT_AVAILABLE'
  | 'AUTHENTICATION_FAILED'
  | 'AUTHORIZATION_FAILED'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_ERROR';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: ErrorCode;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: Date;
    requestId: string;
    duration: number;
  };
}

// WebSocket Message Types
export interface WSMessage {
  type: WSMessageType;
  payload: any;
  id: string;
  timestamp: Date;
}

export type WSMessageType =
  | 'worker.update'
  | 'task.update'
  | 'system.status'
  | 'terminal.output'
  | 'error'
  | 'ping'
  | 'pong';

// Performance Metrics
export interface PerformanceMetrics {
  system: {
    uptime: number;
    cpuUsage: number;
    memoryUsage: number;
    activeWorkers: number;
    completedTasks: number;
  };
  workers: {
    [workerId: string]: {
      taskCount: number;
      averageCompletionTime: number;
      successRate: number;
      resourceEfficiency: number;
    };
  };
  tasks: {
    totalCreated: number;
    totalCompleted: number;
    averageDuration: number;
    failureRate: number;
  };
}