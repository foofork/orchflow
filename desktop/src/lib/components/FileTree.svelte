<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { TreeNode } from '$lib/types';
  import { browser } from '$app/environment';
  
  export let node: TreeNode;
  export let level: number = 0;
  export let selectedPath: string = '';
  export let agents: Map<string, { status: string; pid?: number }> = new Map();
  
  const dispatch = createEventDispatcher();
  
  // Drag and drop state
  let isDragging = false;
  let isDragOver = false;
  let dragCounter = 0; // Track drag enter/leave events
  
  function toggleNode() {
    if (!node.isDirectory) {
      dispatch('select', node.path);
      dispatch('openFile', node.path);
      return;
    }
    
    node.expanded = !node.expanded;
    
    if (node.expanded && (!node.children || node.children.length === 0)) {
      dispatch('expand', node);
    }
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'Enter':
      case ' ':
        event.preventDefault();
        toggleNode();
        break;
      case 'ArrowRight':
        if (node.isDirectory && !node.expanded) {
          event.preventDefault();
          toggleNode();
        }
        break;
      case 'ArrowLeft':
        if (node.isDirectory && node.expanded) {
          event.preventDefault();
          toggleNode();
        }
        break;
    }
  }
  
  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    dispatch('contextMenu', { node, x: event.clientX, y: event.clientY });
  }

  // Drag and drop handlers
  function handleDragStart(event: DragEvent) {
    if (!event.dataTransfer) return;
    
    isDragging = true;
    
    // Set drag data
    const dragData = {
      path: node.path,
      name: node.name,
      isDirectory: node.isDirectory,
      sourceType: 'file-tree'
    };
    
    event.dataTransfer.setData('application/json', JSON.stringify(dragData));
    event.dataTransfer.setData('text/plain', node.path);
    event.dataTransfer.effectAllowed = 'copyMove';
    
    // Create custom drag image
    const dragImage = document.createElement('div');
    dragImage.textContent = `${getFileIcon()} ${node.name}`;
    dragImage.style.cssText = `
      position: absolute;
      top: -1000px;
      left: -1000px;
      background: var(--bg-tertiary);
      color: var(--fg-primary);
      padding: 4px 8px;
      border-radius: 4px;
      border: 1px solid var(--border);
      font-size: 13px;
      font-family: var(--font-family);
      white-space: nowrap;
      z-index: 1000;
    `;
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, 0, 0);
    
    // Clean up drag image after drag starts
    setTimeout(() => {
      if (document.body.contains(dragImage)) {
        document.body.removeChild(dragImage);
      }
    }, 0);
    
    dispatch('dragStart', { node });
  }

  function handleDragEnd(event: DragEvent) {
    isDragging = false;
    dispatch('dragEnd', { node });
  }

  function handleDragOver(event: DragEvent) {
    // Only allow drop on directories
    if (!node.isDirectory) return;
    
    event.preventDefault();
    
    if (event.dataTransfer) {
      // Determine drop effect based on modifiers
      const isCtrlPressed = event.ctrlKey || event.metaKey;
      event.dataTransfer.dropEffect = isCtrlPressed ? 'copy' : 'move';
    }
  }

  function handleDragEnter(event: DragEvent) {
    if (!node.isDirectory) return;
    
    dragCounter++;
    if (dragCounter === 1) {
      isDragOver = true;
    }
    
    event.preventDefault();
  }

  function handleDragLeave(event: DragEvent) {
    if (!node.isDirectory) return;
    
    dragCounter--;
    if (dragCounter === 0) {
      isDragOver = false;
    }
  }

  function handleDrop(event: DragEvent) {
    if (!node.isDirectory || !event.dataTransfer) return;
    
    event.preventDefault();
    isDragOver = false;
    dragCounter = 0;
    
    try {
      const jsonData = event.dataTransfer.getData('application/json');
      if (jsonData) {
        const dragData = JSON.parse(jsonData);
        
        // Enhanced validation
        if (!dragData.path || !dragData.name) {
          console.warn('Invalid drag data');
          dispatch('dropError', { 
            error: new Error('Invalid drag data'), 
            destination: node 
          });
          return;
        }
        
        // Prevent dropping on self or child directories
        if (dragData.path === node.path) {
          console.warn('Cannot drop item into itself');
          dispatch('dropError', { 
            error: new Error('Cannot drop item into itself'), 
            destination: node 
          });
          return;
        }
        
        // For directories, check if target is a subdirectory of the source
        if (dragData.isDirectory && node.path.startsWith(dragData.path + '/')) {
          console.warn('Cannot drop directory into its subdirectory');
          dispatch('dropError', { 
            error: new Error('Cannot drop directory into its subdirectory'), 
            destination: node 
          });
          return;
        }
        
        const isCtrlPressed = event.ctrlKey || event.metaKey;
        const operation = isCtrlPressed ? 'copy' : 'move';
        
        dispatch('fileDrop', {
          source: dragData,
          destination: node,
          operation,
          event
        });
      }
    } catch (error) {
      console.error('Error handling drop:', error);
      dispatch('dropError', { error, destination: node });
    }
  }
  
  function getFileIcon(): string {
    if (node.isDirectory) {
      return node.expanded ? '📂' : '📁';
    }
    
    const ext = node.name.split('.').pop()?.toLowerCase();
    const name = node.name.toLowerCase();
    
    // Special file names
    if (name === 'package.json') return '📦';
    if (name === 'tsconfig.json') return '🔧';
    if (name === '.gitignore') return '🚫';
    if (name === 'readme.md') return '📖';
    if (name === 'license' || name === 'license.md') return '⚖️';
    if (name === 'dockerfile') return '🐋';
    if (name === '.env' || name.endsWith('.env')) return '🔐';
    
    // File extensions
    switch (ext) {
      // JavaScript/TypeScript
      case 'js': return '📜';
      case 'jsx': return '⚛️';
      case 'ts': return '📘';
      case 'tsx': return '⚛️';
      
      // Web
      case 'html': return '🌐';
      case 'css': return '🎨';
      case 'scss':
      case 'sass': return '💅';
      case 'svelte': return '🔥';
      case 'vue': return '💚';
      
      // Data
      case 'json': return '📋';
      case 'yaml':
      case 'yml': return '📐';
      case 'toml': return '🔩';
      case 'xml': return '📰';
      case 'csv': return '📊';
      
      // Documentation
      case 'md':
      case 'mdx': return '📝';
      case 'txt': return '📄';
      case 'pdf': return '📕';
      
      // Images
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'webp': return '🖼️';
      case 'svg': return '🎨';
      case 'ico': return '🎯';
      
      // Programming languages
      case 'py': return '🐍';
      case 'rs': return '🦀';
      case 'go': return '🐹';
      case 'java': return '☕';
      case 'c':
      case 'cpp':
      case 'cc': return '🔷';
      case 'cs': return '🟦';
      case 'php': return '🐘';
      case 'rb': return '💎';
      case 'swift': return '🦉';
      case 'kt': return '🟪';
      case 'dart': return '🎯';
      case 'lua': return '🌙';
      case 'sh':
      case 'bash': return '🖥️';
      
      // Config
      case 'ini':
      case 'cfg':
      case 'conf': return '⚙️';
      
      // Archive
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar': return '📦';
      
      default: return '📄';
    }
  }
  
  function getAgentStatus(): { status: string; color: string } | null {
    const agent = agents.get(node.path);
    if (!agent) return null;
    
    switch (agent.status) {
      case 'running':
        return { status: '●', color: 'var(--success)' };
      case 'error':
        return { status: '●', color: 'var(--error)' };
      case 'warning':
        return { status: '●', color: 'var(--warning)' };
      case 'idle':
        return { status: '●', color: 'var(--fg-tertiary)' };
      default:
        return null;
    }
  }
  
  $: agentStatus = getAgentStatus();
</script>

<div class="tree-node">
  <button
    class="node-item"
    class:selected={selectedPath === node.path}
    class:directory={node.isDirectory}
    class:dragging={isDragging}
    class:drag-over={isDragOver && node.isDirectory}
    draggable="true"
    on:click={toggleNode}
    on:keydown={handleKeyDown}
    on:contextmenu={handleContextMenu}
    on:dragstart={handleDragStart}
    on:dragend={handleDragEnd}
    on:dragover={handleDragOver}
    on:dragenter={handleDragEnter}
    on:dragleave={handleDragLeave}
    on:drop={handleDrop}
    style="padding-left: {8 + level * 16}px"
    tabindex="0"
  >
    {#if node.isDirectory}
      <span class="chevron" class:expanded={node.expanded}>›</span>
    {:else}
      <span class="spacer"></span>
    {/if}
    
    <span class="icon">{getFileIcon()}</span>
    <span class="name">{node.name}</span>
    
    {#if agentStatus}
      <span 
        class="agent-status" 
        style="color: {agentStatus.color}"
        title="Agent {agentStatus.status === '●' ? 'active' : 'inactive'}"
      >
        {agentStatus.status}
      </span>
    {/if}
    
    {#if node.loading}
      <span class="loading">⟳</span>
    {/if}
  </button>
  
  {#if node.isDirectory && node.expanded && node.children}
    <div class="children" transition:slide={{ duration: 150 }}>
      {#each node.children as child (child.path)}
        <svelte:self 
          node={child} 
          level={level + 1} 
          {selectedPath}
          {agents}
          on:select
          on:openFile
          on:expand
          on:contextMenu
          on:dragStart
          on:dragEnd
          on:fileDrop
          on:dropError
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .tree-node {
    user-select: none;
  }
  
  .node-item {
    width: 100%;
    min-height: 22px;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px 1px 0;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 13px;
    color: var(--fg-primary);
    text-align: left;
    transition: background-color 0.1s;
    position: relative;
    font-family: var(--font-family);
  }
  
  .node-item:hover {
    background-color: var(--bg-hover);
  }
  
  .node-item.selected {
    background-color: var(--bg-active);
    color: var(--fg-active);
  }
  
  .node-item:focus-visible {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }
  
  .chevron {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: transform 0.1s;
    color: var(--fg-secondary);
  }
  
  .chevron.expanded {
    transform: rotate(90deg);
  }
  
  .spacer {
    width: 16px;
    flex-shrink: 0;
  }
  
  .icon {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-size: 14px;
  }
  
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 22px;
  }
  
  .directory .name {
    font-weight: 500;
  }
  
  .agent-status {
    font-size: 8px;
    margin-left: 4px;
    flex-shrink: 0;
  }
  
  .loading {
    font-size: 12px;
    margin-left: 4px;
    animation: spin 1s linear infinite;
    color: var(--fg-tertiary);
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .children {
    overflow: hidden;
  }

  /* Drag and drop styles */
  .node-item.dragging {
    opacity: 0.6;
    transform: scale(0.98);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.2s ease;
  }

  .node-item.drag-over {
    background-color: var(--accent) !important;
    color: var(--bg-primary) !important;
    border: 2px dashed var(--accent);
    border-radius: 4px;
    box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.3);
    animation: pulse-drop 1s ease-in-out infinite;
  }

  @keyframes pulse-drop {
    0%, 100% {
      box-shadow: 0 0 0 2px rgba(var(--accent-rgb), 0.3);
    }
    50% {
      box-shadow: 0 0 0 4px rgba(var(--accent-rgb), 0.5);
    }
  }

  .node-item.drag-over::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--accent);
    opacity: 0.15;
    border-radius: 4px;
    pointer-events: none;
  }

  .node-item.drag-over::after {
    content: 'Drop here';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 11px;
    font-weight: 500;
    color: var(--bg-primary);
    opacity: 0.8;
    pointer-events: none;
  }

  /* Drag cursor and interactions */
  .node-item[draggable="true"] {
    cursor: grab;
    transition: transform 0.1s ease;
  }

  .node-item[draggable="true"]:hover:not(.dragging):not(.drag-over) {
    transform: translateX(2px);
  }

  .node-item[draggable="true"]:active {
    cursor: grabbing;
  }

  /* Enhanced focus states for accessibility */
  .node-item:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    border-radius: 4px;
  }

  /* Loading state during drag operations */
  .node-item.loading-drop {
    pointer-events: none;
    opacity: 0.7;
  }

  .node-item.loading-drop::after {
    content: '⟳';
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    animation: spin 1s linear infinite;
    color: var(--accent);
  }
</style>