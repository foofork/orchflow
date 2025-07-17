/**
 * Consolidated Managers Export
 * Exports the 5 core managers after consolidation
 */

export { ConfigurationManager } from './configuration-manager';
export { ContextManager } from './context-manager';
export { TerminalManager } from './terminal-manager';

// Re-export existing managers that don't need consolidation
export { WorkerManager } from '../orchestrator/worker-manager';
export { StatusPaneManager } from '../primary-terminal/status-pane-integration';
export { StatusPaneManager as UIManager } from '../primary-terminal/status-pane-integration'; // Alias for consistency

// Export types
export type {
  OrchFlowConfigFile
} from './configuration-manager';

export type {
  WorkerContext,
  TaskContext,
  ConversationContext,
  ConversationMessage,
  MemorySearchResult,
  ContextManagerOptions
} from './context-manager';

export type {
  TerminalState,
  TerminalOptions,
  TerminalSession
} from './terminal-manager';

// Helper function to get all managers
export function getAllManagers() {
  const { ConfigurationManager } = require('./configuration-manager');
  const { ContextManager } = require('./context-manager');
  const { TerminalManager } = require('./terminal-manager');
  const { WorkerManager } = require('../orchestrator/worker-manager');
  const { StatusPaneManager } = require('../primary-terminal/status-pane-integration');

  return {
    configuration: ConfigurationManager.getInstance(),
    context: ContextManager.getInstance(),
    terminal: TerminalManager.getInstance(),
    worker: WorkerManager,
    ui: StatusPaneManager
  };
}