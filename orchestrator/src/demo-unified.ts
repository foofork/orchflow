#!/usr/bin/env tsx
// OrchFlow Unified Orchestrator Demo
// Interactive CLI to test the orchestration system

import * as readline from 'readline';
import { Orchestrator } from './orchestrator';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'orchflow> ',
});

async function main() {
  console.log('🚀 OrchFlow Unified Orchestrator Demo');
  console.log('=====================================');
  console.log('Type "help" for available commands\n');

  const orchestrator = new Orchestrator({
    sessionName: 'orchflow-demo',
    port: 8080,
    enableWebSocket: true,
    // Enable basic features by default
    enableSessions: true,
    enableProtocols: true,
    enableCache: true,
    enableModes: true,
    enableCircuitBreakers: true,
  });

  await orchestrator.initialize();
  console.log('✅ Orchestrator initialized\n');

  const commands = {
    help: () => {
      console.log('\nAvailable commands:');
      console.log('  help                    - Show this help');
      console.log('  status                  - Show system status');
      console.log('  execute <command>       - Execute a command (e.g., "start dev server")');
      console.log('  agents                  - List all agents');
      console.log('  output <agent-id>       - Get output from an agent');
      console.log('  send <agent-id> <cmd>   - Send command to an agent');
      console.log('  stop <agent-id>         - Stop an agent');
      console.log('  session start <name>    - Start a new session');
      console.log('  mode <name>             - Activate a mode (tdd, debug, etc.)');
      console.log('  mode list               - List available modes');
      console.log('  protocol add <text>     - Add a protocol rule');
      console.log('  protocol list           - List protocols');
      console.log('  exit                    - Exit the demo\n');
    },

    status: async () => {
      try {
        const status = await orchestrator.getStatus();
        console.log('\n📊 System Status:');
        console.log(JSON.stringify(status, null, 2));
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    execute: async (command: string) => {
      try {
        console.log(`\n🔄 Executing: ${command}`);
        const agent = await orchestrator.execute(command);
        console.log(`✅ Created agent: ${agent.id} (${agent.name})`);
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    agents: async () => {
      try {
        const agents = await orchestrator.listAgents();
        console.log(`\n📋 Active agents: ${agents.length}`);
        agents.forEach(agent => {
          console.log(`  • ${agent.id} - ${agent.name} (${agent.type}) - ${agent.status}`);
        });
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    output: async (agentId: string) => {
      try {
        const output = await orchestrator.getAgentOutput(agentId);
        console.log(`\n📤 Output from ${agentId}:`);
        console.log('---');
        console.log(output || '(no output yet)');
        console.log('---');
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    send: async (agentId: string, command: string) => {
      try {
        await orchestrator.sendToAgent(agentId, command);
        console.log(`\n✅ Sent command to ${agentId}: ${command}`);
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    stop: async (agentId: string) => {
      try {
        await orchestrator.stopAgent(agentId);
        console.log(`\n✅ Stopped agent: ${agentId}`);
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    session: async (subcommand: string, name?: string) => {
      try {
        if (subcommand === 'start' && name) {
          await orchestrator.startSession(name);
          console.log(`\n✅ Started session: ${name}`);
        } else if (subcommand === 'handoff') {
          const handoff = await orchestrator.generateHandoff();
          console.log('\n📋 Session Handoff:');
          console.log(handoff);
        } else {
          console.log('\nUsage: session start <name> | session handoff');
        }
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    mode: async (name: string) => {
      try {
        if (name === 'list') {
          const modes = orchestrator.listModes();
          console.log(`\n🎯 Available modes: ${modes.length}`);
          modes.forEach(mode => {
            console.log(`  • ${mode.icon} ${mode.name} - ${mode.description}`);
          });
        } else {
          await orchestrator.activateMode(name);
          console.log(`\n✅ Activated ${name} mode`);
        }
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },

    protocol: async (subcommand: string, ...args: string[]) => {
      try {
        if (subcommand === 'add' && args.length > 0) {
          await orchestrator.addProtocol({
            type: 'directive',
            priority: 100,
            action: args.join(' '),
            enabled: true,
          });
          console.log(`\n✅ Added protocol: ${args.join(' ')}`);
        } else if (subcommand === 'list') {
          const protocols = orchestrator.listProtocols();
          console.log(`\n📋 Protocols: ${protocols.length}`);
          protocols.forEach(p => {
            console.log(`  • [${p.priority}] ${p.action} (${p.enabled ? 'enabled' : 'disabled'})`);
          });
        } else {
          console.log('\nUsage: protocol add <text> | protocol list');
        }
      } catch (error) {
        console.log(`\n❌ Error: ${error}`);
      }
    },
  };

  rl.on('line', async (line) => {
    const [cmd, ...args] = line.trim().split(' ');

    switch (cmd) {
      case 'help':
        commands.help();
        break;

      case 'status':
        await commands.status();
        break;

      case 'execute':
        if (args.length === 0) {
          console.log('Usage: execute <command>');
          break;
        }
        await commands.execute(args.join(' '));
        break;

      case 'agents':
        await commands.agents();
        break;

      case 'output':
        if (args.length === 0) {
          console.log('Usage: output <agent-id>');
          break;
        }
        await commands.output(args[0]);
        break;

      case 'send':
        if (args.length < 2) {
          console.log('Usage: send <agent-id> <command>');
          break;
        }
        await commands.send(args[0], args.slice(1).join(' '));
        break;

      case 'stop':
        if (args.length === 0) {
          console.log('Usage: stop <agent-id>');
          break;
        }
        await commands.stop(args[0]);
        break;

      case 'session':
        if (args.length === 0) {
          console.log('Usage: session start <name> | session handoff');
          break;
        }
        await commands.session(args[0], args[1]);
        break;

      case 'mode':
        if (args.length === 0) {
          console.log('Usage: mode <name> | mode list');
          break;
        }
        await commands.mode(args[0]);
        break;

      case 'protocol':
        if (args.length === 0) {
          console.log('Usage: protocol add <text> | protocol list');
          break;
        }
        await commands.protocol(args[0], ...args.slice(1));
        break;

      case 'exit':
      case 'quit':
        console.log('\n👋 Shutting down...');
        await orchestrator.shutdown();
        process.exit(0);
        break;

      case '':
        // Empty line, just show prompt again
        break;

      default:
        console.log(`Unknown command: ${cmd}. Type "help" for available commands.`);
    }

    rl.prompt();
  });

  rl.on('close', async () => {
    console.log('\n👋 Shutting down...');
    await orchestrator.shutdown();
    process.exit(0);
  });

  rl.prompt();
}

// Handle errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the demo
main().catch(console.error);