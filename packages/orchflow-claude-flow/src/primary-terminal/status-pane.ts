import { EventEmitter } from 'events';
import { WorkerInfo } from './conversation-context';
import { TmuxBackend } from '../../tmux-integration/tmux-backend';
import chalk from 'chalk';

export interface StatusPaneConfig {
  width: number;
  updateInterval: number;
  showQuickAccess: boolean;
}

export interface WorkerDisplay {
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
  private workerDisplays: Map<string, WorkerDisplay> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private resourceUsage: ResourceUsage = { cpu: 0, memory: 0, disk: 0 };
  private taskGraph: TaskGraph = { nodes: [], edges: [] };

  constructor(config: StatusPaneConfig) {
    super();
    this.config = config;
    this.tmuxBackend = new TmuxBackend();
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
    await this.renderResourceSection();
    await this.renderShortcutSection();
  }

  private async renderHeader(): Promise<void> {
    const header = `
${chalk.cyan('╔' + '═'.repeat(32) + '╗')}
${chalk.cyan('║')}        ${chalk.bold.white('OrchFlow Status')}         ${chalk.cyan('║')}
${chalk.cyan('╠' + '═'.repeat(32) + '╣')}
${chalk.cyan('║')} ${chalk.yellow('Workers & Progress')}             ${chalk.cyan('║')}
${chalk.cyan('╚' + '═'.repeat(32) + '╝')}
`;
    await this.writeToPane(header);
  }

  async updateWorkerDisplay(workerId: string, status: WorkerInfo): Promise<void> {
    const display = this.formatWorkerDisplay(status);
    this.workerDisplays.set(workerId, { display, lastUpdate: new Date() });
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
    return `${bar} ${chalk.white(progress + '%')}`;
  }

  private async refreshDisplay(): Promise<void> {
    // Clear and redraw the entire status pane
    await this.tmuxBackend.sendKeys(this.paneId, 'clear');
    await this.renderHeader();
    
    // Render all workers
    for (const [workerId, workerDisplay] of this.workerDisplays) {
      await this.writeToPane(workerDisplay.display);
      await this.writeToPane(''); // Empty line between workers
    }
    
    // Render resource usage
    await this.renderResourceUsage();
    
    // Render shortcuts at the bottom
    await this.renderShortcutSection();
  }

  private async renderResourceUsage(): Promise<void> {
    const resourceDisplay = `
${chalk.cyan('┌' + '─'.repeat(32) + '┐')}
${chalk.cyan('│')} ${chalk.yellow('System Resources')}              ${chalk.cyan('│')}
${chalk.cyan('├' + '─'.repeat(32) + '┤')}
${chalk.cyan('│')} CPU:    ${this.renderResourceBar(this.resourceUsage.cpu)}     ${chalk.cyan('│')}
${chalk.cyan('│')} Memory: ${this.renderResourceBar(this.resourceUsage.memory)}     ${chalk.cyan('│')}
${chalk.cyan('│')} Disk:   ${this.renderResourceBar(this.resourceUsage.disk)}     ${chalk.cyan('│')}
${chalk.cyan('└' + '─'.repeat(32) + '┘')}
`;
    await this.writeToPane(resourceDisplay);
  }

  private renderResourceBar(usage: number): string {
    const width = 10;
    const filled = Math.floor((usage / 100) * width);
    const empty = width - filled;
    
    let color = chalk.green;
    if (usage > 80) color = chalk.red;
    else if (usage > 60) color = chalk.yellow;
    
    return color('█'.repeat(filled)) + chalk.gray('░'.repeat(empty)) + ` ${usage}%`;
  }

  private async renderShortcutSection(): Promise<void> {
    const shortcuts = `
${chalk.cyan('┌' + '─'.repeat(32) + '┐')}
${chalk.cyan('│')}      ${chalk.yellow('Quick Access (1-9)')}        ${chalk.cyan('│')}
${chalk.cyan('├' + '─'.repeat(32) + '┤')}
${chalk.cyan('│')} ${chalk.gray('Press number to connect')}       ${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.gray("'list workers' for all")}       ${chalk.cyan('│')}
${chalk.cyan('│')} ${chalk.gray("'connect to [name]' to find")}  ${chalk.cyan('│')}
${chalk.cyan('└' + '─'.repeat(32) + '┘')}
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
    this.taskGraph = graph;
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
}