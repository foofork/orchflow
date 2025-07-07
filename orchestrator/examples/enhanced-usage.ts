// Enhanced Orchestrator Usage Examples
// Demonstrates all the features ported from claude-flow

import { EnhancedOrchestrator } from '../src/core/enhanced-orchestrator';
import { Protocol } from '../src/core/protocol-manager';

async function main() {
  // Create enhanced orchestrator with all features enabled
  const orchestrator = new EnhancedOrchestrator({
    sessionName: 'demo-session',
    dataDir: '.orchflow-demo',
    enableSessions: true,
    enableProtocols: true,
    enableCache: true,
    enableModes: true,
    enableCircuitBreakers: true,
    enableResourceManager: true,
    enableMemory: true,
    enableMetrics: true,
    enableScheduler: true,
    enableTerminalPool: false, // Requires tmux
    enableMCP: true,
    enableSwarm: true,
    mcpServers: [
      {
        id: 'example-server',
        name: 'Example MCP Server',
        version: '1.0.0',
        endpoint: 'http://localhost:3000/mcp',
        transport: 'http',
        autoConnect: false, // Don't connect for demo
      },
    ],
  });

  await orchestrator.initialize();

  console.log('\n=== Enhanced Orchestrator Demo ===\n');

  // 1. Session Management
  console.log('1. Session Management:');
  await orchestrator.startSession('feature-development', {
    feature: 'user-authentication',
    priority: 'high',
  });
  console.log('✓ Session started\n');

  // 2. Protocol Management
  console.log('2. Protocol Management:');
  await orchestrator.addProtocol({
    type: 'directive',
    priority: 100,
    condition: { scope: 'development' },
    action: 'Always write tests before implementation',
    enabled: true,
  });
  
  const protocols = orchestrator.listProtocols();
  console.log(`✓ ${protocols.length} protocols active\n`);

  // 3. Mode Activation (TDD Mode)
  console.log('3. SPARC Modes:');
  await orchestrator.activateMode('tdd', {
    testFramework: 'jest',
    coverage: 80,
  });
  console.log('✓ TDD mode activated\n');

  // 4. Memory Management
  console.log('4. Advanced Memory:');
  const memoryManager = (orchestrator as any).memoryManager;
  if (memoryManager) {
    await memoryManager.remember('api-endpoint', '/api/v1/users', {
      tags: ['api', 'users'],
      category: 'endpoints',
    });
    
    const recalled = await memoryManager.recall('api-endpoint');
    console.log('✓ Memory stored and recalled:', recalled, '\n');
  }

  // 5. Task Scheduling
  console.log('5. Task Scheduling:');
  const taskScheduler = (orchestrator as any).taskScheduler;
  if (taskScheduler) {
    const taskId = await taskScheduler.submitTask({
      name: 'Run tests',
      priority: 10,
      estimatedDuration: 5000,
      execute: async () => {
        console.log('  Executing test task...');
        return { success: true, coverage: 85 };
      },
    });
    console.log(`✓ Task scheduled: ${taskId}\n`);
  }

  // 6. Resource Management
  console.log('6. Resource Management:');
  const acquired = await orchestrator.acquireResource(
    'database-connection',
    'worker-1',
    'exclusive',
    5000
  );
  console.log(`✓ Resource acquired: ${acquired}`);
  orchestrator.releaseResource('database-connection', 'worker-1');
  console.log('✓ Resource released\n');

  // 7. Circuit Breakers
  console.log('7. Circuit Breakers:');
  try {
    // This will use the internal circuit breaker
    await orchestrator.execute('npm test');
    console.log('✓ Command executed with circuit breaker protection\n');
  } catch (error) {
    console.log('✗ Command failed (circuit breaker may have opened)\n');
  }

  // 8. Swarm Coordination
  console.log('8. Swarm Coordination:');
  if ((orchestrator as any).swarmCoordinator) {
    const swarmTaskId = await orchestrator.submitSwarmTask({
      name: 'Parallel Processing Demo',
      type: 'parallel',
      subtasks: [
        { id: 'task1', name: 'Process A', command: 'echo "Processing A"' },
        { id: 'task2', name: 'Process B', command: 'echo "Processing B"' },
        { id: 'task3', name: 'Process C', command: 'echo "Processing C"' },
      ],
      config: {
        maxConcurrency: 3,
        timeout: 30000,
      },
    });
    console.log(`✓ Swarm task submitted: ${swarmTaskId}\n`);
  }

  // 9. MCP Integration
  console.log('9. MCP Integration:');
  const mcpServers = orchestrator.getMCPServers();
  console.log(`✓ ${mcpServers.length} MCP servers registered`);
  const mcpTools = orchestrator.getMCPTools();
  console.log(`✓ ${mcpTools.length} MCP tools available\n`);

  // 10. System Status
  console.log('10. System Status:');
  const status = await orchestrator.getStatus();
  console.log('Status:', JSON.stringify(status, null, 2));

  // Generate handoff for next session
  console.log('\n=== Session Handoff ===');
  const handoff = await orchestrator.generateHandoff();
  console.log(handoff);

  // Cleanup
  await orchestrator.shutdown();
}

// Run the demo
main().catch(console.error);