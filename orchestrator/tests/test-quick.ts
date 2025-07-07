#!/usr/bin/env ts-node
// Quick test suite for all ported features

import { EnhancedOrchestrator } from '../src/core/enhanced-orchestrator';
import { EventBus, OrchflowEvents } from '../src/core/event-bus';
import { circuitBreakerManager } from '../src/core/circuit-breaker';
import { resourceManager } from '../src/core/resource-manager';
import * as fs from 'fs/promises';

const TEST_DATA_DIR = '.test-orchflow-quick';

// Color codes
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
    // Ignore
  }
}

async function testFeatures() {
  log('\n=== Quick Feature Test Suite ===\n', 'blue');
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Event Bus
  try {
    let received = false;
    EventBus.once(OrchflowEvents.SYSTEM_READY, () => { received = true; });
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    if (received) {
      log('✓ Event Bus working', 'green');
      passed++;
    } else throw new Error('Event not received');
  } catch (e) {
    log('✗ Event Bus failed', 'red');
    failed++;
  }
  
  // Test 2: Circuit Breaker
  try {
    const breaker = circuitBreakerManager.create({
      name: 'test-quick',
      failureThreshold: 2,
      timeout: 100,
    });
    
    // Should work
    await breaker.execute(async () => 'ok');
    
    // Force failure
    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch {}
    try {
      await breaker.execute(async () => { throw new Error('fail'); });
    } catch {}
    
    const stats = breaker.getStats();
    if (stats.failures >= 2) {
      log('✓ Circuit Breaker working', 'green');
      passed++;
    } else throw new Error('Not counting failures');
  } catch (e) {
    log('✗ Circuit Breaker failed', 'red');
    failed++;
  }
  
  // Test 3: Resource Manager
  try {
    resourceManager.registerResource({
      id: 'test-res-quick',
      type: 'test',
      name: 'Test Resource',
    });
    
    const lock1 = await resourceManager.acquireLock('test-res-quick', 'w1', 'exclusive', 0, 100);
    const lock2 = await resourceManager.acquireLock('test-res-quick', 'w2', 'exclusive', 0, 100);
    
    if (lock1 && !lock2) {
      log('✓ Resource Manager working', 'green');
      passed++;
    } else throw new Error('Lock logic incorrect');
    
    resourceManager.releaseLock('test-res-quick', 'w1');
  } catch (e) {
    log('✗ Resource Manager failed', 'red');
    failed++;
  }
  
  // Create orchestrator
  const orchestrator = new EnhancedOrchestrator({
    sessionName: 'quick-test',
    dataDir: TEST_DATA_DIR,
    enableSessions: true,
    enableProtocols: true,
    enableModes: true,
    enableMemory: true,
    enableCache: true,
    enableWebSocket: false,
  });
  
  await orchestrator.initialize();
  
  // Test 4: Session Manager
  try {
    await orchestrator.startSession('test-session', { test: true });
    const handoff = await orchestrator.generateHandoff();
    if (handoff.includes('test-session')) {
      log('✓ Session Manager working', 'green');
      passed++;
    } else throw new Error('Session not in handoff');
  } catch (e) {
    log('✗ Session Manager failed', 'red');
    failed++;
  }
  
  // Test 5: Protocol Manager
  try {
    await orchestrator.addProtocol({
      type: 'directive',
      priority: 100,
      action: 'Test protocol',
      enabled: true,
    });
    const protocols = orchestrator.listProtocols();
    if (protocols.length > 0) {
      log('✓ Protocol Manager working', 'green');
      passed++;
    } else throw new Error('No protocols');
  } catch (e) {
    log('✗ Protocol Manager failed', 'red');
    failed++;
  }
  
  // Test 6: Mode Manager
  try {
    await orchestrator.activateMode('tdd');
    const mode = orchestrator.getActiveMode();
    if (mode && mode.name === 'tdd') {
      log('✓ Mode Manager working', 'green');
      passed++;
    } else throw new Error('Mode not active');
    await orchestrator.endMode();
  } catch (e) {
    log('✗ Mode Manager failed', 'red');
    failed++;
  }
  
  // Test 7: Memory Manager
  try {
    const mm = (orchestrator as any).memoryManager;
    if (mm) {
      // Create directory first
      await fs.mkdir(`${TEST_DATA_DIR}/memory/entries`, { recursive: true });
      
      await mm.remember('test', 'value');
      const recalled = await mm.recall('test');
      if (recalled === 'value') {
        log('✓ Memory Manager working', 'green');
        passed++;
      } else throw new Error('Recall failed');
    }
  } catch (e) {
    log('✗ Memory Manager failed', 'red');
    failed++;
  }
  
  // Test 8: Cache
  try {
    const cache = (orchestrator as any).cache;
    (orchestrator as any).addToCache('test-key', 'test-value', 60000);
    const value = (orchestrator as any).getFromCache('test-key');
    if (value === 'test-value') {
      log('✓ Cache working', 'green');
      passed++;
    } else throw new Error('Cache retrieval failed');
  } catch (e) {
    log('✗ Cache failed', 'red');
    failed++;
  }
  
  // Test 9: System Status
  try {
    const status = await orchestrator.getStatus();
    if (status.agents && status.cache && status.session) {
      log('✓ System Status working', 'green');
      passed++;
    } else throw new Error('Incomplete status');
  } catch (e) {
    log('✗ System Status failed', 'red');
    failed++;
  }
  
  // Summary
  log(`\n=== Test Summary ===`, 'blue');
  log(`Passed: ${passed}`, 'green');
  log(`Failed: ${failed}`, failed > 0 ? 'red' : 'green');
  log(`Total: ${passed + failed}`, 'blue');
  
  // Cleanup
  await orchestrator.shutdown();
  await cleanup();
  circuitBreakerManager.destroy();
  resourceManager.destroy();
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
testFeatures().catch(error => {
  log(`\nFatal error: ${error}`, 'red');
  process.exit(1);
});