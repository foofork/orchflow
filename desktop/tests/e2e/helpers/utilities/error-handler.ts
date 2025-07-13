import type { Page, ConsoleMessage, Dialog } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ErrorLog {
  type: 'console' | 'page' | 'network' | 'dialog' | 'crash';
  level?: string;
  message: string;
  timestamp: Date;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stack?: string;
  source?: string;
  details?: any;
}

export interface ErrorSummary {
  total: number;
  byType: Record<string, number>;
  byLevel: Record<string, number>;
  byUrl: Record<string, number>;
  criticalErrors: ErrorLog[];
  commonPatterns: Array<{ pattern: string; count: number }>;
}

export class ErrorHandler {
  private page: Page;
  private errors: ErrorLog[] = [];
  private ignoredPatterns: RegExp[] = [];
  private criticalPatterns: RegExp[] = [];
  private monitoring = false;
  private errorThreshold = 100;
  private onErrorCallbacks: Array<(error: ErrorLog) => void> = [];
  private crashDetected = false;

  constructor(page: Page) {
    this.page = page;
    this.setupDefaultIgnoredPatterns();
    this.setupDefaultCriticalPatterns();
  }

  private setupDefaultIgnoredPatterns(): void {
    this.ignoredPatterns = [
      /favicon\.ico/,
      /ResizeObserver loop limit exceeded/,
      /Non-Error promise rejection captured/,
      /Failed to load resource.*font/,
      /Webpack HMR/
    ];
  }

  private setupDefaultCriticalPatterns(): void {
    this.criticalPatterns = [
      /FATAL/i,
      /CRITICAL/i,
      /SecurityError/,
      /SyntaxError/,
      /ReferenceError: .* is not defined/,
      /Cannot read prop/,
      /TypeError: .* is not a function/,
      /Maximum call stack/,
      /out of memory/i
    ];
  }

  async initialize(): Promise<void> {
    // Listen to console messages
    this.page.on('console', async (message) => {
      if (this.monitoring) {
        await this.handleConsoleMessage(message);
      }
    });

    // Listen to page errors
    this.page.on('pageerror', async (error) => {
      if (this.monitoring) {
        await this.handlePageError(error);
      }
    });

    // Listen to request failures
    this.page.on('requestfailed', async (request) => {
      if (this.monitoring) {
        await this.handleRequestFailure(request);
      }
    });

    // Listen to dialogs
    this.page.on('dialog', async (dialog) => {
      if (this.monitoring) {
        await this.handleDialog(dialog);
      }
    });

    // Listen to crashes
    this.page.on('crash', async () => {
      if (this.monitoring) {
        await this.handleCrash();
      }
    });

    // Install error tracking in the page
    await this.installErrorTracking();
  }

  private async installErrorTracking(): Promise<void> {
    await this.page.addInitScript(() => {
      // Track unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
      });

      // Track global errors
      window.addEventListener('error', (event) => {
        console.error('Global error:', event.message, 'at', event.filename, event.lineno, event.colno);
      });

      // Override console methods to add metadata
      const originalError = console.error;
      console.error = (...args) => {
        originalError.apply(console, args);
        
        // Send error details to test
        if ((window as any).__testErrorHandler) {
          (window as any).__testErrorHandler({
            type: 'console',
            level: 'error',
            message: args.map(arg => String(arg)).join(' '),
            timestamp: new Date().toISOString()
          });
        }
      };
    });
  }

  startMonitoring(): void {
    this.monitoring = true;
    this.errors = [];
    this.crashDetected = false;
  }

  stopMonitoring(): void {
    this.monitoring = false;
  }

  private async handleConsoleMessage(message: ConsoleMessage): Promise<void> {
    const type = message.type();
    const text = message.text();

    // Skip if matches ignored pattern
    if (this.shouldIgnore(text)) return;

    const error: ErrorLog = {
      type: 'console',
      level: type,
      message: text,
      timestamp: new Date(),
      url: this.page.url()
    };

    // Try to get location info
    try {
      const location = message.location();
      error.url = location.url;
      error.lineNumber = location.lineNumber;
      error.columnNumber = location.columnNumber;
    } catch {
      // Location might not be available
    }

    // Get stack trace for errors
    if (type === 'error') {
      try {
        const args = await Promise.all(message.args().map(arg => arg.jsonValue().catch(() => null)));
        error.details = args;
        
        // Extract stack trace if available
        const stackArg = message.args().find(arg => arg.toString().includes('Error'));
        if (stackArg) {
          const stack = await stackArg.evaluate((err: any) => err.stack).catch(() => null);
          error.stack = stack;
        }
      } catch {
        // Failed to get additional details
      }
    }

    this.recordError(error);
  }

  private async handlePageError(error: Error): Promise<void> {
    const errorLog: ErrorLog = {
      type: 'page',
      level: 'error',
      message: error.message,
      timestamp: new Date(),
      url: this.page.url(),
      stack: error.stack
    };

    this.recordError(errorLog);
  }

  private async handleRequestFailure(request: any): Promise<void> {
    const failure = request.failure();
    if (!failure) return;

    const error: ErrorLog = {
      type: 'network',
      level: 'error',
      message: `Network request failed: ${request.url()}`,
      timestamp: new Date(),
      url: request.url(),
      details: {
        method: request.method(),
        errorText: failure.errorText,
        resourceType: request.resourceType()
      }
    };

    this.recordError(error);
  }

  private async handleDialog(dialog: Dialog): Promise<void> {
    const error: ErrorLog = {
      type: 'dialog',
      level: 'warning',
      message: dialog.message(),
      timestamp: new Date(),
      url: this.page.url(),
      details: {
        type: dialog.type()
      }
    };

    this.recordError(error);

    // Auto-dismiss dialog
    await dialog.dismiss();
  }

  private async handleCrash(): Promise<void> {
    const error: ErrorLog = {
      type: 'crash',
      level: 'critical',
      message: 'Page crashed',
      timestamp: new Date(),
      url: this.page.url()
    };

    this.crashDetected = true;
    this.recordError(error);
  }

  private shouldIgnore(message: string): boolean {
    return this.ignoredPatterns.some(pattern => pattern.test(message));
  }

  private isCritical(error: ErrorLog): boolean {
    return this.criticalPatterns.some(pattern => pattern.test(error.message));
  }

  private recordError(error: ErrorLog): void {
    this.errors.push(error);

    // Check if critical
    if (this.isCritical(error)) {
      console.error(`CRITICAL ERROR: ${error.message}`);
    }

    // Call callbacks
    this.onErrorCallbacks.forEach(callback => callback(error));

    // Check threshold
    if (this.errors.length > this.errorThreshold) {
      console.warn(`Error threshold exceeded: ${this.errors.length} errors recorded`);
    }
  }

  addIgnorePattern(pattern: RegExp): void {
    this.ignoredPatterns.push(pattern);
  }

  removeIgnorePattern(pattern: RegExp): void {
    this.ignoredPatterns = this.ignoredPatterns.filter(p => p !== pattern);
  }

  addCriticalPattern(pattern: RegExp): void {
    this.criticalPatterns.push(pattern);
  }

  setErrorThreshold(threshold: number): void {
    this.errorThreshold = threshold;
  }

  onError(callback: (error: ErrorLog) => void): void {
    this.onErrorCallbacks.push(callback);
  }

  getErrors(): ErrorLog[] {
    return [...this.errors];
  }

  getErrorsByType(type: ErrorLog['type']): ErrorLog[] {
    return this.errors.filter(error => error.type === type);
  }

  getErrorsByLevel(level: string): ErrorLog[] {
    return this.errors.filter(error => error.level === level);
  }

  getCriticalErrors(): ErrorLog[] {
    return this.errors.filter(error => this.isCritical(error));
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  hasCriticalErrors(): boolean {
    return this.getCriticalErrors().length > 0;
  }

  hasCrashed(): boolean {
    return this.crashDetected;
  }

  clearErrors(): void {
    this.errors = [];
    this.crashDetected = false;
  }

  generateSummary(): ErrorSummary {
    const summary: ErrorSummary = {
      total: this.errors.length,
      byType: {},
      byLevel: {},
      byUrl: {},
      criticalErrors: this.getCriticalErrors(),
      commonPatterns: []
    };

    // Count by type
    this.errors.forEach(error => {
      summary.byType[error.type] = (summary.byType[error.type] || 0) + 1;
      
      if (error.level) {
        summary.byLevel[error.level] = (summary.byLevel[error.level] || 0) + 1;
      }
      
      if (error.url) {
        const urlKey = new URL(error.url).pathname;
        summary.byUrl[urlKey] = (summary.byUrl[urlKey] || 0) + 1;
      }
    });

    // Find common patterns
    const patterns = this.findCommonPatterns();
    summary.commonPatterns = patterns;

    return summary;
  }

  private findCommonPatterns(): Array<{ pattern: string; count: number }> {
    const patternMap = new Map<string, number>();
    
    // Common error patterns to look for
    const patterns = [
      /Cannot read prop(?:erty)? '(.+)' of (?:null|undefined)/,
      /(.+) is not a function/,
      /(.+) is not defined/,
      /Failed to fetch (.+)/,
      /Network request failed: (.+)/,
      /Unexpected token (.+)/
    ];

    this.errors.forEach(error => {
      patterns.forEach(pattern => {
        const match = error.message.match(pattern);
        if (match) {
          const key = pattern.source;
          patternMap.set(key, (patternMap.get(key) || 0) + 1);
        }
      });
    });

    return Array.from(patternMap.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  async exportReport(filename = 'error-report.json'): Promise<void> {
    const report = {
      summary: this.generateSummary(),
      errors: this.errors,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(filename, JSON.stringify(report, null, 2));
  }

  async saveScreenshotOnError(error: ErrorLog, screenshotDir = './error-screenshots'): Promise<string> {
    await fs.mkdir(screenshotDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `error-${error.type}-${timestamp}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    await this.page.screenshot({ path: filepath, fullPage: true });
    
    return filepath;
  }

  async captureErrorContext(error: ErrorLog): Promise<{
    error: ErrorLog;
    screenshot: string;
    html: string;
    localStorage: Record<string, string>;
    sessionStorage: Record<string, string>;
    cookies: Array<{ name: string; value: string }>;
  }> {
    const screenshot = await this.saveScreenshotOnError(error);
    const html = await this.page.content();
    
    const [localStorage, sessionStorage] = await this.page.evaluate(() => {
      const getStorage = (storage: Storage) => {
        const items: Record<string, string> = {};
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key) {
            items[key] = storage.getItem(key) || '';
          }
        }
        return items;
      };
      
      return [
        getStorage(window.localStorage),
        getStorage(window.sessionStorage)
      ];
    });
    
    const cookies = await this.page.context().cookies();
    
    return {
      error,
      screenshot,
      html,
      localStorage,
      sessionStorage,
      cookies: cookies.map(c => ({ name: c.name, value: c.value }))
    };
  }

  async assertNoErrors(): Promise<void> {
    if (this.hasErrors()) {
      const summary = this.generateSummary();
      throw new Error(`Page has ${summary.total} errors:\n${JSON.stringify(summary, null, 2)}`);
    }
  }

  async assertNoCriticalErrors(): Promise<void> {
    if (this.hasCriticalErrors()) {
      const criticalErrors = this.getCriticalErrors();
      throw new Error(`Page has ${criticalErrors.length} critical errors:\n${
        criticalErrors.map(e => e.message).join('\n')
      }`);
    }
  }

  async assertNoCrash(): Promise<void> {
    if (this.hasCrashed()) {
      throw new Error('Page crashed during test');
    }
  }

  async waitForError(pattern: RegExp, timeout = 5000): Promise<ErrorLog | null> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const error = this.errors.find(e => pattern.test(e.message));
      if (error) return error;
      
      await this.page.waitForTimeout(100);
    }
    
    return null;
  }

  getErrorRate(): number {
    if (this.errors.length === 0) return 0;
    
    const duration = this.errors[this.errors.length - 1].timestamp.getTime() - 
                    this.errors[0].timestamp.getTime();
    
    if (duration === 0) return 0;
    
    // Errors per minute
    return (this.errors.length / duration) * 60000;
  }
}