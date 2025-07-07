// Tab Manager for VS Code-style file and terminal tabs
import { EventBus, OrchflowEvents } from '../core/event-bus';
import { Agent } from '../agent-manager';
import { PaneState } from '../layouts/layout-manager';

export type TabType = 'file' | 'terminal' | 'dashboard' | 'preview' | 'output';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  icon?: string;
  path?: string; // for file tabs
  agentId?: string; // for terminal tabs
  paneId?: string; // for terminal tabs
  isDirty?: boolean;
  isPinned?: boolean;
  isActive?: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  lastAccessedAt: Date;
}

export interface TabGroup {
  id: string;
  tabs: Tab[];
  activeTabId?: string;
  position: 'main' | 'side' | 'bottom';
}

export class TabManager {
  private tabs: Map<string, Tab> = new Map();
  private groups: Map<string, TabGroup> = new Map();
  private activeGroupId?: string;
  private tabHistory: string[] = []; // For alt+tab style switching
  
  constructor() {
    this.setupEventHandlers();
    this.createDefaultGroup();
  }
  
  private createDefaultGroup(): void {
    const mainGroup: TabGroup = {
      id: 'main',
      tabs: [],
      position: 'main',
    };
    this.groups.set('main', mainGroup);
    this.activeGroupId = 'main';
  }
  
  private setupEventHandlers(): void {
    // Auto-create tabs for agents
    EventBus.on(OrchflowEvents.AGENT_CREATED, ({ agentId, name, type }) => {
      if (type !== 'file') { // File agents are handled separately
        this.createTerminalTab({
          agentId,
          title: name,
          type: 'terminal',
        });
      }
    });
    
    // Remove tabs when agents stop
    EventBus.on(OrchflowEvents.AGENT_STOPPED, ({ agentId }) => {
      const tab = this.findTabByAgentId(agentId);
      if (tab && !tab.isPinned) {
        this.closeTab(tab.id);
      }
    });
    
    // Create file tabs
    EventBus.on(OrchflowEvents.FILE_OPENED, ({ filePath }) => {
      this.createFileTab(filePath);
    });
  }
  
  createFileTab(filePath: string): Tab {
    // Check if tab already exists
    const existingTab = this.findTabByPath(filePath);
    if (existingTab) {
      this.activateTab(existingTab.id);
      return existingTab;
    }
    
    const fileName = filePath.split('/').pop() || 'untitled';
    const tab: Tab = {
      id: `file-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'file',
      title: fileName,
      path: filePath,
      icon: this.getFileIcon(fileName),
      isDirty: false,
      isPinned: false,
      isActive: false,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };
    
    this.addTab(tab);
    return tab;
  }
  
  createTerminalTab(options: {
    agentId?: string;
    paneId?: string;
    title: string;
    type?: 'terminal' | 'output';
  }): Tab {
    const tab: Tab = {
      id: `terminal-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: options.type || 'terminal',
      title: options.title,
      agentId: options.agentId,
      paneId: options.paneId,
      icon: this.getTerminalIcon(options.title),
      isDirty: false,
      isPinned: false,
      isActive: false,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };
    
    this.addTab(tab);
    return tab;
  }
  
  createDashboardTab(title: string, metadata?: Record<string, any>): Tab {
    const tab: Tab = {
      id: `dashboard-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      type: 'dashboard',
      title,
      icon: '📊',
      isDirty: false,
      isPinned: true, // Dashboards are usually pinned
      isActive: false,
      metadata,
      createdAt: new Date(),
      lastAccessedAt: new Date(),
    };
    
    this.addTab(tab);
    return tab;
  }
  
  private addTab(tab: Tab, groupId: string = 'main'): void {
    this.tabs.set(tab.id, tab);
    
    const group = this.groups.get(groupId);
    if (group) {
      group.tabs.push(tab);
      this.activateTab(tab.id);
    }
    
    EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
  }
  
  activateTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    
    // Deactivate all tabs in the same group
    const group = this.findGroupByTabId(tabId);
    if (group) {
      group.tabs.forEach(t => {
        const tabData = this.tabs.get(t.id);
        if (tabData) {
          tabData.isActive = false;
        }
      });
      group.activeTabId = tabId;
    }
    
    // Activate the selected tab
    tab.isActive = true;
    tab.lastAccessedAt = new Date();
    
    // Update history
    this.tabHistory = this.tabHistory.filter(id => id !== tabId);
    this.tabHistory.unshift(tabId);
    if (this.tabHistory.length > 20) {
      this.tabHistory = this.tabHistory.slice(0, 20);
    }
    
    // Emit appropriate event
    if (tab.type === 'file' && tab.path) {
      EventBus.emit(OrchflowEvents.FILE_OPENED, { filePath: tab.path });
    }
  }
  
  closeTab(tabId: string, force: boolean = false): boolean {
    const tab = this.tabs.get(tabId);
    if (!tab) return false;
    
    // Check if tab can be closed
    if (!force && tab.isDirty) {
      return false; // Would need user confirmation
    }
    
    if (!force && tab.isPinned) {
      return false;
    }
    
    // Find and remove from group
    const group = this.findGroupByTabId(tabId);
    if (group) {
      const index = group.tabs.findIndex(t => t.id === tabId);
      if (index !== -1) {
        group.tabs.splice(index, 1);
        
        // Activate previous tab if this was active
        if (group.activeTabId === tabId && group.tabs.length > 0) {
          const nextTab = group.tabs[Math.min(index, group.tabs.length - 1)];
          this.activateTab(nextTab.id);
        }
      }
    }
    
    // Clean up
    this.tabs.delete(tabId);
    this.tabHistory = this.tabHistory.filter(id => id !== tabId);
    
    // Clean up associated resources
    if (tab.agentId) {
      // Note: We don't kill the agent here - closing tab just removes view
      EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    }
    
    return true;
  }
  
  renameTab(tabId: string, newTitle: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.title = newTitle;
      EventBus.emit(OrchflowEvents.SYSTEM_READY, undefined);
    }
  }
  
  pinTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isPinned = true;
      
      // Move to beginning of group
      const group = this.findGroupByTabId(tabId);
      if (group) {
        const index = group.tabs.findIndex(t => t.id === tabId);
        if (index > 0) {
          const [removed] = group.tabs.splice(index, 1);
          group.tabs.unshift(removed);
        }
      }
    }
  }
  
  unpinTab(tabId: string): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isPinned = false;
    }
  }
  
  markDirty(tabId: string, isDirty: boolean = true): void {
    const tab = this.tabs.get(tabId);
    if (tab) {
      tab.isDirty = isDirty;
      EventBus.emit(OrchflowEvents.FILE_SAVED, { filePath: tab.path || '' });
    }
  }
  
  // Navigation methods
  switchToPreviousTab(): void {
    if (this.tabHistory.length > 1) {
      this.activateTab(this.tabHistory[1]);
    }
  }
  
  switchToTabByIndex(index: number, groupId: string = 'main'): void {
    const group = this.groups.get(groupId);
    if (group && index >= 0 && index < group.tabs.length) {
      this.activateTab(group.tabs[index].id);
    }
  }
  
  // Query methods
  getTabs(groupId?: string): Tab[] {
    if (groupId) {
      const group = this.groups.get(groupId);
      return group ? group.tabs.map(t => this.tabs.get(t.id)!).filter(Boolean) : [];
    }
    return Array.from(this.tabs.values());
  }
  
  getActiveTab(groupId: string = 'main'): Tab | undefined {
    const group = this.groups.get(groupId);
    if (group && group.activeTabId) {
      return this.tabs.get(group.activeTabId);
    }
    return undefined;
  }
  
  findTabByPath(path: string): Tab | undefined {
    return Array.from(this.tabs.values()).find(tab => tab.path === path);
  }
  
  findTabByAgentId(agentId: string): Tab | undefined {
    return Array.from(this.tabs.values()).find(tab => tab.agentId === agentId);
  }
  
  findTabByPaneId(paneId: string): Tab | undefined {
    return Array.from(this.tabs.values()).find(tab => tab.paneId === paneId);
  }
  
  private findGroupByTabId(tabId: string): TabGroup | undefined {
    for (const group of this.groups.values()) {
      if (group.tabs.some(t => t.id === tabId)) {
        return group;
      }
    }
    return undefined;
  }
  
  // Icon helpers
  private getFileIcon(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'ts': '📘',
      'js': '📙',
      'jsx': '⚛️',
      'tsx': '⚛️',
      'py': '🐍',
      'rs': '🦀',
      'go': '🐹',
      'md': '📝',
      'json': '📋',
      'yml': '⚙️',
      'yaml': '⚙️',
      'html': '🌐',
      'css': '🎨',
      'scss': '🎨',
    };
    return iconMap[ext || ''] || '📄';
  }
  
  private getTerminalIcon(title: string): string {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('server') || lowerTitle.includes('dev')) return '🚀';
    if (lowerTitle.includes('test')) return '🧪';
    if (lowerTitle.includes('log')) return '📜';
    if (lowerTitle.includes('repl')) return '💻';
    if (lowerTitle.includes('build')) return '🔨';
    return '🖥️';
  }
  
  // Serialization for state persistence
  serialize(): any {
    return {
      tabs: Array.from(this.tabs.entries()),
      groups: Array.from(this.groups.entries()),
      activeGroupId: this.activeGroupId,
      tabHistory: this.tabHistory,
    };
  }
  
  deserialize(data: any): void {
    if (data.tabs) {
      this.tabs = new Map(data.tabs);
    }
    if (data.groups) {
      this.groups = new Map(data.groups);
    }
    this.activeGroupId = data.activeGroupId;
    this.tabHistory = data.tabHistory || [];
  }
}