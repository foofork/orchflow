<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { derived, writable } from 'svelte/store';
  import { invoke } from '@tauri-apps/api/tauri';
  import { listen, UnlistenFn } from '@tauri-apps/api/event';
  
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
  
  interface SystemMetrics {
    cpu?: number;
    memory?: number;
    disk?: number;
  }
  
  // Props
  export let showGitStatus = true;
  export let showSystemMetrics = true;
  export let showNotifications = true;
  export let customItems: StatusItem[] = [];
  
  // State
  let gitInfo = writable<GitInfo>({});
  let systemMetrics = writable<SystemMetrics>({});
  let notifications = writable<string[]>([]);
  let activeFile = writable<string>('');
  let cursorPosition = writable<{ line: number; column: number }>({ line: 1, column: 1 });
  let encoding = writable<string>('UTF-8');
  let fileType = writable<string>('');
  let errors = writable<number>(0);
  let warnings = writable<number>(0);
  let running = writable<boolean>(false);
  let currentTime = writable<string>('');
  
  // Event listeners
  let unlisteners: UnlistenFn[] = [];
  
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
    [systemMetrics, notifications, encoding, fileType, running, currentTime],
    ([$metrics, $notifs, $enc, $type, $run, $time]) => {
      const items: StatusItem[] = [];
      
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
      if (showNotifications && $notifs.length > 0) {
        items.push({
          id: 'notifications',
          text: `🔔 ${$notifs.length}`,
          tooltip: `${$notifs.length} notifications`,
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
      if (showSystemMetrics) {
        if ($metrics.cpu !== undefined) {
          items.push({
            id: 'cpu',
            text: `CPU: ${$metrics.cpu.toFixed(0)}%`,
            tooltip: 'CPU usage',
            onClick: () => dispatch('action', { type: 'showSystemMonitor' })
          });
        }
        
        if ($metrics.memory !== undefined) {
          items.push({
            id: 'memory',
            text: `Mem: ${$metrics.memory.toFixed(0)}%`,
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
    if (!showGitStatus) return;
    
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
    if (!showSystemMetrics) return;
    
    try {
      const metrics = await invoke('get_system_metrics');
      systemMetrics.set(metrics as SystemMetrics);
    } catch (err) {
      console.error('Failed to get system metrics:', err);
    }
  }
  
  function updateClock() {
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
    // Initial updates
    updateGitStatus();
    updateSystemMetrics();
    updateClock();
    
    // Set up intervals
    const gitInterval = setInterval(updateGitStatus, 5000);
    const metricsInterval = setInterval(updateSystemMetrics, 2000);
    const clockInterval = setInterval(updateClock, 1000);
    
    // Listen for events
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
        notifications.update(n => [...n, event.payload as string]);
      }),
      await listen('process-started', () => running.set(true)),
      await listen('process-stopped', () => running.set(false))
    );
    
    return () => {
      clearInterval(gitInterval);
      clearInterval(metricsInterval);
      clearInterval(clockInterval);
    };
  });
  
  onDestroy(() => {
    unlisteners.forEach(unlisten => unlisten());
  });
  
  // Merge all items
  $: allLeftItems = [...$leftItems, ...customItems.filter(item => item.align !== 'right')];
  $: allRightItems = $rightItems;
</script>

<div class="status-bar">
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
  
  .status-item:has(.item-text:contains("🔔")) {
    animation: pulse 2s infinite;
  }
  
  /* Running indicator animation */
  @keyframes flash {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .status-item:has(.item-text:contains("⚡")) {
    animation: flash 1s infinite;
  }
</style>