#!/usr/bin/env tsx
// OrchFlow Enhanced Orchestrator Demo
// Showcases sessions, protocols, and advanced features

import * as readline from 'readline';
import { EnhancedOrchestrator } from './core/enhanced-orchestrator';
import { EventBus, OrchflowEvents } from './core/event-bus';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'orchflow> ',
});

async function main() {
  console.log('🚀 OrchFlow Enhanced Orchestrator Demo');
  console.log('=====================================');
  console.log('Features: Sessions, Protocols, Event Bus, Caching');
  console.log('         + SPARC Modes, Circuit Breakers, Resource Manager\n');
  console.log('Type "help" for available commands\n');

  const orchestrator = new EnhancedOrchestrator({
    sessionName: 'orchflow-demo',
    enableWebSocket: false, // Disable for CLI demo
    dataDir: '.orchflow-demo',
  });

  // Initialize the enhanced orchestrator
  await orchestrator.initialize();
  
  // Start a demo session
  await orchestrator.startSession('demo-session', {
    purpose: 'testing enhanced features',
  });

  // Setup event listeners using the event bus
  EventBus.on(OrchflowEvents.AGENT_CREATED, ({ agentId, name }) => {
    console.log(`\n✅ Agent created: ${name} (${agentId})`);
    rl.prompt();
  });

  EventBus.on(OrchflowEvents.AGENT_STOPPED, ({ agentId }) => {
    console.log(`\n🛑 Agent stopped: ${agentId}`);
    rl.prompt();
  });

  EventBus.on(OrchflowEvents.COMMAND_EXECUTED, ({ command }) => {
    console.log(`\n⚡ Executing: ${command}`);
  });

  EventBus.on(OrchflowEvents.COMMAND_COMPLETED, ({ command, result }) => {
    console.log(`\n✓ Completed: ${command}`);
  });

  EventBus.on(OrchflowEvents.COMMAND_FAILED, ({ command, error }) => {
    console.log(`\n❌ Failed: ${command} - ${error}`);
  });

  // Enable debug mode for event bus
  EventBus.setDebug(true);

  const commands = {
    help: () => {
      console.log('\n📚 Available commands:');
      console.log('\n  🤖 Natural language:');
      console.log('    - "start dev server"');
      console.log('    - "run tests"');
      console.log('    - "open node repl"');
      console.log('    - "build project"');
      console.log('    - "lint code"');
      console.log('\n  📋 Session commands:');
      console.log('    - session: Show current session info');
      console.log('    - handoff: Generate session handoff');
      console.log('\n  🔧 Protocol commands:');
      console.log('    - protocols: List all protocols');
      console.log('    - protocol add <name>: Add a custom protocol');
      console.log('\n  🎯 Mode commands:');
      console.log('    - modes: List all available modes');
      console.log('    - mode <name>: Activate a specific mode');
      console.log('    - mode status: Show current mode status');
      console.log('    - mode end: End current mode');
      console.log('\n  📊 System commands:');
      console.log('    - status: Show system status');
      console.log('    - list: Show all agents');
      console.log('    - output <id>: Show agent output');
      console.log('    - send <id> <cmd>: Send command to agent');
      console.log('    - stop <id>: Stop an agent');
      console.log('    - events: Show event statistics');
      console.log('    - breakers: Show circuit breaker status');
      console.log('    - resources: Show resource locks');
      console.log('    - debug: Toggle debug mode');
      console.log('\n  🧠 Memory commands:');
      console.log('    - remember <key> <value>: Store in memory');
      console.log('    - recall <key>: Retrieve from memory');
      console.log('    - search <query>: Search memory');
      console.log('\n  📋 Task commands:');
      console.log('    - task submit <name>: Submit a new task');
      console.log('    - task status <id>: Check task status');
      console.log('    - task list: List all tasks');
      console.log('    - exit: Quit the demo');
      console.log();
    },
    
    session: async () => {
      const status = await orchestrator.getStatus();
      if (status.session) {
        console.log('\n📁 Current Session:');
        console.log(`  ID: ${status.session.id}`);
        console.log(`  Name: ${status.session.name}`);
        console.log(`  Duration: ${Math.round(status.session.duration / 60000)} minutes`);
        console.log(`  Active Agents: ${status.session.agents}`);
        console.log(`  Tasks: ${status.session.tasks}`);
      } else {
        console.log('\nNo active session');
      }
    },
    
    handoff: async () => {
      const handoff = await orchestrator.generateHandoff();
      console.log('\n📋 Session Handoff:\n');
      console.log(handoff);
    },
    
    protocols: async () => {
      const protocols = orchestrator.listProtocols();
      console.log('\n🔧 Protocols:');
      protocols.forEach(p => {
        console.log(`  ${p.enabled ? '✓' : '✗'} ${p.name} (${p.type}) - ${p.description}`);
      });
    },
    
    'protocol add': async (args: string[]) => {
      const name = args.join(' ');
      if (!name) {
        console.log('\nUsage: protocol add <name>');
        return;
      }
      
      await orchestrator.addProtocol({
        type: 'directive',
        name,
        description: `Custom protocol: ${name}`,
        priority: 50,
        enabled: true,
      });
      console.log(`\n✅ Protocol added: ${name}`);
    },
    
    status: async () => {
      const status = await orchestrator.getStatus();
      console.log('\n📊 System Status:');
      console.log(`  Agents: ${status.agents.length}`);
      console.log(`  Cache: ${status.cache.entries} entries (${status.cache.enabled ? 'enabled' : 'disabled'})`);
      console.log(`  Protocols: ${status.protocols.enabled}/${status.protocols.total} enabled`);
      if (status.session) {
        console.log(`  Session: ${status.session.name} (${Math.round(status.session.duration / 60000)} min)`);
      }
      if (status.mode) {
        console.log(`  Active Mode: ${status.mode.name} (${status.mode.category})`);
      }
      console.log(`  Available Modes: ${status.availableModes}`);
      if (status.resources) {
        console.log(`  Resources: ${status.resources.total} total, ${status.resources.locks} locks`);
      }
      if (status.memory) {
        console.log(`  Memory: ${status.memory.entries} entries (${status.memory.cacheSize} cached)`);
      }
      if (status.scheduler) {
        console.log(`  Scheduler: ${status.scheduler.running} running, ${status.scheduler.pending} pending`);
      }
      if (status.terminalPool) {
        console.log(`  Terminal Pool: ${status.terminalPool.available}/${status.terminalPool.total} available`);
      }
      if (status.metrics) {
        console.log(`  Metrics: ${status.metrics.commandsExecuted} commands executed`);
      }
    },
    
    events: () => {
      const stats = EventBus.getInstance().getStats() as Map<string, any>;
      console.log('\n📈 Event Statistics:');
      const sortedStats = Array.from(stats.entries())
        .filter(([_, stat]) => stat.count > 0)
        .sort(([_, a], [__, b]) => b.count - a.count);
      
      if (sortedStats.length === 0) {
        console.log('  No events fired yet');
      } else {
        sortedStats.forEach(([event, stat]) => {
          console.log(`  ${event}: ${stat.count} times`);
        });
      }
    },
    
    modes: async () => {
      const modes = orchestrator.listModes({ enabled: true });
      console.log('\n🎯 Available Modes:');
      modes.forEach(m => {
        console.log(`  ${m.icon} ${m.name} (${m.category}) - ${m.description}`);
      });
    },
    
    mode: async (args: string[]) => {
      const subcommand = args[0];
      
      if (!subcommand) {
        console.log('\nUsage: mode <name|status|end>');
        return;
      }
      
      if (subcommand === 'status') {
        const activeMode = orchestrator.getActiveMode();
        if (activeMode) {
          console.log(`\n🎯 Active Mode: ${activeMode.name}`);
          console.log(`  Category: ${activeMode.category}`);
          console.log(`  Description: ${activeMode.description}`);
        } else {
          console.log('\nNo active mode');
        }
      } else if (subcommand === 'end') {
        const context = await orchestrator.endMode();
        if (context) {
          console.log(`\n✓ Ended ${context.mode.name} mode`);
        } else {
          console.log('\nNo active mode to end');
        }
      } else {
        try {
          await orchestrator.activateMode(subcommand);
          console.log(`\n✓ Activated ${subcommand} mode`);
        } catch (error) {
          console.log(`\n❌ Error: ${error}`);
        }
      }
    },
    
    breakers: async () => {
      const status = await orchestrator.getStatus();
      if (status.circuitBreakers) {
        console.log('\n⚡ Circuit Breakers:');
        for (const [name, stats] of Object.entries(status.circuitBreakers)) {
          const s = stats as any;
          console.log(`  ${name}: ${s.state}`);
          console.log(`    Calls: ${s.totalCalls}, Failures: ${s.totalFailures}, Successes: ${s.totalSuccesses}`);
        }
      } else {
        console.log('\nCircuit breakers not enabled');
      }
    },
    
    resources: async () => {
      const status = await orchestrator.getStatus();
      if (status.resources) {
        console.log('\n🔒 Resource Status:');
        console.log(`  Total: ${status.resources.total}`);
        console.log(`  Active Locks: ${status.resources.locks}`);
        console.log(`  Wait Queue: ${status.resources.waitQueue}`);
      } else {
        console.log('\nResource manager not enabled');
      }
    },
    
    remember: async (args: string[]) => {
      if (args.length < 2) {
        console.log('\nUsage: remember <key> <value>');
        return;
      }
      
      const key = args[0];
      const value = args.slice(1).join(' ');
      
      await orchestrator.remember(key, value, { tags: ['demo'] });
      console.log(`\n✓ Remembered: ${key}`);
    },
    
    recall: async (args: string[]) => {
      if (args.length === 0) {
        console.log('\nUsage: recall <key>');
        return;
      }
      
      const key = args[0];
      const value = await orchestrator.recall(key);
      
      if (value) {
        console.log(`\n🧠 ${key}: ${JSON.stringify(value)}`);
      } else {
        console.log(`\n❌ No memory found for: ${key}`);
      }
    },
    
    search: async (args: string[]) => {
      if (args.length === 0) {
        console.log('\nUsage: search <query>');
        return;
      }
      
      const query = args.join(' ');
      const results = await orchestrator.searchMemory(query, 5);
      
      if (results.length > 0) {
        console.log('\n🔍 Search results:');
        results.forEach((r: any) => {
          console.log(`  ${r.key}: ${JSON.stringify(r.value)}`);
        });
      } else {
        console.log('\nNo results found');
      }
    },
    
    task: async (args: string[]) => {
      const subcommand = args[0];
      
      if (!subcommand) {
        console.log('\nUsage: task <submit|status|list>');
        return;
      }
      
      switch (subcommand) {
        case 'submit':
          const taskName = args.slice(1).join(' ');
          if (!taskName) {
            console.log('\nUsage: task submit <name>');
            return;
          }
          
          const taskId = await orchestrator.submitTask({
            name: taskName,
            type: 'demo',
            priority: 50,
            dependencies: [],
            maxRetries: 3,
          });
          
          if (taskId) {
            console.log(`\n✓ Task submitted: ${taskId}`);
          } else {
            console.log('\n❌ Failed to submit task');
          }
          break;
          
        case 'status':
          const taskId2 = args[1];
          if (!taskId2) {
            console.log('\nUsage: task status <id>');
            return;
          }
          
          const task = orchestrator.getTaskStatus(taskId2);
          if (task) {
            console.log(`\n📋 Task ${taskId2}:`);
            console.log(`  Name: ${task.name}`);
            console.log(`  Status: ${task.status}`);
            console.log(`  Priority: ${task.priority}`);
          } else {
            console.log(`\n❌ Task not found: ${taskId2}`);
          }
          break;
          
        case 'list':
          const status = await orchestrator.getStatus();
          if (status.scheduler) {
            console.log('\n📋 Task Queue:');
            console.log(`  Pending: ${status.scheduler.pending}`);
            console.log(`  Scheduled: ${status.scheduler.scheduled}`);
            console.log(`  Running: ${status.scheduler.running}`);
            console.log(`  Total: ${status.scheduler.total}`);
          } else {
            console.log('\nTask scheduler not enabled');
          }
          break;
          
        default:
          console.log('\nUnknown task subcommand:', subcommand);
      }
    },
    
    debug: () => {
      const bus = EventBus.getInstance();
      const currentDebug = (bus as any).debug;
      bus.setDebug(!currentDebug);
      console.log(`\n🔍 Debug mode: ${!currentDebug ? 'ON' : 'OFF'}`);
    },
    
    list: async () => {
      const agents = await orchestrator.listAgents();
      if (agents.length === 0) {
        console.log('\nNo active agents');
      } else {
        console.log('\n🤖 Active agents:');
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
        console.log(`\n📄 Output from ${agentId}:`);
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
        console.log(`\n🛑 Stopping agent: ${agentId}`);
        console.log('(Stop functionality pending implementation)');
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

    // Check for multi-word commands
    for (const [cmd, handler] of Object.entries(commands)) {
      if (input.startsWith(cmd)) {
        const args = input.slice(cmd.length).trim().split(' ').filter(Boolean);
        await handler(args);
        rl.prompt();
        return;
      }
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
    console.log('\n\nGenerating session handoff...');
    const handoff = await orchestrator.generateHandoff();
    console.log(handoff);
    console.log('\nGoodbye! 👋');
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