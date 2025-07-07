import { EventEmitter } from 'events';
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface StreamConfig {
  bufferSize?: number;
  flushInterval?: number;
  encoding?: BufferEncoding;
  delimiter?: string;
}

export interface StreamChunk {
  agentId: string;
  timestamp: Date;
  data: string;
  type: 'stdout' | 'stderr';
  sequence: number;
}

export class OutputStreamManager extends EventEmitter {
  private streams: Map<string, OutputStream> = new Map();
  private subscribers: Map<string, Set<(chunk: StreamChunk) => void>> = new Map();
  
  constructor() {
    super();
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    // Clean up streams when agents stop
    EventBus.on(OrchflowEvents.AGENT_STOPPED, ({ agentId }) => {
      this.closeStream(agentId);
    });
    
    EventBus.on(OrchflowEvents.TERMINAL_CLOSED, ({ terminalId }) => {
      // Find and close associated streams
      for (const [agentId, stream] of this.streams) {
        if (stream.terminalId === terminalId) {
          this.closeStream(agentId);
        }
      }
    });
  }
  
  createStream(
    agentId: string,
    terminalId: string,
    config: StreamConfig = {}
  ): OutputStream {
    if (this.streams.has(agentId)) {
      return this.streams.get(agentId)!;
    }
    
    const stream = new OutputStream(agentId, terminalId, config);
    this.streams.set(agentId, stream);
    
    // Forward stream events
    stream.on('data', (chunk: StreamChunk) => {
      this.emit('data', chunk);
      this.notifySubscribers(agentId, chunk);
      
      EventBus.emit(OrchflowEvents.TERMINAL_OUTPUT, {
        terminalId,
        output: chunk.data,
        timestamp: chunk.timestamp,
      });
    });
    
    stream.on('error', (error: Error) => {
      this.emit('error', { agentId, error });
      EventBus.emit(OrchflowEvents.TERMINAL_ERROR, {
        terminalId,
        error: error.message,
      });
    });
    
    stream.on('close', () => {
      this.streams.delete(agentId);
      this.emit('close', agentId);
    });
    
    return stream;
  }
  
  getStream(agentId: string): OutputStream | undefined {
    return this.streams.get(agentId);
  }
  
  subscribe(
    agentId: string,
    callback: (chunk: StreamChunk) => void
  ): () => void {
    if (!this.subscribers.has(agentId)) {
      this.subscribers.set(agentId, new Set());
    }
    
    this.subscribers.get(agentId)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(agentId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(agentId);
        }
      }
    };
  }
  
  private notifySubscribers(agentId: string, chunk: StreamChunk): void {
    const subs = this.subscribers.get(agentId);
    if (subs) {
      subs.forEach(callback => {
        try {
          callback(chunk);
        } catch (error) {
          console.error('Subscriber error:', error);
        }
      });
    }
  }
  
  async getRecentOutput(
    agentId: string,
    lines: number = 100
  ): Promise<string[]> {
    const stream = this.streams.get(agentId);
    if (!stream) return [];
    
    return stream.getRecentLines(lines);
  }
  
  closeStream(agentId: string): void {
    const stream = this.streams.get(agentId);
    if (stream) {
      stream.close();
      this.streams.delete(agentId);
      this.subscribers.delete(agentId);
    }
  }
  
  closeAll(): void {
    for (const [agentId] of this.streams) {
      this.closeStream(agentId);
    }
  }
}

export class OutputStream extends EventEmitter {
  private buffer: string = '';
  private lineBuffer: string[] = [];
  private sequence: number = 0;
  private tmuxProcess?: ChildProcess;
  private flushTimer?: NodeJS.Timer;
  private config: Required<StreamConfig>;
  
  constructor(
    public agentId: string,
    public terminalId: string,
    config: StreamConfig = {}
  ) {
    super();
    
    this.config = {
      bufferSize: config.bufferSize || 1024 * 64, // 64KB
      flushInterval: config.flushInterval || 100, // 100ms
      encoding: config.encoding || 'utf8',
      delimiter: config.delimiter || '\n',
    };
    
    this.startStreaming();
  }
  
  private async startStreaming(): Promise<void> {
    try {
      // Get tmux pane from terminal ID
      const { stdout: paneInfo } = await execAsync(
        `tmux list-panes -a -F "#{session_name}:#{pane_id}" | grep ${this.terminalId}`
      );
      
      if (!paneInfo) {
        throw new Error(`Terminal ${this.terminalId} not found`);
      }
      
      const [session, pane] = paneInfo.trim().split(':');
      
      // Start capturing output
      this.tmuxProcess = spawn('tmux', [
        'capture-pane',
        '-t', `${session}:${pane}`,
        '-p',
        '-S', '-', // Start from beginning
        '-E', '-', // To end
        '-J', // Join wrapped lines
      ]);
      
      this.tmuxProcess.stdout?.on('data', (data: Buffer) => {
        this.handleData(data, 'stdout');
      });
      
      this.tmuxProcess.stderr?.on('data', (data: Buffer) => {
        this.handleData(data, 'stderr');
      });
      
      this.tmuxProcess.on('error', (error: Error) => {
        this.emit('error', error);
      });
      
      this.tmuxProcess.on('close', (code: number) => {
        this.close();
      });
      
      // Start flush timer
      this.startFlushTimer();
      
      // Also set up continuous monitoring
      this.startContinuousMonitoring(session, pane);
    } catch (error) {
      this.emit('error', error);
    }
  }
  
  private startContinuousMonitoring(session: string, pane: string): void {
    // Poll for new content
    const pollInterval = setInterval(async () => {
      if (!this.tmuxProcess) {
        clearInterval(pollInterval);
        return;
      }
      
      try {
        const { stdout } = await execAsync(
          `tmux capture-pane -t ${session}:${pane} -p -S -${this.lineBuffer.length}`
        );
        
        const newLines = stdout.split('\n').filter(line => line.trim());
        const newContent = newLines.slice(this.lineBuffer.length);
        
        if (newContent.length > 0) {
          this.handleData(Buffer.from(newContent.join('\n'), this.config.encoding), 'stdout');
        }
      } catch (error) {
        // Pane might be gone
        clearInterval(pollInterval);
      }
    }, 500); // Poll every 500ms
    
    // Clean up on close
    this.once('close', () => {
      clearInterval(pollInterval);
    });
  }
  
  private handleData(data: Buffer, type: 'stdout' | 'stderr'): void {
    const text = data.toString(this.config.encoding);
    this.buffer += text;
    
    // Process complete lines
    const lines = this.buffer.split(this.config.delimiter);
    
    // Keep the last incomplete line in buffer
    this.buffer = lines.pop() || '';
    
    // Add to line buffer and emit
    for (const line of lines) {
      if (line.trim()) {
        this.lineBuffer.push(line);
        
        // Limit line buffer size
        if (this.lineBuffer.length > 10000) {
          this.lineBuffer.shift();
        }
        
        this.emitChunk(line + this.config.delimiter, type);
      }
    }
    
    // Check buffer size
    if (this.buffer.length > this.config.bufferSize) {
      this.flush();
    }
  }
  
  private emitChunk(data: string, type: 'stdout' | 'stderr'): void {
    const chunk: StreamChunk = {
      agentId: this.agentId,
      timestamp: new Date(),
      data,
      type,
      sequence: this.sequence++,
    };
    
    this.emit('data', chunk);
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      if (this.buffer.length > 0) {
        this.flush();
      }
    }, this.config.flushInterval);
  }
  
  push(data: string): void {
    this.handleData(Buffer.from(data, this.config.encoding), 'stdout');
  }
  
  write(data: string): void {
    this.push(data);
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length > 0) {
      this.emitChunk(this.buffer, 'stdout');
      this.lineBuffer.push(this.buffer);
      this.buffer = '';
    }
  }
  
  getRecentLines(count: number): string[] {
    return this.lineBuffer.slice(-count);
  }
  
  getAllLines(): string[] {
    return [...this.lineBuffer];
  }
  
  pipe(destination: NodeJS.WritableStream): void {
    this.on('data', (chunk: StreamChunk) => {
      destination.write(chunk.data);
    });
  }
  
  close(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush remaining buffer
    this.flush();
    
    if (this.tmuxProcess) {
      this.tmuxProcess.kill();
      this.tmuxProcess = undefined;
    }
    
    this.emit('close');
    this.removeAllListeners();
  }
}

// WebSocket streaming adapter
export class WebSocketStreamAdapter {
  constructor(
    private streamManager: OutputStreamManager,
    private ws: WebSocket
  ) {
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    this.ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'stream:subscribe':
            this.handleSubscribe(data.agentId);
            break;
            
          case 'stream:unsubscribe':
            this.handleUnsubscribe(data.agentId);
            break;
            
          case 'stream:recent':
            await this.handleRecentRequest(data.agentId, data.lines);
            break;
        }
      } catch (error) {
        console.error('WebSocket stream error:', error);
      }
    });
  }
  
  private handleSubscribe(agentId: string): void {
    const unsubscribe = this.streamManager.subscribe(agentId, (chunk) => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'stream:data',
          chunk,
        }));
      }
    });
    
    // Store unsubscribe function
    (this.ws as any).streamUnsubscribers = (this.ws as any).streamUnsubscribers || new Map();
    (this.ws as any).streamUnsubscribers.set(agentId, unsubscribe);
  }
  
  private handleUnsubscribe(agentId: string): void {
    const unsubscribers = (this.ws as any).streamUnsubscribers;
    if (unsubscribers?.has(agentId)) {
      unsubscribers.get(agentId)();
      unsubscribers.delete(agentId);
    }
  }
  
  private async handleRecentRequest(agentId: string, lines: number = 100): Promise<void> {
    const recent = await this.streamManager.getRecentOutput(agentId, lines);
    
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'stream:recent',
        agentId,
        lines: recent,
      }));
    }
  }
  
  cleanup(): void {
    // Unsubscribe from all streams
    const unsubscribers = (this.ws as any).streamUnsubscribers;
    if (unsubscribers) {
      for (const unsubscribe of unsubscribers.values()) {
        unsubscribe();
      }
      unsubscribers.clear();
    }
  }
}

// Global instance
export const outputStreamManager = new OutputStreamManager();