/**
 * User Interaction Manager - Choice menus and user prompts
 * Optimized for terminal interactions with performance focus
 */

import type { Interface } from 'readline';
import { createInterface } from 'readline';
import chalk from 'chalk';
import type { TerminalEnvironment } from './terminal-environment-detector';
import type { SetupFlow, SetupFlowConfig } from './setup-flow-router';

export interface MenuOption {
  key: string;
  label: string;
  description?: string;
  value: any;
  disabled?: boolean;
  recommended?: boolean;
}

export interface MenuConfig {
  title: string;
  description?: string;
  options: MenuOption[];
  allowCancel?: boolean;
  defaultOption?: string;
  multiSelect?: boolean;
  validation?: (value: any) => string | null;
}

export interface ConfirmationConfig {
  message: string;
  defaultValue?: boolean;
  details?: string[];
}

export interface ProgressConfig {
  title: string;
  steps: string[];
  current: number;
  showPercentage?: boolean;
  showETA?: boolean;
}

export class UserInteractionManager {
  private static instance: UserInteractionManager;
  private readline?: Interface;
  private environment?: TerminalEnvironment;
  private interactionStartTime?: number;

  private constructor() {}

  static getInstance(): UserInteractionManager {
    if (!UserInteractionManager.instance) {
      UserInteractionManager.instance = new UserInteractionManager();
    }
    return UserInteractionManager.instance;
  }

  /**
   * Initialize with terminal environment
   */
  initialize(environment: TerminalEnvironment): void {
    this.environment = environment;
    this.readline = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true
    });

    // Setup signal handlers
    this.setupSignalHandlers();
  }

  /**
   * Display menu and get user selection
   */
  async showMenu(config: MenuConfig): Promise<any> {
    this.interactionStartTime = Date.now();

    if (!this.readline) {
      throw new Error('UserInteractionManager not initialized');
    }

    this.clearScreen();
    this.displayMenuHeader(config);

    if (config.multiSelect) {
      return this.handleMultiSelect(config);
    } else {
      return this.handleSingleSelect(config);
    }
  }

  /**
   * Show confirmation dialog
   */
  async showConfirmation(config: ConfirmationConfig): Promise<boolean> {
    this.interactionStartTime = Date.now();

    if (!this.readline) {
      throw new Error('UserInteractionManager not initialized');
    }

    this.displayConfirmationHeader(config);

    const defaultText = config.defaultValue ? 'Y/n' : 'y/N';
    const answer = await this.prompt(`${config.message} (${defaultText}): `);

    if (answer.trim() === '') {
      return config.defaultValue || false;
    }

    return answer.toLowerCase().startsWith('y');
  }

  /**
   * Show setup flow selection
   */
  async showSetupFlowSelection(
    flows: SetupFlow[],
    environment: TerminalEnvironment,
    configs: Map<SetupFlow, SetupFlowConfig>
  ): Promise<SetupFlow> {
    const options: MenuOption[] = flows.map(flow => {
      const config = configs.get(flow);
      const isRecommended = this.isRecommendedFlow(flow, environment);

      return {
        key: flow.charAt(0).toUpperCase(),
        label: this.getFlowLabel(flow),
        description: this.getFlowDescription(flow, config),
        value: flow,
        recommended: isRecommended
      };
    });

    const menuConfig: MenuConfig = {
      title: '🚀 Select Setup Flow',
      description: 'Choose the best setup flow for your terminal environment',
      options,
      allowCancel: false,
      defaultOption: options.find(o => o.recommended)?.key
    };

    return this.showMenu(menuConfig);
  }

  /**
   * Show environment detection results
   */
  async showEnvironmentSummary(environment: TerminalEnvironment): Promise<void> {
    console.log(chalk.cyan.bold('\n🔍 Terminal Environment Detection\n'));

    const info = [
      ['Platform', this.getPlatformDisplay(environment.platform)],
      ['Terminal', this.getTerminalDisplay(environment.terminal)],
      ['Multiplexer', this.getMultiplexerDisplay(environment.multiplexer)],
      ['Shell', this.getShellDisplay(environment.shell)],
      ['Capabilities', this.getCapabilitiesDisplay(environment.capabilities)]
    ];

    // Display as table
    const maxLabelWidth = Math.max(...info.map(([label]) => label.length));

    for (const [label, value] of info) {
      const paddedLabel = label.padEnd(maxLabelWidth);
      console.log(`  ${chalk.yellow(paddedLabel)}: ${value}`);
    }

    if (environment.session) {
      console.log(`  ${chalk.yellow('Session'.padEnd(maxLabelWidth))}: ${environment.session.name} ${environment.session.hasExisting ? '(existing)' : '(new)'}`);
    }

    console.log();
  }

  /**
   * Show progress indicator
   */
  showProgress(config: ProgressConfig): void {
    const percentage = Math.round((config.current / config.steps.length) * 100);
    const progressBar = this.createProgressBar(percentage);

    console.log(chalk.cyan.bold(`\n${config.title}`));
    console.log(`${progressBar} ${percentage}%`);
    console.log(`Step ${config.current}/${config.steps.length}: ${config.steps[config.current - 1]}`);

    if (config.showETA && this.interactionStartTime) {
      const elapsed = Date.now() - this.interactionStartTime;
      const eta = Math.round((elapsed / config.current) * (config.steps.length - config.current));
      console.log(`ETA: ${this.formatTime(eta)}`);
    }
  }

  /**
   * Show error message
   */
  showError(message: string, details?: string[]): void {
    console.log(chalk.red.bold('\n❌ Error'));
    console.log(chalk.red(`${message}\n`));

    if (details && details.length > 0) {
      console.log(chalk.yellow('Details:'));
      details.forEach(detail => {
        console.log(`  • ${detail}`);
      });
      console.log();
    }
  }

  /**
   * Show success message
   */
  showSuccess(message: string, details?: string[]): void {
    console.log(chalk.green.bold('\n✅ Success'));
    console.log(chalk.green(`${message}\n`));

    if (details && details.length > 0) {
      console.log(chalk.cyan('Details:'));
      details.forEach(detail => {
        console.log(`  • ${detail}`);
      });
      console.log();
    }
  }

  /**
   * Show warning message
   */
  showWarning(message: string, details?: string[]): void {
    console.log(chalk.yellow.bold('\n⚠️  Warning'));
    console.log(chalk.yellow(`${message}\n`));

    if (details && details.length > 0) {
      console.log(chalk.gray('Details:'));
      details.forEach(detail => {
        console.log(`  • ${detail}`);
      });
      console.log();
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.readline) {
      this.readline.close();
      this.readline = undefined;
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): { interactionTime: number } | null {
    if (!this.interactionStartTime) {return null;}

    return {
      interactionTime: Date.now() - this.interactionStartTime
    };
  }

  private async handleSingleSelect(config: MenuConfig): Promise<any> {
    const prompt = this.createMenuPrompt(config);

    while (true) {
      const answer = await this.prompt(prompt);

      if (answer.toLowerCase() === 'q' && config.allowCancel) {
        throw new Error('User cancelled operation');
      }

      const option = config.options.find(o =>
        o.key.toLowerCase() === answer.toLowerCase()
      );

      if (option) {
        if (option.disabled) {
          console.log(chalk.red('This option is not available'));
          continue;
        }

        if (config.validation) {
          const error = config.validation(option.value);
          if (error) {
            console.log(chalk.red(error));
            continue;
          }
        }

        return option.value;
      }

      console.log(chalk.red('Invalid selection. Please try again.'));
    }
  }

  private async handleMultiSelect(config: MenuConfig): Promise<any[]> {
    const selected: any[] = [];
    const prompt = this.createMenuPrompt(config, true);

    while (true) {
      const answer = await this.prompt(prompt);

      if (answer.toLowerCase() === 'done') {
        return selected;
      }

      if (answer.toLowerCase() === 'q' && config.allowCancel) {
        throw new Error('User cancelled operation');
      }

      const option = config.options.find(o =>
        o.key.toLowerCase() === answer.toLowerCase()
      );

      if (option) {
        if (option.disabled) {
          console.log(chalk.red('This option is not available'));
          continue;
        }

        const index = selected.indexOf(option.value);
        if (index >= 0) {
          selected.splice(index, 1);
          console.log(chalk.yellow(`Removed: ${option.label}`));
        } else {
          selected.push(option.value);
          console.log(chalk.green(`Added: ${option.label}`));
        }

        this.displaySelectedItems(selected, config.options);
      } else {
        console.log(chalk.red('Invalid selection. Please try again.'));
      }
    }
  }

  private displayMenuHeader(config: MenuConfig): void {
    console.log(chalk.cyan.bold(`\n${config.title}`));
    if (config.description) {
      console.log(chalk.gray(`${config.description}\n`));
    }

    config.options.forEach(option => {
      const key = chalk.yellow.bold(`[${option.key}]`);
      const label = option.disabled ? chalk.gray(option.label) : chalk.white(option.label);
      const recommended = option.recommended ? chalk.green(' (recommended)') : '';
      const description = option.description ? chalk.gray(` - ${option.description}`) : '';

      console.log(`  ${key} ${label}${recommended}${description}`);
    });

    console.log();
  }

  private displayConfirmationHeader(config: ConfirmationConfig): void {
    if (config.details && config.details.length > 0) {
      console.log(chalk.cyan.bold('\nDetails:'));
      config.details.forEach(detail => {
        console.log(`  • ${detail}`);
      });
      console.log();
    }
  }

  private createMenuPrompt(config: MenuConfig, multiSelect: boolean = false): string {
    let prompt = 'Select an option';

    if (config.defaultOption) {
      prompt += ` (default: ${config.defaultOption})`;
    }

    if (multiSelect) {
      prompt += ' (type "done" to finish)';
    }

    if (config.allowCancel) {
      prompt += ' (q to quit)';
    }

    return `${prompt}: `;
  }

  private displaySelectedItems(selected: any[], options: MenuOption[]): void {
    if (selected.length === 0) {
      console.log(chalk.gray('No items selected'));
      return;
    }

    console.log(chalk.cyan('Selected items:'));
    selected.forEach(value => {
      const option = options.find(o => o.value === value);
      if (option) {
        console.log(`  • ${option.label}`);
      }
    });
  }

  private async prompt(message: string): Promise<string> {
    return new Promise((resolve) => {
      this.readline!.question(message, resolve);
    });
  }

  private clearScreen(): void {
    if (this.environment?.capabilities.colors) {
      process.stdout.write('\x1b[2J\x1b[0f');
    }
  }

  private setupSignalHandlers(): void {
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\nOperation cancelled by user'));
      this.cleanup();
      process.exit(0);
    });
  }

  private isRecommendedFlow(flow: SetupFlow, environment: TerminalEnvironment): boolean {
    if (flow === environment.multiplexer) {return true;}
    if (flow === 'tmux' && environment.multiplexer === 'none' && environment.capabilities.splitPanes) {return true;}
    if (flow === 'native' && environment.multiplexer === 'none') {return true;}
    return false;
  }

  private getFlowLabel(flow: SetupFlow): string {
    const labels: Record<SetupFlow, string> = {
      'tmux': 'tmux (Full Features)',
      'screen': 'GNU Screen',
      'zellij': 'Zellij (Modern)',
      'native': 'Native Terminal',
      'fallback': 'Minimal Mode'
    };
    return labels[flow] || flow;
  }

  private getFlowDescription(flow: SetupFlow, config?: SetupFlowConfig): string {
    const descriptions: Record<SetupFlow, string> = {
      'tmux': 'Full split-screen with status pane and session management',
      'screen': 'Basic split-screen with session support',
      'zellij': 'Modern multiplexer with intuitive interface',
      'native': 'Single terminal window with basic features',
      'fallback': 'Minimal setup for limited environments'
    };

    let desc = descriptions[flow] || flow;

    if (config) {
      desc += ` (${config.performance.complexity} complexity, ~${config.performance.estimatedTime}ms)`;
    }

    return desc;
  }

  private getPlatformDisplay(platform: TerminalEnvironment['platform']): string {
    const displays: Record<string, string> = {
      'linux': chalk.blue('Linux'),
      'darwin': chalk.green('macOS'),
      'win32': chalk.cyan('Windows'),
      'unknown': chalk.gray('Unknown')
    };
    return displays[platform] || platform;
  }

  private getTerminalDisplay(terminal: TerminalEnvironment['terminal']): string {
    const displays: Record<string, string> = {
      'tmux': chalk.green('tmux'),
      'screen': chalk.blue('GNU Screen'),
      'zellij': chalk.magenta('Zellij'),
      'iterm2': chalk.yellow('iTerm2'),
      'alacritty': chalk.yellow('Alacritty'),
      'unknown': chalk.gray('Unknown')
    };
    return displays[terminal] || terminal;
  }

  private getMultiplexerDisplay(multiplexer: TerminalEnvironment['multiplexer']): string {
    const displays: Record<string, string> = {
      'tmux': chalk.green('tmux'),
      'screen': chalk.blue('GNU Screen'),
      'zellij': chalk.magenta('Zellij'),
      'none': chalk.gray('None')
    };
    return displays[multiplexer] || multiplexer;
  }

  private getShellDisplay(shell: TerminalEnvironment['shell']): string {
    const displays: Record<string, string> = {
      'bash': chalk.yellow('Bash'),
      'zsh': chalk.green('Zsh'),
      'fish': chalk.blue('Fish'),
      'powershell': chalk.cyan('PowerShell'),
      'unknown': chalk.gray('Unknown')
    };
    return displays[shell] || shell;
  }

  private getCapabilitiesDisplay(capabilities: TerminalEnvironment['capabilities']): string {
    const features: string[] = [];

    if (capabilities.splitPanes) {features.push(chalk.green('Split Panes'));}
    if (capabilities.tabs) {features.push(chalk.green('Tabs'));}
    if (capabilities.sessions) {features.push(chalk.green('Sessions'));}
    if (capabilities.colors) {features.push(chalk.green('Colors'));}
    if (capabilities.unicode) {features.push(chalk.green('Unicode'));}
    if (capabilities.mouse) {features.push(chalk.green('Mouse'));}
    if (capabilities.clipboard) {features.push(chalk.green('Clipboard'));}

    return features.join(', ') || chalk.gray('Basic');
  }

  private createProgressBar(percentage: number, width: number = 30): string {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;

    return chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
  }

  private formatTime(ms: number): string {
    if (ms < 1000) {return `${ms}ms`;}
    if (ms < 60000) {return `${Math.round(ms / 1000)}s`;}
    return `${Math.round(ms / 60000)}m`;
  }
}

export default UserInteractionManager;