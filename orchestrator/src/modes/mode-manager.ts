import { EventBus, OrchflowEvents } from '../core/event-bus';
import { SparcMode, ModeContext, ModeTransition } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class ModeManager {
  private modes: Map<string, SparcMode> = new Map();
  private activeMode: SparcMode | null = null;
  private modeContext: ModeContext | null = null;
  private transitions: ModeTransition[] = [];
  private modePath: string;
  
  constructor(modePath: string = '.orchflow/modes') {
    this.modePath = modePath;
    this.setupEventHandlers();
  }
  
  async initialize(): Promise<void> {
    await fs.mkdir(this.modePath, { recursive: true });
    await this.loadBuiltInModes();
    await this.loadCustomModes();
  }
  
  private setupEventHandlers(): void {
    // Track command execution in mode context
    EventBus.on(OrchflowEvents.COMMAND_EXECUTED, ({ command }) => {
      if (this.modeContext) {
        this.modeContext.inputs.push(command);
      }
    });
    
    EventBus.on(OrchflowEvents.COMMAND_COMPLETED, ({ result }) => {
      if (this.modeContext && result) {
        this.modeContext.outputs.push(JSON.stringify(result));
        this.checkSuccessCriteria();
      }
    });
  }
  
  private async loadBuiltInModes(): Promise<void> {
    const builtInModes: SparcMode[] = [
      {
        name: 'tdd',
        description: 'Test-Driven Development mode',
        icon: '🧪',
        category: 'development',
        priority: 100,
        enabled: true,
        agentConfig: {
          type: 'development',
          systemPrompt: `You are in TDD mode. Follow these steps:
1. Write failing tests first
2. Write minimal code to make tests pass
3. Refactor while keeping tests green
Always ensure tests exist before implementation.`,
          temperature: 0.3,
        },
        behavior: {
          autoSuggest: true,
          requiresConfirmation: false,
          preserveContext: true,
          chainable: true,
        },
        successCriteria: {
          requiredOutputs: ['test', 'implementation', 'refactor'],
        },
      },
      {
        name: 'debug',
        description: 'Debugging and troubleshooting mode',
        icon: '🐛',
        category: 'testing',
        priority: 90,
        enabled: true,
        agentConfig: {
          type: 'debugging',
          systemPrompt: `You are in Debug mode. Focus on:
1. Identifying the root cause of issues
2. Using debugging tools and techniques
3. Providing clear explanations of problems
4. Suggesting fixes with minimal side effects`,
          temperature: 0.2,
          tools: ['debugger', 'logger', 'profiler'],
        },
        behavior: {
          autoSuggest: true,
          requiresConfirmation: true,
          preserveContext: true,
          chainable: false,
        },
      },
      {
        name: 'architect',
        description: 'System design and architecture mode',
        icon: '🏗️',
        category: 'design',
        priority: 95,
        enabled: true,
        agentConfig: {
          type: 'architecture',
          systemPrompt: `You are in Architecture mode. Focus on:
1. High-level system design
2. Component relationships and dependencies
3. Design patterns and best practices
4. Scalability and maintainability considerations`,
          temperature: 0.7,
        },
        behavior: {
          autoSuggest: false,
          requiresConfirmation: true,
          preserveContext: true,
          chainable: true,
        },
      },
      {
        name: 'security',
        description: 'Security review and hardening mode',
        icon: '🔒',
        category: 'security',
        priority: 85,
        enabled: true,
        agentConfig: {
          type: 'security',
          systemPrompt: `You are in Security mode. Focus on:
1. Identifying security vulnerabilities
2. Following OWASP guidelines
3. Implementing security best practices
4. Providing remediation recommendations`,
          temperature: 0.1,
          tools: ['scanner', 'analyzer'],
        },
        behavior: {
          autoSuggest: true,
          requiresConfirmation: true,
          preserveContext: true,
          chainable: false,
        },
      },
      {
        name: 'optimize',
        description: 'Performance optimization mode',
        icon: '⚡',
        category: 'development',
        priority: 80,
        enabled: true,
        agentConfig: {
          type: 'optimization',
          systemPrompt: `You are in Optimization mode. Focus on:
1. Identifying performance bottlenecks
2. Implementing efficient algorithms
3. Reducing resource usage
4. Maintaining code readability`,
          temperature: 0.4,
          tools: ['profiler', 'benchmark'],
        },
        behavior: {
          autoSuggest: true,
          requiresConfirmation: false,
          preserveContext: true,
          chainable: true,
        },
      },
      {
        name: 'docs',
        description: 'Documentation generation mode',
        icon: '📚',
        category: 'documentation',
        priority: 70,
        enabled: true,
        agentConfig: {
          type: 'documentation',
          systemPrompt: `You are in Documentation mode. Focus on:
1. Clear and concise explanations
2. Code examples and usage patterns
3. API documentation
4. User guides and tutorials`,
          temperature: 0.5,
        },
        behavior: {
          autoSuggest: false,
          requiresConfirmation: false,
          preserveContext: true,
          chainable: true,
        },
      },
    ];
    
    for (const mode of builtInModes) {
      this.modes.set(mode.name, mode);
    }
    
    // Define mode transitions
    this.transitions = [
      {
        from: 'architect',
        to: 'tdd',
        condition: (ctx) => ctx.outputs.some(o => o.includes('design complete')),
      },
      {
        from: 'tdd',
        to: 'optimize',
        condition: (ctx) => ctx.outputs.some(o => o.includes('tests passing')),
      },
      {
        from: 'debug',
        to: 'security',
        condition: (ctx) => ctx.outputs.some(o => o.includes('bug fixed')),
      },
      {
        from: 'optimize',
        to: 'docs',
        condition: (ctx) => ctx.outputs.some(o => o.includes('optimization complete')),
      },
    ];
  }
  
  private async loadCustomModes(): Promise<void> {
    try {
      const files = await fs.readdir(this.modePath);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = await fs.readFile(path.join(this.modePath, file), 'utf-8');
          const mode = JSON.parse(content) as SparcMode;
          this.modes.set(mode.name, mode);
        }
      }
    } catch (error) {
      console.error('Failed to load custom modes:', error);
    }
  }
  
  async activateMode(modeName: string, metadata: Record<string, any> = {}): Promise<void> {
    const mode = this.modes.get(modeName);
    if (!mode) {
      throw new Error(`Mode not found: ${modeName}`);
    }
    
    if (!mode.enabled) {
      throw new Error(`Mode is disabled: ${modeName}`);
    }
    
    // End current mode if active
    if (this.activeMode) {
      await this.endMode();
    }
    
    this.activeMode = mode;
    this.modeContext = {
      mode,
      sessionId: `mode-${Date.now()}`,
      startTime: new Date(),
      inputs: [],
      outputs: [],
      metadata,
    };
    
    console.log(`${mode.icon} Activated ${mode.name} mode`);
    
    // Emit mode activation event
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
  }
  
  async endMode(): Promise<ModeContext | null> {
    if (!this.activeMode || !this.modeContext) {
      return null;
    }
    
    this.modeContext.endTime = new Date();
    this.checkSuccessCriteria();
    
    const context = this.modeContext;
    this.activeMode = null;
    this.modeContext = null;
    
    console.log(`Ended ${context.mode.name} mode (success: ${context.success})`);
    
    return context;
  }
  
  private checkSuccessCriteria(): void {
    if (!this.modeContext || !this.activeMode) return;
    
    const criteria = this.activeMode.successCriteria;
    if (!criteria) {
      this.modeContext.success = true;
      return;
    }
    
    let success = true;
    
    // Check required outputs
    if (criteria.requiredOutputs) {
      for (const required of criteria.requiredOutputs) {
        if (!this.modeContext.outputs.some(o => o.includes(required))) {
          success = false;
          break;
        }
      }
    }
    
    // Check validation rules
    if (criteria.validationRules) {
      for (const rule of criteria.validationRules) {
        if (!this.modeContext.outputs.some(o => rule(o))) {
          success = false;
          break;
        }
      }
    }
    
    // Check minimum duration
    if (criteria.minimumDuration) {
      const duration = Date.now() - this.modeContext.startTime.getTime();
      if (duration < criteria.minimumDuration) {
        success = false;
      }
    }
    
    this.modeContext.success = success;
  }
  
  getActiveMode(): SparcMode | null {
    return this.activeMode;
  }
  
  getModeContext(): ModeContext | null {
    return this.modeContext;
  }
  
  listModes(filter?: { category?: string; enabled?: boolean }): SparcMode[] {
    let modes = Array.from(this.modes.values());
    
    if (filter) {
      if (filter.category) {
        modes = modes.filter(m => m.category === filter.category);
      }
      if (filter.enabled !== undefined) {
        modes = modes.filter(m => m.enabled === filter.enabled);
      }
    }
    
    return modes.sort((a, b) => b.priority - a.priority);
  }
  
  async suggestNextMode(): Promise<SparcMode | null> {
    if (!this.activeMode || !this.modeContext) return null;
    
    // Check transitions
    for (const transition of this.transitions) {
      if (transition.from === this.activeMode.name) {
        if (!transition.condition || transition.condition(this.modeContext)) {
          const nextMode = this.modes.get(transition.to);
          if (nextMode && nextMode.enabled) {
            return nextMode;
          }
        }
      }
    }
    
    return null;
  }
  
  getModeForCommand(command: string): SparcMode | null {
    // Analyze command to suggest appropriate mode
    const commandLower = command.toLowerCase();
    
    if (commandLower.includes('test')) {
      return this.modes.get('tdd') || null;
    } else if (commandLower.includes('debug') || commandLower.includes('fix')) {
      return this.modes.get('debug') || null;
    } else if (commandLower.includes('design') || commandLower.includes('architect')) {
      return this.modes.get('architect') || null;
    } else if (commandLower.includes('security') || commandLower.includes('audit')) {
      return this.modes.get('security') || null;
    } else if (commandLower.includes('optimize') || commandLower.includes('performance')) {
      return this.modes.get('optimize') || null;
    } else if (commandLower.includes('document') || commandLower.includes('docs')) {
      return this.modes.get('docs') || null;
    }
    
    return null;
  }
  
  async saveCustomMode(mode: SparcMode): Promise<void> {
    this.modes.set(mode.name, mode);
    const filePath = path.join(this.modePath, `${mode.name}.json`);
    await fs.writeFile(filePath, JSON.stringify(mode, null, 2));
  }
}