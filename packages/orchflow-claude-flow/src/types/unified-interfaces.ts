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
  | 'specialist'
  | 'developer'; // Added to support existing code

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
  currentTask?: Task | string; // Support both Task object and string
  estimatedCompletion?: Date;
  priority?: number;
}

// Extended Worker interface for advanced features
export interface ExtendedWorker extends Worker {
  descriptiveName: string;
  quickAccessKey?: number;
  currentTask?: Task | string; // Support both Task object and string
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
  type?: 'research' | 'code' | 'test' | 'analysis' | 'swarm' | 'hive-mind' | string; // Support all type variants
  priority: 'low' | 'medium' | 'high' | 'critical' | number; // Support both string and number
  status: 'pending' | 'in_progress' | 'running' | 'completed' | 'failed' | 'blocked' | string; // Support all status variants
  assignedTo?: string;
  assignedWorker?: string; // Alias for assignedTo
  assignedWorkerName?: string; // Worker descriptive name
  dependencies?: string[];
  createdAt?: Date; // Made optional for compatibility
  updatedAt?: Date; // Made optional for compatibility
  completedAt?: Date;
  estimatedDuration?: number;
  actualDuration?: number;
  metadata?: Record<string, any>;
  parameters?: any; // From orchestrator variants
  claudeFlowCommand?: string; // Specific to orchestrator
  config?: any; // Task-specific config
  deadline?: string; // Task deadline
  error?: string; // Error message if failed
  descriptiveName?: string; // From orchestrator-client
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

// Worker list context from functional-context.ts
export interface WorkerListContext {
  workers: Array<{
    id: string;
    descriptiveName: string;
    status: 'active' | 'paused' | 'completed';
    currentTask?: string;
    quickAccessKey?: number;
    progress?: number;
    estimatedCompletion?: Date;
  }>;
}

// Task context from functional-context.ts
export interface TaskContext {
  mainObjective: string;
  activeSubtasks: string[];
  completedTasks: string[];
  dependencies: Map<string, string[]>;
  taskHistory: Array<{task: string, status: string, timestamp: Date}>;
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
  workers: Worker[] | WorkerInfo[] | any[]; // Support all worker types
  tasks: Task[];
  startTime: Date;
  endTime?: Date;
  lastUpdate?: Date; // From state-manager
  status?: 'active' | 'paused' | 'completed' | 'failed'; // Made optional
  metadata?: Record<string, any>;

  // Additional properties from other variants
  conversation?: any; // From orchestrator-client
  mainObjective?: string; // From multiple sources
  activeSubtasks?: string[]; // From multiple sources
  completedTasks?: string[]; // From multiple sources
  dependencies?: [string, string[]][]; // From multiple sources
  taskHistory?: Array<{task: string, status: string, timestamp: Date}>; // From orchestrator-client
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
  paneId: string;
  workerName: string;
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
  name?: string; // Optional for compatibility
  descriptiveName?: string; // From conversation-context
  type?: WorkerType; // Made optional for compatibility
  status: WorkerStatus | string; // Support both enum and string
  currentTask?: string; // Always string to match status pane expectations
  lastActivity?: Date; // Made optional
  progress?: number; // From conversation-context
  quickAccessKey?: number; // From conversation-context
  tmuxPaneId?: string; // From conversation-context
  resources?: ResourceUsage; // Resource usage information
  estimatedCompletion?: Date; // Added missing property
  resourceUsage?: ResourceUsage; // Alias for resources
}

// ================================
// Performance and Metrics Interfaces
// ================================

export interface ResourceUsage {
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
}

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

// Unified SetupResult interface - combines both variants
export interface SetupResult {
  success: boolean;
  flow: SetupFlowString | SetupFlow; // Support both string and SetupFlow type
  environment: SetupEnvironment | TerminalEnvironment; // Support both environment types
  dependencies?: {
    tmux: TmuxInstallationResult;
    claudeFlow: { installed: boolean; version?: string };
  };
  config: {
    core: any;
    splitScreen: any;
    terminal: any;
  } | OrchFlowConfigFile; // Support both config formats
  performance: {
    totalTime: number;
    steps?: Array<{ name: string; duration: number; success: boolean }>;
    detectionTime?: number;
    configTime?: number;
    setupTime?: number;
    interactionTime?: number;
  };
  errors?: string[];
  warnings?: string[];
}

// Supporting types for SetupResult
export interface SetupFlow {
  type: 'basic' | 'advanced' | 'custom';
  description?: string;
}

// String alias for setup flow router compatibility
export type SetupFlowString = 'tmux' | 'screen' | 'zellij' | 'native' | 'fallback' | string;

export interface SetupEnvironment {
  isVSCode: boolean;
  isTmux: boolean;
  hasClaudeFlow: boolean;
  platform: string;
  shell: string;
  // Additional properties from enhanced setup
  terminal?: string;
  hasTmux?: boolean;
  isInsideTmux?: boolean;
  isCodespaces?: boolean;
  terminalSize?: { width: number; height: number };
  packageManagers?: string[];
  userPreference?: UserSetupPreference;
  // Ensure backward compatibility
  Platform?: string; // Alias for platform
}

export interface UserSetupPreference {
  mode: 'auto' | 'tmux' | 'inline' | 'statusbar' | 'window';
  autoInstallDependencies: boolean;
  packageManager?: string;
  skipSetupPrompts?: boolean;
  tmuxConfig?: {
    orchflowBindings: boolean;
    mouseSupport: boolean;
    customPrefix?: string;
  };
}

export interface TerminalEnvironment extends SetupEnvironment {
  terminal?: string;
  terminalVersion?: string;
  // Add missing properties that are expected by terminal-environment-detector
  multiplexer?: 'tmux' | 'screen' | 'none';
  capabilities?: string[];
}

export interface TmuxInstallationResult {
  installed: boolean;
  version?: string;
  path?: string;
  error?: string;
  // Add TmuxInstallerResult compatibility properties
  success: boolean;
  alreadyInstalled: boolean;
  installMethod?: string;
  configUpdated: boolean;
  errorMessage?: string;
}

// Type alias for compatibility
export type TmuxInstallerResult = TmuxInstallationResult;

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
  // Add missing properties
  setup?: SetupFlowConfig;
  splitScreen?: SplitScreenConfig;
  ui?: {
    theme: 'auto' | 'light' | 'dark';
    statusPane: {
      enabled: boolean;
      width: number;
      updateInterval: number;
    };
    keybindings: Record<string, string>;
  };
  terminal?: {
    multiplexer: 'tmux' | 'screen' | 'none';
    sessionName?: string;
  };
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

// Missing export for WorkerContext (needed by functional-context.ts)
export type { WorkerContext as WorkerContextBase };

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

export type {
  Worker as BaseWorker,
  WorkerContext as BaseWorkerContext,
  OrchFlowConfig as BaseOrchFlowConfig,
  MCPTool as BaseMCPTool,
  MCPRequest as BaseMCPRequest,
  MCPResponse as BaseMCPResponse
};