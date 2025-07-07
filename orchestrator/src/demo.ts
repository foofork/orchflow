#!/usr/bin/env tsx
// OrchFlow Orchestrator Demo
// Interactive CLI to test the orchestration system

import * as readline from 'readline';
import { Orchestrator } from './index';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'orchflow> ',
});

async function main() {
  console.log('🚀 OrchFlow Orchestrator Demo');
  console.log('=============================');
  console.log('Type "help" for available commands\n');

  const orchestrator = new Orchestrator({
    sessionName: 'orchflow-demo',
    enableWebSocket: false, // Disable for CLI demo
  });

  // Setup event listeners
  orchestrator.on('agent:created', (agent) => {
    console.log(`\n✅ Agent created: ${agent.name} (${agent.id})`);
    rl.prompt();
  });

  orchestrator.on('agent:stopped', (agent) => {
    console.log(`\n🛑 Agent stopped: ${agent.name}`);
    rl.prompt();
  });

  orchestrator.on('intent:parsed', (intent) => {
    console.log(`\n🤖 Intent: ${intent.action} (confidence: ${intent.confidence})`);
  });

  const commands = {
    help: () => {
      console.log('\nAvailable commands:');
      console.log('  Natural language:');
      console.log('    - "start dev server"');
      console.log('    - "run tests"');
      console.log('    - "open node repl"');
      console.log('    - "build project"');
      console.log('    - "lint code"');
      console.log('\n  Direct commands:');
      console.log('    - list: Show all agents');
      console.log('    - output <id>: Show agent output');
      console.log('    - send <id> <cmd>: Send command to agent');
      console.log('    - stop <id>: Stop an agent');
      console.log('    - exit: Quit the demo');
      console.log();
    },
    
    list: async () => {
      const agents = await orchestrator.listAgents();
      if (agents.length === 0) {
        console.log('\nNo active agents');
      } else {
        console.log('\nActive agents:');
        agents.forEach(agent => {
          console.log(`  ${agent.id}: ${agent.name} (${agent.type}) - ${agent.status}`);
        });
      }
    },
    
    output: async (args: string[]) => {
      const agentId = args[0];
      if (!agentId) {
        console.log('\nUsage: output <agent-id>');
        return;
      }
      
      try {
        const output = await orchestrator.getAgentOutput(agentId);
        console.log(`\nOutput from ${agentId}:`);
        console.log('---');
        console.log(output);
        console.log('---');
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },
    
    send: async (args: string[]) => {
      const agentId = args[0];
      const command = args.slice(1).join(' ');
      
      if (!agentId || !command) {
        console.log('\nUsage: send <agent-id> <command>');
        return;
      }
      
      try {
        await orchestrator.sendToAgent(agentId, command);
        console.log(`\n📤 Sent to ${agentId}: ${command}`);
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },
    
    stop: async (args: string[]) => {
      const agentId = args[0];
      if (!agentId) {
        console.log('\nUsage: stop <agent-id>');
        return;
      }
      
      try {
        const agents = await orchestrator.listAgents();
        const agent = agents.find(a => a.id === agentId);
        if (agent) {
          // Use a method that exists on the orchestrator
          console.log(`\n🛑 Stopping agent: ${agentId}`);
          // For now, we'll need to add a stopAgent method to orchestrator
          console.log('(Stop functionality pending implementation)');
        } else {
          console.log(`\n❌ Agent not found: ${agentId}`);
        }
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },
  };

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();
    
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === 'exit' || input === 'quit') {
      console.log('\nShutting down...');
      await orchestrator.shutdown();
      rl.close();
      process.exit(0);
    }

    // Check for direct commands
    const [cmd, ...args] = input.split(' ');
    if (cmd in commands) {
      await commands[cmd as keyof typeof commands](args);
      rl.prompt();
      return;
    }

    // Try natural language routing
    try {
      const agent = await orchestrator.execute(input);
      if (!agent) {
        console.log('\n❌ Could not understand command. Type "help" for available commands.');
      }
    } catch (error) {
      console.log(`\n❌ Error: ${error}`);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    console.log('\n\nGoodbye! 👋');
    await orchestrator.shutdown();
    process.exit(0);
  });
}

// Handle errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

main().catch(console.error);