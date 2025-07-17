/**
 * Unified Interface Definitions for OrchFlow
 * 
 * This file contains harmonized interface definitions that resolve
 * conflicts between different modules and ensure type consistency.
 */

// ================================
// Core Worker Interfaces
// ================================

export type WorkerType = 
  | 'coordinator'
  | 'researcher'
  | 'coder'
  | 'analyst'
  | 'architect'
  | 'tester'
  | 'reviewer'
  | 'optimizer'
  | 'documenter'
  | 'monitor'
  | 'specialist';

export type WorkerStatus = 
  | 'idle'
  | 'active'
  | 'busy'
  | 'spawning'
  | 'running'
  | 'paused'
  | 'stopped'
  | 'completed'
  | 'error';

// Base Worker interface - used across all modules
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
  
  // Additional properties for compatibility
  descriptiveName?: string;
  quickAccessKey?: number;
  startTime?: Date;
  resources?: {
    cpuUsage: number;
    memoryUsage: number;
    maxCpu?: number;
    maxMemory?: number;
  };
  capabilities?: string[];
  output?: string[];
  connection?: {
    type: 'tmux' | 'process';
    sessionName?: string;
    pid?: number;
  };
  config?: any;
  
  // Process-specific properties
  process?: any; // ChildProcess
  tmuxSession?: string;
  currentTask?: Task;
  estimatedCompletion?: Date;
  priority?: number;
}

// Extended Worker interface for advanced features
export interface ExtendedWorker extends Worker {
  descriptiveName: string;
  quickAccessKey?: number;
  currentTask?: Task;
  startTime?: Date;
  resources: {
    cpuUsage: number;
    memoryUsage: number;
    maxCpu?: number;
    maxMemory?: number;
  };
  estimatedCompletion?: Date;
  priority?: number;
  capabilities: string[];
  output: string[];
  connection: {
    type: 'tmux' | 'process';
    sessionName?: string;
    pid?: number;
  };
}

// Rich Worker interface for enhanced MCP tools
export interface ExtendedWorkerRich extends ExtendedWorker {
  performance: {
    averageResponseTime: number;
    tasksCompleted: number;
    errorRate: number;
  };
  insights: {
    expertiseAreas: string[];
    commonPatterns: string[];
  };
}

// ================================
// Task and Context Interfaces
// ================================

export interface Task {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  assignedTo?: string;
  dependencies?: string[];
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  metadata?: Record<string, any>;
}

export interface WorkerContext {
  conversationHistory: Message[];
  sharedKnowledge: SharedKnowledge;
  codeArtifacts: CodeArtifact[];
  decisions: Decision[];
  memory?: WorkerMemoryContext;
}

export interface WorkerMemoryContext {
  shortTerm: Record<string, any>;
  longTerm: Record<string, any>;
  learnings: Record<string, any>;
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
  metadata?: Record<string, any>;
}

export interface Decision {
  id: string;
  description: string;
  reasoning: string;
  impact: 'low' | 'medium' | 'high';
  workerId: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SharedKnowledge {
  facts: Record<string, any>;
  patterns: Record<string, any>;
  insights: Record<string, any>;
  bestPractices: Record<string, any>;
}

// ================================
// Configuration Interfaces
// ================================

// Main OrchFlow configuration interface
export interface OrchFlowConfig {
  port: number;
  host: string;
  storageDir: string;
  maxWorkers: number;
  enablePersistence: boolean;
  enableWebSocket: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  
  // Nested configuration objects
  core: CoreConfig;
  security: SecurityConfig;
  splitScreen: SplitScreenConfig;
  terminal: TerminalConfig;
  orchestrator?: OrchFlowOrchestratorConfig;
}

// Core configuration
export interface CoreConfig {
  port: number;
  enablePersistence: boolean;
  enableWebSocket: boolean;
  mode: string;
  maxWorkers: number;
  storageDir: string;
}

// Security configuration
export interface SecurityConfig {
  enableAuth: boolean;
  apiKey?: string;
  apiKeys?: string[];
  jwtSecret?: string;
  allowedOrigins: string[];
  rateLimiting: {
    enabled: boolean;
    windowMs: number;
    maxRequests: number;
  };
  cors: {
    enabled: boolean;
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
  };
}

// Split screen configuration
export interface SplitScreenConfig {
  enabled: boolean;
  primaryWidth: number;
  statusWidth: number;
  sessionName: string;
  enableQuickAccess: boolean;
}

// Terminal configuration
export interface TerminalConfig {
  mode: string;
  statusUpdateInterval: number;
  showResourceUsage: boolean;
  maxWorkersDisplay: number;
}

// Orchestrator configuration
export interface OrchFlowOrchestratorConfig {
  maxWorkers: number;
  defaultWorkerType: WorkerType;
  enableAutoScaling: boolean;
  resourceLimits: {
    memory: number;
    cpu: number;
  };
}

// Worker-specific configuration
export interface WorkerConfig {
  id: string;
  type: WorkerType;
  resources: {
    memory: number;
    cpu: number;
    maxCpu?: number;
    maxMemory?: number;
  };
  capabilities: string[];
  timeout?: number;
  retries?: number;
}

// ================================
// MCP Interfaces
// ================================

// Unified MCP Tool interface
export interface MCPTool {
  name: string;
  description: string;
  parameters: any;
  inputSchema?: any;
  handler: (params: any) => Promise<any>;
}

// MCP Prompt interface
export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: any;
}

// MCP Request interface
export interface MCPRequest {
  method: string;
  params?: any;
  id?: string;
  jsonrpc?: string;
}

// MCP Response interface
export interface MCPResponse {
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id?: string;
  jsonrpc?: string;
}

// MCP Message interface
export interface MCPMessage {
  id: string;
  type: 'request' | 'response' | 'notification';
  method?: string;
  params?: any;
  result?: any;
  error?: MCPError;
}

// MCP Error interface
export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// MCP Tool Info interface
export interface MCPToolInfo {
  name: string;
  description: string;
  inputSchema: any;
}

// ================================
// Session and Data Interfaces
// ================================

export interface SessionData {
  id: string;
  workers: Worker[];
  tasks: Task[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'paused' | 'completed' | 'failed';
  metadata?: Record<string, any>;
}

export interface LaunchOptions {
  port?: number;
  host?: string;
  config?: string;
  verbose?: boolean;
  debug?: boolean;
  agents?: number;
  mode?: string;
  splitScreen?: boolean;
  interactive?: boolean;
}

// ================================
// Worker Access and Search Interfaces
// ================================

export interface WorkerAccessSession {
  id: string;
  workerId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
}

export interface WorkerSearchResult {
  worker: ExtendedWorker;
  confidence: number;
  matchType: 'exact' | 'partial' | 'fuzzy' | 'numeric';
  matchField: 'name' | 'description' | 'quickKey';
}

export interface WorkerConnection {
  workerId: string;
  type: 'tmux' | 'process';
  sessionName?: string;
  pid?: number;
  isActive: boolean;
}

export interface WorkerDisplay {
  id: string;
  name: string;
  type: WorkerType;
  status: WorkerStatus;
  progress: number;
  quickAccessKey?: number;
}

export interface WorkerInfo {
  id: string;
  name: string;
  type: WorkerType;
  status: WorkerStatus;
  currentTask?: string;
  lastActivity: Date;
}

// ================================
// Performance and Metrics Interfaces
// ================================

export interface PerformanceMetrics {
  setupTime: number;
  memoryUsage: number;
  cpuUsage: number;
  activeWorkers: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskDuration: number;
  throughput: number;
  errorRate: number;
}

export interface WorkerMetrics {
  workerId: string;
  cpuUsage: number;
  memoryUsage: number;
  tasksCompleted: number;
  averageResponseTime: number;
  errorCount: number;
  uptime: number;
  lastActivity: Date;
}

// ================================
// State Management Interfaces
// ================================

export interface StateConfig {
  persistenceEnabled: boolean;
  storageLocation: string;
  autoSave: boolean;
  saveInterval: number;
  compressionEnabled: boolean;
}

export interface WorkerId {
  id: string;
  type: WorkerType;
  name: string;
}

// ================================
// Setup and Configuration Interfaces
// ================================

export interface SetupFlowConfig {
  skipWelcome: boolean;
  autoInstallDeps: boolean;
  preferredTerminal: string;
  defaultWorkerCount: number;
  enableTelemetry: boolean;
}

export interface OrchFlowConfigFile {
  version: string;
  config: OrchFlowConfig;
  lastModified: Date;
  checksum: string;
}

export interface MenuConfig {
  title: string;
  options: Array<{
    name: string;
    value: string;
    description?: string;
    disabled?: boolean;
  }>;
  pageSize?: number;
  loop?: boolean;
}

export interface ConfirmationConfig {
  message: string;
  default?: boolean;
}

export interface ProgressConfig {
  title: string;
  total?: number;
  current?: number;
}

export interface StatusPaneConfig {
  updateInterval: number;
  showMetrics: boolean;
  maxWorkers: number;
  theme: 'light' | 'dark';
}

// ================================
// Instruction and Context Interfaces
// ================================

export interface InstructionConfig {
  templates: Record<string, string>;
  variables: Record<string, any>;
  enableDynamic: boolean;
}

export interface FunctionalContext {
  functions: Record<string, Function>;
  variables: Record<string, any>;
  imports: Record<string, any>;
}

// ================================
// Tmux Configuration Interfaces
// ================================

export interface TmuxConfiguration {
  sessionName: string;
  windowName: string;
  paneLayout: string;
  enableStatusBar: boolean;
  enableMouse: boolean;
  keyBindings: Record<string, string>;
  colors: {
    statusBar: string;
    activeWindow: string;
    inactiveWindow: string;
  };
}

export interface TmuxConfig {
  sessionName: string;
  windowName: string;
  enableStatusBar: boolean;
  enableMouse: boolean;
  paneLayout: string;
}

// ================================
// Test Configuration Interface
// ================================

export interface TestConfig {
  testDir: string;
  timeout: number;
  retries: number;
  verbose: boolean;
  coverage: boolean;
  parallel: boolean;
}

// ================================
// Main Orchestrator Configuration
// ================================

export interface MainOrchestratorConfig {
  maxWorkers: number;
  defaultTimeout: number;
  enableLogging: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  persistence: {
    enabled: boolean;
    location: string;
    autoSave: boolean;
  };
  security: SecurityConfig;
  performance: {
    enableMetrics: boolean;
    metricsInterval: number;
    resourceLimits: {
      memory: number;
      cpu: number;
    };
  };
}

// ================================
// Re-export commonly used types
// ================================

export {
  Worker as BaseWorker,
  WorkerContext as BaseWorkerContext,
  OrchFlowConfig as BaseOrchFlowConfig,
  MCPTool as BaseMCPTool,
  MCPRequest as BaseMCPRequest,
  MCPResponse as BaseMCPResponse
};