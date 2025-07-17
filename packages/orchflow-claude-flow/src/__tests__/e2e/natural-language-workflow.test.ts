import type { ChildProcess } from 'child_process';
import { spawn } from 'child_process';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import { promisify } from 'util';
import { existsSync, mkdirSync, rmSync } from 'fs';
import path from 'path';

const sleep = promisify(setTimeout);

describe('Natural Language Processing E2E Tests', () => {
  let orchflowProcess: ChildProcess;
  let baseUrl: string;
  let testDir: string;
  let wsUrl: string;

  beforeAll(async () => {
    // Create test directory
    testDir = path.join(__dirname, '../../../test-e2e-nlp-data');
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
    mkdirSync(testDir, { recursive: true });

    // Start OrchFlow with natural language processing enabled
    orchflowProcess = spawn('node', [
      path.join(__dirname, '../../../dist/cli-injected.js'),
      'start',
      '--port', '0',
      '--data-dir', testDir,
      '--enable-nlp', 'true'
    ], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        ORCHFLOW_API_KEY: 'nlp-e2e-test-key',
        LOG_LEVEL: 'info'
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for server to start
    const port = await new Promise<string>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server failed to start'));
      }, 60000);

      orchflowProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        console.log('OrchFlow NLP:', output);

        const portMatch = output.match(/OrchFlow Core started on port (\d+)/);
        if (portMatch) {
          clearTimeout(timeout);
          resolve(portMatch[1]);
        }
      });

      orchflowProcess.stderr?.on('data', (data) => {
        console.error('OrchFlow NLP Error:', data.toString());
      });

      orchflowProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    baseUrl = `http://localhost:${port}`;
    wsUrl = `ws://localhost:${port}`;

    // Wait for server to be ready
    await waitForServer(baseUrl);
  }, 90000);

  afterAll(async () => {
    if (orchflowProcess) {
      orchflowProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        orchflowProcess.on('exit', resolve);
        setTimeout(resolve, 5000);
      });
    }

    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Natural Language Task Creation', () => {
    it('should create workers from natural language descriptions', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      const testCases = [
        {
          input: 'Create a React developer to build user interface components',
          expectedWorkerName: /React.*Developer|Component.*Builder/,
          expectedType: 'developer'
        },
        {
          input: 'I need someone to design the database schema for user management',
          expectedWorkerName: /Database.*Architect|Schema.*Designer/,
          expectedType: 'architect'
        },
        {
          input: 'Build comprehensive tests for the authentication system',
          expectedWorkerName: /Auth.*Test|Test.*Engineer/,
          expectedType: 'tester'
        },
        {
          input: 'Create an API specialist to handle REST endpoints',
          expectedWorkerName: /API.*Specialist|REST.*Developer/,
          expectedType: 'developer'
        }
      ];

      for (const testCase of testCases) {
        const response = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            naturalLanguageInput: testCase.input,
            context: [],
            orchflowContext: {
              workers: [],
              quickAccessMap: {},
              availableCommands: [],
              currentTask: null
            }
          })
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.workerName).toMatch(testCase.expectedWorkerName);
        expect(data.worker?.type).toBe(testCase.expectedType);
        expect(data.quickAccessKey).toBeGreaterThan(0);
        expect(data.quickAccessKey).toBeLessThan(10);
      }
    });

    it('should handle complex multi-step task descriptions', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      const complexInput = `
        I need to build a complete e-commerce platform with the following requirements:
        1. User authentication and registration system
        2. Product catalog with search and filtering
        3. Shopping cart and checkout process
        4. Payment processing integration
        5. Order management system
        6. Admin dashboard for inventory management
        
        Start with the user authentication system and make sure it's secure.
      `;

      const response = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: complexInput,
          context: [],
          orchflowContext: {
            workers: [],
            quickAccessMap: {},
            availableCommands: [],
            currentTask: null
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workerName).toMatch(/Auth|Security|User/);
      expect(data.description).toContain('authentication');
      expect(data.instructions).toContain('e-commerce');
      expect(data.nextSteps).toContain('product catalog');
    });

    it('should provide contextual suggestions based on existing workers', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // First, create a backend developer
      const backendResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Build REST API',
          type: 'developer'
        })
      });

      const backendData = await backendResponse.json();

      // Now create a frontend developer with context about the backend
      const frontendResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create a frontend interface that connects to the API',
          context: [
            { timestamp: new Date(), message: 'Working on full-stack application' },
            { timestamp: new Date(), message: 'Backend API is being developed' }
          ],
          orchflowContext: {
            workers: [backendData.worker],
            quickAccessMap: { 1: backendData.worker.id },
            availableCommands: [
              'Connect to API Developer',
              'Check backend progress'
            ],
            currentTask: {
              mainObjective: 'Build full-stack application',
              activeSubtasks: ['Backend API', 'Frontend interface'],
              completedTasks: ['Project setup']
            }
          }
        })
      });

      expect(frontendResponse.status).toBe(200);
      const frontendData = await frontendResponse.json();

      expect(frontendData.success).toBe(true);
      expect(frontendData.workerName).toMatch(/Frontend|UI|Interface/);
      expect(frontendData.instructions).toContain('API');
      expect(frontendData.nextSteps).toContain('Connect to API Developer');
    });
  });

  describe('Smart Worker Connection', () => {
    it('should connect to workers using natural language', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Create multiple workers
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Database management',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'UI component development',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'API testing',
            type: 'tester'
          })
        })
      ]);

      const workerData = await Promise.all(workers.map(r => r.json()));

      const testCases = [
        { target: 'database', expectedWorker: workerData[0].worker },
        { target: 'UI developer', expectedWorker: workerData[1].worker },
        { target: 'the tester', expectedWorker: workerData[2].worker },
        { target: 'component developer', expectedWorker: workerData[1].worker }
      ];

      for (const testCase of testCases) {
        const response = await fetch(`${baseUrl}/mcp/orchflow_smart_connect`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            target: testCase.target,
            orchflowContext: {
              workers: workerData.map(w => w.worker),
              quickAccessMap: {
                1: workerData[0].worker.id,
                2: workerData[1].worker.id,
                3: workerData[2].worker.id
              },
              availableCommands: [
                'Connect to database developer',
                'Connect to UI developer',
                'Connect to tester'
              ]
            }
          })
        });

        expect(response.status).toBe(200);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.workerId).toBe(testCase.expectedWorker.id);
        expect(data.workerName).toBe(testCase.expectedWorker.name);
      }
    });

    it('should handle ambiguous connection requests', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Create workers with similar names
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Frontend development',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Backend development',
            type: 'developer'
          })
        })
      ]);

      const workerData = await Promise.all(workers.map(r => r.json()));

      const response = await fetch(`${baseUrl}/mcp/orchflow_smart_connect`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          target: 'developer',
          orchflowContext: {
            workers: workerData.map(w => w.worker),
            quickAccessMap: {
              1: workerData[0].worker.id,
              2: workerData[1].worker.id
            },
            availableCommands: []
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.suggestions).toHaveLength(2);
      expect(data.suggestions).toContain('Frontend Developer');
      expect(data.suggestions).toContain('Backend Developer');
    });
  });

  describe('Rich Status and Context Awareness', () => {
    it('should provide rich status with natural language descriptions', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Create workers with different statuses
      const workers = await Promise.all([
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Build authentication system',
            type: 'developer'
          })
        }),
        fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
          method: 'POST',
          headers: apiHeaders,
          body: JSON.stringify({
            task: 'Create unit tests',
            type: 'tester'
          })
        })
      ]);

      await Promise.all(workers.map(r => r.json()));

      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          format: 'detailed',
          orchflowContext: {
            currentTask: {
              mainObjective: 'Build secure web application',
              activeSubtasks: ['Authentication', 'Testing'],
              completedTasks: ['Project setup', 'Database design']
            }
          }
        })
      });

      expect(statusResponse.status).toBe(200);
      const statusData = await statusResponse.json();

      expect(statusData.success).toBe(true);
      expect(statusData.summary).toMatchObject({
        totalWorkers: expect.any(Number),
        activeWorkers: expect.any(Number),
        byType: expect.any(Object)
      });
      expect(statusData.currentTask).toMatchObject({
        mainObjective: 'Build secure web application',
        activeSubtasks: ['Authentication', 'Testing'],
        completedTasks: ['Project setup', 'Database design']
      });
      expect(statusData.instructions).toContain('OrchFlow');
      expect(statusData.quickAccessMap).toMatchObject(expect.any(Object));
    });

    it('should generate context-aware instructions', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Create API developer
      const apiResponse = await fetch(`${baseUrl}/mcp/orchflow_spawn_worker`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          task: 'Build REST API for e-commerce',
          type: 'developer'
        })
      });

      const apiData = await apiResponse.json();

      // Get status to generate instructions
      const statusResponse = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          format: 'detailed',
          orchflowContext: {
            currentTask: {
              mainObjective: 'Build e-commerce platform',
              activeSubtasks: ['API development', 'Database design'],
              completedTasks: ['Requirements gathering']
            }
          }
        })
      });

      const statusData = await statusResponse.json();

      expect(statusData.instructions).toContain('e-commerce');
      expect(statusData.instructions).toContain('API development');
      expect(statusData.instructions).toContain('Press 1-9');
      expect(statusData.instructions).toContain('Connect to');
    });
  });

  describe('Memory-Powered Suggestions', () => {
    it('should learn from successful task patterns', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Store successful task pattern
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: 'orchflow/patterns/react-app',
          value: JSON.stringify({
            input: 'Build React application',
            successfulCommand: 'Create a React component builder',
            context: 'web-development',
            timestamp: new Date().toISOString()
          }),
          namespace: 'orchflow',
          ttl: 7200
        })
      });

      // Store another pattern
      await fetch(`${baseUrl}/mcp/mcp__claude-flow__memory_usage`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          action: 'store',
          key: 'orchflow/patterns/react-components',
          value: JSON.stringify({
            input: 'Create React components',
            successfulCommand: 'Create a React component builder',
            context: 'web-development',
            timestamp: new Date().toISOString()
          }),
          namespace: 'orchflow',
          ttl: 7200
        })
      });

      // Test if similar pattern is suggested
      const response = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Build React user interface',
          context: [],
          orchflowContext: {
            workers: [],
            quickAccessMap: {},
            availableCommands: [],
            currentTask: null,
            historicalSuggestions: ['Create a React component builder']
          }
        })
      });

      expect(response.status).toBe(200);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.workerName).toMatch(/React.*Component.*Builder/);
      expect(data.suggestions).toContain('Create a React component builder');
    });
  });

  describe('WebSocket Natural Language Updates', () => {
    it('should stream natural language updates via WebSocket', (done) => {
      const ws = new WebSocket(`${wsUrl}?apiKey=nlp-e2e-test-key`);
      const receivedEvents: any[] = [];

      ws.on('open', async () => {
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: 'natural-language'
        }));

        // Trigger natural language processing
        await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': 'nlp-e2e-test-key'
          },
          body: JSON.stringify({
            naturalLanguageInput: 'Create a WebSocket test worker',
            context: [],
            orchflowContext: {
              workers: [],
              quickAccessMap: {},
              availableCommands: [],
              currentTask: null
            }
          })
        });
      });

      ws.on('message', (data) => {
        const event = JSON.parse(data.toString());
        receivedEvents.push(event);

        if (event.type === 'nlp:task-created') {
          expect(event.data).toHaveProperty('workerId');
          expect(event.data).toHaveProperty('naturalLanguageInput');
          expect(event.data).toHaveProperty('workerName');
          expect(event.data.naturalLanguageInput).toBe('Create a WebSocket test worker');
          ws.close();
        }
      });

      ws.on('close', () => {
        expect(receivedEvents.length).toBeGreaterThan(0);
        expect(receivedEvents.some(e => e.type === 'nlp:task-created')).toBe(true);
        done();
      });

      ws.on('error', done);
    });
  });

  describe('Complete Natural Language Workflow', () => {
    it('should handle a complete development workflow using natural language', async () => {
      const apiHeaders = {
        'Content-Type': 'application/json',
        'X-API-Key': 'nlp-e2e-test-key'
      };

      // Step 1: Architect the system
      const architectResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Design the architecture for a blogging platform with user authentication, post creation, and commenting system',
          context: [],
          orchflowContext: {
            workers: [],
            quickAccessMap: {},
            availableCommands: [],
            currentTask: null
          }
        })
      });

      const architectData = await architectResponse.json();
      expect(architectData.success).toBe(true);
      expect(architectData.workerName).toMatch(/Architect|Designer/);

      // Step 2: Create backend developer
      const backendResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create a backend developer to implement the REST API with Node.js and Express',
          context: [
            { timestamp: new Date(), message: 'Architecture designed' },
            { timestamp: new Date(), message: 'Need backend implementation' }
          ],
          orchflowContext: {
            workers: [architectData.worker],
            quickAccessMap: { 1: architectData.worker.id },
            availableCommands: ['Connect to system architect'],
            currentTask: {
              mainObjective: 'Build blogging platform',
              activeSubtasks: ['Architecture', 'Backend API'],
              completedTasks: []
            }
          }
        })
      });

      const backendData = await backendResponse.json();
      expect(backendData.success).toBe(true);
      expect(backendData.workerName).toMatch(/Backend|API|Developer/);

      // Step 3: Create frontend developer
      const frontendResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'I need a React developer to build the user interface with responsive design',
          context: [
            { timestamp: new Date(), message: 'Backend API in progress' },
            { timestamp: new Date(), message: 'Need frontend interface' }
          ],
          orchflowContext: {
            workers: [architectData.worker, backendData.worker],
            quickAccessMap: { 1: architectData.worker.id, 2: backendData.worker.id },
            availableCommands: ['Connect to system architect', 'Connect to backend developer'],
            currentTask: {
              mainObjective: 'Build blogging platform',
              activeSubtasks: ['Architecture', 'Backend API', 'Frontend UI'],
              completedTasks: []
            }
          }
        })
      });

      const frontendData = await frontendResponse.json();
      expect(frontendData.success).toBe(true);
      expect(frontendData.workerName).toMatch(/React|Frontend|UI/);

      // Step 4: Create testing specialist
      const testingResponse = await fetch(`${baseUrl}/mcp/orchflow_natural_task`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          naturalLanguageInput: 'Create a QA engineer to write comprehensive tests for the entire application',
          context: [
            { timestamp: new Date(), message: 'Development in progress' },
            { timestamp: new Date(), message: 'Need testing coverage' }
          ],
          orchflowContext: {
            workers: [architectData.worker, backendData.worker, frontendData.worker],
            quickAccessMap: { 1: architectData.worker.id, 2: backendData.worker.id, 3: frontendData.worker.id },
            availableCommands: ['Connect to system architect', 'Connect to backend developer', 'Connect to React developer'],
            currentTask: {
              mainObjective: 'Build blogging platform',
              activeSubtasks: ['Architecture', 'Backend API', 'Frontend UI', 'Testing'],
              completedTasks: []
            }
          }
        })
      });

      const testingData = await testingResponse.json();
      expect(testingData.success).toBe(true);
      expect(testingData.workerName).toMatch(/QA|Test|Engineer/);

      // Step 5: Get final status
      const finalStatusResponse = await fetch(`${baseUrl}/mcp/orchflow_status_rich`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({
          format: 'detailed',
          orchflowContext: {
            currentTask: {
              mainObjective: 'Build blogging platform',
              activeSubtasks: ['Architecture', 'Backend API', 'Frontend UI', 'Testing'],
              completedTasks: []
            }
          }
        })
      });

      const finalStatus = await finalStatusResponse.json();
      expect(finalStatus.success).toBe(true);
      expect(finalStatus.workers.length).toBe(4);
      expect(finalStatus.summary.byType.architect).toBe(1);
      expect(finalStatus.summary.byType.developer).toBe(2);
      expect(finalStatus.summary.byType.tester).toBe(1);
    });
  });
});

async function waitForServer(url: string, timeout: number = 60000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.status === 200) {
        return;
      }
    } catch (error) {
      // Server not ready yet
    }

    await sleep(2000);
  }

  throw new Error('Server failed to become ready');
}