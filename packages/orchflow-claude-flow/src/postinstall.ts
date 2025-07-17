#!/usr/bin/env node
import chalk from 'chalk';
import { ensureOrchFlowBinaries } from './binary-manager';
import { isCI } from './utils';

async function postinstall() {
  // Skip postinstall in CI environments
  if (isCI()) {
    console.log(chalk.gray('Skipping OrchFlow postinstall in CI environment'));
    return;
  }
  
  console.log(chalk.cyan('\n🎆 Setting up OrchFlow components...\n'));
  
  try {
    await ensureOrchFlowBinaries();
    
    console.log(chalk.green('\n✅ OrchFlow setup complete!\n'));
    console.log(chalk.cyan('Getting started:'));
    console.log(chalk.white('  claude-flow orchflow    ') + chalk.gray('# Launch OrchFlow terminal'));
    console.log(chalk.white('  claude-flow --help      ') + chalk.gray('# Show all commands'));
    console.log();
  } catch (error) {
    console.error(chalk.red('\n❌ Failed to set up OrchFlow components'));
    console.error(chalk.gray(error.message));
    console.error(chalk.yellow('\nYou can try running setup manually:'));
    console.error(chalk.white('  npx @orchflow/claude-flow setup'));
    // Don't fail the install
    process.exit(0);
  }
}

// Only run if this is the main module
if (require.main === module) {
  postinstall().catch(() => {
    // Silently exit on error to not break npm install
    process.exit(0);
  });
}