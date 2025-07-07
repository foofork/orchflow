// SPARC Mode Types for OrchFlow
// Based on claude-code-flow's SPARC system

export interface SparcMode {
  name: string;
  description: string;
  icon: string;
  category: 'development' | 'testing' | 'design' | 'security' | 'documentation' | 'operations';
  priority: number;
  enabled: boolean;
  
  // Agent configuration for this mode
  agentConfig: {
    type: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
    tools?: string[];
  };
  
  // Mode-specific behavior
  behavior: {
    autoSuggest: boolean;
    requiresConfirmation: boolean;
    preserveContext: boolean;
    chainable: boolean;
  };
  
  // Success criteria
  successCriteria?: {
    requiredOutputs?: string[];
    validationRules?: Array<(output: string) => boolean>;
    minimumDuration?: number;
  };
  
  // Mode-specific commands
  commands?: {
    [key: string]: {
      description: string;
      execute: (args: string[]) => Promise<any>;
    };
  };
}

export interface ModeContext {
  mode: SparcMode;
  sessionId: string;
  startTime: Date;
  endTime?: Date;
  inputs: string[];
  outputs: string[];
  metadata: Record<string, any>;
  success?: boolean;
}

export interface ModeTransition {
  from: string;
  to: string;
  condition?: (context: ModeContext) => boolean;
  transform?: (context: ModeContext) => Record<string, any>;
}