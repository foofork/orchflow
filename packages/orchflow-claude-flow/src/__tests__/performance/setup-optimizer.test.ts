/**
 * Tests for Setup Optimizer
 */

import { SetupOptimizer, CachedConfigManager, EnvironmentDetector, MemoryOptimizer } from '../../performance/setup-optimizer';
import { performance } from 'perf_hooks';

describe('SetupOptimizer', () => {
  let optimizer: SetupOptimizer;

  beforeEach(() => {
    optimizer = new SetupOptimizer();
  });

  describe('Performance Targets', () => {
    it('should meet setup detection target (<200ms)', async () => {
      const detectionTime = await optimizer.measureSetupDetection();
      expect(detectionTime).toBeLessThan(200);
    });

    it('should meet config loading target (<50ms)', async () => {
      const loadingTime = await optimizer.measureConfigLoading();
      expect(loadingTime).toBeLessThan(50);
    });

    it('should meet user interaction target (<100ms)', async () => {
      const interactionTime = await optimizer.measureUserInteraction();
      expect(interactionTime).toBeLessThan(100);
    });

    it('should meet memory footprint target (<10MB)', () => {
      const memoryFootprint = optimizer.measureMemoryFootprint();
      expect(memoryFootprint).toBeLessThan(10);
    });
  });

  describe('Optimization Process', () => {
    it('should optimize setup successfully', async () => {
      await expect(optimizer.optimizeSetup()).resolves.not.toThrow();
    });

    it('should generate optimization report', async () => {
      const report = await optimizer.generateOptimizationReport();
      expect(report).toContain('Performance Optimization Report');
      expect(report).toContain('Setup Detection:');
      expect(report).toContain('Config Loading:');
      expect(report).toContain('User Interaction:');
      expect(report).toContain('Memory Footprint:');
    });

    it('should provide performance metrics', async () => {
      await optimizer.runBenchmark();
      const metrics = optimizer.getMetrics();

      expect(metrics).toHaveProperty('setupDetection');
      expect(metrics).toHaveProperty('configLoading');
      expect(metrics).toHaveProperty('userInteraction');
      expect(metrics).toHaveProperty('memoryFootprint');

      expect(typeof metrics.setupDetection).toBe('number');
      expect(typeof metrics.configLoading).toBe('number');
      expect(typeof metrics.userInteraction).toBe('number');
      expect(typeof metrics.memoryFootprint).toBe('number');
    });
  });

  describe('Benchmark Results', () => {
    it('should run benchmark and return results', async () => {
      const results = await optimizer.runBenchmark();

      expect(results).toHaveProperty('setupDetection');
      expect(results).toHaveProperty('configLoading');
      expect(results).toHaveProperty('userInteraction');
      expect(results).toHaveProperty('memoryFootprint');

      // All results should be positive numbers
      expect(results.setupDetection).toBeGreaterThan(0);
      expect(results.configLoading).toBeGreaterThan(0);
      expect(results.userInteraction).toBeGreaterThan(0);
      expect(results.memoryFootprint).toBeGreaterThan(0);
    });
  });
});

describe('CachedConfigManager', () => {
  let configManager: CachedConfigManager;

  beforeEach(() => {
    configManager = new CachedConfigManager();
  });

  describe('Configuration Loading', () => {
    it('should load configuration quickly', async () => {
      const startTime = performance.now();
      const config = await configManager.loadConfig('terminal');
      const loadTime = performance.now() - startTime;

      expect(loadTime).toBeLessThan(50); // Target: <50ms
      expect(config).toBeDefined();
      expect(typeof config).toBe('object');
    });

    it('should cache configurations for faster subsequent access', async () => {
      // First load
      const startTime1 = performance.now();
      const config1 = await configManager.loadConfig('terminal');
      const loadTime1 = performance.now() - startTime1;

      // Second load (should be cached)
      const startTime2 = performance.now();
      const config2 = await configManager.loadConfig('terminal');
      const loadTime2 = performance.now() - startTime2;

      expect(loadTime2).toBeLessThan(loadTime1);
      expect(config1).toEqual(config2);
    });

    it('should preload essential configurations', () => {
      expect(() => configManager.preloadEssentialConfigs()).not.toThrow();
    });
  });

  describe('Default Configurations', () => {
    it('should provide default terminal configuration', async () => {
      const config = await configManager.loadConfig('terminal');

      expect(config).toHaveProperty('splitRatio', 70);
      expect(config).toHaveProperty('statusWidth', 30);
      expect(config).toHaveProperty('quickAccessKeys');
      expect(config).toHaveProperty('enableAnimations', false);
    });

    it('should provide default orchestrator configuration', async () => {
      const config = await configManager.loadConfig('orchestrator');

      expect(config).toHaveProperty('maxWorkers', 8);
      expect(config).toHaveProperty('poolSize', 4);
      expect(config).toHaveProperty('enableCaching', true);
      expect(config).toHaveProperty('cacheSize', 1000);
    });
  });
});

describe('EnvironmentDetector', () => {
  describe('Environment Detection', () => {
    it('should detect environment quickly', async () => {
      const startTime = performance.now();
      const env = await EnvironmentDetector.detectEnvironment();
      const detectionTime = performance.now() - startTime;

      expect(detectionTime).toBeLessThan(200); // Target: <200ms
      expect(env).toBeDefined();
    });

    it('should provide complete environment information', async () => {
      const env = await EnvironmentDetector.detectEnvironment();

      expect(env).toHaveProperty('platform');
      expect(env).toHaveProperty('arch');
      expect(env).toHaveProperty('nodeVersion');
      expect(env).toHaveProperty('isCI');
      expect(env).toHaveProperty('hasTmux');
      expect(env).toHaveProperty('hasClaudeFlow');
      expect(env).toHaveProperty('memoryUsage');
      expect(env).toHaveProperty('cpuCount');

      expect(typeof env.platform).toBe('string');
      expect(typeof env.arch).toBe('string');
      expect(typeof env.nodeVersion).toBe('string');
      expect(typeof env.isCI).toBe('boolean');
      expect(typeof env.hasTmux).toBe('boolean');
      expect(typeof env.hasClaudeFlow).toBe('boolean');
      expect(typeof env.memoryUsage).toBe('object');
      expect(typeof env.cpuCount).toBe('number');
    });

    it('should cache environment detection results', async () => {
      // First detection
      const startTime1 = performance.now();
      const env1 = await EnvironmentDetector.detectEnvironment();
      const detectionTime1 = performance.now() - startTime1;

      // Second detection (should be cached)
      const startTime2 = performance.now();
      const env2 = await EnvironmentDetector.detectEnvironment();
      const detectionTime2 = performance.now() - startTime2;

      expect(detectionTime2).toBeLessThan(detectionTime1);
      expect(env1).toEqual(env2);
    });
  });
});

describe('MemoryOptimizer', () => {
  let memoryOptimizer: MemoryOptimizer;

  beforeEach(() => {
    memoryOptimizer = new MemoryOptimizer();
  });

  describe('Memory Monitoring', () => {
    it('should track memory usage', () => {
      const initialUsage = memoryOptimizer.getCurrentMemoryUsage();
      expect(typeof initialUsage).toBe('number');
      expect(initialUsage).toBeGreaterThan(0);
    });

    it('should calculate additional memory usage', () => {
      const additionalUsage = memoryOptimizer.getAdditionalMemoryUsage();
      expect(typeof additionalUsage).toBe('number');
    });

    it('should check memory targets', () => {
      const withinTarget = memoryOptimizer.checkMemoryTarget();
      expect(typeof withinTarget).toBe('boolean');
    });

    it('should provide memory trend analysis', () => {
      const trend = memoryOptimizer.getMemoryTrend();
      expect(['stable', 'increasing', 'decreasing']).toContain(trend);
    });
  });

  describe('Memory Optimization', () => {
    it('should force garbage collection if available', () => {
      expect(() => memoryOptimizer.forceGarbageCollection()).not.toThrow();
    });

    it('should start memory monitoring', () => {
      expect(() => memoryOptimizer.startMemoryMonitoring()).not.toThrow();
    });
  });
});

describe('Performance Integration', () => {
  it('should meet all performance targets in integration', async () => {
    const optimizer = new SetupOptimizer();

    // Run optimization
    await optimizer.optimizeSetup();

    // Run benchmark
    const results = await optimizer.runBenchmark();

    // Verify all targets are met
    expect(results.setupDetection).toBeLessThan(200);
    expect(results.configLoading).toBeLessThan(50);
    expect(results.userInteraction).toBeLessThan(100);
    expect(results.memoryFootprint).toBeLessThan(10);
  });

  it('should handle multiple optimization cycles', async () => {
    const optimizer = new SetupOptimizer();

    // Run multiple optimization cycles
    for (let i = 0; i < 3; i++) {
      await optimizer.optimizeSetup();
      const results = await optimizer.runBenchmark();

      // Each cycle should maintain performance
      expect(results.setupDetection).toBeLessThan(200);
      expect(results.configLoading).toBeLessThan(50);
      expect(results.userInteraction).toBeLessThan(100);
      expect(results.memoryFootprint).toBeLessThan(10);
    }
  });

  it('should provide consistent performance under load', async () => {
    const optimizer = new SetupOptimizer();
    await optimizer.optimizeSetup();

    // Run multiple concurrent operations
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(optimizer.measureSetupDetection());
      promises.push(optimizer.measureConfigLoading());
      promises.push(optimizer.measureUserInteraction());
    }

    const results = await Promise.all(promises);

    // All results should meet targets
    const setupTimes = results.filter((_, index) => index % 3 === 0);
    const configTimes = results.filter((_, index) => index % 3 === 1);
    const interactionTimes = results.filter((_, index) => index % 3 === 2);

    expect(setupTimes.every(time => time < 200)).toBe(true);
    expect(configTimes.every(time => time < 50)).toBe(true);
    expect(interactionTimes.every(time => time < 100)).toBe(true);
  });
});
