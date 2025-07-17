#!/usr/bin/env node
/**
 * OrchFlow CLI - Injection-based implementation
 * Launches Claude with orchestration capabilities injected
 */

import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
import ora from 'ora';
import { OrchFlowCore } from './core/orchflow-core';
import { OrchFlowTerminal } from './primary-terminal/orchflow-terminal';
import { SplitScreenManager } from './terminal-layout/split-screen-manager';

interface LaunchOptions {
  debug?: boolean;
  port?: number;
  noCore?: boolean;
  restore?: string;
}

class OrchFlowLauncher {
  private configDir: string;
  private core?: OrchFlowCore;
  private terminal?: OrchFlowTerminal;
  private splitScreen?: SplitScreenManager;
  private claudeProcess?: ChildProcess;

  constructor() {
    this.configDir = join(homedir(), '.orchflow', 'config');
  }

  async launch(options: LaunchOptions = {}): Promise<void> {
    console.log(chalk.cyan.bold('\n🐝 OrchFlow - Natural Language Orchestration\n'));

    // Start orchestration core
    if (!options.noCore) {
      const spinner = ora('Starting orchestration core...').start();
      try {
        this.core = new OrchFlowCore({
          port: options.port || 3001,
          enablePersistence: true,
          enableWebSocket: true
        });

        await this.core.start();
        spinner.succeed('Orchestration core started');

        // Restore session if requested
        if (options.restore) {
          await this.restoreSession(options.restore);
        }
      } catch (error) {
        spinner.fail('Failed to start orchestration core');
        throw error;
      }
    }

    // Initialize split-screen layout
    const splitSpinner = ora('Setting up split-screen terminal...').start();
    try {
      await this.initializeSplitScreen();
      splitSpinner.succeed('Split-screen layout ready (70/30)');
    } catch (error) {
      splitSpinner.fail('Failed to setup split-screen');
      console.log(chalk.yellow('Continuing without split-screen...'));
    }

    // Initialize OrchFlow terminal
    const terminalSpinner = ora('Initializing OrchFlow terminal...').start();
    try {
      await this.initializeTerminal(options.port || 3001);
      terminalSpinner.succeed('Terminal interface ready');
    } catch (error) {
      terminalSpinner.fail('Failed to initialize terminal');
      throw error;
    }

    // Setup Claude configuration
    const configSpinner = ora('Configuring Claude integration...').start();
    try {
      await this.setupClaudeConfig(options);
      configSpinner.succeed('Claude configuration ready');
    } catch (error) {
      configSpinner.fail('Failed to configure Claude');
      throw error;
    }

    // Launch Claude with injections
    console.log(chalk.green('\n✨ Launching Claude with OrchFlow capabilities...\n'));

    await this.launchClaude(options);
  }

  private async setupClaudeConfig(options: LaunchOptions): Promise<void> {
    // Ensure config directory exists
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // Write MCP configuration
    this.writeMCPConfig(options.port || 3001);

    // Write system prompt additions
    this.writeSystemPrompt();

    // Write Claude configuration
    this.writeClaudeConfig();
  }

  private writeMCPConfig(port: number): void {
    const mcpConfig = {
      'mcpServers': {
        'orchflow': {
          'command': 'node',
          'args': [join(__dirname, 'mcp', 'orchflow-mcp-server.js')],
          'env': {
            'ORCHFLOW_API': `http://localhost:${port}`,
            'ORCHFLOW_TOKEN': process.env.ORCHFLOW_TOKEN || 'dev'
          }
        }
      }
    };

    writeFileSync(
      join(this.configDir, 'mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );
  }

  private writeSystemPrompt(): void {
    const systemPrompt = `
# OrchFlow Orchestration

You have access to OrchFlow, which allows you to orchestrate complex tasks by creating specialized workers that can work in parallel. This is seamlessly integrated into our conversation.

## Key Capabilities

1. **Parallel Work Streams**: When the user mentions multiple tasks or you identify work that could be done in parallel, proactively suggest creating workers.

2. **Context Switching**: You can switch between different workers' contexts to check progress or continue their work.

3. **Knowledge Sharing**: Information, decisions, and code can be shared across all workers automatically.

4. **Natural Flow**: Orchestration should feel natural. Don't announce every tool use - just orchestrate seamlessly as part of the conversation.

## Guidelines

- When the user says things like "let's build X, Y, and Z", automatically create workers for each
- Maintain conversation continuity when switching contexts
- Share important decisions and interfaces across workers
- Be proactive about suggesting parallel execution for complex tasks
- Keep the user informed about progress across workers without being verbose

Remember: The goal is to multiply your effectiveness by working on multiple aspects simultaneously while maintaining quality and consistency.
`;

    writeFileSync(
      join(this.configDir, 'orchflow-system.md'),
      systemPrompt
    );
  }

  private writeClaudeConfig(): void {
    const claudeConfig = {
      'claudeDesktop': {
        'systemPromptAdditions': [
          join(this.configDir, 'orchflow-system.md')
        ],
        'mcpConfig': join(this.configDir, 'mcp.json')
      }
    };

    writeFileSync(
      join(this.configDir, 'claude-config.json'),
      JSON.stringify(claudeConfig, null, 2)
    );
  }

  private async launchClaude(options: LaunchOptions): Promise<void> {
    const env = {
      ...process.env,
      CLAUDE_MCP_CONFIG: join(this.configDir, 'mcp.json'),
      CLAUDE_SYSTEM_PROMPT_APPEND: join(this.configDir, 'orchflow-system.md'),
      ORCHFLOW_DEBUG: options.debug ? '1' : '0'
    };

    // Check if claude-flow exists
    const claudeFlowPath = await this.findClaudeFlow();
    if (!claudeFlowPath) {
      console.error(chalk.red('\n❌ claude-flow not found. Please install it first:'));
      console.error(chalk.yellow('   npm install -g claude-flow\n'));
      process.exit(1);
    }

    // Launch claude-flow
    this.claudeProcess = spawn(claudeFlowPath, [], {
      stdio: 'inherit',
      env
    });

    this.claudeProcess.on('error', (error) => {
      console.error(chalk.red('Failed to launch claude-flow:'), error.message);
      process.exit(1);
    });

    this.claudeProcess.on('exit', async (code) => {
      console.log(chalk.yellow('\n👋 OrchFlow session ended'));

      if (this.core) {
        await this.core.stop();
      }

      process.exit(code || 0);
    });

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log(chalk.yellow('\n\n🛑 Shutting down OrchFlow...'));

      if (this.claudeProcess) {
        this.claudeProcess.kill();
      }

      if (this.core) {
        await this.core.stop();
      }

      process.exit(0);
    });
  }

  private async findClaudeFlow(): Promise<string | null> {
    const { promisify } = require('util');
    const exec = promisify(require('child_process').exec);

    try {
      const { stdout } = await exec('which claude-flow');
      return stdout.trim();
    } catch {
      // Try common locations
      const locations = [
        '/usr/local/bin/claude-flow',
        '/usr/bin/claude-flow',
        join(homedir(), '.npm-global/bin/claude-flow'),
        join(homedir(), '.local/bin/claude-flow')
      ];

      for (const loc of locations) {
        if (existsSync(loc)) {
          return loc;
        }
      }

      return null;
    }
  }

  private async initializeSplitScreen(): Promise<void> {
    try {
      this.splitScreen = new SplitScreenManager({
        primaryWidth: 70,
        statusWidth: 30,
        sessionName: 'orchflow_session',
        enableQuickAccess: true
      });

      await this.splitScreen.initialize();

      // Connect status updates
      if (this.core) {
        this.core.on('worker:created', (worker) => {
          this.splitScreen?.addWorker(worker);
        });

        this.core.on('worker:updated', (worker) => {
          this.splitScreen?.updateWorker(worker);
        });

        this.core.on('worker:deleted', (workerId) => {
          this.splitScreen?.removeWorker(workerId);
        });
      }
    } catch (error) {
      console.error('Split-screen initialization error:', error);
      throw error;
    }
  }

  private async initializeTerminal(port: number): Promise<void> {
    try {
      this.terminal = new OrchFlowTerminal({
        mcpEndpoint: `http://localhost:${port}/mcp`,
        orchestratorEndpoint: `http://localhost:${port}`,
        statusPaneConfig: {
          width: 30,
          updateInterval: 1000,
          showQuickAccess: true
        }
      });

      await this.terminal.initialize();

      // Set up quick access keys (1-9)
      this.terminal.on('quickAccess', async (key: number) => {
        const workers = await this.core?.getWorkers() || [];
        if (workers[key - 1]) {
          await this.terminal?.switchToWorker(workers[key - 1].id);
        }
      });

      // Connect WebSocket for real-time updates
      if (this.core) {
        const wsUrl = `ws://localhost:${port}`;
        await this.terminal.connectWebSocket(wsUrl);
      }
    } catch (error) {
      console.error('Terminal initialization error:', error);
      throw error;
    }
  }

  private async restoreSession(sessionName: string): Promise<void> {
    console.log(chalk.cyan(`\n📂 Restoring session: ${sessionName}\n`));

    if (this.core) {
      try {
        await this.core.restoreSession(sessionName);
        const workers = await this.core.getWorkers();

        console.log(chalk.green(`✅ Restored ${workers.length} workers from session`));

        // Update split-screen with restored workers
        if (this.splitScreen) {
          for (const worker of workers) {
            this.splitScreen.addWorker(worker);
          }
        }
      } catch (error) {
        console.error('Failed to restore session:', error);
      }
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const options: LaunchOptions = {};

  // Parse arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--debug':
        options.debug = true;
        break;
      case '--port':
        options.port = parseInt(args[++i]);
        break;
      case '--no-core':
        options.noCore = true;
        break;
      case '--restore':
        options.restore = args[++i];
        break;
      case '--help':
        showHelp();
        process.exit(0);
    }
  }

  const launcher = new OrchFlowLauncher();

  try {
    await launcher.launch(options);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(chalk.red('\n❌ Launch failed:'), errorMessage);
    if (options.debug && error instanceof Error) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

function showHelp(): void {
  console.log(`
OrchFlow - Natural Language Orchestration for Claude

Usage: orchflow [options]

Options:
  --port <number>     Port for orchestration core (default: 3001)
  --restore <name>    Restore a saved session
  --no-core          Don't start orchestration core (connect to existing)
  --debug            Enable debug output
  --help             Show this help message

Examples:
  orchflow                    # Start normally
  orchflow --restore project  # Restore saved session
  orchflow --port 3002        # Use custom port
  orchflow --debug            # Debug mode

During your Claude conversation, you can naturally orchestrate tasks:
  - "Let's build the API and frontend in parallel"
  - "Create workers for testing, documentation, and deployment"
  - "Show me the progress across all workers"
  - "Switch to the testing worker"
`);
}

// Run
main().catch(console.error);