/**
 * Test Data Setup for E2E Tests
 * Provides consistent test data and fixtures
 */

import type { Page } from '@playwright/test';

export interface TestUser {
  id: string;
  username: string;
  email: string;
  permissions: string[];
}

export interface TestProject {
  id: string;
  name: string;
  description: string;
  files: TestFile[];
  settings: Record<string, any>;
}

export interface TestFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
  size?: number;
}

export interface TestTerminal {
  id: string;
  title: string;
  shell: string;
  commands: string[];
  output: string[];
}

export interface TestFlow {
  id: string;
  name: string;
  description: string;
  steps: TestFlowStep[];
}

export interface TestFlowStep {
  id: string;
  type: 'command' | 'file' | 'git' | 'terminal';
  action: string;
  parameters: Record<string, any>;
  expected_result?: any;
}

export class TestDataSetup {
  private page: Page;
  private mockData: {
    users: TestUser[];
    projects: TestProject[];
    terminals: TestTerminal[];
    flows: TestFlow[];
    files: TestFile[];
  };

  constructor(page: Page) {
    this.page = page;
    this.mockData = {
      users: [],
      projects: [],
      terminals: [],
      flows: [],
      files: []
    };
  }

  /**
   * Create a test user
   */
  createUser(overrides: Partial<TestUser> = {}): TestUser {
    const user: TestUser = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      username: `testuser-${Date.now()}`,
      email: `test-${Date.now()}@example.com`,
      permissions: ['read', 'write', 'execute'],
      ...overrides
    };
    
    this.mockData.users.push(user);
    return user;
  }

  /**
   * Create a test project with files
   */
  createProject(overrides: Partial<TestProject> = {}): TestProject {
    const project: TestProject = {
      id: `project-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: `Test Project ${Date.now()}`,
      description: 'E2E test project',
      files: [
        {
          path: '/src/main.js',
          content: 'console.log("Hello, World!");',
          type: 'file',
          size: 32
        },
        {
          path: '/src/utils.js',
          content: 'export function utils() { return "utils"; }',
          type: 'file',
          size: 48
        },
        {
          path: '/tests',
          content: '',
          type: 'directory'
        },
        {
          path: '/tests/main.test.js',
          content: 'describe("main", () => { it("works", () => { expect(true).toBe(true); }); });',
          type: 'file',
          size: 80
        }
      ],
      settings: {
        theme: 'dark',
        fontSize: 14,
        autoSave: true
      },
      ...overrides
    };

    this.mockData.projects.push(project);
    return project;
  }

  /**
   * Create a test terminal
   */
  createTerminal(overrides: Partial<TestTerminal> = {}): TestTerminal {
    const terminal: TestTerminal = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: `Terminal ${Date.now()}`,
      shell: '/bin/bash',
      commands: ['echo "Hello"', 'pwd', 'ls -la'],
      output: ['Hello', '/home/user', 'total 12\ndrwxr-xr-x 3 user user 4096 Jan 1 12:00 .'],
      ...overrides
    };

    this.mockData.terminals.push(terminal);
    return terminal;
  }

  /**
   * Create a test flow
   */
  createFlow(overrides: Partial<TestFlow> = {}): TestFlow {
    const flow: TestFlow = {
      id: `flow-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      name: `Test Flow ${Date.now()}`,
      description: 'E2E test flow',
      steps: [
        {
          id: 'step-1',
          type: 'command',
          action: 'execute',
          parameters: { command: 'echo "Starting flow"' }
        },
        {
          id: 'step-2',
          type: 'file',
          action: 'create',
          parameters: { path: '/tmp/test.txt', content: 'test content' }
        },
        {
          id: 'step-3',
          type: 'git',
          action: 'commit',
          parameters: { message: 'Test commit' }
        }
      ],
      ...overrides
    };

    this.mockData.flows.push(flow);
    return flow;
  }

  /**
   * Create test files
   */
  createFiles(files: Partial<TestFile>[]): TestFile[] {
    const createdFiles = files.map(file => ({
      path: `/test-${Date.now()}/${file.path || 'test.txt'}`,
      content: file.content || 'test content',
      type: file.type || 'file' as const,
      size: file.size || file.content?.length || 12,
      ...file
    }));

    this.mockData.files.push(...createdFiles);
    return createdFiles;
  }

  /**
   * Setup comprehensive test data
   */
  async setupComprehensiveData(): Promise<{
    user: TestUser;
    project: TestProject;
    terminal: TestTerminal;
    flow: TestFlow;
    files: TestFile[];
  }> {
    const user = this.createUser({
      username: 'e2e-test-user',
      email: 'e2e@test.com',
      permissions: ['admin', 'read', 'write', 'execute']
    });

    const project = this.createProject({
      name: 'E2E Test Project',
      description: 'Comprehensive E2E test project with multiple files and configurations'
    });

    const terminal = this.createTerminal({
      title: 'E2E Test Terminal',
      commands: [
        'echo "Starting E2E tests"',
        'npm test',
        'git status',
        'ls -la src/',
        'cat package.json'
      ],
      output: [
        'Starting E2E tests',
        '✓ All tests passed',
        'On branch main\nnothing to commit, working tree clean',
        'total 16\n-rw-r--r-- 1 user user 1024 Jan 1 12:00 main.js',
        '{\n  "name": "e2e-test-project",\n  "version": "1.0.0"\n}'
      ]
    });

    const flow = this.createFlow({
      name: 'E2E Test Flow',
      description: 'Complete E2E test flow with multiple operations',
      steps: [
        {
          id: 'init',
          type: 'command',
          action: 'execute',
          parameters: { command: 'npm install' }
        },
        {
          id: 'test',
          type: 'command',
          action: 'execute',
          parameters: { command: 'npm test' }
        },
        {
          id: 'build',
          type: 'command',
          action: 'execute',
          parameters: { command: 'npm run build' }
        },
        {
          id: 'commit',
          type: 'git',
          action: 'commit',
          parameters: { message: 'E2E test commit' }
        }
      ]
    });

    const files = this.createFiles([
      {
        path: 'package.json',
        content: JSON.stringify({
          name: 'e2e-test-project',
          version: '1.0.0',
          scripts: {
            test: 'vitest',
            build: 'vite build'
          }
        }, null, 2),
        type: 'file'
      },
      {
        path: 'src/component.svelte',
        content: '<script>let count = 0;</script><button on:click={() => count++}>{count}</button>',
        type: 'file'
      },
      {
        path: 'tests/component.test.ts',
        content: 'import { test, expect } from "vitest";\ntest("component works", () => {\n  expect(true).toBe(true);\n});',
        type: 'file'
      }
    ]);

    // Install the test data into the page
    await this.installTestData();

    return { user, project, terminal, flow, files };
  }

  /**
   * Install test data into the page context
   */
  async installTestData(): Promise<void> {
    await this.page.evaluate((testData) => {
      (window as any).__E2E_TEST_DATA__ = testData;
      console.log('[TestDataSetup] Test data installed:', Object.keys(testData));
    }, this.mockData);
  }

  /**
   * Get all test data
   */
  getAllTestData() {
    return this.mockData;
  }

  /**
   * Clear all test data
   */
  clearTestData(): void {
    this.mockData = {
      users: [],
      projects: [],
      terminals: [],
      flows: [],
      files: []
    };
  }

  /**
   * Setup realistic performance test data
   */
  async setupPerformanceTestData(): Promise<void> {
    // Create large amounts of test data for performance testing
    const numFiles = 1000;
    const numTerminals = 50;
    const numFlows = 100;

    // Create many files
    const files = Array.from({ length: numFiles }, (_, i) => ({
      path: `/performance-test/file-${i}.txt`,
      content: `Performance test content for file ${i}`.repeat(10),
      type: 'file' as const
    }));
    this.createFiles(files);

    // Create many terminals
    Array.from({ length: numTerminals }, (_, i) => {
      this.createTerminal({
        title: `Performance Terminal ${i}`,
        commands: [`echo "Performance test ${i}"`, `cat file-${i}.txt`],
        output: [`Performance test ${i}`, `Performance test content for file ${i}`]
      });
    });

    // Create many flows
    Array.from({ length: numFlows }, (_, i) => {
      this.createFlow({
        name: `Performance Flow ${i}`,
        description: `Performance test flow ${i}`,
        steps: [
          {
            id: `perf-step-${i}`,
            type: 'command',
            action: 'execute',
            parameters: { command: `echo "Performance flow ${i}"` }
          }
        ]
      });
    });

    await this.installTestData();
  }

  /**
   * Validate test data consistency
   */
  validateTestData(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate users
    this.mockData.users.forEach(user => {
      if (!user.id || !user.username || !user.email) {
        errors.push(`Invalid user: ${JSON.stringify(user)}`);
      }
    });

    // Validate projects
    this.mockData.projects.forEach(project => {
      if (!project.id || !project.name || !Array.isArray(project.files)) {
        errors.push(`Invalid project: ${JSON.stringify(project)}`);
      }
    });

    // Validate terminals
    this.mockData.terminals.forEach(terminal => {
      if (!terminal.id || !terminal.title || !Array.isArray(terminal.commands)) {
        errors.push(`Invalid terminal: ${JSON.stringify(terminal)}`);
      }
    });

    // Validate flows
    this.mockData.flows.forEach(flow => {
      if (!flow.id || !flow.name || !Array.isArray(flow.steps)) {
        errors.push(`Invalid flow: ${JSON.stringify(flow)}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}