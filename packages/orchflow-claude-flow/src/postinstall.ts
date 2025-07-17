#!/usr/bin/env node
import chalk from 'chalk';
import { isCI } from './utils';

async function postinstall() {
  // Skip postinstall in CI environments
  if (isCI()) {
    console.log(chalk.gray('Skipping OrchFlow postinstall in CI environment'));
    return;
  }

  console.log(chalk.cyan('\n🎆 OrchFlow setup complete!\n'));
  console.log(chalk.cyan('Getting started:'));
  console.log(chalk.white('  claude-flow orchflow    ') + chalk.gray('# Launch OrchFlow terminal'));
  console.log(chalk.white('  claude-flow --help      ') + chalk.gray('# Show all commands'));
  console.log();
}

// Only run if this is the main module
if (require.main === module) {
  postinstall().catch(() => {
    // Silently exit on error to not break npm install
    process.exit(0);
  });
}