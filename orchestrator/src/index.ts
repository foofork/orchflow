// orchflow Orchestrator
// Unified orchestrator with all features

export { Orchestrator, OrchestratorConfig, createOrchestrator } from './orchestrator';

// Export core types and utilities
export { Agent, AgentType } from './agent-manager';
export { EventBus, OrchflowEvents } from './core/event-bus';

// Export enhanced features for direct usage
export { SessionManager, Session } from './core/session-manager';
export { ProtocolManager, Protocol } from './core/protocol-manager';
export { ModeManager, SparcMode } from './modes/mode-manager';
export { AdvancedMemoryManager, MemoryBackend } from './memory/advanced-memory-manager';
export { TaskScheduler, Task } from './coordination/task-scheduler';
export { SwarmCoordinator, SwarmTask } from './coordination/swarm-coordinator';
export { MCPRegistry } from './mcp/mcp-registry';
export { metricsCollector } from './metrics/metrics-collector';

// Export types
export type { OrchflowEventMap } from './types/events';
export type { MCPServer, MCPTool, MCPPrompt } from './mcp/types';