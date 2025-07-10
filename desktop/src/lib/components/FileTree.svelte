<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import type { TreeNode } from '$lib/types';
  
  export let node: TreeNode;
  export let level: number = 0;
  export let selectedPath: string = '';
  export let agents: Map<string, { status: string; pid?: number }> = new Map();
  
  const dispatch = createEventDispatcher();
  
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
    on:click={toggleNode}
    on:keydown={handleKeyDown}
    on:contextmenu={handleContextMenu}
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
</style>