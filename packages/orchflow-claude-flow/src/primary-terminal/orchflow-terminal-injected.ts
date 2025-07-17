/**
 * OrchFlow Terminal with Claude Code Injection
 * This is how it SHOULD work - injecting orchestration into the conversation
 */

import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { OrchFlowInjection } from '../orchflow-injection';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export class OrchFlowTerminalInjected extends EventEmitter {
  private claudeProcess?: ChildProcess;
  private orchestratorUrl: string;
  private configDir: string;

  constructor(orchestratorUrl = 'http://localhost:3001') {
    super();
    this.orchestratorUrl = orchestratorUrl;
    this.configDir = join(homedir(), '.orchflow', 'claude-injection');
  }

  async initialize(): Promise<void> {
    // Create config directory
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // Write MCP tool configuration
    await this.writeMCPConfig();

    // Write system prompt injection
    await this.writeSystemPrompt();
  }

  /**
   * Launch Claude Code with OrchFlow injected
   */
  async launch(): Promise<void> {
    // Set environment to use our MCP config
    const env = {
      ...process.env,
      CLAUDE_MCP_CONFIG: join(this.configDir, 'mcp-config.json'),
      CLAUDE_SYSTEM_PROMPT_APPEND: join(this.configDir, 'orchflow-prompt.md')
    };

    // Launch claude-flow with our injections
    this.claudeProcess = spawn('claude-flow', [], {
      stdio: 'inherit',
      env
    });

    this.claudeProcess.on('error', (error) => {
      console.error('Failed to launch Claude Code:', error);
      this.emit('error', error);
    });

    this.claudeProcess.on('exit', (code) => {
      this.emit('exit', code);
    });

    // The user now has a normal Claude Code conversation
    // but Claude understands orchestration commands naturally!
  }

  /**
   * Write MCP configuration with OrchFlow tools
   */
  private async writeMCPConfig(): Promise<void> {
    const tools = OrchFlowInjection.getMCPTools();

    // Convert our tool format to MCP format
    const mcpTools = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
      // MCP will handle the HTTP calls to our orchestrator
      endpoint: `${this.orchestratorUrl}/mcp/${tool.name}`
    }));

    const config = {
      tools: mcpTools,
      server: {
        url: this.orchestratorUrl,
        headers: {
          'Authorization': `Bearer ${process.env.ORCHFLOW_TOKEN || 'dev'}`
        }
      }
    };

    writeFileSync(
      join(this.configDir, 'mcp-config.json'),
      JSON.stringify(config, null, 2)
    );
  }

  /**
   * Write system prompt additions
   */
  private async writeSystemPrompt(): Promise<void> {
    const prompt = OrchFlowInjection.getSystemPromptInjection();

    writeFileSync(
      join(this.configDir, 'orchflow-prompt.md'),
      prompt
    );
  }

  /**
   * Stop the terminal
   */
  async stop(): Promise<void> {
    if (this.claudeProcess) {
      this.claudeProcess.kill();
    }
  }
}

/**
 * Example usage showing the natural conversation flow:
 *
 * const terminal = new OrchFlowTerminalInjected();
 * await terminal.initialize();
 * await terminal.launch();
 *
 * // Now the user is in a Claude Code conversation where:
 *
 * User: "I need to build a real-time chat app. Let's work on the server,
 *        client, and database schema simultaneously"
 *
 * Claude: I'll help you build a real-time chat application. This is a perfect case
 *         for parallel development. Let me set up three work streams:
 *
 *         [Claude automatically uses orchflow_spawn_worker internally]
 *
 *         ✓ Server Developer - Building WebSocket server with Node.js
 *         ✓ Client Developer - Creating React chat interface
 *         ✓ Database Architect - Designing schema for messages and users
 *
 *         Starting with the server, we'll use Socket.io for real-time communication.
 *         Here's the basic structure:
 *
 *         ```javascript
 *         const express = require('express');
 *         const { Server } = require('socket.io');
 *         ...
 *         ```
 *
 * User: "Actually, let's check how the database design is going"
 *
 * Claude: [Seamlessly switches context using orchflow_switch_context]
 *
 *         The database schema is taking shape nicely. For a real-time chat app,
 *         we need to optimize for quick message retrieval and user presence.
 *         Here's the schema I've designed:
 *
 *         ```sql
 *         -- Users table
 *         CREATE TABLE users (
 *           id UUID PRIMARY KEY,
 *           username VARCHAR(50) UNIQUE NOT NULL,
 *           ...
 *         ```
 *
 *         [Claude maintains context awareness across all workers]
 *
 * User: "Make sure all three components use the same message format"
 *
 * Claude: Good point! Let me ensure consistency across all workers.
 *
 *         [Uses orchflow_share_knowledge to sync the message interface]
 *
 *         I've synchronized the message format across all three workers:
 *
 *         ```typescript
 *         interface ChatMessage {
 *           id: string;
 *           userId: string;
 *           content: string;
 *           timestamp: Date;
 *           edited?: boolean;
 *           reactions?: Reaction[];
 *         }
 *         ```
 *
 *         All three components now use this same interface...
 */