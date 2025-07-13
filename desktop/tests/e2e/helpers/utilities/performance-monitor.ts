import type { Page, CDPSession } from '@playwright/test';

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: number;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: number;
}

export interface CPUInfo {
  usage: number;
  timestamp: number;
}

export interface RenderMetrics {
  fps: number;
  jank: number;
  longTasks: number;
  timestamp: number;
}

export interface NetworkMetrics {
  requests: number;
  bytesReceived: number;
  bytesSent: number;
  averageLatency: number;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  memory: MemoryInfo[];
  cpu: CPUInfo[];
  render: RenderMetrics[];
  network: NetworkMetrics[];
  summary: {
    averageFPS: number;
    memoryLeaks: boolean;
    cpuSpikes: number;
    slowRequests: number;
    totalJank: number;
  };
}

export class PerformanceMonitor {
  page: Page;
  private cdpSession: CDPSession | null = null;
  private metrics: PerformanceMetric[] = [];
  private memorySnapshots: MemoryInfo[] = [];
  private cpuSnapshots: CPUInfo[] = [];
  private renderSnapshots: RenderMetrics[] = [];
  private networkSnapshots: NetworkMetrics[] = [];
  private monitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;

  constructor(page: Page) {
    this.page = page;
  }

  async initialize(): Promise<void> {
    this.cdpSession = await this.page.context().newCDPSession(this.page);
    await this.cdpSession.send('Performance.enable');
    await this.cdpSession.send('Runtime.enable');
  }

  async startMonitoring(interval = 100): Promise<void> {
    if (this.monitoring) return;
    
    this.monitoring = true;
    this.startTime = Date.now();
    this.clearMetrics();
    
    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      if (this.monitoring) {
        await this.collectMetrics();
      }
    }, interval);
    
    // Monitor long tasks
    await this.page.evaluate(() => {
      (window as any).__performanceMonitor = {
        longTasks: 0,
        observer: new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.duration > 50) {
              (window as any).__performanceMonitor.longTasks++;
            }
          }
        })
      };
      
      (window as any).__performanceMonitor.observer.observe({ 
        entryTypes: ['longtask', 'measure', 'navigation'] 
      });
    });
  }

  async stopMonitoring(): Promise<void> {
    this.monitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Clean up observers
    await this.page.evaluate(() => {
      if ((window as any).__performanceMonitor?.observer) {
        (window as any).__performanceMonitor.observer.disconnect();
        delete (window as any).__performanceMonitor;
      }
    });
  }

  private async collectMetrics(): Promise<void> {
    const timestamp = Date.now();
    
    // Collect memory info
    const memoryInfo = await this.getMemoryInfo();
    if (memoryInfo) {
      this.memorySnapshots.push({ ...memoryInfo, timestamp });
    }
    
    // Collect CPU info
    const cpuInfo = await this.getCPUInfo();
    if (cpuInfo) {
      this.cpuSnapshots.push({ ...cpuInfo, timestamp });
    }
    
    // Collect render metrics
    const renderMetrics = await this.getRenderMetrics();
    if (renderMetrics) {
      this.renderSnapshots.push({ ...renderMetrics, timestamp });
    }
    
    // Collect network metrics
    const networkMetrics = await this.getNetworkMetrics();
    if (networkMetrics) {
      this.networkSnapshots.push({ ...networkMetrics, timestamp });
    }
    
    // Collect custom metrics
    const customMetrics = await this.getCustomMetrics();
    this.metrics.push(...customMetrics);
  }

  private async getMemoryInfo(): Promise<Omit<MemoryInfo, 'timestamp'> | null> {
    try {
      const result = await this.page.evaluate(() => {
        if ('memory' in performance) {
          return {
            usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
            totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
            jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      return result;
    } catch {
      return null;
    }
  }

  private async getCPUInfo(): Promise<Omit<CPUInfo, 'timestamp'> | null> {
    try {
      if (!this.cdpSession) return null;
      
      const metrics = await this.cdpSession.send('Performance.getMetrics');
      const taskDuration = metrics.metrics.find(m => m.name === 'TaskDuration')?.value || 0;
      const timestamp = metrics.metrics.find(m => m.name === 'Timestamp')?.value || 0;
      
      const usage = taskDuration / timestamp * 100;
      
      return { usage: Math.min(usage, 100) };
    } catch {
      return null;
    }
  }

  private async getRenderMetrics(): Promise<Omit<RenderMetrics, 'timestamp'> | null> {
    try {
      const result = await this.page.evaluate(() => {
        const longTasks = (window as any).__performanceMonitor?.longTasks || 0;
        
        // Calculate FPS
        let fps = 60; // default
        const entries = performance.getEntriesByType('measure');
        if (entries.length > 1) {
          const recentEntries = entries.slice(-10);
          const durations = recentEntries.map(e => e.duration);
          const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
          fps = Math.min(60, 1000 / avgDuration);
        }
        
        // Calculate jank (frame drops)
        const jank = Math.max(0, 60 - fps);
        
        return { fps, jank, longTasks };
      });
      
      return result;
    } catch {
      return null;
    }
  }

  private async getNetworkMetrics(): Promise<Omit<NetworkMetrics, 'timestamp'> | null> {
    try {
      const result = await this.page.evaluate(() => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        
        const requests = entries.length;
        let bytesReceived = 0;
        let bytesSent = 0;
        let totalLatency = 0;
        
        entries.forEach(entry => {
          bytesReceived += entry.transferSize || 0;
          bytesSent += entry.encodedBodySize || 0;
          totalLatency += entry.duration;
        });
        
        const averageLatency = requests > 0 ? totalLatency / requests : 0;
        
        return { requests, bytesReceived, bytesSent, averageLatency };
      });
      
      return result;
    } catch {
      return null;
    }
  }

  private async getCustomMetrics(): Promise<PerformanceMetric[]> {
    const timestamp = Date.now();
    const metrics: PerformanceMetric[] = [];
    
    try {
      // Get navigation timing
      const navigationTiming = await this.page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (!nav) return null;
        
        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.domContentLoadedEventStart,
          loadComplete: nav.loadEventEnd - nav.loadEventStart,
          firstPaint: nav.domContentLoadedEventStart - nav.fetchStart,
          domInteractive: nav.domInteractive - nav.fetchStart
        };
      });
      
      if (navigationTiming) {
        metrics.push(
          { name: 'domContentLoaded', value: navigationTiming.domContentLoaded, unit: 'ms', timestamp },
          { name: 'loadComplete', value: navigationTiming.loadComplete, unit: 'ms', timestamp },
          { name: 'firstPaint', value: navigationTiming.firstPaint, unit: 'ms', timestamp },
          { name: 'domInteractive', value: navigationTiming.domInteractive, unit: 'ms', timestamp }
        );
      }
      
      // Get Core Web Vitals
      const webVitals = await this.page.evaluate(() => {
        return new Promise<any>((resolve) => {
          const vitals: any = {};
          
          // LCP
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.startTime;
          }).observe({ entryTypes: ['largest-contentful-paint'] });
          
          // FID
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length > 0) {
              const firstInput = entries[0] as any; // PerformanceEventTiming
              vitals.fid = firstInput.processingStart - firstInput.startTime;
            }
          }).observe({ entryTypes: ['first-input'] });
          
          // CLS
          let clsValue = 0;
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!(entry as any).hadRecentInput) {
                clsValue += (entry as any).value;
              }
            }
            vitals.cls = clsValue;
          }).observe({ entryTypes: ['layout-shift'] });
          
          // Give time for measurements
          setTimeout(() => resolve(vitals), 1000);
        });
      });
      
      if (webVitals.lcp) {
        metrics.push({ name: 'largestContentfulPaint', value: webVitals.lcp, unit: 'ms', timestamp });
      }
      if (webVitals.fid) {
        metrics.push({ name: 'firstInputDelay', value: webVitals.fid, unit: 'ms', timestamp });
      }
      if (webVitals.cls !== undefined) {
        metrics.push({ name: 'cumulativeLayoutShift', value: webVitals.cls, unit: 'score', timestamp });
      }
    } catch (error) {
      console.error('Error collecting custom metrics:', error);
    }
    
    return metrics;
  }

  async measureAction<T>(name: string, action: () => Promise<T>): Promise<{ result: T; duration: number }> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    const measureName = `${name}-duration`;
    
    await this.page.evaluate((marks) => {
      performance.mark(marks.start);
    }, { start: startMark });
    
    const startTime = Date.now();
    const result = await action();
    const duration = Date.now() - startTime;
    
    await this.page.evaluate((marks) => {
      performance.mark(marks.end);
      performance.measure(marks.measure, marks.start, marks.end);
    }, { start: startMark, end: endMark, measure: measureName });
    
    this.metrics.push({
      name: measureName,
      value: duration,
      unit: 'ms',
      timestamp: Date.now()
    });
    
    return { result, duration };
  }

  async checkMemoryLeak(threshold = 10): Promise<boolean> {
    if (this.memorySnapshots.length < 2) return false;
    
    const firstSnapshot = this.memorySnapshots[0];
    const lastSnapshot = this.memorySnapshots[this.memorySnapshots.length - 1];
    
    const heapGrowth = lastSnapshot.usedJSHeapSize - firstSnapshot.usedJSHeapSize;
    const growthPercentage = (heapGrowth / firstSnapshot.usedJSHeapSize) * 100;
    
    return growthPercentage > threshold;
  }

  detectCPUSpikes(threshold = 80): number {
    return this.cpuSnapshots.filter(snapshot => snapshot.usage > threshold).length;
  }

  getAverageFPS(): number {
    if (this.renderSnapshots.length === 0) return 0;
    
    const totalFPS = this.renderSnapshots.reduce((sum, snapshot) => sum + snapshot.fps, 0);
    return totalFPS / this.renderSnapshots.length;
  }

  getSlowRequests(threshold = 1000): number {
    return this.networkSnapshots.filter(snapshot => snapshot.averageLatency > threshold).length;
  }

  getTotalJank(): number {
    return this.renderSnapshots.reduce((sum, snapshot) => sum + snapshot.jank, 0);
  }

  generateReport(): PerformanceReport {
    return {
      metrics: this.metrics,
      memory: this.memorySnapshots,
      cpu: this.cpuSnapshots,
      render: this.renderSnapshots,
      network: this.networkSnapshots,
      summary: {
        averageFPS: this.getAverageFPS(),
        memoryLeaks: false, // Use synchronous default, call checkMemoryLeak() separately for detailed analysis
        cpuSpikes: this.detectCPUSpikes(),
        slowRequests: this.getSlowRequests(),
        totalJank: this.getTotalJank()
      }
    };
  }

  async exportReport(filename = 'performance-report.json'): Promise<void> {
    const report = this.generateReport();
    
    await this.page.evaluate((data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    }, { ...report, filename });
  }

  clearMetrics(): void {
    this.metrics = [];
    this.memorySnapshots = [];
    this.cpuSnapshots = [];
    this.renderSnapshots = [];
    this.networkSnapshots = [];
  }

  async setPerformanceBudget(budgets: {
    maxMemory?: number;
    maxCPU?: number;
    minFPS?: number;
    maxLoadTime?: number;
  }): Promise<void> {
    // Store budgets for validation
    await this.page.evaluate((budgets) => {
      (window as any).__performanceBudgets = budgets;
    }, budgets);
  }

  async validatePerformanceBudget(): Promise<{
    passed: boolean;
    violations: string[];
  }> {
    const report = this.generateReport();
    const violations: string[] = [];
    
    const budgets = await this.page.evaluate(() => (window as any).__performanceBudgets || {});
    
    if (budgets.maxMemory && this.memorySnapshots.length > 0) {
      const maxMemoryUsed = Math.max(...this.memorySnapshots.map(s => s.usedJSHeapSize));
      if (maxMemoryUsed > budgets.maxMemory) {
        violations.push(`Memory usage (${maxMemoryUsed}) exceeds budget (${budgets.maxMemory})`);
      }
    }
    
    if (budgets.maxCPU) {
      const cpuSpikes = this.detectCPUSpikes(budgets.maxCPU);
      if (cpuSpikes > 0) {
        violations.push(`CPU usage exceeded ${budgets.maxCPU}% threshold ${cpuSpikes} times`);
      }
    }
    
    if (budgets.minFPS) {
      const avgFPS = this.getAverageFPS();
      if (avgFPS < budgets.minFPS) {
        violations.push(`Average FPS (${avgFPS}) is below minimum (${budgets.minFPS})`);
      }
    }
    
    if (budgets.maxLoadTime) {
      const loadMetric = this.metrics.find(m => m.name === 'loadComplete');
      if (loadMetric && loadMetric.value > budgets.maxLoadTime) {
        violations.push(`Load time (${loadMetric.value}ms) exceeds budget (${budgets.maxLoadTime}ms)`);
      }
    }
    
    return {
      passed: violations.length === 0,
      violations
    };
  }

  async profileFunction(functionName: string, args: any[] = []): Promise<{
    duration: number;
    memoryDelta: number;
    result: any;
  }> {
    const startMemory = await this.getMemoryInfo();
    const startTime = Date.now();
    
    const result = await this.page.evaluate(({ fn, args }: { fn: string; args: any[] }) => {
      const func = eval(fn);
      return func(...args);
    }, { fn: functionName, args });
    
    const duration = Date.now() - startTime;
    const endMemory = await this.getMemoryInfo();
    
    const memoryDelta = startMemory && endMemory 
      ? endMemory.usedJSHeapSize - startMemory.usedJSHeapSize 
      : 0;
    
    return { duration, memoryDelta, result };
  }
}