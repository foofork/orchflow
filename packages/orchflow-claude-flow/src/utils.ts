// import { promisify } from 'util';
// import { exec } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import which from 'which';

// const execAsync = promisify(exec); // Unused in current implementation

/**
 * Find the real claude-flow executable path
 * This looks for the actual claude-flow installation, not our wrapper
 */
export async function getRealClaudeFlowPath(): Promise<string | null> {
  try {
    // First, check if CLAUDE_FLOW_PATH env var is set
    if (process.env.CLAUDE_FLOW_PATH && existsSync(process.env.CLAUDE_FLOW_PATH)) {
      return process.env.CLAUDE_FLOW_PATH;
    }

    // Try to find claude-flow in PATH, excluding our own installation
    try {
      const claudeFlowPath = await which('claude-flow');
      // Skip if it's in our node_modules or our package directory
      if (!claudeFlowPath.includes('@orchflow/claude-flow') &&
          !claudeFlowPath.includes('orchflow-claude-flow')) {
        return claudeFlowPath;
      }
    } catch (error) {
      // Not found in PATH, continue to check common locations
    }

    // Check common installation locations
    const commonPaths = [
      '/usr/local/bin/claude-flow',
      '/usr/bin/claude-flow',
      join(process.env.HOME || '', '.local', 'bin', 'claude-flow'),
      join(process.env.HOME || '', '.cargo', 'bin', 'claude-flow')
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}


/**
 * Get OrchFlow home directory
 */
export function getOrchFlowHome(): string {
  return process.env.ORCHFLOW_HOME || join(process.env.HOME || '', '.orchflow');
}


/**
 * Check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true' ||
         process.env.CONTINUOUS_INTEGRATION === 'true' ||
         process.env.GITHUB_ACTIONS === 'true';
}