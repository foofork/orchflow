/**
 * OrchFlow Claude-Flow Wrapper
 * 
 * This module provides programmatic access to OrchFlow functionality
 */

export { launchOrchFlow, launchOrchFlowDev } from './orchflow-launcher';
export { ensureOrchFlowBinaries, checkForUpdates } from './binary-manager';
export { getRealClaudeFlowPath, getOrchFlowHome, getComponentsDir } from './utils';

/**
 * OrchFlow configuration interface
 */
export interface OrchFlowConfig {
  orchestratorPort?: number;
  statusPaneWidth?: number;
  enableQuickAccess?: boolean;
  maxWorkers?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Initialize OrchFlow with custom configuration
 */
export async function initializeOrchFlow(config?: OrchFlowConfig): Promise<void> {
  // Ensure binaries are available
  await ensureOrchFlowBinaries();
  
  // Set configuration in environment
  if (config) {
    if (config.orchestratorPort) {
      process.env.ORCHFLOW_PORT = config.orchestratorPort.toString();
    }
    if (config.statusPaneWidth) {
      process.env.ORCHFLOW_STATUS_WIDTH = config.statusPaneWidth.toString();
    }
    if (config.enableQuickAccess !== undefined) {
      process.env.ORCHFLOW_QUICK_ACCESS = config.enableQuickAccess.toString();
    }
    if (config.maxWorkers) {
      process.env.ORCHFLOW_MAX_WORKERS = config.maxWorkers.toString();
    }
    if (config.logLevel) {
      process.env.ORCHFLOW_LOG_LEVEL = config.logLevel;
    }
  }
}

/**
 * OrchFlow version
 */
export const VERSION = '0.1.0';