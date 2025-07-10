<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let activeView: string = 'explorer';
  
  const dispatch = createEventDispatcher<{ viewChange: string }>();
  
  interface ActivityItem {
    id: string;
    icon: string;
    label: string;
    tooltip: string;
  }
  
  const activities: ActivityItem[] = [
    { id: 'explorer', icon: '📁', label: 'Explorer', tooltip: 'File Explorer (Ctrl+Shift+E)' },
    { id: 'search', icon: '🔍', label: 'Search', tooltip: 'Search (Ctrl+Shift+F)' },
    { id: 'git', icon: '🌿', label: 'Source Control', tooltip: 'Source Control (Ctrl+Shift+G)' },
    { id: 'debug', icon: '🐛', label: 'Run and Debug', tooltip: 'Run and Debug (Ctrl+Shift+D)' },
    { id: 'extensions', icon: '🧩', label: 'Extensions', tooltip: 'Extensions (Ctrl+Shift+X)' },
    { id: 'dashboard', icon: '📊', label: 'Dashboard', tooltip: 'Dashboard' },
    { id: 'test', icon: '🧪', label: 'Testing', tooltip: 'Test Results' },
  ];
  
  const bottomActivities: ActivityItem[] = [
    { id: 'accounts', icon: '👤', label: 'Accounts', tooltip: 'Accounts' },
    { id: 'settings', icon: '⚙️', label: 'Settings', tooltip: 'Settings (Ctrl+,)' },
  ];
  
  function handleClick(viewId: string) {
    dispatch('viewChange', viewId);
  }
</script>

<div class="activity-bar">
  <div class="activities">
    {#each activities as activity}
      <button
        class="activity-item"
        class:active={activeView === activity.id}
        on:click={() => handleClick(activity.id)}
        title={activity.tooltip}
        aria-label={activity.label}
      >
        <span class="icon">{activity.icon}</span>
      </button>
    {/each}
  </div>
  
  <div class="bottom-activities">
    {#each bottomActivities as activity}
      <button
        class="activity-item"
        class:active={activeView === activity.id}
        on:click={() => handleClick(activity.id)}
        title={activity.tooltip}
        aria-label={activity.label}
      >
        <span class="icon">{activity.icon}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .activity-bar {
    width: var(--activity-bar-width, 48px);
    background: var(--color-bg-secondary, #181825);
    border-right: 1px solid var(--color-border, #45475a);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }
  
  .activities,
  .bottom-activities {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 4px 0;
  }
  
  .activity-item {
    width: 48px;
    height: 48px;
    background: none;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    position: relative;
    transition: all 0.2s;
  }
  
  .activity-item::before {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 2px;
    height: 0;
    background: var(--color-primary, #89b4fa);
    transition: height 0.2s;
  }
  
  .activity-item:hover {
    background: var(--color-bg-hover, #313244);
  }
  
  .activity-item.active {
    color: var(--color-primary, #89b4fa);
  }
  
  .activity-item.active::before {
    height: 24px;
  }
  
  .icon {
    font-size: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  /* Accessibility */
  .activity-item:focus-visible {
    outline: 2px solid var(--color-primary, #89b4fa);
    outline-offset: -2px;
  }
  
  /* Tooltips on hover */
  @media (hover: hover) {
    .activity-item:hover::after {
      content: attr(title);
      position: absolute;
      left: 100%;
      top: 50%;
      transform: translateY(-50%);
      margin-left: 4px;
      padding: 4px 8px;
      background: var(--color-bg-tertiary, #313244);
      color: var(--color-text-primary, #cdd6f4);
      font-size: 12px;
      border-radius: 4px;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      animation: tooltip-show 0.2s ease-out 0.5s forwards;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      z-index: 1000;
    }
  }
  
  @keyframes tooltip-show {
    to {
      opacity: 1;
    }
  }
</style>