#!/usr/bin/env node
import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { getRealClaudeFlowPath } from './utils';
import { ensureOrchFlowBinaries } from './binary-manager';
import { launchOrchFlow } from './orchflow-launcher';

async function main() {
  const args = process.argv.slice(2);
  
  // Check if this is an orchflow command
  if (args[0] === 'orchflow') {
    console.log(chalk.cyan('🚀 Initializing OrchFlow Terminal Architecture...'));
    
    const spinner = ora('Checking OrchFlow components...').start();
    
    try {
      // Ensure OrchFlow binaries are installed
      await ensureOrchFlowBinaries();
      spinner.succeed('OrchFlow components ready');
      
      // Launch OrchFlow terminal with 70/30 split layout
      await launchOrchFlow(args.slice(1));
    } catch (error) {
      spinner.fail('Failed to initialize OrchFlow');
      console.error(chalk.red('Error:'), error.message);
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
      console.error(chalk.red('Error running claude-flow:'), error.message);
      process.exit(1);
    });
    
    claudeFlow.on('exit', (code) => {
      process.exit(code || 0);
    });
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error: Error) => {
  console.error(chalk.red('Unhandled error:'), error.message);
  process.exit(1);
});

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error.message);
  process.exit(1);
});