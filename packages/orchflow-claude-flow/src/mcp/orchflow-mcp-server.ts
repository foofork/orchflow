/**
 * OrchFlow MCP Server
 * Provides Model Context Protocol integration for Claude
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  Tool,
  TextContent
} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import fetch from 'node-fetch';

const ORCHFLOW_API = process.env.ORCHFLOW_API || 'http://localhost:3001';

/**
 * MCP Server that provides OrchFlow tools to Claude
 */
export class OrchFlowMCPServer {
  private server: Server;
  private transport: StdioServerTransport;

  constructor() {
    this.server = new Server({
      name: 'orchflow-mcp',
      version: '1.0.0',
    }, {
      capabilities: {
        tools: {}
      }
    });

    this.transport = new StdioServerTransport();
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const result = await this.callTool(name, args);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          } as TextContent]
        };
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`
          } as TextContent],
          isError: true
        };
      }
    });
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'orchflow_spawn_worker',
        description: 'Create a new worker for parallel task execution. Use this when the user mentions working on multiple things or when you identify a task that could benefit from dedicated focus.',
        inputSchema: {
          type: 'object',
          properties: {
            task: {
              type: 'string',
              description: 'Clear description of what this worker will do'
            },
            type: {
              type: 'string',
              enum: ['developer', 'tester', 'researcher', 'analyst', 'architect', 'reviewer'],
              description: 'Type of worker based on the task nature'
            },
            parentContext: {
              type: 'object',
              description: 'Any context to share with this worker',
              properties: {}
            }
          },
          required: ['task']
        }
      },
      {
        name: 'orchflow_worker_status',
        description: 'Get the status of all workers or a specific worker. Use this when the user asks about progress or wants to see what\'s being worked on.',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'Optional: specific worker ID to check'
            }
          }
        }
      },
      {
        name: 'orchflow_switch_context',
        description: 'Switch the conversation context to a specific worker. Use this when the user wants to focus on or check in on a specific piece of work.',
        inputSchema: {
          type: 'object',
          properties: {
            workerId: {
              type: 'string',
              description: 'ID of the worker to switch to'
            },
            preserveHistory: {
              type: 'boolean',
              description: 'Whether to keep current conversation in history',
              default: true
            }
          },
          required: ['workerId']
        }
      },
      {
        name: 'orchflow_share_knowledge',
        description: 'Share information, decisions, or code between workers. Use this to ensure consistency across parallel work streams.',
        inputSchema: {
          type: 'object',
          properties: {
            knowledge: {
              type: 'object',
              description: 'Information to share (interfaces, decisions, patterns, etc.)',
              properties: {}
            },
            targetWorkers: {
              type: 'array',
              items: { type: 'string' },
              description: 'Worker IDs to share with (empty = all workers)'
            }
          },
          required: ['knowledge']
        }
      },
      {
        name: 'orchflow_merge_work',
        description: 'Merge results from multiple workers. Use this when the user wants to combine or integrate work from different streams.',
        inputSchema: {
          type: 'object',
          properties: {
            workerIds: {
              type: 'array',
              items: { type: 'string' },
              description: 'Workers whose work should be merged'
            },
            strategy: {
              type: 'string',
              enum: ['combine', 'sequential', 'overlay'],
              description: 'How to merge the work'
            }
          },
          required: ['workerIds']
        }
      },
      {
        name: 'orchflow_save_session',
        description: 'Save the current orchestration session state. Use when the user wants to preserve their work setup.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name for this saved session'
            },
            description: {
              type: 'string',
              description: 'Optional description of the session'
            }
          },
          required: ['name']
        }
      },
      {
        name: 'orchflow_restore_session',
        description: 'Restore a previously saved orchestration session. Use when the user wants to continue previous work.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the session to restore'
            }
          },
          required: ['name']
        }
      }
    ];
  }

  private async callTool(name: string, args: any): Promise<any> {
    const endpoint = `${ORCHFLOW_API}/mcp/${name}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ORCHFLOW_TOKEN || 'dev'}`
      },
      body: JSON.stringify(args)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`API error: ${error}`);
    }

    return response.json();
  }

  async start(): Promise<void> {
    await this.server.connect(this.transport);
    console.error('OrchFlow MCP Server started');
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new OrchFlowMCPServer();
  server.start().catch(console.error);
}