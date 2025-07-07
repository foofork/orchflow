// Unified Orchestrator Usage Examples
// Demonstrates all features with the new unified orchestrator

import { Orchestrator } from '../src/orchestrator';

async function main() {
  // Create orchestrator with selected features
  const orchestrator = new Orchestrator({
    sessionName: 'demo-session',
    dataDir: '.orchflow-demo',
    // Enable all features for demo
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

  console.log('\n=== Unified Orchestrator Demo ===\n');

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

  // 4. Memory Management (now exposed on orchestrator)
  console.log('4. Advanced Memory:');
  await orchestrator.remember('api-endpoint', '/api/v1/users', {
    tags: ['api', 'users'],
    category: 'endpoints',
  });
  
  const recalled = await orchestrator.recall('api-endpoint');
  console.log('✓ Memory stored and recalled:', recalled, '\n');

  // 5. Task Scheduling (now exposed on orchestrator)
  console.log('5. Task Scheduling:');
  const taskId = await orchestrator.submitTask({
    name: 'Run tests',
    priority: 10,
    estimatedDuration: 5000,
    execute: async () => {
      console.log('  Executing test task...');
      return { success: true, coverage: 85 };
    },
  });
  console.log(`✓ Task scheduled: ${taskId}\n`);

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

  // 7. Circuit Breakers (internal, but we can test via execute)
  console.log('7. Circuit Breakers:');
  try {
    await orchestrator.execute('echo "Testing circuit breaker"');
    console.log('✓ Command executed with circuit breaker protection\n');
  } catch (error) {
    console.log('✗ Command failed (circuit breaker may have opened)\n');
  }

  // 8. Swarm Coordination
  console.log('8. Swarm Coordination:');
  try {
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
  } catch (error) {
    console.log('⚠ Swarm not available (requires scheduler)\n');
  }

  // 9. MCP Integration
  console.log('9. MCP Integration:');
  const mcpTools = orchestrator.getMCPTools();
  console.log(`✓ ${mcpTools.length} MCP tools available\n`);

  // 10. Cache (internal but affects performance)
  console.log('10. Cache System:');
  // Execute same command twice - second should be cached
  const start1 = Date.now();
  await orchestrator.execute('echo "First execution"');
  const time1 = Date.now() - start1;
  
  const start2 = Date.now();
  await orchestrator.execute('echo "First execution"'); // Same command
  const time2 = Date.now() - start2;
  
  console.log(`✓ First execution: ${time1}ms`);
  console.log(`✓ Second execution (cached): ${time2}ms\n`);

  // 11. System Status
  console.log('11. System Status:');
  const status = await orchestrator.getStatus();
  console.log('Features enabled:', status.features);
  console.log('Active agents:', status.agents.length);
  console.log('Cache entries:', status.cache.entries);
  if (status.session) {
    console.log('Session duration:', Math.round(status.session.duration / 1000), 'seconds');
  }

  // Generate handoff for next session
  console.log('\n=== Session Handoff ===');
  const handoff = await orchestrator.generateHandoff();
  console.log(handoff);

  // Cleanup
  await orchestrator.shutdown();
}

// Run the demo
main().catch(console.error);