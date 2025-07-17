/**
 * Setup Flow Router - Environment-specific setup flows
 * Routes setup process based on detected environment
 */

import { TerminalEnvironment } from './terminal-environment-detector';
import { OrchFlowConfig } from '../types';

export type SetupFlow = 'tmux' | 'screen' | 'zellij' | 'native' | 'fallback';

export interface SetupFlowConfig {
  flow: SetupFlow;
  steps: SetupStep[];
  requirements: string[];
  capabilities: string[];
  performance: {
    estimatedTime: number;
    complexity: 'low' | 'medium' | 'high';
  };
}

export interface SetupStep {
  id: string;
  name: string;
  description: string;
  command?: string;
  validation?: () => Promise<boolean>;
  optional?: boolean;
  dependencies?: string[];
  environment?: {
    variables: Record<string, string>;
    paths: string[];
  };
}

export class SetupFlowRouter {
  private static instance: SetupFlowRouter;
  private flowConfigs: Map<SetupFlow, SetupFlowConfig> = new Map();

  private constructor() {
    this.initializeFlows();
  }

  static getInstance(): SetupFlowRouter {
    if (!SetupFlowRouter.instance) {
      SetupFlowRouter.instance = new SetupFlowRouter();
    }
    return SetupFlowRouter.instance;
  }

  /**
   * Route setup based on terminal environment
   */
  route(environment: TerminalEnvironment): SetupFlowConfig {
    const flow = this.determineOptimalFlow(environment);
    const config = this.flowConfigs.get(flow);
    
    if (!config) {
      throw new Error(`No configuration found for flow: ${flow}`);
    }

    return this.customizeForEnvironment(config, environment);
  }

  /**
   * Get all available flows
   */
  getAvailableFlows(): SetupFlow[] {
    return Array.from(this.flowConfigs.keys());
  }

  /**
   * Get flow configuration by name
   */
  getFlowConfig(flow: SetupFlow): SetupFlowConfig | undefined {
    return this.flowConfigs.get(flow);
  }

  /**
   * Validate flow compatibility with environment
   */
  validateFlow(flow: SetupFlow, environment: TerminalEnvironment): boolean {
    const config = this.flowConfigs.get(flow);
    if (!config) return false;

    // Check basic requirements
    if (flow === 'tmux' && environment.multiplexer !== 'tmux') {
      return false;
    }
    if (flow === 'screen' && environment.multiplexer !== 'screen') {
      return false;
    }
    if (flow === 'zellij' && environment.multiplexer !== 'zellij') {
      return false;
    }

    return true;
  }

  private determineOptimalFlow(environment: TerminalEnvironment): SetupFlow {
    // Priority order based on capabilities and performance
    const flowPriority: SetupFlow[] = ['tmux', 'zellij', 'screen', 'native', 'fallback'];

    for (const flow of flowPriority) {
      if (this.validateFlow(flow, environment)) {
        return flow;
      }
    }

    return 'fallback';
  }

  private customizeForEnvironment(config: SetupFlowConfig, environment: TerminalEnvironment): SetupFlowConfig {
    const customized = JSON.parse(JSON.stringify(config)) as SetupFlowConfig;

    // Customize steps based on environment
    customized.steps = customized.steps.map(step => {
      if (step.environment) {
        // Add platform-specific environment variables
        if (environment.platform === 'darwin') {
          step.environment.variables = {
            ...step.environment.variables,
            'ORCHFLOW_CLIPBOARD': 'pbcopy',
            'ORCHFLOW_PASTE': 'pbpaste'
          };
        } else if (environment.platform === 'linux') {
          step.environment.variables = {
            ...step.environment.variables,
            'ORCHFLOW_CLIPBOARD': 'xclip -selection clipboard',
            'ORCHFLOW_PASTE': 'xclip -selection clipboard -o'
          };
        }
      }

      return step;
    });

    return customized;
  }

  private initializeFlows(): void {
    this.flowConfigs.set('tmux', {
      flow: 'tmux',
      steps: [
        {
          id: 'check-tmux',
          name: 'Check tmux availability',
          description: 'Verify tmux is installed and accessible',
          command: 'tmux -V',
          validation: async () => {
            try {
              const { execSync } = await import('child_process');
              execSync('tmux -V', { stdio: 'ignore' });
              return true;
            } catch {
              return false;
            }
          }
        },
        {
          id: 'create-session',
          name: 'Create OrchFlow session',
          description: 'Create or attach to orchflow tmux session',
          command: 'tmux new-session -d -s orchflow -x 120 -y 40',
          dependencies: ['check-tmux'],
          environment: {
            variables: {
              'TMUX_SESSION': 'orchflow',
              'ORCHFLOW_LAYOUT': 'main-vertical'
            },
            paths: []
          }
        },
        {
          id: 'setup-layout',
          name: 'Setup split layout',
          description: 'Create 70/30 split layout for main/status',
          command: 'tmux split-window -h -p 30',
          dependencies: ['create-session']
        },
        {
          id: 'configure-status',
          name: 'Configure status pane',
          description: 'Setup status pane with OrchFlow monitoring',
          dependencies: ['setup-layout'],
          environment: {
            variables: {
              'ORCHFLOW_STATUS_PANE': '1'
            },
            paths: []
          }
        },
        {
          id: 'setup-keybindings',
          name: 'Setup key bindings',
          description: 'Configure tmux key bindings for OrchFlow',
          optional: true,
          dependencies: ['configure-status']
        }
      ],
      requirements: ['tmux'],
      capabilities: ['split-panes', 'sessions', 'status-bar', 'quick-commands'],
      performance: {
        estimatedTime: 3000,
        complexity: 'medium'
      }
    });

    this.flowConfigs.set('screen', {
      flow: 'screen',
      steps: [
        {
          id: 'check-screen',
          name: 'Check screen availability',
          description: 'Verify screen is installed and accessible',
          command: 'screen -v',
          validation: async () => {
            try {
              const { execSync } = await import('child_process');
              execSync('screen -v', { stdio: 'ignore' });
              return true;
            } catch {
              return false;
            }
          }
        },
        {
          id: 'create-session',
          name: 'Create OrchFlow session',
          description: 'Create or attach to orchflow screen session',
          command: 'screen -dmS orchflow',
          dependencies: ['check-screen']
        },
        {
          id: 'setup-layout',
          name: 'Setup split layout',
          description: 'Create vertical split for main/status',
          command: 'screen -S orchflow -X split -v',
          dependencies: ['create-session']
        },
        {
          id: 'configure-status',
          name: 'Configure status region',
          description: 'Setup status region with OrchFlow monitoring',
          dependencies: ['setup-layout']
        }
      ],
      requirements: ['screen'],
      capabilities: ['split-panes', 'sessions', 'status-bar'],
      performance: {
        estimatedTime: 2500,
        complexity: 'medium'
      }
    });

    this.flowConfigs.set('zellij', {
      flow: 'zellij',
      steps: [
        {
          id: 'check-zellij',
          name: 'Check zellij availability',
          description: 'Verify zellij is installed and accessible',
          command: 'zellij --version',
          validation: async () => {
            try {
              const { execSync } = await import('child_process');
              execSync('zellij --version', { stdio: 'ignore' });
              return true;
            } catch {
              return false;
            }
          }
        },
        {
          id: 'create-session',
          name: 'Create OrchFlow session',
          description: 'Create or attach to orchflow zellij session',
          command: 'zellij -s orchflow',
          dependencies: ['check-zellij']
        },
        {
          id: 'setup-layout',
          name: 'Setup split layout',
          description: 'Create horizontal split for main/status',
          command: 'zellij action new-pane -d right',
          dependencies: ['create-session']
        },
        {
          id: 'configure-status',
          name: 'Configure status pane',
          description: 'Setup status pane with OrchFlow monitoring',
          dependencies: ['setup-layout']
        }
      ],
      requirements: ['zellij'],
      capabilities: ['split-panes', 'sessions', 'status-bar', 'quick-commands'],
      performance: {
        estimatedTime: 2000,
        complexity: 'low'
      }
    });

    this.flowConfigs.set('native', {
      flow: 'native',
      steps: [
        {
          id: 'check-terminal',
          name: 'Check terminal capabilities',
          description: 'Verify terminal supports required features',
          validation: async () => true
        },
        {
          id: 'setup-environment',
          name: 'Setup environment',
          description: 'Configure environment variables for native mode',
          environment: {
            variables: {
              'ORCHFLOW_MODE': 'native',
              'ORCHFLOW_LAYOUT': 'single'
            },
            paths: []
          }
        },
        {
          id: 'start-services',
          name: 'Start OrchFlow services',
          description: 'Start core OrchFlow services in native mode',
          dependencies: ['setup-environment']
        }
      ],
      requirements: [],
      capabilities: ['colors', 'unicode'],
      performance: {
        estimatedTime: 1000,
        complexity: 'low'
      }
    });

    this.flowConfigs.set('fallback', {
      flow: 'fallback',
      steps: [
        {
          id: 'minimal-setup',
          name: 'Minimal setup',
          description: 'Basic OrchFlow setup with minimal features',
          validation: async () => true
        },
        {
          id: 'start-core',
          name: 'Start core services',
          description: 'Start essential OrchFlow services only',
          dependencies: ['minimal-setup']
        }
      ],
      requirements: [],
      capabilities: [],
      performance: {
        estimatedTime: 500,
        complexity: 'low'
      }
    });
  }
}

export default SetupFlowRouter;