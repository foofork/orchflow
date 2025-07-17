/**
 * StatusPane Integration - Connects performance monitoring and worker events
 * to the status pane for real-time updates
 */

import { EventEmitter } from 'events';
import type { StatusPane } from './status-pane';
import type { OrchestratorClient } from './orchestrator-client';
import type { PerformanceMonitor } from '../performance/performance-monitor';
import chalk from 'chalk';

export interface StatusPaneIntegration {
  statusPane: StatusPane;
  orchestrator: OrchestratorClient;
  performanceMonitor: PerformanceMonitor | null;
}

export class StatusPaneManager extends EventEmitter {
  private statusPane: StatusPane;
  private orchestrator: OrchestratorClient;
  private performanceMonitor: PerformanceMonitor | null;
  private isRunning: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(integration: StatusPaneIntegration) {
    super();
    this.statusPane = integration.statusPane;
    this.orchestrator = integration.orchestrator;
    this.performanceMonitor = integration.performanceMonitor;
  }

  /**
   * Start all status pane integrations
   */
  async start(): Promise<void> {
    if (this.isRunning) {return;}

    console.log(chalk.cyan('Starting status pane integrations...'));

    // Connect orchestrator events
    this.connectOrchestratorEvents();

    // Connect performance monitor events (if available)
    if (this.performanceMonitor) {
      this.connectPerformanceMonitorEvents();
    }

    // Start periodic updates
    this.startPeriodicUpdates();

    this.isRunning = true;
    console.log(chalk.green('✓ Status pane integrations active'));
  }

  /**
   * Stop all integrations
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {return;}

    this.isRunning = false;

    // Stop periodic updates
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Remove all listeners
    this.orchestrator.removeAllListeners();
    if (this.performanceMonitor) {
      this.performanceMonitor.removeAllListeners();
    }

    console.log(chalk.yellow('Status pane integrations stopped'));
  }

  /**
   * Connect orchestrator events to status pane updates
   */
  private connectOrchestratorEvents(): void {
    // Worker lifecycle events
    this.orchestrator.on('worker:created', (worker) => {
      this.statusPane.addWorker({
        id: worker.id,
        name: worker.descriptiveName || worker.name,
        status: worker.status,
        progress: 0,
        quickAccessKey: worker.quickAccessKey,
        currentTask: worker.currentTask?.description || worker.currentTask || '',
        resources: worker.resources || { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 }
      });

      this.emit('worker:added', worker);
    });

    this.orchestrator.on('worker:updated', (worker) => {
      this.statusPane.updateWorker({
        id: worker.id,
        name: worker.descriptiveName || worker.name,
        status: worker.status,
        progress: worker.progress || 0,
        currentTask: worker.currentTask?.description || worker.currentTask || '',
        resources: worker.resources || { cpuUsage: 0, memoryUsage: 0, diskUsage: 0 }
      });

      this.emit('worker:updated', worker);
    });

    this.orchestrator.on('worker:deleted', (workerId) => {
      this.statusPane.removeWorker(workerId);
      this.emit('worker:removed', workerId);
    });

    // Task events
    this.orchestrator.on('task:started', (task) => {
      this.statusPane.updateTaskStatus(task.id, 'running');
      this.emit('task:started', task);
    });

    this.orchestrator.on('task:completed', (task) => {
      this.statusPane.updateTaskStatus(task.id, 'completed');
      this.statusPane.addNotification(`✅ Task completed: ${task.description}`);
      this.emit('task:completed', task);
    });

    this.orchestrator.on('task:failed', (task) => {
      this.statusPane.updateTaskStatus(task.id, 'failed');
      this.statusPane.addNotification(`❌ Task failed: ${task.description}`);
      this.emit('task:failed', task);
    });

    // System events
    this.orchestrator.on('system:resource:warning', (warning) => {
      this.statusPane.addNotification(`⚠️ ${warning.message}`);
      this.emit('system:warning', warning);
    });
  }

  /**
   * Set performance monitor (can be called after initialization)
   */
  setPerformanceMonitor(monitor: PerformanceMonitor): void {
    this.performanceMonitor = monitor;
    if (this.isRunning) {
      this.connectPerformanceMonitorEvents();
    }
  }

  /**
   * Connect performance monitor events to status pane updates
   */
  private connectPerformanceMonitorEvents(): void {
    if (!this.performanceMonitor) {return;}

    // Real-time resource updates
    this.performanceMonitor.on('snapshot', (snapshot) => {
      this.statusPane.updateResourceUsage({
        cpu: snapshot.metrics.cpuUsage,
        memory: snapshot.metrics.memoryFootprint,
        disk: snapshot.metrics.diskUsage || 0
      });

      this.emit('resources:updated', snapshot.metrics);
    });

    // Performance alerts
    this.performanceMonitor.on('alert', (alert) => {
      let icon = '⚠️';
      let _color = 'yellow';

      if (alert.severity === 'critical') {
        icon = '🚨';
        _color = 'red';
      } else if (alert.severity === 'warning') {
        icon = '⚠️';
        _color = 'yellow';
      }

      this.statusPane.addNotification(`${icon} ${alert.message}`);
      this.emit('performance:alert', alert);
    });

    // Worker-specific performance
    this.performanceMonitor.on('worker:performance', (data) => {
      this.statusPane.updateWorkerResources(data.workerId, {
        cpu: data.cpuUsage,
        memory: data.memoryUsage,
        tasksCompleted: data.tasksCompleted,
        averageTaskTime: data.averageTaskTime
      });

      this.emit('worker:performance', data);
    });
  }

  /**
   * Start periodic status updates
   */
  private startPeriodicUpdates(): void {
    const UPDATE_INTERVAL = 1000; // 1 second

    this.updateInterval = setInterval(async () => {
      try {
        await this.updateStatusPane();
      } catch (error) {
        console.error('Status pane update error:', error);
      }
    }, UPDATE_INTERVAL);
  }

  /**
   * Comprehensive status pane update
   */
  private async updateStatusPane(): Promise<void> {
    if (!this.isRunning) {return;}

    // Update worker states
    const workers = await this.orchestrator.listWorkers();
    for (const worker of workers) {
      this.statusPane.updateWorkerDisplay(worker.id, {
        id: worker.id,
        status: worker.status,
        progress: worker.progress || 0,
        currentTask: typeof worker.currentTask === 'string' ? worker.currentTask : (worker.currentTask as any)?.description || '',
        estimatedCompletion: worker.estimatedCompletion,
        resourceUsage: worker.resources || worker.resourceUsage
      });
    }

    // Update system information
    await this.updateSystemInfo();

    // Update task queue status
    await this.updateTaskQueueStatus();

    // Refresh display
    this.statusPane.refreshDisplay();
  }

  /**
   * Update system information section
   */
  private async updateSystemInfo(): Promise<void> {
    const systemInfo = {
      timestamp: new Date().toLocaleTimeString(),
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };

    this.statusPane.updateSystemInfo(systemInfo);
  }

  /**
   * Update task queue status
   */
  private async updateTaskQueueStatus(): Promise<void> {
    // Get task statistics from orchestrator
    const workers = await this.orchestrator.listWorkers();
    const taskStats = {
      pending: workers.filter(w => w.status === 'idle').length,
      running: workers.filter(w => w.status === 'running').length,
      completed: workers.filter(w => w.status === 'completed').length,
      failed: workers.filter(w => w.status === 'error').length,
      total: workers.length
    };

    this.statusPane.updateTaskQueue(taskStats);
  }

  /**
   * Add manual notification to status pane
   */
  addNotification(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
    const icons = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅'
    };

    this.statusPane.addNotification(`${icons[type]} ${message}`);
  }

  /**
   * Get current status pane state
   */
  getState(): any {
    return {
      isRunning: this.isRunning,
      workerCount: this.statusPane.getWorkerCount(),
      lastUpdate: new Date().toISOString(),
      integrations: {
        orchestrator: this.orchestrator.listenerCount('worker:created') > 0,
        performanceMonitor: this.performanceMonitor ? this.performanceMonitor.listenerCount('snapshot') > 0 : false
      }
    };
  }
}

export default StatusPaneManager;