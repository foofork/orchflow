/**
 * OrchFlow Setup Components - Main exports
 */

export { TerminalEnvironmentDetector } from './terminal-environment-detector';
export type { TerminalEnvironment, TerminalCapabilities } from './terminal-environment-detector';

export { SetupFlowRouter } from './setup-flow-router';
export type { SetupFlow, SetupFlowConfig, SetupStep } from './setup-flow-router';

export { ConfigurationManager } from '../managers/configuration-manager';
export type { OrchFlowConfigFile } from '../managers/configuration-manager';

// Backward compatibility alias
export { ConfigurationManager as OrchFlowConfigManager } from '../managers/configuration-manager';

export { UserInteractionManager } from './user-interaction-manager';
export type { MenuOption, MenuConfig, ConfirmationConfig, ProgressConfig } from './user-interaction-manager';

// Legacy orchestrators removed - all functionality now in UnifiedSetupOrchestrator

export { UnifiedSetupOrchestrator } from './unified-setup-orchestrator';
export type { UnifiedSetupResult, SetupOptions as UnifiedSetupOptions } from './unified-setup-orchestrator';

// Re-export commonly used types
export type { LaunchOptions, OrchFlowConfig } from '../types';