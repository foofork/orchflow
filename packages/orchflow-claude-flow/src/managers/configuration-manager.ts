/**
 * Unified Configuration Manager
 * Combines features from OrchFlowConfigManager and CachedConfigManager
 * Provides centralized configuration management with caching and validation
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import * as path from 'path';
import * as os from 'os';
import { parse, stringify } from 'yaml';
import { LRUCache } from 'lru-cache';
import type { OrchFlowConfig, LaunchOptions } from '../types';
import type { OrchFlowConfig as CoreOrchFlowConfig } from '../core/orchflow-core';
import type { TerminalEnvironment } from '../setup/terminal-environment-detector';
import type { SetupFlow } from '../setup/setup-flow-router';

export interface OrchFlowConfigFile {
  version: string;
  core: CoreOrchFlowConfig;
  setup: {
    preferredFlow: SetupFlow;
    autoDetect: boolean;
    skipConfirmation: boolean;
    customCommands: Record<string, string>;
  };
  ui: {
    theme: 'dark' | 'light' | 'auto';
    statusPane: {
      enabled: boolean;
      width: number;
      updateInterval: number;
    };
    keybindings: Record<string, string>;
  };
  performance: {
    enableCaching: boolean;
    maxWorkers: number;
    memoryLimit: number;
    timeoutMs: number;
  };
  plugins: {
    enabled: string[];
    config: Record<string, any>;
  };
}

/**
 * Unified ConfigurationManager with caching and performance optimization
 */
export class ConfigurationManager {
  private static instance: ConfigurationManager;
  private configPath: string;
  private config?: OrchFlowConfigFile;
  private configDir: string;
  private defaultConfig: OrchFlowConfigFile;

  // Caching features from CachedConfigManager
  private cache: LRUCache<string, any>;
  private loadedConfigs: Set<string> = new Set();

  private constructor() {
    this.configDir = join(homedir(), '.orchflow');
    this.configPath = join(this.configDir, 'config.yaml');
    this.defaultConfig = this.createDefaultConfig();

    // Initialize cache
    this.cache = new LRUCache<string, any>({
      max: 100,
      ttl: 300000, // 5 minutes
      allowStale: true,
      updateAgeOnGet: true
    });
  }

  static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Load configuration from file or create default (with caching)
   */
  async load(): Promise<OrchFlowConfigFile> {
    const startTime = performance.now();

    // Check cache first
    const cacheKey = 'main-config';
    const cached = this.cache.get(cacheKey);
    if (cached) {
      const loadTime = performance.now() - startTime;
      if (loadTime < 5) { // Sub-5ms cache hit
        this.config = cached;
        return cached;
      }
    }

    try {
      if (existsSync(this.configPath)) {
        const configContent = readFileSync(this.configPath, 'utf8');
        const loadedConfig = parse(configContent) as OrchFlowConfigFile;
        this.config = this.mergeWithDefaults(loadedConfig);
      } else {
        this.config = this.defaultConfig;
        await this.save();
      }

      // Cache the loaded config
      this.cache.set(cacheKey, this.config);
      this.loadedConfigs.add(cacheKey);

      const loadTime = performance.now() - startTime;
      if (loadTime > 50) {
        console.warn(`Config loaded in ${loadTime.toFixed(2)}ms (target: <50ms)`);
      }

      return this.config;
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
      this.config = this.defaultConfig;
      return this.config;
    }
  }

  /**
   * Load named configuration file (with caching)
   */
  async loadNamedConfig(configName: string): Promise<any> {
    const startTime = performance.now();

    // Check cache first
    const cached = this.cache.get(configName);
    if (cached) {
      const loadTime = performance.now() - startTime;
      if (loadTime < 5) { // Sub-5ms cache hit
        return cached;
      }
    }

    // Lazy load only if not already loaded
    if (!this.loadedConfigs.has(configName)) {
      const config = await this.loadConfigFromDisk(configName);
      this.cache.set(configName, config);
      this.loadedConfigs.add(configName);

      const loadTime = performance.now() - startTime;
      if (loadTime > 50) {
        console.warn(`Config ${configName} loaded in ${loadTime.toFixed(2)}ms (target: <50ms)`);
      }

      return config;
    }

    return this.cache.get(configName);
  }

  private async loadConfigFromDisk(configName: string): Promise<any> {
    const configPath = join(this.configDir, `${configName}.yaml`);

    if (!existsSync(configPath)) {
      // Try JSON format
      const jsonPath = join(this.configDir, `${configName}.json`);
      if (existsSync(jsonPath)) {
        const content = readFileSync(jsonPath, 'utf-8');
        return JSON.parse(content);
      }
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      return parse(content);
    } catch (error) {
      console.warn(`Failed to load config ${configName}:`, error);
      return null;
    }
  }

  /**
   * Save configuration to file
   */
  async save(): Promise<void> {
    if (!this.config) {
      throw new Error('No configuration to save');
    }

    try {
      // Ensure config directory exists
      if (!existsSync(this.configDir)) {
        mkdirSync(this.configDir, { recursive: true });
      }

      const configContent = stringify(this.config, {
        indent: 2,
        lineWidth: 120,
        minContentWidth: 40
      });

      writeFileSync(this.configPath, configContent, 'utf8');

      // Invalidate cache
      this.cache.delete('main-config');
    } catch (error) {
      throw new Error(`Failed to save configuration: ${error}`);
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): OrchFlowConfigFile | undefined {
    return this.config;
  }

  /**
   * Update configuration
   */
  async updateConfig(updates: Partial<OrchFlowConfigFile>): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    this.config = this.deepMerge(this.config!, updates);
    await this.save();
  }

  /**
   * Get core configuration for OrchFlow
   */
  getCoreConfig(): OrchFlowConfig {
    return this.convertToCore(this.config?.core || this.defaultConfig.core);
  }

  /**
   * Update core configuration
   */
  async updateCoreConfig(updates: Partial<OrchFlowConfig>): Promise<void> {
    const currentCore = this.config?.core || this.defaultConfig.core;
    await this.updateConfig({
      core: { ...currentCore, ...updates }
    });
  }

  /**
   * Get setup configuration
   */
  getSetupConfig() {
    return this.config?.setup || this.defaultConfig.setup;
  }

  /**
   * Update setup configuration
   */
  async updateSetupConfig(updates: Partial<OrchFlowConfigFile['setup']>): Promise<void> {
    await this.updateConfig({
      setup: { ...this.getSetupConfig(), ...updates }
    });
  }

  /**
   * Get UI configuration
   */
  getUIConfig() {
    return this.config?.ui || this.defaultConfig.ui;
  }

  /**
   * Update UI configuration
   */
  async updateUIConfig(updates: Partial<OrchFlowConfigFile['ui']>): Promise<void> {
    await this.updateConfig({
      ui: { ...this.getUIConfig(), ...updates }
    });
  }

  /**
   * Get performance configuration
   */
  getPerformanceConfig() {
    return this.config?.performance || this.defaultConfig.performance;
  }

  /**
   * Update performance configuration
   */
  async updatePerformanceConfig(updates: Partial<OrchFlowConfigFile['performance']>): Promise<void> {
    await this.updateConfig({
      performance: { ...this.getPerformanceConfig(), ...updates }
    });
  }

  /**
   * Create configuration from launch options
   */
  createFromLaunchOptions(options: LaunchOptions): Partial<OrchFlowConfigFile> {
    const config: Partial<OrchFlowConfigFile> = {};

    if (options.port || options.host || options.debug || options.dataDir) {
      config.core = { ...this.defaultConfig.core };

      if (options.port) {
        config.core.port = options.port;
      }

      if (options.host) {
        config.core.host = options.host;
      }

      if (options.debug) {
        config.core.logLevel = 'debug';
      }

      if (options.dataDir) {
        config.core.storageDir = options.dataDir;
      }
    }

    return config;
  }

  /**
   * Optimize configuration for environment
   */
  async optimizeForEnvironment(environment: TerminalEnvironment): Promise<void> {
    const updates: Partial<OrchFlowConfigFile> = {};

    // Optimize performance based on capabilities
    if (environment.capabilities.splitPanes) {
      updates.ui = {
        ...this.defaultConfig.ui,
        statusPane: {
          ...this.defaultConfig.ui.statusPane,
          enabled: true,
          width: 30
        }
      };
    } else {
      updates.ui = {
        ...this.defaultConfig.ui,
        statusPane: {
          ...this.defaultConfig.ui.statusPane,
          enabled: false
        }
      };
    }

    // Optimize for terminal multiplexer
    if (environment.multiplexer !== 'none') {
      updates.setup = {
        ...this.defaultConfig.setup,
        preferredFlow: environment.multiplexer as SetupFlow
      };
    }

    // Optimize for platform
    if (environment.platform === 'win32') {
      updates.performance = {
        ...this.defaultConfig.performance,
        maxWorkers: Math.max(2, this.defaultConfig.performance.maxWorkers - 2)
      };
    }

    await this.updateConfig(updates);
  }

  /**
   * Validate configuration
   */
  validate(config: OrchFlowConfigFile): string[] {
    const errors: string[] = [];

    // Validate core configuration
    if (config.core.port < 1 || config.core.port > 65535) {
      errors.push('Port must be between 1 and 65535');
    }

    if (config.core.maxWorkers < 1 || config.core.maxWorkers > 100) {
      errors.push('Max workers must be between 1 and 100');
    }

    // Validate performance configuration
    if (config.performance.memoryLimit < 100 || config.performance.memoryLimit > 8192) {
      errors.push('Memory limit must be between 100MB and 8GB');
    }

    if (config.performance.timeoutMs < 1000 || config.performance.timeoutMs > 300000) {
      errors.push('Timeout must be between 1 second and 5 minutes');
    }

    // Validate UI configuration
    if (config.ui.statusPane.width < 10 || config.ui.statusPane.width > 80) {
      errors.push('Status pane width must be between 10 and 80 characters');
    }

    return errors;
  }

  /**
   * Export configuration
   */
  async exportConfig(path: string): Promise<void> {
    if (!this.config) {
      await this.load();
    }

    const exportData = {
      ...this.config,
      exported: new Date().toISOString(),
      version: this.config!.version
    };

    const configContent = stringify(exportData, {
      indent: 2,
      lineWidth: 120
    });

    writeFileSync(path, configContent, 'utf8');
  }

  /**
   * Import configuration
   */
  async importConfig(path: string): Promise<void> {
    if (!existsSync(path)) {
      throw new Error(`Configuration file not found: ${path}`);
    }

    const configContent = readFileSync(path, 'utf8');
    const importedConfig = parse(configContent) as OrchFlowConfigFile;

    // Validate imported configuration
    const errors = this.validate(importedConfig);
    if (errors.length > 0) {
      throw new Error(`Invalid configuration: ${errors.join(', ')}`);
    }

    this.config = this.mergeWithDefaults(importedConfig);
    await this.save();
  }

  /**
   * Reset to default configuration
   */
  async reset(): Promise<void> {
    this.config = this.createDefaultConfig();
    await this.save();
    this.cache.clear();
    this.loadedConfigs.clear();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.loadedConfigs.clear();
  }

  /**
   * Get configuration file path
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Get configuration directory
   */
  getConfigDir(): string {
    return this.configDir;
  }

  /**
   * Convert configuration to core format
   */
  private convertToCore(config: any): OrchFlowConfig {
    return {
      port: config.port || 3001,
      host: config.host || 'localhost',
      storageDir: config.storageDir || path.join(os.homedir(), '.orchflow', 'storage'),
      maxWorkers: config.maxWorkers || 10,
      enablePersistence: config.enablePersistence ?? true,
      enableWebSocket: config.enableWebSocket ?? true,
      security: {
        enableAuth: config.security?.enableAuth ?? false,
        apiKey: config.security?.apiKey,
        allowedOrigins: config.security?.allowedOrigins ?? ['*'],
        rateLimiting: {
          enabled: config.security?.rateLimiting?.enabled ?? false,
          windowMs: config.security?.rateLimiting?.windowMs ?? 15 * 60 * 1000,
          maxRequests: config.security?.rateLimiting?.maxRequests ?? 100
        },
        cors: {
          enabled: config.security?.cors?.enabled ?? true,
          origin: config.security?.cors?.origin ?? '*',
          methods: config.security?.cors?.methods ?? ['GET', 'POST', 'PUT', 'DELETE'],
          allowedHeaders: config.security?.cors?.allowedHeaders ?? ['Content-Type', 'Authorization']
        }
      },
      logLevel: config.logLevel || 'info',
      core: {
        port: config.port || 3001,
        enablePersistence: config.enablePersistence ?? true,
        enableWebSocket: config.enableWebSocket ?? true,
        mode: config.mode || 'production',
        maxWorkers: config.maxWorkers || 10,
        storageDir: config.storageDir || path.join(os.homedir(), '.orchflow', 'storage')
      },
      splitScreen: {
        enabled: config.splitScreen?.enabled ?? true,
        primaryWidth: config.splitScreen?.primaryWidth ?? 70,
        statusWidth: config.splitScreen?.statusWidth ?? 30,
        sessionName: config.splitScreen?.sessionName ?? 'orchflow',
        enableQuickAccess: config.splitScreen?.enableQuickAccess ?? true
      },
      terminal: {
        mode: config.terminal?.mode || 'tmux',
        statusUpdateInterval: config.terminal?.statusUpdateInterval || 1000,
        showResourceUsage: config.terminal?.showResourceUsage ?? true,
        maxWorkersDisplay: config.terminal?.maxWorkersDisplay ?? 10
      }
    };
  }

  private createDefaultConfig(): OrchFlowConfigFile {
    return {
      version: '1.0.0',
      core: {
        port: 3001,
        host: 'localhost',
        storageDir: join(this.configDir, 'data'),
        maxWorkers: 8,
        enablePersistence: true,
        enableWebSocket: true,
        logLevel: 'info' as const,
        security: {
          enableAuth: false,
          allowedOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000']
        }
      },
      setup: {
        preferredFlow: 'tmux',
        autoDetect: true,
        skipConfirmation: false,
        customCommands: {}
      },
      ui: {
        theme: 'auto',
        statusPane: {
          enabled: true,
          width: 30,
          updateInterval: 1000
        },
        keybindings: {
          'quick-access-1': 'Ctrl+1',
          'quick-access-2': 'Ctrl+2',
          'quick-access-3': 'Ctrl+3',
          'toggle-status': 'Ctrl+s',
          'new-worker': 'Ctrl+n',
          'switch-worker': 'Ctrl+w'
        }
      },
      performance: {
        enableCaching: true,
        maxWorkers: 8,
        memoryLimit: 1024,
        timeoutMs: 30000
      },
      plugins: {
        enabled: [],
        config: {}
      }
    };
  }

  private mergeWithDefaults(loaded: OrchFlowConfigFile): OrchFlowConfigFile {
    return this.deepMerge(this.defaultConfig, loaded);
  }

  private deepMerge(target: any, source: any): any {
    if (typeof target !== 'object' || typeof source !== 'object') {
      return source;
    }

    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }
}

export default ConfigurationManager;