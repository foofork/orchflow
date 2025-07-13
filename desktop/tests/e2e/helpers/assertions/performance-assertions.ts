import { expect } from '@playwright/test';
import type { PerformanceMonitor, PerformanceReport } from '../utilities/performance-monitor';

export interface PerformanceAssertions {
  toHaveLoadTimeUnder(milliseconds: number): Promise<void>;
  toHaveAverageFPSAbove(fps: number): Promise<void>;
  toHaveMemoryUsageUnder(megabytes: number): Promise<void>;
  toHaveCPUUsageUnder(percentage: number): Promise<void>;
  toHaveNoMemoryLeaks(): Promise<void>;
  toHaveNoCPUSpikes(threshold?: number): Promise<void>;
  toHaveNoSlowRequests(threshold?: number): Promise<void>;
  toMeetPerformanceBudget(): Promise<void>;
  toHaveLCPUnder(milliseconds: number): Promise<void>;
  toHaveFIDUnder(milliseconds: number): Promise<void>;
  toHaveCLSUnder(score: number): Promise<void>;
}

export function createPerformanceAssertions(monitor: PerformanceMonitor): PerformanceAssertions {
  return {
    async toHaveLoadTimeUnder(milliseconds: number): Promise<void> {
      const report = monitor.generateReport();
      const loadMetric = report.metrics.find(m => m.name === 'loadComplete');
      
      if (!loadMetric) {
        throw new Error('Load time metric not found. Ensure page load was monitored.');
      }
      
      expect(loadMetric.value).toBeLessThan(milliseconds);
    },

    async toHaveAverageFPSAbove(fps: number): Promise<void> {
      const avgFPS = monitor.getAverageFPS();
      expect(avgFPS).toBeGreaterThan(fps);
    },

    async toHaveMemoryUsageUnder(megabytes: number): Promise<void> {
      const report = monitor.generateReport();
      const maxMemory = Math.max(...report.memory.map(m => m.usedJSHeapSize));
      const maxMemoryMB = maxMemory / (1024 * 1024);
      
      expect(maxMemoryMB).toBeLessThan(megabytes);
    },

    async toHaveCPUUsageUnder(percentage: number): Promise<void> {
      const report = monitor.generateReport();
      const maxCPU = Math.max(...report.cpu.map(c => c.usage));
      
      expect(maxCPU).toBeLessThan(percentage);
    },

    async toHaveNoMemoryLeaks(): Promise<void> {
      const hasLeaks = await monitor.checkMemoryLeak();
      expect(hasLeaks).toBeFalsy();
    },

    async toHaveNoCPUSpikes(threshold = 80): Promise<void> {
      const spikes = monitor.detectCPUSpikes(threshold);
      expect(spikes).toBe(0);
    },

    async toHaveNoSlowRequests(threshold = 1000): Promise<void> {
      const slowRequests = monitor.getSlowRequests(threshold);
      expect(slowRequests).toBe(0);
    },

    async toMeetPerformanceBudget(): Promise<void> {
      const validation = await monitor.validatePerformanceBudget();
      
      if (!validation.passed) {
        throw new Error(`Performance budget violations:\n${validation.violations.join('\n')}`);
      }
    },

    async toHaveLCPUnder(milliseconds: number): Promise<void> {
      const report = monitor.generateReport();
      const lcpMetric = report.metrics.find(m => m.name === 'largestContentfulPaint');
      
      if (!lcpMetric) {
        throw new Error('LCP metric not found. Ensure Core Web Vitals were monitored.');
      }
      
      expect(lcpMetric.value).toBeLessThan(milliseconds);
    },

    async toHaveFIDUnder(milliseconds: number): Promise<void> {
      const report = monitor.generateReport();
      const fidMetric = report.metrics.find(m => m.name === 'firstInputDelay');
      
      if (!fidMetric) {
        throw new Error('FID metric not found. Ensure Core Web Vitals were monitored.');
      }
      
      expect(fidMetric.value).toBeLessThan(milliseconds);
    },

    async toHaveCLSUnder(score: number): Promise<void> {
      const report = monitor.generateReport();
      const clsMetric = report.metrics.find(m => m.name === 'cumulativeLayoutShift');
      
      if (!clsMetric) {
        throw new Error('CLS metric not found. Ensure Core Web Vitals were monitored.');
      }
      
      expect(clsMetric.value).toBeLessThan(score);
    }
  };
}

// Performance thresholds based on Google's recommendations
export const PERFORMANCE_THRESHOLDS = {
  GOOD: {
    LCP: 2500,      // 2.5 seconds
    FID: 100,       // 100 milliseconds
    CLS: 0.1,       // 0.1 score
    FPS: 55,        // 55+ FPS
    CPU: 70,        // 70% CPU usage
    MEMORY_GROWTH: 10 // 10% memory growth
  },
  NEEDS_IMPROVEMENT: {
    LCP: 4000,      // 4 seconds
    FID: 300,       // 300 milliseconds
    CLS: 0.25,      // 0.25 score
    FPS: 30,        // 30+ FPS
    CPU: 85,        // 85% CPU usage
    MEMORY_GROWTH: 25 // 25% memory growth
  }
};

// Comprehensive performance assertion
export async function assertPerformance(
  monitor: PerformanceMonitor,
  level: 'GOOD' | 'NEEDS_IMPROVEMENT' = 'GOOD'
): Promise<void> {
  const thresholds = PERFORMANCE_THRESHOLDS[level];
  const report = monitor.generateReport();
  const failures: string[] = [];

  // Check Core Web Vitals
  const lcpMetric = report.metrics.find(m => m.name === 'largestContentfulPaint');
  if (lcpMetric && lcpMetric.value > thresholds.LCP) {
    failures.push(`LCP: ${lcpMetric.value}ms exceeds threshold of ${thresholds.LCP}ms`);
  }

  const fidMetric = report.metrics.find(m => m.name === 'firstInputDelay');
  if (fidMetric && fidMetric.value > thresholds.FID) {
    failures.push(`FID: ${fidMetric.value}ms exceeds threshold of ${thresholds.FID}ms`);
  }

  const clsMetric = report.metrics.find(m => m.name === 'cumulativeLayoutShift');
  if (clsMetric && clsMetric.value > thresholds.CLS) {
    failures.push(`CLS: ${clsMetric.value} exceeds threshold of ${thresholds.CLS}`);
  }

  // Check runtime performance
  const avgFPS = monitor.getAverageFPS();
  if (avgFPS < thresholds.FPS) {
    failures.push(`Average FPS: ${avgFPS} is below threshold of ${thresholds.FPS}`);
  }

  const cpuSpikes = monitor.detectCPUSpikes(thresholds.CPU);
  if (cpuSpikes > 0) {
    failures.push(`CPU spikes: ${cpuSpikes} times exceeded ${thresholds.CPU}%`);
  }

  const hasMemoryLeak = await monitor.checkMemoryLeak(thresholds.MEMORY_GROWTH);
  if (hasMemoryLeak) {
    failures.push(`Memory leak detected: growth exceeded ${thresholds.MEMORY_GROWTH}%`);
  }

  if (failures.length > 0) {
    throw new Error(`Performance assertions failed:\n${failures.join('\n')}`);
  }
}

// Action performance assertion
export async function assertActionPerformance<T>(
  monitor: PerformanceMonitor,
  actionName: string,
  action: () => Promise<T>,
  expectations: {
    maxDuration?: number;
    maxMemoryDelta?: number;
    maxCPUUsage?: number;
    noErrors?: boolean;
  }
): Promise<T> {
  // Record initial state
  const initialReport = monitor.generateReport();
  const initialMemory = initialReport.memory[initialReport.memory.length - 1]?.usedJSHeapSize || 0;

  // Perform action with measurement
  const { result, duration } = await monitor.measureAction(actionName, action);

  // Wait a bit for metrics to stabilize
  await monitor.page.waitForTimeout(100);

  // Check expectations
  if (expectations.maxDuration !== undefined && duration > expectations.maxDuration) {
    throw new Error(`Action '${actionName}' took ${duration}ms, exceeding limit of ${expectations.maxDuration}ms`);
  }

  if (expectations.maxMemoryDelta !== undefined) {
    const finalReport = monitor.generateReport();
    const finalMemory = finalReport.memory[finalReport.memory.length - 1]?.usedJSHeapSize || 0;
    const memoryDelta = (finalMemory - initialMemory) / (1024 * 1024); // Convert to MB

    if (memoryDelta > expectations.maxMemoryDelta) {
      throw new Error(`Action '${actionName}' increased memory by ${memoryDelta.toFixed(2)}MB, exceeding limit of ${expectations.maxMemoryDelta}MB`);
    }
  }

  if (expectations.maxCPUUsage !== undefined) {
    const finalReport = monitor.generateReport();
    const recentCPU = finalReport.cpu.slice(-5); // Last 5 measurements
    const maxCPU = Math.max(...recentCPU.map(c => c.usage));

    if (maxCPU > expectations.maxCPUUsage) {
      throw new Error(`Action '${actionName}' caused CPU usage of ${maxCPU.toFixed(1)}%, exceeding limit of ${expectations.maxCPUUsage}%`);
    }
  }

  return result;
}

// Render performance assertion
export async function assertRenderPerformance(
  monitor: PerformanceMonitor,
  expectations: {
    minFPS?: number;
    maxJank?: number;
    maxLongTasks?: number;
    smoothScrolling?: boolean;
  }
): Promise<void> {
  const report = monitor.generateReport();
  const failures: string[] = [];

  if (expectations.minFPS !== undefined) {
    const avgFPS = monitor.getAverageFPS();
    if (avgFPS < expectations.minFPS) {
      failures.push(`Average FPS ${avgFPS} is below minimum ${expectations.minFPS}`);
    }
  }

  if (expectations.maxJank !== undefined) {
    const totalJank = monitor.getTotalJank();
    if (totalJank > expectations.maxJank) {
      failures.push(`Total jank ${totalJank} exceeds maximum ${expectations.maxJank}`);
    }
  }

  if (expectations.maxLongTasks !== undefined) {
    const longTasks = report.render.reduce((sum, r) => sum + r.longTasks, 0);
    if (longTasks > expectations.maxLongTasks) {
      failures.push(`Long tasks ${longTasks} exceed maximum ${expectations.maxLongTasks}`);
    }
  }

  if (expectations.smoothScrolling) {
    const recentRender = report.render.slice(-10);
    const lowFPSCount = recentRender.filter(r => r.fps < 50).length;
    if (lowFPSCount > 2) {
      failures.push(`Scrolling not smooth: ${lowFPSCount} frames below 50 FPS`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Render performance assertions failed:\n${failures.join('\n')}`);
  }
}

// Network performance assertion
export async function assertNetworkPerformance(
  monitor: PerformanceMonitor,
  expectations: {
    maxRequests?: number;
    maxBandwidth?: number; // in MB
    maxAverageLatency?: number;
    noFailedRequests?: boolean;
  }
): Promise<void> {
  const report = monitor.generateReport();
  const failures: string[] = [];

  const totalRequests = report.network.reduce((sum, n) => sum + n.requests, 0);
  const totalBytes = report.network.reduce((sum, n) => sum + n.bytesReceived + n.bytesSent, 0);
  const avgLatency = report.network.reduce((sum, n) => sum + n.averageLatency, 0) / report.network.length;

  if (expectations.maxRequests !== undefined && totalRequests > expectations.maxRequests) {
    failures.push(`Total requests ${totalRequests} exceed maximum ${expectations.maxRequests}`);
  }

  if (expectations.maxBandwidth !== undefined) {
    const totalMB = totalBytes / (1024 * 1024);
    if (totalMB > expectations.maxBandwidth) {
      failures.push(`Total bandwidth ${totalMB.toFixed(2)}MB exceeds maximum ${expectations.maxBandwidth}MB`);
    }
  }

  if (expectations.maxAverageLatency !== undefined && avgLatency > expectations.maxAverageLatency) {
    failures.push(`Average latency ${avgLatency.toFixed(0)}ms exceeds maximum ${expectations.maxAverageLatency}ms`);
  }

  if (failures.length > 0) {
    throw new Error(`Network performance assertions failed:\n${failures.join('\n')}`);
  }
}

// Performance comparison assertion
export async function assertPerformanceImprovement(
  beforeReport: PerformanceReport,
  afterReport: PerformanceReport,
  expectations: {
    fpsImprovement?: number; // percentage
    memoryReduction?: number; // percentage
    loadTimeReduction?: number; // percentage
    cpuReduction?: number; // percentage
  }
): Promise<void> {
  const failures: string[] = [];

  if (expectations.fpsImprovement !== undefined) {
    const beforeFPS = beforeReport.summary.averageFPS;
    const afterFPS = afterReport.summary.averageFPS;
    const improvement = ((afterFPS - beforeFPS) / beforeFPS) * 100;

    if (improvement < expectations.fpsImprovement) {
      failures.push(`FPS improvement ${improvement.toFixed(1)}% is less than expected ${expectations.fpsImprovement}%`);
    }
  }

  if (expectations.memoryReduction !== undefined) {
    const beforeMemory = Math.max(...beforeReport.memory.map(m => m.usedJSHeapSize));
    const afterMemory = Math.max(...afterReport.memory.map(m => m.usedJSHeapSize));
    const reduction = ((beforeMemory - afterMemory) / beforeMemory) * 100;

    if (reduction < expectations.memoryReduction) {
      failures.push(`Memory reduction ${reduction.toFixed(1)}% is less than expected ${expectations.memoryReduction}%`);
    }
  }

  if (expectations.loadTimeReduction !== undefined) {
    const beforeLoad = beforeReport.metrics.find(m => m.name === 'loadComplete')?.value || 0;
    const afterLoad = afterReport.metrics.find(m => m.name === 'loadComplete')?.value || 0;
    const reduction = ((beforeLoad - afterLoad) / beforeLoad) * 100;

    if (reduction < expectations.loadTimeReduction) {
      failures.push(`Load time reduction ${reduction.toFixed(1)}% is less than expected ${expectations.loadTimeReduction}%`);
    }
  }

  if (expectations.cpuReduction !== undefined) {
    const beforeCPU = Math.max(...beforeReport.cpu.map(c => c.usage));
    const afterCPU = Math.max(...afterReport.cpu.map(c => c.usage));
    const reduction = ((beforeCPU - afterCPU) / beforeCPU) * 100;

    if (reduction < expectations.cpuReduction) {
      failures.push(`CPU reduction ${reduction.toFixed(1)}% is less than expected ${expectations.cpuReduction}%`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Performance improvement assertions failed:\n${failures.join('\n')}`);
  }
}