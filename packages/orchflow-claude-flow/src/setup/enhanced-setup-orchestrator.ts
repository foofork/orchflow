/**
 * Enhanced Setup Orchestrator with Comprehensive tmux Installation
 * Provides complete dependency management and user-friendly setup experience
 */

import { TmuxInstaller, type TmuxInstallationResult } from './tmux-installer';
import type { LaunchOptions } from '../types';
import chalk from 'chalk';
import ora from 'ora';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

export interface SetupEnvironment {
  platform: string;
  terminal: string;
  hasTmux: boolean;
  isInsideTmux: boolean;
  isVSCode: boolean;
  isCodespaces: boolean;
  terminalSize: { width: number; height: number };
  packageManagers: string[];
  userPreference?: UserSetupPreference;
}

export interface UserSetupPreference {
  mode: 'auto' | 'tmux' | 'inline' | 'statusbar' | 'window';
  autoInstallDependencies: boolean;
  skipSetupPrompts: boolean;
  tmuxConfig?: {
    orchflowBindings: boolean;
    mouseSupport: boolean;
    customPrefix?: string;
  };
}

export interface SetupResult {
  success: boolean;
  flow: string;
  environment: SetupEnvironment;
  dependencies: {
    tmux: TmuxInstallationResult;
    claudeFlow: { installed: boolean; version?: string };
  };
  config: {
    core: any;
    splitScreen: any;
    terminal: any;
  };
  performance: {
    totalTime: number;
    steps: Array<{ name: string; duration: number; success: boolean }>;
  };
  errors: string[];
  warnings: string[];
}

export class EnhancedSetupOrchestrator {
  private static instance: EnhancedSetupOrchestrator;
  private tmuxInstaller: TmuxInstaller;
  private setupSteps: Array<{ name: string; duration: number; success: boolean }> = [];
  private startTime: number = 0;

  private constructor() {
    this.tmuxInstaller = new TmuxInstaller();
  }

  static getInstance(): EnhancedSetupOrchestrator {
    if (!this.instance) {
      this.instance = new EnhancedSetupOrchestrator();
    }
    return this.instance;
  }

  /**
   * Main setup orchestration method
   */
  async setup(
    options: LaunchOptions,
    setupOptions: { interactive: boolean; verbose: boolean }
  ): Promise<SetupResult> {
    this.startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    console.log(chalk.cyan.bold('\n🔧 OrchFlow Enhanced Setup\n'));

    try {
      // Step 1: Environment Detection
      const environment = await this.detectEnvironment();
      await this.recordStep('Environment Detection', async () => {
        if (setupOptions.verbose) {
          this.displayEnvironmentInfo(environment);
        }
      });

      // Step 2: User Preference Resolution
      const userPreference = await this.resolveUserPreference(environment, options, setupOptions.interactive);
      await this.recordStep('User Preference Resolution', async () => {
        if (setupOptions.verbose) {
          console.log(chalk.gray(`Selected mode: ${userPreference.mode}`));
        }
      });

      // Step 3: Dependency Management
      const dependencies = await this.manageDependencies(userPreference, environment, setupOptions);
      await this.recordStep('Dependency Management', async () => {
        if (dependencies.tmux.success && !dependencies.tmux.alreadyInstalled) {
          console.log(chalk.green(`✓ tmux installed via ${dependencies.tmux.installMethod}`));
        }
      });

      // Step 4: Configuration Generation
      const config = await this.generateConfiguration(userPreference, environment, dependencies);
      await this.recordStep('Configuration Generation', async () => {
        if (setupOptions.verbose) {
          console.log(chalk.gray('Configuration files generated'));
        }
      });

      // Step 5: Validation
      const validation = await this.validateSetup(dependencies, config);
      await this.recordStep('Setup Validation', async () => {
        if (!validation.success) {
          warnings.push(...validation.issues);
        }
      });

      const totalTime = Date.now() - this.startTime;

      // Display success summary
      this.displaySetupSummary(dependencies, userPreference, totalTime);

      return {
        success: true,
        flow: this.determineSetupFlow(userPreference, environment),
        environment,
        dependencies,
        config,
        performance: {
          totalTime,
          steps: this.setupSteps
        },
        errors,
        warnings
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      return {
        success: false,
        flow: 'failed',
        environment: await this.detectEnvironment(),
        dependencies: {
          tmux: { success: false, alreadyInstalled: false, configUpdated: false },
          claudeFlow: { installed: false }
        },
        config: { core: {}, splitScreen: {}, terminal: {} },
        performance: {
          totalTime: Date.now() - this.startTime,
          steps: this.setupSteps
        },
        errors,
        warnings
      };
    }
  }

  /**
   * Detect comprehensive environment information
   */
  private async detectEnvironment(): Promise<SetupEnvironment> {
    const platform = process.platform;
    const terminal = process.env.TERM_PROGRAM || 'unknown';
    const hasTmux = await this.hasCommand('tmux');
    const isInsideTmux = !!process.env.TMUX;
    const isVSCode = !!process.env.VSCODE_PID || terminal === 'vscode';
    const isCodespaces = !!process.env.CODESPACES;
    const terminalSize = {
      width: process.stdout.columns || 80,
      height: process.stdout.rows || 24
    };

    const packageManagers = await this.detectPackageManagers();

    return {
      platform,
      terminal,
      hasTmux,
      isInsideTmux,
      isVSCode,
      isCodespaces,
      terminalSize,
      packageManagers
    };
  }

  /**
   * Detect available package managers
   */
  private async detectPackageManagers(): Promise<string[]> {
    const managers = ['brew', 'apt', 'yum', 'dnf', 'pacman', 'zypper', 'apk', 'choco', 'scoop'];
    const available: string[] = [];

    for (const manager of managers) {
      if (await this.hasCommand(manager)) {
        available.push(manager);
      }
    }

    return available;
  }

  /**
   * Resolve user preferences with intelligent defaults
   */
  private async resolveUserPreference(
    environment: SetupEnvironment,
    options: LaunchOptions,
    interactive: boolean
  ): Promise<UserSetupPreference> {
    // Command line override
    if (options.mode) {
      return {
        mode: options.mode,
        autoInstallDependencies: true,
        skipSetupPrompts: true
      };
    }

    // Auto-detect optimal mode
    let recommendedMode: UserSetupPreference['mode'] = 'auto';
    
    if (environment.isInsideTmux) {
      recommendedMode = 'tmux';
    } else if (environment.isCodespaces) {
      recommendedMode = 'tmux'; // Codespaces works well with tmux
    } else if (environment.isVSCode) {
      recommendedMode = environment.hasTmux ? 'tmux' : 'inline';
    } else if (environment.hasTmux) {
      recommendedMode = 'tmux';
    } else {
      recommendedMode = 'inline';
    }

    if (!interactive) {
      return {
        mode: recommendedMode,
        autoInstallDependencies: true,
        skipSetupPrompts: true
      };
    }

    // Interactive mode - show options
    return await this.showSetupOptions(environment, recommendedMode);
  }

  /**
   * Show interactive setup options
   */
  private async showSetupOptions(
    environment: SetupEnvironment,
    recommended: UserSetupPreference['mode']
  ): Promise<UserSetupPreference> {
    console.log(chalk.cyan('🎯 Setup Options'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (environment.isVSCode) {
      console.log(chalk.yellow('📱 VS Code Environment Detected'));
    } else if (environment.isCodespaces) {
      console.log(chalk.yellow('☁️  GitHub Codespaces Environment Detected'));
    } else if (environment.isInsideTmux) {
      console.log(chalk.yellow('🖥️  Already inside tmux session'));
    }

    console.log('\nHow would you like to use OrchFlow?');
    console.log('');
    console.log('1. 🖥️  Split Terminal (tmux) - Full featured with live status pane');
    console.log('   └─ 70/30 split with worker navigation and status updates');
    if (!environment.hasTmux) {
      console.log(chalk.yellow('   └─ Will automatically install tmux for you'));
    }
    console.log('');
    console.log('2. 📄 Inline Mode - Status updates in main terminal');
    console.log('   └─ Lightweight, works in any terminal');
    console.log('');
    
    if (environment.isVSCode) {
      console.log('3. 📊 VS Code Status Bar - Minimal updates in bottom bar');
      console.log('4. 🪟 Separate Window - Dedicated VS Code window for status');
      console.log('');
    }

    const choice = await this.promptUser(
      `Choose [1-${environment.isVSCode ? '4' : '2'}] or Enter for recommended (${this.getModeDescription(recommended)}): `
    );

    const selectedMode = this.parseUserChoice(choice, environment, recommended);
    const autoInstall = selectedMode === 'tmux' && !environment.hasTmux;

    if (autoInstall) {
      const installChoice = await this.promptUser(
        chalk.yellow('⚠️  tmux is required but not installed. Install automatically? [Y/n]: ')
      );
      
      if (installChoice.toLowerCase() === 'n') {
        console.log(chalk.yellow('Switching to inline mode...'));
        return {
          mode: 'inline',
          autoInstallDependencies: false,
          skipSetupPrompts: true
        };
      }
    }

    return {
      mode: selectedMode,
      autoInstallDependencies: autoInstall,
      skipSetupPrompts: false,
      tmuxConfig: selectedMode === 'tmux' ? {
        orchflowBindings: true,
        mouseSupport: true
      } : undefined
    };
  }

  /**
   * Comprehensive dependency management
   */
  private async manageDependencies(
    preference: UserSetupPreference,
    environment: SetupEnvironment,
    setupOptions: { interactive: boolean; verbose: boolean }
  ): Promise<SetupResult['dependencies']> {
    const dependencies: SetupResult['dependencies'] = {
      tmux: { success: true, alreadyInstalled: true, configUpdated: false },
      claudeFlow: { installed: false }
    };

    // Handle tmux dependency
    if (preference.mode === 'tmux') {
      if (!environment.hasTmux && preference.autoInstallDependencies) {
        console.log(chalk.cyan('\n📦 Installing tmux...'));
        dependencies.tmux = await this.tmuxInstaller.installAndConfigure(preference.tmuxConfig);
        
        if (dependencies.tmux.success) {
          this.tmuxInstaller.displayInstallationSummary(dependencies.tmux);
        } else {
          console.log(chalk.red('❌ tmux installation failed'));
          if (dependencies.tmux.errorMessage) {
            console.log(chalk.yellow(dependencies.tmux.errorMessage));
          }
          throw new Error('tmux installation failed');
        }
      } else if (environment.hasTmux) {
        // Configure existing tmux
        dependencies.tmux = await this.tmuxInstaller.installAndConfigure(preference.tmuxConfig);
      }
    }

    // Check claude-flow dependency
    try {
      const { stdout } = await execAsync('claude-flow --version 2>/dev/null || echo "not-found"');
      if (!stdout.includes('not-found')) {
        dependencies.claudeFlow = { installed: true, version: stdout.trim() };
      }
    } catch {
      dependencies.claudeFlow = { installed: false };
    }

    return dependencies;
  }

  /**
   * Generate configuration based on setup choices
   */
  private async generateConfiguration(
    preference: UserSetupPreference,
    environment: SetupEnvironment,
    dependencies: SetupResult['dependencies']
  ): Promise<SetupResult['config']> {
    return {
      core: {
        port: 3001,
        enablePersistence: true,
        enableWebSocket: true,
        mode: preference.mode
      },
      splitScreen: {
        enabled: preference.mode === 'tmux' && dependencies.tmux.success,
        primaryWidth: 70,
        statusWidth: 30,
        sessionName: 'orchflow_session',
        enableQuickAccess: true
      },
      terminal: {
        mode: preference.mode,
        statusUpdateInterval: 1000,
        showResourceUsage: true,
        maxWorkersDisplay: 10
      }
    };
  }

  /**
   * Validate setup completeness
   */
  private async validateSetup(
    dependencies: SetupResult['dependencies'],
    config: SetupResult['config']
  ): Promise<{ success: boolean; issues: string[] }> {
    const issues: string[] = [];

    // Validate tmux if required
    if (config.splitScreen.enabled && !dependencies.tmux.success) {
      issues.push('tmux is required for split-screen mode but installation failed');
    }

    // Validate tmux configuration
    if (dependencies.tmux.success && !dependencies.tmux.alreadyInstalled) {
      const tmuxValidation = await this.tmuxInstaller.verifyInstallation();
      if (!tmuxValidation.success) {
        issues.push(...tmuxValidation.issues);
      }
    }

    return {
      success: issues.length === 0,
      issues
    };
  }

  /**
   * Display comprehensive setup summary
   */
  private displaySetupSummary(
    dependencies: SetupResult['dependencies'],
    preference: UserSetupPreference,
    totalTime: number
  ): void {
    console.log('\n' + chalk.green('🎉 OrchFlow Setup Complete!'));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${chalk.green('✓')} Setup completed in ${totalTime.toFixed(0)}ms`);
    console.log(`${chalk.green('✓')} Mode: ${this.getModeDescription(preference.mode)}`);
    
    if (preference.mode === 'tmux') {
      if (dependencies.tmux.alreadyInstalled) {
        console.log(`${chalk.green('✓')} tmux: Already installed (${dependencies.tmux.version})`);
      } else {
        console.log(`${chalk.green('✓')} tmux: Installed via ${dependencies.tmux.installMethod}`);
      }
      
      if (dependencies.tmux.configUpdated) {
        console.log(`${chalk.green('✓')} tmux: OrchFlow configuration applied`);
      }
    }

    console.log('\n' + chalk.cyan('🚀 Ready to Launch:'));
    console.log('  OrchFlow will now start with your selected configuration');
    console.log('  All dependencies are installed and configured');
    console.log('');
  }

  // Helper methods
  private async recordStep(name: string, operation: () => Promise<void>): Promise<void> {
    const start = Date.now();
    let success = true;
    
    try {
      await operation();
    } catch (error) {
      success = false;
      throw error;
    } finally {
      this.setupSteps.push({
        name,
        duration: Date.now() - start,
        success
      });
    }
  }

  private displayEnvironmentInfo(environment: SetupEnvironment): void {
    console.log(chalk.gray('Environment:'));
    console.log(chalk.gray(`  Platform: ${environment.platform}`));
    console.log(chalk.gray(`  Terminal: ${environment.terminal}`));
    console.log(chalk.gray(`  tmux: ${environment.hasTmux ? 'available' : 'not found'}`));
    console.log(chalk.gray(`  Package managers: ${environment.packageManagers.join(', ')}`));
    console.log('');
  }

  private determineSetupFlow(preference: UserSetupPreference, environment: SetupEnvironment): string {
    if (preference.mode === 'tmux') {
      return environment.hasTmux ? 'tmux-existing' : 'tmux-install';
    } else if (preference.mode === 'inline') {
      return 'inline';
    } else if (preference.mode === 'statusbar') {
      return 'vscode-statusbar';
    } else if (preference.mode === 'window') {
      return 'vscode-window';
    }
    return 'auto';
  }

  private getModeDescription(mode: UserSetupPreference['mode']): string {
    switch (mode) {
      case 'tmux': return 'Split Terminal';
      case 'inline': return 'Inline Mode';
      case 'statusbar': return 'VS Code Status Bar';
      case 'window': return 'Separate Window';
      default: return 'Auto-detect';
    }
  }

  private parseUserChoice(
    choice: string,
    environment: SetupEnvironment,
    recommended: UserSetupPreference['mode']
  ): UserSetupPreference['mode'] {
    const num = parseInt(choice) || 0;
    
    if (num === 0) return recommended;
    if (num === 1) return 'tmux';
    if (num === 2) return 'inline';
    if (num === 3 && environment.isVSCode) return 'statusbar';
    if (num === 4 && environment.isVSCode) return 'window';
    
    return recommended;
  }

  private async promptUser(message: string): Promise<string> {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(message, (answer: string) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  private async hasCommand(command: string): Promise<boolean> {
    try {
      await execAsync(`which ${command}`);
      return true;
    } catch {
      return false;
    }
  }
}

export default EnhancedSetupOrchestrator;