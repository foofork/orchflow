/**
 * Performance Module Export
 * Centralized exports for all performance optimization components
 */

export { SetupOptimizer, CachedConfigManager, EnvironmentDetector, OptimizedInteractionHandler, MemoryOptimizer } from './setup-optimizer';
export { PerformanceMonitor, PerformanceBenchmark } from './performance-monitor';
export type { PerformanceMetrics, PerformanceTargets } from './setup-optimizer';

// Re-export performance CLI for programmatic usage
export { PerformanceCLI } from './performance-cli';

/**
 * Quick performance check function
 */
export async function quickPerformanceCheck(): Promise<{
  setupDetection: number;
  configLoading: number;
  userInteraction: number;
  memoryFootprint: number;
  allTargetsMet: boolean;
}> {
  const { SetupOptimizer } = await import('./setup-optimizer');
  const optimizer = new SetupOptimizer();
  
  const results = await optimizer.runBenchmark();
  
  return {
    setupDetection: results.setupDetection,
    configLoading: results.configLoading,
    userInteraction: results.userInteraction,
    memoryFootprint: results.memoryFootprint,
    allTargetsMet: (
      results.setupDetection < 200 &&
      results.configLoading < 50 &&
      results.userInteraction < 100 &&
      results.memoryFootprint < 10
    )
  };
}

/**
 * Initialize performance monitoring
 */
export async function initializePerformanceMonitoring(intervalMs: number = 5000): Promise<any> {
  const { PerformanceMonitor } = await import('./performance-monitor');
  const monitor = new PerformanceMonitor();
  
  monitor.start(intervalMs);
  
  return monitor;
}

/**
 * Run performance optimization
 */
export async function optimizePerformance(): Promise<void> {
  const { SetupOptimizer } = await import('./setup-optimizer');
  const optimizer = new SetupOptimizer();
  
  await optimizer.optimizeSetup();
  
  console.log('✅ Performance optimization completed');
}

/**
 * Generate performance report
 */
export async function generatePerformanceReport(): Promise<string> {
  const { SetupOptimizer } = await import('./setup-optimizer');
  const optimizer = new SetupOptimizer();
  
  await optimizer.optimizeSetup();
  return await optimizer.generateOptimizationReport();
}
