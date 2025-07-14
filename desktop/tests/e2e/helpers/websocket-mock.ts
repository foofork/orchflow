/**
 * WebSocket Mock for E2E Tests
 * Prevents WebSocket connection errors during tests
 */

export class MockWebSocket {
  url: string;
  readyState: number = 0; // CONNECTING
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    console.log(`[MockWebSocket] Creating WebSocket connection to ${url}`);
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    console.log(`[MockWebSocket] Sending data:`, data);
    // Simulate echo response
    if (this.onmessage) {
      setTimeout(() => {
        this.onmessage!(new MessageEvent('message', { data }));
      }, 5);
    }
  }

  close(code?: number, reason?: string): void {
    console.log(`[MockWebSocket] Closing connection: ${code} - ${reason}`);
    this.readyState = MockWebSocket.CLOSING;
    
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose(new CloseEvent('close', { code, reason }));
      }
    }, 10);
  }

  addEventListener(type: string, listener: EventListener): void {
    switch (type) {
      case 'open':
        this.onopen = listener as any;
        break;
      case 'close':
        this.onclose = listener as any;
        break;
      case 'error':
        this.onerror = listener as any;
        break;
      case 'message':
        this.onmessage = listener as any;
        break;
    }
  }

  removeEventListener(type: string, listener: EventListener): void {
    // Mock implementation
  }
}

export function installWebSocketMock() {
  if (typeof window !== 'undefined') {
    (window as any).WebSocket = MockWebSocket;
    console.log('[MockWebSocket] WebSocket mock installed');
  }
}

export function uninstallWebSocketMock() {
  if (typeof window !== 'undefined' && (window as any).originalWebSocket) {
    (window as any).WebSocket = (window as any).originalWebSocket;
    delete (window as any).originalWebSocket;
    console.log('[MockWebSocket] WebSocket mock uninstalled');
  }
}