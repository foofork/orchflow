import { TmuxBackend } from '../tmux-integration/tmux-backend';
import { StatusPane } from '../primary-terminal/status-pane';
import { EventEmitter } from 'events';

export interface SplitScreenConfig {
  primaryWidth: number; // percentage (e.g., 70)
  statusWidth: number;  // percentage (e.g., 30)
  sessionName?: string;
  enableQuickAccess?: boolean;
}

export class SplitScreenManager extends EventEmitter {
  private tmux: TmuxBackend;
  private config: SplitScreenConfig;
  private sessionId: string = '';
  private primaryPaneId: string = '';
  private statusPaneId: string = '';
  private statusPane?: StatusPane;
  private isInitialized: boolean = false;

  constructor(config: SplitScreenConfig) {
    super();
    this.config = {
      enableQuickAccess: true,
      ...config
    };
    this.tmux = new TmuxBackend();
  }

  async initialize(): Promise<void> {
    console.log('Initializing OrchFlow split-screen layout...');

    try {
      // Create main session
      const sessionName = this.config.sessionName || `orchflow_${Date.now()}`;
      const session = await this.tmux.createSession(sessionName);
      this.sessionId = session.id;

      // Get the first pane as primary
      this.primaryPaneId = session.panes[0].id;

      // Create 70/30 vertical split
      const statusPane = await this.tmux.splitPane(this.sessionId, this.primaryPaneId, 'vertical', this.config.statusWidth);
      this.statusPaneId = statusPane.id;

      // Resize panes to 70/30 ratio
      await this.resizePanes();

      // Initialize status pane
      this.statusPane = new StatusPane(this.tmux, this.statusPaneId);
      await this.statusPane.initialize(this.statusPaneId);

      // Setup primary pane
      await this.setupPrimaryPane();

      // Setup event handlers
      this.setupEventHandlers();

      this.isInitialized = true;
      this.emit('initialized', {
        sessionId: this.sessionId,
        primaryPaneId: this.primaryPaneId,
        statusPaneId: this.statusPaneId
      });

      console.log('OrchFlow split-screen layout initialized successfully');
    } catch (error) {
      console.error('Failed to initialize split-screen layout:', error);
      throw error;
    }
  }

  private async resizePanes(): Promise<void> {
    // Tmux uses terminal columns for sizing
    // We'll assume standard terminal width and calculate
    const primaryCols = Math.floor(120 * (this.config.primaryWidth / 100));
    const statusCols = Math.floor(120 * (this.config.statusWidth / 100));

    // Send tmux resize commands
    await this.tmux.sendKeys(this.sessionId,
      `tmux resize-pane -t ${this.primaryPaneId} -x ${primaryCols}`);
    await this.tmux.sendKeys(this.sessionId,
      `tmux resize-pane -t ${this.statusPaneId} -x ${statusCols}`);
  }

  private async setupPrimaryPane(): Promise<void> {
    // Set up the primary pane for natural language interaction
    await this.tmux.sendKeys(this.primaryPaneId, 'clear');

    // Display welcome message
    const welcomeMessage = this.getWelcomeMessage();
    await this.tmux.sendKeys(this.primaryPaneId, `echo "${welcomeMessage}"`);

    // Set pane title
    await this.tmux.sendKeys(this.primaryPaneId,
      `tmux set-option -t ${this.primaryPaneId} pane-title "OrchFlow Primary Terminal"`);

    if (this.config.enableQuickAccess) {
      await this.setupQuickAccessKeys();
    }
  }

  private getWelcomeMessage(): string {
    return `
╭─────────────────────────────────────────────────────────────╮
│                    🐝 OrchFlow Terminal                     │
│                Natural Language Orchestration              │
├─────────────────────────────────────────────────────────────┤
│  Quick Commands:                                            │
│  • "Build a React component for user profiles"             │
│  • "Connect to the API developer"                          │
│  • "Show me all workers"                                   │
│  • Press 1-9 to access workers instantly                   │
│                                                             │
│  Status Pane: Real-time worker monitoring →                │
╰─────────────────────────────────────────────────────────────╯
`;
  }

  private async setupQuickAccessKeys(): Promise<void> {
    // Setup tmux key bindings for quick access (1-9)
    for (let i = 1; i <= 9; i++) {
      const keyBinding = `tmux bind-key ${i} run-shell 'echo "Quick access ${i}" | tmux display-message'`;
      await this.tmux.sendKeys(this.primaryPaneId, keyBinding);
    }
  }

  private setupEventHandlers(): void {
    // Handle status pane updates
    if (this.statusPane) {
      this.statusPane.on('workerUpdate', (data) => {
        this.emit('workerUpdate', data);
      });

      this.statusPane.on('statusChange', (data) => {
        this.emit('statusChange', data);
      });
    }

    // Handle pane switching
    this.on('switchToPrimary', () => {
      this.switchToPrimaryPane();
    });

    this.on('switchToStatus', () => {
      this.switchToStatusPane();
    });
  }

  async updateWorkerStatus(workers: any[]): Promise<void> {
    if (this.statusPane) {
      await this.statusPane.updateWorkers(workers);
    }
  }

  async addWorkerToStatus(worker: any): Promise<void> {
    if (this.statusPane) {
      await this.statusPane.addWorker(worker);
    }
  }

  async removeWorkerFromStatus(workerId: string): Promise<void> {
    if (this.statusPane) {
      await this.statusPane.removeWorker(workerId);
    }
  }

  async connectToWorker(workerId: string): Promise<void> {
    // Create new pane for worker connection
    const workerPane = await this.tmux.splitPane(this.sessionId, this.primaryPaneId, 'horizontal');

    // Connect to worker in new pane
    await this.tmux.sendKeys(workerPane.id, `# Connecting to worker ${workerId}`);

    this.emit('workerConnected', { workerId, paneId: workerPane.id });
  }

  async switchToPrimaryPane(): Promise<void> {
    await this.tmux.sendKeys(this.sessionId, `tmux select-pane -t ${this.primaryPaneId}`);
    this.emit('paneChanged', { pane: 'primary', paneId: this.primaryPaneId });
  }

  async switchToStatusPane(): Promise<void> {
    await this.tmux.sendKeys(this.sessionId, `tmux select-pane -t ${this.statusPaneId}`);
    this.emit('paneChanged', { pane: 'status', paneId: this.statusPaneId });
  }

  async sendToPrimaryPane(message: string): Promise<void> {
    await this.tmux.sendKeys(this.primaryPaneId, message);
  }

  async displayNotification(message: string, duration: number = 3000): Promise<void> {
    // Display notification in status pane
    await this.tmux.sendKeys(this.statusPaneId,
      `tmux display-message -t ${this.statusPaneId} -d ${duration} "${message}"`);
  }

  async highlightWorker(workerId: string): Promise<void> {
    if (this.statusPane) {
      await this.statusPane.highlightWorker(workerId);
    }
  }

  getLayoutInfo(): any {
    return {
      sessionId: this.sessionId,
      primaryPaneId: this.primaryPaneId,
      statusPaneId: this.statusPaneId,
      config: this.config,
      isInitialized: this.isInitialized
    };
  }

  async resizeLayout(primaryWidth: number, statusWidth: number): Promise<void> {
    this.config.primaryWidth = primaryWidth;
    this.config.statusWidth = statusWidth;
    await this.resizePanes();
    this.emit('layoutResized', { primaryWidth, statusWidth });
  }

  async cleanup(): Promise<void> {
    console.log('Cleaning up split-screen layout...');

    if (this.statusPane) {
      await this.statusPane.cleanup();
    }

    if (this.sessionId) {
      await this.tmux.killSession(this.sessionId);
    }

    this.removeAllListeners();
    this.isInitialized = false;
  }

  // Worker management methods for cli-injected.ts
  async addWorker(worker: any): Promise<void> {
    await this.addWorkerToStatus(worker);
  }

  async updateWorker(worker: any): Promise<void> {
    if (this.statusPane) {
      await this.statusPane.updateWorker(worker);
    }
  }

  async removeWorker(workerId: string): Promise<void> {
    await this.removeWorkerFromStatus(workerId);
  }
}