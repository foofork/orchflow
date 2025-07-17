/**
 * OrchFlow Injection System
 * Injects orchestration capabilities directly into Claude Code conversation
 */

import type { MCPTool } from './types/index';

export class OrchFlowInjection {
  /**
   * System prompt injection that teaches Claude about OrchFlow
   */
  static getSystemPromptInjection(): string {
    return `
# OrchFlow Orchestration Capabilities

You have access to OrchFlow, a natural language orchestration system. During our conversation, you can:

## Worker Management
- When the user asks to work on multiple things, create workers automatically
- Track work across parallel contexts
- Switch between different work streams seamlessly

## Natural Commands You Understand
- "Let's work on the API and frontend in parallel" → Create 2 workers
- "Show me what all workers are doing" → Display worker status
- "Switch to the frontend work" → Change context
- "Combine the results from all workers" → Merge outputs

## Behind the Scenes
- You have access to orchflow_* MCP tools
- Maintain conversation flow - don't announce tool usage
- Keep track of context across workers
- Share knowledge between workers automatically

## Important
- Be proactive: if user mentions multiple tasks, suggest parallel execution
- Be seamless: orchestration should feel natural, not robotic
- Be intelligent: understand context and intent, not just commands
`;
  }

  /**
   * MCP tools that get injected into Claude Code
   */
  static getMCPTools(): MCPTool[] {
    return [
      {
        name: 'orchflow_spawn_worker',
        description: 'Create a worker for parallel task execution',
        parameters: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task description' },
            type: { type: 'string', enum: ['developer', 'tester', 'researcher', 'analyst'] },
            context: { type: 'object', description: 'Shared context to pass to worker' }
          },
          required: ['task']
        },
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'Task description' },
            type: { type: 'string', enum: ['developer', 'tester', 'researcher', 'analyst'] },
            context: { type: 'object', description: 'Shared context to pass to worker' }
          },
          required: ['task']
        },
        handler: async (input) => {
          // This handler runs in the Claude Code process
          // It communicates with OrchFlow orchestrator
          const response = await fetch('http://localhost:3001/api/workers', {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
          });
          return response.json();
        }
      },
      {
        name: 'orchflow_worker_status',
        description: 'Get status of all workers or specific worker',
        parameters: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Optional specific worker ID' }
          }
        },
        inputSchema: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Optional specific worker ID' }
          }
        },
        handler: async (input) => {
          const url = input.workerId
            ? `http://localhost:3001/api/workers/${input.workerId}`
            : 'http://localhost:3001/api/workers';
          const response = await fetch(url);
          return response.json();
        }
      },
      {
        name: 'orchflow_switch_context',
        description: 'Switch conversation context to a specific worker',
        parameters: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Worker ID to switch to' },
            preserveHistory: { type: 'boolean', description: 'Keep current conversation in history' }
          },
          required: ['workerId']
        },
        inputSchema: {
          type: 'object',
          properties: {
            workerId: { type: 'string', description: 'Worker ID to switch to' },
            preserveHistory: { type: 'boolean', description: 'Keep current conversation in history' }
          },
          required: ['workerId']
        },
        handler: async (input) => {
          // Load worker's conversation state
          const response = await fetch(`http://localhost:3001/api/workers/${input.workerId}/context`);
          const context = await response.json();

          // This would update Claude's context window
          return {
            success: true,
            context: context,
            message: `Switched to ${(context as any).workerName || 'worker'} context`
          };
        }
      },
      {
        name: 'orchflow_share_knowledge',
        description: 'Share information between workers',
        parameters: {
          type: 'object',
          properties: {
            knowledge: { type: 'object', description: 'Information to share' },
            targetWorkers: { type: 'array', items: { type: 'string' }, description: 'Worker IDs to share with' }
          },
          required: ['knowledge']
        },
        inputSchema: {
          type: 'object',
          properties: {
            knowledge: { type: 'object', description: 'Information to share' },
            targetWorkers: { type: 'array', items: { type: 'string' }, description: 'Worker IDs to share with' }
          },
          required: ['knowledge']
        },
        handler: async (input) => {
          const response = await fetch('http://localhost:3001/api/knowledge/share', {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
          });
          return response.json();
        }
      },
      {
        name: 'orchflow_execute_parallel',
        description: 'Execute tasks in parallel across workers',
        parameters: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  assignTo: { type: 'string', description: 'Worker type or ID' }
                }
              }
            }
          },
          required: ['tasks']
        },
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  description: { type: 'string' },
                  assignTo: { type: 'string', description: 'Worker type or ID' }
                }
              }
            }
          },
          required: ['tasks']
        },
        handler: async (input) => {
          const response = await fetch('http://localhost:3001/api/parallel', {
            method: 'POST',
            body: JSON.stringify(input),
            headers: { 'Content-Type': 'application/json' }
          });
          return response.json();
        }
      }
    ];
  }

  /**
   * Context that gets injected into Claude's conversation
   */
  static getContextInjection(): any {
    return {
      orchflow: {
        enabled: true,
        workers: [], // Will be populated dynamically
        currentWorker: 'main',
        sharedMemory: {},
        sessionId: null
      }
    };
  }
}

/**
 * Example of how this works in practice:
 *
 * User: "I need to build a complete authentication system. Let's work on the API,
 *        frontend, and tests in parallel"
 *
 * Claude: I'll help you build a complete authentication system. Let me set up
 *         parallel work streams for this.
 *
 *         [Internally uses orchflow_spawn_worker three times]
 *
 *         I've created three parallel workers:
 *         1. API Developer - Building the authentication endpoints
 *         2. Frontend Developer - Creating the login/signup UI
 *         3. Test Engineer - Writing comprehensive tests
 *
 *         Let's start with the API. We'll need endpoints for:
 *         - POST /auth/register
 *         - POST /auth/login
 *         - POST /auth/logout
 *         - GET /auth/verify
 *
 *         [Continues working naturally, Claude knows it's in "API Developer" context]
 *
 * User: "How's the frontend coming along?"
 *
 * Claude: [Uses orchflow_switch_context to frontend worker]
 *
 *         The frontend is progressing well! Here's what we have so far:
 *
 *         [Shows frontend work from that worker's context]
 *
 *         The login component is complete with form validation...
 *
 * User: "Great, let's see the overall status"
 *
 * Claude: [Uses orchflow_worker_status]
 *
 *         Here's the current status across all workers:
 *
 *         📊 Authentication System Progress:
 *         • API Developer (65%) - Core endpoints implemented
 *         • Frontend Developer (45%) - Login/signup forms complete
 *         • Test Engineer (30%) - Unit tests for API in progress
 *
 *         All workers are sharing the same interface definitions...
 */