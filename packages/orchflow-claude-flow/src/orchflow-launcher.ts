import chalk from 'chalk';
import { OrchFlowTerminalInjected } from './primary-terminal/orchflow-terminal-injected';
import { OrchFlowOrchestrator } from './orchestrator/orchflow-orchestrator';

interface OrchFlowProcess {
  terminal: OrchFlowTerminalInjected;
  orchestrator: OrchFlowOrchestrator;
}

/**
 * Launch OrchFlow with injection-based architecture
 */
export async function launchOrchFlow(args: string[], options: any = {}): Promise<void> {
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
    // Initialize orchestrator with injection architecture
    const orchestrator = new OrchFlowOrchestrator({
      mcpPort: options.port || 3001,
      stateConfig: { database: ':memory:' },
      workerConfig: { maxWorkers: 9 }
    });

    await orchestrator.initialize();

    // Initialize terminal with injection
    const terminal = new OrchFlowTerminalInjected(`http://localhost:${options.port || 3001}`);
    await terminal.initialize();

    console.log(chalk.green('🚀 OrchFlow initialized with injection architecture'));
    console.log(chalk.gray('   MCP Server running on port ' + (options.port || 3001)));
    console.log(chalk.gray('   Terminal injection ready'));

    // Launch the terminal
    await terminal.launch();

    // Handle process cleanup
    const cleanup = () => {
      orchestrator.destroy();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

  } catch (error) {
    console.error(chalk.red('Failed to launch OrchFlow:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

/**
 * Launch OrchFlow in development mode
 */
export async function launchOrchFlowDev(args: string[], options: any = {}): Promise<void> {
  console.log(chalk.cyan('🔧 OrchFlow Development Mode'));

  // In dev mode, we can run TypeScript directly or use different configs
  // This is useful for development and testing

  // For now, just launch the regular version
  await launchOrchFlow(args, options);
}