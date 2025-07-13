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

// Search & Replace Types
export interface SearchOptions {
  pattern: string;
  path?: string | null;
  case_sensitive: boolean;
  whole_word: boolean;
  regex: boolean;
  include_patterns: string[];
  exclude_patterns: string[];
  max_results: number | null;
  context_lines: number;
  follow_symlinks: boolean;
  search_hidden: boolean;
  max_file_size: number | null;
}

export interface SearchMatch {
  line_number: number;
  line_text: string;
  match_start: number;
  match_end: number;
  context_before: string[];
  context_after: string[];
}

export interface FileSearchResult {
  path: string;
  matches: SearchMatch[];
  total_matches: number;
}

export interface SearchResults {
  results: FileSearchResult[];
  total_matches: number;
  truncated: boolean;
}

export interface ReplaceResult {
  path: string;
  replacements: number;
  success: boolean;
  error?: string;
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
// Re-export from metrics service to avoid duplication
export type { SystemMetrics } from './services/metrics';

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