#!/usr/bin/env node
import { spawn } from 'child_process';
// import { existsSync } from 'fs'; // Unused in current implementation
// import { join } from 'path'; // Unused in current implementation
import chalk from 'chalk';
import ora from 'ora';
import { getRealClaudeFlowPath } from './utils';
import { launchOrchFlow } from './orchflow-launcher';
import { UnifiedSetupOrchestrator } from './setup/unified-setup-orchestrator';

interface ParsedArgs {
  options: {
    debug?: boolean;
    port?: number;
    host?: string;
    config?: string;
    flow?: string;
    interactive?: boolean;
    skipSetup?: boolean;
    mode?: 'tmux' | 'inline' | 'split';
    autoInstallTmux?: boolean;
  };
  commands: string[];
}

function parseOrchFlowArgs(args: string[]): ParsedArgs {
  const options: ParsedArgs['options'] = {};
  const commands: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--debug':
        options.debug = true;
        break;
      case '--port':
        options.port = parseInt(args[++i]);
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--config':
        options.config = args[++i];
        break;
      case '--flow':
        options.flow = args[++i];
        break;
      case '--interactive':
        options.interactive = true;
        break;
      case '--skip-setup':
        options.skipSetup = true;
        break;
      case '--mode':
        const mode = args[++i];
        if (mode === 'tmux' || mode === 'inline' || mode === 'split') {
          options.mode = mode;
        }
        break;
      case '--no-auto-install-tmux':
        options.autoInstallTmux = false;
        break;
      default:
        if (!arg.startsWith('--')) {
          commands.push(arg);
        }
        break;
    }
  }

  return { options, commands };
}

async function main() {
  const args = process.argv.slice(2);

  // Check if this is an orchflow command
  if (args[0] === 'orchflow') {
    console.log(chalk.cyan('🚀 Initializing OrchFlow Terminal Architecture...'));

    // Parse enhanced arguments
    const { options, commands } = parseOrchFlowArgs(args.slice(1));

    // Handle setup validation command
    if (commands.includes('validate')) {
      const setupOrchestrator = UnifiedSetupOrchestrator.getInstance();
      const validation = await setupOrchestrator.validateSetup();

      if (validation.valid) {
        console.log(chalk.green('✅ Setup validation passed'));
      } else {
        console.log(chalk.red('❌ Setup validation failed'));
        validation.issues.forEach(issue => console.log(chalk.red(`  • ${issue}`)));
      }

      if (validation.recommendations.length > 0) {
        console.log(chalk.yellow('\n💡 Recommendations:'));
        validation.recommendations.forEach(rec => console.log(chalk.yellow(`  • ${rec}`)));
      }

      process.exit(validation.valid ? 0 : 1);
    }

    // Handle setup status command
    if (commands.includes('status')) {
      const setupOrchestrator = UnifiedSetupOrchestrator.getInstance();
      const status = await setupOrchestrator.getSetupStatus();

      console.log(chalk.cyan('📊 OrchFlow Status'));
      console.log(`Setup: ${status.isSetup ? chalk.green('✅ Complete') : chalk.red('❌ Not configured')}`);
      console.log(`Flow: ${status.flow || chalk.gray('None')}`);
      console.log(`Terminal: ${status.environment.terminal}`);
      console.log(`Multiplexer: ${status.environment.multiplexer}`);

      process.exit(0);
    }

    const spinner = ora('Initializing OrchFlow...').start();

    try {
      spinner.succeed('OrchFlow initialized');

      // Launch OrchFlow terminal with optimized setup
      await launchOrchFlow(args.slice(1), options);
    } catch (error) {
      spinner.fail('Failed to initialize OrchFlow');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  } else {
    // Pass through to real claude-flow for all other commands
    const claudeFlowPath = await getRealClaudeFlowPath();

    if (!claudeFlowPath) {
      console.error(chalk.red('Error: claude-flow not found. Please install it separately.'));
      console.error(chalk.yellow('Visit: https://github.com/anthropics/claude-flow'));
      process.exit(1);
    }

    // Spawn real claude-flow with all arguments
    const claudeFlow = spawn(claudeFlowPath, args, {
      stdio: 'inherit',
      env: process.env
    });

    claudeFlow.on('error', (error) => {
      console.error(chalk.red('Error running claude-flow:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    });

    claudeFlow.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error: unknown) => {
  console.error(chalk.red('Unhandled error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error instanceof Error ? error.message : String(error));
  process.exit(1);
});