<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import { browser } from '$app/environment';
  import FileTree from './FileTree.svelte';
  
  const dispatch = createEventDispatcher();
  
  interface TreeNode {
    name: string;
    path: string;
    isDirectory: boolean;
    children?: TreeNode[];
    expanded?: boolean;
    loading?: boolean;
  }
  
  let rootPath = '';
  let tree: TreeNode[] = [];
  let selectedPath = '';
  let error = '';
  
  onMount(async () => {
    if (browser && '__TAURI__' in window) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        // Get current working directory
        rootPath = await invoke('get_current_dir');
        await loadDirectory(rootPath);
      } catch (err) {
        console.error('Failed to load initial directory:', err);
        error = 'Failed to load directory';
      }
    } else {
      // Mock data for browser development
      tree = [
        { name: 'src', path: '/src', isDirectory: true, children: [], expanded: false },
        { name: 'package.json', path: '/package.json', isDirectory: false },
        { name: 'README.md', path: '/README.md', isDirectory: false },
      ];
    }
  });
  
  async function loadDirectory(path: string) {
    if (!browser || !('__TAURI__' in window)) return;
    
    try {
      const { readDir } = await import('@tauri-apps/plugin-fs');
      const entries = await readDir(path);
      const nodes: TreeNode[] = [];
      
      // Sort entries: directories first, then files
      entries.sort((a, b) => {
        const aIsDir = (a as any).isDirectory || false;
        const bIsDir = (b as any).isDirectory || false;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return a.name?.localeCompare(b.name || '') || 0;
      });
      
      for (const entry of entries) {
        // Skip hidden files/folders
        if (entry.name?.startsWith('.')) continue;
        
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
    }
  }
  
  async function toggleNode(node: TreeNode) {
    if (!node.isDirectory) {
      selectedPath = node.path;
      dispatch('openFile', node.path);
      return;
    }
    
    node.expanded = !node.expanded;
    
    if (node.expanded && node.children?.length === 0) {
      node.loading = true;
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
          if (entry.name?.startsWith('.')) continue;
          
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
      }
    }
    
    tree = tree; // Trigger reactivity
  }
  
  function getFileIcon(node: TreeNode): string {
    if (node.isDirectory) {
      return node.expanded ? '📂' : '📁';
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'ts':
      case 'jsx':
      case 'tsx':
        return '📜';
      case 'json':
      case 'yaml':
      case 'yml':
        return '⚙️';
      case 'md':
      case 'mdx':
        return '📝';
      case 'css':
      case 'scss':
      case 'sass':
        return '🎨';
      case 'html':
      case 'svelte':
      case 'vue':
        return '🌐';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return '🖼️';
      case 'rs':
        return '🦀';
      case 'py':
        return '🐍';
      case 'go':
        return '🐹';
      default:
        return '📄';
    }
  }
  
  function handleKeyDown(event: KeyboardEvent, node: TreeNode) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleNode(node);
    }
  }

  // Drag and drop handlers
  async function handleFileDrop(event: CustomEvent) {
    const { source, destination, operation } = event.detail;
    
    try {
      if (!browser || !('__TAURI__' in window)) {
        console.log('Mock drag and drop:', { source, destination, operation });
        return;
      }

      const { invoke } = await import('@tauri-apps/api/core');
      
      // Call appropriate backend command based on operation
      if (operation === 'copy') {
        await invoke('copy_files', {
          files: [source.path],
          destination: destination.path
        });
        console.log(`Copied ${source.name} to ${destination.path}`);
      } else {
        await invoke('move_files', {
          files: [source.path],
          destination: destination.path
        });
        console.log(`Moved ${source.name} to ${destination.path}`);
      }
      
      // Refresh the tree to show the changes
      await loadDirectory(rootPath);
      
      // Dispatch success event
      dispatch('fileOperation', {
        operation,
        source: source.path,
        destination: destination.path,
        success: true
      });
      
    } catch (err) {
      console.error(`Failed to ${operation} file:`, err);
      error = `Failed to ${operation} file: ${err}`;
      
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
    console.error('Drop error:', dropError);
    error = `Drop failed: ${dropError.message || dropError}`;
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

<div class="file-explorer">
  {#if error}
    <div class="error">{error}</div>
  {:else if tree.length === 0}
    <div class="empty">No files in directory</div>
  {:else}
    <div class="tree" role="tree" aria-label="File explorer tree">
      {#each tree as node (node.path)}
        <FileTree 
          {node} 
          level={0} 
          selectedPath={selectedPath}
          agents={new Map()}
          on:select={(e) => selectedPath = e.detail}
          on:openFile={(e) => dispatch('openFile', e.detail)}
          on:expand={async (e) => {
            const node = e.detail;
            if (node.expanded && node.children?.length === 0) {
              node.loading = true;
              try {
                const { readDir } = await import('@tauri-apps/plugin-fs');
                const entries = await readDir(node.path);
                const children = [];
                
                entries.sort((a, b) => {
                  if (a.isDirectory && !b.isDirectory) return -1;
                  if (!a.isDirectory && b.isDirectory) return 1;
                  return a.name?.localeCompare(b.name || '') || 0;
                });
                
                for (const entry of entries) {
                  if (entry.name?.startsWith('.')) continue;
                  
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
              }
              tree = tree; // Trigger reactivity
            }
          }}
          on:contextMenu={(e) => dispatch('contextMenu', e.detail)}
          on:dragStart={handleDragStart}
          on:dragEnd={handleDragEnd}
          on:fileDrop={handleFileDrop}
          on:dropError={handleDropError}
        />
      {/each}
    </div>
  {/if}
  
  <div class="actions">
    <button class="action-button" on:click={() => dispatch('share')} title="Share Project" aria-label="Share current project">
      📤 Share
    </button>
  </div>
</div>

<style>
  .file-explorer {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .tree {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0;
  }
  
  .tree-node {
    user-select: none;
  }
  
  .node-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--fg-primary);
    text-align: left;
    transition: background 0.1s;
    position: relative;
  }
  
  .node-item:hover {
    background: var(--bg-hover);
  }
  
  .node-item.selected {
    background: var(--bg-tertiary);
  }
  
  .node-item.directory {
    font-weight: 500;
  }
  
  .icon {
    font-size: 14px;
    flex-shrink: 0;
  }
  
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .loading {
    font-size: 12px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .children {
    overflow: hidden;
  }
  
  .error,
  .empty {
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .error {
    color: var(--error);
  }
  
  .actions {
    padding: 8px;
    border-top: 1px solid var(--border);
  }
  
  .action-button {
    width: 100%;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .action-button:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  /* Focus styles */
  .node-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  
  /* Screen reader only content */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>