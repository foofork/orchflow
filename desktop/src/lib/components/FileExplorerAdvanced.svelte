<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { slide, fade } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/core';
  import { listen } from '@tauri-apps/api/event';
  import ContextMenu from './ContextMenu.svelte';
  
  const dispatch = createEventDispatcher();
  
  interface GitStatus {
    path: string;
    status: 'untracked' | 'modified' | 'added' | 'deleted' | 'renamed' | 'conflicted' | 'ignored';
    staged: boolean;
  }
  
  interface FileNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: FileNode[];
    expanded?: boolean;
    loading?: boolean;
    size?: number;
    modified?: string;
    gitStatus?: GitStatus;
    icon?: string;
  }
  
  export let rootPath = '';
  export let showHidden = false;
  export let showGitStatus = true;
  export let testMode = false;
  export let initialTree: FileNode[] | null = null;
  export let autoLoad = true;
  
  let tree: FileNode[] = [];
  let selectedPath = '';
  let selectedNode: FileNode | null = null;
  let searchQuery = '';
  let filteredTree: FileNode[] = [];
  let gitStatuses: Record<string, GitStatus> = {};
  let hasGit = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let showContextMenu = false;
  let unlisten: (() => void) | null = null;
  
  // File type icons
  const fileIcons: Record<string, string> = {
    folder: '📁',
    folderOpen: '📂',
    js: '🟨',
    ts: '🔷',
    jsx: '⚛️',
    tsx: '⚛️',
    svelte: '🧡',
    vue: '💚',
    py: '🐍',
    rs: '🦀',
    go: '🐹',
    java: '☕',
    c: '🔵',
    cpp: '🔵',
    cs: '🟣',
    json: '📋',
    yaml: '📋',
    yml: '📋',
    toml: '📋',
    xml: '📋',
    env: '⚙️',
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    sass: '🎨',
    md: '📝',
    txt: '📄',
    pdf: '📕',
    doc: '📘',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
    mp4: '🎬',
    mp3: '🎵',
    zip: '🗜️',
    tar: '🗜️',
    gz: '🗜️',
    lock: '🔒',
    gitignore: '🚫',
    dockerfile: '🐳',
    default: '📄'
  };
  
  const gitStatusIcons: Record<string, string> = {
    untracked: '❓',
    modified: '✏️',
    added: '➕',
    deleted: '➖',
    renamed: '📝',
    conflicted: '⚠️',
    ignored: '🚫'
  };
  
  // Load file tree
  async function loadTree(path?: string) {
    if (testMode && initialTree && !path) {
      tree = initialTree;
      filterTree();
      return;
    }
    
    try {
      const result = await invoke<FileNode[]>('get_file_tree', {
        path: path || rootPath,
        showHidden
      });
      
      if (path) {
        updateNodeChildren(tree, path, result);
      } else {
        tree = result;
      }
      
      if (showGitStatus && !testMode) {
        await loadGitStatuses();
      }
      
      filterTree();
    } catch (err) {
      console.error('Failed to load file tree:', err);
      dispatch('error', { message: 'Failed to load files', error: err });
    }
  }
  
  // Update node's children
  function updateNodeChildren(nodes: FileNode[], path: string, children: FileNode[]) {
    for (const node of nodes) {
      if (node.path === path) {
        node.children = children;
        node.loading = false;
        return true;
      }
      if (node.children && updateNodeChildren(node.children, path, children)) {
        return true;
      }
    }
    return false;
  }
  
  // Load git statuses
  async function loadGitStatuses() {
    if (testMode) return;
    
    try {
      hasGit = await invoke<boolean>('has_git_integration');
      if (hasGit) {
        const statuses = await invoke<GitStatus[]>('get_git_file_statuses', { path: rootPath });
        gitStatuses = {};
        for (const status of statuses) {
          gitStatuses[status.path] = status;
        }
        applyGitStatuses(tree);
      }
    } catch (err) {
      console.error('Failed to load git statuses:', err);
    }
  }
  
  // Apply git statuses to tree
  function applyGitStatuses(nodes: FileNode[]) {
    for (const node of nodes) {
      if (gitStatuses[node.path]) {
        node.gitStatus = gitStatuses[node.path];
      }
      if (node.children) {
        applyGitStatuses(node.children);
      }
    }
  }
  
  // Toggle node expansion
  async function toggleNode(node: FileNode) {
    if (!node.isDirectory) {
      selectNode(node);
      return;
    }
    
    node.expanded = !node.expanded;
    
    if (node.expanded && !node.children && !testMode) {
      node.loading = true;
      await loadTree(node.path);
    }
    
    // Force complete re-render by triggering reactive statements
    tree = tree.slice(); // Create new array reference
  }
  
  // Select node
  function selectNode(node: FileNode) {
    selectedPath = node.path;
    selectedNode = node;
    dispatch('select', node);
  }
  
  // Filter tree based on search
  function filterTree() {
    let filtered = tree;
    
    // Apply hidden files filter
    if (!showHidden) {
      filtered = filterHiddenFiles(filtered);
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filterNodes(filtered, query);
    }
    
    filteredTree = filtered;
  }
  
  // Filter hidden files recursively
  function filterHiddenFiles(nodes: FileNode[]): FileNode[] {
    return nodes
      .filter(node => !node.name.startsWith('.'))
      .map(node => {
        // Preserve the original node reference to maintain expanded state
        if (node.children) {
          return {
            ...node,
            children: filterHiddenFiles(node.children)
          };
        }
        return node;
      });
  }
  
  // Filter nodes recursively
  function filterNodes(nodes: FileNode[], query: string): FileNode[] {
    const result: FileNode[] = [];
    
    for (const node of nodes) {
      const matches = node.name.toLowerCase().includes(query);
      const childResults = node.children ? filterNodes(node.children, query) : [];
      
      if (matches || childResults.length > 0) {
        result.push({
          ...node,
          children: childResults.length > 0 ? childResults : node.children,
          expanded: childResults.length > 0 ? true : node.expanded
        });
      }
    }
    
    return result;
  }
  
  // Get file icon
  function getFileIcon(node: FileNode): string {
    if (node.isDirectory) {
      return node.expanded ? fileIcons.folderOpen : fileIcons.folder;
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase();
    return fileIcons[ext || ''] || fileIcons.default;
  }
  
  // Flatten tree for rendering
  function getFlattenedTree(nodes: FileNode[], level = 0): Array<{ node: FileNode; level: number }> {
    const result: Array<{ node: FileNode; level: number }> = [];
    
    for (const node of nodes) {
      result.push({ node, level });
      
      if (node.isDirectory && node.expanded && node.children) {
        result.push(...getFlattenedTree(node.children, level + 1));
      }
    }
    
    return result;
  }
  
  // Handle context menu
  function handleContextMenu(event: MouseEvent, node: FileNode) {
    event.preventDefault();
    selectedNode = node;
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    showContextMenu = true;
  }
  
  // Handle file operations
  async function handleNewFile() {
    const parentPath = selectedNode?.isDirectory ? selectedNode.path : 
                       selectedNode ? selectedNode.path.split('/').slice(0, -1).join('/') : 
                       rootPath;
    
    dispatch('newFile', { parentPath });
    showContextMenu = false;
  }
  
  async function handleNewFolder() {
    const parentPath = selectedNode?.isDirectory ? selectedNode.path : 
                       selectedNode ? selectedNode.path.split('/').slice(0, -1).join('/') : 
                       rootPath;
    
    dispatch('newFolder', { parentPath });
    showContextMenu = false;
  }
  
  async function handleRename() {
    if (selectedNode) {
      dispatch('rename', selectedNode);
    }
    showContextMenu = false;
  }
  
  async function handleDelete() {
    if (selectedNode) {
      dispatch('delete', selectedNode);
    }
    showContextMenu = false;
  }
  
  async function handleCopy() {
    if (selectedNode) {
      dispatch('copy', selectedNode);
    }
    showContextMenu = false;
  }
  
  async function handlePaste() {
    const targetPath = selectedNode?.isDirectory ? selectedNode.path : 
                       selectedNode ? selectedNode.path.split('/').slice(0, -1).join('/') : 
                       rootPath;
    
    dispatch('paste', { targetPath });
    showContextMenu = false;
  }
  
  // Watch for file system changes
  async function watchFileSystem() {
    if (testMode) return;
    
    unlisten = await listen('file-system-change', (event: any) => {
      const { path, changeType } = event.payload;
      
      if (path.startsWith(rootPath)) {
        loadTree();
      }
    });
  }
  
  // Lifecycle
  onMount(() => {
    if (testMode && initialTree) {
      tree = initialTree;
      filterTree();
    } else if (autoLoad && !testMode) {
      loadTree();
      watchFileSystem();
    }
  });
  
  onDestroy(() => {
    if (unlisten) {
      unlisten();
    }
  });
  
  // Reactive statements
  $: searchQuery, filterTree();
  $: rootPath && !testMode && loadTree();
  $: tree, filterTree(); // Re-filter when tree changes  
  $: if (testMode && initialTree) {
    tree = initialTree.filter(node => showHidden || !node.name.startsWith('.'));
    filterTree();
  }
</script>

<div class="file-explorer">
  <div class="explorer-header">
    <div class="explorer-title">Files</div>
    <div class="explorer-actions">
      <button 
        class="action-button"
        title="New File"
        on:click={handleNewFile}
      >
        📄
      </button>
      <button 
        class="action-button"
        title="New Folder"
        on:click={handleNewFolder}
      >
        📁
      </button>
      <button 
        class="action-button"
        title="Refresh"
        on:click={() => loadTree()}
      >
        🔄
      </button>
      <button 
        class="action-button"
        title="Toggle Hidden Files"
        class:active={showHidden}
        on:click={() => { showHidden = !showHidden; loadTree(); }}
      >
        👁️
      </button>
    </div>
  </div>
  
  <div class="search-container">
    <input 
      type="text"
      placeholder="Search files..."
      class="search-input"
      bind:value={searchQuery}
    />
  </div>
  
  <div class="tree-container">
    {#if filteredTree.length === 0}
      <div class="empty-state">
        {#if searchQuery}
          No files matching "{searchQuery}"
        {:else}
          No files in this directory
        {/if}
      </div>
    {:else}
      <div class="tree">
        {#each getFlattenedTree(filteredTree) as item (item.node.path)}
          <div class="tree-node" class:selected={item.node.path === selectedPath}>
            <button
              class="node-content"
              on:click={() => toggleNode(item.node)}
              on:contextmenu|preventDefault={e => handleContextMenu(e, item.node)}
              style="padding-left: {item.level * 16 + 8}px"
            >
              <span class="node-icon">
                {getFileIcon(item.node)}
              </span>
              <span class="node-name">
                {item.node.name}
              </span>
              {#if item.node.gitStatus && showGitStatus}
                <span class="git-status" title={item.node.gitStatus.status}>
                  {gitStatusIcons[item.node.gitStatus.status]}
                </span>
              {/if}
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </div>
  
  {#if selectedNode}
    <div class="file-info">
      <div class="info-item">
        <span class="info-label">Name:</span>
        <span class="info-value">{selectedNode.name}</span>
      </div>
      <div class="info-item">
        <span class="info-label">Path:</span>
        <span class="info-value">{selectedNode.path}</span>
      </div>
      {#if selectedNode.size !== undefined}
        <div class="info-item">
          <span class="info-label">Size:</span>
          <span class="info-value">{(selectedNode.size / 1024).toFixed(2)} KB</span>
        </div>
      {/if}
      {#if selectedNode.modified}
        <div class="info-item">
          <span class="info-label">Modified:</span>
          <span class="info-value">{new Date(selectedNode.modified).toLocaleString()}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

{#if showContextMenu && !testMode}
  <ContextMenu 
    x={contextMenuPosition.x}
    y={contextMenuPosition.y}
    on:close={() => showContextMenu = false}
  >
    <button on:click={handleNewFile}>New File</button>
    <button on:click={handleNewFolder}>New Folder</button>
    <hr />
    <button on:click={handleRename} disabled={!selectedNode}>Rename</button>
    <button on:click={handleDelete} disabled={!selectedNode}>Delete</button>
    <hr />
    <button on:click={handleCopy} disabled={!selectedNode}>Copy</button>
    <button on:click={handlePaste}>Paste</button>
  </ContextMenu>
{/if}

<style>
  .file-explorer {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-primary);
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .explorer-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }
  
  .explorer-title {
    font-weight: 600;
    text-transform: uppercase;
    font-size: 11px;
    letter-spacing: 0.5px;
    opacity: 0.7;
  }
  
  .explorer-actions {
    display: flex;
    gap: 4px;
  }
  
  .action-button {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--fg-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.15s;
  }
  
  .action-button:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .action-button.active {
    background: var(--bg-tertiary);
    color: var(--accent);
  }
  
  .search-container {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .search-input {
    width: 100%;
    padding: 6px 10px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 12px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .tree-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  
  .empty-state {
    padding: 40px 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .tree {
    padding: 4px 0;
  }
  
  .tree-node {
    user-select: none;
  }
  
  .node-content {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 4px 8px;
    background: none;
    border: none;
    color: var(--fg-primary);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }
  
  .node-content:hover {
    background: var(--bg-hover);
  }
  
  .tree-node.selected .node-content {
    background: var(--bg-tertiary);
  }
  
  .node-icon {
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .node-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .git-status {
    font-size: 12px;
    margin-left: auto;
    flex-shrink: 0;
  }
  
  .file-info {
    padding: 12px;
    border-top: 1px solid var(--border);
    background: var(--bg-secondary);
    font-size: 11px;
  }
  
  .info-item {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
  }
  
  .info-item:last-child {
    margin-bottom: 0;
  }
  
  .info-label {
    color: var(--fg-secondary);
    min-width: 60px;
  }
  
  .info-value {
    color: var(--fg-primary);
    word-break: break-all;
  }
  
  /* Scrollbar styling */
  .tree-container::-webkit-scrollbar {
    width: 8px;
  }
  
  .tree-container::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .tree-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }
  
  .tree-container::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
</style>