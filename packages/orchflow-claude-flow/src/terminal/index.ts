/**
 * OrchFlow Terminal Components - Main exports
 */

export { PrimaryTerminal } from '../primary-terminal/primary-terminal';
export { MCPTerminal } from '../primary-terminal/mcp-terminal';
export { OrchFlowTerminal } from '../primary-terminal/orchflow-terminal';
export { WorkerNamer } from '../primary-terminal/worker-namer';
export { TerminalLauncher } from '../primary-terminal/terminal-launcher';
export { TerminalUI } from '../primary-terminal/terminal-ui';
export { TerminalStateManager } from '../primary-terminal/terminal-state-manager';
export { TerminalCommandProcessor } from '../primary-terminal/terminal-command-processor';
export { TerminalSessionManager } from '../primary-terminal/terminal-session-manager';

export type { TerminalConfig, TerminalOptions, TerminalCommand } from '../primary-terminal/primary-terminal';