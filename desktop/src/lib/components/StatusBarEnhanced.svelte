<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { derived, writable } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/core';
  import type { UnlistenFn } from '@tauri-apps/api/event';
  import { listen } from '@tauri-apps/api/event';
  import type { SystemMetrics } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  interface StatusItem {
    id: string;
    icon?: string;
    text: string;
    tooltip?: string;
    onClick?: () => void;
    priority?: number;
    align?: 'left' | 'right';
  }
  
  interface GitInfo {
    branch?: string;
    ahead?: number;
    behind?: number;
    modified?: number;
    staged?: number;
    untracked?: number;
  }
  
  interface LocalSystemMetrics {
    cpu?: number;
    memory?: number;
    disk?: number;
  }
  
  // Props
  export let showGitStatus = true;
  export let showSystemMetrics = true;
  export let showNotifications = true;
  export let customItems: StatusItem[] = [];
  export let theme: 'light' | 'dark' = 'dark';
  export let currentFile: { path: string; line: number; column: number } | null = null;
  export let encoding: string = 'UTF-8';
  export let language: string = '';
  export let runningProcesses: number = 0;
  export let activePlugins: number = 0;
  export let backgroundTasks: Array<{ id: string; name: string; progress: number }> = [];
  export let notifications: Array<{ id: string; type: string; message: string }> = [];
  export const onGitClick: (() => void) | undefined = undefined; // External reference only
  export const onFileClick: (() => void) | undefined = undefined; // External reference only
  export let testMode = false;
  export let autoLoad = true;
  export let initialGitInfo: GitInfo | null = null;
  export let initialSystemMetrics: SystemMetrics | null = null;
  export let updateInterval = 5000;
  
  // State
  let gitInfo = writable<GitInfo>({});
  let systemMetrics = writable<SystemMetrics | null>(null);
  let notificationsList = writable<string[]>([]);
  let activeFile = writable<string>(currentFile?.path || '');
  let cursorPosition = writable<{ line: number; column: number }>({ 
    line: currentFile?.line || 1, 
    column: currentFile?.column || 1 
  });
  let encodingValue = writable<string>(encoding);
  let fileType = writable<string>(language);
  let errors = writable<number>(0);
  let warnings = writable<number>(0);
  let running = writable<boolean>(false);
  
  // Update reactive values when props change
  $: if (currentFile) {
    activeFile.set(currentFile.path);
    cursorPosition.set({ line: currentFile.line, column: currentFile.column });
  } else {
    activeFile.set('');
    cursorPosition.set({ line: 1, column: 1 });
  }
  
  $: encodingValue.set(encoding);
  $: fileType.set(language);
  let currentTime = writable<string>('');
  
  // Event listeners
  let unlisteners: UnlistenFn[] = [];
  let updateIntervalId: number | null = null;
  
  // Test mode initialization
  $: if (testMode) {
    if (initialGitInfo) {
      gitInfo.set(initialGitInfo);
    }
    if (initialSystemMetrics) {
      systemMetrics.set(initialSystemMetrics);
    }
  }
  
  // Status items
  const leftItems = derived(
    [gitInfo, activeFile, cursorPosition, errors, warnings],
    ([$git, $file, $cursor, $errors, $warnings]) => {
      const items: StatusItem[] = [];
      
      // Git status
      if (showGitStatus && $git.branch) {
        let gitText = `🌿 ${$git.branch}`;
        let gitTooltip = `Branch: ${$git.branch}`;
        
        if ($git.ahead || $git.behind) {
          gitText += ` (↑${$git.ahead || 0} ↓${$git.behind || 0})`;
          gitTooltip += `\nAhead: ${$git.ahead || 0}, Behind: ${$git.behind || 0}`;
        }
        
        const changes = [];
        if ($git.modified) changes.push(`${$git.modified}M`);
        if ($git.staged) changes.push(`${$git.staged}S`);
        if ($git.untracked) changes.push(`${$git.untracked}U`);
        
        if (changes.length > 0) {
          gitText += ` [${changes.join(' ')}]`;
          gitTooltip += `\nChanges: ${changes.join(', ')}`;
        }
        
        items.push({
          id: 'git',
          text: gitText,
          tooltip: gitTooltip,
          onClick: () => dispatch('action', { type: 'showGit' })
        });
      }
      
      // Active file
      if ($file) {
        const fileName = $file.split('/').pop() || $file;
        items.push({
          id: 'file',
          text: `📄 ${fileName}`,
          tooltip: $file,
          onClick: () => dispatch('action', { type: 'revealInExplorer', path: $file })
        });
      }
      
      // Cursor position
      items.push({
        id: 'cursor',
        text: `Ln ${$cursor.line}, Col ${$cursor.column}`,
        tooltip: 'Go to line',
        onClick: () => dispatch('action', { type: 'goToLine' })
      });
      
      // Problems
      if ($errors > 0 || $warnings > 0) {
        const problemsText = [];
        if ($errors > 0) problemsText.push(`❌ ${$errors}`);
        if ($warnings > 0) problemsText.push(`⚠️ ${$warnings}`);
        
        items.push({
          id: 'problems',
          text: problemsText.join(' '),
          tooltip: `${$errors} errors, ${$warnings} warnings`,
          onClick: () => dispatch('action', { type: 'showProblems' })
        });
      }
      
      return items;
    }
  );
  
  const rightItems = derived(
    [systemMetrics, notificationsList, encodingValue, fileType, running, currentTime],
    ([$metrics, $notifs, $enc, $type, $run, $time]) => {
      const items: StatusItem[] = [];
      
      // Running processes
      if (runningProcesses > 0) {
        items.push({
          id: 'processes',
          text: `${runningProcesses} running`,
          tooltip: `${runningProcesses} processes running`,
          onClick: () => dispatch('action', { type: 'showProcesses' })
        });
      }
      
      // Active plugins
      if (activePlugins > 0) {
        items.push({
          id: 'plugins',
          text: `${activePlugins} plugins`,
          tooltip: `${activePlugins} active plugins`,
          onClick: () => dispatch('action', { type: 'showPlugins' })
        });
      }
      
      // Background tasks
      backgroundTasks.forEach(task => {
        items.push({
          id: `task-${task.id}`,
          text: `${task.name} ${task.progress}%`,
          tooltip: `Background task: ${task.name}`,
          onClick: () => dispatch('action', { type: 'showTask', taskId: task.id })
        });
      });
      
      // Running indicator
      if ($run) {
        items.push({
          id: 'running',
          text: '⚡ Running',
          tooltip: 'Process is running',
          onClick: () => dispatch('action', { type: 'showOutput' })
        });
      }
      
      // Notifications
      if (showNotifications && (notifications.length > 0 || $notifs.length > 0)) {
        const notifCount = notifications.length || $notifs.length;
        items.push({
          id: 'notifications',
          text: `🔔 ${notifCount}`,
          tooltip: `${notifCount} notifications`,
          onClick: () => dispatch('action', { type: 'showNotifications' })
        });
      }
      
      // File type
      if ($type) {
        items.push({
          id: 'filetype',
          text: $type,
          tooltip: 'Select language mode',
          onClick: () => dispatch('action', { type: 'selectLanguageMode' })
        });
      }
      
      // Encoding
      items.push({
        id: 'encoding',
        text: $enc,
        tooltip: 'Select encoding',
        onClick: () => dispatch('action', { type: 'selectEncoding' })
      });
      
      // System metrics
      if (showSystemMetrics && $metrics) {
        if ($metrics.cpu !== undefined) {
          items.push({
            id: 'cpu',
            text: `CPU: ${($metrics.cpu.usage || 0).toFixed(0)}%`,
            tooltip: 'CPU usage',
            onClick: () => dispatch('action', { type: 'showSystemMonitor' })
          });
        }
        
        if ($metrics.memory !== undefined) {
          items.push({
            id: 'memory',
            text: `Mem: ${($metrics.memory.percent || 0).toFixed(0)}%`,
            tooltip: 'Memory usage',
            onClick: () => dispatch('action', { type: 'showSystemMonitor' })
          });
        }
      }
      
      // Clock
      if ($time) {
        items.push({
          id: 'clock',
          text: $time,
          tooltip: new Date().toLocaleDateString()
        });
      }
      
      // Add custom items
      return [...items, ...customItems.filter(item => item.align === 'right')];
    }
  );
  
  // Update functions
  async function updateGitStatus() {
    if (!showGitStatus || testMode) return;
    
    try {
      const [branchInfo, statuses] = await Promise.all([
        invoke('get_git_branch_info'),
        invoke('get_all_git_statuses')
      ]);
      
      if (branchInfo) {
        const info = branchInfo as any;
        const statusMap = statuses as Record<string, any>;
        
        let modified = 0;
        let staged = 0;
        let untracked = 0;
        
        Object.values(statusMap).forEach((status: any) => {
          if (status.status === 'modified') modified++;
          if (status.staged) staged++;
          if (status.status === 'untracked') untracked++;
        });
        
        gitInfo.set({
          branch: info.branch,
          ahead: info.ahead,
          behind: info.behind,
          modified,
          staged,
          untracked
        });
      }
    } catch (err) {
      console.error('Failed to get git status:', err);
    }
  }
  
  async function updateSystemMetrics() {
    if (!showSystemMetrics || testMode) return;
    
    try {
      const metrics = await invoke('get_system_metrics');
      if (metrics && typeof metrics === 'object') {
        systemMetrics.set({
          timestamp: Date.now(),
          cpu: { usage: (metrics as any).cpu_usage || 0, frequency: 0, cores: 1 },
          memory: { total: 0, used: 0, free: 0, available: 0, percent: (metrics as any).memory_usage || 0 },
          disk: { total: 0, used: 0, free: 0, percent: (metrics as any).disk_usage || 0 },
          network: { bytesReceived: 0, bytesSent: 0, packetsReceived: 0, packetsSent: 0 },
          processes: [],
          uptime: 0,
          loadAverage: [0, 0, 0]
        });
      }
    } catch (err) {
      console.error('Failed to get system metrics:', err);
    }
  }
  
  function updateClock() {
    if (testMode) {
      currentTime.set('12:34');
      return;
    }
    
    const now = new Date();
    currentTime.set(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }
  
  // Handle item clicks
  function handleItemClick(item: StatusItem) {
    if (item.onClick) {
      item.onClick();
    }
  }
  
  // Lifecycle
  onMount(async () => {
    if (testMode) {
      // In test mode, just update the clock
      updateClock();
      return;
    }
    
    if (!autoLoad) return;
    
    // Initial updates
    updateGitStatus();
    updateSystemMetrics();
    updateClock();
    
    // Set up periodic updates
    updateIntervalId = setInterval(() => {
      updateGitStatus();
      updateSystemMetrics();
      updateClock();
    }, updateInterval) as unknown as number;
    
    // Listen for events
    try {
      unlisteners.push(
        await listen('file-changed', () => updateGitStatus()),
        await listen('active-file-changed', (event) => {
          activeFile.set(event.payload as string);
        }),
        await listen('cursor-position-changed', (event) => {
          cursorPosition.set(event.payload as { line: number; column: number });
        }),
        await listen('file-type-changed', (event) => {
          fileType.set(event.payload as string);
        }),
        await listen('problems-updated', (event) => {
          const { errors: e, warnings: w } = event.payload as any;
          errors.set(e || 0);
          warnings.set(w || 0);
        }),
        await listen('notification', (event) => {
          notificationsList.update(n => [...n, event.payload as string]);
        }),
        await listen('process-started', () => running.set(true)),
        await listen('process-stopped', () => running.set(false))
      );
    } catch (err) {
      console.error('Failed to set up event listeners:', err);
    }
  });
  
  onDestroy(() => {
    if (updateIntervalId) {
      clearInterval(updateIntervalId);
    }
    unlisteners.forEach(unlisten => unlisten());
  });
  
  // Merge all items
  $: allLeftItems = [...$leftItems, ...customItems.filter(item => item.align !== 'right')];
  $: allRightItems = $rightItems;
</script>

<div class="status-bar fixed bottom-0 left-0 right-0 {theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'}">
  <div class="status-section left">
    {#each allLeftItems as item (item.id)}
      <button
        class="status-item"
        class:clickable={!!item.onClick}
        title={item.tooltip}
        on:click={() => handleItemClick(item)}
      >
        {#if item.icon}
          <span class="item-icon">{item.icon}</span>
        {/if}
        <span class="item-text">{item.text}</span>
      </button>
    {/each}
  </div>
  
  <div class="status-section right">
    {#each allRightItems as item (item.id)}
      <button
        class="status-item"
        class:clickable={!!item.onClick}
        title={item.tooltip}
        on:click={() => handleItemClick(item)}
      >
        {#if item.icon}
          <span class="item-icon">{item.icon}</span>
        {/if}
        <span class="item-text">{item.text}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .status-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: var(--status-bar-height, 22px);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 0 12px;
    font-size: 12px;
    color: var(--fg-secondary);
    user-select: none;
  }
  
  .status-section {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 100%;
  }
  
  .status-section.left {
    flex: 1;
    justify-content: flex-start;
  }
  
  .status-section.right {
    justify-content: flex-end;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 100%;
    padding: 0 8px;
    background: none;
    border: none;
    color: inherit;
    font-size: inherit;
    font-family: inherit;
    cursor: default;
    transition: all 0.15s ease;
    position: relative;
  }
  
  .status-item.clickable {
    cursor: pointer;
  }
  
  .status-item.clickable:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .status-item.clickable:active {
    background: var(--bg-active);
  }
  
  .item-icon {
    font-size: 14px;
    line-height: 1;
  }
  
  .item-text {
    white-space: nowrap;
  }
  
  /* Separator between items */
  .status-item:not(:last-child)::after {
    content: '';
    position: absolute;
    right: -8px;
    top: 25%;
    height: 50%;
    width: 1px;
    background: var(--border);
    opacity: 0.5;
  }
  
  /* Pulse animation for notifications */
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.6; }
    100% { opacity: 1; }
  }
  
  .status-item[data-icon="🔔"] {
    animation: pulse 2s infinite;
  }
  
  /* Running indicator animation */
  @keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .status-item[data-icon="⚡"] {
    animation: flash 1s infinite;
  }
</style>