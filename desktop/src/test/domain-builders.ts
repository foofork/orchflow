/**
 * Domain-Specific Test Data Builders
 * 
 * Comprehensive builders for all domain objects identified in the test analysis.
 * These builders provide type-safe, flexible construction of test data.
 */

import type { MockedFunction } from 'vitest';
import { createAsyncMock, createSyncMock, createTypedMock } from './mock-factory';

// Terminal Domain Objects
export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  theme: 'light' | 'dark' | 'high-contrast';
  cursorStyle: 'block' | 'line' | 'underline';
  cursorBlink: boolean;
  scrollback: number;
  fastScrollModifier: 'none' | 'ctrl' | 'shift' | 'alt';
  macOptionIsMeta: boolean;
  macOptionClickForcesSelection: boolean;
  convertEol: boolean;
  rightClickSelectsWord: boolean;
}

export function buildTerminalConfig(overrides?: Partial<TerminalConfig>): TerminalConfig {
  return {
    fontSize: 14,
    fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
    theme: 'dark',
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 1000,
    fastScrollModifier: 'alt',
    macOptionIsMeta: false,
    macOptionClickForcesSelection: false,
    convertEol: false,
    rightClickSelectsWord: true,
    ...overrides,
  };
}

export interface TerminalTheme {
  foreground: string;
  background: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export function buildTerminalTheme(overrides?: Partial<TerminalTheme>): TerminalTheme {
  return {
    foreground: '#ffffff',
    background: '#000000',
    cursor: '#ffffff',
    cursorAccent: '#000000',
    selection: '#4d4d4d',
    black: '#2e3436',
    red: '#cc0000',
    green: '#4e9a06',
    yellow: '#c4a000',
    blue: '#3465a4',
    magenta: '#75507b',
    cyan: '#06989a',
    white: '#d3d7cf',
    brightBlack: '#555753',
    brightRed: '#ef2929',
    brightGreen: '#8ae234',
    brightYellow: '#fce94f',
    brightBlue: '#729fcf',
    brightMagenta: '#ad7fa8',
    brightCyan: '#34e2e2',
    brightWhite: '#eeeeec',
    ...overrides,
  };
}

export interface TerminalOutput {
  timestamp: number;
  content: string;
  type: 'stdout' | 'stderr' | 'system';
  formatted?: boolean;
}

export function buildTerminalOutput(
  content: string,
  overrides?: Partial<TerminalOutput>
): TerminalOutput {
  return {
    timestamp: Date.now(),
    content,
    type: 'stdout',
    formatted: false,
    ...overrides,
  };
}

// Editor Domain Objects
export interface EditorConfig {
  vimMode: boolean;
  lineNumbers: boolean;
  rulers: number[];
  wordWrap: boolean;
  tabSize: number;
  insertSpaces: boolean;
  detectIndentation: boolean;
  trimAutoWhitespace: boolean;
  autoClosingBrackets: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  autoClosingQuotes: 'always' | 'languageDefined' | 'beforeWhitespace' | 'never';
  autoSurround: 'languageDefined' | 'quotes' | 'brackets' | 'never';
  minimap: boolean;
  minimapScale: number;
  scrollBeyondLastLine: boolean;
  smoothScrolling: boolean;
  syntaxHighlighting: boolean;
}

export function buildEditorConfig(overrides?: Partial<EditorConfig>): EditorConfig {
  return {
    vimMode: false,
    lineNumbers: true,
    rulers: [80, 120],
    wordWrap: false,
    tabSize: 2,
    insertSpaces: true,
    detectIndentation: true,
    trimAutoWhitespace: true,
    autoClosingBrackets: 'languageDefined',
    autoClosingQuotes: 'languageDefined',
    autoSurround: 'languageDefined',
    minimap: true,
    minimapScale: 1,
    scrollBeyondLastLine: true,
    smoothScrolling: true,
    syntaxHighlighting: true,
    ...overrides,
  };
}

// Command Palette Domain Objects
export interface CommandPaletteItem {
  id: string;
  label: string;
  shortcut?: string;
  category: string;
  description?: string;
  action: (...args: any[]) => void | Promise<void>;
  when?: string; // condition expression
  order?: number;
  icon?: string;
}

export function buildCommandPaletteItem(
  overrides?: Partial<CommandPaletteItem>
): CommandPaletteItem {
  return {
    id: 'test.command',
    label: 'Test Command',
    category: 'General',
    action: createAsyncMock<[], void>(),
    order: 100,
    ...overrides,
  };
}

// Dashboard Domain Objects
export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'terminal' | 'custom';
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data: any;
  config: Record<string, any>;
  visible: boolean;
  refreshInterval?: number;
  lastUpdated: number;
}

export function buildDashboardWidget(
  overrides?: Partial<DashboardWidget>
): DashboardWidget {
  return {
    id: 'widget-1',
    type: 'metric',
    title: 'Test Widget',
    position: { x: 0, y: 0 },
    size: { width: 200, height: 150 },
    data: { value: 42, label: 'Test Metric' },
    config: {},
    visible: true,
    lastUpdated: Date.now(),
    ...overrides,
  };
}

// File Explorer Enhanced Objects
export interface FileNode extends TreeNode {
  permissions?: string;
  size?: number;
  lastModified?: Date;
  gitStatus?: 'modified' | 'added' | 'deleted' | 'untracked' | 'clean';
  isSymlink?: boolean;
  target?: string; // for symlinks
  isHidden?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: TreeNode[];
  expanded?: boolean;
  loading?: boolean;
}

export function buildFileNode(
  name: string,
  path: string,
  overrides?: Partial<FileNode>
): FileNode {
  return {
    name,
    path,
    isDirectory: false,
    permissions: '-rw-r--r--',
    size: 1024,
    lastModified: new Date(),
    gitStatus: 'clean',
    isSymlink: false,
    isHidden: name.startsWith('.'),
    ...overrides,
  };
}

export function buildDirectoryNode(
  name: string,
  path: string,
  children: FileNode[] = [],
  overrides?: Partial<FileNode>
): FileNode {
  return {
    name,
    path,
    isDirectory: true,
    children,
    expanded: false,
    permissions: 'drwxr-xr-x',
    gitStatus: 'clean',
    isSymlink: false,
    isHidden: name.startsWith('.'),
    lastModified: new Date(),
    ...overrides,
  };
}

// Git Domain Objects
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  ahead?: number;
  behind?: number;
  lastCommit?: GitCommit;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  parents: string[];
}

export interface GitOperationResult {
  success: boolean;
  output: string;
  error?: string;
  changes: Array<{
    path: string;
    status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U';
  }>;
  conflicts?: string[];
}

export function buildGitBranch(overrides?: Partial<GitBranch>): GitBranch {
  return {
    name: 'main',
    current: true,
    remote: 'origin',
    ahead: 0,
    behind: 0,
    ...overrides,
  };
}

export function buildGitCommit(overrides?: Partial<GitCommit>): GitCommit {
  return {
    hash: 'a1b2c3d4e5f6789012345678901234567890abcd',
    shortHash: 'a1b2c3d',
    message: 'Initial commit',
    author: 'Test Author',
    email: 'test@example.com',
    date: new Date(),
    parents: [],
    ...overrides,
  };
}

export function buildGitOperationResult(
  overrides?: Partial<GitOperationResult>
): GitOperationResult {
  return {
    success: true,
    output: 'Operation completed successfully',
    changes: [],
    ...overrides,
  };
}

// Git Status for GitPanel
export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
  additions?: number;
  deletions?: number;
}

export interface GitStatus {
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
}

export function buildGitStatus(overrides?: Partial<GitStatus>): GitStatus {
  return {
    branch: 'main',
    upstream: 'origin/main',
    ahead: 0,
    behind: 0,
    staged: [],
    unstaged: [],
    untracked: [],
    ...overrides,
  };
}

// Plugin Domain Objects
export interface PluginState {
  id: string;
  status: 'loading' | 'active' | 'inactive' | 'error';
  config: Record<string, any>;
  dependencies: string[];
  permissions: string[];
  error?: string;
  lastActivated?: Date;
  stats: {
    memoryUsage: number;
    cpuUsage: number;
    apiCalls: number;
  };
}

export function buildPluginState(overrides?: Partial<PluginState>): PluginState {
  return {
    id: 'test-plugin',
    status: 'active',
    config: {},
    dependencies: [],
    permissions: [],
    stats: {
      memoryUsage: 1024,
      cpuUsage: 0.5,
      apiCalls: 0,
    },
    lastActivated: new Date(),
    ...overrides,
  };
}

// Search Domain Objects
export interface SearchResult {
  file: string;
  line: number;
  column: number;
  match: string;
  context: string;
  beforeContext?: string[];
  afterContext?: string[];
  highlighting?: Array<{ start: number; end: number }>;
}

export function buildSearchResult(overrides?: Partial<SearchResult>): SearchResult {
  return {
    file: '/test/file.ts',
    line: 10,
    column: 5,
    match: 'test match',
    context: 'const test match = true;',
    beforeContext: ['// Previous line'],
    afterContext: ['// Next line'],
    highlighting: [{ start: 6, end: 16 }],
    ...overrides,
  };
}

// Mock Component Factories
export interface MockTerminal {
  write: MockedFunction<(data: string) => void>;
  writeln: MockedFunction<(data: string) => void>;
  clear: MockedFunction<() => void>;
  focus: MockedFunction<() => void>;
  blur: MockedFunction<() => void>;
  resize: MockedFunction<(cols: number, rows: number) => void>;
  scrollToBottom: MockedFunction<() => void>;
  scrollToTop: MockedFunction<() => void>;
  selectAll: MockedFunction<() => void>;
  copy: MockedFunction<() => string>;
  paste: MockedFunction<(text: string) => void>;
  dispose: MockedFunction<() => void>;
  onData: MockedFunction<(handler: (data: string) => void) => { dispose: () => void }>;
  onResize: MockedFunction<(handler: (size: { cols: number; rows: number }) => void) => { dispose: () => void }>;
  loadAddon: MockedFunction<(addon: any) => void>;
  open: MockedFunction<(container: HTMLElement) => void>;
}

export function createMockTerminal(): MockTerminal {
  return {
    write: createSyncMock<[string], void>(),
    writeln: createSyncMock<[string], void>(),
    clear: createSyncMock<[], void>(),
    focus: createSyncMock<[], void>(),
    blur: createSyncMock<[], void>(),
    resize: createSyncMock<[number, number], void>(),
    scrollToBottom: createSyncMock<[], void>(),
    scrollToTop: createSyncMock<[], void>(),
    selectAll: createSyncMock<[], void>(),
    copy: createSyncMock<[], string>(),
    paste: createSyncMock<[string], void>(),
    dispose: createSyncMock<[], void>(),
    onData: createSyncMock<[(data: string) => void], { dispose: () => void }>(),
    onResize: createSyncMock<[(size: { cols: number; rows: number }) => void], { dispose: () => void }>(),
    loadAddon: createSyncMock<[any], void>(),
    open: createSyncMock<[HTMLElement], void>(),
  };
}

export interface MockEditor {
  setValue: MockedFunction<(value: string) => void>;
  getValue: MockedFunction<() => string>;
  focus: MockedFunction<() => void>;
  blur: MockedFunction<() => void>;
  undo: MockedFunction<() => void>;
  redo: MockedFunction<() => void>;
  selectAll: MockedFunction<() => void>;
  getSelection: MockedFunction<() => string>;
  replaceSelection: MockedFunction<(text: string) => void>;
  setCursor: MockedFunction<(line: number, column: number) => void>;
  getCursor: MockedFunction<() => { line: number; column: number }>;
  insertAtCursor: MockedFunction<(text: string) => void>;
  dispose: MockedFunction<() => void>;
}

export function createMockEditor(): MockEditor {
  const getCursor = createSyncMock<[], { line: number; column: number }>();
  getCursor.mockReturnValue({ line: 0, column: 0 });
  
  const getValue = createSyncMock<[], string>();
  getValue.mockReturnValue('');
  
  const getSelection = createSyncMock<[], string>();
  getSelection.mockReturnValue('');

  return {
    setValue: createSyncMock<[string], void>(),
    getValue,
    focus: createSyncMock<[], void>(),
    blur: createSyncMock<[], void>(),
    undo: createSyncMock<[], void>(),
    redo: createSyncMock<[], void>(),
    selectAll: createSyncMock<[], void>(),
    getSelection,
    replaceSelection: createSyncMock<[string], void>(),
    setCursor: createSyncMock<[number, number], void>(),
    getCursor,
    insertAtCursor: createSyncMock<[string], void>(),
    dispose: createSyncMock<[], void>(),
  };
}

// Builder utility for creating complex test scenarios
export const testScenarios = {
  /**
   * Create a file tree with git status
   */
  buildGitRepository: (files: Array<{ path: string; status: FileNode['gitStatus'] }>) => {
    return files.map(({ path, status }) => {
      const segments = path.split('/');
      const name = segments[segments.length - 1];
      return buildFileNode(name, path, { gitStatus: status });
    });
  },

  /**
   * Create a terminal session with output history
   */
  buildTerminalSession: (commands: Array<{ command: string; output: string; exitCode?: number }>) => {
    return commands.map(({ command, output, exitCode = 0 }, index) => ({
      id: `cmd-${index}`,
      command,
      output,
      exitCode,
      timestamp: Date.now() - (commands.length - index) * 1000,
    }));
  },

  /**
   * Create a dashboard with multiple widgets
   */
  buildDashboard: (widgetConfigs: Array<Partial<DashboardWidget>>) => {
    return widgetConfigs.map((config, index) =>
      buildDashboardWidget({
        id: `widget-${index}`,
        position: { x: (index % 3) * 220, y: Math.floor(index / 3) * 170 },
        ...config,
      })
    );
  },

  /**
   * Create a plugin ecosystem with dependencies
   */
  buildPluginEcosystem: (plugins: Array<{ id: string; dependencies?: string[] }>) => {
    return plugins.map(({ id, dependencies = [] }) =>
      buildPluginState({
        id,
        dependencies,
        status: dependencies.length > 0 ? 'loading' : 'active',
      })
    );
  },
};