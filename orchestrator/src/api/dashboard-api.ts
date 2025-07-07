// Dashboard API endpoints for VS Code-style orchestrator
import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator';
import { AgentManager } from '../agent-manager';
import { outputStreamManager } from '../streaming/output-stream';

export interface DashboardStats {
  agents: {
    total: number;
    running: number;
    failed: number;
    idle: number;
  };
  sessions: {
    active: number;
    duration: number;
  };
  resources: {
    cpu: number;
    memory: number;
    terminalCount: number;
  };
  activity: {
    commandsExecuted: number;
    errors: number;
    lastActivity: Date | null;
  };
}

export class DashboardAPI {
  private router: Router;
  private orchestrator: Orchestrator;
  
  constructor(orchestrator: Orchestrator) {
    this.router = Router();
    this.orchestrator = orchestrator;
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // Dashboard overview
    this.router.get('/dashboard/stats', async (req: Request, res: Response) => {
      try {
        const stats = await this.getDashboardStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Terminal management
    this.router.get('/terminals', async (req: Request, res: Response) => {
      try {
        const agents = await this.orchestrator.listAgents();
        const terminals = agents.map(agent => ({
          id: agent.id,
          name: agent.name,
          type: agent.type,
          status: agent.status,
          terminalId: agent.terminalId,
          command: agent.command,
          createdAt: agent.createdAt,
          lastActivity: agent.lastActivity,
        }));
        res.json(terminals);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.get('/terminals/:id', async (req: Request, res: Response) => {
      try {
        const agent = await this.orchestrator.getAgent(req.params.id);
        if (!agent) {
          return res.status(404).json({ error: 'Terminal not found' });
        }
        res.json(agent);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/terminals/:id/attach', async (req: Request, res: Response) => {
      try {
        const agent = await this.orchestrator.getAgent(req.params.id);
        if (!agent) {
          return res.status(404).json({ error: 'Terminal not found' });
        }
        
        // Return connection info for WebSocket
        res.json({
          wsUrl: `/ws/terminal/${agent.id}`,
          terminalId: agent.terminalId,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/terminals/:id/kill', async (req: Request, res: Response) => {
      try {
        await this.orchestrator.stopAgent(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/terminals/:id/restart', async (req: Request, res: Response) => {
      try {
        const agent = await this.orchestrator.getAgent(req.params.id);
        if (!agent) {
          return res.status(404).json({ error: 'Terminal not found' });
        }
        
        // Stop and recreate
        await this.orchestrator.stopAgent(agent.id);
        const newAgent = await this.orchestrator.createAgent(
          agent.name,
          agent.type,
          agent.command
        );
        
        res.json(newAgent);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Command execution
    this.router.post('/command', async (req: Request, res: Response) => {
      try {
        const { command, agentId } = req.body;
        
        if (agentId) {
          // Send to specific agent
          await this.orchestrator.sendToAgent(agentId, command);
        } else {
          // Execute through router
          const result = await this.orchestrator.execute(command);
          return res.json({ result });
        }
        
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Activity log
    this.router.get('/activity', async (req: Request, res: Response) => {
      try {
        const limit = parseInt(req.query.limit as string) || 100;
        const offset = parseInt(req.query.offset as string) || 0;
        
        // This would need to be implemented in the orchestrator
        const activity = []; // Placeholder
        
        res.json({
          items: activity,
          total: activity.length,
          limit,
          offset,
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Layout management
    this.router.get('/layouts/templates', (req: Request, res: Response) => {
      try {
        const templates = this.orchestrator.getLayoutTemplates();
        res.json(templates);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/layouts/apply', async (req: Request, res: Response) => {
      try {
        const { templateId, customizations } = req.body;
        const layout = await this.orchestrator.createLayout(templateId, customizations);
        res.json(layout);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/layouts/save', async (req: Request, res: Response) => {
      try {
        const template = req.body;
        this.orchestrator.saveLayoutTemplate(template);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // Tab management
    this.router.get('/tabs', (req: Request, res: Response) => {
      try {
        const tabs = this.orchestrator.getTabs();
        res.json(tabs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.post('/tabs', async (req: Request, res: Response) => {
      try {
        const tab = this.orchestrator.createTab(req.body);
        res.json(tab);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.put('/tabs/:id/activate', (req: Request, res: Response) => {
      try {
        this.orchestrator.activateTab(req.params.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.delete('/tabs/:id', (req: Request, res: Response) => {
      try {
        const force = req.query.force === 'true';
        const closed = this.orchestrator.closeTab(req.params.id, force);
        res.json({ success: closed });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // System information
    this.router.get('/system/status', async (req: Request, res: Response) => {
      try {
        const status = await this.orchestrator.getStatus();
        res.json(status);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    this.router.get('/system/features', (req: Request, res: Response) => {
      try {
        const status = this.orchestrator.getStatus();
        res.json({
          enabled: status.features,
          available: [
            'core', 'websocket', 'sessions', 'protocols', 'cache',
            'modes', 'circuit-breakers', 'resources', 'memory',
            'metrics', 'scheduler', 'terminal-pool', 'mcp',
            'swarm', 'gui'
          ],
        });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
  
  private async getDashboardStats(): Promise<DashboardStats> {
    const agents = await this.orchestrator.listAgents();
    const status = await this.orchestrator.getStatus();
    
    const agentStats = {
      total: agents.length,
      running: agents.filter(a => a.status === 'running' || a.status === 'busy').length,
      failed: agents.filter(a => a.status === 'failed').length,
      idle: agents.filter(a => a.status === 'idle').length,
    };
    
    const sessionStats = {
      active: status.session ? 1 : 0,
      duration: status.session ? Date.now() - status.session.startTime.getTime() : 0,
    };
    
    const resourceStats = {
      cpu: process.cpuUsage().user / 1000000,
      memory: process.memoryUsage().heapUsed / 1024 / 1024,
      terminalCount: agents.length,
    };
    
    const activityStats = {
      commandsExecuted: 0, // Would need to track this
      errors: 0, // Would need to track this
      lastActivity: agents.length > 0 
        ? agents.reduce((latest, agent) => 
            agent.lastActivity && agent.lastActivity > latest ? agent.lastActivity : latest,
            new Date(0)
          )
        : null,
    };
    
    return {
      agents: agentStats,
      sessions: sessionStats,
      resources: resourceStats,
      activity: activityStats,
    };
  }
  
  getRouter(): Router {
    return this.router;
  }
}