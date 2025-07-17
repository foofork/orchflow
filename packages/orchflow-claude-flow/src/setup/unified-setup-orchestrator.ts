/**
 * Unified Setup Orchestrator - Combines features from both optimized and enhanced orchestrators
 * Supports performance tracking, tmux installation, and flexible return types
 */

import chalk from 'chalk';
import ora from 'ora';
import { performance } from 'perf_hooks';
import { promisify } from 'util';
import { exec } from 'child_process';
import type { TerminalEnvironment } from './terminal-environment-detector';
import { TerminalEnvironmentDetector } from './terminal-environment-detector';
import type { SetupFlow } from './setup-flow-router';
import { SetupFlowRouter, SetupFlowConfig } from './setup-flow-router';
import type { OrchFlowConfigFile } from '../managers/configuration-manager';
import { ConfigurationManager } from '../managers/configuration-manager';
import { UserInteractionManager } from './user-interaction-manager';
import { TmuxInstaller } from './tmux-installer';
import type { TmuxInstallerResult, UserSetupPreference } from '../types/unified-interfaces';
import type { LaunchOptions } from '../types';

const execAsync = promisify(exec);

// Unified result interface that supports both return types
export interface UnifiedSetupResult {
  success: boolean;
  flow: SetupFlow | string;
  environment: TerminalEnvironment | SetupEnvironment;
  config: OrchFlowConfigFile | {
    core: any;
    splitScreen: any;
    terminal: any;
  };
  performance: {
    totalTime: number;
    detectionTime?: number;
    configTime?: number;
    setupTime?: number;
    interactionTime?: number;
    steps?: Array<{ name: string; duration: number; success: boolean }>;
  };
  errors: string[];
  warnings: string[];
  // Enhanced orchestrator specific fields
  dependencies?: {
    tmux: TmuxInstallerResult;
    claudeFlow: { installed: boolean; version?: string };
  };
}

// Enhanced environment interface (from EnhancedSetupOrchestrator)
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


export interface SetupOptions {
  skipDetection?: boolean;
  skipConfirmation?: boolean;
  forceFlow?: SetupFlow;
  configPath?: string;
  interactive?: boolean;
  verbose?: boolean;
  // Enhanced options
  enableTmuxInstall?: boolean;
  autoInstallDependencies?: boolean;
}

export class UnifiedSetupOrchestrator {
  private static instance: UnifiedSetupOrchestrator;
  private detector: TerminalEnvironmentDetector;
  private router: SetupFlowRouter;
  private configManager: ConfigurationManager;
  private interactionManager: UserInteractionManager;
  private tmuxInstaller: TmuxInstaller;
  private performanceMetrics: Map<string, number> = new Map();
  private setupSteps: Array<{ name: string; duration: number; success: boolean }> = [];
  private _startTime: number = 0;

  private constructor() {
    this.detector = TerminalEnvironmentDetector.getInstance();
    this.router = SetupFlowRouter.getInstance();
    this.configManager = ConfigurationManager.getInstance();
    this.interactionManager = UserInteractionManager.getInstance();
    this.tmuxInstaller = new TmuxInstaller();
  }

  static getInstance(): UnifiedSetupOrchestrator {
    if (!UnifiedSetupOrchestrator.instance) {
      UnifiedSetupOrchestrator.instance = new UnifiedSetupOrchestrator();
    }
    return UnifiedSetupOrchestrator.instance;
  }

  /**
   * Main setup orchestration method - supports both styles
   */
  async setup(launchOptions: LaunchOptions = {}, setupOptions: SetupOptions = {}): Promise<UnifiedSetupResult> {
    const startTime = performance.now();
    this._startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Phase 1: Environment Detection (unified)
      const environment = await this.detectUnifiedEnvironment(setupOptions);

      // Phase 2: Configuration Loading
      const config = await this.loadConfiguration(launchOptions, setupOptions);

      // Phase 3: User Preference Resolution (if enhanced mode)
      let userPreference: UserSetupPreference | undefined;
      if (setupOptions.enableTmuxInstall || launchOptions.mode) {
        userPreference = await this.resolveUserPreference(
          environment as SetupEnvironment,
          launchOptions,
          setupOptions.interactive || false
        );
        (environment as SetupEnvironment).userPreference = userPreference;
      }

      // Phase 4: Flow Selection
      const flow = await this.selectSetupFlow(environment, config, setupOptions, userPreference);

      // Phase 5: User Interaction (if needed)
      if (setupOptions.interactive && !setupOptions.skipConfirmation) {
        await this.handleUserInteraction(environment, flow, config);
      }

      // Phase 6: Dependency Management (if enhanced mode)
      let dependencies: UnifiedSetupResult['dependencies'];
      if (userPreference && setupOptions.enableTmuxInstall) {
        dependencies = await this.manageDependencies(
          userPreference,
          environment as SetupEnvironment,
          setupOptions
        );

        // Update config based on dependencies
        if (dependencies?.tmux.success) {
          await this.updateConfigForTmux(config, userPreference);
        }
      }

      // Phase 7: Setup Execution
      await this.executeSetup(flow, environment, config, setupOptions);

      // Phase 8: Post-Setup Optimization
      await this.optimizeConfiguration(environment, config, setupOptions);

      const totalTime = performance.now() - startTime;

      // Display success summary if in enhanced mode
      if (dependencies && userPreference) {
        this.displaySetupSummary(dependencies, userPreference, totalTime);
      }

      return {
        success: true,
        flow,
        environment,
        config: this.getUnifiedConfig(config, userPreference),
        performance: this.collectPerformanceMetrics(totalTime),
        errors,
        warnings,
        dependencies
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);

      const totalTime = performance.now() - startTime;

      return {
        success: false,
        flow: 'fallback',
        environment: await this.detectUnifiedEnvironment({ skipDetection: true }),
        config: await this.getDefaultConfig(),
        performance: this.collectPerformanceMetrics(totalTime),
        errors,
        warnings,
        dependencies: setupOptions.enableTmuxInstall ? {
          tmux: { installed: false, success: false, alreadyInstalled: false, configUpdated: false },
          claudeFlow: { installed: false }
        } : undefined
      };
    }
  }

  /**
   * Quick setup for automated environments (from OptimizedSetupOrchestrator)
   */
  async quickSetup(launchOptions: LaunchOptions = {}): Promise<UnifiedSetupResult> {
    return this.setup(launchOptions, {
      skipDetection: false,
      skipConfirmation: true,
      interactive: false,
      verbose: false
    });
  }

  /**
   * Interactive setup with full user control (from OptimizedSetupOrchestrator)
   */
  async interactiveSetup(launchOptions: LaunchOptions = {}): Promise<UnifiedSetupResult> {
    return this.setup(launchOptions, {
      skipDetection: false,
      skipConfirmation: false,
      interactive: true,
      verbose: true,
      enableTmuxInstall: true,
      autoInstallDependencies: true
    });
  }

  /**
   * Validate current setup (from OptimizedSetupOrchestrator)
   */
  async validateSetup(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check environment
    const environment = await this.detector.detect();
    if (environment.terminal === 'unknown') {
      issues.push('Terminal type could not be detected');
    }

    // Check configuration
    const config = await this.configManager.load();
    const configErrors = this.configManager.validate(config);
    issues.push(...configErrors);

    // Check flow compatibility
    const availableFlows = this.router.getAvailableFlows();
    const compatibleFlows = availableFlows.filter(flow =>
      this.router.validateFlow(flow, environment)
    );

    if (compatibleFlows.length === 0) {
      issues.push('No compatible setup flows available');
    }

    // Check tmux installation
    const hasTmux = await this.hasCommand('tmux');
    if (!hasTmux) {
      const tmuxValidation = await this.tmuxInstaller.verifyInstallation();
      if (!tmuxValidation.success) {
        issues.push(...tmuxValidation.issues);
      }
    }

    // Generate recommendations
    if (environment.multiplexer === 'none' && environment.capabilities.splitPanes) {
      recommendations.push('Consider installing tmux for better terminal multiplexing');
    }

    if (!environment.capabilities.colors) {
      recommendations.push('Enable color support in your terminal for better experience');
    }

    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }

  /**
   * Get setup status (from OptimizedSetupOrchestrator)
   */
  async getSetupStatus(): Promise<{
    isSetup: boolean;
    flow: SetupFlow | null;
    environment: TerminalEnvironment;
    config: OrchFlowConfigFile;
    lastSetup: Date | null;
  }> {
    const environment = await this.detector.detect();
    const config = await this.configManager.load();

    // Check if setup was completed
    const setupCompleted = config.setup.preferredFlow !== undefined;

    return {
      isSetup: setupCompleted,
      flow: setupCompleted ? config.setup.preferredFlow : null,
      environment,
      config,
      lastSetup: null // TODO: Add timestamp tracking
    };
  }

  // Private methods combining both approaches

  private async detectUnifiedEnvironment(options: SetupOptions): Promise<TerminalEnvironment | SetupEnvironment> {
    const startTime = performance.now();

    if (options.skipDetection) {
      this.performanceMetrics.set('detectionTime', 0);
      return await this.detector.detect(true); // Use cached if available
    }

    if (options.verbose) {
      console.log(chalk.cyan('🔍 Detecting terminal environment...'));
    }

    const spinner = ora('Analyzing terminal capabilities').start();

    try {
      // Get base environment from detector
      const baseEnvironment = await this.detector.detect(false);

      // If enhanced features are needed, add extra detection
      if (options.enableTmuxInstall) {
        const platform = process.platform;
        const terminal = process.env.TERM_PROGRAM || baseEnvironment.terminal;
        const hasTmux = await this.hasCommand('tmux');
        const isInsideTmux = !!process.env.TMUX;
        const isVSCode = !!process.env.VSCODE_PID || terminal === 'vscode';
        const isCodespaces = !!process.env.CODESPACES;
        const terminalSize = {
          width: process.stdout.columns || 80,
          height: process.stdout.rows || 24
        };
        const packageManagers = await this.detectPackageManagers();

        const enhancedEnvironment: SetupEnvironment = {
          platform,
          terminal,
          hasTmux,
          isInsideTmux,
          isVSCode,
          isCodespaces,
          terminalSize,
          packageManagers
        };

        if (options.verbose) {
          this.displayEnvironmentInfo(enhancedEnvironment);
        }

        spinner.succeed('Environment detected');

        const detectionTime = performance.now() - startTime;
        this.performanceMetrics.set('detectionTime', detectionTime);

        return enhancedEnvironment;
      }

      if (options.verbose) {
        await this.interactionManager.showEnvironmentSummary(baseEnvironment);
      }

      spinner.succeed('Environment detected');

      const detectionTime = performance.now() - startTime;
      this.performanceMetrics.set('detectionTime', detectionTime);

      return baseEnvironment;

    } catch (error) {
      spinner.fail('Environment detection failed');
      throw error;
    }
  }

  private async loadConfiguration(
    launchOptions: LaunchOptions,
    setupOptions: SetupOptions
  ): Promise<OrchFlowConfigFile> {
    const startTime = performance.now();

    if (setupOptions.verbose) {
      console.log(chalk.cyan('📋 Loading configuration...'));
    }

    const spinner = ora('Loading configuration').start();

    try {
      // Load base configuration
      const _config = await this.configManager.load();

      // Apply launch options
      const launchConfig = this.configManager.createFromLaunchOptions(launchOptions);
      if (Object.keys(launchConfig).length > 0) {
        await this.configManager.updateConfig(launchConfig);
      }

      // Load custom config if specified
      if (setupOptions.configPath) {
        await this.configManager.importConfig(setupOptions.configPath);
      }

      spinner.succeed('Configuration loaded');

      const configTime = performance.now() - startTime;
      this.performanceMetrics.set('configTime', configTime);

      return await this.configManager.load();

    } catch (error) {
      spinner.fail('Configuration loading failed');
      throw error;
    }
  }

  private async selectSetupFlow(
    environment: TerminalEnvironment | SetupEnvironment,
    config: OrchFlowConfigFile,
    options: SetupOptions,
    userPreference?: UserSetupPreference
  ): Promise<SetupFlow | string> {
    // Use forced flow if specified
    if (options.forceFlow) {
      if (this.router.validateFlow(options.forceFlow, environment as TerminalEnvironment)) {
        return options.forceFlow;
      } else {
        throw new Error(`Forced flow '${options.forceFlow}' is not compatible with current environment`);
      }
    }

    // If user preference exists (enhanced mode), use it
    if (userPreference) {
      return this.determineSetupFlow(
        userPreference,
        environment as SetupEnvironment
      );
    }

    // Use configured preferred flow if auto-detect is disabled
    if (!config.setup.autoDetect) {
      return config.setup.preferredFlow;
    }

    // Auto-detect optimal flow
    const flowConfig = this.router.route(environment as TerminalEnvironment);
    return flowConfig.flow;
  }

  private async handleUserInteraction(
    environment: TerminalEnvironment | SetupEnvironment,
    _flow: SetupFlow | string,
    _config: OrchFlowConfigFile
  ): Promise<void> {
    const startTime = performance.now();

    this.interactionManager.initialize(environment as TerminalEnvironment);

    try {
      // Show environment summary
      if ('capabilities' in environment) {
        await this.interactionManager.showEnvironmentSummary(environment);
      } else {
        console.log(chalk.cyan('🔧 Environment Details:'));
        this.displayEnvironmentInfo(environment);
      }

      // Show selected flow
      if (typeof _flow === 'string' && this.router.getFlowConfig(_flow as SetupFlow)) {
        const flowConfig = this.router.getFlowConfig(_flow as SetupFlow);
        if (flowConfig) {
          console.log(chalk.green(`\n✅ Selected setup flow: ${_flow}`));
          console.log(chalk.gray(`Estimated time: ${flowConfig.performance.estimatedTime}ms`));
          console.log(chalk.gray(`Complexity: ${flowConfig.performance.complexity}`));
        }
      } else {
        console.log(chalk.green(`\n✅ Selected setup flow: ${_flow}`));
      }

      // Confirm setup
      const details = 'terminal' in environment
        ? [`Terminal: ${environment.terminal}`, `Setup flow: ${_flow}`]
        : [`Platform: ${(environment as SetupEnvironment).platform}`, `Terminal: ${(environment as SetupEnvironment).terminal}`, `Setup flow: ${_flow}`];

      const confirmSetup = await this.interactionManager.showConfirmation({
        message: 'Proceed with setup?',
        defaultValue: true,
        details
      });

      if (!confirmSetup) {
        throw new Error('Setup cancelled by user');
      }

      const interactionTime = performance.now() - startTime;
      this.performanceMetrics.set('interactionTime', interactionTime);

    } finally {
      this.interactionManager.cleanup();
    }
  }

  private async executeSetup(
    flow: SetupFlow | string,
    _environment: TerminalEnvironment | SetupEnvironment,
    _config: OrchFlowConfigFile,
    options: SetupOptions
  ): Promise<void> {
    const startTime = performance.now();

    if (options.verbose) {
      console.log(chalk.cyan(`🚀 Executing ${flow} setup...`));
    }

    // Try to get flow config from router
    const flowConfig = typeof flow === 'string'
      ? this.router.getFlowConfig(flow as SetupFlow)
      : null;

    if (flowConfig) {
      // Execute structured flow steps
      for (let i = 0; i < flowConfig.steps.length; i++) {
        const step = flowConfig.steps[i];

        if (options.verbose) {
          this.interactionManager.showProgress({
            title: `Setting up ${flow}`,
            steps: flowConfig.steps.map(s => s.name),
            current: i + 1,
            showPercentage: true,
            showETA: true
          });
        }

        await this.executeSetupStep(step, options);
      }
    } else {
      // Execute custom flow (from enhanced orchestrator)
      if (options.verbose) {
        console.log(chalk.gray(`Executing custom flow: ${flow}`));
      }
    }

    const setupTime = performance.now() - startTime;
    this.performanceMetrics.set('setupTime', setupTime);
  }

  private async executeSetupStep(
    step: any,
    options: SetupOptions
  ): Promise<void> {
    const spinner = ora(`${step.name}: ${step.description}`).start();

    try {
      // Check dependencies
      if (step.dependencies) {
        for (const _dep of step.dependencies) {
          // Dependency validation logic
        }
      }

      // Execute step command
      if (step.command) {
        const { execSync } = await import('child_process');
        execSync(step.command, {
          stdio: options.verbose ? 'inherit' : 'ignore',
          env: { ...process.env, ...step.environment?.variables }
        });
      }

      // Run validation
      if (step.validation) {
        const isValid = await step.validation();
        if (!isValid) {
          throw new Error(`Step validation failed: ${step.name}`);
        }
      }

      spinner.succeed(`${step.name} completed`);

    } catch (error) {
      if (step.optional) {
        spinner.warn(`${step.name} skipped (optional)`);
      } else {
        spinner.fail(`${step.name} failed`);
        throw error;
      }
    }
  }

  private async optimizeConfiguration(
    environment: TerminalEnvironment | SetupEnvironment,
    _config: OrchFlowConfigFile,
    options: SetupOptions
  ): Promise<void> {
    if (options.verbose) {
      console.log(chalk.cyan('⚡ Optimizing configuration...'));
    }

    const spinner = ora('Optimizing for environment').start();

    try {
      if ('capabilities' in environment) {
        await this.configManager.optimizeForEnvironment(environment);
      }
      spinner.succeed('Configuration optimized');
    } catch (error) {
      spinner.warn('Configuration optimization failed');
      // Non-critical error, continue
    }
  }

  // Enhanced orchestrator specific methods

  private async resolveUserPreference(
    environment: SetupEnvironment,
    options: LaunchOptions,
    interactive: boolean
  ): Promise<UserSetupPreference> {
    // Command line override
    if (options.mode) {
      const validModes = ['auto', 'tmux', 'inline', 'statusbar', 'window'] as const;
      const mode = validModes.includes(options.mode as any) ? options.mode as UserSetupPreference['mode'] : 'auto';
      return {
        mode,
        autoInstallDependencies: true,
        skipSetupPrompts: true
      };
    }

    // Auto-detect optimal mode
    let recommendedMode: UserSetupPreference['mode'] = 'auto';

    if (environment.isInsideTmux) {
      recommendedMode = 'tmux';
    } else if (environment.isCodespaces) {
      recommendedMode = 'tmux';
    } else if (environment.isVSCode) {
      recommendedMode = environment.hasTmux ? 'tmux' : 'inline';
    } else if (environment.hasTmux) {
      recommendedMode = 'tmux';
    } else {
      recommendedMode = 'inline';
    }

    if (!interactive) {
      return {
        mode: recommendedMode as UserSetupPreference['mode'],
        autoInstallDependencies: true,
        skipSetupPrompts: true
      };
    }

    // Interactive mode - show options
    return await this.showSetupOptions(environment, recommendedMode);
  }

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
      mode: selectedMode as UserSetupPreference['mode'],
      autoInstallDependencies: autoInstall,
      skipSetupPrompts: false,
      tmuxConfig: selectedMode === 'tmux' ? {
        orchflowBindings: true,
        mouseSupport: true
      } : undefined
    };
  }

  private async manageDependencies(
    preference: UserSetupPreference,
    environment: SetupEnvironment,
    _setupOptions: SetupOptions
  ): Promise<UnifiedSetupResult['dependencies']> {
    const dependencies: UnifiedSetupResult['dependencies'] = {
      tmux: { installed: true, success: true, alreadyInstalled: true, configUpdated: false },
      claudeFlow: { installed: false }
    };

    // Handle tmux dependency
    if (preference.mode === 'tmux') {
      if (!environment.hasTmux && preference.autoInstallDependencies) {
        console.log(chalk.cyan('\n📦 Installing tmux...'));

        await this.recordStep('tmux Installation', async () => {
          dependencies.tmux = await this.tmuxInstaller.installAndConfigure(preference.tmuxConfig);
        });

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
        await this.recordStep('tmux Configuration', async () => {
          dependencies.tmux = await this.tmuxInstaller.installAndConfigure(preference.tmuxConfig);
        });
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

  private async updateConfigForTmux(
    _config: OrchFlowConfigFile,
    preference: UserSetupPreference
  ): Promise<void> {
    if (preference.mode === 'tmux') {
      const updates = {
        terminal: {
          multiplexer: 'tmux' as const,
          sessionName: 'orchflow_session'
        },
        ui: {
          theme: 'auto' as const,
          statusPane: {
            enabled: true,
            width: 30,
            updateInterval: 1000
          },
          keybindings: {}
        },
        splitScreen: {
          enabled: true,
          primaryWidth: 70,
          statusWidth: 30,
          enableQuickAccess: true
        }
      };

      await this.configManager.updateConfig(updates);
    }
  }

  private getUnifiedConfig(
    config: OrchFlowConfigFile,
    userPreference?: UserSetupPreference
  ): OrchFlowConfigFile | UnifiedSetupResult['config'] {
    if (!userPreference) {
      return config;
    }

    // Return enhanced config format
    return {
      core: {
        port: (config as any).server?.port || 3000,
        enablePersistence: (config as any).persistence?.enabled || false,
        enableWebSocket: (config as any).server?.enableWebSocket || false,
        mode: userPreference.mode,
        storageDir: (config as any).core?.storageDir || '.orchflow',
        maxWorkers: (config as any).core?.maxWorkers || 4
      },
      splitScreen: {
        enabled: userPreference.mode === 'tmux',
        primaryWidth: 70,
        statusWidth: 30,
        sessionName: (config as any).terminal?.sessionName || 'orchflow_session',
        enableQuickAccess: true
      },
      terminal: {
        mode: userPreference.mode,
        statusUpdateInterval: 1000,
        showResourceUsage: (config as any).ui?.showResourceUsage || true,
        maxWorkersDisplay: (config as any).ui?.maxWorkersDisplay || 10
      }
    } as UnifiedSetupResult['config'];
  }

  private async getDefaultConfig(): Promise<UnifiedSetupResult['config']> {
    const config = await this.configManager.load();
    return {
      core: {
        port: (config as any).server?.port || 3000,
        enablePersistence: (config as any).persistence?.enabled || false,
        enableWebSocket: (config as any).server?.enableWebSocket || false,
        mode: 'auto'
      },
      splitScreen: {
        enabled: false,
        primaryWidth: 70,
        statusWidth: 30,
        sessionName: 'orchflow_session',
        enableQuickAccess: false
      },
      terminal: {
        mode: 'auto',
        statusUpdateInterval: 1000,
        showResourceUsage: true,
        maxWorkersDisplay: 10
      }
    };
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

  private collectPerformanceMetrics(totalTime: number): UnifiedSetupResult['performance'] {
    return {
      totalTime,
      detectionTime: this.performanceMetrics.get('detectionTime') || 0,
      configTime: this.performanceMetrics.get('configTime') || 0,
      setupTime: this.performanceMetrics.get('setupTime') || 0,
      interactionTime: this.performanceMetrics.get('interactionTime') || 0,
      steps: this.setupSteps.length > 0 ? this.setupSteps : undefined
    };
  }

  private displayEnvironmentInfo(environment: SetupEnvironment): void {
    console.log(chalk.gray('Environment:'));
    console.log(chalk.gray(`  Platform: ${environment.platform}`));
    console.log(chalk.gray(`  Terminal: ${environment.terminal}`));
    console.log(chalk.gray(`  tmux: ${environment.hasTmux ? 'available' : 'not found'}`));
    if (environment.packageManagers.length > 0) {
      console.log(chalk.gray(`  Package managers: ${environment.packageManagers.join(', ')}`));
    }
    console.log('');
  }

  private displaySetupSummary(
    dependencies: UnifiedSetupResult['dependencies'],
    preference: UserSetupPreference,
    totalTime: number
  ): void {
    console.log(`\n${  chalk.green('🎉 OrchFlow Setup Complete!')}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`${chalk.green('✓')} Setup completed in ${totalTime.toFixed(0)}ms`);
    console.log(`${chalk.green('✓')} Mode: ${this.getModeDescription(preference.mode)}`);

    if (dependencies && preference.mode === 'tmux') {
      if (dependencies.tmux.alreadyInstalled) {
        console.log(`${chalk.green('✓')} tmux: Already installed (${dependencies.tmux.version})`);
      } else {
        console.log(`${chalk.green('✓')} tmux: Installed via ${dependencies.tmux.installMethod}`);
      }

      if (dependencies.tmux.configUpdated) {
        console.log(`${chalk.green('✓')} tmux: OrchFlow configuration applied`);
      }
    }

    console.log(`\n${  chalk.cyan('🚀 Ready to Launch:')}`);
    console.log('  OrchFlow will now start with your selected configuration');
    console.log('  All dependencies are installed and configured');
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

    if (num === 0) {return recommended;}
    if (num === 1) {return 'tmux';}
    if (num === 2) {return 'inline';}
    if (num === 3 && environment.isVSCode) {return 'statusbar';}
    if (num === 4 && environment.isVSCode) {return 'window';}

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
}

export default UnifiedSetupOrchestrator;