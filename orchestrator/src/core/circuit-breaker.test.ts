import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, circuitBreakerManager } from './circuit-breaker';

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    circuitBreakerManager.destroy();
  });

  describe('Basic Operation', () => {
    beforeEach(() => {
      breaker = new CircuitBreaker({
        name: 'test-breaker',
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 5000,
      });
    });

    it('should execute successful operations', async () => {
      const result = await breaker.execute(async () => 'success');
      expect(result).toBe('success');
      
      const stats = breaker.getStats();
      expect(stats.state).toBe('CLOSED');
      expect(stats.failures).toBe(0);
      expect(stats.successes).toBe(1);
    });

    it('should handle failures', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('fail'));

      // First two failures
      await expect(breaker.execute(operation)).rejects.toThrow('fail');
      await expect(breaker.execute(operation)).rejects.toThrow('fail');
      
      const stats1 = breaker.getStats();
      expect(stats1.state).toBe('CLOSED');
      expect(stats1.failures).toBe(2);

      // Third failure opens the circuit
      await expect(breaker.execute(operation)).rejects.toThrow('fail');
      
      const stats2 = breaker.getStats();
      expect(stats2.state).toBe('OPEN');
      expect(stats2.failures).toBe(3);

      // Circuit is open, should reject immediately
      await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is open');
      expect(operation).toHaveBeenCalledTimes(3); // Not called on open circuit
    });

    it('should timeout long operations', async () => {
      const slowOperation = async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'slow';
      };

      const promise = breaker.execute(slowOperation);
      
      // Fast forward past timeout
      vi.advanceTimersByTime(1100);
      
      await expect(promise).rejects.toThrow('Operation timed out');
      
      const stats = breaker.getStats();
      expect(stats.failures).toBe(1);
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      breaker = new CircuitBreaker({
        name: 'state-test',
        failureThreshold: 2,
        successThreshold: 2,
        timeout: 1000,
        resetTimeout: 5000,
      });
    });

    it('should transition from closed to open to half-open to closed', async () => {
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));
      const successOp = vi.fn().mockResolvedValue('success');

      // Closed -> Open (2 failures)
      await expect(breaker.execute(failOp)).rejects.toThrow('fail');
      await expect(breaker.execute(failOp)).rejects.toThrow('fail');
      expect(breaker.getStats().state).toBe('OPEN');

      // Wait for reset timeout
      vi.advanceTimersByTime(5000);

      // Should be half-open, allow one attempt
      const result1 = await breaker.execute(successOp);
      expect(result1).toBe('success');
      expect(breaker.getStats().state).toBe('HALF_OPEN');

      // Second success should close the circuit
      const result2 = await breaker.execute(successOp);
      expect(result2).toBe('success');
      expect(breaker.getStats().state).toBe('CLOSED');
    });

    it('should return to open from half-open on failure', async () => {
      const failOp = vi.fn().mockRejectedValue(new Error('fail'));

      // Open the circuit
      await expect(breaker.execute(failOp)).rejects.toThrow();
      await expect(breaker.execute(failOp)).rejects.toThrow();
      expect(breaker.getStats().state).toBe('OPEN');

      // Wait for reset timeout
      vi.advanceTimersByTime(5000);

      // Failure in half-open state
      await expect(breaker.execute(failOp)).rejects.toThrow('fail');
      expect(breaker.getStats().state).toBe('OPEN');
    });
  });

  describe('CircuitBreakerManager', () => {
    it('should create and manage multiple breakers', () => {
      const breaker1 = circuitBreakerManager.create({
        name: 'breaker1',
        failureThreshold: 3,
      });

      const breaker2 = circuitBreakerManager.create({
        name: 'breaker2',
        failureThreshold: 5,
      });

      expect(breaker1).toBeDefined();
      expect(breaker2).toBeDefined();
      expect(breaker1).not.toBe(breaker2);

      // Should return existing breaker
      const existing = circuitBreakerManager.get('breaker1');
      expect(existing).toBe(breaker1);
    });

    it('should get all breaker stats', async () => {
      const breaker1 = circuitBreakerManager.create({
        name: 'breaker1',
        failureThreshold: 3,
      });

      const breaker2 = circuitBreakerManager.create({
        name: 'breaker2',
        failureThreshold: 3,
      });

      await breaker1.execute(async () => 'success');
      await breaker2.execute(async () => 'success');

      const allStats = circuitBreakerManager.getAllStats();
      expect(Object.keys(allStats)).toHaveLength(2);
      expect(allStats.breaker1.successes).toBe(1);
      expect(allStats.breaker2.successes).toBe(1);
    });

    it('should destroy all breakers', () => {
      circuitBreakerManager.create({ name: 'temp1', failureThreshold: 3 });
      circuitBreakerManager.create({ name: 'temp2', failureThreshold: 3 });

      circuitBreakerManager.destroy();

      expect(circuitBreakerManager.get('temp1')).toBeUndefined();
      expect(circuitBreakerManager.get('temp2')).toBeUndefined();
    });
  });

  describe('Metrics', () => {
    it('should track performance metrics', async () => {
      breaker = new CircuitBreaker({
        name: 'metrics-test',
        failureThreshold: 5,
        timeout: 1000,
      });

      // Fast operation
      await breaker.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'fast';
      });

      // Slow operation
      await breaker.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'slow';
      });

      vi.advanceTimersByTime(250);

      const stats = breaker.getStats();
      expect(stats.successes).toBe(2);
      expect(stats.lastSuccessTime).toBeDefined();
    });
  });
});