import WebSocket from 'ws';
import { EventEmitter } from 'events';
import type { WorkerInfo } from '../types/unified-interfaces';
import type { Task } from '../types/unified-interfaces';

// Task interface moved to unified-interfaces.ts

// SessionData interface moved to unified-interfaces.ts
import type { SessionData } from '../types/unified-interfaces';

// Re-export SessionData for backward compatibility
export type { SessionData };

export class OrchestratorClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private endpoint: string;
  private requestId: number = 0;
  private pendingRequests: Map<string, {
    resolve: (result: any) => void;
    reject: (error: any) => void;
  }> = new Map();
  private connected: boolean = false;

  constructor(endpoint: string) {
    super();
    this.endpoint = endpoint;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.endpoint);

      this.ws.on('open', () => {
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        this.reconnect();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async submitTask(task: Task): Promise<any> {
    return this.sendRequest('submitTask', { task });
  }

  async listWorkers(): Promise<WorkerInfo[]> {
    return this.sendRequest('listWorkers', {});
  }

  async getWorker(workerId: string): Promise<WorkerInfo | null> {
    return this.sendRequest('getWorker', { workerId });
  }

  async pauseWorker(workerId: string): Promise<void> {
    return this.sendRequest('pauseWorker', { workerId });
  }

  async resumeWorker(workerId: string): Promise<void> {
    return this.sendRequest('resumeWorker', { workerId });
  }

  async getSessionData(): Promise<SessionData | null> {
    return this.sendRequest('getSessionData', {});
  }

  async saveSessionData(data: SessionData): Promise<void> {
    return this.sendRequest('saveSessionData', { data });
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    const id = this.generateRequestId();
    const message = {
      id,
      method,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      if (!this.ws || !this.connected) {
        reject(new Error('Not connected to orchestrator'));
        return;
      }

      this.ws.send(JSON.stringify(message));

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  private handleMessage(message: any): void {
    if (message.id && this.pendingRequests.has(message.id)) {
      const handler = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);

      if (message.error) {
        // Handle error properly - it might be a string or an object
        const errorMessage = typeof message.error === 'string' 
          ? message.error 
          : (message.error.message || 'Unknown error');
        handler.reject(new Error(errorMessage));
      } else {
        handler.resolve(message.result);
      }
    } else if (message.type === 'event') {
      // Handle events from orchestrator
      this.emit(message.event, message.data);
    }
  }

  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  private async reconnect(): Promise<void> {
    // Attempt to reconnect after 5 seconds
    setTimeout(() => {
      if (!this.connected) {
        this.connect().catch(() => {
          // Continue trying to reconnect
          this.reconnect();
        });
      }
    }, 5000);
  }

  isConnected(): boolean {
    return this.connected;
  }

  // Subscribe to worker updates
  onWorkerUpdate(callback: (worker: WorkerInfo) => void): void {
    this.on('workerUpdate', callback);
  }

  // Subscribe to task updates
  onTaskUpdate(callback: (task: Task) => void): void {
    this.on('taskUpdate', callback);
  }

  // Connect to WebSocket for real-time updates
  async connectWebSocket(wsUrl: string): Promise<void> {
    // If already connected to a different URL, close the existing connection
    if (this.ws && this.connected) {
      this.ws.close();
      this.connected = false;
    }

    // Update endpoint and connect
    this.endpoint = wsUrl;
    await this.connect();
  }
}