<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import FileTree from './FileTree.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import Dialog from './Dialog.svelte';
  import type { TreeNode } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  let rootPath = '';
  let tree: TreeNode[] = [];
  let selectedPath = '';
  let error = '';
  let loading = false;
  let contextMenu: { x: number; y: number; node: TreeNode } | null = null;
  let statusMessage = '';
  let statusType: 'info' | 'success' | 'error' | null = null;
  
  // Dialog states
  let showNewFileDialog = false;
  let showNewFolderDialog = false;
  let showRenameDialog = false;
  let showDeleteDialog = false;
  let dialogInputValue = '';
  let dialogError = '';
  let currentNode: TreeNode | null = null;
  
  // Agent status tracking 
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
        const { invoke } = await import('@tauri-apps/api/core');
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
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(path);
      const nodes: TreeNode[] = [];
      
      // Sort entries: directories first, then files
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });
      
      for (const entry of entries) {
        // Skip hidden files/folders unless specifically configured to show
        if (entry.name?.startsWith('.') && entry.name !== '.gitignore') continue;
        
        const { join } = await import('@tauri-apps/api/path');
        const fullPath = await join(path, entry.name);
        
        nodes.push({
          name: entry.name || 'Unknown',
          path: fullPath,
          isDirectory: entry.isDirectory,
          children: entry.isDirectory ? [] : undefined,
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
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(node.path);
      const children: TreeNode[] = [];
      
      entries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });
      
      for (const entry of entries) {
        if (entry.name?.startsWith('.') && entry.name !== '.gitignore') continue;
        
        const { join } = await import('@tauri-apps/api/path');
        const fullPath = await join(node.path, entry.name);
        
        children.push({
          name: entry.name || 'Unknown',
          path: fullPath,
          isDirectory: entry.isDirectory,
          children: entry.isDirectory ? [] : undefined,
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
    const targetPath = selectedPath && tree.find(n => n.path === selectedPath)?.isDirectory 
      ? selectedPath 
      : rootPath;
    dialogInputValue = '';
    dialogError = '';
    showNewFileDialog = true;
  }
  
  async function handleNewFolder() {
    const targetPath = selectedPath && tree.find(n => n.path === selectedPath)?.isDirectory 
      ? selectedPath 
      : rootPath;
    dialogInputValue = '';
    dialogError = '';
    showNewFolderDialog = true;
  }
  
  async function handleRefresh() {
    if (rootPath) {
      await loadDirectory(rootPath);
    }
  }
  
  function handleRename(node: TreeNode) {
    currentNode = node;
    dialogInputValue = node.name;
    dialogError = '';
    showRenameDialog = true;
    closeContextMenu();
  }
  
  function handleDelete(node: TreeNode) {
    currentNode = node;
    showDeleteDialog = true;
    closeContextMenu();
  }
  
  async function createFile() {
    if (!dialogInputValue.trim()) {
      dialogError = 'File name cannot be empty';
      return;
    }
    
    try {
      const targetDir = selectedPath && tree.find(n => n.path === selectedPath)?.isDirectory 
        ? selectedPath 
        : rootPath;
      
      const { invoke } = await import('@tauri-apps/api/core');
      const { join } = await import('@tauri-apps/api/path');
      
      const newPath = await join(targetDir, dialogInputValue);
      await invoke('create_file', { path: newPath, content: '' });
      
      showNewFileDialog = false;
      await handleRefresh();
      dispatch('fileCreated', newPath);
    } catch (err) {
      dialogError = `Failed to create file: ${err}`;
    }
  }
  
  async function createFolder() {
    if (!dialogInputValue.trim()) {
      dialogError = 'Folder name cannot be empty';
      return;
    }
    
    try {
      const targetDir = selectedPath && tree.find(n => n.path === selectedPath)?.isDirectory 
        ? selectedPath 
        : rootPath;
      
      const { invoke } = await import('@tauri-apps/api/core');
      const { join } = await import('@tauri-apps/api/path');
      
      const newPath = await join(targetDir, dialogInputValue);
      await invoke('create_directory', { path: newPath });
      
      showNewFolderDialog = false;
      await handleRefresh();
      dispatch('folderCreated', newPath);
    } catch (err) {
      dialogError = `Failed to create folder: ${err}`;
    }
  }
  
  async function renameItem() {
    if (!currentNode || !dialogInputValue.trim()) {
      dialogError = 'Name cannot be empty';
      return;
    }
    
    if (dialogInputValue === currentNode.name) {
      showRenameDialog = false;
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { dirname, join } = await import('@tauri-apps/api/path');
      
      const dir = await dirname(currentNode.path);
      const newPath = await join(dir, dialogInputValue);
      
      await invoke('rename_path', { oldPath: currentNode.path, newName: dialogInputValue });
      
      showRenameDialog = false;
      await handleRefresh();
      dispatch('itemRenamed', { oldPath: currentNode.path, newPath });
    } catch (err) {
      dialogError = `Failed to rename: ${err}`;
    }
  }
  
  async function deleteItem() {
    if (!currentNode) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_path', { path: currentNode.path, permanent: false });
      
      showDeleteDialog = false;
      await handleRefresh();
      dispatch('itemDeleted', currentNode.path);
    } catch (err) {
      error = `Failed to delete: ${err}`;
      showDeleteDialog = false;
    }
  }
  
  function handleCopyPath(node: TreeNode) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(node.path);
    }
    closeContextMenu();
  }

  // Utility function to show status messages
  function showStatus(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 3000) {
    statusMessage = message;
    statusType = type;
    
    setTimeout(() => {
      statusMessage = '';
      statusType = null;
    }, duration);
  }

  // Drag and drop handlers
  async function handleFileDrop(event: CustomEvent) {
    const { source, destination, operation } = event.detail;
    
    // Show loading status
    showStatus(`${operation === 'copy' ? 'Copying' : 'Moving'} ${source.name}...`, 'info', 0);
    
    try {
      if (!browser || !('__TAURI__' in window)) {
        console.log('Mock drag and drop:', { source, destination, operation });
        showStatus(`Mock ${operation}: ${source.name} → ${destination.name}`, 'success');
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      
      // Call appropriate backend command based on operation
      if (operation === 'copy') {
        await invoke('copy_files', {
          files: [source.path],
          destination: destination.path
        });
        showStatus(`Copied ${source.name} to ${destination.name}`, 'success');
        console.log(`Copied ${source.name} to ${destination.path}`);
      } else {
        await invoke('move_files', {
          files: [source.path],
          destination: destination.path
        });
        showStatus(`Moved ${source.name} to ${destination.name}`, 'success');
        console.log(`Moved ${source.name} to ${destination.path}`);
      }
      
      // Refresh the tree to show the changes
      await handleRefresh();
      
      // Dispatch success event
      dispatch('fileOperation', {
        operation,
        source: source.path,
        destination: destination.path,
        success: true
      });
      
    } catch (err) {
      const errorMsg = `Failed to ${operation} ${source.name}: ${err}`;
      console.error(errorMsg);
      showStatus(errorMsg, 'error', 5000);
      
      // Dispatch error event
      dispatch('fileOperation', {
        operation,
        source: source.path,
        destination: destination.path,
        success: false,
        error: err
      });
    }
  }

  function handleDropError(event: CustomEvent) {
    const { error: dropError, destination } = event.detail;
    const errorMsg = `Drop failed: ${dropError.message || dropError}`;
    console.error('Drop error:', dropError);
    showStatus(errorMsg, 'error', 5000);
  }

  function handleDragStart(event: CustomEvent) {
    // Optional: Handle drag start for any global state updates
    dispatch('dragStart', event.detail);
  }

  function handleDragEnd(event: CustomEvent) {
    // Optional: Handle drag end for any global state updates
    dispatch('dragEnd', event.detail);
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
          on:dragStart={handleDragStart}
          on:dragEnd={handleDragEnd}
          on:fileDrop={handleFileDrop}
          on:dropError={handleDropError}
        />
      {/each}
    </div>
  {/if}
  
  <!-- Status bar -->
  {#if statusMessage}
    <div class="status-bar" class:success={statusType === 'success'} class:error={statusType === 'error'} class:info={statusType === 'info'}>
      <span class="status-icon">
        {#if statusType === 'success'}✓{:else if statusType === 'error'}⚠{:else}ℹ{/if}
      </span>
      <span class="status-text">{statusMessage}</span>
    </div>
  {/if}
</div>

{#if contextMenu}
  <ContextMenu 
    x={contextMenu.x} 
    y={contextMenu.y}
    on:close={closeContextMenu}
  >
    <button class="menu-item" on:click={() => contextMenu && dispatch('openFile', contextMenu.node.path)}>
      <span class="menu-icon">📂</span>
      Open
    </button>
    <button class="menu-item" on:click={() => contextMenu && handleRename(contextMenu.node)}>
      <span class="menu-icon">✏️</span>
      Rename
    </button>
    <button class="menu-item" on:click={() => contextMenu && handleDelete(contextMenu.node)}>
      <span class="menu-icon">🗑️</span>
      Delete
    </button>
    <div class="menu-separator"></div>
    <button class="menu-item" on:click={() => contextMenu && handleCopyPath(contextMenu.node)}>
      <span class="menu-icon">📋</span>
      Copy Path
    </button>
  </ContextMenu>
{/if}

<!-- New File Dialog -->
<Dialog 
  title="New File" 
  show={showNewFileDialog}
  on:close={() => showNewFileDialog = false}
>
  <div class="dialog-form">
    <label for="new-file-name">File name:</label>
    <input 
      id="new-file-name"
      type="text" 
      bind:value={dialogInputValue}
      on:keydown={(e) => e.key === 'Enter' && createFile()}
      placeholder="filename.txt"
    />
    {#if dialogError}
      <div class="dialog-error">{dialogError}</div>
    {/if}
  </div>
  
  <div slot="actions">
    <button class="btn btn-secondary" on:click={() => showNewFileDialog = false}>
      Cancel
    </button>
    <button class="btn btn-primary" on:click={createFile}>
      Create
    </button>
  </div>
</Dialog>

<!-- New Folder Dialog -->
<Dialog 
  title="New Folder" 
  show={showNewFolderDialog}
  on:close={() => showNewFolderDialog = false}
>
  <div class="dialog-form">
    <label for="new-folder-name">Folder name:</label>
    <input 
      id="new-folder-name"
      type="text" 
      bind:value={dialogInputValue}
      on:keydown={(e) => e.key === 'Enter' && createFolder()}
      placeholder="folder-name"
    />
    {#if dialogError}
      <div class="dialog-error">{dialogError}</div>
    {/if}
  </div>
  
  <div slot="actions">
    <button class="btn btn-secondary" on:click={() => showNewFolderDialog = false}>
      Cancel
    </button>
    <button class="btn btn-primary" on:click={createFolder}>
      Create
    </button>
  </div>
</Dialog>

<!-- Rename Dialog -->
<Dialog 
  title="Rename" 
  show={showRenameDialog}
  on:close={() => showRenameDialog = false}
>
  <div class="dialog-form">
    <label for="rename-input">New name:</label>
    <input 
      id="rename-input"
      type="text" 
      bind:value={dialogInputValue}
      on:keydown={(e) => e.key === 'Enter' && renameItem()}
    />
    {#if dialogError}
      <div class="dialog-error">{dialogError}</div>
    {/if}
  </div>
  
  <div slot="actions">
    <button class="btn btn-secondary" on:click={() => showRenameDialog = false}>
      Cancel
    </button>
    <button class="btn btn-primary" on:click={renameItem}>
      Rename
    </button>
  </div>
</Dialog>

<!-- Delete Confirmation Dialog -->
<Dialog 
  title="Confirm Delete" 
  show={showDeleteDialog}
  on:close={() => showDeleteDialog = false}
>
  <div class="dialog-form">
    <p>Are you sure you want to delete "{currentNode?.name}"?</p>
    <p class="dialog-warning">This action will move the item to trash.</p>
  </div>
  
  <div slot="actions">
    <button class="btn btn-secondary" on:click={() => showDeleteDialog = false}>
      Cancel
    </button>
    <button class="btn btn-danger" on:click={deleteItem}>
      Delete
    </button>
  </div>
</Dialog>

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
  
  /* Dialog styles */
  .dialog-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .dialog-form label {
    font-size: 13px;
    color: var(--fg-secondary);
    font-weight: 500;
  }
  
  .dialog-form input {
    width: 100%;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 14px;
    font-family: inherit;
  }
  
  .dialog-form input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--accent);
  }
  
  .dialog-error {
    color: var(--error);
    font-size: 13px;
    margin-top: 4px;
  }
  
  .dialog-warning {
    color: var(--warning);
    font-size: 13px;
    margin-top: 8px;
  }
  
  .dialog-form p {
    margin: 0;
    font-size: 14px;
    color: var(--fg-primary);
  }
  
  /* Button styles */
  .btn {
    padding: 6px 16px;
    border: none;
    border-radius: 4px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.1s;
  }
  
  .btn:active {
    transform: scale(0.98);
  }
  
  .btn-primary {
    background: var(--accent);
    color: white;
  }
  
  .btn-primary:hover {
    background: var(--accent-hover);
  }
  
  .btn-secondary {
    background: var(--bg-tertiary);
    color: var(--fg-primary);
  }
  
  .btn-secondary:hover {
    background: var(--bg-hover);
  }
  
  .btn-danger {
    background: var(--error);
    color: white;
  }
  
  .btn-danger:hover {
    background: var(--error-hover);
  }

  /* Status bar styles */
  .status-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    font-weight: 500;
    z-index: 10;
    animation: slideUp 0.2s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .status-bar.success {
    background: var(--success);
    color: white;
    border-top-color: var(--success);
  }

  .status-bar.error {
    background: var(--error);
    color: white;
    border-top-color: var(--error);
  }

  .status-bar.info {
    background: var(--accent);
    color: white;
    border-top-color: var(--accent);
  }

  .status-icon {
    font-size: 14px;
  }

  .status-text {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>