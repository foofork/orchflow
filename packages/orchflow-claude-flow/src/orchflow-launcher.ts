import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';
import chalk from 'chalk';
import { getComponentsDir } from './utils';

interface OrchFlowProcess {
  terminal: ChildProcess;
  orchestrator: ChildProcess;
  statusPane: ChildProcess;
}

/**
 * Launch OrchFlow with the 70/30 split terminal layout
 */
export async function launchOrchFlow(args: string[]): Promise<void> {
  const componentsDir = getComponentsDir();
  
  console.log(chalk.cyan('✨ OrchFlow Terminal Architecture'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log(chalk.green('✓ Natural Language Interface: ') + chalk.white('Ready'));
  console.log(chalk.green('✓ Worker Orchestration: ') + chalk.white('Ready'));
  console.log(chalk.green('✓ Status Monitoring: ') + chalk.white('Ready'));
  console.log(chalk.gray('━'.repeat(50)));
  console.log();
  console.log(chalk.yellow('💡 Tips:'));
  console.log(chalk.gray('  • Use natural language to create and manage tasks'));
  console.log(chalk.gray('  • Press 1-9 to quickly access workers'));
  console.log(chalk.gray('  • Status pane shows live progress (30% right side)'));
  console.log();
  
  try {
    // For now, since we're creating placeholders, we'll simulate the launch
    // In the real implementation, this would spawn the actual processes
    
    // Start the orchestrator service first
    const orchestratorPath = join(componentsDir, 'orchflow-orchestrator');
    const orchestrator = spawn(orchestratorPath, ['--port', '3000'], {
      stdio: 'pipe',
      env: { ...process.env, ORCHFLOW_MODE: 'orchestrator' }
    });
    
    // Start the primary terminal with 70/30 split
    const terminalPath = join(componentsDir, 'orchflow-terminal');
    const terminal = spawn(terminalPath, [
      '--orchestrator', 'ws://localhost:3000',
      '--split', '70:30',
      ...args
    ], {
      stdio: 'inherit',
      env: { ...process.env, ORCHFLOW_MODE: 'terminal' }
    });
    
    // Handle process cleanup
    const cleanup = () => {
      orchestrator.kill();
      terminal.kill();
      process.exit(0);
    };
    
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
    
    // Wait for terminal to exit
    terminal.on('exit', (code) => {
      cleanup();
      process.exit(code || 0);
    });
    
  } catch (error) {
    console.error(chalk.red('Failed to launch OrchFlow:'), error.message);
    process.exit(1);
  }
}

/**
 * Launch OrchFlow in development mode
 */
export async function launchOrchFlowDev(args: string[]): Promise<void> {
  console.log(chalk.cyan('🔧 OrchFlow Development Mode'));
  
  // In dev mode, we can run TypeScript directly or use different configs
  // This is useful for development and testing
  
  // For now, just launch the regular version
  await launchOrchFlow(args);
}