#!/usr/bin/env tsx
import express from 'express';
import { WebSocketServer } from 'ws';
import { createOrchestrator } from '../src/index.js';
import { DashboardAPI } from '../src/api/dashboard-api.js';

async function main() {
  console.log('🚀 Starting Orchflow GUI Server...');

  // Create orchestrator with GUI features
  const orchestrator = await createOrchestrator({
    sessionName: 'orchflow-gui',
    enableGUI: true,
    enableWebSocket: true,
    enableSwarmCoordination: true,
    enableMemoryManager: true,
    enableProtocolManager: true,
  });

  // Set up Express server
  const app = express();
  app.use(express.json());

  // Enable CORS for frontend
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  // Mount dashboard API
  const dashboardAPI = new DashboardAPI(orchestrator);
  app.use('/api', dashboardAPI.getRouter());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', session: orchestrator.getSessionId() });
  });

  // Start HTTP server
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    console.log(`📡 HTTP API running on http://localhost:${PORT}`);
  });

  // Set up WebSocket server
  const WS_PORT = process.env.WS_PORT || 8081;
  const wss = new WebSocketServer({ port: Number(WS_PORT) });

  wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    orchestrator.attachGUIClient(ws);

    ws.on('close', () => {
      console.log('🔌 WebSocket client disconnected');
    });
  });

  console.log(`🌐 WebSocket server running on ws://localhost:${WS_PORT}`);

  // Create initial agents
  const devAgent = await orchestrator.createAgent({
    type: 'dev-server',
    name: 'Dev Server',
    command: 'echo "Dev server ready"; sleep infinity',
  });

  const testAgent = await orchestrator.createAgent({
    type: 'test-runner',
    name: 'Test Runner',
    command: 'echo "Test runner ready"; sleep infinity',
  });

  console.log('✅ Orchestrator ready with GUI features');
  console.log('');
  console.log('📋 Quick start:');
  console.log('  1. Open frontend: cd ../frontend && npm run dev');
  console.log('  2. Visit http://localhost:5173');
  console.log('');
  console.log('🔧 API Endpoints:');
  console.log(`  - Dashboard: http://localhost:${PORT}/api/dashboard/stats`);
  console.log(`  - Terminals: http://localhost:${PORT}/api/terminals`);
  console.log(`  - Layouts: http://localhost:${PORT}/api/layouts/templates`);
  console.log(`  - WebSocket: ws://localhost:${WS_PORT}`);

  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    await orchestrator.shutdown();
    server.close();
    wss.close();
    process.exit(0);
  });
}

main().catch(console.error);