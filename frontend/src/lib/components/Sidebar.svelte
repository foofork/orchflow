<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { invoke } from '@tauri-apps/api/tauri';
  import FileExplorer from './FileExplorer.svelte';
  import FileExplorerEnhanced from './FileExplorerEnhanced.svelte';
  import SearchPanel from './SearchPanel.svelte';
  import GitPanel from './GitPanel.svelte';
  import ExtensionsPanel from './ExtensionsPanel.svelte';
  import DebugPanel from './DebugPanel.svelte';
  
  export let activeView: string = 'explorer';
  export let sessionId: string = '';
  
  const dispatch = createEventDispatcher();
  
  let sidebarTitle = 'Explorer';
  
  $: {
    switch (activeView) {
      case 'explorer':
        sidebarTitle = 'Explorer';
        break;
      case 'search':
        sidebarTitle = 'Search';
        break;
      case 'git':
        sidebarTitle = 'Source Control';
        break;
      case 'debug':
        sidebarTitle = 'Run and Debug';
        break;
      case 'extensions':
        sidebarTitle = 'Extensions';
        break;
      default:
        sidebarTitle = 'Sidebar';
    }
  }
</script>

<div class="sidebar">
  <div class="sidebar-header">
    <h3>{sidebarTitle}</h3>
    <div class="sidebar-actions">
      {#if activeView === 'explorer'}
        <button class="action-btn" title="New File" on:click={() => dispatch('newFile')}>
          <span class="icon">📄</span>
        </button>
        <button class="action-btn" title="New Folder" on:click={() => dispatch('newFolder')}>
          <span class="icon">📁</span>
        </button>
        <button class="action-btn" title="Refresh" on:click={() => dispatch('refresh')}>
          <span class="icon">🔄</span>
        </button>
      {/if}
      {#if activeView === 'git'}
        <button class="action-btn" title="Refresh" on:click={() => dispatch('gitRefresh')}>
          <span class="icon">🔄</span>
        </button>
        <button class="action-btn" title="Commit" on:click={() => dispatch('gitCommit')}>
          <span class="icon">✓</span>
        </button>
      {/if}
    </div>
  </div>
  
  <div class="sidebar-content">
    {#if activeView === 'explorer'}
      <FileExplorerEnhanced 
        on:openFile={(e) => dispatch('openFile', e.detail)}
        on:share={() => dispatch('share')}
        on:newFile={() => dispatch('newFile')}
        on:newFolder={() => dispatch('newFolder')}
      />
    {:else if activeView === 'search'}
      <SearchPanel 
        on:openFile={(e) => dispatch('openFile', e.detail)}
      />
    {:else if activeView === 'git'}
      <GitPanel 
        on:openFile={(e) => dispatch('openFile', e.detail)}
      />
    {:else if activeView === 'debug'}
      <DebugPanel {sessionId} />
    {:else if activeView === 'extensions'}
      <ExtensionsPanel />
    {:else}
      <div class="empty-state">
        <p>Select a view from the activity bar</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .sidebar {
    width: var(--sidebar-width, 260px);
    background: var(--bg-secondary);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    height: var(--tab-bar-height, 35px);
  }
  
  .sidebar-header h3 {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    color: var(--fg-primary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  
  .sidebar-actions {
    display: flex;
    gap: 4px;
  }
  
  .action-btn {
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--fg-secondary);
    transition: all 0.2s;
  }
  
  .action-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .action-btn .icon {
    font-size: 14px;
  }
  
  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  /* Custom scrollbar */
  .sidebar-content::-webkit-scrollbar {
    width: 10px;
  }
  
  .sidebar-content::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb {
    background: var(--bg-tertiary);
    border-radius: 5px;
  }
  
  .sidebar-content::-webkit-scrollbar-thumb:hover {
    background: var(--bg-hover);
  }
</style>