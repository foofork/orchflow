import type { Task } from './orchflow-orchestrator';
import path from 'path';
import fs from 'fs';

export interface ClaudeFlowCommand {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export class ClaudeFlowWrapper {
  private claudeFlowPath: string;
  private commandTemplates: Map<string, (task: Task) => ClaudeFlowCommand> = new Map();

  constructor() {
    this.claudeFlowPath = this.findClaudeFlowBinary();
    this.initializeCommandTemplates();
  }

  private findClaudeFlowBinary(): string {
    // Look for claude-flow in various locations
    const possiblePaths = [
      path.join(process.cwd(), 'node_modules', '.bin', 'claude-flow'),
      path.join(process.cwd(), '..', '..', 'node_modules', '.bin', 'claude-flow'),
      path.join(process.env.npm_config_prefix || '', 'bin', 'claude-flow'),
      '/usr/local/bin/claude-flow',
      'claude-flow' // Assume it's in PATH
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    // Default to PATH-based execution
    return 'claude-flow';
  }

  private initializeCommandTemplates(): void {
    this.commandTemplates = new Map();

    // Research task template
    this.commandTemplates.set('research', (task: Task) => ({
      command: this.claudeFlowPath,
      args: ['sparc', 'run', 'researcher', `"${task.description}"`],
      env: {
        CLAUDE_FLOW_MODE: 'research',
        CLAUDE_FLOW_TASK_ID: task.id
      }
    }));

    // Code task template
    this.commandTemplates.set('code', (task: Task) => ({
      command: this.claudeFlowPath,
      args: ['sparc', 'run', 'coder', `"${task.description}"`],
      env: {
        CLAUDE_FLOW_MODE: 'code',
        CLAUDE_FLOW_TASK_ID: task.id
      }
    }));

    // Test task template
    this.commandTemplates.set('test', (task: Task) => ({
      command: this.claudeFlowPath,
      args: ['sparc', 'run', 'tester', `"${task.description}"`],
      env: {
        CLAUDE_FLOW_MODE: 'test',
        CLAUDE_FLOW_TASK_ID: task.id
      }
    }));

    // Analysis task template
    this.commandTemplates.set('analysis', (task: Task) => ({
      command: this.claudeFlowPath,
      args: ['sparc', 'run', 'analyzer', `"${task.description}"`],
      env: {
        CLAUDE_FLOW_MODE: 'analysis',
        CLAUDE_FLOW_TASK_ID: task.id
      }
    }));

    // Swarm task template
    this.commandTemplates.set('swarm', (task: Task) => ({
      command: this.claudeFlowPath,
      args: [
        'swarm',
        `"${task.description}"`,
        '--strategy', task.parameters?.strategy || 'development',
        '--mode', task.parameters?.mode || 'distributed',
        '--max-agents', task.parameters?.maxAgents || '5',
        '--parallel'
      ],
      env: {
        CLAUDE_FLOW_MODE: 'swarm',
        CLAUDE_FLOW_TASK_ID: task.id
      }
    }));

    // Hive-mind task template
    this.commandTemplates.set('hive-mind', (task: Task) => ({
      command: this.claudeFlowPath,
      args: [
        'swarm',
        `"${task.description}"`,
        '--strategy', 'collective',
        '--mode', 'mesh',
        '--enable-consensus',
        '--max-agents', task.parameters?.maxAgents || '8'
      ],
      env: {
        CLAUDE_FLOW_MODE: 'hive-mind',
        CLAUDE_FLOW_TASK_ID: task.id,
        CLAUDE_FLOW_CONSENSUS: 'true'
      }
    }));
  }

  buildCommand(task: Task): string {
    const template = this.commandTemplates.get(task.type);
    if (!template) {
      // Fallback to generic command
      return this.buildGenericCommand(task);
    }

    const cmd = template(task);

    // Build full command string
    let fullCommand = cmd.command;

    // Add arguments
    if (cmd.args.length > 0) {
      fullCommand += ` ${  cmd.args.join(' ')}`;
    }

    // Add additional parameters from task
    if (task.parameters) {
      const additionalArgs = this.buildAdditionalArgs(task.parameters);
      if (additionalArgs) {
        fullCommand += ` ${  additionalArgs}`;
      }
    }

    return fullCommand;
  }

  private buildGenericCommand(task: Task): string {
    // Generic fallback for unknown task types
    return `${this.claudeFlowPath} sparc run orchestrator "${task.description}"`;
  }

  private buildAdditionalArgs(parameters: any): string {
    const args: string[] = [];

    // Convert parameters to command line arguments
    for (const [key, value] of Object.entries(parameters)) {
      // Skip already handled parameters
      if (['strategy', 'mode', 'maxAgents'].includes(key)) {
        continue;
      }

      // Convert camelCase to kebab-case
      const flag = `--${  key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;

      if (typeof value === 'boolean') {
        if (value) {
          args.push(flag);
        }
      } else {
        args.push(flag, String(value));
      }
    }

    return args.join(' ');
  }

  parseClaudeFlowOutput(output: string): any {
    // Parse claude-flow output to extract structured information
    const result = {
      progress: 0,
      status: '',
      messages: [] as string[],
      errors: [] as string[],
      data: {} as any
    };

    const lines = output.split('\n');

    for (const line of lines) {
      // Parse progress indicators
      if (line.includes('Progress:') || line.includes('progress:')) {
        const match = line.match(/(\d+)%/);
        if (match) {
          result.progress = parseInt(match[1]);
        }
      }

      // Parse status updates
      if (line.includes('Status:') || line.includes('status:')) {
        result.status = line.split(':')[1]?.trim() || '';
      }

      // Parse errors
      if (line.includes('ERROR') || line.includes('Error')) {
        result.errors.push(line);
      }

      // Parse JSON output
      if (line.trim().startsWith('{') || line.trim().startsWith('[')) {
        try {
          const jsonData = JSON.parse(line);
          Object.assign(result.data, jsonData);
        } catch {
          // Not valid JSON, continue
        }
      }

      // Collect all messages
      if (line.trim()) {
        result.messages.push(line);
      }
    }

    return result;
  }

  generateWorkerConfig(task: Task): any {
    // Generate worker-specific configuration based on task
    return {
      name: `${task.type}_${task.id}`,
      memory: this.getMemoryLimit(task.type),
      timeout: this.getTimeout(task.type),
      retries: task.type === 'test' ? 3 : 1,
      environment: {
        ORCHFLOW_TASK_ID: task.id,
        ORCHFLOW_TASK_TYPE: task.type,
        ORCHFLOW_WORKER: 'true'
      }
    };
  }

  private getMemoryLimit(taskType: string): string {
    const limits: Record<string, string> = {
      'research': '512m',
      'code': '1g',
      'test': '1g',
      'analysis': '2g',
      'swarm': '2g',
      'hive-mind': '4g'
    };
    return limits[taskType] || '1g';
  }

  private getTimeout(taskType: string): number {
    const timeouts: Record<string, number> = {
      'research': 300000, // 5 minutes
      'code': 600000, // 10 minutes
      'test': 450000, // 7.5 minutes
      'analysis': 900000, // 15 minutes
      'swarm': 1800000, // 30 minutes
      'hive-mind': 3600000 // 60 minutes
    };
    return timeouts[taskType] || 600000;
  }

  validateCommand(command: string): { valid: boolean; error?: string } {
    // Basic validation of generated commands
    if (!command || command.trim().length === 0) {
      return { valid: false, error: 'Empty command' };
    }

    if (!command.includes('claude-flow')) {
      return { valid: false, error: 'Missing claude-flow executable' };
    }

    // Check for dangerous patterns
    const dangerousPatterns = [';rm', '&&rm', '|rm', '>/', '2>/', 'sudo'];
    for (const pattern of dangerousPatterns) {
      if (command.includes(pattern)) {
        return { valid: false, error: `Dangerous pattern detected: ${pattern}` };
      }
    }

    return { valid: true };
  }
}