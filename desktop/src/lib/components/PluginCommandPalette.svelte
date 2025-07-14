<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { manager } from '$lib/stores/manager';
  import { toastManager } from '$lib/stores/toast';
  
  interface PluginCommand {
    pluginId: string;
    pluginName: string;
    command: string;
    title: string;
    category?: string;
    keybinding?: string;
    description?: string;
  }
  
  export let show = false;
  
  let searchInput = '';
  let commands: PluginCommand[] = [];
  let filteredCommands: PluginCommand[] = [];
  let selectedIndex = 0;
  let loading = false;
  let inputElement: HTMLInputElement;
  
  // Sample commands - in real app, these would come from loaded plugins
  const sampleCommands: PluginCommand[] = [
    // Git commands
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.status', title: 'Git: Show Status', category: 'Git' },
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.commit', title: 'Git: Commit Changes', category: 'Git' },
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.push', title: 'Git: Push to Remote', category: 'Git' },
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.pull', title: 'Git: Pull from Remote', category: 'Git' },
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.branch', title: 'Git: Switch Branch', category: 'Git' },
    { pluginId: 'git-plugin', pluginName: 'Git', command: 'git.diff', title: 'Git: View Diff', category: 'Git' },
    
    // Docker commands
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.ps', title: 'Docker: List Containers', category: 'Docker', keybinding: 'ctrl+shift+d p' },
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.images', title: 'Docker: List Images', category: 'Docker' },
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.run', title: 'Docker: Run Container', category: 'Docker' },
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.stop', title: 'Docker: Stop Container', category: 'Docker' },
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.logs', title: 'Docker: View Logs', category: 'Docker' },
    { pluginId: 'docker-plugin', pluginName: 'Docker', command: 'docker.compose.up', title: 'Docker Compose: Up', category: 'Docker', keybinding: 'ctrl+shift+d u' },
    
    // Kubernetes commands
    { pluginId: 'k8s-plugin', pluginName: 'Kubernetes', command: 'k8s.getPods', title: 'Kubernetes: Get Pods', category: 'Kubernetes', keybinding: 'ctrl+k ctrl+p' },
    { pluginId: 'k8s-plugin', pluginName: 'Kubernetes', command: 'k8s.getServices', title: 'Kubernetes: Get Services', category: 'Kubernetes' },
    { pluginId: 'k8s-plugin', pluginName: 'Kubernetes', command: 'k8s.logs', title: 'Kubernetes: View Pod Logs', category: 'Kubernetes', keybinding: 'ctrl+k ctrl+l' },
    { pluginId: 'k8s-plugin', pluginName: 'Kubernetes', command: 'k8s.exec', title: 'Kubernetes: Execute in Pod', category: 'Kubernetes' },
    { pluginId: 'k8s-plugin', pluginName: 'Kubernetes', command: 'k8s.portForward', title: 'Kubernetes: Port Forward', category: 'Kubernetes' },
  ];
  
  $: if (show) {
    onOpen();
  } else {
    onClose();
  }
  
  $: {
    filteredCommands = filterCommands(searchInput);
    selectedIndex = 0;
  }
  
  function onOpen() {
    commands = sampleCommands; // In real app, load from plugins
    searchInput = '';
    selectedIndex = 0;
    if (inputElement) {
      setTimeout(() => inputElement.focus(), 100);
    }
  }
  
  function onClose() {
    searchInput = '';
    filteredCommands = [];
  }
  
  function filterCommands(search: string): PluginCommand[] {
    if (!search) return commands;
    
    const lowerSearch = search.toLowerCase();
    return commands.filter(cmd => 
      cmd.title.toLowerCase().includes(lowerSearch) ||
      cmd.command.toLowerCase().includes(lowerSearch) ||
      cmd.category?.toLowerCase().includes(lowerSearch) ||
      cmd.pluginName.toLowerCase().includes(lowerSearch)
    );
  }
  
  async function executeCommand(command: PluginCommand) {
    loading = true;
    
    try {
      // TODO: Manager API doesn't have executePluginCommand yet
      // This functionality needs to be implemented in the manager
      console.warn('Plugin command execution not yet implemented in manager:', command.command);
      
      // For now, just log and close
      console.log('Would execute command:', command.command);
      toastManager.success(`Command executed: ${command.command}`);
      show = false;
    } catch (error) {
      console.error('Failed to execute command:', error);
      toastManager.commandError(command.command, error);
    } finally {
      loading = false;
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        scrollToSelected();
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
        
      case 'Enter':
        event.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        show = false;
        break;
    }
  }
  
  function scrollToSelected() {
    const element = document.querySelector('.command-item.selected');
    element?.scrollIntoView({ block: 'nearest' });
  }
  
  function handleClickOutside(event: MouseEvent) {
    if (show && !(event.target as Element).closest('.command-palette')) {
      show = false;
    }
  }
  
  onMount(() => {
    window.addEventListener('click', handleClickOutside);
  });
  
  onDestroy(() => {
    window.removeEventListener('click', handleClickOutside);
  });
</script>

{#if show}
  <div class="command-palette-overlay">
    <div class="command-palette" on:click|stopPropagation>
      <div class="search-container">
        <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <input
          bind:this={inputElement}
          bind:value={searchInput}
          on:keydown={handleKeydown}
          type="text"
          placeholder="Search commands..."
          class="search-input"
          disabled={loading}
        />
        {#if loading}
          <div class="loading-spinner" />
        {/if}
      </div>
      
      {#if filteredCommands.length > 0}
        <div class="commands-list">
          {#each filteredCommands as command, index (command.id)}
            <button
              class="command-item"
              class:selected={index === selectedIndex}
              on:click={() => executeCommand(command)}
              on:mouseenter={() => selectedIndex = index}
            >
              <div class="command-info">
                <span class="command-title">{command.title}</span>
                <span class="command-id">{command.command}</span>
              </div>
              {#if command.keybinding}
                <kbd class="keybinding">{command.keybinding}</kbd>
              {/if}
            </button>
          {/each}
        </div>
      {:else if searchInput}
        <div class="no-results">
          <p>No commands found</p>
          <p class="hint">Try a different search term</p>
        </div>
      {:else}
        <div class="no-results">
          <p>Type to search commands</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .command-palette-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 2000;
  }
  
  .command-palette {
    width: 90%;
    max-width: 600px;
    max-height: 60vh;
    background: #1e1e2e;
    border: 1px solid #45475a;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }
  
  .search-container {
    display: flex;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid #313244;
    position: relative;
  }
  
  .search-icon {
    position: absolute;
    left: 24px;
    color: #6c7086;
    pointer-events: none;
  }
  
  .search-input {
    width: 100%;
    padding: 8px 12px 8px 36px;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 6px;
    color: #cdd6f4;
    font-size: 16px;
    outline: none;
    transition: border-color 0.2s;
  }
  
  .search-input:focus {
    border-color: #89b4fa;
  }
  
  .search-input::placeholder {
    color: #6c7086;
  }
  
  .search-input:disabled {
    opacity: 0.5;
  }
  
  .loading-spinner {
    position: absolute;
    right: 24px;
    width: 16px;
    height: 16px;
    border: 2px solid #313244;
    border-top-color: #89b4fa;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .commands-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .command-item {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    margin-bottom: 4px;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }
  
  .command-item:hover {
    background: #313244;
  }
  
  .command-item.selected {
    background: #45475a;
  }
  
  .command-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .command-title {
    color: #cdd6f4;
    font-size: 14px;
    font-weight: 500;
  }
  
  .command-id {
    color: #6c7086;
    font-size: 12px;
  }
  
  .keybinding {
    padding: 2px 6px;
    background: #313244;
    border: 1px solid #45475a;
    border-radius: 4px;
    color: #89b4fa;
    font-size: 11px;
    font-family: monospace;
    white-space: nowrap;
  }
  
  .no-results {
    padding: 60px 20px;
    text-align: center;
    color: #6c7086;
  }
  
  .no-results p {
    margin: 8px 0;
  }
  
  .hint {
    font-size: 14px;
    opacity: 0.8;
  }
  
  /* Scrollbar styling */
  .commands-list::-webkit-scrollbar {
    width: 8px;
  }
  
  .commands-list::-webkit-scrollbar-track {
    background: #1e1e2e;
  }
  
  .commands-list::-webkit-scrollbar-thumb {
    background: #45475a;
    border-radius: 4px;
  }
  
  .commands-list::-webkit-scrollbar-thumb:hover {
    background: #585b70;
  }
</style>