import { vi } from 'vitest';
import type { Session, Pane, PluginInfo } from '$lib/api/manager-client';
import type { 
  SystemMetrics, 
  CPUMetrics, 
  MemoryMetrics, 
  DiskMetrics, 
  NetworkMetrics, 
  ProcessMetrics 
} from '$lib/services/metrics';

// Session builder
export function buildSession(overrides?: Partial<Session>): Session {
  return {
    id: 'test-session-1',
    name: 'Test Session',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    panes: [],
    ...overrides,
  };
}

// Pane builder
export function buildPane(overrides?: Partial<Pane>): Pane {
  return {
    id: 'test-pane-1',
    session_id: 'test-session-1',
    pane_type: 'Terminal',
    title: 'Test Terminal',
    rows: 24,
    cols: 80,
    x: 0,
    y: 0,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Plugin builder
export function buildPlugin(overrides?: Partial<PluginInfo>): PluginInfo {
  return {
    id: 'test-plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    capabilities: [],
    loaded: false,
    ...overrides,
  };
}

// CPU Metrics builder
export function buildCPUMetrics(overrides?: Partial<CPUMetrics>): CPUMetrics {
  return {
    usage: 45.5,
    cores: 8,
    temperature: 65.0,
    frequency: 2400,
    ...overrides,
  };
}

// Memory Metrics builder
export function buildMemoryMetrics(overrides?: Partial<MemoryMetrics>): MemoryMetrics {
  return {
    total: 16384,
    used: 8192,
    available: 8192,
    free: 8192,
    percent: 50.0,
    ...overrides,
  };
}

// Disk Metrics builder
export function buildDiskMetrics(overrides?: Partial<DiskMetrics>): DiskMetrics {
  return {
    total: 512000,
    used: 256000,
    free: 256000,
    percent: 50.0,
    ...overrides,
  };
}

// Network Metrics builder
export function buildNetworkMetrics(overrides?: Partial<NetworkMetrics>): NetworkMetrics {
  return {
    bytesReceived: 2048000,
    bytesSent: 1024000,
    packetsReceived: 2000,
    packetsSent: 1000,
    ...overrides,
  };
}

// Process Metrics builder
export function buildProcessMetrics(overrides?: Partial<ProcessMetrics>): ProcessMetrics {
  return {
    pid: 1234,
    name: 'orchflow',
    cpu: 12.5,
    memory: 8.3,
    status: 'running',
    ...overrides,
  };
}

// System Metrics builder
export function buildSystemMetrics(overrides?: Partial<SystemMetrics>): SystemMetrics {
  return {
    timestamp: Date.now(),
    cpu: buildCPUMetrics(overrides?.cpu),
    memory: buildMemoryMetrics(overrides?.memory),
    disk: buildDiskMetrics(overrides?.disk),
    network: buildNetworkMetrics(overrides?.network),
    processes: overrides?.processes || [buildProcessMetrics()],
    uptime: 86400,
    loadAverage: [1.5, 1.2, 0.9] as [number, number, number],
    ...overrides,
  };
}

// Tree Node builder for file explorer
export interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

export function buildTreeNode(overrides?: Partial<TreeNode>): TreeNode {
  return {
    name: 'test-node',
    path: '/test/path',
    isDirectory: false,
    ...overrides,
  };
}

export function buildDirectoryNode(name: string, path: string, children: TreeNode[] = []): TreeNode {
  return {
    name,
    path,
    isDirectory: true,
    expanded: false,
    children,
  };
}

export function buildFileNode(name: string, path: string): TreeNode {
  return {
    name,
    path,
    isDirectory: false,
  };
}

// Git Status builder
export interface GitStatus {
  branch: string;
  ahead?: number;
  behind?: number;
  staged: Array<{ path: string; status: string }>;
  unstaged: Array<{ path: string; status: string }>;
  untracked: Array<{ path: string }>;
}

export function buildGitStatus(overrides?: Partial<GitStatus>): GitStatus {
  return {
    branch: 'main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides,
  };
}

// Command builder for terminals
export interface Command {
  id: string;
  command: string;
  timestamp: number;
  status: 'running' | 'completed' | 'failed';
  output?: string;
  error?: string;
}

export function buildCommand(overrides?: Partial<Command>): Command {
  return {
    id: 'cmd-1',
    command: 'echo "test"',
    timestamp: Date.now(),
    status: 'completed',
    output: 'test\n',
    ...overrides,
  };
}

// Search Result builder
export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
}

export function buildSearchResult(overrides?: Partial<SearchResult>): SearchResult {
  return {
    file: '/test/file.ts',
    line: 10,
    column: 5,
    match: 'test match',
    context: 'const test match = true;',
    ...overrides,
  };
}

// Module Info builder
export interface ModuleInfo {
  name: string;
  version: string;
  loaded: boolean;
  path: string;
  exports: string[];
}

export function buildModuleInfo(overrides?: Partial<ModuleInfo>): ModuleInfo {
  return {
    name: 'test-module',
    version: '1.0.0',
    loaded: true,
    path: '/modules/test-module',
    exports: ['default', 'testFunction'],
    ...overrides,
  };
}

// Settings builder
export interface Settings {
  theme: 'dark' | 'light';
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  autoSave: boolean;
  autoFormat: boolean;
  terminal: {
    fontSize: number;
    fontFamily: string;
    cursorBlink: boolean;
  };
  editor: {
    vim: boolean;
    lineNumbers: boolean;
    rulers: number[];
  };
}

// Deep merge helper for settings
function deepMergeSettings(target: Settings, overrides?: DeepPartial<Settings>): Settings {
  if (!overrides) return target;
  
  const result = { ...target };
  
  // Handle terminal overrides
  if (overrides.terminal) {
    result.terminal = {
      ...target.terminal,
      ...overrides.terminal,
    };
  }
  
  // Handle editor overrides
  if (overrides.editor) {
    result.editor = {
      ...target.editor,
      ...overrides.editor,
      // Ensure rulers is properly typed - filter out undefined values
      rulers: (overrides.editor.rulers || target.editor.rulers || []).filter((r): r is number => r !== undefined),
    };
  }
  
  // Handle top-level properties
  const { terminal, editor, ...topLevel } = overrides;
  Object.assign(result, topLevel);
  
  return result;
}

// Helper type for deep partial
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export function buildSettings(overrides?: DeepPartial<Settings>): Settings {
  const defaultSettings: Settings = {
    theme: 'dark',
    fontSize: 14,
    tabSize: 2,
    wordWrap: false,
    minimap: true,
    autoSave: false,
    autoFormat: false,
    terminal: {
      fontSize: 14,
      fontFamily: 'monospace',
      cursorBlink: true,
    },
    editor: {
      vim: false,
      lineNumbers: true,
      rulers: [80, 120],
    },
  };
  
  return deepMergeSettings(defaultSettings, overrides);
}

// Command Palette Item builder
export interface CommandPaletteItem {
  id: string;
  label: string;
  icon?: string;
  category?: string;
  shortcut?: string;
  action: () => void | Promise<void>;
  keywords?: string[];
}

export function buildCommandPaletteItem(overrides?: Partial<CommandPaletteItem>): CommandPaletteItem {
  return {
    id: 'test-command',
    label: 'Test Command',
    icon: '📄',
    category: 'File',
    shortcut: 'Ctrl+T',
    action: vi.fn(),
    keywords: ['test', 'command'],
    ...overrides,
  };
}