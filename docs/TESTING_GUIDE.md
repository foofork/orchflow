# OrchFlow Comprehensive Testing Guide

## Table of Contents
1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure](#test-structure)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Manual Testing](#manual-testing)
8. [CI/CD Testing](#cicd-testing)
9. [Test Coverage](#test-coverage)
10. [Debugging Tests](#debugging-tests)

## Testing Philosophy

OrchFlow follows a comprehensive testing strategy:
- **Test Pyramid**: Many unit tests, fewer integration tests, minimal E2E tests
- **TDD Approach**: Write tests before implementation when possible
- **Behavior-Driven**: Test user behaviors, not implementation details
- **Fast Feedback**: Tests should run quickly and fail clearly

## Test Structure

```
packages/orchflow-claude-flow/
├── src/
│   ├── __tests__/              # Test files mirror source structure
│   │   ├── unit/               # Unit tests
│   │   ├── integration/        # Integration tests
│   │   └── e2e/               # End-to-end tests
│   └── __mocks__/             # Mock implementations
├── test-utils/                # Shared test utilities
├── jest.config.js             # Jest configuration
└── test-setup.js             # Global test setup

```

## Unit Testing

### Setting Up Unit Tests

```typescript
// src/__tests__/unit/orchestrator/worker-manager.test.ts
import { WorkerManager } from '../../../orchestrator/worker-manager';
import { MockTmuxBackend } from '../../../__mocks__/tmux-backend';

describe('WorkerManager', () => {
  let manager: WorkerManager;
  let mockBackend: MockTmuxBackend;

  beforeEach(() => {
    mockBackend = new MockTmuxBackend();
    manager = new WorkerManager(mockBackend, {
      maxWorkers: 5,
      workerTimeout: 30000
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('spawnWorker', () => {
    it('should create a new worker with correct configuration', async () => {
      const workerId = await manager.spawnWorker('developer', {
        task: 'Build React component',
        capabilities: ['react', 'typescript']
      });

      expect(workerId).toMatch(/^worker_/);
      expect(mockBackend.createSession).toHaveBeenCalledWith(
        expect.stringContaining('worker_')
      );
    });

    it('should enforce worker limits', async () => {
      // Spawn max workers
      for (let i = 0; i < 5; i++) {
        await manager.spawnWorker('developer', {});
      }

      // Attempt to spawn one more
      await expect(
        manager.spawnWorker('developer', {})
      ).rejects.toThrow('Maximum worker limit');
    });

    it('should handle spawn failures gracefully', async () => {
      mockBackend.createSession.mockRejectedValue(
        new Error('tmux not available')
      );

      await expect(
        manager.spawnWorker('developer', {})
      ).rejects.toThrow('Failed to spawn worker');
    });
  });

  describe('lifecycle management', () => {
    it('should pause and resume workers', async () => {
      const workerId = await manager.spawnWorker('developer', {});
      
      await manager.pauseWorker(workerId);
      expect(manager.getWorkerStatus(workerId)).toBe('paused');

      await manager.resumeWorker(workerId);
      expect(manager.getWorkerStatus(workerId)).toBe('running');
    });

    it('should stop workers and clean up resources', async () => {
      const workerId = await manager.spawnWorker('developer', {});
      
      await manager.stopWorker(workerId);
      
      expect(mockBackend.killSession).toHaveBeenCalled();
      expect(manager.getWorker(workerId)).toBeUndefined();
    });
  });
});
```

### Natural Language Testing

```typescript
// src/__tests__/unit/primary-terminal/nl-intent-recognizer.test.ts
import { NLIntentRecognizer } from '../../../primary-terminal/nl-intent-recognizer';

describe('NLIntentRecognizer', () => {
  let recognizer: NLIntentRecognizer;

  beforeEach(() => {
    recognizer = new NLIntentRecognizer();
  });

  describe('task creation intents', () => {
    const taskExamples = [
      { input: 'Build a React component', expected: 'create_task' },
      { input: 'Create REST API endpoints', expected: 'create_task' },
      { input: 'Test the authentication', expected: 'create_task' },
      { input: 'Research GraphQL', expected: 'create_task' }
    ];

    test.each(taskExamples)(
      'should recognize "$input" as $expected',
      ({ input, expected }) => {
        const result = recognizer.recognize(input);
        expect(result.intent).toBe(expected);
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    );
  });

  describe('worker management intents', () => {
    it('should recognize worker listing requests', () => {
      const inputs = [
        'Show me all workers',
        'List workers',
        'Display all active workers',
        'What workers are running?'
      ];

      inputs.forEach(input => {
        const result = recognizer.recognize(input);
        expect(result.intent).toBe('list_workers');
      });
    });

    it('should extract worker references', () => {
      const result = recognizer.recognize('Connect to the React developer');
      
      expect(result.intent).toBe('connect_worker');
      expect(result.entities.workerRef).toBe('React developer');
    });
  });

  describe('quick access recognition', () => {
    it('should recognize numeric quick access', () => {
      for (let i = 1; i <= 9; i++) {
        const result = recognizer.recognize(`Press ${i}`);
        expect(result.intent).toBe('quick_access');
        expect(result.entities.key).toBe(i);
      }
    });
  });
});
```

### State Management Testing

```typescript
// src/__tests__/unit/orchestrator/state-manager.test.ts
import { StateManager } from '../../../orchestrator/state-manager';
import { MemoryStore } from '../../../orchestrator/stores/memory-store';

describe('StateManager', () => {
  let stateManager: StateManager;
  let store: MemoryStore;

  beforeEach(() => {
    store = new MemoryStore();
    stateManager = new StateManager(store);
  });

  describe('state persistence', () => {
    it('should save and restore state atomically', async () => {
      const testState = {
        workers: [{ id: 'w1', status: 'running' }],
        tasks: [{ id: 't1', status: 'pending' }]
      };

      await stateManager.saveState(testState);
      const restored = await stateManager.loadState();

      expect(restored).toEqual(testState);
    });

    it('should handle concurrent saves safely', async () => {
      const saves = [];
      for (let i = 0; i < 10; i++) {
        saves.push(stateManager.saveState({ counter: i }));
      }

      await Promise.all(saves);
      const finalState = await stateManager.loadState();
      
      expect(finalState.counter).toBeDefined();
      expect(finalState.counter).toBeGreaterThanOrEqual(0);
      expect(finalState.counter).toBeLessThan(10);
    });
  });

  describe('snapshots', () => {
    it('should create and restore snapshots', async () => {
      await stateManager.saveState({ version: 1 });
      const snapshotId = await stateManager.createSnapshot('before-change');

      await stateManager.saveState({ version: 2 });
      expect(await stateManager.loadState()).toEqual({ version: 2 });

      await stateManager.restoreSnapshot(snapshotId);
      expect(await stateManager.loadState()).toEqual({ version: 1 });
    });
  });
});
```

## Integration Testing

### Orchestrator Integration

```typescript
// src/__tests__/integration/orchestration-flow.test.ts
import { OrchFlowOrchestrator } from '../../orchestrator/orchflow-orchestrator';
import { WorkerManager } from '../../orchestrator/worker-manager';
import { TaskGraph } from '../../orchestrator/task-graph';
import { MCPServer } from '../../orchestrator/mcp-server';

describe('Orchestration Integration', () => {
  let orchestrator: OrchFlowOrchestrator;

  beforeEach(async () => {
    orchestrator = new OrchFlowOrchestrator({
      port: 0, // Random port
      maxWorkers: 3
    });
    await orchestrator.start();
  });

  afterEach(async () => {
    await orchestrator.stop();
  });

  it('should handle complete task lifecycle', async () => {
    // Create a task
    const taskId = await orchestrator.createTask({
      description: 'Build authentication system',
      type: 'development'
    });

    // Verify task created
    const task = await orchestrator.getTask(taskId);
    expect(task.status).toBe('pending');

    // Start task execution
    await orchestrator.executeTask(taskId);

    // Wait for worker assignment
    await waitFor(() => {
      const updatedTask = orchestrator.getTask(taskId);
      return updatedTask.workerId !== null;
    });

    // Verify worker created
    const workers = await orchestrator.listWorkers();
    expect(workers).toHaveLength(1);
    expect(workers[0].task).toContain('authentication');
  });

  it('should handle worker communication', async () => {
    const taskId = await orchestrator.createTask({
      description: 'Test API endpoints',
      type: 'testing'
    });

    await orchestrator.executeTask(taskId);

    // Send message to worker
    const workerId = (await orchestrator.getTask(taskId)).workerId;
    await orchestrator.sendToWorker(workerId, 'run tests');

    // Verify message received
    const messages = await orchestrator.getWorkerMessages(workerId);
    expect(messages).toContainEqual(
      expect.objectContaining({ content: 'run tests' })
    );
  });
});
```

### Terminal Integration

```typescript
// src/__tests__/integration/terminal-integration.test.ts
import { SplitScreenManager } from '../../terminal-layout/split-screen-manager';
import { StatusPane } from '../../primary-terminal/status-pane';
import { TmuxBackend } from '../../tmux-integration/tmux-backend';

describe('Terminal Layout Integration', () => {
  let layoutManager: SplitScreenManager;
  let tmux: TmuxBackend;

  beforeEach(async () => {
    tmux = new TmuxBackend();
    
    // Skip if tmux not available
    const hasTmux = await tmux.isAvailable();
    if (!hasTmux) {
      return;
    }

    layoutManager = new SplitScreenManager(tmux);
    await layoutManager.initialize();
  });

  afterEach(async () => {
    if (layoutManager) {
      await layoutManager.cleanup();
    }
  });

  it('should create 70/30 split layout', async () => {
    const hasTmux = await tmux.isAvailable();
    if (!hasTmux) {
      console.log('Skipping: tmux not available');
      return;
    }

    const layout = await layoutManager.getLayout();
    
    expect(layout.primaryPane).toBeDefined();
    expect(layout.statusPane).toBeDefined();
    expect(layout.primaryWidth).toBe(70);
    expect(layout.statusWidth).toBe(30);
  });

  it('should update status pane with worker info', async () => {
    const hasTmux = await tmux.isAvailable();
    if (!hasTmux) return;

    await layoutManager.updateStatus({
      workers: [
        { id: 'w1', name: 'React Developer', status: 'running', progress: 45 }
      ]
    });

    // Verify status pane content
    const content = await layoutManager.getStatusContent();
    expect(content).toContain('React Developer');
    expect(content).toContain('45%');
  });
});
```

## End-to-End Testing

### User Workflow Testing

```typescript
// src/__tests__/e2e/user-workflows.test.ts
import { OrchFlowSystem } from '../../test-utils/orchflow-system';
import { UserSimulator } from '../../test-utils/user-simulator';

describe('E2E User Workflows', () => {
  let system: OrchFlowSystem;
  let user: UserSimulator;

  beforeEach(async () => {
    system = new OrchFlowSystem();
    await system.start();
    
    user = new UserSimulator(system);
  });

  afterEach(async () => {
    await system.stop();
  });

  describe('React Development Workflow', () => {
    it('should complete full React component development', async () => {
      // User types natural language command
      await user.type('Build a user profile component with avatar upload');
      
      // System creates worker
      await user.waitForResponse(/Created worker: React Component Developer/);
      
      // User checks status
      await user.type('Show me all workers');
      await user.waitForResponse(/React Component Developer.*Running/);
      
      // User connects to worker
      await user.type('Press 1');
      await user.waitForResponse(/Connected to React Component Developer/);
      
      // Verify worker session
      expect(user.getCurrentPane()).toBe('worker');
      expect(user.getWorkerPrompt()).toContain('React Developer');
      
      // Return to main
      await user.sendKey('Ctrl+D');
      expect(user.getCurrentPane()).toBe('primary');
    });
  });

  describe('Multi-Worker Coordination', () => {
    it('should manage multiple workers efficiently', async () => {
      // Create multiple workers
      await user.type('Build backend API with Express');
      await user.type('Create React frontend');
      await user.type('Set up database schema');
      
      // Verify all workers created
      await user.type('Show me all workers');
      const response = await user.getLastResponse();
      
      expect(response).toContain('[1] Express API Developer');
      expect(response).toContain('[2] React Frontend Developer');
      expect(response).toContain('[3] Database Architect');
      
      // Quick switch between workers
      await user.type('Press 2');
      expect(user.getWorkerName()).toBe('React Frontend Developer');
      
      await user.sendKey('Ctrl+D');
      await user.type('Press 3');
      expect(user.getWorkerName()).toBe('Database Architect');
    });
  });

  describe('Session Persistence', () => {
    it('should save and restore sessions', async () => {
      // Create workers and state
      await user.type('Build authentication system');
      await user.type('Test payment processing');
      
      // Save session
      await user.type('Save session as "morning-work"');
      await user.waitForResponse(/Session saved/);
      
      // Restart system
      await system.restart();
      
      // Restore session
      await user.type('Restore session "morning-work"');
      await user.waitForResponse(/Session restored/);
      
      // Verify workers restored
      await user.type('Show me all workers');
      const response = await user.getLastResponse();
      
      expect(response).toContain('Auth System Builder');
      expect(response).toContain('Payment Test Engineer');
    });
  });
});
```

### Natural Language Understanding E2E

```typescript
// src/__tests__/e2e/natural-language.test.ts
describe('Natural Language Understanding E2E', () => {
  const testCases = [
    {
      category: 'Development Tasks',
      inputs: [
        'Create a REST API for user management',
        'Build a React dashboard with charts',
        'Implement JWT authentication',
        'Set up Redux store for state management'
      ]
    },
    {
      category: 'Testing Tasks',
      inputs: [
        'Test the login functionality',
        'Run integration tests on API',
        'Check accessibility compliance',
        'Validate form inputs'
      ]
    },
    {
      category: 'Research Tasks',
      inputs: [
        'Research microservices patterns',
        'Investigate caching strategies',
        'Analyze competitor APIs',
        'Study GraphQL best practices'
      ]
    }
  ];

  testCases.forEach(({ category, inputs }) => {
    describe(category, () => {
      inputs.forEach(input => {
        it(`should understand: "${input}"`, async () => {
          await user.type(input);
          
          // Verify worker created with appropriate name
          const response = await user.getLastResponse();
          expect(response).toMatch(/Created worker: .* (Developer|Engineer|Analyst)/);
          
          // Verify worker type matches task
          const workers = await system.getWorkers();
          const lastWorker = workers[workers.length - 1];
          
          expect(lastWorker.capabilities).toContain(
            category.toLowerCase().includes('test') ? 'testing' : 
            category.toLowerCase().includes('research') ? 'research' : 
            'development'
          );
        });
      });
    });
  });
});
```

## Performance Testing

### Load Testing

```typescript
// src/__tests__/performance/load-testing.test.ts
import { performance } from 'perf_hooks';

describe('Performance Testing', () => {
  describe('Worker Spawning Performance', () => {
    it('should spawn workers within performance targets', async () => {
      const measurements = [];
      
      for (let i = 0; i < 10; i++) {
        const start = performance.now();
        
        await user.type(`Build component ${i}`);
        await user.waitForResponse(/Created worker/);
        
        const duration = performance.now() - start;
        measurements.push(duration);
      }
      
      const avgTime = measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);
      
      expect(avgTime).toBeLessThan(1000); // < 1s average
      expect(maxTime).toBeLessThan(2000); // < 2s max
    });
  });

  describe('Natural Language Processing Speed', () => {
    it('should process commands within 500ms', async () => {
      const testInputs = [
        'Build a React component',
        'Show me all workers',
        'Connect to the developer',
        'Save session'
      ];
      
      for (const input of testInputs) {
        const start = performance.now();
        
        const result = await system.processNaturalLanguage(input);
        
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(500);
      }
    });
  });

  describe('Memory Usage', () => {
    it('should maintain memory within limits', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create many workers
      for (let i = 0; i < 8; i++) {
        await user.type(`Create worker ${i}`);
      }
      
      // Run for 30 seconds
      await new Promise(resolve => setTimeout(resolve, 30000));
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB
      
      expect(memoryIncrease).toBeLessThan(100); // < 100MB increase
    });
  });
});
```

### Stress Testing

```typescript
// src/__tests__/performance/stress-testing.test.ts
describe('Stress Testing', () => {
  it('should handle rapid command input', async () => {
    const commands = Array(50).fill(0).map((_, i) => 
      `Build component ${i}`
    );
    
    // Fire commands rapidly
    const promises = commands.map(cmd => 
      user.type(cmd, { wait: false })
    );
    
    await Promise.all(promises);
    
    // System should remain responsive
    await user.type('Show me all workers');
    const response = await user.getLastResponse();
    
    expect(response).toContain('workers');
    expect(system.isHealthy()).toBe(true);
  });

  it('should recover from worker crashes', async () => {
    // Create workers
    await user.type('Build authentication');
    await user.type('Build payment system');
    
    // Simulate worker crash
    const workers = await system.getWorkers();
    await system.crashWorker(workers[0].id);
    
    // System should detect and report
    await user.type('Show me all workers');
    const response = await user.getLastResponse();
    
    expect(response).toContain('crashed');
    
    // Should be able to restart
    await user.type('Restart crashed workers');
    await user.waitForResponse(/Restarted/);
  });
});
```

## Manual Testing

### Manual Test Checklist

```markdown
# OrchFlow Manual Testing Checklist

## Installation Testing
- [ ] Clean install from NPM works
- [ ] Upgrade from previous version works
- [ ] Uninstall removes all files
- [ ] Works on macOS (Intel)
- [ ] Works on macOS (Apple Silicon)
- [ ] Works on Linux (Ubuntu)
- [ ] Works on Linux (CentOS)
- [ ] Works on Windows (WSL2)

## Basic Functionality
- [ ] `claude-flow orchflow` launches successfully
- [ ] Terminal splits into 70/30 layout
- [ ] Natural language input accepted
- [ ] Workers spawn correctly
- [ ] Status pane updates live
- [ ] Quick access keys (1-9) work
- [ ] Worker connection works
- [ ] Return to main terminal works

## Natural Language Commands
- [ ] "Build a React component" creates appropriate worker
- [ ] "Show me all workers" lists workers
- [ ] "Connect to X" finds correct worker
- [ ] "Stop worker X" stops the worker
- [ ] "Save session" persists state
- [ ] "Restore session" recovers state

## Edge Cases
- [ ] Handle tmux not installed gracefully
- [ ] Handle claude-flow not installed
- [ ] Handle network disconnection
- [ ] Handle terminal resize
- [ ] Handle Ctrl+C gracefully
- [ ] Handle worker timeout

## Performance
- [ ] Startup time < 3 seconds
- [ ] Worker spawn < 1 second
- [ ] Natural language response < 500ms
- [ ] Memory usage stays under 100MB
- [ ] No memory leaks over time

## Integration
- [ ] All claude-flow commands pass through
- [ ] MCP tools work correctly
- [ ] WebSocket connections stable
- [ ] State persistence reliable
```

### Manual Testing Scenarios

```markdown
# Manual Testing Scenarios

## Scenario 1: First-Time User
1. Install OrchFlow
2. Run `claude-flow orchflow`
3. Type "Build a todo list app"
4. Press 1 to connect to worker
5. Verify smooth experience

## Scenario 2: Power User Workflow
1. Launch OrchFlow
2. Create 5 different workers rapidly
3. Switch between them using 1-5
4. Save session
5. Quit and restart
6. Restore session
7. Verify all workers restored

## Scenario 3: Error Recovery
1. Start OrchFlow
2. Kill tmux externally
3. Try to create worker
4. Verify graceful error message
5. Restart OrchFlow
6. Verify recovery

## Scenario 4: Long Running Session
1. Start OrchFlow
2. Create workers
3. Leave running for 1 hour
4. Monitor memory usage
5. Verify no degradation
6. Create more workers
7. Verify still responsive
```

## CI/CD Testing

### GitHub Actions Configuration

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [16, 18, 20]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ matrix.node }}
    
    - name: Install dependencies
      run: |
        cd packages/orchflow-claude-flow
        npm ci
    
    - name: Run unit tests
      run: |
        cd packages/orchflow-claude-flow
        npm run test:unit
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Install system dependencies
      run: |
        sudo apt-get update
        sudo apt-get install -y tmux
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: 18
    
    - name: Install claude-flow
      run: npm install -g claude-flow@2.0.0-alpha.50
    
    - name: Run integration tests
      run: |
        cd packages/orchflow-claude-flow
        npm run test:integration
    
  e2e-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup environment
      run: |
        sudo apt-get update
        sudo apt-get install -y tmux xvfb
    
    - name: Run E2E tests
      run: |
        cd packages/orchflow-claude-flow
        xvfb-run -a npm run test:e2e

  performance-tests:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Run performance tests
      run: |
        cd packages/orchflow-claude-flow
        npm run test:performance
    
    - name: Store performance results
      uses: benchmark-action/github-action-benchmark@v1
      with:
        tool: 'customBiggerIsBetter'
        output-file-path: ./performance-results.json
        github-token: ${{ secrets.GITHUB_TOKEN }}
        auto-push: true
```

### Test NPM Scripts

```json
// package.json additions
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "jest --testPathPattern=e2e --runInBand",
    "test:performance": "jest --testPathPattern=performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ci": "jest --ci --coverage --maxWorkers=2"
  }
}
```

## Test Coverage

### Coverage Requirements

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/__mocks__/**',
    '!src/test-utils/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/orchestrator/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './src/primary-terminal/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    }
  },
  coverageReporters: ['text', 'lcov', 'html'],
  coverageDirectory: 'coverage'
};
```

### Coverage Analysis

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html

# Check coverage in CI
npm run test:ci
```

## Debugging Tests

### Debug Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Jest Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": [
        "--runInBand",
        "--watchAll=false",
        "${relativeFile}"
      ],
      "console": "integratedTerminal",
      "internalConsoleOptions": "neverOpen"
    }
  ]
}
```

### Debug Utilities

```typescript
// test-utils/debug-helpers.ts
export class TestDebugger {
  static async captureState(system: OrchFlowSystem) {
    return {
      workers: await system.getWorkers(),
      tasks: await system.getTasks(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }

  static async saveDebugSnapshot(name: string, data: any) {
    const dir = path.join(__dirname, '../debug-snapshots');
    await fs.ensureDir(dir);
    
    await fs.writeJson(
      path.join(dir, `${name}-${Date.now()}.json`),
      data,
      { spaces: 2 }
    );
  }

  static logTestProgress(message: string) {
    if (process.env.DEBUG_TESTS) {
      console.log(`[TEST DEBUG] ${message}`);
    }
  }
}
```

### Troubleshooting Tests

Common test issues and solutions:

1. **Flaky Tests**
   - Add proper waitFor conditions
   - Increase timeouts for CI
   - Mock external dependencies

2. **Platform-Specific Failures**
   - Use platform detection
   - Skip tests when dependencies unavailable
   - Provide platform-specific implementations

3. **Timing Issues**
   - Use jest.useFakeTimers()
   - Add retry logic for network operations
   - Implement proper async/await

---

This comprehensive testing guide ensures OrchFlow maintains high quality and reliability across all components and use cases.