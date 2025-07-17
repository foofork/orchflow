/**
 * OrchFlow Setup Components - Main exports
 */

export { TerminalEnvironmentDetector } from './terminal-environment-detector';
export type { TerminalEnvironment, TerminalCapabilities } from './terminal-environment-detector';

export { SetupFlowRouter } from './setup-flow-router';
export type { SetupFlow, SetupFlowConfig, SetupStep } from './setup-flow-router';

export { OrchFlowConfigManager } from './orchflow-config-manager';
export type { OrchFlowConfigFile } from './orchflow-config-manager';

export { UserInteractionManager } from './user-interaction-manager';
export type { MenuOption, MenuConfig, ConfirmationConfig, ProgressConfig } from './user-interaction-manager';

export { OptimizedSetupOrchestrator } from './optimized-setup-orchestrator';
export type { SetupResult, SetupOptions } from './optimized-setup-orchestrator';

// Re-export commonly used types
export type { LaunchOptions, OrchFlowConfig } from '../types';