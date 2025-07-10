<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let tabs: Array<{
    id: string;
    title: string;
    type: string;
    paneId?: string;
  }> = [];
  export let activeTabId: string | null = null;
  
  const dispatch = createEventDispatcher();
  
  function selectTab(tabId: string) {
    activeTabId = tabId;
  }
  
  function closeTab(tabId: string, event: MouseEvent) {
    event.stopPropagation();
    dispatch('closeTab', { tabId });
  }
  
  function getTabIcon(type: string): string {
    switch (type) {
      case 'terminal': return '📟';
      case 'file': return '📄';
      case 'dashboard': return '📊';
      case 'test': return '🧪';
      case 'settings': return '⚙️';
      case 'plugins': return '🔌';
      default: return '📋';
    }
  }
  
  function handleDragStart(event: DragEvent, tabId: string) {
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', tabId);
    }
  }
  
  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
  }
  
  function handleDrop(event: DragEvent, targetId: string) {
    event.preventDefault();
    const draggedId = event.dataTransfer?.getData('text/plain');
    
    if (draggedId && draggedId !== targetId) {
      const draggedIndex = tabs.findIndex(t => t.id === draggedId);
      const targetIndex = tabs.findIndex(t => t.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newTabs = [...tabs];
        const [draggedTab] = newTabs.splice(draggedIndex, 1);
        newTabs.splice(targetIndex, 0, draggedTab);
        tabs = newTabs;
      }
    }
  }
</script>

<div class="tab-bar">
  {#each tabs as tab (tab.id)}
    <div
      class="tab"
      class:active={tab.id === activeTabId}
      on:click={() => selectTab(tab.id)}
      draggable="true"
      on:dragstart={(e) => handleDragStart(e, tab.id)}
      on:dragover={handleDragOver}
      on:drop={(e) => handleDrop(e, tab.id)}
    >
      <span class="tab-icon">{getTabIcon(tab.type)}</span>
      <span class="tab-title">{tab.title}</span>
      <button
        class="tab-close"
        on:click={(e) => closeTab(tab.id, e)}
        title="Close tab"
      >
        ×
      </button>
    </div>
  {/each}
  
  {#if tabs.length === 0}
    <div class="empty-message">
      No open tabs
    </div>
  {/if}
</div>

<style>
  .tab-bar {
    display: flex;
    align-items: center;
    height: var(--tab-bar-height);
    background: var(--bg-secondary);
    overflow-x: auto;
    flex: 1;
  }
  
  .tab-bar::-webkit-scrollbar {
    height: 3px;
  }
  
  .tab-bar::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .tab-bar::-webkit-scrollbar-thumb {
    background: var(--fg-tertiary);
    border-radius: 3px;
  }
  
  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 12px;
    height: 100%;
    min-width: 120px;
    max-width: 200px;
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }
  
  .tab:hover {
    background: var(--bg-hover);
  }
  
  .tab.active {
    background: var(--bg-primary);
    border-bottom: 2px solid var(--accent);
  }
  
  .tab-icon {
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .tab-title {
    flex: 1;
    font-size: 13px;
    color: var(--fg-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .tab.active .tab-title {
    color: var(--fg-primary);
    font-weight: 500;
  }
  
  .tab-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 3px;
    color: var(--fg-tertiary);
    font-size: 18px;
    cursor: pointer;
    opacity: 0;
    transition: all 0.2s;
  }
  
  .tab:hover .tab-close {
    opacity: 1;
  }
  
  .tab-close:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .empty-message {
    padding: 0 20px;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
</style>