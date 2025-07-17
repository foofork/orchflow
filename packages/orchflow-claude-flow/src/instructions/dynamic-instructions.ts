import type { FunctionalContextResponse } from '../context/functional-context';

export interface InstructionConfig {
  includeWorkerStatus: boolean;
  includeTaskContext: boolean;
  includeQuickAccess: boolean;
  includePatterns: boolean;
  maxPatterns: number;
}

/**
 * DynamicInstructionProvider generates contextual instructions based on the current
 * OrchFlow state and user input patterns.
 */
export class DynamicInstructionProvider {
  private defaultConfig: InstructionConfig = {
    includeWorkerStatus: true,
    includeTaskContext: true,
    includeQuickAccess: true,
    includePatterns: true,
    maxPatterns: 6
  };

  /**
   * Generate dynamic instructions based on task type and context
   */
  generateInstructions(
    taskType: string,
    context: FunctionalContextResponse,
    config: Partial<InstructionConfig> = {}
  ): string {
    const finalConfig = { ...this.defaultConfig, ...config };
    const instructions = ['# OrchFlow Task Context\n'];

    // Add current objective if available
    if (finalConfig.includeTaskContext && context.currentTask?.mainObjective) {
      instructions.push(`## Current Objective: ${context.currentTask.mainObjective}\n`);
    }

    // Add relevant patterns based on task type
    if (finalConfig.includePatterns) {
      const patterns = this.getTaskPatterns(taskType);
      if (patterns.length > 0) {
        instructions.push('## Relevant OrchFlow Commands:');
        patterns.slice(0, finalConfig.maxPatterns).forEach(p => {
          instructions.push(`- ${p}`);
        });
        instructions.push('');
      }
    }

    // Add current worker status with quick access
    if (finalConfig.includeWorkerStatus && context.workers && context.workers.length > 0) {
      instructions.push('## Active Workers:');
      context.workers.forEach(w => {
        const key = w.quickAccessKey ? `[${w.quickAccessKey}]` : '[--]';
        const progress = w.progress ? ` (${w.progress}%)` : '';
        const status = this.getStatusEmoji(w.status);
        instructions.push(`- ${key} ${status} ${w.descriptiveName}: ${w.status}${progress}`);
      });

      if (finalConfig.includeQuickAccess) {
        instructions.push('\n💡 **Quick Access**: Use number keys 1-9 or worker names to connect instantly');
      }
      instructions.push('');
    }

    // Add available commands from context
    if (context.availableCommands.length > 0) {
      instructions.push('## Suggested Commands:');
      context.availableCommands.forEach(cmd => {
        instructions.push(`- ${cmd}`);
      });
      instructions.push('');
    }

    // Add task-specific guidance
    const guidance = this.getTaskGuidance(taskType, context);
    if (guidance) {
      instructions.push(`## Task Guidance:\n${guidance}\n`);
    }

    return instructions.join('\n');
  }

  /**
   * Get task-specific patterns based on task type
   */
  private getTaskPatterns(taskType: string): string[] {
    const patterns: Record<string, string[]> = {
      'web-development': [
        '"Create a React component builder" - for UI components and frontend development',
        '"Create an API developer" - for backend services and REST endpoints',
        '"Create a database designer" - for data modeling and schema design',
        '"Create a test engineer" - for unit, integration, and E2E testing',
        '"Create a DevOps specialist" - for deployment and CI/CD pipelines',
        '"Create a security auditor" - for security reviews and vulnerability assessments'
      ],
      'api-development': [
        '"Create a REST API designer" - for endpoint planning and documentation',
        '"Create a GraphQL developer" - for GraphQL schemas and resolvers',
        '"Create an API tester" - for endpoint testing and validation',
        '"Create a documentation writer" - for API documentation and guides',
        '"Create a performance optimizer" - for API performance tuning',
        '"Create a security specialist" - for API security implementation'
      ],
      'testing': [
        '"Create a unit test engineer" - for component and function testing',
        '"Create an integration tester" - for system integration testing',
        '"Create an E2E test specialist" - for end-to-end testing scenarios',
        '"Create a performance tester" - for load and stress testing',
        '"Create a security tester" - for penetration testing and security audits',
        '"Create a test automation engineer" - for CI/CD test automation'
      ],
      'research': [
        '"Create a research analyst" - for technical research and analysis',
        '"Create a documentation specialist" - for creating comprehensive docs',
        '"Create a code reviewer" - for code quality and best practices review',
        '"Create a architecture specialist" - for system design and architecture',
        '"Create a technology evaluator" - for technology stack evaluation',
        '"Create a competitive analyst" - for competitive analysis and benchmarking'
      ],
      'deployment': [
        '"Create a DevOps engineer" - for deployment automation and infrastructure',
        '"Create a monitoring specialist" - for system monitoring and alerting',
        '"Create a security engineer" - for security configuration and compliance',
        '"Create a performance engineer" - for system performance optimization',
        '"Create a backup specialist" - for data backup and disaster recovery',
        '"Create a scaling expert" - for horizontal and vertical scaling strategies'
      ],
      'general': [
        '"Create a [role] to [task]" - spawn a specialized worker for any task',
        '"Connect to [worker name or number]" - switch to an existing worker',
        '"What is [worker] doing?" - check the current status of a worker',
        '"Pause/Resume [worker]" - control worker execution state',
        '"Show me all workers" - display comprehensive worker status',
        '"Assign key [1-9] to [worker]" - set up quick access shortcuts'
      ]
    };

    return patterns[taskType] || patterns.general;
  }

  /**
   * Get task-specific guidance based on type and context
   */
  private getTaskGuidance(taskType: string, context: FunctionalContextResponse): string | null {
    const guidance: Record<string, string> = {
      'web-development': 'Focus on creating specialized workers for frontend (React/Vue), backend (API), and database tasks. Use descriptive names to easily identify each worker\'s purpose.',
      'api-development': 'Start with API design and documentation workers, then create testing and implementation specialists. Consider security and performance from the beginning.',
      'testing': 'Create different testing specialists for unit, integration, and E2E testing. Each can focus on specific testing frameworks and methodologies.',
      'research': 'Use research analysts for gathering information and documentation specialists for organizing findings. Code reviewers can help with technical validation.',
      'deployment': 'Begin with DevOps engineers for infrastructure, then add monitoring and security specialists. Consider backup and scaling needs early.',
      'auth': 'Create authentication specialists for secure login systems. Consider JWT implementation, password security, and session management.',
      'database': 'Use database architects for schema design and optimization specialists for performance tuning. Consider data migration and backup strategies.'
    };

    return guidance[taskType] || null;
  }

  /**
   * Get status emoji for worker status
   */
  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'active': return '🟢';
      case 'paused': return '🟡';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⚪';
    }
  }

  /**
   * Generate instructions specifically for worker connection
   */
  generateConnectionInstructions(workerId: string, workerName: string): string {
    return `
# Connected to: ${workerName}

## Worker Context
You are now connected to the "${workerName}" worker. This worker is specialized for specific tasks and can:
- Execute focused development work
- Maintain context about their assigned tasks
- Coordinate with other workers through the OrchFlow system

## Available Actions
- Continue working on assigned tasks
- Request additional workers if needed
- Save progress and context to memory
- Communicate status back to the main orchestrator

## Memory Integration
Use these commands to maintain coordination:
- Store decisions: \`mcp__claude-flow__memory_usage store\`
- Retrieve context: \`mcp__claude-flow__memory_usage retrieve\`
- Share progress: \`mcp__claude-flow__memory_usage store\` with key pattern \`orchflow/workers/${workerId}/*\`

## Return to Main Terminal
Type 'exit' or use Ctrl+D to return to the main OrchFlow terminal.
`;
  }

  /**
   * Generate instructions for session management
   */
  generateSessionInstructions(activeWorkers: number, completedTasks: number): string {
    return `
# OrchFlow Session Status

## Current Session
- **Active Workers**: ${activeWorkers}
- **Completed Tasks**: ${completedTasks}
- **Session State**: Persistent across connections

## Session Commands
- \`orchflow_session save\` - Save current session state
- \`orchflow_session create_snapshot [name]\` - Create named snapshot
- \`orchflow_session restore [snapshot]\` - Restore from snapshot
- \`orchflow_session list_snapshots\` - List available snapshots

## Best Practices
1. **Save frequently**: Session state includes worker assignments and task history
2. **Use descriptive snapshots**: Name snapshots based on project milestones
3. **Regular cleanup**: Remove old snapshots to maintain performance
4. **Context preservation**: Worker context is automatically saved with sessions
`;
  }
}