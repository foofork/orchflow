#!/usr/bin/env ts-node
// Unit tests for individual components

import { EventBus, OrchflowEvents } from '../src/core/event-bus';
import { SessionManager } from '../src/core/session-manager';
import { ProtocolManager } from '../src/core/protocol-manager';
import { ModeManager } from '../src/modes/mode-manager';
import { metricsCollector } from '../src/metrics/metrics-collector';
import { OutputStreamManager } from '../src/streaming/output-stream';
import { TerminalAdapter, TerminalAdapterFactory } from '../src/terminal/terminal-adapter';
import * as fs from 'fs/promises';
import * as path from 'path';

const TEST_DIR = '.test-unit';

// Test helpers
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function cleanup() {
  try {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  } catch {}
}

async function test(name: string, fn: () => Promise<void> | void): Promise<boolean> {
  try {
    await fn();
    log(`✓ ${name}`, 'green');
    return true;
  } catch (error) {
    log(`✗ ${name}: ${error}`, 'red');
    return false;
  }
}

async function runTests() {
  await cleanup();
  await fs.mkdir(TEST_DIR, { recursive: true });
  
  let passed = 0;
  let total = 0;
  
  log('\n=== Unit Tests ===\n', 'blue');
  
  // EventBus Tests
  log('EventBus:', 'blue');
  
  total++;
  if (await test('should emit and receive events', async () => {
    let received = false;
    const unsub = EventBus.on(OrchflowEvents.SYSTEM_READY, () => {
      received = true;
    });
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    if (!received) throw new Error('Event not received');
    unsub();
  })) passed++;
  
  total++;
  if (await test('should support filtered listeners', async () => {
    let count = 0;
    const unsub = EventBus.onFiltered(
      OrchflowEvents.AGENT_CREATED,
      (data) => data.type === 'test',
      () => count++
    );
    
    EventBus.emit(OrchflowEvents.AGENT_CREATED, {
      agentId: '1',
      name: 'test',
      type: 'test',
    });
    
    EventBus.emit(OrchflowEvents.AGENT_CREATED, {
      agentId: '2',
      name: 'other',
      type: 'other',
    });
    
    if (count !== 1) throw new Error(`Expected 1, got ${count}`);
    unsub();
  })) passed++;
  
  total++;
  if (await test('should wait for events with timeout', async () => {
    setTimeout(() => {
      EventBus.emit(OrchflowEvents.AGENT_STARTED, { agentId: 'test' });
    }, 10);
    
    const result = await EventBus.waitFor(OrchflowEvents.AGENT_STARTED, 100);
    if (result.agentId !== 'test') throw new Error('Wrong data');
  })) passed++;
  
  // SessionManager Tests
  log('\nSessionManager:', 'blue');
  const sessionManager = new SessionManager(path.join(TEST_DIR, 'sessions'));
  await sessionManager.initialize();
  
  total++;
  if (await test('should create and resume sessions', async () => {
    await sessionManager.createSession('test-session', { test: true });
    const session = sessionManager.getCurrentSession();
    if (!session || session.name !== 'test-session') {
      throw new Error('Session not created');
    }
    
    sessionManager.resumeSession(session.id);
    const resumed = sessionManager.getCurrentSession();
    if (!resumed || resumed.id !== session.id) {
      throw new Error('Session not resumed');
    }
  })) passed++;
  
  total++;
  if (await test('should track agents and tasks', async () => {
    const session = sessionManager.getCurrentSession();
    if (!session) throw new Error('No session');
    
    sessionManager.addAgent('agent-1', { type: 'test' });
    sessionManager.addTask('task-1', { name: 'Test Task' });
    
    if (session.agents.size !== 1) throw new Error('Agent not added');
    if (session.tasks.size !== 1) throw new Error('Task not added');
  })) passed++;
  
  total++;
  if (await test('should generate handoff', async () => {
    const handoff = await sessionManager.generateHandoff();
    if (!handoff.includes('test-session')) {
      throw new Error('Handoff missing session name');
    }
    if (!handoff.includes('Test Task')) {
      throw new Error('Handoff missing task');
    }
  })) passed++;
  
  // ProtocolManager Tests
  log('\nProtocolManager:', 'blue');
  const protocolManager = new ProtocolManager(path.join(TEST_DIR, 'protocols'));
  await protocolManager.initialize();
  
  total++;
  if (await test('should add and list protocols', async () => {
    await protocolManager.addProtocol({
      id: 'test-1',
      type: 'directive',
      priority: 100,
      action: 'Test action',
      enabled: true,
      createdAt: new Date(),
    });
    
    const protocols = protocolManager.listProtocols();
    const found = protocols.find(p => p.id === 'test-1');
    if (!found) throw new Error('Protocol not found');
  })) passed++;
  
  total++;
  if (await test('should check command blocking', async () => {
    await protocolManager.addProtocol({
      id: 'block-rm',
      type: 'block',
      priority: 200,
      condition: { command: 'rm -rf' },
      action: 'Block dangerous rm command',
      enabled: true,
      createdAt: new Date(),
    });
    
    const result = protocolManager.isCommandBlocked('rm -rf /');
    if (!result.blocked) throw new Error('Command not blocked');
  })) passed++;
  
  // ModeManager Tests
  log('\nModeManager:', 'blue');
  const modeManager = new ModeManager(path.join(TEST_DIR, 'modes'));
  await modeManager.initialize();
  
  total++;
  if (await test('should list built-in modes', async () => {
    const modes = modeManager.listModes();
    const tddMode = modes.find(m => m.name === 'tdd');
    if (!tddMode) throw new Error('TDD mode not found');
    if (modes.length < 6) throw new Error('Missing built-in modes');
  })) passed++;
  
  total++;
  if (await test('should activate and deactivate modes', async () => {
    await modeManager.activateMode('debug', { verbose: true });
    const active = modeManager.getActiveMode();
    if (!active || active.name !== 'debug') {
      throw new Error('Mode not activated');
    }
    
    await modeManager.endMode();
    const afterEnd = modeManager.getActiveMode();
    if (afterEnd) throw new Error('Mode not deactivated');
  })) passed++;
  
  // Metrics Tests
  log('\nMetricsCollector:', 'blue');
  
  total++;
  if (await test('should collect counters', async () => {
    metricsCollector.increment('test.counter', 5);
    metricsCollector.increment('test.counter', 3);
    // Note: Can't easily test internal state without exposing it
    // Just ensure no errors
  })) passed++;
  
  total++;
  if (await test('should collect gauges and histograms', async () => {
    metricsCollector.gauge('test.gauge', 42);
    metricsCollector.histogram('test.histogram', 100);
    metricsCollector.histogram('test.histogram', 200);
    // Note: Can't easily test internal state without exposing it
    // Just ensure no errors
  })) passed++;
  
  // OutputStreamManager Tests
  log('\nOutputStreamManager:', 'blue');
  const streamManager = new OutputStreamManager();
  
  total++;
  if (await test('should create and manage streams', async () => {
    const stream = streamManager.createStream('agent-1', 'terminal-1', {
      bufferSize: 100,
      flushInterval: 100,
    });
    
    if (!stream) throw new Error('Stream not created');
    
    let received = '';
    const unsub = streamManager.subscribe('agent-1', (chunk) => {
      received += chunk.data;
    });
    
    stream.write('Hello ');
    stream.write('World');
    await stream.flush();
    
    if (received !== 'Hello World') {
      throw new Error(`Expected 'Hello World', got '${received}'`);
    }
    
    unsub();
    stream.close();
  })) passed++;
  
  // TerminalAdapter Tests
  log('\nTerminalAdapter:', 'blue');
  
  total++;
  if (await test('should create appropriate adapter', async () => {
    const adapter = await TerminalAdapterFactory.createAdapter();
    if (!adapter) throw new Error('No adapter created');
    
    // Should be node-process adapter by default
    if (adapter.name !== 'node-process') {
      throw new Error(`Unexpected adapter: ${adapter.name}`);
    }
  })) passed++;
  
  // Summary
  log(`\n=== Summary ===`, 'blue');
  log(`Passed: ${passed}/${total}`, passed === total ? 'green' : 'red');
  
  await cleanup();
  process.exit(passed === total ? 0 : 1);
}

// Run tests
runTests().catch(error => {
  log(`Fatal error: ${error}`, 'red');
  process.exit(1);
});