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
  formatSpeed,
  formatTemperature,
  formatPercentage,
  formatPower,
  formatTime,
  getNetworkTotalBandwidth,
  getDiskTotalUsagePercent,
  getTopProcessesByMetric,
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
const mockWebSocketConstructor = createTypedMock<(url: string | URL, protocols?: string | string[]) => WebSocket>();
global.WebSocket = mockWebSocketConstructor as any;

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
      send: createTypedMock<(data: string | ArrayBuffer | Blob | ArrayBufferView) => void>(),
      addEventListener: createTypedMock<(type: string, listener: EventListener) => void>(),
      removeEventListener: createTypedMock<(type: string, listener: EventListener) => void>(),
      readyState: WebSocket.OPEN,
      onopen: null,
      onmessage: null,
      onerror: null,
      onclose: null
    };
    
    mockWebSocketConstructor.mockImplementation(() => mockWebSocket);
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
        disks: [
          {
            name: '/dev/disk1s1',
            mountPoint: '/',
            fileSystem: 'apfs',
            total: 500 * 1024 * 1024 * 1024,
            used: 200 * 1024 * 1024 * 1024,
            free: 300 * 1024 * 1024 * 1024,
            percent: 40
          }
        ],
        totalSpace: 500 * 1024 * 1024 * 1024,
        totalUsed: 200 * 1024 * 1024 * 1024,
        totalFree: 300 * 1024 * 1024 * 1024,
        averageUsagePercent: 40
      },
      network: {
        interfaces: [
          {
            name: 'eth0',
            bytesReceived: 1000000,
            bytesSent: 500000,
            packetsReceived: 1000,
            packetsSent: 500,
            speed: 1000000000,
            isUp: true,
            interfaceType: 'ethernet'
          }
        ],
        totalBytesReceived: 1000000,
        totalBytesSent: 500000,
        totalPacketsReceived: 1000,
        totalPacketsSent: 500,
        downloadSpeed: 1000,
        uploadSpeed: 500
      },
      processes: [],
      gpu: [
        {
          name: 'Test GPU',
          utilization: 50,
          memoryUsed: 4 * 1024 * 1024 * 1024,
          memoryTotal: 8 * 1024 * 1024 * 1024,
          temperature: 65,
          powerUsage: 150
        }
      ],
      battery: {
        percentage: 85,
        isCharging: false,
        timeRemaining: 7200,
        health: 90,
        cycleCount: 250,
        powerConsumption: 15
      },
      thermal: {
        cpuTemperature: 55,
        gpuTemperature: 65,
        systemTemperature: 50,
        fanSpeeds: [['CPU Fan', 1800], ['System Fan', 1200]]
      },
      uptime: 3600,
      loadAverage: [1.5, 1.2, 1.0],
      hostname: 'test-machine',
      osVersion: 'Linux 6.8.0',
      kernelVersion: '6.8.0-test'
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
          disks: [
            {
              name: '/dev/disk1s1',
              mountPoint: '/',
              fileSystem: 'apfs',
              total: 500 * 1024 * 1024 * 1024,
              used: 200 * 1024 * 1024 * 1024,
              free: 300 * 1024 * 1024 * 1024,
              percent: 40
            }
          ],
          totalSpace: 500 * 1024 * 1024 * 1024,
          totalUsed: 200 * 1024 * 1024 * 1024,
          totalFree: 300 * 1024 * 1024 * 1024,
          averageUsagePercent: 40
        },
        network: {
          interfaces: [
            {
              name: 'eth0',
              bytesReceived: 1000000,
              bytesSent: 500000,
              packetsReceived: 1000,
              packetsSent: 500,
              speed: 1000000000,
              isUp: true,
              interfaceType: 'ethernet'
            }
          ],
          totalBytesReceived: 1000000,
          totalBytesSent: 500000,
          totalPacketsReceived: 1000,
          totalPacketsSent: 500,
          downloadSpeed: 1000,
          uploadSpeed: 500
        },
        processes: [],
        gpu: [],
        thermal: {
          cpuTemperature: 55,
          fanSpeeds: []
        },
        uptime: 3600,
        loadAverage: [1.5, 1.2, 1.0],
        hostname: 'test-machine',
        osVersion: 'Linux 6.8.0',
        kernelVersion: '6.8.0-test'
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

  describe('formatSpeed', () => {
    it('should format speed correctly', () => {
      expect(formatSpeed(0)).toBe('0.0 B/s');
      expect(formatSpeed(1024)).toBe('1.0 KB/s');
      expect(formatSpeed(1536)).toBe('1.5 KB/s');
      expect(formatSpeed(1024 * 1024)).toBe('1.0 MB/s');
      expect(formatSpeed(1024 * 1024 * 1024)).toBe('1.0 GB/s');
    });
  });

  describe('formatTemperature', () => {
    it('should format temperature correctly', () => {
      expect(formatTemperature(undefined)).toBe('N/A');
      expect(formatTemperature(45.67)).toBe('45.7°C');
      expect(formatTemperature(0)).toBe('0.0°C');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentage correctly', () => {
      expect(formatPercentage(undefined)).toBe('N/A');
      expect(formatPercentage(45.67)).toBe('45.7%');
      expect(formatPercentage(100)).toBe('100.0%');
    });
  });

  describe('formatPower', () => {
    it('should format power correctly', () => {
      expect(formatPower(undefined)).toBe('N/A');
      expect(formatPower(150.5)).toBe('150.5W');
      expect(formatPower(0)).toBe('0.0W');
    });
  });

  describe('formatTime', () => {
    it('should format time correctly', () => {
      expect(formatTime(0)).toBe('0s');
      expect(formatTime(5000)).toBe('5s');
      expect(formatTime(65000)).toBe('1m 5s');
      expect(formatTime(3665000)).toBe('1h 1m');
    });
  });

  describe('utility functions', () => {
    const sampleMetrics: SystemMetrics = {
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
        disks: [
          {
            name: '/dev/disk1',
            mountPoint: '/',
            fileSystem: 'ext4',
            total: 1000000000,
            used: 750000000,
            free: 250000000,
            percent: 75
          }
        ],
        totalSpace: 1000000000,
        totalUsed: 750000000,
        totalFree: 250000000,
        averageUsagePercent: 75
      },
      network: {
        interfaces: [
          {
            name: 'eth0',
            bytesReceived: 1000,
            bytesSent: 500,
            packetsReceived: 10,
            packetsSent: 5,
            speed: 1000000000, // 1 Gbps
            isUp: true,
            interfaceType: 'ethernet'
          },
          {
            name: 'wlan0',
            bytesReceived: 500,
            bytesSent: 200,
            packetsReceived: 5,
            packetsSent: 2,
            speed: 54000000, // 54 Mbps
            isUp: true,
            interfaceType: 'wireless'
          }
        ],
        totalBytesReceived: 1500,
        totalBytesSent: 700,
        totalPacketsReceived: 15,
        totalPacketsSent: 7,
        downloadSpeed: 1000,
        uploadSpeed: 500
      },
      processes: [
        {
          pid: 1,
          name: 'high_cpu',
          cpu: 95.5,
          memory: 1000000,
          virtualMemory: 2000000,
          status: 'running',
          cmd: ['high_cpu'],
          startTime: 123456,
          diskUsage: [1000, 500]
        },
        {
          pid: 2,
          name: 'high_memory',
          cpu: 10.2,
          memory: 5000000,
          virtualMemory: 10000000,
          status: 'running',
          cmd: ['high_memory'],
          startTime: 123456,
          diskUsage: [500, 200]
        },
        {
          pid: 3,
          name: 'low_usage',
          cpu: 1.0,
          memory: 100000,
          virtualMemory: 200000,
          status: 'running',
          cmd: ['low_usage'],
          startTime: 123456,
          diskUsage: [100, 50]
        }
      ],
      gpu: [],
      thermal: {
        cpuTemperature: 55,
        fanSpeeds: []
      },
      uptime: 3600,
      loadAverage: [1.5, 1.2, 1.0],
      hostname: 'test-machine',
      osVersion: 'Linux 6.8.0',
      kernelVersion: '6.8.0-test'
    };

    it('should calculate total network bandwidth', () => {
      const totalBandwidth = getNetworkTotalBandwidth(sampleMetrics);
      expect(totalBandwidth).toBe(1054000000); // 1Gbps + 54Mbps
    });

    it('should get disk total usage percent', () => {
      const usagePercent = getDiskTotalUsagePercent(sampleMetrics);
      expect(usagePercent).toBe(75);
    });

    it('should get top processes by CPU', () => {
      const topCpuProcesses = getTopProcessesByMetric(sampleMetrics, 'cpu', 2);
      expect(topCpuProcesses).toHaveLength(2);
      expect(topCpuProcesses[0].name).toBe('high_cpu');
      expect(topCpuProcesses[1].name).toBe('high_memory');
    });

    it('should get top processes by memory', () => {
      const topMemoryProcesses = getTopProcessesByMetric(sampleMetrics, 'memory', 2);
      expect(topMemoryProcesses).toHaveLength(2);
      expect(topMemoryProcesses[0].name).toBe('high_memory');
      expect(topMemoryProcesses[1].name).toBe('high_cpu');
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
          disks: [],
          totalSpace: 500 * 1024 * 1024 * 1024,
          totalUsed: 200 * 1024 * 1024 * 1024,
          totalFree: 300 * 1024 * 1024 * 1024,
          averageUsagePercent: 40
        },
        network: {
          interfaces: [],
          totalBytesReceived: 1000000,
          totalBytesSent: 500000,
          totalPacketsReceived: 1000,
          totalPacketsSent: 500,
          downloadSpeed: 1000,
          uploadSpeed: 500
        },
        processes: [],
        gpu: [],
        thermal: {
          cpuTemperature: 55,
          fanSpeeds: []
        },
        uptime: 3600,
        loadAverage: [1.5, 1.2, 1.0],
        hostname: 'test-machine',
        osVersion: 'Linux 6.8.0',
        kernelVersion: '6.8.0-test'
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