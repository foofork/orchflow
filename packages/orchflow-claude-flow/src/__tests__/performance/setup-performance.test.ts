/**
 * Setup Performance Benchmarks
 */

import { performance } from 'perf_hooks';
import { TerminalEnvironmentDetector } from '../../setup/terminal-environment-detector';
import { SetupFlowRouter } from '../../setup/setup-flow-router';
import { ConfigurationManager } from '../../managers/configuration-manager';
import { UnifiedSetupOrchestrator } from '../../setup/unified-setup-orchestrator';

describe('Setup Performance Benchmarks', () => {
  const PERFORMANCE_THRESHOLD = {
    DETECTION_TIME: 500, // ms
    ROUTING_TIME: 50, // ms
    CONFIG_LOAD_TIME: 100, // ms
    TOTAL_SETUP_TIME: 2000, // ms
    MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  };

  describe('Terminal Environment Detection', () => {
    let detector: TerminalEnvironmentDetector;

    beforeEach(() => {
      detector = TerminalEnvironmentDetector.getInstance();
      detector.clearCache();
    });

    it('should detect environment within performance threshold', async () => {
      const startTime = performance.now();
      await detector.detect(false);
      const endTime = performance.now();

      const detectionTime = endTime - startTime;
      expect(detectionTime).toBeLessThan(PERFORMANCE_THRESHOLD.DETECTION_TIME);
    });

    it('should use cache for subsequent detections', async () => {
      // First detection (cold)
      const startTime1 = performance.now();
      await detector.detect(true);
      const endTime1 = performance.now();
      const coldTime = endTime1 - startTime1;

      // Second detection (cached)
      const startTime2 = performance.now();
      await detector.detect(true);
      const endTime2 = performance.now();
      const cachedTime = endTime2 - startTime2;

      expect(cachedTime).toBeLessThan(coldTime);
      expect(cachedTime).toBeLessThan(10); // Should be near-instantaneous
    });

    it('should provide accurate performance metrics', async () => {
      await detector.detect(false);
      const metrics = detector.getPerformanceMetrics();

      expect(metrics).toBeDefined();
      expect(metrics!.detectionTime).toBeGreaterThan(0);
      expect(metrics!.detectionTime).toBeLessThan(PERFORMANCE_THRESHOLD.DETECTION_TIME);
    });
  });

  describe('Setup Flow Router', () => {
    let router: SetupFlowRouter;

    beforeEach(() => {
      router = SetupFlowRouter.getInstance();
    });

    it('should route flows within performance threshold', async () => {
      const detector = TerminalEnvironmentDetector.getInstance();
      const environment = await detector.detect();

      const startTime = performance.now();
      router.route(environment);
      const endTime = performance.now();

      const routingTime = endTime - startTime;
      expect(routingTime).toBeLessThan(PERFORMANCE_THRESHOLD.ROUTING_TIME);
    });

    it('should validate flows efficiently', async () => {
      const detector = TerminalEnvironmentDetector.getInstance();
      const environment = await detector.detect();
      const flows = router.getAvailableFlows();

      const startTime = performance.now();
      flows.forEach(flow => router.validateFlow(flow, environment));
      const endTime = performance.now();

      const validationTime = endTime - startTime;
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLD.ROUTING_TIME);
    });
  });

  describe('Configuration Management', () => {
    let configManager: OrchFlowConfigManager;

    beforeEach(() => {
      configManager = ConfigurationManager.getInstance();
    });

    it('should load configuration within performance threshold', async () => {
      const startTime = performance.now();
      await configManager.load();
      const endTime = performance.now();

      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLD.CONFIG_LOAD_TIME);
    });

    it('should save configuration efficiently', async () => {
      await configManager.load();

      const startTime = performance.now();
      await configManager.save();
      const endTime = performance.now();

      const saveTime = endTime - startTime;
      expect(saveTime).toBeLessThan(PERFORMANCE_THRESHOLD.CONFIG_LOAD_TIME);
    });

    it('should validate configuration quickly', async () => {
      const config = await configManager.load();

      const startTime = performance.now();
      configManager.validate(config);
      const endTime = performance.now();

      const validationTime = endTime - startTime;
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLD.ROUTING_TIME);
    });
  });

  describe('Unified Setup Orchestrator', () => {
    let orchestrator: UnifiedSetupOrchestrator;

    beforeEach(() => {
      orchestrator = UnifiedSetupOrchestrator.getInstance();
    });

    it('should complete quick setup within performance threshold', async () => {
      const startTime = performance.now();
      const result = await orchestrator.quickSetup();
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLD.TOTAL_SETUP_TIME);
      expect(result.success).toBe(true);
    });

    it('should validate setup quickly', async () => {
      const startTime = performance.now();
      const validation = await orchestrator.validateSetup();
      const endTime = performance.now();

      const validationTime = endTime - startTime;
      expect(validationTime).toBeLessThan(PERFORMANCE_THRESHOLD.DETECTION_TIME);
      expect(validation).toBeDefined();
    });

    it('should get setup status efficiently', async () => {
      const startTime = performance.now();
      const status = await orchestrator.getSetupStatus();
      const endTime = performance.now();

      const statusTime = endTime - startTime;
      expect(statusTime).toBeLessThan(PERFORMANCE_THRESHOLD.DETECTION_TIME);
      expect(status).toBeDefined();
    });

    it('should provide accurate performance metrics', async () => {
      const result = await orchestrator.quickSetup();

      expect(result.performance).toBeDefined();
      expect(result.performance.totalTime).toBeGreaterThan(0);
      expect(result.performance.detectionTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.configTime).toBeGreaterThanOrEqual(0);
      expect(result.performance.setupTime).toBeGreaterThanOrEqual(0);

      const totalCalculated =
        result.performance.detectionTime +
        result.performance.configTime +
        result.performance.setupTime +
        result.performance.interactionTime;

      // Total should be approximately equal to sum of parts (within 100ms tolerance)
      expect(Math.abs(result.performance.totalTime - totalCalculated)).toBeLessThan(100);
    });
  });

  describe('Memory Usage', () => {
    it('should not exceed memory threshold during setup', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      const orchestrator = UnifiedSetupOrchestrator.getInstance();
      await orchestrator.quickSetup();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLD.MEMORY_USAGE);
    });

    it('should clean up memory after setup', async () => {
      const orchestrator = UnifiedSetupOrchestrator.getInstance();

      const initialMemory = process.memoryUsage().heapUsed;
      await orchestrator.quickSetup();

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDifference = finalMemory - initialMemory;

      // Should not retain excessive memory
      expect(memoryDifference).toBeLessThan(PERFORMANCE_THRESHOLD.MEMORY_USAGE / 2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent detections efficiently', async () => {
      const detector = TerminalEnvironmentDetector.getInstance();
      detector.clearCache();

      const concurrentDetections = 5;
      const startTime = performance.now();

      const promises = Array(concurrentDetections).fill(null).map(() =>
        detector.detect(false)
      );

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentDetections;

      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD.DETECTION_TIME);
      expect(results).toHaveLength(concurrentDetections);
    });

    it('should handle concurrent setup operations', async () => {
      const concurrentSetups = 3;
      const startTime = performance.now();

      const promises = Array(concurrentSetups).fill(null).map(() => {
        const orchestrator = UnifiedSetupOrchestrator.getInstance();
        return orchestrator.quickSetup();
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentSetups;

      expect(averageTime).toBeLessThan(PERFORMANCE_THRESHOLD.TOTAL_SETUP_TIME);
      expect(results).toHaveLength(concurrentSetups);
      expect(results.every(r => r.success)).toBe(true);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain consistent performance across multiple runs', async () => {
      const runs = 10;
      const times: number[] = [];

      for (let i = 0; i < runs; i++) {
        const startTime = performance.now();
        const orchestrator = UnifiedSetupOrchestrator.getInstance();
        await orchestrator.quickSetup();
        const endTime = performance.now();

        times.push(endTime - startTime);
      }

      const averageTime = times.reduce((a, b) => a + b) / times.length;
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);

      // Variance should be reasonable
      const variance = maxTime - minTime;
      expect(variance).toBeLessThan(averageTime * 0.5); // Within 50% of average

      // All runs should be within threshold
      expect(maxTime).toBeLessThan(PERFORMANCE_THRESHOLD.TOTAL_SETUP_TIME);
    });
  });

  describe('Resource Cleanup', () => {
    it('should not leak event listeners', async () => {
      const initialListeners = process.listenerCount('exit');

      const orchestrator = UnifiedSetupOrchestrator.getInstance();
      await orchestrator.quickSetup();

      const finalListeners = process.listenerCount('exit');
      expect(finalListeners).toBeLessThanOrEqual(initialListeners + 1);
    });

    it('should clean up temporary files', async () => {
      const fs = require('fs');
      const path = require('path');
      const os = require('os');

      const tempDir = path.join(os.tmpdir(), 'orchflow-test');

      // Create temp directory
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const orchestrator = UnifiedSetupOrchestrator.getInstance();
      await orchestrator.quickSetup();

      // Check that no temporary files were left behind
      const tempFiles = fs.readdirSync(tempDir).filter((file: string) =>
        file.startsWith('orchflow-')
      );

      expect(tempFiles.length).toBe(0);
    });
  });
});