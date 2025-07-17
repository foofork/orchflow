import { EventEmitter } from 'events';
import { WorkerInfo } from './conversation-context';
import { TmuxBackend } from '../../tmux-integration/tmux-backend';
import { OrchestratorClient } from './orchestrator-client';
import chalk from 'chalk';

export interface WorkerConnection {
  workerId: string;
  descriptiveName: string;
  tmuxPaneId: string;
  isInteractive: boolean;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(message: string): Promise<void>;
  getHistory(): Promise<string[]>;
}

class WorkerConnectionImpl implements WorkerConnection {
  workerId: string;
  descriptiveName: string;
  tmuxPaneId: string;
  isInteractive: boolean = false;
  private tmuxBackend: TmuxBackend;
  private isConnected: boolean = false;

  constructor(
    workerInfo: WorkerInfo, 
    tmuxBackend: TmuxBackend
  ) {
    this.workerId = workerInfo.id;
    this.descriptiveName = workerInfo.descriptiveName;
    this.tmuxPaneId = workerInfo.tmuxPaneId;
    this.tmuxBackend = tmuxBackend;
  }

  async connect(): Promise<void> {
    if (this.isConnected) return;
    
    // Switch to worker's tmux pane
    await this.tmuxBackend.selectPane(this.tmuxPaneId);
    
    // Show connection message
    const connectionMsg = chalk.green(`\n# Connected to ${this.descriptiveName}\n`);
    await this.tmuxBackend.sendKeys(this.tmuxPaneId, `echo "${connectionMsg}"`);
    
    this.isConnected = true;
    this.isInteractive = true;
  }

  async disconnect(): Promise<void> {
    if (!this.isConnected) return;
    
    // Send disconnect message
    const disconnectMsg = chalk.yellow(`\n# Disconnected from ${this.descriptiveName}\n`);
    await this.tmuxBackend.sendKeys(this.tmuxPaneId, `echo "${disconnectMsg}"`);
    
    this.isConnected = false;
    this.isInteractive = false;
  }

  async sendMessage(message: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to worker');
    }
    
    await this.tmuxBackend.sendKeys(this.tmuxPaneId, message);
  }

  async getHistory(): Promise<string[]> {
    const output = await this.tmuxBackend.capturePane(this.tmuxPaneId);
    return output.split('\n').filter(line => line.trim());
  }
}

export class WorkerAccessManager extends EventEmitter {
  private activeConnections: Map<string, WorkerConnection> = new Map();
  private tmuxBackend: TmuxBackend;
  private orchestratorClient: OrchestratorClient | null = null;

  constructor() {
    super();
    this.tmuxBackend = new TmuxBackend();
  }

  setOrchestratorClient(client: OrchestratorClient): void {
    this.orchestratorClient = client;
  }

  async connectToWorker(workerId: string): Promise<WorkerConnection> {
    // Check if already connected
    const existingConnection = this.activeConnections.get(workerId);
    if (existingConnection) {
      await existingConnection.connect(); // Ensure it's active
      return existingConnection;
    }
    
    // Get worker info
    const workerInfo = await this.getWorkerInfo(workerId);
    if (!workerInfo) {
      throw new Error(`Worker ${workerId} not found`);
    }
    
    // Create new connection
    const connection = new WorkerConnectionImpl(workerInfo, this.tmuxBackend);
    await connection.connect();
    
    this.activeConnections.set(workerId, connection);
    this.emit('workerConnected', workerInfo);
    
    return connection;
  }

  async connectToWorkerByName(name: string): Promise<WorkerConnection> {
    const workers = await this.listAvailableWorkers();
    
    // Find worker by name (case-insensitive partial match)
    const worker = workers.find(w => 
      w.descriptiveName.toLowerCase().includes(name.toLowerCase())
    );
    
    if (!worker) {
      // Try more fuzzy matching
      const fuzzyMatch = this.fuzzyFindWorker(name, workers);
      if (fuzzyMatch) {
        return this.connectToWorker(fuzzyMatch.id);
      }
      throw new Error(`Worker '${name}' not found`);
    }
    
    return this.connectToWorker(worker.id);
  }

  async connectToWorkerByNumber(number: number): Promise<WorkerConnection> {
    const workers = await this.listAvailableWorkers();
    const worker = workers.find(w => w.quickAccessKey === number);
    
    if (!worker) {
      throw new Error(`No worker assigned to key ${number}`);
    }
    
    return this.connectToWorker(worker.id);
  }

  async listAvailableWorkers(): Promise<WorkerInfo[]> {
    if (!this.orchestratorClient) {
      throw new Error('Orchestrator client not set');
    }
    return this.orchestratorClient.listWorkers();
  }

  async enableQuickAccess(workers: WorkerInfo[]): Promise<void> {
    // Quick access is managed by the workers themselves
    // This method ensures the UI is updated
    this.emit('quickAccessUpdated', workers);
  }

  async disconnectWorker(workerId: string): Promise<void> {
    const connection = this.activeConnections.get(workerId);
    if (connection) {
      await connection.disconnect();
      this.activeConnections.delete(workerId);
      this.emit('workerDisconnected', workerId);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [workerId, connection] of this.activeConnections) {
      await connection.disconnect();
    }
    this.activeConnections.clear();
  }

  getActiveConnection(workerId: string): WorkerConnection | undefined {
    return this.activeConnections.get(workerId);
  }

  getActiveConnections(): WorkerConnection[] {
    return Array.from(this.activeConnections.values());
  }

  private async getWorkerInfo(workerId: string): Promise<WorkerInfo | null> {
    if (!this.orchestratorClient) {
      throw new Error('Orchestrator client not set');
    }
    return this.orchestratorClient.getWorker(workerId);
  }

  private fuzzyFindWorker(query: string, workers: WorkerInfo[]): WorkerInfo | null {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/);
    
    // Score each worker based on matching words
    const scored = workers.map(worker => {
      const nameLower = worker.descriptiveName.toLowerCase();
      const nameWords = nameLower.split(/\s+/);
      
      let score = 0;
      
      // Check each query word
      for (const qWord of queryWords) {
        for (const nWord of nameWords) {
          if (nWord.startsWith(qWord)) {
            score += 2; // Prefix match scores higher
          } else if (nWord.includes(qWord)) {
            score += 1; // Contains match
          }
        }
      }
      
      return { worker, score };
    });
    
    // Sort by score and return best match if score > 0
    scored.sort((a, b) => b.score - a.score);
    
    if (scored.length > 0 && scored[0].score > 0) {
      return scored[0].worker;
    }
    
    return null;
  }

  // Event handling for worker status updates
  onWorkerStatusUpdate(callback: (worker: WorkerInfo) => void): void {
    this.on('workerStatusUpdate', callback);
  }

  // Emit worker status updates
  emitWorkerStatusUpdate(worker: WorkerInfo): void {
    this.emit('workerStatusUpdate', worker);
  }
}