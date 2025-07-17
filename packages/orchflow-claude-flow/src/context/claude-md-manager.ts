import * as fs from 'fs/promises';
import * as path from 'path';
import type { FunctionalContextResponse } from './functional-context';

export interface ClaudeMDSection {
  title: string;
  content: string;
  priority: number;
  dynamic: boolean;
}

/**
 * ClaudeMDManager handles dynamic augmentation of CLAUDE.md with OrchFlow-specific
 * context and instructions without conflicting with existing claude-flow content.
 */
export class ClaudeMDManager {
  private orchflowSectionMarker = '<!-- ORCHFLOW_SECTION_START -->';
  private orchflowSectionEndMarker = '<!-- ORCHFLOW_SECTION_END -->';
  private claudeMdPath: string;

  constructor(claudeMdPath?: string) {
    this.claudeMdPath = claudeMdPath || path.join(process.cwd(), 'CLAUDE.md');
  }

  /**
   * Generate OrchFlow-specific section content
   */
  async generateOrchFlowSection(context: FunctionalContextResponse): Promise<string> {
    const workerStatus = this.formatWorkerStatus(context.workers);
    const taskContext = this.formatTaskContext(context.currentTask);
    const quickAccessInfo = this.formatQuickAccessInfo(context.quickAccessMap);

    return `${this.orchflowSectionMarker}

## OrchFlow Terminal Commands

You are working in an OrchFlow-enhanced environment with natural language orchestration.

### Available OrchFlow Commands:
- **Create workers**: "Create a React builder to handle the UI"
- **Quick access**: Press 1-9 to instantly connect to workers
- **Connect by name**: "Connect to the API developer" or "Show me the React builder"
- **Check status**: "What is worker 3 doing?" or "Show all workers"
- **Control workers**: "Pause the database designer" or "Resume worker 2"

Note: These commands are for the PRIMARY TERMINAL only, not for individual workers.

### Current Worker Status:
${workerStatus}

### Active Task Context:
${taskContext}

### Quick Access Map:
${quickAccessInfo}

### OrchFlow Integration Tips:
- **Worker Names**: Use descriptive names like "React Component Builder" or "API Security Specialist"
- **Natural Language**: No command prefixes needed - just speak naturally
- **Primary Terminal**: This terminal stays responsive while workers run in background
- **Worker Connection**: Connect to any running worker to guide their specific work
- **Memory Integration**: Workers automatically coordinate through shared memory
- **Session Persistence**: All worker states and contexts are preserved across sessions

### Memory Coordination:
Workers use these patterns for coordination:
- \`mcp__claude-flow__memory_usage\` - Store and retrieve shared context
- \`orchflow/workers/{workerId}/*\` - Worker-specific memory keys
- \`orchflow/tasks/*\` - Task history and learning patterns

${this.orchflowSectionEndMarker}`;
  }

  /**
   * Append OrchFlow section to CLAUDE.md
   */
  async appendToClaudeMD(content: string): Promise<void> {
    try {
      const existing = await this.readClaudeMD();

      // Check if OrchFlow section already exists
      if (existing.includes(this.orchflowSectionMarker)) {
        await this.updateExistingSection(content);
      } else {
        // Append new section (creates file if it doesn't exist)
        await fs.appendFile(this.claudeMdPath, `\n\n${  content}`);
      }
    } catch (error) {
      console.warn('Failed to append to CLAUDE.md:', error);
    }
  }

  /**
   * Update existing OrchFlow section in CLAUDE.md
   */
  async updateExistingSection(newContent: string): Promise<void> {
    try {
      const existing = await this.readClaudeMD();

      // Find and replace the OrchFlow section
      const startIndex = existing.indexOf(this.orchflowSectionMarker);
      const endIndex = existing.indexOf(this.orchflowSectionEndMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        const beforeSection = existing.substring(0, startIndex);
        const afterSection = existing.substring(endIndex + this.orchflowSectionEndMarker.length);
        const updatedContent = beforeSection + newContent + afterSection;

        await fs.writeFile(this.claudeMdPath, updatedContent);
      }
    } catch (error) {
      console.warn('Failed to update OrchFlow section:', error);
    }
  }

  /**
   * Remove OrchFlow section from CLAUDE.md
   */
  async removeOrchFlowSection(): Promise<void> {
    try {
      const existing = await this.readClaudeMD();

      const startIndex = existing.indexOf(this.orchflowSectionMarker);
      const endIndex = existing.indexOf(this.orchflowSectionEndMarker);

      if (startIndex !== -1 && endIndex !== -1) {
        const beforeSection = existing.substring(0, startIndex);
        const afterSection = existing.substring(endIndex + this.orchflowSectionEndMarker.length);
        const cleanedContent = beforeSection + afterSection;

        await fs.writeFile(this.claudeMdPath, cleanedContent);
      }
    } catch (error) {
      console.warn('Failed to remove OrchFlow section:', error);
    }
  }

  /**
   * Generate worker-specific CLAUDE.md content
   */
  generateWorkerInstructions(workerId: string, workerName: string, taskDescription: string): string {
    return `
## Worker Identity: ${workerName}

You are a specialized worker in the OrchFlow orchestration system.

### Your Role:
- **Identity**: ${workerName}
- **Task**: ${taskDescription}
- **Focus**: Complete your assigned task efficiently and coordinate with other workers

### OrchFlow Worker Coordination:
- **Store important decisions**: Use \`mcp__claude-flow__memory_usage\` with \`action: "store"\`
- **Memory key pattern**: \`orchflow/workers/${workerId}/*\`
- **Share progress**: Store milestone completions and current focus
- **Coordinate with others**: Check memory for related worker activities
- **Request help**: Can request additional workers for complex sub-tasks

### Memory Integration Examples:
\`\`\`javascript
// Store current progress
await mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
  action: 'store',
  key: 'orchflow/workers/${workerId}/progress',
  value: JSON.stringify({
    currentTask: 'Implementing authentication endpoints',
    completedMilestones: ['Database schema designed', 'JWT middleware created'],
    nextSteps: ['Password hashing', 'Token validation'],
    blockers: [],
    timestamp: new Date().toISOString()
  }),
  namespace: 'orchflow',
  ttl: 3600
});

// Store important decisions
await mcpClient.invokeTool('mcp__claude-flow__memory_usage', {
  action: 'store',
  key: 'orchflow/workers/${workerId}/decisions/\${timestamp}',
  value: JSON.stringify({
    decision: 'Using bcrypt for password hashing',
    rationale: 'Industry standard, good security vs performance balance',
    alternatives: ['scrypt', 'argon2'],
    impact: 'All user authentication will use this method'
  }),
  namespace: 'orchflow'
});
\`\`\`

### Your Specific Instructions:
${this.getWorkerSpecificGuidance(workerName, taskDescription)}

### Communication with Main Terminal:
- Progress updates are automatically stored in memory
- The main terminal can check your status at any time
- Use descriptive commit messages and file names
- Document important architectural decisions

### Worker Exit:
- Type 'exit' or use Ctrl+D to return to main OrchFlow terminal
- All progress and context is automatically saved
- Other workers can pick up where you left off if needed
`;
  }

  /**
   * Check if CLAUDE.md exists and is writable
   */
  async checkClaudeMDAccess(): Promise<boolean> {
    try {
      await fs.access(this.claudeMdPath, fs.constants.F_OK | fs.constants.W_OK);
      return true;
    } catch (error) {
      // Try to create if it doesn't exist
      try {
        await fs.writeFile(this.claudeMdPath, '# Claude Configuration\n\n');
        return true;
      } catch (createError) {
        console.warn('Cannot access or create CLAUDE.md:', createError);
        return false;
      }
    }
  }

  /**
   * Read current CLAUDE.md content
   */
  private async readClaudeMD(): Promise<string> {
    try {
      return await fs.readFile(this.claudeMdPath, 'utf-8');
    } catch (error: any) {
      // If file doesn't exist, return empty string
      if (error.code === 'ENOENT') {
        return '';
      }
      // For other errors, log and return empty
      console.warn('Failed to read CLAUDE.md:', error.message);
      return '';
    }
  }

  /**
   * Format worker status for display
   */
  private formatWorkerStatus(workers: FunctionalContextResponse['workers']): string {
    if (!workers || workers.length === 0) {
      return 'No active workers';
    }

    const statusLines = workers.map(worker => {
      const key = worker.quickAccessKey ? `[${worker.quickAccessKey}]` : '[--]';
      const status = this.getStatusIcon(worker.status);
      const progress = worker.progress ? ` (${worker.progress}%)` : '';
      const task = worker.currentTask ? ` - ${worker.currentTask}` : '';

      return `${key} ${status} ${worker.descriptiveName}${progress}${task}`;
    });

    return statusLines.join('\n');
  }

  /**
   * Format task context for display
   */
  private formatTaskContext(taskContext: FunctionalContextResponse['currentTask']): string {
    if (!taskContext) {
      return 'No active task context';
    }

    const lines = [];
    lines.push(`**Main Objective**: ${taskContext.mainObjective}`);

    if (taskContext.activeSubtasks.length > 0) {
      lines.push(`**Active Subtasks**: ${taskContext.activeSubtasks.join(', ')}`);
    }

    if (taskContext.completedTasks.length > 0) {
      lines.push(`**Completed**: ${taskContext.completedTasks.length} tasks`);
    }

    return lines.join('\n');
  }

  /**
   * Format quick access information
   */
  private formatQuickAccessInfo(quickAccessMap: FunctionalContextResponse['quickAccessMap']): string {
    if (!quickAccessMap || quickAccessMap.length === 0) {
      return 'No quick access keys assigned';
    }

    const accessLines = quickAccessMap.map(entry =>
      `**${entry.key}**: ${entry.workerName}`
    );

    return accessLines.join('\n');
  }

  /**
   * Get status icon for worker status
   */
  private getStatusIcon(status: string): string {
    switch (status) {
      case 'active': return '🟢';
      case 'paused': return '🟡';
      case 'completed': return '✅';
      case 'error': return '❌';
      default: return '⚪';
    }
  }

  /**
   * Get worker-specific guidance based on name and task
   */
  private getWorkerSpecificGuidance(workerName: string, taskDescription: string): string {
    const name = workerName.toLowerCase();
    const task = taskDescription.toLowerCase();

    // Use task variable to provide context-aware guidance
    const isUrgent = task.includes('urgent') || task.includes('critical');
    const isAPI = task.includes('api') || task.includes('endpoint');

    if (name.includes('react') || name.includes('component')) {
      const prefix = isUrgent ? '**URGENT** ' : '';
      const apiSuffix = isAPI ? ' Focus on API integration patterns.' : '';
      return `
${prefix}**React Development Focus**:
- Use modern React patterns (hooks, functional components)
- Ensure accessibility and responsive design
- Write comprehensive tests for components
- Document component APIs and usage examples
- Consider performance implications (memoization, lazy loading)${apiSuffix}`;
    }

    if (name.includes('api') || name.includes('backend')) {
      return `
**API Development Focus**:
- Follow RESTful principles and HTTP standards
- Implement proper error handling and status codes
- Add request validation and sanitization
- Include comprehensive API documentation
- Consider rate limiting and security measures`;
    }

    if (name.includes('test') || name.includes('testing')) {
      return `
**Testing Focus**:
- Write clear, maintainable test cases
- Achieve good test coverage (aim for >80%)
- Use appropriate testing patterns (AAA, Given-When-Then)
- Include both positive and negative test cases
- Document test scenarios and expected behaviors`;
    }

    if (name.includes('database') || name.includes('db')) {
      return `
**Database Focus**:
- Design efficient, normalized schemas
- Consider indexing strategies for performance
- Implement proper data validation and constraints
- Plan for scalability and data migration
- Document database structure and relationships`;
    }

    return `
**General Development Focus**:
- Write clean, maintainable code
- Follow established coding standards
- Include comprehensive documentation
- Consider performance and security implications
- Test thoroughly before completion`;
  }
}