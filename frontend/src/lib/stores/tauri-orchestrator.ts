import { writable, get } from 'svelte/store';
import { tmux } from '$lib/tauri/tmux';
import type { Tab } from '$lib/types';

// Import existing stores
import { tabs, activeTabId } from './orchestrator';

let sessionName = 'orchflow-main';
let tabCounter = 0;

// Initialize tmux session on load
async function initializeTmux() {
  try {
    // Create or ensure main session exists
    const sessions = await tmux.listSessions();
    if (!sessions.find(s => s.name === sessionName)) {
      await tmux.createSession(sessionName);
    }
  } catch (error) {
    console.error('Failed to initialize tmux:', error);
  }
}

// Create a new terminal tab using tmux
export async function createTauriTerminal(title: string, command?: string): Promise<Tab> {
  try {
    // Create tmux pane
    const pane = await tmux.createPane(sessionName, command);
    
    // Create tab
    const tab: Tab = {
      id: `tab-${++tabCounter}`,
      type: 'terminal',
      title: title || `Terminal ${tabCounter}`,
      metadata: {
        paneId: pane.id,
        command: command,
      }
    };
    
    // Add to tabs
    tabs.update(t => [...t, tab]);
    activeTabId.set(tab.id);
    
    return tab;
  } catch (error) {
    console.error('Failed to create terminal:', error);
    throw error;
  }
}

// Create a file tab (placeholder for now)
export function createFileTab(filePath: string): Tab {
  const tab: Tab = {
    id: `tab-${++tabCounter}`,
    type: 'file',
    title: filePath.split('/').pop() || 'Untitled',
    metadata: {
      filePath,
    }
  };
  
  tabs.update(t => [...t, tab]);
  activeTabId.set(tab.id);
  
  return tab;
}

// Create a dashboard tab
export function createDashboardTab(): Tab {
  // Check if dashboard already exists
  const existingDashboard = get(tabs).find(t => t.type === 'dashboard');
  if (existingDashboard) {
    activeTabId.set(existingDashboard.id);
    return existingDashboard;
  }
  
  const tab: Tab = {
    id: `tab-${++tabCounter}`,
    type: 'dashboard',
    title: 'Dashboard',
    icon: '📊',
  };
  
  tabs.update(t => [...t, tab]);
  activeTabId.set(tab.id);
  
  return tab;
}

// Open a file in the editor
export function openFile(filePath: string): Tab {
  // Check if file is already open
  const existingTab = get(tabs).find(t => t.type === 'file' && t.metadata?.filePath === filePath);
  if (existingTab) {
    activeTabId.set(existingTab.id);
    return existingTab;
  }
  
  return createFileTab(filePath);
}

// Initialize on import
if (typeof window !== 'undefined' && '__TAURI__' in window) {
  initializeTmux();
}