import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface MCPMessage {
  id: string;
  type: 'request' | 'response' | 'notification';
  method?: string;
  params?: any;
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

export interface MCPToolInfo {
  name: string;
  description: string;
  parameters: any;
}

export class MCPClient extends EventEmitter {
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
        const message = JSON.parse(data.toString()) as MCPMessage;
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        this.connected = false;
        this.emit('disconnected');
        // Reject all pending requests
        for (const [, handler] of this.pendingRequests) {
          handler.reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  async invokeTool(toolName: string, params: any): Promise<any> {
    const id = this.generateRequestId();
    const message: MCPMessage = {
      id,
      type: 'request',
      method: toolName,
      params
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.sendMessage(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${toolName}`));
        }
      }, 30000);
    });
  }

  async listTools(): Promise<MCPToolInfo[]> {
    return this.invokeTool('mcp.listTools', {});
  }

  private handleMessage(message: MCPMessage): void {
    if (message.type === 'response' && message.id) {
      const handler = this.pendingRequests.get(message.id);
      if (handler) {
        this.pendingRequests.delete(message.id);
        if (message.error) {
          handler.reject(message.error);
        } else {
          handler.resolve(message.result);
        }
      }
    } else if (message.type === 'notification') {
      this.emit('notification', message);
    }
  }

  private sendMessage(message: MCPMessage): void {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to MCP server');
    }
    this.ws.send(JSON.stringify(message));
  }

  private generateRequestId(): string {
    return `req_${++this.requestId}_${Date.now()}`;
  }

  isConnected(): boolean {
    return this.connected;
  }
}