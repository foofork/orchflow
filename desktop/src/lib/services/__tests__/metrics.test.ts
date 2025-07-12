import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { get } from 'svelte/store';
import { 
  currentMetrics, 
  metricsHistory, 
  metricsError, 
  isPolling,
  startMetricsPolling,
  stopMetricsPolling,
  formatBytes,
  formatUptime,
  type SystemMetrics
} from '../metrics';
import {
  createTypedMock,
  createAsyncMock,
  createSyncMock,
  createVoidMock,
  getMocked
} from '@/test/mock-factory';

// Mock browser environment
vi.mock('$app/environment', () => ({
  browser: true
}));

// Mock fetch
global.fetch = createAsyncMock<[input: RequestInfo | URL, init?: RequestInit], Response>();
global.WebSocket = createTypedMock<[url: string | URL, protocols?: string | string[]], WebSocket>() as any;

describe('Metrics Service', () => {
  let cleanup: Array<() => void> = [];
  let mockWebSocket: any;
  let intervalSpy: any;
  let clearIntervalSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset stores
    currentMetrics.set(null);
    metricsHistory.set([]);
    metricsError.set(null);
    isPolling.set(false);
    
    // Mock setInterval and clearInterval
    intervalSpy = vi.spyOn(window, 'setInterval');
    clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    
    // Mock WebSocket
    mockWebSocket = {
      close: createVoidMock(),
      send: createTypedMock<[data: string | ArrayBuffer | Blob | ArrayBufferView], void>(),
      addEventListener: createTypedMock<[type: string, listener: EventListener], void>(),
      removeEventListener: createTypedMock<[type: string, listener: EventListener], void>(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };
    
    getMocked(global.WebSocket).mockImplementation(() => mockWebSocket);
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    stopMetricsPolling();
    intervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  describe('startMetricsPolling', () => {
    it('should start polling and set isPolling to true', () => {
      startMetricsPolling();
      
      expect(get(isPolling)).toBe(true);
      expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 2000);
    });

    it('should not start polling if already polling', () => {
      startMetricsPolling();
      const firstCallCount = intervalSpy.mock.calls.length;
      
      startMetricsPolling();
      expect(intervalSpy.mock.calls.length).toBe(firstCallCount);
    });

    it('should clear any previous errors', () => {
      metricsError.set('Previous error');
      startMetricsPolling();
      
      expect(get(metricsError)).toBeNull();
    });

    it('should create WebSocket connection', () => {
      startMetricsPolling();
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8081/metrics');
    });
  });

  describe('stopMetricsPolling', () => {
    it('should stop polling and set isPolling to false', () => {
      startMetricsPolling();
      stopMetricsPolling();
      
      expect(get(isPolling)).toBe(false);
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('should close WebSocket connection', () => {
      startMetricsPolling();
      stopMetricsPolling();
      
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('fetchMetrics', () => {
    const mockMetrics: SystemMetrics = {
      timestamp: Date.now(),
      cpu: {
        usage: 45.5,
        frequency: 2400,
        temperature: 65,
        cores: 8
      },
      memory: {
        total: 16 * 1024 * 1024 * 1024,
        used: 8 * 1024 * 1024 * 1024,
        free: 8 * 1024 * 1024 * 1024,
        available: 8 * 1024 * 1024 * 1024,
        percent: 50
      },
      disk: {
        total: 500 * 1024 * 1024 * 1024,
        used: 200 * 1024 * 1024 * 1024,
        free: 300 * 1024 * 1024 * 1024,
        percent: 40
      },
      network: {
        bytesReceived: 1000000,
        bytesSent: 500000,
        packetsReceived: 1000,
        packetsSent: 500
      },
      processes: [],
      uptime: 3600,
      loadAverage: [1.5, 1.2, 1.0]
    };

    it('should fetch metrics from API', async () => {
      getMocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      } as Response);

      startMetricsPolling();
      
      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(global.fetch).toHaveBeenCalledWith('/api/metrics');
      expect(get(currentMetrics)).toEqual(mockMetrics);
    });

    it('should handle fetch errors', async () => {
      getMocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      startMetricsPolling();
      
      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(get(metricsError)).toBe('Network error');
    });

    it('should update metrics history', async () => {
      getMocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockMetrics
      } as Response);

      startMetricsPolling();
      
      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const history = get(metricsHistory);
      expect(history).toHaveLength(1);
      expect(history[0]).toEqual(mockMetrics);
    });
  });

  describe('WebSocket updates', () => {
    it('should handle WebSocket messages', async () => {
      const mockMetrics: SystemMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, frequency: 2400, cores: 8 },
        memory: {
          total: 16 * 1024 * 1024 * 1024,
          used: 8 * 1024 * 1024 * 1024,
          free: 8 * 1024 * 1024 * 1024,
          available: 8 * 1024 * 1024 * 1024,
          percent: 50
        },
        disk: {
          total: 500 * 1024 * 1024 * 1024,
          used: 200 * 1024 * 1024 * 1024,
          free: 300 * 1024 * 1024 * 1024,
          percent: 40
        },
        network: {
          bytesReceived: 1000000,
          bytesSent: 500000,
          packetsReceived: 1000,
          packetsSent: 500
        },
        processes: [],
        uptime: 3600,
        loadAverage: [1.5, 1.2, 1.0]
      };

      startMetricsPolling();
      
      // Simulate WebSocket message
      if (mockWebSocket.onmessage) {
        mockWebSocket.onmessage({ data: JSON.stringify(mockMetrics) });
      }
      
      expect(get(currentMetrics)).toEqual(mockMetrics);
    });

    it('should handle WebSocket errors', () => {
      startMetricsPolling();
      
      // Simulate WebSocket error
      if (mockWebSocket.onerror) {
        mockWebSocket.onerror(new Error('WebSocket error'));
      }
      
      expect(get(metricsError)).toBe('WebSocket connection failed');
    });

    it('should handle WebSocket close', () => {
      startMetricsPolling();
      
      // Simulate WebSocket close
      if (mockWebSocket.onclose) {
        mockWebSocket.onclose();
      }
      
      // Should attempt to reconnect
      expect(global.WebSocket).toHaveBeenCalled();
    });
  });

  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0.0 B');
      expect(formatBytes(1024)).toBe('1.0 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
      expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(1536 * 1024)).toBe('1.5 MB');
    });
  });

  describe('formatUptime', () => {
    it('should format uptime correctly', () => {
      expect(formatUptime(0)).toBe('0m');
      expect(formatUptime(60)).toBe('1m');
      expect(formatUptime(3600)).toBe('1h 0m');
      expect(formatUptime(3660)).toBe('1h 1m');
      expect(formatUptime(86400)).toBe('1d 0h 0m');
      expect(formatUptime(90061)).toBe('1d 1h 1m');
    });
  });

  describe('metrics history', () => {
    it('should limit history to MAX_HISTORY entries', async () => {
      const mockMetrics: SystemMetrics = {
        timestamp: Date.now(),
        cpu: { usage: 50, frequency: 2400, cores: 8 },
        memory: {
          total: 16 * 1024 * 1024 * 1024,
          used: 8 * 1024 * 1024 * 1024,
          free: 8 * 1024 * 1024 * 1024,
          available: 8 * 1024 * 1024 * 1024,
          percent: 50
        },
        disk: {
          total: 500 * 1024 * 1024 * 1024,
          used: 200 * 1024 * 1024 * 1024,
          free: 300 * 1024 * 1024 * 1024,
          percent: 40
        },
        network: {
          bytesReceived: 1000000,
          bytesSent: 500000,
          packetsReceived: 1000,
          packetsSent: 500
        },
        processes: [],
        uptime: 3600,
        loadAverage: [1.5, 1.2, 1.0]
      };

      // Mock fetch to always return metrics
      getMocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ ...mockMetrics, timestamp: Date.now() })
      } as Response);

      // Pre-fill history with 60 entries
      const history = Array.from({ length: 60 }, (_, i) => ({
        ...mockMetrics,
        timestamp: Date.now() - i * 1000
      }));
      metricsHistory.set(history);

      startMetricsPolling();
      
      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // History should still be 60 entries (oldest removed, newest added)
      expect(get(metricsHistory)).toHaveLength(60);
    });
  });

  describe('mock data generation', () => {
    it('should generate mock data in development when fetch fails', async () => {
      // Mock import.meta.env.DEV by mocking the whole import.meta.env object
      const originalEnv = import.meta.env;
      const mockEnv = { ...originalEnv, DEV: true };
      
      // Use vi.stubGlobal to mock import.meta
      vi.stubGlobal('import', { meta: { env: mockEnv } });

      getMocked(global.fetch).mockRejectedValueOnce(new Error('Network error'));

      startMetricsPolling();
      
      // Wait for initial fetch
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should have mock metrics despite error
      const metrics = get(currentMetrics);
      expect(metrics).toBeTruthy();
      expect(metrics?.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(metrics?.cpu.usage).toBeLessThanOrEqual(100);

      // Restore original environment
      vi.unstubAllGlobals();
    });
  });
});