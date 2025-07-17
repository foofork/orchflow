/**
 * OrchFlow Error Handler - Comprehensive error management system
 */

import { EventEmitter } from 'events';

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ErrorCategory {
  SYSTEM = 'system',
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RESOURCE = 'resource',
  TIMEOUT = 'timeout',
  CONFIGURATION = 'configuration',
  WORKER = 'worker',
  TASK = 'task',
  MCP = 'mcp',
  UNKNOWN = 'unknown'
}

export interface ErrorContext {
  component: string;
  operation: string;
  workerId?: string;
  taskId?: string;
  timestamp: Date;
  stackTrace?: string;
  userAgent?: string;
  requestId?: string;
  metadata?: Record<string, any>;
}

export interface OrchFlowError {
  id: string;
  code: string;
  message: string;
  severity: ErrorSeverity;
  category: ErrorCategory;
  context: ErrorContext;
  recoverable: boolean;
  retryable: boolean;
  retryCount: number;
  maxRetries: number;
  cause?: Error;
  resolution?: string;
  timestamp: Date;
}

export interface ErrorRecoveryAction {
  type: 'retry' | 'fallback' | 'ignore' | 'escalate' | 'restart';
  delay?: number;
  maxAttempts?: number;
  fallbackStrategy?: () => Promise<any>;
  escalationTarget?: string;
}

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableMetrics: boolean;
  enableRecovery: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  maxRetries: number;
  retryDelayMs: number;
  escalationThreshold: number;
  enableNotifications: boolean;
  notificationChannels: string[];
}

export class ErrorHandler extends EventEmitter {
  private static instance: ErrorHandler;
  private config: ErrorHandlerConfig;
  private errorHistory: OrchFlowError[] = [];
  private recoveryActions: Map<string, ErrorRecoveryAction> = new Map();
  private errorCounts: Map<string, number> = new Map();

  private constructor(config: ErrorHandlerConfig) {
    super();
    this.config = config;
    this.initializeRecoveryActions();
  }

  static getInstance(config?: ErrorHandlerConfig): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler(config || ErrorHandler.getDefaultConfig());
    }
    return ErrorHandler.instance;
  }

  static getDefaultConfig(): ErrorHandlerConfig {
    return {
      enableLogging: true,
      enableMetrics: true,
      enableRecovery: true,
      logLevel: 'error',
      maxRetries: 3,
      retryDelayMs: 1000,
      escalationThreshold: 5,
      enableNotifications: false,
      notificationChannels: []
    };
  }

  /**
   * Handle an error with comprehensive error processing
   */
  async handleError(error: Error, context: Partial<ErrorContext>): Promise<OrchFlowError> {
    const orchflowError = this.createOrchFlowError(error, context);

    // Log error
    if (this.config.enableLogging) {
      this.logError(orchflowError);
    }

    // Track metrics
    if (this.config.enableMetrics) {
      this.trackErrorMetrics(orchflowError);
    }

    // Store in history
    this.errorHistory.push(orchflowError);
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-500);
    }

    // Attempt recovery
    if (this.config.enableRecovery && orchflowError.recoverable) {
      await this.attemptRecovery(orchflowError);
    }

    // Emit error event
    this.emit('error', orchflowError);

    // Check for escalation
    if (this.shouldEscalate(orchflowError)) {
      await this.escalateError(orchflowError);
    }

    return orchflowError;
  }

  /**
   * Create a standardized OrchFlow error
   */
  private createOrchFlowError(error: Error, context: Partial<ErrorContext>): OrchFlowError {
    const errorId = this.generateErrorId();
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(error, category);
    const recoverable = this.isRecoverable(error, category);
    const retryable = this.isRetryable(error, category);

    return {
      id: errorId,
      code: this.generateErrorCode(category, error),
      message: error.message,
      severity,
      category,
      context: {
        component: context.component || 'unknown',
        operation: context.operation || 'unknown',
        workerId: context.workerId,
        taskId: context.taskId,
        timestamp: new Date(),
        stackTrace: error.stack,
        userAgent: context.userAgent,
        requestId: context.requestId,
        metadata: context.metadata || {}
      },
      recoverable,
      retryable,
      retryCount: 0,
      maxRetries: this.config.maxRetries,
      cause: error,
      resolution: this.getResolutionSuggestion(error, category),
      timestamp: new Date()
    };
  }

  /**
   * Categorize error based on error type and message
   */
  private categorizeError(error: Error): ErrorCategory {
    const message = error.message.toLowerCase();
    const name = error.name.toLowerCase();

    if (name.includes('timeout') || message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (name.includes('network') || message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (name.includes('validation') || message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (name.includes('auth') || message.includes('auth') || message.includes('unauthorized')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (name.includes('permission') || message.includes('permission') || message.includes('forbidden')) {
      return ErrorCategory.AUTHORIZATION;
    }
    if (message.includes('worker') || message.includes('spawn')) {
      return ErrorCategory.WORKER;
    }
    if (message.includes('task') || message.includes('orchestrat')) {
      return ErrorCategory.TASK;
    }
    if (message.includes('mcp') || message.includes('server')) {
      return ErrorCategory.MCP;
    }
    if (message.includes('config') || message.includes('setup')) {
      return ErrorCategory.CONFIGURATION;
    }
    if (message.includes('resource') || message.includes('memory') || message.includes('cpu')) {
      return ErrorCategory.RESOURCE;
    }

    return ErrorCategory.UNKNOWN;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(_error: Error, category: ErrorCategory): ErrorSeverity {
    if (category === ErrorCategory.SYSTEM) {
      return ErrorSeverity.CRITICAL;
    }
    if (category === ErrorCategory.RESOURCE || category === ErrorCategory.CONFIGURATION) {
      return ErrorSeverity.HIGH;
    }
    if (category === ErrorCategory.WORKER || category === ErrorCategory.TASK) {
      return ErrorSeverity.MEDIUM;
    }
    return ErrorSeverity.LOW;
  }

  /**
   * Check if error is recoverable
   */
  private isRecoverable(error: Error, category: ErrorCategory): boolean {
    return category !== ErrorCategory.SYSTEM &&
           category !== ErrorCategory.CONFIGURATION &&
           !error.message.includes('fatal');
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(_error: Error, category: ErrorCategory): boolean {
    return category === ErrorCategory.NETWORK ||
           category === ErrorCategory.TIMEOUT ||
           category === ErrorCategory.RESOURCE ||
           category === ErrorCategory.WORKER;
  }

  /**
   * Attempt error recovery
   */
  private async attemptRecovery(error: OrchFlowError): Promise<boolean> {
    const recoveryAction = this.recoveryActions.get(error.category);
    if (!recoveryAction) {
      return false;
    }

    try {
      switch (recoveryAction.type) {
        case 'retry':
          return await this.retryOperation(error, recoveryAction);
        case 'fallback':
          return await this.executeFallback(error, recoveryAction);
        case 'restart':
          return await this.restartComponent(error);
        case 'ignore':
          return true;
        default:
          return false;
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      return false;
    }
  }

  /**
   * Retry operation with exponential backoff
   */
  private async retryOperation(error: OrchFlowError, action: ErrorRecoveryAction): Promise<boolean> {
    if (error.retryCount >= error.maxRetries) {
      return false;
    }

    const delay = (action.delay || this.config.retryDelayMs) * Math.pow(2, error.retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    error.retryCount++;
    this.emit('retryAttempt', error);

    return true;
  }

  /**
   * Execute fallback strategy
   */
  private async executeFallback(_error: OrchFlowError, action: ErrorRecoveryAction): Promise<boolean> {
    if (action.fallbackStrategy) {
      try {
        await action.fallbackStrategy();
        return true;
      } catch (fallbackError) {
        console.error('Fallback strategy failed:', fallbackError);
        return false;
      }
    }
    return false;
  }

  /**
   * Restart component
   */
  private async restartComponent(error: OrchFlowError): Promise<boolean> {
    this.emit('componentRestart', error);
    // Implementation depends on component type
    return true;
  }

  /**
   * Check if error should be escalated
   */
  private shouldEscalate(error: OrchFlowError): boolean {
    if (error.severity === ErrorSeverity.CRITICAL) {
      return true;
    }

    const errorKey = `${error.category}_${error.code}`;
    const count = this.errorCounts.get(errorKey) || 0;
    return count >= this.config.escalationThreshold;
  }

  /**
   * Escalate error
   */
  private async escalateError(error: OrchFlowError): Promise<void> {
    this.emit('errorEscalated', error);

    if (this.config.enableNotifications) {
      await this.sendNotification(error);
    }
  }

  /**
   * Send error notification
   */
  private async sendNotification(error: OrchFlowError): Promise<void> {
    // Implementation depends on notification channels
    console.error('CRITICAL ERROR:', error);
  }

  /**
   * Log error
   */
  private logError(error: OrchFlowError): void {
    const logMessage = `[${error.severity.toUpperCase()}] ${error.category}: ${error.message}`;
    const logDetails = {
      id: error.id,
      code: error.code,
      context: error.context,
      timestamp: error.timestamp
    };

    switch (error.severity) {
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, logDetails);
        break;
      case ErrorSeverity.HIGH:
        console.error(logMessage, logDetails);
        break;
      case ErrorSeverity.MEDIUM:
        console.warn(logMessage, logDetails);
        break;
      case ErrorSeverity.LOW:
        console.info(logMessage, logDetails);
        break;
    }
  }

  /**
   * Track error metrics
   */
  private trackErrorMetrics(error: OrchFlowError): void {
    const errorKey = `${error.category}_${error.code}`;
    const count = this.errorCounts.get(errorKey) || 0;
    this.errorCounts.set(errorKey, count + 1);
  }

  /**
   * Initialize recovery actions
   */
  private initializeRecoveryActions(): void {
    this.recoveryActions.set(ErrorCategory.NETWORK, {
      type: 'retry',
      delay: 2000,
      maxAttempts: 3
    });

    this.recoveryActions.set(ErrorCategory.TIMEOUT, {
      type: 'retry',
      delay: 1000,
      maxAttempts: 2
    });

    this.recoveryActions.set(ErrorCategory.WORKER, {
      type: 'restart',
      maxAttempts: 1
    });

    this.recoveryActions.set(ErrorCategory.RESOURCE, {
      type: 'fallback',
      fallbackStrategy: async () => {
        // Implement resource cleanup
        console.log('Cleaning up resources...');
      }
    });

    this.recoveryActions.set(ErrorCategory.VALIDATION, {
      type: 'ignore'
    });
  }

  /**
   * Generate error ID
   */
  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate error code
   */
  private generateErrorCode(category: ErrorCategory, error: Error): string {
    const categoryCode = category.toUpperCase().substr(0, 3);
    const errorHash = this.hashString(error.message).toString(36).substr(0, 4);
    return `${categoryCode}_${errorHash}`;
  }

  /**
   * Get resolution suggestion
   */
  private getResolutionSuggestion(_error: Error, category: ErrorCategory): string {
    const suggestions: Record<ErrorCategory, string> = {
      [ErrorCategory.NETWORK]: 'Check network connectivity and retry',
      [ErrorCategory.TIMEOUT]: 'Increase timeout values or retry with exponential backoff',
      [ErrorCategory.VALIDATION]: 'Validate input parameters and fix validation errors',
      [ErrorCategory.AUTHENTICATION]: 'Check authentication credentials and tokens',
      [ErrorCategory.AUTHORIZATION]: 'Verify user permissions and access rights',
      [ErrorCategory.RESOURCE]: 'Monitor resource usage and optimize allocation',
      [ErrorCategory.WORKER]: 'Restart worker or spawn new worker instance',
      [ErrorCategory.TASK]: 'Review task configuration and dependencies',
      [ErrorCategory.MCP]: 'Check MCP server status and connection',
      [ErrorCategory.CONFIGURATION]: 'Review configuration settings and fix errors',
      [ErrorCategory.SYSTEM]: 'Contact system administrator for assistance',
      [ErrorCategory.UNKNOWN]: 'Investigate error details and contact support'
    };

    return suggestions[category] || 'Review error details and contact support';
  }

  /**
   * Hash string to number
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Get error statistics
   */
  getErrorStats(): Record<string, any> {
    const stats = {
      total: this.errorHistory.length,
      categories: {} as Record<string, number>,
      severities: {} as Record<string, number>,
      recent: this.errorHistory.slice(-10),
      mostFrequent: [] as Array<{ key: string; count: number }>
    };

    // Count by category and severity
    this.errorHistory.forEach(error => {
      stats.categories[error.category] = (stats.categories[error.category] || 0) + 1;
      stats.severities[error.severity] = (stats.severities[error.severity] || 0) + 1;
    });

    // Most frequent errors
    stats.mostFrequent = Array.from(this.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([key, count]) => ({ key, count }));

    return stats;
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    this.errorCounts.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  getConfig(): ErrorHandlerConfig {
    return { ...this.config };
  }
}

export default ErrorHandler;