import { MCPTool } from '../orchestrator/mcp-server';

/**
 * Enhanced MCP Tools for Phase 4: Natural Language & Worker Access
 */

export const createEnhancedMCPTools = (orchestrator: any): MCPTool[] => {
  return [
    // Natural Language Task Creation
    {
      name: 'orchflow_natural_task',
      description: 'Create tasks using natural language input with intelligent parsing',
      parameters: {
        type: 'object',
        properties: {
          naturalLanguageInput: { type: 'string', description: 'Natural language task description' },
          context: { type: 'array', description: 'Conversation context for better understanding' }
        },
        required: ['naturalLanguageInput']
      },
      handler: async (params) => {
        const { naturalLanguageInput, context = [] } = params;
        
        // Parse intent and extract task parameters
        const taskInfo = await orchestrator.parseNaturalLanguageTask(naturalLanguageInput, context);
        
        // Create worker with descriptive name
        const workerId = await orchestrator.spawnWorkerWithDescriptiveName(taskInfo);
        
        return {
          success: true,
          workerId,
          workerName: taskInfo.assignedWorkerName,
          quickAccessKey: taskInfo.quickAccessKey,
          description: `Created "${taskInfo.assignedWorkerName}" for: ${taskInfo.description}`
        };
      }
    },

    // Enhanced Worker Access
    {
      name: 'orchflow_smart_connect',
      description: 'Connect to workers using natural language or quick access keys',
      parameters: {
        type: 'object',
        properties: {
          workerIdentifier: { 
            type: 'string', 
            description: 'Worker name, partial name, or numeric key (1-9)' 
          },
          fuzzyMatch: { type: 'boolean', default: true }
        },
        required: ['workerIdentifier']
      },
      handler: async (params) => {
        const { workerIdentifier, fuzzyMatch = true } = params;
        
        // Smart worker resolution
        const worker = await orchestrator.findWorkerSmart(workerIdentifier, fuzzyMatch);
        
        if (!worker) {
          // Suggest similar workers
          const suggestions = await orchestrator.suggestSimilarWorkers(workerIdentifier);
          return {
            success: false,
            error: `Worker not found: "${workerIdentifier}"`,
            suggestions: suggestions.map(w => ({ name: w.descriptiveName, key: w.quickAccessKey }))
          };
        }
        
        // Connect to worker
        const connection = await orchestrator.connectToWorker(worker.id);
        
        return {
          success: true,
          workerId: worker.id,
          workerName: worker.descriptiveName,
          quickAccessKey: worker.quickAccessKey,
          connection,
          status: worker.status,
          currentTask: worker.currentTask?.description
        };
      }
    },

    // Worker Status with Descriptive Names
    {
      name: 'orchflow_status_rich',
      description: 'Get rich status information with descriptive names and progress',
      parameters: {
        type: 'object',
        properties: {
          includeInactive: { type: 'boolean', default: false },
          sortBy: { type: 'string', enum: ['priority', 'progress', 'name'], default: 'priority' }
        }
      },
      handler: async (params) => {
        const { includeInactive = false, sortBy = 'priority' } = params;
        
        const workers = await orchestrator.getWorkersWithRichInfo(includeInactive);
        
        // Sort workers
        const sortedWorkers = workers.sort((a, b) => {
          switch (sortBy) {
            case 'progress':
              return (b.progress || 0) - (a.progress || 0);
            case 'name':
              return a.descriptiveName.localeCompare(b.descriptiveName);
            case 'priority':
            default:
              return (b.priority || 0) - (a.priority || 0);
          }
        });
        
        return {
          success: true,
          workers: sortedWorkers.map(w => ({
            id: w.id,
            name: w.descriptiveName,
            quickKey: w.quickAccessKey,
            status: w.status,
            progress: w.progress,
            taskDescription: w.currentTask?.description,
            startTime: w.startTime,
            resourceUsage: w.resources,
            estimatedCompletion: w.estimatedCompletion
          })),
          summary: {
            total: sortedWorkers.length,
            active: sortedWorkers.filter(w => w.status === 'running').length,
            idle: sortedWorkers.filter(w => w.status === 'idle').length,
            errored: sortedWorkers.filter(w => w.status === 'error').length
          }
        };
      }
    },

    // Quick Access Management
    {
      name: 'orchflow_quick_access',
      description: 'Manage quick access keys (1-9) for workers',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['list', 'assign', 'unassign'] },
          workerId: { type: 'string' },
          key: { type: 'number', minimum: 1, maximum: 9 }
        },
        required: ['action']
      },
      handler: async (params) => {
        const { action, workerId, key } = params;
        
        switch (action) {
          case 'list':
            const assignments = await orchestrator.getQuickAccessAssignments();
            return { success: true, assignments };
            
          case 'assign':
            if (!workerId || !key) {
              throw new Error('workerId and key required for assign action');
            }
            await orchestrator.assignQuickAccessKey(workerId, key);
            return { success: true, message: `Assigned key ${key} to worker ${workerId}` };
            
          case 'unassign':
            if (!key) {
              throw new Error('key required for unassign action');
            }
            await orchestrator.unassignQuickAccessKey(key);
            return { success: true, message: `Unassigned key ${key}` };
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }
    },

    // Session Management
    {
      name: 'orchflow_session',
      description: 'Manage OrchFlow session state and recovery',
      parameters: {
        type: 'object',
        properties: {
          action: { 
            type: 'string', 
            enum: ['save', 'restore', 'list_snapshots', 'create_snapshot'] 
          },
          snapshotName: { type: 'string' }
        },
        required: ['action']
      },
      handler: async (params) => {
        const { action, snapshotName } = params;
        
        switch (action) {
          case 'save':
            await orchestrator.saveCurrentSession();
            return { success: true, message: 'Session saved successfully' };
            
          case 'restore':
            if (!snapshotName) {
              throw new Error('snapshotName required for restore action');
            }
            await orchestrator.restoreFromSnapshot(snapshotName);
            return { success: true, message: `Session restored from ${snapshotName}` };
            
          case 'list_snapshots':
            const snapshots = await orchestrator.listSessionSnapshots();
            return { success: true, snapshots };
            
          case 'create_snapshot':
            const name = snapshotName || `manual_${Date.now()}`;
            const snapshotPath = await orchestrator.createSessionSnapshot(name);
            return { success: true, snapshotName: name, path: snapshotPath };
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      }
    },

    // Performance Monitoring
    {
      name: 'orchflow_performance',
      description: 'Get system performance metrics and worker efficiency data',
      parameters: {
        type: 'object',
        properties: {
          timeframe: { type: 'string', enum: ['1h', '24h', '7d'], default: '1h' },
          includeHistory: { type: 'boolean', default: false }
        }
      },
      handler: async (params) => {
        const { timeframe = '1h', includeHistory = false } = params;
        
        const metrics = await orchestrator.getPerformanceMetrics(timeframe);
        
        return {
          success: true,
          timeframe,
          metrics: {
            system: {
              cpuUsage: metrics.system.cpu,
              memoryUsage: metrics.system.memory,
              diskUsage: metrics.system.disk,
              networkIO: metrics.system.network
            },
            workers: {
              totalSpawned: metrics.workers.total,
              averageLifetime: metrics.workers.avgLifetime,
              successRate: metrics.workers.successRate,
              resourceEfficiency: metrics.workers.efficiency
            },
            tasks: {
              completed: metrics.tasks.completed,
              averageDuration: metrics.tasks.avgDuration,
              throughput: metrics.tasks.throughput
            }
          },
          history: includeHistory ? metrics.history : undefined,
          recommendations: metrics.recommendations
        };
      }
    },

    // Help and Documentation
    {
      name: 'orchflow_help',
      description: 'Get contextual help and usage examples for OrchFlow features',
      parameters: {
        type: 'object',
        properties: {
          topic: { 
            type: 'string', 
            enum: ['workers', 'tasks', 'natural_language', 'quick_access', 'performance'] 
          }
        }
      },
      handler: async (params) => {
        const { topic } = params;
        
        const helpContent = {
          workers: {
            title: 'Worker Management',
            description: 'Manage AI workers with descriptive names',
            examples: [
              'Create a React component builder',
              'Connect to the API developer',
              'Show me worker 3',
              'Pause the test runner'
            ],
            quickReference: [
              'Press 1-9: Quick access to workers',
              'Natural language: "connect to [worker name]"',
              'Status: "show me all workers"'
            ]
          },
          tasks: {
            title: 'Task Creation',
            description: 'Create tasks using natural language',
            examples: [
              'Build a user authentication system',
              'Test the payment integration',
              'Research modern React patterns',
              'Analyze the database performance'
            ],
            quickReference: [
              'Priority: "urgent", "high priority", "low priority"',
              'Timeline: "in 30 minutes", "by tomorrow"',
              'Type: Automatically detected from description'
            ]
          },
          natural_language: {
            title: 'Natural Language Interface',
            description: 'Talk to OrchFlow naturally',
            examples: [
              '"Create a worker to build the login page"',
              '"Switch to the frontend developer"',
              '"Show me what worker 2 is doing"',
              '"Pause all workers and show status"'
            ]
          }
        };
        
        const content = topic ? helpContent[topic] : {
          title: 'OrchFlow Help',
          description: 'Available help topics',
          topics: Object.keys(helpContent)
        };
        
        return { success: true, help: content };
      }
    }
  ];
};