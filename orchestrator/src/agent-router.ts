// orchflow Agent Router
// Routes commands to appropriate agents based on intent

import { EventEmitter } from 'events';
import { AgentManager, Agent } from './agent-manager';
import { mcpRegistry } from './mcp/mcp-registry';
import { MCPTool } from './mcp/types';

export interface Intent {
  action: string;
  target?: string;
  parameters?: Record<string, any>;
  confidence: number;
  mcpTool?: {
    serverId: string;
    tool: MCPTool;
  };
}

export interface RoutingRule {
  pattern: RegExp;
  agentType: Agent['type'];
  extractor?: (match: RegExpMatchArray) => Record<string, any>;
}

export class AgentRouter extends EventEmitter {
  private agentManager: AgentManager;
  private routingRules: RoutingRule[] = [];
  private activeAgents: Map<string, string> = new Map(); // type -> agentId

  constructor(agentManager: AgentManager) {
    super();
    this.agentManager = agentManager;
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // Development server commands
    this.addRule({
      pattern: /^(start|run|launch)\s+(dev|development|server)/i,
      agentType: 'dev',
    });

    // Test commands
    this.addRule({
      pattern: /^(run|execute|start)\s+test(s)?/i,
      agentType: 'test',
    });

    // REPL commands
    this.addRule({
      pattern: /^(open|start|launch)\s+(node|python|ruby)\s*(repl|console)?/i,
      agentType: 'repl',
      extractor: (match) => ({ language: match[2].toLowerCase() }),
    });

    // Build commands
    this.addRule({
      pattern: /^(build|compile|bundle)/i,
      agentType: 'build',
    });

    // Linting commands
    this.addRule({
      pattern: /^(lint|check|analyze)\s+(code|files?)?/i,
      agentType: 'lint',
    });
  }

  addRule(rule: RoutingRule): void {
    this.routingRules.push(rule);
  }

  async parseIntent(input: string): Promise<Intent | null> {
    // Check MCP tools first
    const mcpTools = mcpRegistry.getAllTools();
    for (const { serverId, tool } of mcpTools) {
      // Simple keyword matching for tool names
      const toolKeywords = tool.name.toLowerCase().split(/[_-]/);
      const inputLower = input.toLowerCase();
      
      if (toolKeywords.some(keyword => inputLower.includes(keyword))) {
        return {
          action: 'mcp-tool',
          target: input,
          parameters: { toolName: tool.name },
          confidence: 0.7,
          mcpTool: { serverId, tool },
        };
      }
    }
    
    for (const rule of this.routingRules) {
      const match = input.match(rule.pattern);
      if (match) {
        const parameters = rule.extractor ? rule.extractor(match) : {};
        return {
          action: rule.agentType,
          target: match[0],
          parameters,
          confidence: 0.8, // Simple pattern matching has decent confidence
        };
      }
    }

    // Fallback to basic keyword detection
    const keywords = {
      dev: ['dev', 'develop', 'server', 'serve'],
      test: ['test', 'spec', 'jest', 'mocha', 'pytest'],
      repl: ['repl', 'console', 'interactive', 'shell'],
      build: ['build', 'compile', 'bundle', 'webpack'],
      lint: ['lint', 'eslint', 'prettier', 'format'],
    };

    for (const [type, words] of Object.entries(keywords)) {
      if (words.some(word => input.toLowerCase().includes(word))) {
        return {
          action: type,
          target: input,
          confidence: 0.5, // Lower confidence for keyword matching
        };
      }
    }

    return null;
  }

  async route(input: string): Promise<Agent | null> {
    const intent = await this.parseIntent(input);
    if (!intent) {
      this.emit('route:failed', { input, reason: 'No matching intent' });
      return null;
    }

    this.emit('intent:parsed', intent);

    // Handle MCP tool execution
    if (intent.action === 'mcp-tool' && intent.mcpTool) {
      const agent = await this.agentManager.createAgent({
        name: `mcp-${intent.mcpTool.tool.name}`,
        type: 'custom',
        command: `MCP Tool: ${intent.mcpTool.tool.name}`,
        config: {
          mcpTool: intent.mcpTool,
        },
      });
      
      if (agent) {
        this.emit('route:success', { input, agent, intent });
        
        // Execute the MCP tool through the agent
        const args = this.extractToolArgs(input, intent.mcpTool.tool);
        const result = await mcpRegistry.callTool(
          intent.mcpTool.tool.name,
          args,
          intent.mcpTool.serverId
        );
        
        // Send result to agent terminal
        await this.agentManager.sendCommand(
          agent.id,
          `Tool Result: ${JSON.stringify(result, null, 2)}`
        );
      }
      
      return agent;
    }

    // Check if we already have an agent of this type
    const existingAgentId = this.activeAgents.get(intent.action);
    if (existingAgentId) {
      const agent = await this.agentManager.getAgent(existingAgentId);
      if (agent && agent.status !== 'failed' && agent.status !== 'stopped') {
        this.emit('route:existing', { input, agent, intent });
        return agent;
      }
    }

    // Create a new agent based on the intent
    let agent: Agent | null = null;

    switch (intent.action) {
      case 'dev':
        agent = await this.agentManager.createDevAgent('dev-server');
        break;
      
      case 'test':
        agent = await this.agentManager.createTestAgent('test-runner');
        break;
      
      case 'repl':
        const language = intent.parameters?.language || 'node';
        agent = await this.agentManager.createReplAgent(`${language}-repl`, language);
        break;
      
      case 'build':
        agent = await this.agentManager.createAgent({
          name: 'builder',
          type: 'build',
          command: 'npm run build',
        });
        break;
      
      case 'lint':
        agent = await this.agentManager.createAgent({
          name: 'linter',
          type: 'lint',
          command: 'npm run lint',
        });
        break;
      
      default:
        agent = await this.agentManager.createAgent({
          name: `custom-${intent.action}`,
          type: 'custom',
          command: input,
        });
    }

    if (agent) {
      this.activeAgents.set(intent.action, agent.id);
      this.emit('route:success', { input, agent, intent });
    }

    return agent;
  }

  async routeToAgent(agentId: string, command: string): Promise<void> {
    await this.agentManager.sendCommand(agentId, command);
  }

  // Advanced routing with context
  async routeWithContext(input: string, context: Record<string, any>): Promise<Agent | null> {
    // Enhanced routing that considers context
    // For example, if context includes current file type, route to appropriate agent
    
    if (context.fileType === '.py' && input.includes('run')) {
      const agent = await this.agentManager.createAgent({
        name: 'python-runner',
        type: 'custom',
        command: `python ${context.filePath}`,
      });
      return agent;
    }

    // Fall back to regular routing
    return this.route(input);
  }

  // Get suggestions based on partial input
  getSuggestions(partial: string): string[] {
    const suggestions: string[] = [];
    
    const commands = [
      'start dev server',
      'run tests',
      'open node repl',
      'open python repl',
      'build project',
      'lint code',
    ];

    for (const cmd of commands) {
      if (cmd.toLowerCase().startsWith(partial.toLowerCase())) {
        suggestions.push(cmd);
      }
    }
    
    // Add MCP tool suggestions
    const mcpTools = mcpRegistry.getAllTools();
    for (const { tool } of mcpTools) {
      const toolCommand = `run ${tool.name}`;
      if (toolCommand.toLowerCase().startsWith(partial.toLowerCase())) {
        suggestions.push(`${toolCommand} - ${tool.description}`);
      }
    }

    return suggestions;
  }
  
  // Extract arguments for MCP tool from input
  private extractToolArgs(input: string, tool: MCPTool): Record<string, any> {
    const args: Record<string, any> = {};
    
    // Simple argument extraction based on tool schema
    if (tool.inputSchema && tool.inputSchema.properties) {
      for (const [key, schema] of Object.entries(tool.inputSchema.properties)) {
        // Try to extract values based on key names
        const pattern = new RegExp(`${key}[:\s]+([^\s]+)`, 'i');
        const match = input.match(pattern);
        if (match) {
          args[key] = match[1];
        }
      }
    }
    
    return args;
  }

  // Cleanup
  shutdown(): void {
    this.activeAgents.clear();
    this.removeAllListeners();
  }
}