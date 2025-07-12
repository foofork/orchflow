<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { manager, activeSession, activePane, panes } from '$lib/stores/manager';
  import PluginStatusBar from './PluginStatusBar.svelte';
  
  export const sessionId: string = ''; // External reference only
  
  let sessionName = '';
  let activePaneTitle = '';
  let terminalCount = 0;
  let clock = '';
  let notifications: Array<{ id: string; message: string; type: string }> = [];
  let showNotifications = false;
  
  let clockInterval: NodeJS.Timeout;
  
  onMount(() => {
    updateClock();
    clockInterval = setInterval(updateClock, 1000);
    
    return () => {
      clearInterval(clockInterval);
    };
  });
  
  // Subscribe to session changes
  $: if ($activeSession) {
    sessionName = $activeSession.name;
  }
  
  // Subscribe to pane changes
  $: if ($activePane) {
    activePaneTitle = $activePane.title || '';
  }
  
  // Count terminals
  $: terminalCount = Array.from($panes.values()).filter(p => p.pane_type === 'Terminal').length;
  
  function updateClock() {
    const now = new Date();
    clock = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  
  function addNotification(message: string, type = 'info') {
    const id = Date.now().toString();
    notifications = [...notifications, { id, message, type }];
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      notifications = notifications.filter(n => n.id !== id);
    }, 5000);
  }
  
  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'success': return '✅';
      default: return 'ℹ️';
    }
  }
</script>

<div class="status-bar">
  <!-- Left Section -->
  <div class="status-section left">
    {#if sessionName}
      <div class="status-item">
        <span class="icon">📁</span>
        <span class="text">{sessionName}</span>
      </div>
    {/if}
    
    {#if activePaneTitle}
      <div class="status-item">
        <span class="icon">📄</span>
        <span class="text">{activePaneTitle}</span>
      </div>
    {/if}
    
    {#if terminalCount > 0}
      <div class="status-item">
        <span class="icon">📟</span>
        <span class="text">{terminalCount} terminal{terminalCount !== 1 ? 's' : ''}</span>
      </div>
    {/if}
  </div>
  
  <!-- Center Section -->
  <div class="status-section center">
    <!-- Plugin Status Bar -->
    <PluginStatusBar />
  </div>
  
  <!-- Right Section -->
  <div class="status-section right">
    {#if notifications.length > 0}
      <button 
        class="status-item notifications"
        class:has-errors={notifications.some(n => n.type === 'error')}
        on:click={() => showNotifications = !showNotifications}
      >
        <span class="icon">{getNotificationIcon(notifications[0].type)}</span>
        <span class="text">{notifications[0].message}</span>
        {#if notifications.length > 1}
          <span class="badge">+{notifications.length - 1}</span>
        {/if}
      </button>
    {/if}
    
    <div class="status-item">
      <span class="icon">🕐</span>
      <span class="text">{clock}</span>
    </div>
  </div>
  
  <!-- Notifications Popup -->
  {#if showNotifications && notifications.length > 0}
    <div class="notifications-popup">
      <div class="notifications-header">
        Notifications
        <button class="close-button" on:click={() => showNotifications = false}>×</button>
      </div>
      <div class="notifications-list">
        {#each notifications as notification}
          <div class="notification-item {notification.type}">
            <span class="notification-icon">{getNotificationIcon(notification.type)}</span>
            <span class="notification-message">{notification.message}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .status-bar {
    display: flex;
    align-items: center;
    height: var(--status-bar-height);
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 0 10px;
    font-size: 12px;
    position: relative;
  }
  
  .status-section {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .status-section.left {
    flex: 1;
  }
  
  .status-section.center {
    flex: 0 0 auto;
  }
  
  .status-section.right {
    flex: 1;
    justify-content: flex-end;
  }
  
  .status-item {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--fg-secondary);
    padding: 2px 8px;
    border-radius: 3px;
    transition: all 0.2s;
  }
  
  .status-item:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .status-item.notifications {
    background: none;
    border: none;
    cursor: pointer;
    max-width: 300px;
  }
  
  .status-item.notifications.has-errors {
    color: var(--error);
  }
  
  .icon {
    font-size: 14px;
  }
  
  .text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .badge {
    background: var(--accent);
    color: var(--bg-primary);
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
  }
  
  /* Notifications Popup */
  .notifications-popup {
    position: absolute;
    bottom: 100%;
    right: 10px;
    width: 320px;
    max-height: 400px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    flex-direction: column;
    margin-bottom: 4px;
  }
  
  .notifications-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    font-weight: 500;
    color: var(--fg-primary);
  }
  
  .close-button {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 3px;
    transition: all 0.2s;
  }
  
  .close-button:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .notifications-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .notification-item {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 8px;
    border-radius: 4px;
    margin-bottom: 4px;
    background: var(--bg-secondary);
  }
  
  .notification-item.error {
    background: rgba(244, 67, 54, 0.1);
    color: var(--error);
  }
  
  .notification-item.warning {
    background: rgba(255, 152, 0, 0.1);
    color: var(--warning);
  }
  
  .notification-item.success {
    background: rgba(76, 175, 80, 0.1);
    color: var(--success);
  }
  
  .notification-icon {
    font-size: 16px;
    flex-shrink: 0;
  }
  
  .notification-message {
    flex: 1;
    font-size: 12px;
    line-height: 1.4;
  }
</style>