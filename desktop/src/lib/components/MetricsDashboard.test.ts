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

// Mock the metrics service
vi.mock('$lib/services/metrics', () => {
  const { writable, readable } = require('svelte/store');
  
  const mockMetrics = {
    cpu: { usage: 45.5, temperature: 65 },
    memory: { total: 16000000000, used: 8000000000, available: 8000000000, percent: 50 },
    disk: { total: 500000000000, used: 250000000000, free: 250000000000, percent: 50 },
    network: { bytesReceived: 1000000, bytesSent: 500000 },
    system: { uptime: 3600, platform: 'darwin', version: '13.0.0' }
  };
  
  const currentMetricsStore = writable(mockMetrics);
  const metricsHistoryStore = writable([mockMetrics, { ...mockMetrics, cpu: { usage: 50, temperature: 68 } }]);
  const isPollingStore = writable(false);
  
  return {
    currentMetrics: currentMetricsStore,
    metricsHistory: metricsHistoryStore,
    isPolling: isPollingStore,
    startMetricsPolling: vi.fn(),
    stopMetricsPolling: vi.fn(),
    formatBytes: vi.fn((bytes: number) => `${(bytes / 1000000000).toFixed(1)} GB`),
    formatUptime: vi.fn((seconds: number) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours}h ${minutes}m`;
    })
  };
});

// Mock Canvas API
const mockContext = {
  clearRect: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 50 })),
  save: vi.fn(),
  restore: vi.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: 'left' as CanvasTextAlign,
  textBaseline: 'alphabetic' as CanvasTextBaseline
};

HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;

// Mock requestAnimationFrame
let animationFrameId = 0;
global.requestAnimationFrame = vi.fn((callback) => {
  animationFrameId++;
  setTimeout(() => callback(animationFrameId), 16);
  return animationFrameId;
});
global.cancelAnimationFrame = vi.fn();

describe('MetricsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    animationFrameId = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('should render dashboard container', () => {
      const { container } = render(MetricsDashboard);
      expect(container.querySelector('.metrics-dashboard')).toBeTruthy();
    });

    it('should render in compact mode', () => {
      const { container } = render(MetricsDashboard, {
        props: { compact: true }
      });
      
      const dashboard = container.querySelector('.metrics-dashboard');
      expect(dashboard?.classList.contains('compact')).toBe(true);
    });

    it('should render all metric cards', () => {
      const { container } = render(MetricsDashboard);
      
      const cards = container.querySelectorAll('.metric-card');
      expect(cards.length).toBeGreaterThan(0);
      
      // Check for specific metric cards
      expect(container.querySelector('.metric-value')?.textContent).toContain('45.5%');
    });

    it('should render CPU metrics', () => {
      const { container } = render(MetricsDashboard);
      
      const cpuCard = container.querySelector('.metric-card');
      expect(cpuCard).toBeTruthy();
      expect(cpuCard?.textContent).toContain('CPU');
      expect(cpuCard?.textContent).toContain('45.5%');
    });

    it('should render memory metrics', () => {
      const { container, getByText } = render(MetricsDashboard);
      
      expect(getByText('Memory')).toBeTruthy();
      expect(container.textContent).toContain('50.0%');
      expect(container.textContent).toContain('8.0 GB / 16.0 GB');
    });

    it('should render disk metrics', () => {
      const { container, getByText } = render(MetricsDashboard);
      
      expect(getByText('Disk')).toBeTruthy();
      expect(container.textContent).toContain('250.0 GB / 500.0 GB');
    });

    it('should render network metrics', () => {
      const { container, getByText } = render(MetricsDashboard);
      
      expect(getByText('Network')).toBeTruthy();
      expect(container.textContent).toContain('↓ 0.0 GB ↑ 0.0 GB');
    });

    it('should render system info', () => {
      const { container, getByText } = render(MetricsDashboard);
      
      expect(getByText('System')).toBeTruthy();
      expect(container.textContent).toContain('darwin');
      expect(container.textContent).toContain('Uptime: 1h 0m');
    });

    it('should render chart canvas', () => {
      const { container } = render(MetricsDashboard);
      
      const canvas = container.querySelector('canvas');
      expect(canvas).toBeTruthy();
    });
  });

  describe('Polling', () => {
    it('should start polling on mount if not already polling', async () => {
      isPolling.set(false);
      
      render(MetricsDashboard);
      
      await waitFor(() => {
        expect(startMetricsPolling).toHaveBeenCalled();
      });
    });

    it('should not start polling if already polling', async () => {
      isPolling.set(true);
      
      render(MetricsDashboard);
      
      await waitFor(() => {
        expect(startMetricsPolling).not.toHaveBeenCalled();
      });
    });
  });

  describe('Chart Rendering', () => {
    it('should initialize canvas context', async () => {
      const { container } = render(MetricsDashboard);
      
      await waitFor(() => {
        const canvas = container.querySelector('canvas');
        expect(canvas?.getContext).toHaveBeenCalledWith('2d');
      });
    });

    it('should start animation loop', async () => {
      render(MetricsDashboard);
      
      await waitFor(() => {
        expect(global.requestAnimationFrame).toHaveBeenCalled();
      });
    });

    it('should clear canvas on each frame', async () => {
      const { container } = render(MetricsDashboard);
      
      await waitFor(() => {
        expect(mockContext.clearRect).toHaveBeenCalled();
      });
    });

    it('should not draw charts with insufficient history', async () => {
      metricsHistory.set([]);
      
      render(MetricsDashboard);
      
      await waitFor(() => {
        expect(mockContext.clearRect).toHaveBeenCalled();
        // Should not draw any chart elements
        expect(mockContext.beginPath).not.toHaveBeenCalled();
      });
    });

    it('should draw charts with sufficient history', async () => {
      const mockHistory = Array(5).fill(null).map((_, i) => ({
        cpu: { usage: 45 + i * 5, temperature: 65 },
        memory: { total: 16000000000, used: 8000000000, available: 8000000000, percent: 50 },
        disk: { total: 500000000000, used: 250000000000, free: 250000000000, percent: 50 },
        network: { bytesReceived: 1000000 * (i + 1), bytesSent: 500000 * (i + 1) },
        system: { uptime: 3600, platform: 'darwin', version: '13.0.0' }
      }));
      
      metricsHistory.set(mockHistory);
      
      render(MetricsDashboard);
      
      await waitFor(() => {
        // Should draw grid lines and charts
        expect(mockContext.strokeStyle).toBeTruthy();
        expect(mockContext.beginPath).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cancel animation frame on unmount', async () => {
      const { unmount } = render(MetricsDashboard);
      
      await waitFor(() => {
        expect(global.requestAnimationFrame).toHaveBeenCalled();
      });
      
      unmount();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('Progress Indicators', () => {
    it('should calculate correct progress for CPU', () => {
      const { container } = render(MetricsDashboard);
      
      const cpuProgress = container.querySelector('.progress');
      const progressBar = cpuProgress?.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar?.style.width).toBe('45.5%');
    });

    it('should calculate correct progress for memory', () => {
      const { container } = render(MetricsDashboard);
      
      const memoryCard = Array.from(container.querySelectorAll('.metric-card'))
        .find(card => card.textContent?.includes('Memory'));
      const progressBar = memoryCard?.querySelector('.progress-bar') as HTMLElement;
      expect(progressBar?.style.width).toBe('50%');
    });

    it('should apply warning color for high usage', () => {
      currentMetrics.update(m => ({
        ...m,
        cpu: { usage: 85, temperature: 80 }
      }));
      
      const { container } = render(MetricsDashboard);
      
      const cpuProgress = container.querySelector('.progress-bar');
      expect(cpuProgress?.classList.contains('warning')).toBe(true);
    });

    it('should apply danger color for critical usage', () => {
      currentMetrics.update(m => ({
        ...m,
        cpu: { usage: 95, temperature: 90 }
      }));
      
      const { container } = render(MetricsDashboard);
      
      const cpuProgress = container.querySelector('.progress-bar');
      expect(cpuProgress?.classList.contains('danger')).toBe(true);
    });
  });

  describe('Formatting', () => {
    it('should format bytes correctly', () => {
      const { container } = render(MetricsDashboard);
      
      expect(container.textContent).toContain('8.0 GB');
      expect(container.textContent).toContain('16.0 GB');
    });

    it('should format uptime correctly', () => {
      const { container } = render(MetricsDashboard);
      
      expect(container.textContent).toContain('1h 0m');
    });

    it('should handle zero values', () => {
      currentMetrics.update(m => ({
        ...m,
        cpu: { usage: 0, temperature: 0 },
        memory: { ...m.memory, percent: 0 }
      }));
      
      const { container } = render(MetricsDashboard);
      
      expect(container.textContent).toContain('0.0%');
    });
  });
});