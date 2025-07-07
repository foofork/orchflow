import { EventBus, OrchflowEvents } from '../core/event-bus';

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface MetricSummary {
  name: string;
  type: string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p90: number;
  p99: number;
  tags: Record<string, string>;
}

export class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private flushInterval: NodeJS.Timer;
  private retentionMs: number;
  
  constructor(
    private flushIntervalMs: number = 60000, // 1 minute
    retentionHours: number = 24
  ) {
    this.retentionMs = retentionHours * 60 * 60 * 1000;
    this.setupEventHandlers();
    this.startFlushTimer();
  }
  
  private setupEventHandlers(): void {
    // Agent metrics
    EventBus.on(OrchflowEvents.AGENT_CREATED, () => {
      this.increment('agents.created');
    });
    
    EventBus.on(OrchflowEvents.AGENT_STOPPED, () => {
      this.increment('agents.stopped');
    });
    
    EventBus.on(OrchflowEvents.AGENT_ERROR, () => {
      this.increment('agents.errors');
    });
    
    // Command metrics
    EventBus.on(OrchflowEvents.COMMAND_EXECUTED, ({ command }) => {
      this.increment('commands.executed');
      this.increment(`commands.by_type.${this.getCommandType(command)}`);
    });
    
    EventBus.on(OrchflowEvents.COMMAND_COMPLETED, () => {
      this.increment('commands.completed');
    });
    
    EventBus.on(OrchflowEvents.COMMAND_FAILED, () => {
      this.increment('commands.failed');
    });
    
    // System metrics
    EventBus.on(OrchflowEvents.SYSTEM_ERROR, () => {
      this.increment('system.errors');
    });
    
    // WebSocket metrics
    EventBus.on(OrchflowEvents.WS_CLIENT_CONNECTED, () => {
      this.increment('websocket.connections');
      this.gauge('websocket.active_connections', 1, 'add');
    });
    
    EventBus.on(OrchflowEvents.WS_CLIENT_DISCONNECTED, () => {
      this.gauge('websocket.active_connections', -1, 'add');
    });
    
    // Terminal metrics
    EventBus.on(OrchflowEvents.TERMINAL_SPAWNED, () => {
      this.increment('terminals.spawned');
      this.gauge('terminals.active', 1, 'add');
    });
    
    EventBus.on(OrchflowEvents.TERMINAL_CLOSED, () => {
      this.increment('terminals.closed');
      this.gauge('terminals.active', -1, 'add');
    });
  }
  
  private startFlushTimer(): void {
    this.flushInterval = setInterval(() => {
      this.flush();
      this.cleanup();
    }, this.flushIntervalMs);
  }
  
  // Counter: Only goes up
  increment(name: string, value: number = 1, tags: Record<string, string> = {}): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    
    this.record({
      name,
      value: current + value,
      timestamp: new Date(),
      tags,
      type: 'counter',
    });
  }
  
  // Gauge: Can go up or down
  gauge(name: string, value: number, operation: 'set' | 'add' = 'set', tags: Record<string, string> = {}): void {
    if (operation === 'set') {
      this.gauges.set(name, value);
    } else {
      const current = this.gauges.get(name) || 0;
      this.gauges.set(name, current + value);
    }
    
    this.record({
      name,
      value: this.gauges.get(name)!,
      timestamp: new Date(),
      tags,
      type: 'gauge',
    });
  }
  
  // Histogram: Track distribution of values
  histogram(name: string, value: number, tags: Record<string, string> = {}): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, []);
    }
    
    this.histograms.get(name)!.push(value);
    
    this.record({
      name,
      value,
      timestamp: new Date(),
      tags,
      type: 'histogram',
    });
  }
  
  // Timer: Measure duration
  timer(name: string, tags: Record<string, string> = {}): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.histogram(`${name}.duration_ms`, duration, tags);
    };
  }
  
  // Async timer
  async timeAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags: Record<string, string> = {}
  ): Promise<T> {
    const timer = this.timer(name, tags);
    
    try {
      const result = await fn();
      timer();
      this.increment(`${name}.success`, 1, tags);
      return result;
    } catch (error) {
      timer();
      this.increment(`${name}.failure`, 1, tags);
      throw error;
    }
  }
  
  private record(metric: Metric): void {
    const key = this.getMetricKey(metric);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    this.metrics.get(key)!.push(metric);
  }
  
  private getMetricKey(metric: Metric): string {
    const tagStr = Object.entries(metric.tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    
    return `${metric.name}:${metric.type}:${tagStr}`;
  }
  
  // Get summary statistics for a metric
  getSummary(name: string, type?: string): MetricSummary[] {
    const summaries: MetricSummary[] = [];
    
    for (const [key, metrics] of this.metrics) {
      const [metricName, metricType] = key.split(':');
      
      if (metricName !== name) continue;
      if (type && metricType !== type) continue;
      
      const values = metrics.map(m => m.value).sort((a, b) => a - b);
      
      if (values.length === 0) continue;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      
      summaries.push({
        name: metricName,
        type: metricType,
        count: values.length,
        sum,
        min: values[0],
        max: values[values.length - 1],
        avg,
        p50: this.percentile(values, 0.5),
        p90: this.percentile(values, 0.9),
        p99: this.percentile(values, 0.99),
        tags: metrics[0]?.tags || {},
      });
    }
    
    return summaries;
  }
  
  // Get all metrics
  getAllMetrics(): Map<string, Metric[]> {
    return new Map(this.metrics);
  }
  
  // Get current counter values
  getCounters(): Map<string, number> {
    return new Map(this.counters);
  }
  
  // Get current gauge values
  getGauges(): Map<string, number> {
    return new Map(this.gauges);
  }
  
  // Get histogram data
  getHistograms(): Map<string, number[]> {
    return new Map(this.histograms);
  }
  
  private percentile(sortedValues: number[], p: number): number {
    const index = Math.ceil(sortedValues.length * p) - 1;
    return sortedValues[Math.max(0, index)];
  }
  
  private getCommandType(command: string): string {
    const cmd = command.toLowerCase();
    
    if (cmd.includes('test')) return 'test';
    if (cmd.includes('build')) return 'build';
    if (cmd.includes('dev') || cmd.includes('start')) return 'dev';
    if (cmd.includes('lint')) return 'lint';
    if (cmd.includes('debug')) return 'debug';
    
    return 'other';
  }
  
  // Flush metrics to console/external system
  private flush(): void {
    const timestamp = new Date().toISOString();
    
    console.log(`\n=== Metrics Flush ${timestamp} ===`);
    
    // Log counters
    for (const [name, value] of this.counters) {
      console.log(`Counter ${name}: ${value}`);
    }
    
    // Log gauges
    for (const [name, value] of this.gauges) {
      console.log(`Gauge ${name}: ${value}`);
    }
    
    // Log histogram summaries
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = values.sort((a, b) => a - b);
        console.log(`Histogram ${name}: count=${values.length}, ` +
          `min=${sorted[0]}, max=${sorted[sorted.length - 1]}, ` +
          `p50=${this.percentile(sorted, 0.5)}, ` +
          `p99=${this.percentile(sorted, 0.99)}`);
      }
    }
    
    console.log('=== End Metrics ===\n');
  }
  
  // Clean up old metrics
  private cleanup(): void {
    const cutoff = Date.now() - this.retentionMs;
    
    for (const [key, metrics] of this.metrics) {
      const filtered = metrics.filter(m => m.timestamp.getTime() > cutoff);
      
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
    
    // Clean up old histogram data
    for (const [name, values] of this.histograms) {
      if (values.length > 10000) {
        // Keep only recent values
        this.histograms.set(name, values.slice(-5000));
      }
    }
  }
  
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }
  
  destroy(): void {
    clearInterval(this.flushInterval);
    this.reset();
  }
}

// Global metrics collector instance
export const metricsCollector = new MetricsCollector();