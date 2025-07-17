/**
 * OrchFlow Core - Enterprise-grade orchestration via Claude injection
 */

import { EventEmitter } from 'events';
import type { Server } from 'http';
import type { Express } from 'express';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import crypto from 'crypto';

// Import unified types
import type {
  Worker,
  WorkerType,
  CodeArtifact } from '../types/unified-interfaces';

// Define a simplified config interface for the core
export interface OrchFlowConfig {
  port: number;
  host: string;
  storageDir: string;
  maxWorkers: number;
  enablePersistence: boolean;
  enableWebSocket: boolean;
  security: {
    enableAuth: boolean;
    apiKey?: string;
    allowedOrigins: string[];
  };
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Core orchestration engine that manages workers and provides MCP endpoints
 */
export class OrchFlowCore extends EventEmitter {
  private app: Express;
  private server?: Server;
  private wss?: WebSocketServer;
  private workers: Map<string, Worker> = new Map();
  private sharedKnowledge: Record<string, any> = {};
  private config: OrchFlowConfig;
  private storageDir: string;

  constructor(config: Partial<OrchFlowConfig> = {}) {
    super();

    this.config = {
      port: 3001,
      host: 'localhost',
      storageDir: join(homedir(), '.orchflow'),
      maxWorkers: 10,
      enablePersistence: true,
      enableWebSocket: true,
      security: {
        enableAuth: false,
        allowedOrigins: ['*']
      },
      logLevel: 'info',
      ...config
    };

    this.storageDir = this.config.storageDir;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.ensureStorageDir();
  }

  private ensureStorageDir(): void {
    if (!existsSync(this.storageDir)) {
      mkdirSync(this.storageDir, { recursive: true });
    }

    // Create subdirectories
    ['workers', 'sessions', 'knowledge', 'logs'].forEach(dir => {
      const path = join(this.storageDir, dir);
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    });
  }

  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // CORS for MCP
    this.app.use((req, res, next) => {
      const origin = req.headers.origin || '*';
      if (this.config.security.allowedOrigins.includes('*') ||
          this.config.security.allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }
      next();
    });

    // Authentication
    if (this.config.security.enableAuth) {
      this.app.use((req, res, next) => {
        const apiKey = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '');
        if (apiKey !== this.config.security.apiKey) {
          res.status(401).json({ error: 'Unauthorized' });
          return;
        }
        next();
      });
    }
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'healthy',
        workers: this.workers.size,
        uptime: process.uptime()
      });
    });

    // MCP endpoints for Claude injection
    this.app.post('/mcp/orchflow_spawn_worker', async (req, res) => {
      try {
        const { task, type, context } = req.body;
        const worker = await this.createWorker(task, type, context);
        res.json({
          success: true,
          worker: {
            id: worker.id,
            name: worker.name,
            status: worker.status
          }
        });
      } catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
      }
    });

    this.app.get('/mcp/orchflow_worker_status', async (req, res) => {
      const { workerId } = req.query;

      if (workerId) {
        const worker = this.workers.get(workerId as string);
        if (!worker) {
          res.status(404).json({ error: 'Worker not found' });
          return;
        }
        res.json({ worker });
      } else {
        const workers = Array.from(this.workers.values()).map(w => ({
          id: w.id,
          name: w.name,
          type: w.type,
          status: w.status,
          progress: w.progress,
          task: w.task
        }));
        res.json({ workers });
      }
    });

    this.app.post('/mcp/orchflow_switch_context', async (req, res) => {
      const { workerId } = req.body;
      const worker = this.workers.get(workerId);

      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      // Return worker's full context for Claude to load
      res.json({
        success: true,
        context: {
          workerId: worker.id,
          workerName: worker.name,
          conversationHistory: worker.context.conversationHistory,
          sharedKnowledge: worker.context.sharedKnowledge,
          codeArtifacts: worker.context.codeArtifacts,
          decisions: worker.context.decisions
        }
      });
    });

    this.app.post('/mcp/orchflow_share_knowledge', async (req, res) => {
      const { knowledge, targetWorkers } = req.body;
      const targets = targetWorkers || Array.from(this.workers.keys());

      targets.forEach((workerId: string) => {
        const worker = this.workers.get(workerId);
        if (worker) {
          Object.assign(worker.context.sharedKnowledge, knowledge);
          this.persistWorker(worker);
        }
      });

      this.broadcastUpdate({
        type: 'knowledge_shared',
        data: { knowledge, targetWorkers: targets }
      });

      res.json({ success: true, sharedWith: targets });
    });

    this.app.post('/mcp/orchflow_execute_parallel', async (req, res) => {
      const { tasks } = req.body;
      const results = [];

      for (const task of tasks) {
        const worker = await this.createWorker(
          task.description,
          task.assignTo || 'developer'
        );
        results.push({
          taskId: worker.id,
          workerName: worker.name,
          status: 'started'
        });
      }

      res.json({ success: true, results });
    });

    // Additional API endpoints
    this.app.post('/api/workers/:workerId/message', async (req, res) => {
      const { workerId } = req.params;
      const { role, content } = req.body;

      const worker = this.workers.get(workerId);
      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      worker.context.conversationHistory.push({
        role,
        content,
        timestamp: new Date(),
        workerId
      });

      worker.lastActive = new Date();
      this.persistWorker(worker);

      res.json({ success: true });
    });

    this.app.post('/api/workers/:workerId/artifact', async (req, res) => {
      const { workerId } = req.params;
      const { filename, content, language } = req.body;

      const worker = this.workers.get(workerId);
      if (!worker) {
        res.status(404).json({ error: 'Worker not found' });
        return;
      }

      const artifact: CodeArtifact = {
        id: crypto.randomUUID(),
        filename,
        content,
        language,
        version: 1,
        workerId,
        timestamp: new Date()
      };

      // Check if artifact exists and increment version
      const existing = worker.context.codeArtifacts.find(a => a.filename === filename);
      if (existing) {
        artifact.version = existing.version + 1;
      }

      worker.context.codeArtifacts.push(artifact);
      this.persistWorker(worker);

      res.json({ success: true, artifact });
    });

    this.app.get('/api/knowledge', async (_req, res) => {
      const allKnowledge: Record<string, any> = {};

      this.workers.forEach(worker => {
        Object.assign(allKnowledge, worker.context.sharedKnowledge);
      });

      res.json({ knowledge: allKnowledge });
    });
  }

  private async createWorker(
    task: string,
    type: WorkerType = 'developer',
    parentContext?: any
  ): Promise<Worker> {
    if (this.workers.size >= this.config.maxWorkers) {
      throw new Error(`Maximum worker limit (${this.config.maxWorkers}) reached`);
    }

    const worker: Worker = {
      id: crypto.randomUUID(),
      name: this.generateWorkerName(task, type),
      type,
      task,
      status: 'active',
      progress: 0,
      createdAt: new Date(),
      lastActive: new Date(),
      children: [],
      context: {
        conversationHistory: [],
        sharedKnowledge: parentContext?.sharedKnowledge || {},
        codeArtifacts: [],
        decisions: []
      }
    };

    this.workers.set(worker.id, worker);
    this.persistWorker(worker);
    this.emit('worker:created', worker);

    this.broadcastUpdate({
      type: 'worker_created',
      data: worker
    });

    return worker;
  }

  private generateWorkerName(task: string, type: WorkerType): string {
    const taskWords = task.toLowerCase().split(' ');
    const descriptors: Record<string, string[]> = {
      developer: ['Builder', 'Developer', 'Engineer', 'Coder'],
      tester: ['Tester', 'QA Engineer', 'Test Specialist'],
      researcher: ['Researcher', 'Analyst', 'Investigator'],
      analyst: ['Analyst', 'Data Scientist', 'Strategist'],
      architect: ['Architect', 'Designer', 'System Planner'],
      reviewer: ['Reviewer', 'Code Auditor', 'Quality Checker'],
      coordinator: ['Coordinator', 'Manager', 'Orchestrator']
    };

    let name = '';

    // Extract key terms
    if (taskWords.includes('api')) {name = 'API ';}
    else if (taskWords.includes('frontend')) {name = 'Frontend ';}
    else if (taskWords.includes('backend')) {name = 'Backend ';}
    else if (taskWords.includes('database')) {name = 'Database ';}
    else if (taskWords.includes('react')) {name = 'React ';}
    else if (taskWords.includes('authentication')) {name = 'Auth ';}
    else if (taskWords.includes('payment')) {name = 'Payment ';}

    const descriptorList = descriptors[type] || descriptors.developer;
    name += descriptorList[Math.floor(Math.random() * descriptorList.length)];

    return name;
  }

  private persistWorker(worker: Worker): void {
    if (!this.config.enablePersistence) {return;}

    const path = join(this.storageDir, 'workers', `${worker.id}.json`);
    writeFileSync(path, JSON.stringify(worker, null, 2));
  }

  private broadcastUpdate(message: any): void {
    if (!this.wss) {return;}

    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  async start(): Promise<void> {
    this.server = this.app.listen(this.config.port, this.config.host, () => {
      console.log(`OrchFlow Core running at http://${this.config.host}:${this.config.port}`);
    });

    if (this.config.enableWebSocket) {
      this.wss = new WebSocketServer({ server: this.server });

      this.wss.on('connection', (ws) => {
        ws.on('message', async (message) => {
          try {
            const data = JSON.parse(message.toString());
            await this.handleWebSocketMessage(ws, data);
          } catch (error) {
            ws.send(JSON.stringify({ error: 'Invalid message format' }));
          }
        });

        // Send initial state
        ws.send(JSON.stringify({
          type: 'initial_state',
          data: {
            workers: Array.from(this.workers.values())
          }
        }));
      });
    }

    // Load persisted workers
    if (this.config.enablePersistence) {
      await this.loadPersistedWorkers();
    }
  }

  private async loadPersistedWorkers(): Promise<void> {
    const workersDir = join(this.storageDir, 'workers');
    if (!existsSync(workersDir)) {return;}

    const files = require('fs').readdirSync(workersDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = readFileSync(join(workersDir, file), 'utf-8');
          const worker = JSON.parse(content);
          // Convert date strings back to Date objects
          worker.createdAt = new Date(worker.createdAt);
          worker.lastActive = new Date(worker.lastActive);
          this.workers.set(worker.id, worker);
        } catch (error) {
          console.error(`Failed to load worker ${file}:`, error);
        }
      }
    }
  }

  private async handleWebSocketMessage(ws: WebSocket, message: any): Promise<void> {
    // Handle request-response pattern
    if (message.id && message.method) {
      try {
        let result;
        switch (message.method) {
          case 'getSessionData':
            result = {
              sessionId: crypto.randomUUID(),
              workers: Array.from(this.workers.values()).map(w => ({
                id: w.id,
                name: w.name,
                type: w.type,
                status: w.status,
                progress: w.progress
              }))
            };
            break;
          
          case 'saveSessionData':
            // Save session data
            result = { success: true };
            break;
            
          case 'listWorkers':
            // Return list of workers
            result = Array.from(this.workers.values()).map(w => ({
              id: w.id,
              name: w.name,
              type: w.type,
              status: w.status,
              progress: w.progress,
              createdAt: w.createdAt,
              lastActive: w.lastActive
            }));
            break;
          
          default:
            throw new Error(`Unknown method: ${message.method}`);
        }
        
        ws.send(JSON.stringify({
          id: message.id,
          result
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          id: message.id,
          error: error.message
        }));
      }
      return;
    }

    // Handle old-style messages
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;

      case 'subscribe':
        // Client wants updates for specific workers
        break;

      case 'update_progress':
        const worker = this.workers.get(message.workerId);
        if (worker) {
          worker.progress = message.progress;
          this.persistWorker(worker);
          this.broadcastUpdate({
            type: 'worker_progress',
            data: { workerId: worker.id, progress: worker.progress }
          });
        }
        break;
    }
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close();
      }

      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }

  async getWorkers(): Promise<Worker[]> {
    return Array.from(this.workers.values());
  }

  async restoreSession(sessionName: string): Promise<void> {
    const sessionPath = join(this.storageDir, 'sessions', `${sessionName}.json`);

    if (!existsSync(sessionPath)) {
      throw new Error(`Session ${sessionName} not found`);
    }

    const stateData = readFileSync(sessionPath, 'utf-8');
    const state = JSON.parse(stateData);

    // Restore workers
    this.workers.clear();
    for (const [id, worker] of state.workers) {
      this.workers.set(id, {
        ...worker,
        createdAt: new Date(worker.createdAt),
        lastActive: new Date(worker.lastActive)
      });
      this.emit('worker:created', worker);
    }

    // Restore shared knowledge
    if (state.sharedKnowledge) {
      Object.assign(this.sharedKnowledge, state.sharedKnowledge);
    }

    this.emit('session:restored', { sessionName, workerCount: this.workers.size });
  }

  async saveSession(sessionName: string): Promise<void> {
    const state = {
      workers: Array.from(this.workers.entries()),
      sharedKnowledge: this.sharedKnowledge,
      sessionId: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };

    const sessionPath = join(this.storageDir, 'sessions', `${sessionName}.json`);
    writeFileSync(sessionPath, JSON.stringify(state, null, 2));

    this.emit('session:saved', { sessionName });
  }
}