<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { invoke } from '@tauri-apps/api/tauri';
  import Fuse from 'fuse.js';
  
  const dispatch = createEventDispatcher();
  
  interface SwitchItem {
    id: string;
    title: string;
    path?: string;
    type: 'file' | 'terminal' | 'pane' | 'session' | 'command';
    icon: string;
    description?: string;
    lastAccessed?: Date;
    score?: number;
    metadata?: any;
  }
  
  interface RecentItem {
    id: string;
    timestamp: number;
  }
  
  export let show = false;
  export let mode: 'all' | 'files' | 'terminals' | 'sessions' = 'all';
  export let maxResults = 10;
  
  let searchQuery = '';
  let selectedIndex = 0;
  let searchInput: HTMLInputElement;
  let items: SwitchItem[] = [];
  let filteredItems: SwitchItem[] = [];
  let recentItems: RecentItem[] = [];
  let fuse: Fuse<SwitchItem>;
  let loading = false;
  
  // Icons for different item types
  const typeIcons: Record<string, string> = {
    file: '📄',
    terminal: '💻',
    pane: '🪟',
    session: '📁',
    command: '⚡'
  };
  
  // Load recent items from localStorage
  function loadRecentItems() {
    const stored = localStorage.getItem('orchflow_quick_switcher_recent');
    if (stored) {
      try {
        recentItems = JSON.parse(stored);
      } catch (err) {
        recentItems = [];
      }
    }
  }
  
  // Save recent item
  function saveRecentItem(itemId: string) {
    const existing = recentItems.findIndex(r => r.id === itemId);
    if (existing !== -1) {
      recentItems.splice(existing, 1);
    }
    
    recentItems.unshift({ id: itemId, timestamp: Date.now() });
    recentItems = recentItems.slice(0, 50); // Keep last 50
    
    localStorage.setItem('orchflow_quick_switcher_recent', JSON.stringify(recentItems));
  }
  
  // Get recent score for sorting
  function getRecentScore(itemId: string): number {
    const recent = recentItems.find(r => r.id === itemId);
    if (!recent) return 0;
    
    // Score based on recency (higher = more recent)
    const age = Date.now() - recent.timestamp;
    const hoursSince = age / (1000 * 60 * 60);
    return Math.max(0, 100 - hoursSince);
  }
  
  // Load all available items
  async function loadItems() {
    loading = true;
    items = [];
    
    try {
      const promises = [];
      
      // Load files
      if (mode === 'all' || mode === 'files') {
        promises.push(loadRecentFiles());
        promises.push(loadOpenFiles());
      }
      
      // Load terminals
      if (mode === 'all' || mode === 'terminals') {
        promises.push(loadTerminals());
      }
      
      // Load sessions
      if (mode === 'all' || mode === 'sessions') {
        promises.push(loadSessions());
      }
      
      const results = await Promise.all(promises);
      items = results.flat();
      
      // Sort by recent access and score
      items.sort((a, b) => {
        const recentA = getRecentScore(a.id);
        const recentB = getRecentScore(b.id);
        
        if (recentA !== recentB) {
          return recentB - recentA;
        }
        
        // Then by last accessed time
        if (a.lastAccessed && b.lastAccessed) {
          return b.lastAccessed.getTime() - a.lastAccessed.getTime();
        }
        
        return 0;
      });
      
      // Initialize fuzzy search
      initializeFuse();
      
      // Filter initial results
      filterItems();
    } catch (err) {
      console.error('Failed to load items:', err);
    } finally {
      loading = false;
    }
  }
  
  async function loadRecentFiles(): Promise<SwitchItem[]> {
    try {
      // Get recent files from file manager
      const recentFiles = await invoke('get_file_operation_history', { limit: 20 });
      
      return (recentFiles as any[]).map((file: any) => ({
        id: `file:${file.path}`,
        title: file.path.split('/').pop() || file.path,
        path: file.path,
        type: 'file' as const,
        icon: getFileIcon(file.path),
        description: file.path,
        lastAccessed: new Date(file.timestamp)
      }));
    } catch (err) {
      console.error('Failed to load recent files:', err);
      return [];
    }
  }
  
  async function loadOpenFiles(): Promise<SwitchItem[]> {
    // In a real implementation, this would get open files from the editor
    // For now, return mock data
    return [
      {
        id: 'file:current',
        title: 'QuickSwitcher.svelte',
        path: '/src/lib/components/QuickSwitcher.svelte',
        type: 'file',
        icon: '🧡',
        description: 'Currently editing',
        lastAccessed: new Date()
      }
    ];
  }
  
  async function loadTerminals(): Promise<SwitchItem[]> {
    try {
      const sessionInfo = await invoke('get_sessions');
      const sessions = sessionInfo as any[];
      
      const terminals: SwitchItem[] = [];
      
      for (const session of sessions) {
        const panes = await invoke('get_panes', { sessionId: session.id });
        
        for (const pane of (panes as any[])) {
          if (pane.pane_type === 'terminal') {
            terminals.push({
              id: `terminal:${pane.id}`,
              title: pane.title || `Terminal ${pane.id.slice(0, 8)}`,
              type: 'terminal',
              icon: '💻',
              description: pane.working_dir || 'Terminal',
              lastAccessed: pane.last_activity ? new Date(pane.last_activity) : undefined,
              metadata: { sessionId: session.id, paneId: pane.id }
            });
          }
        }
      }
      
      return terminals;
    } catch (err) {
      console.error('Failed to load terminals:', err);
      return [];
    }
  }
  
  async function loadSessions(): Promise<SwitchItem[]> {
    try {
      const sessions = await invoke('get_sessions');
      
      return (sessions as any[]).map((session: any) => ({
        id: `session:${session.id}`,
        title: session.name,
        type: 'session' as const,
        icon: '📁',
        description: `${session.pane_count || 0} panes`,
        lastAccessed: session.last_accessed ? new Date(session.last_accessed) : undefined,
        metadata: { sessionId: session.id }
      }));
    } catch (err) {
      console.error('Failed to load sessions:', err);
      return [];
    }
  }
  
  function getFileIcon(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const icons: Record<string, string> = {
      js: '🟨',
      ts: '🔷',
      svelte: '🧡',
      rs: '🦀',
      py: '🐍',
      json: '📋',
      md: '📝',
      css: '🎨',
      html: '🌐'
    };
    return icons[ext || ''] || '📄';
  }
  
  // Initialize Fuse.js for fuzzy search
  function initializeFuse() {
    fuse = new Fuse(items, {
      keys: [
        { name: 'title', weight: 0.6 },
        { name: 'path', weight: 0.3 },
        { name: 'description', weight: 0.1 }
      ],
      threshold: 0.3,
      includeScore: true,
      sortFn: (a, b) => {
        // Custom sort that includes recent score
        const recentA = getRecentScore(items[a.idx].id);
        const recentB = getRecentScore(items[b.idx].id);
        
        if (recentA !== recentB) {
          return recentB - recentA;
        }
        
        return a.score - b.score;
      }
    });
  }
  
  // Filter items based on search query
  function filterItems() {
    if (!searchQuery) {
      // Show recent items first when no query
      filteredItems = items.slice(0, maxResults);
      return;
    }
    
    const results = fuse.search(searchQuery);
    filteredItems = results
      .slice(0, maxResults)
      .map(result => ({
        ...result.item,
        score: result.score
      }));
  }
  
  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredItems.length - 1);
        scrollToSelected();
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;
      case 'Enter':
        event.preventDefault();
        if (filteredItems[selectedIndex]) {
          selectItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
      case 'Tab':
        event.preventDefault();
        // Cycle through modes
        const modes: Array<typeof mode> = ['all', 'files', 'terminals', 'sessions'];
        const currentIndex = modes.indexOf(mode);
        mode = modes[(currentIndex + 1) % modes.length];
        loadItems();
        break;
    }
  }
  
  function scrollToSelected() {
    const element = document.querySelector(`.switch-item:nth-child(${selectedIndex + 1})`);
    element?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  
  async function selectItem(item: SwitchItem) {
    saveRecentItem(item.id);
    
    switch (item.type) {
      case 'file':
        dispatch('openFile', { path: item.path });
        break;
      case 'terminal':
        dispatch('switchToTerminal', item.metadata);
        break;
      case 'session':
        dispatch('switchToSession', item.metadata);
        break;
      case 'pane':
        dispatch('switchToPane', item.metadata);
        break;
      case 'command':
        dispatch('executeCommand', item.metadata);
        break;
    }
    
    close();
  }
  
  function close() {
    show = false;
    dispatch('close');
  }
  
  function getModeLabel(): string {
    switch (mode) {
      case 'files': return 'Files';
      case 'terminals': return 'Terminals';
      case 'sessions': return 'Sessions';
      default: return 'All Items';
    }
  }
  
  // Lifecycle
  $: if (show) {
    loadRecentItems();
    loadItems();
    if (searchInput) {
      searchInput.focus();
      searchQuery = '';
      selectedIndex = 0;
    }
  }
  
  $: searchQuery, filterItems();
  
  onMount(() => {
    loadRecentItems();
  });
</script>

{#if show}
  <div class="quick-switcher-overlay" on:click={close} transition:fade={{ duration: 150 }}>
    <div 
      class="quick-switcher" 
      on:click|stopPropagation
      transition:fly={{ y: -20, duration: 200 }}
    >
      <div class="search-header">
        <div class="search-container">
          <span class="search-icon">🔍</span>
          <input 
            bind:this={searchInput}
            bind:value={searchQuery}
            type="text" 
            placeholder="Search {getModeLabel().toLowerCase()}..."
            class="search-input"
            on:keydown={handleKeydown}
            autocomplete="off"
            spellcheck="false"
          />
          <div class="mode-indicator">
            <span class="mode-label">{getModeLabel()}</span>
            <kbd>Tab</kbd>
          </div>
        </div>
      </div>
      
      <div class="results-container">
        {#if loading}
          <div class="loading">
            <span class="spinner">⟳</span>
            Loading...
          </div>
        {:else if filteredItems.length === 0}
          <div class="no-results">
            {#if searchQuery}
              No items found for "{searchQuery}"
            {:else}
              No recent items
            {/if}
          </div>
        {:else}
          <div class="results-list">
            {#each filteredItems as item, index}
              <button
                class="switch-item"
                class:selected={index === selectedIndex}
                on:click={() => selectItem(item)}
                on:mouseenter={() => selectedIndex = index}
              >
                <span class="item-icon">{item.icon || typeIcons[item.type]}</span>
                <div class="item-content">
                  <div class="item-title">{item.title}</div>
                  {#if item.description}
                    <div class="item-description">{item.description}</div>
                  {/if}
                </div>
                {#if item.score !== undefined}
                  <div class="item-score" title="Match score">
                    {Math.round((1 - item.score) * 100)}%
                  </div>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="help-footer">
        <div class="help-item">
          <kbd>↑↓</kbd> Navigate
        </div>
        <div class="help-item">
          <kbd>Enter</kbd> Select
        </div>
        <div class="help-item">
          <kbd>Tab</kbd> Change Mode
        </div>
        <div class="help-item">
          <kbd>Esc</kbd> Cancel
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .quick-switcher-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    z-index: 4000;
  }
  
  .quick-switcher {
    width: 90%;
    max-width: 600px;
    max-height: 70vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
    display: flex;
    flex-direction: column;
  }
  
  .search-header {
    padding: 16px;
    border-bottom: 1px solid var(--border);
  }
  
  .search-container {
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
  }
  
  .search-icon {
    font-size: 20px;
    opacity: 0.6;
  }
  
  .search-input {
    flex: 1;
    background: transparent;
    border: none;
    color: var(--fg-primary);
    font-size: 18px;
    outline: none;
    font-weight: 300;
  }
  
  .search-input::placeholder {
    color: var(--fg-tertiary);
  }
  
  .mode-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--fg-secondary);
    font-size: 14px;
  }
  
  .mode-label {
    font-weight: 500;
  }
  
  .results-container {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 40px;
    color: var(--fg-secondary);
    font-size: 14px;
  }
  
  .spinner {
    font-size: 18px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .no-results {
    text-align: center;
    padding: 40px;
    color: var(--fg-tertiary);
    font-size: 14px;
  }
  
  .results-list {
    padding: 0 8px;
  }
  
  .switch-item {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    padding: 12px 16px;
    background: none;
    border: none;
    border-radius: 8px;
    color: var(--fg-primary);
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    margin-bottom: 4px;
  }
  
  .switch-item:hover {
    background: var(--bg-hover);
  }
  
  .switch-item.selected {
    background: var(--bg-tertiary);
    box-shadow: 0 0 0 1px var(--accent) inset;
  }
  
  .item-icon {
    font-size: 20px;
    width: 28px;
    text-align: center;
    flex-shrink: 0;
  }
  
  .item-content {
    flex: 1;
    min-width: 0;
  }
  
  .item-title {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .item-description {
    font-size: 12px;
    color: var(--fg-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-top: 2px;
  }
  
  .item-score {
    font-size: 11px;
    color: var(--fg-tertiary);
    background: var(--bg-tertiary);
    padding: 2px 8px;
    border-radius: 12px;
    flex-shrink: 0;
  }
  
  .help-footer {
    display: flex;
    gap: 20px;
    padding: 12px 16px;
    border-top: 1px solid var(--border);
    background: var(--bg-tertiary);
    font-size: 12px;
    color: var(--fg-secondary);
  }
  
  .help-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  
  kbd {
    display: inline-block;
    padding: 2px 6px;
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
  
  /* Custom scrollbar */
  .results-container::-webkit-scrollbar {
    width: 8px;
  }
  
  .results-container::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .results-container::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }
  
  .results-container::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
</style>