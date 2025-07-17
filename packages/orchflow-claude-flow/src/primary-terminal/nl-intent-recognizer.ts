import { ConversationContext } from './conversation-context';
import { WorkerNamer } from './worker-namer';

export interface Intent {
  action: string;
  parameters: Record<string, any>;
  confidence: number;
  context: ConversationContext;
  workerTarget?: string;
}

export interface IntentPattern {
  patterns: RegExp[];
  extractor: (match: RegExpMatchArray) => Partial<Intent>;
}

export type TaskType = 'research' | 'code' | 'test' | 'analysis' | 'swarm' | 'hive-mind';

export class NLIntentRecognizer {
  private patterns: Map<string, IntentPattern> = new Map();
  private workerNamer: WorkerNamer;

  constructor() {
    this.workerNamer = new WorkerNamer();
    this.initializePatterns();
  }

  async initialize(): Promise<void> {
    // Additional initialization if needed
  }

  private initializePatterns(): void {
    // Task creation patterns with descriptive naming
    this.patterns.set('create_task', {
      patterns: [
        /create.*task.*for.*(.+)/i,
        /build.*(.+)/i,
        /implement.*(.+)/i,
        /develop.*(.+)/i,
        /start.*working.*on.*(.+)/i,
        /make.*(.+)/i,
        /code.*(.+)/i,
        /design.*(.+)/i
      ],
      extractor: (match) => {
        const description = match[1].trim();
        const taskType = this.inferTaskType(description);
        const descriptiveName = this.workerNamer.generateFromDescription(description);
        
        return {
          action: 'create_task',
          parameters: {
            description,
            taskType,
            descriptiveName,
            priority: this.inferPriority(description)
          }
        };
      }
    });
    
    // Worker connection patterns
    this.patterns.set('connect_to_worker', {
      patterns: [
        /connect.*to.*worker.*(.+)/i,
        /talk.*to.*(.+).*worker/i,
        /switch.*to.*(.+)/i,
        /go.*to.*(.+)/i,
        /inspect.*worker.*(.+)/i,
        /check.*on.*(.+)/i,
        /connect.*to.*(.+)/i
      ],
      extractor: (match) => ({
        action: 'connect_to_worker',
        parameters: {
          workerName: match[1].trim()
        }
      })
    });
    
    // Worker list patterns
    this.patterns.set('list_workers', {
      patterns: [
        /list.*workers?/i,
        /show.*workers?/i,
        /who.*working/i,
        /what.*workers.*active/i,
        /show.*me.*all.*workers/i,
        /workers?\s*$/i
      ],
      extractor: () => ({
        action: 'list_workers',
        parameters: {}
      })
    });
    
    // Worker control patterns
    this.patterns.set('pause_worker', {
      patterns: [
        /pause.*worker.*(.+)/i,
        /stop.*worker.*(.+)/i,
        /halt.*(.+)/i,
        /pause.*(.+)/i,
        /suspend.*(.+)/i
      ],
      extractor: (match) => ({
        action: 'pause_worker',
        parameters: {
          workerName: match[1].trim()
        }
      })
    });

    // Resume worker patterns
    this.patterns.set('resume_worker', {
      patterns: [
        /resume.*worker.*(.+)/i,
        /continue.*worker.*(.+)/i,
        /unpause.*(.+)/i,
        /resume.*(.+)/i,
        /start.*(.+).*again/i
      ],
      extractor: (match) => ({
        action: 'resume_worker',
        parameters: {
          workerName: match[1].trim()
        }
      })
    });

    // Task status patterns
    this.patterns.set('check_status', {
      patterns: [
        /status.*(.+)?/i,
        /how.*(.+)?.*doing/i,
        /progress.*(.+)?/i,
        /check.*status.*(.+)?/i
      ],
      extractor: (match) => ({
        action: 'check_status',
        parameters: {
          target: match[1]?.trim() || 'all'
        }
      })
    });
  }

  async parseIntent(input: string, context: ConversationContext): Promise<Intent> {
    // Normalize input
    const normalizedInput = input.trim();
    
    // Check for numeric shortcut (1-9)
    if (/^[1-9]$/.test(normalizedInput)) {
      return {
        action: 'quick_access',
        parameters: { workerNumber: parseInt(normalizedInput) },
        confidence: 1.0,
        context
      };
    }
    
    // Try to match patterns
    for (const [action, pattern] of this.patterns) {
      for (const regex of pattern.patterns) {
        const match = normalizedInput.match(regex);
        if (match) {
          const baseIntent = pattern.extractor(match);
          return {
            action: baseIntent.action!,
            parameters: baseIntent.parameters || {},
            confidence: this.calculateConfidence(match, normalizedInput),
            context,
            workerTarget: baseIntent.workerTarget
          };
        }
      }
    }
    
    // If no pattern matches, try to understand intent from context
    return this.inferIntentFromContext(normalizedInput, context);
  }

  private inferTaskType(description: string): TaskType {
    const desc = description.toLowerCase();
    
    const keywords: Record<TaskType, string[]> = {
      'research': ['analyze', 'study', 'investigate', 'research', 'explore', 'examine', 'review'],
      'code': ['build', 'implement', 'create', 'develop', 'code', 'write', 'program', 'script'],
      'test': ['test', 'verify', 'validate', 'check', 'qa', 'quality', 'ensure'],
      'analysis': ['analyze', 'examine', 'review', 'assess', 'audit', 'evaluate', 'inspect'],
      'swarm': ['swarm', 'team', 'collaborative', 'distributed', 'multiple', 'parallel'],
      'hive-mind': ['hive-mind', 'collective', 'intelligence', 'coordination', 'orchestrate']
    };
    
    // Count keyword matches
    const scores: Partial<Record<TaskType, number>> = {};
    
    for (const [type, words] of Object.entries(keywords)) {
      scores[type as TaskType] = words.reduce((score, word) => 
        score + (desc.includes(word) ? 1 : 0), 0
      );
    }
    
    // Find type with highest score
    let bestType: TaskType = 'code';
    let bestScore = 0;
    
    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type as TaskType;
      }
    }
    
    return bestType;
  }

  private inferPriority(description: string): number {
    const desc = description.toLowerCase();
    
    // High priority indicators
    if (desc.includes('urgent') || desc.includes('critical') || 
        desc.includes('asap') || desc.includes('immediately')) {
      return 9;
    }
    
    // Medium-high priority
    if (desc.includes('important') || desc.includes('priority')) {
      return 7;
    }
    
    // Low priority
    if (desc.includes('when possible') || desc.includes('low priority') ||
        desc.includes('eventually')) {
      return 3;
    }
    
    // Default medium priority
    return 5;
  }

  private calculateConfidence(match: RegExpMatchArray, input: string): number {
    // Simple confidence calculation based on match coverage
    const matchLength = match[0].length;
    const inputLength = input.length;
    const coverage = matchLength / inputLength;
    
    // Boost confidence if the match covers most of the input
    return Math.min(0.5 + (coverage * 0.5), 1.0);
  }

  private async inferIntentFromContext(
    input: string, 
    context: ConversationContext
  ): Promise<Intent> {
    // Look at recent history to understand context
    const recentMessages = context.getRecentHistory(3);
    
    // If user seems to be responding to a question
    if (recentMessages.length > 0 && 
        recentMessages[recentMessages.length - 1].type === 'assistant') {
      // This might be a clarification or follow-up
      return {
        action: 'follow_up',
        parameters: {
          query: input,
          previousContext: recentMessages
        },
        confidence: 0.7,
        context
      };
    }
    
    // Default to generic query
    return {
      action: 'generic_query',
      parameters: {
        query: input
      },
      confidence: 0.5,
      context
    };
  }
}