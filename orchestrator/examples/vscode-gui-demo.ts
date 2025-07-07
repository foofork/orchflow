// VS Code-Style GUI Demo for Orchflow
import { createOrchestrator } from '../src/orchestrator';
import express from 'express';
import { WebSocketServer } from 'ws';
import { DashboardAPI } from '../src/api/dashboard-api';

async function main() {
  console.log('🚀 Starting VS Code-style Orchflow GUI Demo...\n');
  
  // Create orchestrator with GUI features enabled
  const orchestrator = await createOrchestrator({
    sessionName: 'vscode-gui-demo',
    enableWebSocket: true,
    enableGUI: true,
    enableSessions: true,
    enableProtocols: true,
    port: 8080,
  });
  
  console.log('✅ Orchestrator initialized with GUI features');
  
  // Create Express app for REST API
  const app = express();
  app.use(express.json());
  
  // Mount dashboard API
  const dashboardAPI = new DashboardAPI(orchestrator);
  app.use('/api', dashboardAPI.getRouter());
  
  // Serve static files (for future frontend)
  app.use(express.static('public'));
  
  // Start HTTP server
  const server = app.listen(3000, () => {
    console.log('📡 Dashboard API running on http://localhost:3000');
  });
  
  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ port: 8081 });
  wss.on('connection', (ws) => {
    console.log('🔌 GUI client connected');
    orchestrator.attachGUIClient(ws);
  });
  
  console.log('🔌 WebSocket server running on ws://localhost:8081');
  
  // Demo: Create VS Code-style layout
  console.log('\n📐 Creating VS Code-style development layout...');
  const layout = await orchestrator.createLayout('dev-workspace', {
    panes: [
      {
        position: 'main',
        agentType: 'editor',
        command: 'echo "Editor pane ready" && bash',
        title: '📝 Editor',
      },
      {
        position: 'bottom-left', 
        agentType: 'dev-server',
        command: 'echo "Dev server starting..." && bash',
        title: '🚀 Dev Server',
      },
      {
        position: 'bottom-right',
        agentType: 'logger',
        command: 'echo "Monitoring logs..." && bash', 
        title: '📜 Logs',
      },
    ],
  });
  
  console.log('✅ Layout created with', layout.panes.size, 'panes');
  
  // Demo: Create tabs for open files and terminals
  console.log('\n📑 Creating tabs...');
  
  // File tabs
  const fileTab1 = orchestrator.createTab({
    type: 'file',
    title: 'main.ts',
    path: '/src/main.ts',
  });
  console.log('  ✅ Created file tab:', fileTab1.title);
  
  const fileTab2 = orchestrator.createTab({
    type: 'file', 
    title: 'config.json',
    path: '/config.json',
  });
  console.log('  ✅ Created file tab:', fileTab2.title);
  
  // Terminal tabs (linked to agents)
  const agents = await orchestrator.listAgents();
  for (const agent of agents) {
    const tab = orchestrator.createTab({
      type: 'terminal',
      title: agent.name,
      agentId: agent.id,
    });
    console.log('  ✅ Created terminal tab:', tab.title);
  }
  
  // Dashboard tab
  const dashboardTab = orchestrator.createTab({
    type: 'dashboard',
    title: '📊 System Monitor',
  });
  console.log('  ✅ Created dashboard tab:', dashboardTab.title);
  
  // Demo: Show current state
  console.log('\n📊 Current State:');
  const status = await orchestrator.getStatus();
  console.log('  • Agents:', status.agents.length);
  console.log('  • Features:', status.features.join(', '));
  
  const tabs = orchestrator.getTabs();
  console.log('  • Tabs:', tabs.length);
  tabs.forEach(tab => {
    console.log(`    - ${tab.icon || ''} ${tab.title} (${tab.type})`);
  });
  
  // Demo: Interactive commands
  console.log('\n💡 Interactive Demo Commands:');
  console.log('  • GET  /api/dashboard/stats     - Dashboard statistics');
  console.log('  • GET  /api/terminals           - List all terminals');
  console.log('  • GET  /api/layouts/templates   - Available layouts');
  console.log('  • GET  /api/tabs                - List all tabs');
  console.log('  • POST /api/command             - Execute command');
  console.log('  • WebSocket ws://localhost:8081 - Real-time updates');
  
  console.log('\n🎮 Try these curl commands:');
  console.log('  curl http://localhost:3000/api/dashboard/stats');
  console.log('  curl http://localhost:3000/api/terminals');
  console.log('  curl http://localhost:3000/api/tabs');
  
  // Keep process alive
  console.log('\n✨ VS Code-style GUI is running! Press Ctrl+C to exit.\n');
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await orchestrator.shutdown();
    server.close();
    wss.close();
    process.exit(0);
  });
}

// Run the demo
main().catch(console.error);