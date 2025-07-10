// Mock factory functions for common data structures used in tests

export interface MockFileOptions {
  name?: string
  path?: string
  type?: 'file' | 'directory'
  content?: string
  size?: number
  modified?: Date
  children?: Record<string, any>
}

export const mockFile = (overrides: MockFileOptions = {}) => ({
  name: overrides.name || 'test.ts',
  path: overrides.path || '/test.ts',
  type: overrides.type || 'file',
  content: overrides.content || '// test content',
  size: overrides.size || 1024,
  modified: overrides.modified || new Date('2024-01-01'),
  ...overrides,
})

export const mockDirectory = (overrides: MockFileOptions = {}) => ({
  name: overrides.name || 'src',
  path: overrides.path || '/src',
  type: 'directory' as const,
  children: overrides.children || {},
  size: overrides.size || 0,
  modified: overrides.modified || new Date('2024-01-01'),
  ...overrides,
})

export interface MockTerminalOptions {
  id?: string
  title?: string
  shell?: string
  cwd?: string
  isActive?: boolean
  output?: string[]
}

export const mockTerminal = (overrides: MockTerminalOptions = {}) => ({
  id: overrides.id || 'term-1',
  title: overrides.title || 'bash',
  shell: overrides.shell || '/bin/bash',
  cwd: overrides.cwd || '/home/user',
  isActive: overrides.isActive ?? true,
  output: overrides.output || [],
  ...overrides,
})

export interface MockGitStatusOptions {
  modified?: string[]
  untracked?: string[]
  staged?: string[]
  deleted?: string[]
  branch?: string
  ahead?: number
  behind?: number
}

export const mockGitStatus = (overrides: MockGitStatusOptions = {}) => ({
  modified: overrides.modified || [],
  untracked: overrides.untracked || [],
  staged: overrides.staged || [],
  deleted: overrides.deleted || [],
  branch: overrides.branch || 'main',
  ahead: overrides.ahead || 0,
  behind: overrides.behind || 0,
  ...overrides,
})

export interface MockEditorOptions {
  content?: string
  language?: string
  path?: string
  isDirty?: boolean
  cursor?: { line: number; column: number }
  selection?: { start: { line: number; column: number }; end: { line: number; column: number } }
}

export const mockEditor = (overrides: MockEditorOptions = {}) => ({
  content: overrides.content || 'console.log("Hello World")',
  language: overrides.language || 'typescript',
  path: overrides.path || '/src/index.ts',
  isDirty: overrides.isDirty ?? false,
  cursor: overrides.cursor || { line: 1, column: 1 },
  selection: overrides.selection || null,
  ...overrides,
})

export interface MockCommandOptions {
  id?: string
  title?: string
  category?: string
  keybinding?: string
  when?: string
  handler?: () => void
}

export const mockCommand = (overrides: MockCommandOptions = {}) => ({
  id: overrides.id || 'test.command',
  title: overrides.title || 'Test Command',
  category: overrides.category || 'Test',
  keybinding: overrides.keybinding || 'Ctrl+T',
  when: overrides.when || '',
  handler: overrides.handler || vi.fn(),
  ...overrides,
})

export interface MockPluginOptions {
  id?: string
  name?: string
  version?: string
  author?: string
  description?: string
  enabled?: boolean
  settings?: Record<string, any>
}

export const mockPlugin = (overrides: MockPluginOptions = {}) => ({
  id: overrides.id || 'test-plugin',
  name: overrides.name || 'Test Plugin',
  version: overrides.version || '1.0.0',
  author: overrides.author || 'Test Author',
  description: overrides.description || 'A test plugin',
  enabled: overrides.enabled ?? true,
  settings: overrides.settings || {},
  ...overrides,
})

export interface MockThemeOptions {
  id?: string
  name?: string
  type?: 'light' | 'dark'
  colors?: Record<string, string>
}

export const mockTheme = (overrides: MockThemeOptions = {}) => ({
  id: overrides.id || 'test-theme',
  name: overrides.name || 'Test Theme',
  type: overrides.type || 'dark',
  colors: overrides.colors || {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    primary: '#007acc',
    secondary: '#68217a',
    error: '#f44747',
    warning: '#ff8c00',
    success: '#89d185',
  },
  ...overrides,
})

export interface MockNotificationOptions {
  id?: string
  type?: 'info' | 'warning' | 'error' | 'success'
  title?: string
  message?: string
  timestamp?: Date
  actions?: Array<{ label: string; handler: () => void }>
}

export const mockNotification = (overrides: MockNotificationOptions = {}) => ({
  id: overrides.id || 'notif-1',
  type: overrides.type || 'info',
  title: overrides.title || 'Test Notification',
  message: overrides.message || 'This is a test notification',
  timestamp: overrides.timestamp || new Date(),
  actions: overrides.actions || [],
  ...overrides,
})

export interface MockSearchResultOptions {
  file?: string
  line?: number
  column?: number
  match?: string
  preview?: string
}

export const mockSearchResult = (overrides: MockSearchResultOptions = {}) => ({
  file: overrides.file || '/src/index.ts',
  line: overrides.line || 10,
  column: overrides.column || 15,
  match: overrides.match || 'searchTerm',
  preview: overrides.preview || '...context searchTerm context...',
  ...overrides,
})

export interface MockKeybindingOptions {
  key?: string
  command?: string
  when?: string
  args?: any
}

export const mockKeybinding = (overrides: MockKeybindingOptions = {}) => ({
  key: overrides.key || 'Ctrl+S',
  command: overrides.command || 'file.save',
  when: overrides.when || 'editorFocus',
  args: overrides.args || undefined,
  ...overrides,
})

// Batch creation helpers
export const createMockFiles = (count: number, template?: MockFileOptions) => {
  return Array.from({ length: count }, (_, i) => 
    mockFile({
      ...template,
      name: `file-${i}.ts`,
      path: `/src/file-${i}.ts`,
    })
  )
}

export const createMockTerminals = (count: number, template?: MockTerminalOptions) => {
  return Array.from({ length: count }, (_, i) => 
    mockTerminal({
      ...template,
      id: `term-${i}`,
      title: `Terminal ${i + 1}`,
    })
  )
}

export const createMockCommands = (count: number, template?: MockCommandOptions) => {
  return Array.from({ length: count }, (_, i) => 
    mockCommand({
      ...template,
      id: `command.${i}`,
      title: `Command ${i + 1}`,
    })
  )
}

// Export all factories
export default {
  mockFile,
  mockDirectory,
  mockTerminal,
  mockGitStatus,
  mockEditor,
  mockCommand,
  mockPlugin,
  mockTheme,
  mockNotification,
  mockSearchResult,
  mockKeybinding,
  createMockFiles,
  createMockTerminals,
  createMockCommands,
}