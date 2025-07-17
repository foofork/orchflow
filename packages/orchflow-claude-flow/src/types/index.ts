/**
 * OrchFlow Type Definitions
 *
 * This file re-exports all unified interface definitions to maintain compatibility
 * while ensuring type consistency across the entire system.
 */

// Re-export all unified interfaces
export type {
  // Core Worker Types
  WorkerType,
  WorkerStatus,
  Worker,
  ExtendedWorker,
  ExtendedWorkerRich,
  WorkerContext,
  WorkerMemoryContext,

  // Task and Context Types
  Task,
  Message,
  CodeArtifact,
  Decision,
  SharedKnowledge,

  // Configuration Types
  OrchFlowConfig,
  CoreConfig,
  SecurityConfig,
  SplitScreenConfig,
  TerminalConfig,
  OrchFlowOrchestratorConfig,
  WorkerConfig,

  // MCP Types
  MCPTool,
  MCPPrompt,
  MCPRequest,
  MCPResponse,
  MCPMessage,
  MCPError,
  MCPToolInfo,

  // Session and Data Types
  SessionData,
  LaunchOptions,

  // Worker Access Types
  WorkerAccessSession,
  WorkerSearchResult,
  WorkerConnection,
  WorkerDisplay,
  WorkerInfo,

  // Performance Types
  PerformanceMetrics,
  WorkerMetrics,

  // State Management Types
  StateConfig,
  WorkerId,

  // Setup Types
  SetupFlowConfig,
  OrchFlowConfigFile,
  MenuConfig,
  ConfirmationConfig,
  ProgressConfig,
  StatusPaneConfig,

  // Instruction Types
  InstructionConfig,
  FunctionalContext,

  // Tmux Types
  TmuxConfiguration,
  TmuxConfig,

  // Test Types
  TestConfig,

  // Main Orchestrator Types
  MainOrchestratorConfig
} from './unified-interfaces';

// Additional types for backward compatibility
export type TaskType = 'development' | 'research' | 'analysis' | 'testing' | 'documentation';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

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

// Export unified interfaces as default base types for compatibility
export type {
  Worker as BaseWorker,
  WorkerContext as BaseWorkerContext,
  OrchFlowConfig as BaseOrchFlowConfig,
  MCPTool as BaseMCPTool,
  MCPRequest as BaseMCPRequest,
  MCPResponse as BaseMCPResponse
} from './unified-interfaces';