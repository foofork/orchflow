import { MCPTransport, MCPRequest, MCPResponse, MCPNotification } from './types';
import { spawn, ChildProcess } from 'child_process';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { WebSocket } from 'ws';

// HTTP Transport
export class HTTPTransport implements MCPTransport {
  private endpoint: URL;
  private messageHandlers: Array<(message: MCPResponse | MCPNotification) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  
  constructor(endpoint: string) {
    this.endpoint = new URL(endpoint);
  }
  
  async send(message: MCPRequest | MCPNotification): Promise<void> {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const protocol = this.endpoint.protocol === 'https:' ? https : http;
    
    return new Promise((resolve, reject) => {
      const req = protocol.request(this.endpoint, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const response = JSON.parse(data);
              this.messageHandlers.forEach(handler => handler(response));
              resolve();
            } catch (error) {
              reject(error);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.write(JSON.stringify(message));
      req.end();
    });
  }
  
  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void {
    this.messageHandlers.push(handler);
  }
  
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }
  
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }
  
  async close(): Promise<void> {
    this.closeHandlers.forEach(handler => handler());
  }
}

// WebSocket Transport
export class WebSocketTransport implements MCPTransport {
  private ws: WebSocket;
  private messageHandlers: Array<(message: MCPResponse | MCPNotification) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private connected = false;
  
  constructor(endpoint: string) {
    this.ws = new WebSocket(endpoint);
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.ws.on('open', () => {
      this.connected = true;
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.messageHandlers.forEach(handler => handler(message));
      } catch (error) {
        this.errorHandlers.forEach(handler => handler(error as Error));
      }
    });
    
    this.ws.on('error', (error) => {
      this.errorHandlers.forEach(handler => handler(error));
    });
    
    this.ws.on('close', () => {
      this.connected = false;
      this.closeHandlers.forEach(handler => handler());
    });
  }
  
  async send(message: MCPRequest | MCPNotification): Promise<void> {
    if (!this.connected) {
      // Wait for connection
      await new Promise<void>((resolve) => {
        this.ws.once('open', resolve);
      });
    }
    
    return new Promise((resolve, reject) => {
      this.ws.send(JSON.stringify(message), (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void {
    this.messageHandlers.push(handler);
  }
  
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }
  
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }
  
  async close(): Promise<void> {
    this.ws.close();
  }
}

// Stdio Transport (for local processes)
export class StdioTransport implements MCPTransport {
  private process: ChildProcess;
  private messageHandlers: Array<(message: MCPResponse | MCPNotification) => void> = [];
  private errorHandlers: Array<(error: Error) => void> = [];
  private closeHandlers: Array<() => void> = [];
  private buffer = '';
  
  constructor(command: string, args: string[] = []) {
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.process.stdout?.on('data', (data) => {
      this.buffer += data.toString();
      
      // Try to parse complete JSON messages
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.trim()) {
          try {
            const message = JSON.parse(line);
            this.messageHandlers.forEach(handler => handler(message));
          } catch (error) {
            this.errorHandlers.forEach(handler => handler(error as Error));
          }
        }
      }
    });
    
    this.process.stderr?.on('data', (data) => {
      console.error('MCP stderr:', data.toString());
    });
    
    this.process.on('error', (error) => {
      this.errorHandlers.forEach(handler => handler(error));
    });
    
    this.process.on('close', (code) => {
      this.closeHandlers.forEach(handler => handler());
    });
  }
  
  async send(message: MCPRequest | MCPNotification): Promise<void> {
    return new Promise((resolve, reject) => {
      this.process.stdin?.write(JSON.stringify(message) + '\n', (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
  
  onMessage(handler: (message: MCPResponse | MCPNotification) => void): void {
    this.messageHandlers.push(handler);
  }
  
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }
  
  onClose(handler: () => void): void {
    this.closeHandlers.push(handler);
  }
  
  async close(): Promise<void> {
    this.process.kill();
  }
}