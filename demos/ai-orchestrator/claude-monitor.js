#!/usr/bin/env node

const { spawn } = require('child_process');
const net = require('net');
const fs = require('fs');

console.log('=== Claude-Code with Orchestration Support ===');
console.log('When Claude mentions orchestrating/coordinating work,');
console.log('it will automatically delegate to worker terminals.\n');
console.log('Try prompts like:');
console.log('  - "Build a REST API with user authentication"');
console.log('  - "Create a full-stack todo application"');
console.log('  - "Implement a chat system with real-time updates"\n');

// Start claude-code
const claude = spawn('claude-code', process.argv.slice(2), {
  stdio: ['inherit', 'pipe', 'inherit']
});

// Monitor claude-code output
claude.stdout.on('data', (data) => {
  const output = data.toString();
  process.stdout.write(data);
  
  // Look for orchestration indicators
  const orchestrationKeywords = [
    'orchestrate',
    'coordinate', 
    'delegate',
    'I\'ll have the team',
    'I\'ll assign',
    'Let me coordinate',
    'I\'ll orchestrate'
  ];
  
  const hasOrchestration = orchestrationKeywords.some(keyword => 
    output.toLowerCase().includes(keyword.toLowerCase())
  );
  
  // Also look for explicit [ORCHESTRATE] marker
  const explicitMatch = output.match(/\[ORCHESTRATE\]\s*({.*?})/s);
  
  if (hasOrchestration || explicitMatch) {
    let task = null;
    
    if (explicitMatch) {
      // Parse explicit command
      try {
        const cmd = JSON.parse(explicitMatch[1]);
        task = cmd.task;
      } catch (e) {
        console.error('\n[ERROR] Failed to parse orchestration command');
      }
    } else {
      // Try to extract task from context
      task = extractTaskFromContext(output);
    }
    
    if (task) {
      console.log('\n[ORCHESTRATION DETECTED]');
      console.log(`Task: "${task}"`);
      
      // Send to orchestrator via Unix socket
      sendToOrchestrator(task);
    }
  }
});

function extractTaskFromContext(output) {
  // Look for common patterns where Claude describes what it will build
  const patterns = [
    /(?:build|create|implement|develop|make)\s+(?:a\s+|an\s+)?(.+?)(?:\.|,|\s+with|\s+using|\s+that|$)/i,
    /(?:I'll|I will|Let me)\s+(?:orchestrate|coordinate|build|create)\s+(?:a\s+|an\s+)?(.+?)(?:\.|,|\s+for you|$)/i,
    /task:\s*"?(.+?)"?$/im,
  ];
  
  for (const pattern of patterns) {
    const match = output.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted task
      let task = match[1].trim();
      // Remove trailing punctuation
      task = task.replace(/[.,!?]+$/, '');
      // Limit length
      if (task.length > 100) {
        task = task.substring(0, 100) + '...';
      }
      return task;
    }
  }
  
  return null;
}

function sendToOrchestrator(task) {
  const client = net.createConnection('/tmp/orchestrator.sock', () => {
    const command = {
      task: task,
      timestamp: Date.now()
    };
    
    client.write(JSON.stringify(command));
    console.log('[SENT TO ORCHESTRATOR]\n');
    client.end();
  });
  
  client.on('error', (err) => {
    console.error('\n[ERROR] Could not connect to orchestrator:', err.message);
    console.error('Make sure the orchestrator is running.\n');
  });
}

// Handle process exit
claude.on('exit', (code) => {
  process.exit(code);
});

process.on('SIGINT', () => {
  claude.kill('SIGINT');
  process.exit();
});