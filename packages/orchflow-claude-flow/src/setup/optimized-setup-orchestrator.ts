/**
 * Optimized Setup Orchestrator - Main setup flow coordination
 * Integrates all setup components with performance optimization
 */

import chalk from 'chalk';
import ora from 'ora';
import { performance } from 'perf_hooks';
import { TerminalEnvironmentDetector, TerminalEnvironment } from './terminal-environment-detector';
import { SetupFlowRouter, SetupFlow, SetupFlowConfig } from './setup-flow-router';
import { OrchFlowConfigManager, OrchFlowConfigFile } from './orchflow-config-manager';
import { UserInteractionManager } from './user-interaction-manager';
import { LaunchOptions } from '../types';

export interface SetupResult {
  success: boolean;
  flow: SetupFlow;
  environment: TerminalEnvironment;
  config: OrchFlowConfigFile;
  performance: {
    totalTime: number;
    detectionTime: number;
    configTime: number;
    setupTime: number;
    interactionTime: number;
  };
  errors: string[];
  warnings: string[];
}

export interface SetupOptions {
  skipDetection?: boolean;
  skipConfirmation?: boolean;
  forceFlow?: SetupFlow;
  configPath?: string;
  interactive?: boolean;
  verbose?: boolean;
}

export class OptimizedSetupOrchestrator {
  private static instance: OptimizedSetupOrchestrator;
  private detector: TerminalEnvironmentDetector;
  private router: SetupFlowRouter;
  private configManager: OrchFlowConfigManager;
  private interactionManager: UserInteractionManager;
  private performanceMetrics: Map<string, number> = new Map();

  private constructor() {
    this.detector = TerminalEnvironmentDetector.getInstance();
    this.router = SetupFlowRouter.getInstance();
    this.configManager = OrchFlowConfigManager.getInstance();
    this.interactionManager = UserInteractionManager.getInstance();
  }

  static getInstance(): OptimizedSetupOrchestrator {
    if (!OptimizedSetupOrchestrator.instance) {
      OptimizedSetupOrchestrator.instance = new OptimizedSetupOrchestrator();
    }
    return OptimizedSetupOrchestrator.instance;
  }

  /**
   * Main setup orchestration method
   */
  async setup(launchOptions: LaunchOptions = {}, setupOptions: SetupOptions = {}): Promise<SetupResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Phase 1: Environment Detection
      const environment = await this.detectEnvironment(setupOptions);
      
      // Phase 2: Configuration Loading
      const config = await this.loadConfiguration(launchOptions, setupOptions);
      
      // Phase 3: Flow Selection
      const flow = await this.selectSetupFlow(environment, config, setupOptions);
      
      // Phase 4: User Interaction (if needed)
      if (setupOptions.interactive && !setupOptions.skipConfirmation) {
        await this.handleUserInteraction(environment, flow, config);
      }
      
      // Phase 5: Setup Execution
      await this.executeSetup(flow, environment, config, setupOptions);
      
      // Phase 6: Post-Setup Optimization
      await this.optimizeConfiguration(environment, config, setupOptions);
      
      const totalTime = performance.now() - startTime;
      
      return {
        success: true,
        flow,
        environment,
        config,
        performance: this.collectPerformanceMetrics(totalTime),
        errors,
        warnings
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push(errorMessage);
      
      const totalTime = performance.now() - startTime;
      
      return {
        success: false,
        flow: 'fallback',
        environment: await this.detector.detect(),
        config: await this.configManager.load(),
        performance: this.collectPerformanceMetrics(totalTime),
        errors,
        warnings
      };
    }
  }

  /**
   * Quick setup for automated environments
   */
  async quickSetup(launchOptions: LaunchOptions = {}): Promise<SetupResult> {
    return this.setup(launchOptions, {
      skipDetection: false,
      skipConfirmation: true,
      interactive: false,
      verbose: false
    });
  }

  /**
   * Interactive setup with full user control
   */
  async interactiveSetup(launchOptions: LaunchOptions = {}): Promise<SetupResult> {
    return this.setup(launchOptions, {
      skipDetection: false,
      skipConfirmation: false,
      interactive: true,
      verbose: true
    });
  }

  /**
   * Validate current setup
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
   * Get setup status
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

  private async detectEnvironment(options: SetupOptions): Promise<TerminalEnvironment> {
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
      const environment = await this.detector.detect(false);
      
      if (options.verbose) {
        await this.interactionManager.showEnvironmentSummary(environment);
      }
      
      spinner.succeed('Environment detected');
      
      const detectionTime = performance.now() - startTime;
      this.performanceMetrics.set('detectionTime', detectionTime);
      
      return environment;
      
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
      const config = await this.configManager.load();
      
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
    environment: TerminalEnvironment,
    config: OrchFlowConfigFile,
    options: SetupOptions
  ): Promise<SetupFlow> {
    // Use forced flow if specified
    if (options.forceFlow) {
      if (this.router.validateFlow(options.forceFlow, environment)) {
        return options.forceFlow;
      } else {
        throw new Error(`Forced flow '${options.forceFlow}' is not compatible with current environment`);
      }
    }
    
    // Use configured preferred flow if auto-detect is disabled
    if (!config.setup.autoDetect) {
      return config.setup.preferredFlow;
    }
    
    // Auto-detect optimal flow
    const flowConfig = this.router.route(environment);
    return flowConfig.flow;
  }

  private async handleUserInteraction(
    environment: TerminalEnvironment,
    flow: SetupFlow,
    config: OrchFlowConfigFile
  ): Promise<void> {
    const startTime = performance.now();
    
    this.interactionManager.initialize(environment);
    
    try {
      // Show environment summary
      await this.interactionManager.showEnvironmentSummary(environment);
      
      // Show selected flow
      const flowConfig = this.router.getFlowConfig(flow);
      if (flowConfig) {
        console.log(chalk.green(`\n✅ Selected setup flow: ${flow}`));
        console.log(chalk.gray(`Estimated time: ${flowConfig.performance.estimatedTime}ms`));
        console.log(chalk.gray(`Complexity: ${flowConfig.performance.complexity}`));
      }
      
      // Confirm setup
      const confirmSetup = await this.interactionManager.showConfirmation({
        message: 'Proceed with setup?',
        defaultValue: true,
        details: [
          `Terminal: ${environment.terminal}`,
          `Multiplexer: ${environment.multiplexer}`,
          `Setup flow: ${flow}`
        ]
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
    flow: SetupFlow,
    environment: TerminalEnvironment,
    config: OrchFlowConfigFile,
    options: SetupOptions
  ): Promise<void> {
    const startTime = performance.now();
    
    if (options.verbose) {
      console.log(chalk.cyan(`🚀 Executing ${flow} setup...`));
    }
    
    const flowConfig = this.router.getFlowConfig(flow);
    if (!flowConfig) {
      throw new Error(`No configuration found for flow: ${flow}`);
    }
    
    // Execute setup steps
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
      
      const spinner = ora(`${step.name}: ${step.description}`).start();
      
      try {
        // Check dependencies
        if (step.dependencies) {
          for (const dep of step.dependencies) {
            const depStep = flowConfig.steps.find(s => s.id === dep);
            if (!depStep) {
              throw new Error(`Missing dependency: ${dep}`);
            }
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
    
    const setupTime = performance.now() - startTime;
    this.performanceMetrics.set('setupTime', setupTime);
  }

  private async optimizeConfiguration(
    environment: TerminalEnvironment,
    config: OrchFlowConfigFile,
    options: SetupOptions
  ): Promise<void> {
    if (options.verbose) {
      console.log(chalk.cyan('⚡ Optimizing configuration...'));
    }
    
    const spinner = ora('Optimizing for environment').start();
    
    try {
      await this.configManager.optimizeForEnvironment(environment);
      spinner.succeed('Configuration optimized');
    } catch (error) {
      spinner.warn('Configuration optimization failed');
      // Non-critical error, continue
    }
  }

  private collectPerformanceMetrics(totalTime: number): SetupResult['performance'] {
    return {
      totalTime,
      detectionTime: this.performanceMetrics.get('detectionTime') || 0,
      configTime: this.performanceMetrics.get('configTime') || 0,
      setupTime: this.performanceMetrics.get('setupTime') || 0,
      interactionTime: this.performanceMetrics.get('interactionTime') || 0
    };
  }
}

export default OptimizedSetupOrchestrator;