import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MetricsDashboard from './MetricsDashboard.svelte';
import { 
  currentMetrics, 
  metricsHistory, 
  isPolling, 
  startMetricsPolling, 
  stopMetricsPolling 
} from '$lib/services/metrics';
import { buildSystemMetrics, buildProcessMetrics } from '$lib/../test/test-data-builders';
import { 
  createAsyncMock, 
  createAsyncVoidMock, 
  createSyncMock, 
  createTypedMock 
} from '@/test/mock-factory';

// Mock store imports
import { writable } from 'svelte/store';

// Mock the metrics service
vi.mock('$lib/services/metrics', () => {
  const mockMetrics = {
    timestamp: Date.now(),
    cpu: { usage: 45.5, temperature: 65, cores: 8, frequency: 2400 },
    memory: { total: 16000000000, used: 8000000000, available: 8000000000, free: 8000000000, percent: 50 },
    disk: { total: 500000000000, used: 250000000000, free: 250000000000, percent: 50 },
    network: { bytesReceived: 1000000, bytesSent: 500000, packetsReceived: 0, packetsSent: 0 },
    processes: [
      { name: 'node', pid: 1234, cpu: 25.5, memory: 512000000, status: 'running' },
      { name: 'chrome', pid: 5678, cpu: 15.2, memory: 1024000000, status: 'running' }
    ],
    uptime: 3600,
    loadAverage: [1.5, 1.2, 0.9]
  };
  
  // Create mock stores using imported writable
  const writableModule = await import('svelte/store');
  const { writable: writableStore } = writableModule;
  
  const currentMetricsStore = writableStore(mockMetrics);
  const metricsHistoryStore = writableStore([mockMetrics, { 
    ...mockMetrics, 
    cpu: { usage: 50, temperature: 68, cores: 8, frequency: 2400 } 
  }]);
  const isPollingStore = writableStore(false);
  
  return {
    currentMetrics: currentMetricsStore,
    metricsHistory: metricsHistoryStore,
    isPolling: isPollingStore,
    startMetricsPolling: (await import('@/test/mock-factory')).createAsyncVoidMock().mockResolvedValue(undefined),
    stopMetricsPolling: (await import('@/test/mock-factory')).createAsyncVoidMock().mockResolvedValue(undefined),
    formatBytes: (await import('@/test/mock-factory')).createSyncMock<[number], string>().mockImplementation((bytes: number) => `${(bytes / 1000000000).toFixed(1)} GB`),
    formatUptime: (await import('@/test/mock-factory')).createSyncMock<[number], string>().mockImplementation((seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    })
  };
});

// Create typed mock context
const createCanvasMock = () => {
  const mockAddColorStop = createSyncMock<[number, string], void>();
  
  return {
    clearRect: createSyncMock<[number, number, number, number], void>(),
    fillRect: createSyncMock<[number, number, number, number], void>(),
    strokeRect: createSyncMock<[number, number, number, number], void>(),
    beginPath: createSyncMock<[], void>(),
    closePath: createSyncMock<[], void>(),
    moveTo: createSyncMock<[number, number], void>(),
    lineTo: createSyncMock<[number, number], void>(),
    stroke: createSyncMock<[], void>(),
    fill: createSyncMock<[], void>(),
    fillText: createSyncMock<[string, number, number], void>(),
    measureText: createSyncMock<[string], TextMetrics>().mockReturnValue({ width: 50 } as TextMetrics),
    save: createSyncMock<[], void>(),
    restore: createSyncMock<[], void>(),
    arc: createSyncMock<[number, number, number, number, number, boolean?], void>(),
    quadraticCurveTo: createSyncMock<[number, number, number, number], void>(),
    bezierCurveTo: createSyncMock<[number, number, number, number, number, number], void>(),
    rect: createSyncMock<[number, number, number, number], void>(),
    translate: createSyncMock<[number, number], void>(),
    scale: createSyncMock<[number, number], void>(),
    rotate: createSyncMock<[number], void>(),
    setTransform: createSyncMock<[number, number, number, number, number, number], void>(),
    createLinearGradient: createSyncMock<[number, number, number, number], CanvasGradient>().mockReturnValue({
      addColorStop: mockAddColorStop
    } as any),
    createRadialGradient: createSyncMock<[number, number, number, number, number, number], CanvasGradient>().mockReturnValue({
      addColorStop: mockAddColorStop
    } as any),
    createPattern: createSyncMock<[CanvasImageSource, string | null], CanvasPattern | null>(),
    clip: createSyncMock<[], void>(),
    isPointInPath: createSyncMock<[number, number], boolean>(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt' as CanvasLineCap,
    lineJoin: 'miter' as CanvasLineJoin,
    font: '',
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
    shadowBlur: 0,
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0
  };
};

const mockContext = createCanvasMock();
const mockGetContext = createSyncMock<[string, any?], RenderingContext | null>().mockReturnValue(mockContext as any);
HTMLCanvasElement.prototype.getContext = mockGetContext as any;

// Mock requestAnimationFrame
let animationFrameId = 0;
const activeTimeouts = new Set<NodeJS.Timeout>();

const mockRequestAnimationFrame = createSyncMock<[FrameRequestCallback], number>().mockImplementation((callback) => {
  animationFrameId++;
  const timeoutId = setTimeout(() => {
    activeTimeouts.delete(timeoutId);
    callback(animationFrameId);
  }, 16);
  activeTimeouts.add(timeoutId);
  return animationFrameId;
});

const mockCancelAnimationFrame = createSyncMock<[number], void>().mockImplementation((id) => {
  // In a real scenario, we would map frame IDs to timeouts
  // For testing, we'll just clear all active timeouts
  activeTimeouts.forEach(timeout => clearTimeout(timeout));
  activeTimeouts.clear();
});

global.requestAnimationFrame = mockRequestAnimationFrame as any;
global.cancelAnimationFrame = mockCancelAnimationFrame as any;

describe('MetricsDashboard', () => {
  let cleanup: Array<() => void> = [];

  beforeEach(() => {
    vi.clearAllMocks();
    animationFrameId = 0;
  });

  afterEach(() => {
    cleanup.forEach(fn => fn());
    cleanup = [];
    vi.restoreAllMocks();
    // Clean up any remaining timeouts
    activeTimeouts.forEach(timeout => clearTimeout(timeout));
    activeTimeouts.clear();
  });

  describe('Rendering', () => {
    it('should render dashboard container', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      expect(container.querySelector('.metrics-dashboard')).toBeTruthy();
    });

    it('should render in compact mode', () => {
      const { container, unmount } = render(MetricsDashboard, {
        props: { compact: true }
      });
      cleanup.push(unmount);
      
      const dashboard = container.querySelector('.metrics-dashboard');
      expect(dashboard?.classList.contains('compact')).toBe(true);
    });

    it('should render all metric cards', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const cards = container.querySelectorAll('.stat-card');
      expect(cards.length).toBeGreaterThan(0);
      
      // Check for specific stat cards
      expect(container.querySelector('.stat-value')?.textContent).toContain('45.5%');
    });

    it('should render CPU metrics', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const cpuCard = container.querySelector('.stat-card');
      expect(cpuCard).toBeTruthy();
      expect(cpuCard?.textContent).toContain('CPU');
      expect(cpuCard?.textContent).toContain('45.5%');
    });

    it('should render memory metrics', () => {
      const { container, getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      expect(getByText('Memory')).toBeTruthy();
      expect(container.textContent).toContain('50.0%');
      expect(container.textContent).toContain('8.0 GB / 16.0 GB');
    });

    it('should render disk metrics', () => {
      const { container, getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      expect(getByText('Disk')).toBeTruthy();
      expect(container.textContent).toContain('250.0 GB / 500.0 GB');
    });

    it('should render network metrics', () => {
      const { container, getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      expect(getByText('Network')).toBeTruthy();
      expect(container.textContent).toContain('↓0.0 GB ↑0.0 GB');
    });

    it('should render system info', () => {
      const { container, getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      expect(getByText('System')).toBeTruthy();
      expect(container.textContent).toContain('8 cores');
      expect(container.textContent).toContain('Uptime: 1h 0m');
    });

    it('should render process list', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const processSection = container.querySelector('.process-list');
      expect(processSection).toBeTruthy();
      expect(processSection?.textContent).toContain('node');
      expect(processSection?.textContent).toContain('chrome');
      expect(processSection?.textContent).toContain('25.5%');
      expect(processSection?.textContent).toContain('15.2%');
    });
  });

  describe('Chart Rendering', () => {
    it('should create canvas elements for charts', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const canvases = container.querySelectorAll('canvas');
      expect(canvases.length).toBeGreaterThan(0);
    });

    it('should render CPU chart', async () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      await waitFor(() => {
        expect(mockGetContext).toHaveBeenCalled();
        expect(mockContext.beginPath).toHaveBeenCalled();
        expect(mockContext.stroke).toHaveBeenCalled();
      });
    });

    it('should render memory chart', async () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      await waitFor(() => {
        const memoryChart = container.querySelector('.memory-chart canvas');
        expect(memoryChart).toBeTruthy();
      });
    });

    it('should update charts when metrics change', async () => {
      const { unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const clearCallsBefore = mockContext.clearRect.mock.calls.length;
      
      // Update metrics
      currentMetrics.update(m => ({
        ...m,
        cpu: { ...m.cpu, usage: 75 }
      }));
      
      await waitFor(() => {
        expect(mockContext.clearRect.mock.calls.length).toBeGreaterThan(clearCallsBefore);
      });
    });
  });

  describe('Polling Controls', () => {
    it('should start polling when button clicked', async () => {
      const { getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const startButton = getByText('Start Monitoring');
      await startButton.click();
      
      expect(startMetricsPolling).toHaveBeenCalled();
    });

    it('should stop polling when button clicked', async () => {
      isPolling.set(true);
      
      const { getByText, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const stopButton = getByText('Stop Monitoring');
      await stopButton.click();
      
      expect(stopMetricsPolling).toHaveBeenCalled();
    });

    it('should show correct button based on polling state', () => {
      isPolling.set(false);
      const { getByText, rerender, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      expect(getByText('Start Monitoring')).toBeTruthy();
      
      isPolling.set(true);
      rerender({});
      
      expect(getByText('Stop Monitoring')).toBeTruthy();
    });
  });

  describe('Compact Mode', () => {
    it('should hide process list in compact mode', () => {
      const { container, unmount } = render(MetricsDashboard, {
        props: { compact: true }
      });
      cleanup.push(unmount);
      
      const processSection = container.querySelector('.process-list');
      expect(processSection).toBeFalsy();
    });

    it('should show smaller charts in compact mode', () => {
      const { container, unmount } = render(MetricsDashboard, {
        props: { compact: true }
      });
      cleanup.push(unmount);
      
      const dashboard = container.querySelector('.metrics-dashboard.compact');
      expect(dashboard).toBeTruthy();
    });

    it('should apply compact styles to stat cards', () => {
      const { container, unmount } = render(MetricsDashboard, {
        props: { compact: true }
      });
      cleanup.push(unmount);
      
      const cards = container.querySelectorAll('.stat-card');
      cards.forEach(card => {
        expect(card.closest('.compact')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing metrics gracefully', () => {
      currentMetrics.set(null as any);
      
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      // Should still render container
      expect(container.querySelector('.metrics-dashboard')).toBeTruthy();
    });

    it('should handle canvas context errors', () => {
      mockGetContext.mockReturnValueOnce(null);
      
      const { unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('Performance', () => {
    it('should throttle chart updates', async () => {
      const { unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const initialCalls = mockContext.clearRect.mock.calls.length;
      
      // Rapid metric updates
      for (let i = 0; i < 10; i++) {
        currentMetrics.update(m => ({
          ...m,
          cpu: { ...m.cpu, usage: 50 + i }
        }));
      }
      
      await waitFor(() => {
        // Should not update for every metric change
        const newCalls = mockContext.clearRect.mock.calls.length - initialCalls;
        expect(newCalls).toBeLessThan(10);
      });
    });

    it('should clean up animation frames on unmount', () => {
      const { unmount } = render(MetricsDashboard);
      
      unmount();
      
      expect(mockCancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have accessible labels for metrics', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const cpuCard = container.querySelector('.stat-card');
      expect(cpuCard?.querySelector('.stat-label')?.textContent).toBe('CPU');
    });

    it('should have accessible chart descriptions', () => {
      const { container, unmount } = render(MetricsDashboard);
      cleanup.push(unmount);
      
      const charts = container.querySelectorAll('canvas');
      charts.forEach(chart => {
        expect(chart.getAttribute('role')).toBe('img');
        expect(chart.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});