/**
 * OrchFlow - Natural Language Orchestration for Claude
 *
 * Main export file for programmatic usage
 */

export { OrchFlowCore } from './core/orchflow-core';
export { OrchFlowMCPServer } from './mcp/orchflow-mcp-server';
export { OrchFlowOrchestrator } from './orchestrator/orchflow-orchestrator';
export { PrimaryTerminal } from './primary-terminal/primary-terminal';

export type {
  Worker,
  WorkerContext,
  WorkerType,
  WorkerStatus,
  Task,
  TaskType,
  TaskStatus,
  TaskPriority,
  Message,
  CodeArtifact,
  Decision,
  OrchFlowConfig,
  OrchFlowEvent,
  EventType,
  LaunchOptions,
  SecurityConfig
} from './types/index';

// Version
export const VERSION = '0.1.0';

/**
 * Quick start function for programmatic usage
 */
export async function startOrchFlow(config?: Partial<import('./core/orchflow-core').OrchFlowConfig>) {
  const { OrchFlowCore } = await import('./core/orchflow-core');
  const core = new OrchFlowCore(config);
  await core.start();
  return core;
}