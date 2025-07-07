<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import FileTree from './FileTree.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import type { TreeNode } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  let rootPath = '';
  let tree: TreeNode[] = [];
  let selectedPath = '';
  let error = '';
  let loading = false;
  let contextMenu: { x: number; y: number; node: TreeNode } | null = null;
  
  // Agent status tracking - in real implementation, this would come from orchestrator
  let agents = new Map<string, { status: string; pid?: number }>();
  
  // Mock agent data for demonstration
  onMount(() => {
    // Simulate some active agents
    agents.set('/src/server.js', { status: 'running', pid: 1234 });
    agents.set('/test/runner.js', { status: 'error', pid: 5678 });
    agents = agents; // Trigger reactivity
  });
  
  onMount(async () => {
    if (browser && '__TAURI__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/tauri');
        rootPath = await invoke('get_current_dir');
        await loadDirectory(rootPath);
      } catch (err) {
        console.error('Failed to load initial directory:', err);
        error = 'Failed to load directory';
      }
    } else {
      // Mock data for browser development
      tree = [
        {
          name: 'src',
          path: '/src',
          isDirectory: true,
          children: [
            { name: 'main.ts', path: '/src/main.ts', isDirectory: false },
            { name: 'server.js', path: '/src/server.js', isDirectory: false },
            {
              name: 'components',
              path: '/src/components',
              isDirectory: true,
              children: []
            }
          ],
          expanded: true
        },
        {
          name: 'test',
          path: '/test',
          isDirectory: true,
          children: [
            { name: 'runner.js', path: '/test/runner.js', isDirectory: false }
          ],
          expanded: false
        },
        { name: 'package.json', path: '/package.json', isDirectory: false },
        { name: 'README.md', path: '/README.md', isDirectory: false },
        { name: 'tsconfig.json', path: '/tsconfig.json', isDirectory: false },
      ];
    }
  });
  
  async function loadDirectory(path: string) {
    if (!browser || !('__TAURI__' in window)) return;
    
    loading = true;
    error = '';
    
    try {
      const { readDir } = await import('@tauri-apps/api/fs');
      const entries = await readDir(path);
      const nodes: TreeNode[] = [];
      
      // Sort entries: directories first, then files
      entries.sort((a, b) => {
        if (a.children !== undefined && b.children === undefined) return -1;
        if (a.children === undefined && b.children !== undefined) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });
      
      for (const entry of entries) {
        // Skip hidden files/folders unless specifically configured to show
        if (entry.name?.startsWith('.') && entry.name !== '.gitignore') continue;
        
        nodes.push({
          name: entry.name || 'Unknown',
          path: entry.path,
          isDirectory: entry.children !== undefined,
          children: entry.children !== undefined ? [] : undefined,
          expanded: false,
        });
      }
      
      tree = nodes;
    } catch (err) {
      console.error('Failed to read directory:', err);
      error = `Failed to read directory: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  async function handleExpand(event: CustomEvent<TreeNode>) {
    const node = event.detail;
    if (!browser || !('__TAURI__' in window)) return;
    
    node.loading = true;
    tree = tree; // Trigger reactivity
    
    try {
      const { readDir } = await import('@tauri-apps/api/fs');
      const entries = await readDir(node.path);
      const children: TreeNode[] = [];
      
      entries.sort((a, b) => {
        if (a.children !== undefined && b.children === undefined) return -1;
        if (a.children === undefined && b.children !== undefined) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });
      
      for (const entry of entries) {
        if (entry.name?.startsWith('.') && entry.name !== '.gitignore') continue;
        
        children.push({
          name: entry.name || 'Unknown',
          path: entry.path,
          isDirectory: entry.children !== undefined,
          children: entry.children !== undefined ? [] : undefined,
          expanded: false,
        });
      }
      
      node.children = children;
    } catch (err) {
      console.error('Failed to expand directory:', err);
    } finally {
      node.loading = false;
      tree = tree; // Trigger reactivity
    }
  }
  
  function handleSelect(event: CustomEvent<string>) {
    selectedPath = event.detail;
  }
  
  function handleOpenFile(event: CustomEvent<string>) {
    dispatch('openFile', event.detail);
  }
  
  function handleContextMenu(event: CustomEvent<{ node: TreeNode; x: number; y: number }>) {
    contextMenu = event.detail;
  }
  
  function closeContextMenu() {
    contextMenu = null;
  }
  
  async function handleNewFile() {
    // TODO: Implement new file dialog
    dispatch('newFile');
  }
  
  async function handleNewFolder() {
    // TODO: Implement new folder dialog
    dispatch('newFolder');
  }
  
  async function handleRefresh() {
    if (rootPath) {
      await loadDirectory(rootPath);
    }
  }
  
  function handleRename(node: TreeNode) {
    // TODO: Implement rename functionality
    console.log('Rename:', node.path);
    closeContextMenu();
  }
  
  function handleDelete(node: TreeNode) {
    // TODO: Implement delete functionality
    console.log('Delete:', node.path);
    closeContextMenu();
  }
  
  function handleCopyPath(node: TreeNode) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(node.path);
    }
    closeContextMenu();
  }
</script>

<div class="file-explorer-enhanced">
  <div class="toolbar">
    <button class="tool-btn" on:click={handleNewFile} title="New File">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M9 1H3.5C2.67 1 2 1.67 2 2.5v11C2 14.33 2.67 15 3.5 15h9c.83 0 1.5-.67 1.5-1.5V6L9 1z" stroke="currentColor" stroke-linejoin="round"/>
        <path d="M9 1v5h5M11.5 10h-5M9 7.5v5" stroke="currentColor" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="tool-btn" on:click={handleNewFolder} title="New Folder">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.5 5H8L6.5 3h-4C1.67 3 1 3.67 1 4.5v7c0 .83.67 1.5 1.5 1.5h11c.83 0 1.5-.67 1.5-1.5v-5c0-.83-.67-1.5-1.5-1.5zM10.5 10h-5M8 7.5v5" stroke="currentColor" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
    </button>
    <button class="tool-btn" on:click={handleRefresh} title="Refresh">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M13.65 2.35A8 8 0 102.35 13.65 8 8 0 0013.65 2.35zM12 8h-2V6" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
    <button class="tool-btn" on:click={() => dispatch('collapseAll')} title="Collapse All">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M9 10L5 14M7 10L5 12M11 6L7 2M9 6L7 4" stroke="currentColor" stroke-linecap="round"/>
      </svg>
    </button>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <span class="spinner">⟳</span> Loading...
    </div>
  {:else if error}
    <div class="error-state">
      <span class="error-icon">⚠️</span>
      <span class="error-text">{error}</span>
    </div>
  {:else if tree.length === 0}
    <div class="empty-state">
      <span class="empty-icon">📁</span>
      <span class="empty-text">No files in directory</span>
    </div>
  {:else}
    <div class="tree-container">
      {#each tree as node (node.path)}
        <FileTree 
          {node}
          {selectedPath}
          {agents}
          on:select={handleSelect}
          on:openFile={handleOpenFile}
          on:expand={handleExpand}
          on:contextMenu={handleContextMenu}
        />
      {/each}
    </div>
  {/if}
</div>

{#if contextMenu}
  <ContextMenu 
    x={contextMenu.x} 
    y={contextMenu.y}
    on:close={closeContextMenu}
  >
    <button class="menu-item" on:click={() => handleOpenFile({ detail: contextMenu.node.path })}>
      <span class="menu-icon">📂</span>
      Open
    </button>
    <button class="menu-item" on:click={() => handleRename(contextMenu.node)}>
      <span class="menu-icon">✏️</span>
      Rename
    </button>
    <button class="menu-item" on:click={() => handleDelete(contextMenu.node)}>
      <span class="menu-icon">🗑️</span>
      Delete
    </button>
    <div class="menu-separator"></div>
    <button class="menu-item" on:click={() => handleCopyPath(contextMenu.node)}>
      <span class="menu-icon">📋</span>
      Copy Path
    </button>
  </ContextMenu>
{/if}

<style>
  .file-explorer-enhanced {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--bg-secondary);
  }
  
  .toolbar {
    display: flex;
    gap: 2px;
    padding: 4px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-tertiary);
  }
  
  .tool-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--fg-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  
  .tool-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .tool-btn:active {
    transform: scale(0.95);
  }
  
  .tool-btn svg {
    width: 16px;
    height: 16px;
  }
  
  .tree-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }
  
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px 20px;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .error-state {
    color: var(--error);
  }
  
  .spinner {
    font-size: 20px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .error-icon,
  .empty-icon {
    font-size: 24px;
  }
  
  /* Scrollbar styling */
  .tree-container::-webkit-scrollbar {
    width: 10px;
  }
  
  .tree-container::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .tree-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 5px;
  }
  
  .tree-container::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
  
  /* Context menu items */
  .menu-item {
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--fg-primary);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: background 0.1s;
  }
  
  .menu-item:hover {
    background: var(--bg-hover);
  }
  
  .menu-icon {
    font-size: 14px;
  }
  
  .menu-separator {
    height: 1px;
    background: var(--border);
    margin: 4px 0;
  }
</style>