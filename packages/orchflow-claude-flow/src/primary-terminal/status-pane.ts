import { EventEmitter } from 'events';
import type { WorkerInfo } from '../types/unified-interfaces';
import { TmuxBackend } from '../tmux-integration/tmux-backend';
import chalk from 'chalk';

export interface StatusPaneConfig {
  width: number;
  updateInterval: number;
  showQuickAccess: boolean;
}

export interface WorkerDisplayStatus {
  display: string;
  lastUpdate: Date;
}

export interface TaskGraph {
  nodes: any[];
  edges: any[];
}

export interface ResourceUsage {
  cpu: number;
  memory: number;
  disk: number;
}

export class StatusPane extends EventEmitter {
  private paneId: string = '';
  private tmuxBackend: TmuxBackend;
  private config: StatusPaneConfig;
  private workerDisplays: Map<string, WorkerInfo> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private resourceUsage: ResourceUsage = { cpu: 0, memory: 0, disk: 0 };
  private _taskGraph: TaskGraph = { nodes: [], edges: [] };
  private taskStatuses: Map<string, string> = new Map();
  private notifications: string[] = [];
  private maxNotifications: number = 5;
  private systemInfo: any = {};
  private taskQueueStats: any = {};
  private workerResources: Map<string, any> = new Map();

  constructor(tmuxBackend: TmuxBackend | StatusPaneConfig, paneId?: string) {
    super();
    if (tmuxBackend instanceof TmuxBackend) {
      this.tmuxBackend = tmuxBackend;
      this.paneId = paneId || '';
      this.config = { width: 30, updateInterval: 1000, showQuickAccess: true };
    } else {
      this.config = tmuxBackend;
      this.tmuxBackend = new TmuxBackend();
    }
  }

  async initialize(paneId: string): Promise<void> {
    this.paneId = paneId;
    await this.setupStatusPaneLayout();
    await this.startContinuousUpdates();
  }

  setPaneId(paneId: string): void {
    this.paneId = paneId;
  }

  private async setupStatusPaneLayout(): Promise<void> {
    // Clear the pane and render initial layout
    await this.tmuxBackend.sendKeys(this.paneId, 'clear');
    await this.renderHeader();
    await this.renderWorkerSection();
    await this.renderResourceUsage();
    await this.renderShortcutSection();
  }

  private async renderHeader(): Promise<void> {
    const header = `
${chalk.cyan(`╔${  '═'.repeat(32)  }╗`)}
${chalk.cyan('║')}        ${chalk.bold.white('OrchFlow Status')}         ${chalk.cyan('║')}
${chalk.cyan(`╠${  '═'.repeat(32)  }╣`)}
${chalk.cyan('║')} ${chalk.yellow('Workers & Progress')}             ${chalk.cyan('║')}
${chalk.cyan(`╚${  '═'.repeat(32)  }╝`)}
`;
    await this.writeToPane(header);
  }

  async updateWorkerDisplay(workerId: string, status: WorkerInfo): Promise<void> {
    this.workerDisplays.set(workerId, status);
    await this.refreshDisplay();
  }

  private formatWorkerDisplay(status: WorkerInfo): string {
    const keyDisplay = status.quickAccessKey ?
      chalk.bold.yellow(`[${status.quickAccessKey}]`) :
      chalk.gray('   ');

    const nameDisplay = chalk.white(status.descriptiveName.padEnd(20));
    const statusIcon = this.getStatusIcon(status.status);
    const statusText = this.formatStatus(status.status);
    const progressBar = this.renderProgressBar(status.progress);

    return `${keyDisplay} ${nameDisplay}
    ${statusIcon} ${statusText} ${progressBar}`;
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'running': return chalk.green('🟢');
      case 'paused': return chalk.yellow('🟡');
      case 'completed': return chalk.green('✅');
      case 'failed': return chalk.red('❌');
      case 'spawning': return chalk.blue('🔄');
      default: return chalk.gray('⚪');
    }
  }

  private formatStatus(status: string): string {
    const colors: Record<string, typeof chalk.green> = {
      'running': chalk.green,
      'paused': chalk.yellow,
      'completed': chalk.green,
      'failed': chalk.red,
      'spawning': chalk.blue
    };

    const color = colors[status] || chalk.gray;
    return color(status.charAt(0).toUpperCase() + status.slice(1).padEnd(10));
  }

  private renderProgressBar(progress: number): string {
    const width = 15;
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
    return `${bar} ${chalk.white(`${progress  }%`)}`;
  }

  async refreshDisplay(): Promise<void> {
    // Clear and redraw the entire status pane
    await this.tmuxBackend.sendKeys(this.paneId, 'clear');
    await this.renderHeader();

    // Render all workers
    for (const [workerId, workerInfo] of this.workerDisplays) {
      const display = this.formatWorkerDisplay(workerInfo);
      await this.writeToPane(display);

      // Show worker-specific resources if available
      const workerResources = this.workerResources.get(workerId);
      if (workerResources) {
        await this.renderWorkerResources(workerId, workerResources);
      }

      await this.writeToPane(''); // Empty line between workers
    }

    // Render task status section
    await this.renderTaskStatusSection();

    // Render notifications section
    await this.renderNotificationsSection();

    // Render system info section
    await this.renderSystemInfoSection();

    // Render task queue section
    await this.renderTaskQueueSection();

    // Render resource usage
    await this.renderResourceUsage();

    // Render shortcuts at the bottom
    await this.renderShortcutSection();
  }

  private async renderResourceUsage(): Promise<void> {
    const resourceDisplay = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')} ${chalk.yellow('System Resources')}              ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}
${chalk.cyan('│')} CPU:    ${this.renderResourceBar(this.resourceUsage.cpu)}     ${chalk.cyan('│')}
${chalk.cyan('│')} Memory: ${this.renderResourceBar(this.resourceUsage.memory)}     ${chalk.cyan('│')}
${chalk.cyan('│')} Disk:   ${this.renderResourceBar(this.resourceUsage.disk)}     ${chalk.cyan('│')}
${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}
`;
    await this.writeToPane(resourceDisplay);
  }

  private renderResourceBar(usage: number): string {
    const width = 10;
    const filled = Math.floor((usage / 100) * width);
    const empty = width - filled;

    let color = chalk.green;
    if (usage > 80) {color = chalk.red;}
    else if (usage > 60) {color = chalk.yellow;}

    return `${color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty))  } ${usage}%`;
  }

  private async renderShortcutSection(): Promise<void> {
    const shortcuts = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')}      ${chalk.yellow('Quick Access (1-9)')}        ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}
${chalk.cyan('│')} ${chalk.gray('Press number to connect')}       ${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.gray("'list workers' for all")}       ${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.gray("'connect to [name]' to find")}  ${chalk.cyan('│')}
${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}
`;
    await this.writeToPane(shortcuts);
  }

  private async writeToPane(content: string): Promise<void> {
    // Write content to the tmux pane
    // Note: In a real implementation, this would use proper tmux control mode
    // For now, we'll simulate with echo commands
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.trim()) {
        await this.tmuxBackend.sendKeys(this.paneId, `echo "${line}"`);
      }
    }
  }

  private async renderWorkerSection(): Promise<void> {
    if (this.workerDisplays.size === 0) {
      await this.writeToPane(chalk.gray('  No active workers'));
      await this.writeToPane('');
    }
  }

  private async startContinuousUpdates(): Promise<void> {
    // Update display at configured interval
    this.updateInterval = setInterval(async () => {
      await this.refreshDisplay();
    }, this.config.updateInterval);
  }

  async restoreWorkers(workers: WorkerInfo[]): Promise<void> {
    for (const worker of workers) {
      await this.updateWorkerDisplay(worker.id, worker);
    }
  }

  updateResourceUsage(usage: ResourceUsage): void {
    this.resourceUsage = usage;
  }

  displayWorkerList(workers: WorkerInfo[]): void {
    // This is handled by updateWorkerDisplay for each worker
    workers.forEach(worker => {
      this.updateWorkerDisplay(worker.id, worker);
    });
  }

  showDependencyGraph(graph: TaskGraph): void {
    this._taskGraph = graph;
    // In a full implementation, this would render the graph
  }

  renderResourceUsageDisplay(usage: ResourceUsage): void {
    this.updateResourceUsage(usage);
  }

  setQuickAccessKeys(workers: WorkerInfo[]): void {
    // Quick access keys are set on the workers themselves
    // This method ensures the display is updated
    workers.forEach(worker => {
      this.updateWorkerDisplay(worker.id, worker);
    });
  }

  async shutdown(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  // Additional methods required by OrchFlowTerminal and SplitScreenManager
  async addWorker(worker: WorkerInfo): Promise<void> {
    await this.updateWorkerDisplay(worker.id, worker);
  }

  async updateWorker(worker: WorkerInfo): Promise<void> {
    await this.updateWorkerDisplay(worker.id, worker);
  }

  async removeWorker(workerId: string): Promise<void> {
    this.workerDisplays.delete(workerId);
    await this.refreshDisplay();
  }

  async updateWorkers(workers: WorkerInfo[]): Promise<void> {
    // Clear existing displays and add all workers
    this.workerDisplays.clear();
    for (const worker of workers) {
      await this.updateWorkerDisplay(worker.id, worker);
    }
  }

  async highlightWorker(workerId: string): Promise<void> {
    const workerDisplay = this.workerDisplays.get(workerId);
    if (workerDisplay) {
      // Re-render with highlight
      await this.refreshDisplay();
      // Could add special highlighting logic here
    }
  }

  async cleanup(): Promise<void> {
    await this.shutdown();
  }

  // Missing methods implementation
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    this.taskStatuses.set(taskId, status);

    // Update the display to show current task status
    await this.refreshDisplay();

    // Emit event for listeners
    this.emit('taskStatusUpdated', { taskId, status });
  }

  async addNotification(message: string): Promise<void> {
    // Add timestamp to notification
    const timestamp = new Date().toLocaleTimeString();
    const notification = `[${timestamp}] ${message}`;

    // Add to notifications array
    this.notifications.unshift(notification);

    // Keep only the most recent notifications
    if (this.notifications.length > this.maxNotifications) {
      this.notifications = this.notifications.slice(0, this.maxNotifications);
    }

    // Refresh display to show new notification
    await this.refreshDisplay();

    // Emit event for listeners
    this.emit('notificationAdded', { message, timestamp });
  }

  async updateWorkerResources(workerId: string, resources: any): Promise<void> {
    this.workerResources.set(workerId, resources);

    // Refresh display to show updated resources
    await this.refreshDisplay();

    // Emit event for listeners
    this.emit('workerResourcesUpdated', { workerId, resources });
  }

  async updateSystemInfo(systemInfo: any): Promise<void> {
    this.systemInfo = { ...this.systemInfo, ...systemInfo };

    // Refresh display to show updated system info
    await this.refreshDisplay();

    // Emit event for listeners
    this.emit('systemInfoUpdated', { systemInfo: this.systemInfo });
  }

  async updateTaskQueue(taskStats: any): Promise<void> {
    this.taskQueueStats = { ...this.taskQueueStats, ...taskStats };

    // Refresh display to show updated task queue
    await this.refreshDisplay();

    // Emit event for listeners
    this.emit('taskQueueUpdated', { taskStats: this.taskQueueStats });
  }

  getWorkerCount(): number {
    return this.workerDisplays.size;
  }

  private async renderWorkerResources(_workerId: string, resources: any): Promise<void> {
    const resourceDisplay = `    ${chalk.gray('Resources:')} CPU: ${resources.cpu || 0}%, Memory: ${resources.memory || 0}%, Disk: ${resources.disk || 0}%`;
    await this.writeToPane(resourceDisplay);
  }

  private async renderTaskStatusSection(): Promise<void> {
    if (this.taskStatuses.size === 0) {
      return;
    }

    const header = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')} ${chalk.yellow('Task Status')}                  ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}`;
    await this.writeToPane(header);

    for (const [taskId, status] of this.taskStatuses) {
      const statusIcon = this.getTaskStatusIcon(status);
      const taskDisplay = `${chalk.cyan('│')} ${statusIcon} ${chalk.white(taskId.slice(0, 15).padEnd(15))} ${chalk.gray(status)} ${chalk.cyan('│')}`;
      await this.writeToPane(taskDisplay);
    }

    const footer = `${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}`;
    await this.writeToPane(footer);
  }

  private getTaskStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'pending': return chalk.yellow('⏳');
      case 'running': return chalk.green('🟢');
      case 'completed': return chalk.green('✅');
      case 'failed': return chalk.red('❌');
      case 'cancelled': return chalk.gray('⚪');
      default: return chalk.gray('❓');
    }
  }

  private async renderNotificationsSection(): Promise<void> {
    if (this.notifications.length === 0) {
      return;
    }

    const header = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')} ${chalk.yellow('Recent Notifications')}         ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}`;
    await this.writeToPane(header);

    for (const notification of this.notifications) {
      // Truncate long notifications to fit
      const truncated = notification.length > 30 ? `${notification.slice(0, 27)  }...` : notification.padEnd(30);
      const notificationDisplay = `${chalk.cyan('│')} ${chalk.white(truncated)} ${chalk.cyan('│')}`;
      await this.writeToPane(notificationDisplay);
    }

    const footer = `${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}`;
    await this.writeToPane(footer);
  }

  private async renderSystemInfoSection(): Promise<void> {
    if (Object.keys(this.systemInfo).length === 0) {
      return;
    }

    const header = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')} ${chalk.yellow('System Information')}           ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}`;
    await this.writeToPane(header);

    for (const [key, value] of Object.entries(this.systemInfo)) {
      const keyDisplay = key.slice(0, 10).padEnd(10);
      const valueDisplay = String(value).slice(0, 18).padEnd(18);
      const infoDisplay = `${chalk.cyan('│')} ${chalk.gray(keyDisplay)}: ${chalk.white(valueDisplay)} ${chalk.cyan('│')}`;
      await this.writeToPane(infoDisplay);
    }

    const footer = `${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}`;
    await this.writeToPane(footer);
  }

  private async renderTaskQueueSection(): Promise<void> {
    if (Object.keys(this.taskQueueStats).length === 0) {
      return;
    }

    const header = `
${chalk.cyan(`┌${  '─'.repeat(32)  }┐`)}
${chalk.cyan('│')} ${chalk.yellow('Task Queue Stats')}             ${chalk.cyan('│')}
${chalk.cyan(`├${  '─'.repeat(32)  }┤`)}`;
    await this.writeToPane(header);

    const stats = [
      { label: 'Pending', value: this.taskQueueStats.pending || 0 },
      { label: 'Running', value: this.taskQueueStats.running || 0 },
      { label: 'Completed', value: this.taskQueueStats.completed || 0 },
      { label: 'Failed', value: this.taskQueueStats.failed || 0 }
    ];

    for (const stat of stats) {
      const statDisplay = `${chalk.cyan('│')} ${chalk.white(stat.label.padEnd(10))}: ${chalk.green(String(stat.value).padStart(8))} ${chalk.cyan('│')}`;
      await this.writeToPane(statDisplay);
    }

    const footer = `${chalk.cyan(`└${  '─'.repeat(32)  }┘`)}`;
    await this.writeToPane(footer);
  }
}