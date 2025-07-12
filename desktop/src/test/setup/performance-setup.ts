import { performance } from 'perf_hooks';

/**
 * Performance Test Setup
 * 
 * Global setup for performance and benchmark tests
 */

// Performance measurement utilities
export class PerformanceMeasurement {
  private startTime: number;
  private measurements: Map<string, number[]> = new Map();
  
  start(): void {
    this.startTime = performance.now();
  }
  
  end(label: string): number {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    if (!this.measurements.has(label)) {
      this.measurements.set(label, []);
    }
    this.measurements.get(label)!.push(duration);
    
    return duration;
  }
  
  getStats(label: string): { min: number; max: number; avg: number; count: number } | null {
    const measurements = this.measurements.get(label);
    if (!measurements || measurements.length === 0) {
      return null;
    }
    
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);
    const avg = measurements.reduce((a, b) => a + b, 0) / measurements.length;
    
    return { min, max, avg, count: measurements.length };
  }
  
  reset(): void {
    this.measurements.clear();
  }
}

// Memory measurement utilities
export class MemoryMeasurement {
  private initialMemory: NodeJS.MemoryUsage;
  
  start(): void {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    this.initialMemory = process.memoryUsage();
  }
  
  end(): {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
    heapDelta: number;
  } {
    const finalMemory = process.memoryUsage();
    
    return {
      heapUsed: finalMemory.heapUsed,
      heapTotal: finalMemory.heapTotal,
      external: finalMemory.external,
      rss: finalMemory.rss,
      heapDelta: finalMemory.heapUsed - this.initialMemory.heapUsed,
    };
  }
}

// Performance regression detection
export class RegressionDetector {
  private baselines: Map<string, number> = new Map();
  
  setBaseline(testName: string, value: number): void {
    this.baselines.set(testName, value);
  }
  
  checkRegression(testName: string, currentValue: number, threshold = 1.2): {
    isRegression: boolean;
    percentage: number;
    baseline: number | null;
  } {
    const baseline = this.baselines.get(testName);
    
    if (!baseline) {
      return { isRegression: false, percentage: 0, baseline: null };
    }
    
    const percentage = currentValue / baseline;
    const isRegression = percentage > threshold;
    
    return { isRegression, percentage, baseline };
  }
}

// Global performance utilities
export const perf = new PerformanceMeasurement();
export const memory = new MemoryMeasurement();
export const regression = new RegressionDetector();

// Load baselines from previous runs
try {
  const fs = require('fs');
  const path = require('path');
  const baselinesPath = path.join(process.cwd(), 'test-results', 'performance-baselines.json');
  
  if (fs.existsSync(baselinesPath)) {
    const baselines = JSON.parse(fs.readFileSync(baselinesPath, 'utf-8'));
    Object.entries(baselines).forEach(([key, value]) => {
      regression.setBaseline(key, value as number);
    });
  }
} catch (error) {
  console.warn('Could not load performance baselines:', error);
}

// Save baselines after all tests
export function saveBaselines(): void {
  try {
    const fs = require('fs');
    const path = require('path');
    
    // Ensure results directory exists
    const resultsDir = path.join(process.cwd(), 'test-results');
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    // Save current measurements as new baselines
    const baselines: Record<string, number> = {};
    // This would need to be populated during test execution
    
    const baselinesPath = path.join(resultsDir, 'performance-baselines.json');
    fs.writeFileSync(baselinesPath, JSON.stringify(baselines, null, 2));
  } catch (error) {
    console.warn('Could not save performance baselines:', error);
  }
}

// Performance test helpers
export function measureAsync<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  return new Promise(async (resolve) => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    resolve({ result, duration });
  });
}

export function measureSync<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

export function measureMemory<T>(fn: () => T): { result: T; memoryDelta: number } {
  if (global.gc) global.gc();
  const startMemory = process.memoryUsage().heapUsed;
  
  const result = fn();
  
  if (global.gc) global.gc();
  const endMemory = process.memoryUsage().heapUsed;
  const memoryDelta = endMemory - startMemory;
  
  return { result, memoryDelta };
}

// Setup and teardown
beforeEach(() => {
  perf.reset();
});

afterAll(() => {
  saveBaselines();
});