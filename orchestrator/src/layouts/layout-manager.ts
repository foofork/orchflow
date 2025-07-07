// Layout Manager for VS Code-style tmux orchestration
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { TerminalAdapter } from '../terminal/terminal-adapter';
import { AgentManager } from '../agent-manager';
import { randomUUID } from 'crypto';

export interface PanePosition {
  row: number;
  col: number;
  width: number;  // percentage
  height: number; // percentage
}

export interface PaneConfig {
  id?: string;
  agentType?: string;
  command?: string;
  title?: string;
  position: 'main' | 'bottom' | 'bottom-left' | 'bottom-right' | 'side' | PanePosition;
  size?: string; // e.g., '30%', '50%'
  tags?: string[];
}

export interface LayoutTemplate {
  id: string;
  name: string;
  description?: string;
  panes: PaneConfig[];
  defaultAgent?: string;
  metadata?: Record<string, any>;
}

export interface SessionLayout {
  sessionId: string;
  templateId?: string;
  panes: Map<string, PaneState>;
  activePane?: string;
  createdAt: Date;
  modifiedAt: Date;
}

export interface PaneState {
  id: string;
  paneId: string; // tmux pane ID
  agentId?: string;
  title: string;
  position: PanePosition;
  isVisible: boolean;
  isFocused: boolean;
  command?: string;
  output?: string;
  lastActivity: Date;
  tags: string[];
}

export class LayoutManager {
  private layouts: Map<string, SessionLayout> = new Map();
  private templates: Map<string, LayoutTemplate> = new Map();
  private adapter: TerminalAdapter;
  private agentManager: AgentManager;
  
  constructor(adapter: TerminalAdapter, agentManager: AgentManager) {
    this.adapter = adapter;
    this.agentManager = agentManager;
    this.loadDefaultTemplates();
  }
  
  private loadDefaultTemplates(): void {
    // VS Code-style development layout
    this.templates.set('dev-workspace', {
      id: 'dev-workspace',
      name: 'Development Workspace',
      description: 'Standard development layout with editor, server, and logs',
      panes: [
        {
          position: 'main',
          agentType: 'editor',
          command: 'nvim .',
          title: 'Editor',
          tags: ['editor', 'primary'],
        },
        {
          position: 'bottom-left',
          size: '30%',
          agentType: 'dev-server',
          command: 'npm run dev',
          title: 'Dev Server',
          tags: ['server', 'development'],
        },
        {
          position: 'bottom-right',
          size: '30%',
          agentType: 'logger',
          command: 'tail -f logs/output.log',
          title: 'Logs',
          tags: ['monitoring', 'logs'],
        },
      ],
    });
    
    // Test-driven development layout
    this.templates.set('tdd-workspace', {
      id: 'tdd-workspace',
      name: 'TDD Workspace',
      description: 'Test-driven development with editor and test runner',
      panes: [
        {
          position: 'main',
          agentType: 'editor',
          command: 'nvim .',
          title: 'Editor',
          tags: ['editor', 'primary'],
        },
        {
          position: 'side',
          size: '40%',
          agentType: 'test-runner',
          command: 'npm test -- --watch',
          title: 'Tests',
          tags: ['testing', 'tdd'],
        },
        {
          position: 'bottom',
          size: '20%',
          agentType: 'repl',
          command: 'node',
          title: 'REPL',
          tags: ['repl', 'interactive'],
        },
      ],
    });
    
    // Data science layout
    this.templates.set('data-science', {
      id: 'data-science',
      name: 'Data Science Workspace',
      description: 'Jupyter-style layout for data analysis',
      panes: [
        {
          position: 'main',
          agentType: 'notebook',
          command: 'jupyter notebook',
          title: 'Notebook',
          tags: ['notebook', 'primary'],
        },
        {
          position: 'bottom',
          size: '30%',
          agentType: 'python-repl',
          command: 'python',
          title: 'Python REPL',
          tags: ['repl', 'python'],
        },
        {
          position: 'side',
          size: '30%',
          agentType: 'data-explorer',
          command: 'watch -n 1 "df -h"',
          title: 'Resources',
          tags: ['monitoring', 'resources'],
        },
      ],
    });
  }
  
  async createLayout(
    sessionId: string,
    templateId: string,
    customizations?: Partial<LayoutTemplate>
  ): Promise<SessionLayout> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }
    
    // Merge customizations
    const finalTemplate = customizations
      ? { ...template, ...customizations, panes: [...template.panes] }
      : template;
    
    const layout: SessionLayout = {
      sessionId,
      templateId,
      panes: new Map(),
      createdAt: new Date(),
      modifiedAt: new Date(),
    };
    
    // Create panes according to template
    for (const paneConfig of finalTemplate.panes) {
      const paneState = await this.createPane(sessionId, paneConfig);
      layout.panes.set(paneState.id, paneState);
    }
    
    // Set first pane as active
    if (layout.panes.size > 0) {
      layout.activePane = Array.from(layout.panes.keys())[0];
    }
    
    this.layouts.set(sessionId, layout);
    
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    
    return layout;
  }
  
  private async createPane(
    sessionId: string,
    config: PaneConfig
  ): Promise<PaneState> {
    const id = config.id || `pane-${randomUUID()}`;
    const position = this.resolvePosition(config.position, config.size);
    
    // Create tmux pane
    const paneId = await this.adapter.createPane(sessionId, config.command);
    
    // Create agent if specified
    let agentId: string | undefined;
    if (config.agentType) {
      const agent = await this.agentManager.createAgent({
        name: config.title || config.agentType,
        type: config.agentType as any,
        command: config.command,
        terminalId: paneId,
      });
      agentId = agent.id;
    }
    
    const paneState: PaneState = {
      id,
      paneId,
      agentId,
      title: config.title || config.agentType || 'Terminal',
      position,
      isVisible: true,
      isFocused: false,
      command: config.command,
      lastActivity: new Date(),
      tags: config.tags || [],
    };
    
    return paneState;
  }
  
  private resolvePosition(
    position: PaneConfig['position'],
    size?: string
  ): PanePosition {
    if (typeof position === 'object') {
      return position;
    }
    
    // Convert named positions to coordinates
    switch (position) {
      case 'main':
        return { row: 0, col: 0, width: 100, height: 70 };
      case 'bottom':
        return { row: 70, col: 0, width: 100, height: 30 };
      case 'bottom-left':
        return { row: 70, col: 0, width: 50, height: 30 };
      case 'bottom-right':
        return { row: 70, col: 50, width: 50, height: 30 };
      case 'side':
        return { row: 0, col: 70, width: 30, height: 100 };
      default:
        return { row: 0, col: 0, width: 100, height: 100 };
    }
  }
  
  async focusPane(sessionId: string, paneId: string): Promise<void> {
    const layout = this.layouts.get(sessionId);
    if (!layout) return;
    
    // Update focus state
    for (const [id, pane] of layout.panes) {
      pane.isFocused = id === paneId;
    }
    
    layout.activePane = paneId;
    layout.modifiedAt = new Date();
    
    EventBus.emit(OrchflowEvents.FILE_OPENED, { filePath: paneId });
  }
  
  async resizePane(
    sessionId: string,
    paneId: string,
    newPosition: Partial<PanePosition>
  ): Promise<void> {
    const layout = this.layouts.get(sessionId);
    if (!layout) return;
    
    const pane = layout.panes.get(paneId);
    if (!pane) return;
    
    pane.position = { ...pane.position, ...newPosition };
    pane.lastActivity = new Date();
    layout.modifiedAt = new Date();
    
    // TODO: Apply resize to actual tmux pane
  }
  
  async addPane(
    sessionId: string,
    config: PaneConfig
  ): Promise<PaneState> {
    const layout = this.layouts.get(sessionId);
    if (!layout) {
      throw new Error(`Layout for session ${sessionId} not found`);
    }
    
    const paneState = await this.createPane(sessionId, config);
    layout.panes.set(paneState.id, paneState);
    layout.modifiedAt = new Date();
    
    return paneState;
  }
  
  async removePane(sessionId: string, paneId: string): Promise<void> {
    const layout = this.layouts.get(sessionId);
    if (!layout) return;
    
    const pane = layout.panes.get(paneId);
    if (!pane) return;
    
    // Kill the tmux pane
    await this.adapter.killPane(pane.paneId);
    
    // Stop the agent if exists
    if (pane.agentId) {
      await this.agentManager.stopAgent(pane.agentId);
    }
    
    layout.panes.delete(paneId);
    layout.modifiedAt = new Date();
  }
  
  getLayout(sessionId: string): SessionLayout | undefined {
    return this.layouts.get(sessionId);
  }
  
  getTemplates(): LayoutTemplate[] {
    return Array.from(this.templates.values());
  }
  
  saveTemplate(template: LayoutTemplate): void {
    this.templates.set(template.id, template);
  }
  
  exportLayout(sessionId: string): LayoutTemplate | null {
    const layout = this.layouts.get(sessionId);
    if (!layout) return null;
    
    const panes: PaneConfig[] = Array.from(layout.panes.values()).map(pane => ({
      title: pane.title,
      position: pane.position,
      command: pane.command,
      tags: pane.tags,
    }));
    
    return {
      id: `exported-${Date.now()}`,
      name: `Exported from ${sessionId}`,
      panes,
    };
  }
}