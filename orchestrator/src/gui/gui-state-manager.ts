// GUI State Manager for VS Code-style real-time synchronization
import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { TabManager, Tab } from '../tabs/tab-manager';
import { LayoutManager, SessionLayout, PaneState } from '../layouts/layout-manager';
import { Agent } from '../agent-manager';

// GUI-specific events
export interface GUIEvents {
  // Tab events
  'tab:created': { tab: Tab };
  'tab:activated': { tabId: string };
  'tab:closed': { tabId: string };
  'tab:updated': { tab: Tab };
  'tab:reordered': { tabId: string; newIndex: number };
  
  // Pane events
  'pane:created': { pane: PaneState };
  'pane:focused': { paneId: string };
  'pane:resized': { paneId: string; size: any };
  'pane:closed': { paneId: string };
  
  // Layout events
  'layout:applied': { layout: SessionLayout };
  'layout:saved': { templateId: string };
  
  // Agent events
  'agent:output': { agentId: string; output: string };
  'agent:status': { agentId: string; status: string };
  
  // Dashboard events
  'metrics:updated': { metrics: SystemMetrics };
  'activity:logged': { activity: ActivityLog };
}

export interface SystemMetrics {
  cpu: number;
  memory: number;
  agents: number;
  panes: number;
  uptime: number;
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: 'agent' | 'user' | 'system';
  message: string;
  agentId?: string;
  level: 'info' | 'warning' | 'error';
}

export interface GUIState {
  tabs: Tab[];
  activeTabId?: string;
  layout?: SessionLayout;
  agents: Agent[];
  metrics: SystemMetrics;
  activityLog: ActivityLog[];
  theme: 'dark' | 'light';
  sidebarVisible: boolean;
  terminalHeight: number;
}

export class GUIStateManager extends EventEmitter {
  private state: GUIState;
  private tabManager: TabManager;
  private layoutManager: LayoutManager;
  private clients: Set<WebSocket> = new Set();
  private activityBuffer: ActivityLog[] = [];
  private metricsInterval?: NodeJS.Timer;
  
  constructor(tabManager: TabManager, layoutManager: LayoutManager) {
    super();
    this.tabManager = tabManager;
    this.layoutManager = layoutManager;
    
    this.state = {
      tabs: [],
      agents: [],
      metrics: {
        cpu: 0,
        memory: 0,
        agents: 0,
        panes: 0,
        uptime: 0,
      },
      activityLog: [],
      theme: 'dark',
      sidebarVisible: true,
      terminalHeight: 30,
    };
    
    this.setupEventHandlers();
    this.startMetricsCollection();
  }
  
  private setupEventHandlers(): void {
    // Forward orchestrator events to GUI
    EventBus.on(OrchflowEvents.AGENT_CREATED, (data) => {
      this.logActivity({
        type: 'system',
        message: `Agent created: ${data.name}`,
        agentId: data.agentId,
        level: 'info',
      });
      this.broadcastEvent('agent:status', { agentId: data.agentId, status: 'created' });
    });
    
    EventBus.on(OrchflowEvents.AGENT_STOPPED, (data) => {
      this.logActivity({
        type: 'system',
        message: `Agent stopped: ${data.agentId}`,
        agentId: data.agentId,
        level: 'info',
      });
      this.broadcastEvent('agent:status', { agentId: data.agentId, status: 'stopped' });
    });
    
    EventBus.on(OrchflowEvents.TERMINAL_OUTPUT, (data) => {
      // Forward terminal output to GUI
      this.broadcastEvent('agent:output', {
        agentId: data.terminalId,
        output: data.output,
      });
    });
    
    EventBus.on(OrchflowEvents.COMMAND_EXECUTED, (data) => {
      this.logActivity({
        type: 'user',
        message: `Command: ${data.command}`,
        level: 'info',
      });
    });
    
    EventBus.on(OrchflowEvents.SYSTEM_ERROR, (data) => {
      this.logActivity({
        type: 'system',
        message: data.error,
        level: 'error',
      });
    });
  }
  
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(() => {
      const metrics: SystemMetrics = {
        cpu: process.cpuUsage().user / 1000000, // Convert to seconds
        memory: process.memoryUsage().heapUsed / 1024 / 1024, // Convert to MB
        agents: this.state.agents.filter(a => a.status === 'running').length,
        panes: this.state.layout?.panes.size || 0,
        uptime: process.uptime(),
      };
      
      this.state.metrics = metrics;
      this.broadcastEvent('metrics:updated', { metrics });
    }, 2000); // Update every 2 seconds
  }
  
  // Client management
  addClient(ws: WebSocket): void {
    this.clients.add(ws);
    
    // Send initial state
    ws.send(JSON.stringify({
      type: 'state:initial',
      state: this.getState(),
    }));
    
    // Handle client messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleClientMessage(ws, message);
      } catch (error) {
        console.error('Invalid message from client:', error);
      }
    });
    
    ws.on('close', () => {
      this.clients.delete(ws);
    });
  }
  
  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      // Tab actions
      case 'tab:activate':
        this.tabManager.activateTab(message.tabId);
        break;
        
      case 'tab:close':
        this.tabManager.closeTab(message.tabId, message.force);
        break;
        
      case 'tab:rename':
        this.tabManager.renameTab(message.tabId, message.title);
        break;
        
      case 'tab:pin':
        this.tabManager.pinTab(message.tabId);
        break;
        
      // Pane actions
      case 'pane:focus':
        if (this.state.layout) {
          this.layoutManager.focusPane(this.state.layout.sessionId, message.paneId);
        }
        break;
        
      case 'pane:resize':
        if (this.state.layout) {
          this.layoutManager.resizePane(
            this.state.layout.sessionId,
            message.paneId,
            message.size
          );
        }
        break;
        
      // Layout actions
      case 'layout:apply':
        this.applyLayout(message.templateId, message.customizations);
        break;
        
      case 'layout:save':
        this.saveCurrentLayout(message.name);
        break;
        
      // UI preferences
      case 'ui:theme':
        this.state.theme = message.theme;
        this.broadcastState();
        break;
        
      case 'ui:sidebar':
        this.state.sidebarVisible = message.visible;
        this.broadcastState();
        break;
        
      case 'ui:terminal-height':
        this.state.terminalHeight = message.height;
        this.broadcastState();
        break;
    }
  }
  
  // State management
  getState(): GUIState {
    return {
      ...this.state,
      tabs: this.tabManager.getTabs(),
      activeTabId: this.tabManager.getActiveTab()?.id,
      activityLog: this.activityBuffer.slice(-100), // Last 100 entries
    };
  }
  
  updateAgents(agents: Agent[]): void {
    this.state.agents = agents;
    this.broadcastState();
  }
  
  updateLayout(layout: SessionLayout): void {
    this.state.layout = layout;
    this.broadcastEvent('layout:applied', { layout });
  }
  
  // Activity logging
  private logActivity(activity: Omit<ActivityLog, 'id' | 'timestamp'>): void {
    const log: ActivityLog = {
      id: `activity-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      ...activity,
    };
    
    this.activityBuffer.push(log);
    
    // Keep buffer size reasonable
    if (this.activityBuffer.length > 1000) {
      this.activityBuffer = this.activityBuffer.slice(-500);
    }
    
    this.broadcastEvent('activity:logged', { activity: log });
  }
  
  // Layout operations
  private async applyLayout(templateId: string, customizations?: any): Promise<void> {
    if (!this.state.layout) return;
    
    try {
      const layout = await this.layoutManager.createLayout(
        this.state.layout.sessionId,
        templateId,
        customizations
      );
      this.updateLayout(layout);
      
      this.logActivity({
        type: 'user',
        message: `Applied layout: ${templateId}`,
        level: 'info',
      });
    } catch (error) {
      this.logActivity({
        type: 'system',
        message: `Failed to apply layout: ${error}`,
        level: 'error',
      });
    }
  }
  
  private saveCurrentLayout(name: string): void {
    if (!this.state.layout) return;
    
    const template = this.layoutManager.exportLayout(this.state.layout.sessionId);
    if (template) {
      template.name = name;
      this.layoutManager.saveTemplate(template);
      
      this.broadcastEvent('layout:saved', { templateId: template.id });
      this.logActivity({
        type: 'user',
        message: `Saved layout: ${name}`,
        level: 'info',
      });
    }
  }
  
  // Broadcasting
  private broadcastEvent<K extends keyof GUIEvents>(
    event: K,
    data: GUIEvents[K]
  ): void {
    const message = JSON.stringify({ type: event, ...data });
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  private broadcastState(): void {
    const message = JSON.stringify({
      type: 'state:update',
      state: this.getState(),
    });
    
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
  
  // Cleanup
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    this.clients.forEach(client => client.close());
    this.clients.clear();
    this.removeAllListeners();
  }
}