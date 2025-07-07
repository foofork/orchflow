// Tab Types
export interface Tab {
  id: string;
  type: 'file' | 'terminal' | 'dashboard';
  title: string;
  icon?: string;
  isPinned?: boolean;
  isDirty?: boolean;
  metadata?: {
    filePath?: string;
    agentId?: string;
    command?: string;
    paneId?: string;
  };
}

// Agent Types
export interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'idle' | 'running' | 'busy' | 'error';
  pid?: number;
  sessionName?: string;
  command?: string;
  createdAt: Date;
  metrics?: {
    cpu: number;
    memory: number;
  };
}

// Layout Types
export interface PaneConfig {
  id: string;
  position: 'main' | 'bottom' | 'bottom-left' | 'bottom-right' | 'side';
  agentType?: string;
  title?: string;
  width?: number;
  height?: number;
}

export interface LayoutTemplate {
  id: string;
  name: string;
  icon?: string;
  panes: PaneConfig[];
}

export interface SessionLayout {
  sessionId: string;
  templateId: string;
  panes: Map<string, PaneState>;
  activePane?: string;
}

export interface PaneState {
  id: string;
  agentId?: string;
  position: string;
  size: { width: number; height: number };
  isActive: boolean;
}

// System Types
export interface SystemMetrics {
  cpu: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  uptime: number;
  agentCount: number;
  activeAgents: number;
}

export interface ActivityLog {
  id: string;
  timestamp: Date;
  type: 'agent' | 'tab' | 'layout' | 'command' | 'system';
  action: string;
  details?: any;
  severity?: 'info' | 'warning' | 'error';
}

// GUI State
export interface GUIState {
  sessionId: string;
  tabs: Tab[];
  activeTabId: string | null;
  agents: Agent[];
  layout: SessionLayout | null;
  metrics: SystemMetrics | null;
  activityLog: ActivityLog[];
  connected: boolean;
}

// WebSocket Messages
export interface WSMessage {
  type: string;
  [key: string]: any;
}

// Terminal Types
export interface Terminal {
  id: string;
  agentId: string;
  title: string;
  cols: number;
  rows: number;
  output: string[];
}

// Command Types
export interface Command {
  id: string;
  command: string;
  agentId?: string;
  timestamp: Date;
  status: 'pending' | 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

// File Types
export interface FileInfo {
  path: string;
  name: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  content?: string;
}

export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

// Editor Types
export interface EditorState {
  filePath: string;
  content: string;
  language?: string;
  cursor?: { line: number; column: number };
  selection?: { start: number; end: number };
  isDirty: boolean;
}

// Dashboard Types
export interface DashboardStats {
  totalAgents: number;
  runningAgents: number;
  totalTabs: number;
  activeSessions: number;
  systemMetrics: SystemMetrics;
  recentActivity: ActivityLog[];
}

// Theme Types
export interface Theme {
  id: string;
  name: string;
  colors: {
    background: string;
    foreground: string;
    primary: string;
    secondary: string;
    accent: string;
    error: string;
    warning: string;
    success: string;
    [key: string]: string;
  };
}