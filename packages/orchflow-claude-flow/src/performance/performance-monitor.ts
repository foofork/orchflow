/**
 * Performance Monitor
 * Real-time performance tracking and alerting system
 */

import { EventEmitter } from 'events';
import { performance } from 'perf_hooks';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getOrchFlowHome } from '../utils';

interface PerformanceThreshold {
  metric: string;
  warning: number;
  critical: number;
  unit: string;
}

interface PerformanceAlert {
  timestamp: Date;
  metric: string;
  value: number;
  threshold: number;
  level: 'warning' | 'critical';
  resolved: boolean;
}

interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    setupDetection: number;
    configLoading: number;
    userInteraction: number;
    memoryFootprint: number;
    cpuUsage: number;
    diskUsage: number;
  };
}

/**
 * Real-time performance monitoring system
 */
export class PerformanceMonitor extends EventEmitter {
  private readonly thresholds: PerformanceThreshold[] = [
    { metric: 'setupDetection', warning: 150, critical: 200, unit: 'ms' },
    { metric: 'configLoading', warning: 40, critical: 50, unit: 'ms' },
    { metric: 'userInteraction', warning: 80, critical: 100, unit: 'ms' },
    { metric: 'memoryFootprint', warning: 8, critical: 10, unit: 'MB' },
    { metric: 'cpuUsage', warning: 70, critical: 85, unit: '%' },
    { metric: 'diskUsage', warning: 80, critical: 90, unit: '%' }
  ];

  private snapshots: PerformanceSnapshot[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private readonly maxSnapshots = 1000;
  private readonly alertCooldown = 60000; // 1 minute
  private lastAlerts: Map<string, Date> = new Map();

  constructor() {
    super();
  }

  /**
   * Start continuous performance monitoring
   */
  start(intervalMs: number = 5000): void {
    if (this.monitoringInterval) {
      this.stop();
    }

    console.log(`📊 Starting performance monitoring (interval: ${intervalMs}ms)`);
    
    this.monitoringInterval = setInterval(() => {
      this.captureSnapshot();
    }, intervalMs);

    // Initial snapshot
    this.captureSnapshot();
  }

  /**
   * Stop performance monitoring
   */
  stop(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('📊 Performance monitoring stopped');
    }
  }

  /**
   * Capture a performance snapshot
   */
  private captureSnapshot(): void {
    const snapshot: PerformanceSnapshot = {
      timestamp: new Date(),
      metrics: {
        setupDetection: this.measureSetupDetection(),
        configLoading: this.measureConfigLoading(),
        userInteraction: this.measureUserInteraction(),
        memoryFootprint: this.measureMemoryFootprint(),
        cpuUsage: this.measureCPUUsage(),
        diskUsage: this.measureDiskUsage()
      }
    };

    this.snapshots.push(snapshot);

    // Keep only recent snapshots
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Check thresholds and emit alerts
    this.checkThresholds(snapshot);

    this.emit('snapshot', snapshot);
  }

  /**
   * Check performance thresholds and generate alerts
   */
  private checkThresholds(snapshot: PerformanceSnapshot): void {
    for (const threshold of this.thresholds) {
      const metricValue = snapshot.metrics[threshold.metric as keyof typeof snapshot.metrics];
      
      if (metricValue >= threshold.critical) {
        this.generateAlert(threshold.metric, metricValue, threshold.critical, 'critical');
      } else if (metricValue >= threshold.warning) {
        this.generateAlert(threshold.metric, metricValue, threshold.warning, 'warning');
      }
    }
  }

  /**
   * Generate performance alert
   */
  private generateAlert(metric: string, value: number, threshold: number, level: 'warning' | 'critical'): void {
    const now = new Date();
    const lastAlert = this.lastAlerts.get(metric);

    // Check cooldown period
    if (lastAlert && (now.getTime() - lastAlert.getTime()) < this.alertCooldown) {
      return;
    }

    const alert: PerformanceAlert = {
      timestamp: now,
      metric,
      value,
      threshold,
      level,
      resolved: false
    };

    this.alerts.push(alert);
    this.lastAlerts.set(metric, now);

    const emoji = level === 'critical' ? '🚨' : '⚠️';
    const unit = this.thresholds.find(t => t.metric === metric)?.unit || '';
    
    console.log(`${emoji} Performance Alert: ${metric} = ${value.toFixed(2)}${unit} (threshold: ${threshold}${unit})`);
    
    this.emit('alert', alert);
  }

  /**
   * Measure setup detection time
   */
  private measureSetupDetection(): number {
    const start = performance.now();
    
    // Simulate setup detection
    const platform = process.platform;
    const arch = process.arch;
    const nodeVersion = process.version;
    
    // Simulate some detection work
    const _ = { platform, arch, nodeVersion };
    
    return performance.now() - start;
  }

  /**
   * Measure config loading time
   */
  private measureConfigLoading(): number {
    const start = performance.now();
    
    // Simulate config loading
    const configPath = join(getOrchFlowHome(), 'config', 'terminal.json');
    if (existsSync(configPath)) {
      try {
        readFileSync(configPath, 'utf-8');
      } catch (error) {
        // Ignore errors for benchmark
      }
    }
    
    return performance.now() - start;
  }

  /**
   * Measure user interaction response time
   */
  private measureUserInteraction(): number {
    const start = performance.now();
    
    // Simulate user interaction processing
    const input = 'test input';
    const processed = input.toLowerCase().split(' ');
    const response = { type: 'test', words: processed.length };
    
    // Simulate response generation
    const _ = response;
    
    return performance.now() - start;
  }

  /**
   * Measure memory footprint
   */
  private measureMemoryFootprint(): number {
    const usage = process.memoryUsage();
    return (usage.heapUsed + usage.external) / 1024 / 1024; // MB
  }

  /**
   * Measure CPU usage
   */
  private measureCPUUsage(): number {
    const startUsage = process.cpuUsage();
    
    // Simulate some CPU work
    const start = Date.now();
    while (Date.now() - start < 10) {
      // Busy wait for 10ms
    }
    
    const endUsage = process.cpuUsage(startUsage);
    const totalUsage = endUsage.user + endUsage.system;
    
    // Calculate percentage (rough approximation)
    return (totalUsage / 10000) * 100; // Convert to percentage
  }

  /**
   * Measure disk usage
   */
  private measureDiskUsage(): number {
    try {
      const fs = require('fs');
      const stats = fs.statSync(getOrchFlowHome());
      
      // This is a simplified calculation
      // In a real implementation, you'd calculate actual disk usage
      return Math.min(stats.size / 1024 / 1024, 100); // MB, capped at 100%
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get recent performance snapshots
   */
  getSnapshots(count: number = 10): PerformanceSnapshot[] {
    return this.snapshots.slice(-count);
  }

  /**
   * Get unresolved alerts
   */
  getActiveAlerts(): PerformanceAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertIndex: number): void {
    if (alertIndex >= 0 && alertIndex < this.alerts.length) {
      this.alerts[alertIndex].resolved = true;
      this.emit('alertResolved', this.alerts[alertIndex]);
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(): any {
    if (this.snapshots.length === 0) {
      return null;
    }

    const recent = this.snapshots.slice(-10);
    const metrics = ['setupDetection', 'configLoading', 'userInteraction', 'memoryFootprint', 'cpuUsage', 'diskUsage'];
    
    const stats: any = {};
    
    for (const metric of metrics) {
      const values = recent.map(s => s.metrics[metric as keyof typeof s.metrics]);
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);
      
      stats[metric] = {
        current: values[values.length - 1],
        average: avg,
        minimum: min,
        maximum: max,
        trend: this.calculateTrend(values)
      };
    }
    
    return stats;
  }

  /**
   * Calculate performance trend
   */
  private calculateTrend(values: number[]): 'stable' | 'improving' | 'degrading' {
    if (values.length < 3) return 'stable';
    
    const recent = values.slice(-3);
    const trend = recent[2] - recent[0];
    const threshold = recent[0] * 0.1; // 10% threshold
    
    if (Math.abs(trend) < threshold) return 'stable';
    return trend > 0 ? 'degrading' : 'improving';
  }

  /**
   * Export performance data
   */
  exportData(): string {
    const data = {
      snapshots: this.snapshots,
      alerts: this.alerts,
      statistics: this.getStatistics(),
      thresholds: this.thresholds,
      exportedAt: new Date().toISOString()
    };
    
    return JSON.stringify(data, null, 2);
  }

  /**
   * Save performance data to file
   */
  saveToFile(filename?: string): string {
    const defaultFilename = `performance-${new Date().toISOString().split('T')[0]}.json`;
    const filepath = join(getOrchFlowHome(), 'performance', filename || defaultFilename);
    
    // Ensure directory exists
    const fs = require('fs');
    const dir = join(getOrchFlowHome(), 'performance');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const data = this.exportData();
    writeFileSync(filepath, data);
    
    console.log(`📊 Performance data saved to: ${filepath}`);
    return filepath;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getStatistics();
    const activeAlerts = this.getActiveAlerts();
    
    if (!stats) {
      return 'No performance data available';
    }

    const report = `
📊 OrchFlow Performance Report
${'='.repeat(40)}

🎯 Current Performance:
  Setup Detection: ${stats.setupDetection.current.toFixed(2)}ms (${stats.setupDetection.trend})
  Config Loading: ${stats.configLoading.current.toFixed(2)}ms (${stats.configLoading.trend})
  User Interaction: ${stats.userInteraction.current.toFixed(2)}ms (${stats.userInteraction.trend})
  Memory Footprint: ${stats.memoryFootprint.current.toFixed(2)}MB (${stats.memoryFootprint.trend})
  CPU Usage: ${stats.cpuUsage.current.toFixed(2)}% (${stats.cpuUsage.trend})
  Disk Usage: ${stats.diskUsage.current.toFixed(2)}% (${stats.diskUsage.trend})

📈 Performance Averages:
  Setup Detection: ${stats.setupDetection.average.toFixed(2)}ms
  Config Loading: ${stats.configLoading.average.toFixed(2)}ms
  User Interaction: ${stats.userInteraction.average.toFixed(2)}ms
  Memory Footprint: ${stats.memoryFootprint.average.toFixed(2)}MB
  CPU Usage: ${stats.cpuUsage.average.toFixed(2)}%
  Disk Usage: ${stats.diskUsage.average.toFixed(2)}%

🚨 Active Alerts: ${activeAlerts.length}
${activeAlerts.map(alert => 
  `  ${alert.level === 'critical' ? '🚨' : '⚠️'} ${alert.metric}: ${alert.value.toFixed(2)} (threshold: ${alert.threshold})`
).join('\n')}

📊 Data Points: ${this.snapshots.length}
🕒 Last Updated: ${new Date().toLocaleString()}
`;

    return report;
  }
}

/**
 * Benchmark runner for performance testing
 */
export class PerformanceBenchmark {
  private iterations: number;
  private results: Map<string, number[]> = new Map();

  constructor(iterations: number = 100) {
    this.iterations = iterations;
  }

  /**
   * Run performance benchmark
   */
  async runBenchmark(): Promise<Map<string, any>> {
    console.log(`🏁 Running performance benchmark (${this.iterations} iterations)...`);
    
    const benchmarks = [
      { name: 'setupDetection', fn: this.benchmarkSetupDetection.bind(this) },
      { name: 'configLoading', fn: this.benchmarkConfigLoading.bind(this) },
      { name: 'userInteraction', fn: this.benchmarkUserInteraction.bind(this) },
      { name: 'memoryFootprint', fn: this.benchmarkMemoryFootprint.bind(this) }
    ];

    for (const benchmark of benchmarks) {
      const times = [];
      
      for (let i = 0; i < this.iterations; i++) {
        const time = await benchmark.fn();
        times.push(time);
        
        // Small delay between iterations
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      this.results.set(benchmark.name, times);
    }

    return this.analyzeResults();
  }

  /**
   * Benchmark setup detection
   */
  private async benchmarkSetupDetection(): Promise<number> {
    const start = performance.now();
    
    // Simulate environment detection
    const env = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage()
    };
    
    // Simulate some processing
    const _ = JSON.stringify(env);
    
    return performance.now() - start;
  }

  /**
   * Benchmark config loading
   */
  private async benchmarkConfigLoading(): Promise<number> {
    const start = performance.now();
    
    // Simulate config loading
    const config = {
      terminal: { splitRatio: 70, statusWidth: 30 },
      orchestrator: { maxWorkers: 8, poolSize: 4 },
      performance: { enableMetrics: true }
    };
    
    // Simulate JSON parsing
    const _ = JSON.parse(JSON.stringify(config));
    
    return performance.now() - start;
  }

  /**
   * Benchmark user interaction
   */
  private async benchmarkUserInteraction(): Promise<number> {
    const start = performance.now();
    
    // Simulate user input processing
    const input = 'create a new worker for testing';
    const words = input.split(' ');
    const response = {
      type: 'command',
      action: 'create_worker',
      parameters: { purpose: 'testing', wordCount: words.length }
    };
    
    // Simulate response serialization
    const _ = JSON.stringify(response);
    
    return performance.now() - start;
  }

  /**
   * Benchmark memory footprint
   */
  private async benchmarkMemoryFootprint(): Promise<number> {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Simulate memory usage
    const data = Array.from({ length: 1000 }, (_, i) => ({ id: i, value: Math.random() }));
    
    const finalMemory = process.memoryUsage().heapUsed;
    const additionalMemory = (finalMemory - initialMemory) / 1024 / 1024; // MB
    
    // Clean up
    data.length = 0;
    
    return additionalMemory;
  }

  /**
   * Analyze benchmark results
   */
  private analyzeResults(): Map<string, any> {
    const analysis = new Map();
    
    for (const [name, times] of this.results) {
      const sorted = times.slice().sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      
      const stats = {
        min: Math.min(...times),
        max: Math.max(...times),
        average: sum / times.length,
        median: sorted[Math.floor(sorted.length / 2)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        stddev: this.calculateStdDev(times, sum / times.length)
      };
      
      analysis.set(name, stats);
    }
    
    return analysis;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Generate benchmark report
   */
  generateReport(): string {
    const analysis = this.analyzeResults();
    
    let report = `
🏁 Performance Benchmark Report
${'='.repeat(40)}

📊 Results (${this.iterations} iterations):

`;
    
    for (const [name, stats] of analysis) {
      const unit = name === 'memoryFootprint' ? 'MB' : 'ms';
      
      report += `📈 ${name}:
`;
      report += `  Average: ${stats.average.toFixed(2)}${unit}
`;
      report += `  Median: ${stats.median.toFixed(2)}${unit}
`;
      report += `  Min: ${stats.min.toFixed(2)}${unit}
`;
      report += `  Max: ${stats.max.toFixed(2)}${unit}
`;
      report += `  95th percentile: ${stats.p95.toFixed(2)}${unit}
`;
      report += `  99th percentile: ${stats.p99.toFixed(2)}${unit}
`;
      report += `  Std Dev: ${stats.stddev.toFixed(2)}${unit}
`;
      report += `\n`;
    }
    
    report += `🕒 Benchmark completed at: ${new Date().toLocaleString()}`;
    
    return report;
  }
}
