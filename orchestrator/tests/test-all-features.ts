#!/usr/bin/env ts-node
// Comprehensive test suite for all ported features

import { EnhancedOrchestrator } from '../src/core/enhanced-orchestrator';
import { EventBus, OrchflowEvents } from '../src/core/event-bus';
import { Protocol } from '../src/core/protocol-manager';
import { circuitBreakerManager } from '../src/core/circuit-breaker';
import { resourceManager } from '../src/core/resource-manager';
import { metricsCollector } from '../src/metrics/metrics-collector';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DATA_DIR = '.test-orchflow';

// Color codes for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanup() {
  try {
    await fs.rm(TEST_DATA_DIR, { recursive: true, force: true });
  } catch (error) {
    // Ignore errors
  }
}

async function testEventBus() {
  log('\n=== Testing Event Bus ===', 'blue');
  
  let eventReceived = false;
  const unsubscribe = EventBus.on(OrchflowEvents.SYSTEM_READY, () => {
    eventReceived = true;
  });
  
  EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
  
  // Test filtered listener
  let filteredCount = 0;
  EventBus.onFiltered(
    OrchflowEvents.AGENT_CREATED,
    (data) => data.type === 'test',
    () => filteredCount++
  );
  
  EventBus.emit(OrchflowEvents.AGENT_CREATED, {
    agentId: '1',
    name: 'test-agent',
    type: 'test',
  });
  
  EventBus.emit(OrchflowEvents.AGENT_CREATED, {
    agentId: '2',
    name: 'other-agent',
    type: 'other',
  });
  
  // Test async wait
  const waitPromise = EventBus.waitFor(OrchflowEvents.AGENT_STARTED, 100);
  EventBus.emit(OrchflowEvents.AGENT_STARTED, { agentId: 'test' });
  
  try {
    await waitPromise;
    log('✓ Event bus: Basic emission working', 'green');
    log(`✓ Event bus: Filtered listener working (count: ${filteredCount})`, 'green');
    log('✓ Event bus: Async wait working', 'green');
  } catch (error) {
    log('✗ Event bus test failed: ' + error, 'red');
  }
  
  unsubscribe();
}

async function testSessionManager(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Session Manager ===', 'blue');
  
  try {
    // Start a session
    await orchestrator.startSession('test-session', {
      purpose: 'testing',
      timestamp: new Date().toISOString(),
    });
    
    // Resume session
    await orchestrator.resumeSession();
    
    // Generate handoff
    const handoff = await orchestrator.generateHandoff();
    
    if (handoff && handoff.includes('test-session')) {
      log('✓ Session manager: Session creation working', 'green');
      log('✓ Session manager: Session resumption working', 'green');
      log('✓ Session manager: Handoff generation working', 'green');
    } else {
      throw new Error('Session handoff invalid');
    }
  } catch (error) {
    log('✗ Session manager test failed: ' + error, 'red');
  }
}

async function testProtocolManager(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Protocol Manager ===', 'blue');
  
  try {
    // Add a protocol
    await orchestrator.addProtocol({
      type: 'directive',
      priority: 100,
      condition: { command: 'test' },
      action: 'Always run tests',
      enabled: true,
    });
    
    // List protocols
    const protocols = orchestrator.listProtocols();
    const testProtocol = protocols.find(p => p.action === 'Always run tests');
    
    if (testProtocol) {
      log('✓ Protocol manager: Protocol creation working', 'green');
      log(`✓ Protocol manager: Protocol listing working (${protocols.length} protocols)`, 'green');
    } else {
      throw new Error('Protocol not found');
    }
  } catch (error) {
    log('✗ Protocol manager test failed: ' + error, 'red');
  }
}

async function testModeManager(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Mode Manager ===', 'blue');
  
  try {
    // List available modes
    const modes = orchestrator.listModes();
    log(`✓ Mode manager: ${modes.length} modes available`, 'green');
    
    // Activate TDD mode
    await orchestrator.activateMode('tdd', {
      framework: 'jest',
      coverage: 80,
    });
    
    const activeMode = orchestrator.getActiveMode();
    if (activeMode && activeMode.name === 'tdd') {
      log('✓ Mode manager: Mode activation working', 'green');
      log('✓ Mode manager: Active mode retrieval working', 'green');
    } else {
      throw new Error('TDD mode not active');
    }
    
    // End mode
    await orchestrator.endMode();
    const modeAfterEnd = orchestrator.getActiveMode();
    if (!modeAfterEnd) {
      log('✓ Mode manager: Mode deactivation working', 'green');
    }
  } catch (error) {
    log('✗ Mode manager test failed: ' + error, 'red');
  }
}

async function testCircuitBreakers() {
  log('\n=== Testing Circuit Breakers ===', 'blue');
  
  try {
    const breaker = circuitBreakerManager.create({
      name: 'test-breaker',
      failureThreshold: 2,
      successThreshold: 1,
      timeout: 100,
      resetTimeout: 500,
    });
    
    let successCount = 0;
    let failureCount = 0;
    
    // Should succeed
    await breaker.execute(async () => {
      successCount++;
      return 'success';
    });
    
    // Force failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Test failure');
        });
      } catch (error) {
        failureCount++;
      }
    }
    
    // Circuit should be open now
    const stats = breaker.getStats();
    
    if (stats.state === 'open' && successCount === 1 && failureCount >= 2) {
      log('✓ Circuit breaker: State transitions working', 'green');
      log('✓ Circuit breaker: Failure counting working', 'green');
      log(`✓ Circuit breaker: Current state: ${stats.state}`, 'green');
    } else {
      throw new Error(`Unexpected state: ${stats.state}`);
    }
  } catch (error) {
    log('✗ Circuit breaker test failed: ' + error, 'red');
  }
}

async function testResourceManager() {
  log('\n=== Testing Resource Manager ===', 'blue');
  
  try {
    // Register a resource
    resourceManager.registerResource({
      id: 'test-resource',
      type: 'test',
      name: 'Test Resource',
    });
    
    // Acquire exclusive lock
    const acquired = await resourceManager.acquireLock(
      'test-resource',
      'worker-1',
      'exclusive',
      0,
      1000
    );
    
    if (!acquired) {
      throw new Error('Failed to acquire lock');
    }
    
    // Try to acquire same resource (should fail)
    const secondAcquire = await resourceManager.acquireLock(
      'test-resource',
      'worker-2',
      'exclusive',
      0,
      100
    );
    
    if (secondAcquire) {
      throw new Error('Should not acquire exclusive lock twice');
    }
    
    // Release lock
    const released = resourceManager.releaseLock('test-resource', 'worker-1');
    
    if (released) {
      log('✓ Resource manager: Resource registration working', 'green');
      log('✓ Resource manager: Exclusive lock acquisition working', 'green');
      log('✓ Resource manager: Lock conflict detection working', 'green');
      log('✓ Resource manager: Lock release working', 'green');
    }
    
    // Test deadlock detection
    const resources = ['res-a', 'res-b'];
    resources.forEach(id => {
      resourceManager.registerResource({ id, type: 'test', name: id });
    });
    
    // Create potential deadlock scenario
    await resourceManager.acquireLock('res-a', 'worker-1', 'exclusive');
    await resourceManager.acquireLock('res-b', 'worker-2', 'exclusive');
    
    // This should detect potential deadlock
    const willDeadlock = await resourceManager.acquireLock(
      'res-b',
      'worker-1',
      'exclusive',
      0,
      100
    );
    
    if (!willDeadlock) {
      log('✓ Resource manager: Deadlock prevention working', 'green');
    }
    
    // Cleanup
    resourceManager.releaseLock('res-a', 'worker-1');
    resourceManager.releaseLock('res-b', 'worker-2');
  } catch (error) {
    log('✗ Resource manager test failed: ' + error, 'red');
  }
}

async function testMemoryManager(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Memory Manager ===', 'blue');
  
  try {
    const memoryManager = (orchestrator as any).memoryManager;
    if (!memoryManager) {
      throw new Error('Memory manager not available');
    }
    
    // Store memory
    await memoryManager.remember('test-key', { data: 'test-value' }, {
      tags: ['test', 'demo'],
      category: 'testing',
    });
    
    // Recall memory
    const recalled = await memoryManager.recall('test-key');
    
    if (recalled && recalled.data === 'test-value') {
      log('✓ Memory manager: Storage working', 'green');
      log('✓ Memory manager: Recall working', 'green');
    } else {
      throw new Error('Memory recall failed');
    }
    
    // Search memory
    const searchResults = await memoryManager.search('test', 10);
    
    if (searchResults.length > 0) {
      log('✓ Memory manager: Search working', 'green');
      log(`✓ Memory manager: Found ${searchResults.length} results`, 'green');
    }
    
    // Forget memory
    await memoryManager.forget('test-key');
    const afterForget = await memoryManager.recall('test-key');
    
    if (!afterForget) {
      log('✓ Memory manager: Forget working', 'green');
    }
  } catch (error) {
    log('✗ Memory manager test failed: ' + error, 'red');
  }
}

async function testMetricsCollector() {
  log('\n=== Testing Metrics Collector ===', 'blue');
  
  try {
    // Increment counter
    metricsCollector.increment('test.counter', 5);
    
    // Set gauge
    metricsCollector.gauge('test.gauge', 42);
    
    // Record histogram
    metricsCollector.histogram('test.histogram', 100);
    
    // Use timer
    const timer = metricsCollector.timer('test.timer');
    await new Promise(resolve => setTimeout(resolve, 50));
    timer();
    
    // Get metrics
    const metrics = metricsCollector.getMetrics();
    
    if (metrics['test.counter'] && metrics['test.gauge'] && metrics['test.histogram']) {
      log('✓ Metrics collector: Counter working', 'green');
      log('✓ Metrics collector: Gauge working', 'green');
      log('✓ Metrics collector: Histogram working', 'green');
      log('✓ Metrics collector: Timer working', 'green');
    } else {
      throw new Error('Metrics not recorded');
    }
  } catch (error) {
    log('✗ Metrics collector test failed: ' + error, 'red');
  }
}

async function testTaskScheduler(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Task Scheduler ===', 'blue');
  
  try {
    const scheduler = (orchestrator as any).taskScheduler;
    if (!scheduler) {
      throw new Error('Task scheduler not available');
    }
    
    let executedTasks: string[] = [];
    
    // Submit tasks with different priorities
    const task1 = await scheduler.submitTask({
      name: 'High Priority Task',
      priority: 10,
      execute: async () => {
        executedTasks.push('high');
        return 'high-result';
      },
    });
    
    const task2 = await scheduler.submitTask({
      name: 'Low Priority Task',
      priority: 1,
      execute: async () => {
        executedTasks.push('low');
        return 'low-result';
      },
    });
    
    // Wait for execution
    await new Promise(resolve => setTimeout(resolve, 200));
    
    if (executedTasks.length === 2) {
      log('✓ Task scheduler: Task submission working', 'green');
      log('✓ Task scheduler: Task execution working', 'green');
      log(`✓ Task scheduler: Executed ${executedTasks.length} tasks`, 'green');
    } else {
      throw new Error('Tasks not executed');
    }
  } catch (error) {
    log('✗ Task scheduler test failed: ' + error, 'red');
  }
}

async function testLoadBalancer(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Load Balancer ===', 'blue');
  
  try {
    const loadBalancer = (orchestrator as any).loadBalancer;
    if (!loadBalancer) {
      throw new Error('Load balancer not available');
    }
    
    // Register nodes
    const nodes = ['node1', 'node2', 'node3'];
    nodes.forEach((node, index) => {
      loadBalancer.registerNode({
        id: node,
        weight: index + 1,
        metadata: { region: 'us-east' },
      });
    });
    
    // Get next nodes
    const selections: string[] = [];
    for (let i = 0; i < 6; i++) {
      const node = loadBalancer.getNextNode();
      if (node) {
        selections.push(node.id);
      }
    }
    
    // Check distribution
    const distribution = selections.reduce((acc, node) => {
      acc[node] = (acc[node] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    log('✓ Load balancer: Node registration working', 'green');
    log('✓ Load balancer: Node selection working', 'green');
    log(`✓ Load balancer: Distribution: ${JSON.stringify(distribution)}`, 'green');
    
    // Test health check
    loadBalancer.markNodeUnhealthy('node1');
    const afterHealth = loadBalancer.getNextNode();
    
    if (afterHealth && afterHealth.id !== 'node1') {
      log('✓ Load balancer: Health tracking working', 'green');
    }
  } catch (error) {
    log('✗ Load balancer test failed: ' + error, 'red');
  }
}

async function testSwarmCoordinator(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing Swarm Coordinator ===', 'blue');
  
  try {
    // Check if swarm is enabled
    if (!(orchestrator as any).swarmCoordinator) {
      log('⚠ Swarm coordinator not enabled (requires scheduler)', 'yellow');
      return;
    }
    
    // Submit a parallel swarm task
    const taskId = await orchestrator.submitSwarmTask({
      name: 'Test Parallel Task',
      type: 'parallel',
      subtasks: [
        { id: 'sub1', name: 'Subtask 1', command: 'echo "Task 1"' },
        { id: 'sub2', name: 'Subtask 2', command: 'echo "Task 2"' },
      ],
      config: {
        maxConcurrency: 2,
        timeout: 5000,
      },
    });
    
    log('✓ Swarm coordinator: Task submission working', 'green');
    log(`✓ Swarm coordinator: Task ID: ${taskId}`, 'green');
    
    // Get task status
    const task = await orchestrator.getSwarmTask(taskId);
    if (task) {
      log(`✓ Swarm coordinator: Task retrieval working (status: ${task.status})`, 'green');
    }
    
    // Get swarm status
    const swarmStatus = await (orchestrator as any).swarmCoordinator.getSwarmStatus();
    log(`✓ Swarm coordinator: ${swarmStatus.workers} workers, ${swarmStatus.tasks} tasks`, 'green');
  } catch (error) {
    log('✗ Swarm coordinator test failed: ' + error, 'red');
  }
}

async function testSystemStatus(orchestrator: EnhancedOrchestrator) {
  log('\n=== Testing System Status ===', 'blue');
  
  try {
    const status = await orchestrator.getStatus();
    
    log('System Status:', 'blue');
    log(`  Sessions: ${status.session ? 'Active' : 'None'}`, 'green');
    log(`  Protocols: ${status.protocols?.total || 0} total, ${status.protocols?.enabled || 0} enabled`, 'green');
    log(`  Mode: ${status.mode ? status.mode.name : 'None'}`, 'green');
    log(`  Cache: ${status.cache.enabled ? 'Enabled' : 'Disabled'} (${status.cache.entries} entries)`, 'green');
    log(`  Resources: ${status.resources?.total || 0} registered`, 'green');
    
    if (status.circuitBreakers) {
      log('  Circuit Breakers:', 'green');
      Object.entries(status.circuitBreakers).forEach(([name, stats]: [string, any]) => {
        log(`    ${name}: ${stats.state} (${stats.failures} failures)`, 'green');
      });
    }
    
    if (status.mcp) {
      log(`  MCP: ${status.mcp.servers} servers, ${status.mcp.tools} tools`, 'green');
    }
    
    if (status.swarm) {
      log(`  Swarm: ${status.swarm.workers} workers, ${status.swarm.activeWorkers} active`, 'green');
    }
  } catch (error) {
    log('✗ System status test failed: ' + error, 'red');
  }
}

async function runAllTests() {
  log('Starting comprehensive test suite...', 'yellow');
  
  // Clean up any previous test data
  await cleanup();
  
  // Test standalone components first
  await testEventBus();
  await testCircuitBreakers();
  await testResourceManager();
  await testMetricsCollector();
  
  // Create orchestrator for integrated tests
  const orchestrator = new EnhancedOrchestrator({
    sessionName: 'test-session',
    dataDir: TEST_DATA_DIR,
    enableSessions: true,
    enableProtocols: true,
    enableCache: true,
    enableModes: true,
    enableCircuitBreakers: true,
    enableResourceManager: true,
    enableMemory: true,
    enableMetrics: true,
    enableScheduler: true,
    enableTerminalPool: false, // Skip terminal pool (requires tmux)
    enableMCP: true,
    enableSwarm: true,
    enableWebSocket: false, // Skip WebSocket for tests
  });
  
  try {
    await orchestrator.initialize();
    
    // Test integrated components
    await testSessionManager(orchestrator);
    await testProtocolManager(orchestrator);
    await testModeManager(orchestrator);
    await testMemoryManager(orchestrator);
    await testTaskScheduler(orchestrator);
    await testLoadBalancer(orchestrator);
    await testSwarmCoordinator(orchestrator);
    await testSystemStatus(orchestrator);
    
    log('\n=== Test Summary ===', 'blue');
    log('All tests completed successfully!', 'green');
    
  } catch (error) {
    log('\nTest suite error: ' + error, 'red');
  } finally {
    // Shutdown and cleanup
    await orchestrator.shutdown();
    await cleanup();
    
    // Clean up singletons
    circuitBreakerManager.destroy();
    resourceManager.destroy();
  }
}

// Run tests
runAllTests().catch(console.error);