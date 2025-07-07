#!/usr/bin/env ts-node
// WebSocket integration test

import { EnhancedOrchestrator } from '../src/core/enhanced-orchestrator';
import { WebSocket } from 'ws';
import * as fs from 'fs/promises';

const TEST_DIR = '.test-websocket';
const WS_PORT = 8888;

// Colors
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testWebSocket() {
  log('\n=== WebSocket Integration Test ===\n', 'blue');
  
  await cleanup();
  
  // Create orchestrator with WebSocket enabled
  const orchestrator = new EnhancedOrchestrator({
    sessionName: 'ws-test',
    dataDir: TEST_DIR,
    port: WS_PORT,
    enableWebSocket: true,
    enableSessions: true,
    enableProtocols: true,
    enableModes: true,
  });
  
  try {
    await orchestrator.initialize();
    log('✓ Orchestrator initialized with WebSocket server', 'green');
    
    // Give server time to start
    await sleep(100);
    
    // Connect WebSocket client
    const ws = new WebSocket(`ws://localhost:${WS_PORT}`);
    
    const messages: any[] = [];
    
    ws.on('open', () => {
      log('✓ WebSocket connected', 'green');
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      messages.push(message);
      log(`← Received: ${message.type}`, 'blue');
    });
    
    ws.on('error', (error) => {
      log(`✗ WebSocket error: ${error}`, 'red');
    });
    
    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      ws.once('open', resolve);
      ws.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 2000);
    });
    
    // Test 1: Get suggestions
    log('\nTest 1: Get suggestions', 'yellow');
    ws.send(JSON.stringify({
      type: 'suggestions',
      partial: 'start',
      requestId: '1',
    }));
    
    await sleep(100);
    
    const suggestionsMsg = messages.find(m => m.type === 'suggestions');
    if (suggestionsMsg && suggestionsMsg.suggestions.length > 0) {
      log('✓ Received suggestions', 'green');
      log(`  Found ${suggestionsMsg.suggestions.length} suggestions`, 'green');
    } else {
      log('✗ No suggestions received', 'red');
    }
    
    // Test 2: List agents
    log('\nTest 2: List agents', 'yellow');
    ws.send(JSON.stringify({
      type: 'list:agents',
      requestId: '2',
    }));
    
    await sleep(100);
    
    const agentsMsg = messages.find(m => m.type === 'agents:list');
    if (agentsMsg) {
      log('✓ Received agent list', 'green');
      log(`  ${agentsMsg.agents.length} agents active`, 'green');
    } else {
      log('✗ No agent list received', 'red');
    }
    
    // Test 3: Execute command
    log('\nTest 3: Execute command', 'yellow');
    ws.send(JSON.stringify({
      type: 'execute',
      command: 'echo "Hello from WebSocket"',
      requestId: '3',
    }));
    
    await sleep(200);
    
    const executeMsg = messages.find(m => m.type === 'execute:result');
    if (executeMsg && executeMsg.agent) {
      log('✓ Command executed', 'green');
      log(`  Agent: ${executeMsg.agent.name}`, 'green');
    } else {
      log('✗ Command execution failed', 'red');
    }
    
    // Test 4: Stream subscription (if agent was created)
    if (executeMsg && executeMsg.agent) {
      log('\nTest 4: Stream subscription', 'yellow');
      
      let streamReceived = false;
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'stream:chunk') {
          streamReceived = true;
          log(`✓ Received stream chunk: ${msg.chunk.data}`, 'green');
        }
      });
      
      ws.send(JSON.stringify({
        type: 'stream:subscribe',
        agentId: executeMsg.agent.id,
      }));
      
      // Send command to agent to generate output
      ws.send(JSON.stringify({
        type: 'agent:command',
        agentId: executeMsg.agent.id,
        command: 'echo "Stream test"',
        requestId: '4',
      }));
      
      await sleep(200);
      
      if (!streamReceived) {
        log('⚠ No stream chunks received (may be due to agent type)', 'yellow');
      }
    }
    
    // Test 5: State message
    log('\nTest 5: Initial state', 'yellow');
    const stateMsg = messages.find(m => m.type === 'state');
    if (stateMsg) {
      log('✓ Received initial state', 'green');
      log(`  Session: ${stateMsg.data.session}`, 'green');
      log(`  Agents: ${stateMsg.data.agents.length}`, 'green');
    } else {
      log('✗ No initial state received', 'red');
    }
    
    // Summary
    log('\n=== Summary ===', 'blue');
    log(`Total messages received: ${messages.length}`, 'green');
    log('Message types:', 'green');
    const types = [...new Set(messages.map(m => m.type))];
    types.forEach(type => {
      const count = messages.filter(m => m.type === type).length;
      log(`  ${type}: ${count}`, 'green');
    });
    
    // Close connection
    ws.close();
    
  } catch (error) {
    log(`\nError: ${error}`, 'red');
  } finally {
    await orchestrator.shutdown();
    await cleanup();
  }
}

// Run test
testWebSocket().catch(error => {
  log(`Fatal error: ${error}`, 'red');
  process.exit(1);
});