import { writable } from 'svelte/store';
import type { Writable } from 'svelte/store';

/**
 * Common test fixtures for component testing
 */

// File system fixtures
export const fileSystemFixtures = {
  basicProject: {
    '/project': { type: 'directory' },
    '/project/src': { type: 'directory' },
    '/project/src/index.ts': { 
      type: 'file', 
      content: 'console.log("Hello, World!");',
      size: 29,
      modified: new Date('2024-01-01')
    },
    '/project/src/utils.ts': { 
      type: 'file', 
      content: 'export function add(a: number, b: number) { return a + b; }',
      size: 59,
      modified: new Date('2024-01-02')
    },
    '/project/package.json': { 
      type: 'file', 
      content: '{"name":"test-project","version":"1.0.0"}',
      size: 41,
      modified: new Date('2024-01-01')
    },
    '/project/README.md': { 
      type: 'file', 
      content: '# Test Project\n\nThis is a test project.',
      size: 39,
      modified: new Date('2024-01-01')
    },
  },
  
  nestedProject: {
    '/workspace': { type: 'directory' },
    '/workspace/frontend': { type: 'directory' },
    '/workspace/frontend/src': { type: 'directory' },
    '/workspace/frontend/src/components': { type: 'directory' },
    '/workspace/frontend/src/components/Button.tsx': { 
      type: 'file',
      content: 'export const Button = () => <button>Click me</button>;',
      size: 54,
      modified: new Date('2024-01-03')
    },
    '/workspace/backend': { type: 'directory' },
    '/workspace/backend/src': { type: 'directory' },
    '/workspace/backend/src/server.js': { 
      type: 'file',
      content: 'const express = require("express");',
      size: 35,
      modified: new Date('2024-01-04')
    },
  },
};

// Terminal session fixtures
export const terminalFixtures = {
  bashSession: {
    id: 'term-1',
    title: 'bash',
    shellType: 'bash',
    cwd: '/home/user/project',
    history: [
      'ls -la',
      'npm install',
      'npm run dev',
    ],
    env: {
      USER: 'testuser',
      HOME: '/home/testuser',
      PATH: '/usr/local/bin:/usr/bin:/bin',
    },
  },
  
  nodeSession: {
    id: 'term-2',
    title: 'node',
    shellType: 'node',
    cwd: '/home/user/project',
    history: [
      'console.log("Hello")',
      'const x = 42',
      'x * 2',
    ],
    output: [
      'Hello',
      'undefined',
      '84',
    ],
  },
  
  gitSession: {
    id: 'term-3',
    title: 'git',
    shellType: 'bash',
    cwd: '/home/user/project',
    history: [
      'git status',
      'git add .',
      'git commit -m "feat: add new feature"',
      'git push origin main',
    ],
  },
};

// Editor fixtures
export const editorFixtures = {
  emptyEditor: {
    content: '',
    language: 'plaintext',
    readonly: false,
    modified: false,
  },
  
  typescriptEditor: {
    content: `import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: '<h1>{{title}}</h1>'
})
export class AppComponent {
  title = 'Hello Angular';
}`,
    language: 'typescript',
    readonly: false,
    modified: false,
    cursor: { line: 1, column: 1 },
    selection: null,
  },
  
  markdownEditor: {
    content: `# Project Documentation

## Overview
This is a sample markdown document.

## Features
- Feature 1
- Feature 2
- Feature 3

## Installation
\`\`\`bash
npm install
\`\`\`
`,
    language: 'markdown',
    readonly: false,
    modified: true,
    cursor: { line: 3, column: 1 },
  },
};

// Settings fixtures
export const settingsFixtures = {
  defaultSettings: {
    theme: 'dark',
    editor: {
      fontSize: 14,
      fontFamily: 'Fira Code, monospace',
      tabSize: 2,
      insertSpaces: true,
      wordWrap: 'off',
      lineNumbers: 'on',
      minimap: { enabled: true },
      formatOnSave: true,
    },
    terminal: {
      fontSize: 14,
      fontFamily: 'monospace',
      cursorStyle: 'block',
      scrollback: 1000,
    },
    shortcuts: {
      'terminal.new': 'Ctrl+Shift+`',
      'terminal.close': 'Ctrl+Shift+W',
      'file.save': 'Ctrl+S',
      'file.open': 'Ctrl+O',
    },
  },
  
  customSettings: {
    theme: 'light',
    editor: {
      fontSize: 16,
      fontFamily: 'JetBrains Mono, monospace',
      tabSize: 4,
      insertSpaces: false,
      wordWrap: 'on',
      lineNumbers: 'relative',
      minimap: { enabled: false },
      formatOnSave: false,
    },
    terminal: {
      fontSize: 16,
      fontFamily: 'Cascadia Code, monospace',
      cursorStyle: 'line',
      scrollback: 5000,
    },
  },
};

// Command palette fixtures
export const commandFixtures = {
  basicCommands: [
    {
      id: 'file.new',
      title: 'New File',
      category: 'File',
      shortcut: 'Ctrl+N',
      icon: 'file-plus',
    },
    {
      id: 'file.open',
      title: 'Open File',
      category: 'File',
      shortcut: 'Ctrl+O',
      icon: 'folder-open',
    },
    {
      id: 'file.save',
      title: 'Save File',
      category: 'File',
      shortcut: 'Ctrl+S',
      icon: 'save',
    },
    {
      id: 'terminal.new',
      title: 'New Terminal',
      category: 'Terminal',
      shortcut: 'Ctrl+Shift+`',
      icon: 'terminal',
    },
    {
      id: 'view.toggleSidebar',
      title: 'Toggle Sidebar',
      category: 'View',
      shortcut: 'Ctrl+B',
      icon: 'sidebar',
    },
  ],
  
  recentCommands: ['file.save', 'terminal.new', 'file.open'],
};

// Mock component props
export const mockProps = {
  button: {
    basic: {
      label: 'Click me',
      onClick: () => {},
    },
    withIcon: {
      label: 'Save',
      icon: 'save',
      onClick: () => {},
      variant: 'primary',
    },
    disabled: {
      label: 'Disabled',
      onClick: () => {},
      disabled: true,
    },
  },
  
  input: {
    text: {
      type: 'text',
      placeholder: 'Enter text...',
      value: '',
    },
    search: {
      type: 'search',
      placeholder: 'Search...',
      value: '',
      icon: 'search',
    },
    password: {
      type: 'password',
      placeholder: 'Enter password...',
      value: '',
      showToggle: true,
    },
  },
  
  modal: {
    basic: {
      title: 'Confirm Action',
      content: 'Are you sure you want to proceed?',
      isOpen: true,
    },
    withActions: {
      title: 'Save Changes',
      content: 'Do you want to save your changes?',
      isOpen: true,
      actions: [
        { label: 'Cancel', action: 'cancel' },
        { label: 'Save', action: 'save', variant: 'primary' },
      ],
    },
  },
};

// Event fixtures
export const eventFixtures = {
  mouseEvents: {
    click: new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    }),
    rightClick: new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
      button: 2,
    }),
    doubleClick: new MouseEvent('dblclick', {
      bubbles: true,
      cancelable: true,
      clientX: 100,
      clientY: 100,
    }),
  },
  
  keyboardEvents: {
    enter: new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      bubbles: true,
      cancelable: true,
    }),
    escape: new KeyboardEvent('keydown', {
      key: 'Escape',
      code: 'Escape',
      bubbles: true,
      cancelable: true,
    }),
    ctrlS: new KeyboardEvent('keydown', {
      key: 's',
      code: 'KeyS',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    }),
  },
};

// Store factories
export function createMockStores() {
  return {
    theme: writable('dark'),
    settings: writable(settingsFixtures.defaultSettings),
    terminals: writable(new Map()),
    activeTerminal: writable(null),
    files: writable(fileSystemFixtures.basicProject),
    selectedFile: writable(null),
    openFiles: writable([]),
    notifications: writable([]),
  };
}

// Component context factories
export function createMockContext(overrides?: Record<string, any>) {
  const stores = createMockStores();
  
  return new Map([
    ['theme', stores.theme],
    ['settings', stores.settings],
    ['terminals', stores.terminals],
    ['activeTerminal', stores.activeTerminal],
    ...Object.entries(overrides || {}),
  ]);
}

// Test data generators
export function generateFileTree(depth: number = 3, breadth: number = 3): any {
  const tree: any = {};
  
  function addNodes(parent: any, currentDepth: number, path: string) {
    if (currentDepth >= depth) return;
    
    for (let i = 0; i < breadth; i++) {
      const isFile = currentDepth === depth - 1 || Math.random() > 0.5;
      const name = isFile ? `file${i}.txt` : `folder${i}`;
      const fullPath = `${path}/${name}`;
      
      parent[fullPath] = isFile
        ? {
            type: 'file',
            content: `Content of ${name}`,
            size: Math.floor(Math.random() * 10000),
            modified: new Date(),
          }
        : { type: 'directory' };
      
      if (!isFile) {
        addNodes(parent, currentDepth + 1, fullPath);
      }
    }
  }
  
  addNodes(tree, 0, '');
  return tree;
}

// Performance test utilities
export function measureRenderTime(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// Async test utilities
export function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (error: any) => void;
  
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  
  return { promise, resolve: resolve!, reject: reject! };
}

// Mock API responses
export const apiFixtures = {
  fileList: {
    success: {
      status: 200,
      data: [
        { id: '1', name: 'file1.txt', path: '/files/file1.txt' },
        { id: '2', name: 'file2.txt', path: '/files/file2.txt' },
      ],
    },
    error: {
      status: 500,
      error: 'Internal server error',
    },
  },
  
  terminalOutput: {
    stdout: 'Command executed successfully\n',
    stderr: '',
    exitCode: 0,
  },
};