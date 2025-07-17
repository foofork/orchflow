/**
 * Primary Terminal Module
 * Main terminal interface for OrchFlow
 */

// Export the main terminal class
export { OrchFlowTerminal as PrimaryTerminal } from './orchflow-terminal';
export { OrchFlowTerminalInjected } from './orchflow-terminal-injected';

// Export supporting classes
export { MCPClient } from './mcp-client';
export { ConversationContext } from './conversation-context';
export { OrchestratorClient } from './orchestrator-client';
export { StatusPane } from './status-pane';
export { WorkerAccessManager } from './worker-access-manager';
export { WorkerNamer } from './worker-namer';

// Export interfaces
export type { OrchFlowTerminalConfig } from './orchflow-terminal';

// Export additional types for terminal module
export interface TerminalConfig {
  // Terminal configuration options
}

export interface TerminalOptions {
  // Terminal options
}

export interface TerminalCommand {
  // Terminal command structure
}

// Default export
export { OrchFlowTerminal as default } from './orchflow-terminal';