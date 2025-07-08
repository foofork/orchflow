<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Dialog from './Dialog.svelte';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let currentDirectory = '';
  
  interface TrashedItem {
    id: string;
    original_path: string;
    name: string;
    size: number;
    is_directory: boolean;
    trashed_at: string;
    metadata: Record<string, string>;
  }
  
  interface TrashStats {
    total_items: number;
    total_size: number;
    file_count: number;
    directory_count: number;
  }
  
  let trashedItems: TrashedItem[] = [];
  let filteredItems: TrashedItem[] = [];
  let selectedItems = new Set<string>();
  let trashStats: TrashStats | null = null;
  let loading = false;
  let error = '';
  let searchQuery = '';
  let sortBy: 'name' | 'date' | 'size' = 'date';
  let sortAscending = false;
  let showEmptyConfirm = false;
  
  onMount(() => {
    if (show) {
      loadTrash();
    }
  });
  
  async function loadTrash() {
    loading = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      // Load items and stats in parallel
      const [items, stats] = await Promise.all([
        currentDirectory 
          ? invoke('get_trash_from_directory', { path: currentDirectory })
          : invoke('list_trash'),
        invoke('get_trash_stats')
      ]);
      
      trashedItems = items as TrashedItem[];
      trashStats = stats as TrashStats;
      filterAndSortItems();
    } catch (err) {
      error = `Failed to load trash: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  async function searchTrash() {
    if (!searchQuery.trim()) {
      await loadTrash();
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      trashedItems = await invoke('search_trash', { query: searchQuery });
      filterAndSortItems();
    } catch (err) {
      error = `Search failed: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  function filterAndSortItems() {
    filteredItems = [...trashedItems];
    
    // Sort items
    filteredItems.sort((a, b) => {
      let result = 0;
      
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name);
          break;
        case 'date':
          result = new Date(b.trashed_at).getTime() - new Date(a.trashed_at).getTime();
          break;
        case 'size':
          result = b.size - a.size;
          break;
      }
      
      return sortAscending ? -result : result;
    });
  }
  
  function toggleSort(column: 'name' | 'date' | 'size') {
    if (sortBy === column) {
      sortAscending = !sortAscending;
    } else {
      sortBy = column;
      sortAscending = false;
    }
    filterAndSortItems();
  }
  
  function toggleSelection(id: string) {
    if (selectedItems.has(id)) {
      selectedItems.delete(id);
    } else {
      selectedItems.add(id);
    }
    selectedItems = selectedItems;
  }
  
  function selectAll() {
    filteredItems.forEach(item => selectedItems.add(item.id));
    selectedItems = selectedItems;
  }
  
  function deselectAll() {
    selectedItems.clear();
    selectedItems = selectedItems;
  }
  
  async function restoreSelected() {
    if (selectedItems.size === 0) return;
    
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      // For now, we'll need to implement restore functionality
      // This would require tracking original paths and recreating files
      error = 'Restore functionality not yet implemented';
    } catch (err) {
      error = `Restore failed: ${err}`;
    }
  }
  
  async function emptyTrash() {
    loading = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      await invoke('empty_trash');
      
      showEmptyConfirm = false;
      await loadTrash();
      
      dispatch('emptied');
    } catch (err) {
      error = `Failed to empty trash: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  async function cleanupOldItems(days: number) {
    loading = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      const removed = await invoke('cleanup_old_trash', { days });
      
      await loadTrash();
      
      dispatch('cleaned', { removed });
    } catch (err) {
      error = `Cleanup failed: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  function formatSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }
  
  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Today';
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }
</script>

<Dialog 
  title="Trash Manager" 
  {show}
  width="900px"
  on:close={() => show = false}
>
  <div class="trash-manager">
    <div class="toolbar">
      <div class="search-box">
        <input
          type="text"
          placeholder="Search trash..."
          bind:value={searchQuery}
          on:input={searchTrash}
          disabled={loading}
        />
      </div>
      
      {#if trashStats}
        <div class="stats">
          <span>{trashStats.total_items} items</span>
          <span class="separator">•</span>
          <span>{formatSize(trashStats.total_size)}</span>
        </div>
      {/if}
      
      <div class="actions">
        <button 
          class="btn-small"
          on:click={() => cleanupOldItems(30)}
          disabled={loading}
          title="Remove items older than 30 days"
        >
          Clean Old
        </button>
        
        <button 
          class="btn-small btn-danger"
          on:click={() => showEmptyConfirm = true}
          disabled={loading || trashedItems.length === 0}
        >
          Empty Trash
        </button>
      </div>
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    {#if loading}
      <div class="loading">
        <span class="spinner">⟳</span> Loading trash...
      </div>
    {:else if filteredItems.length === 0}
      <div class="empty-state">
        <span class="empty-icon">🗑️</span>
        <p>Trash is empty</p>
      </div>
    {:else}
      <div class="selection-bar">
        <div class="selection-controls">
          <button class="btn-small" on:click={selectAll}>Select All</button>
          <button class="btn-small" on:click={deselectAll}>Select None</button>
        </div>
        
        {#if selectedItems.size > 0}
          <div class="selection-actions">
            <span>{selectedItems.size} selected</span>
            <button 
              class="btn-small btn-primary"
              on:click={restoreSelected}
            >
              Restore
            </button>
          </div>
        {/if}
      </div>
      
      <div class="items-table">
        <div class="table-header">
          <div class="col-checkbox">
            <input
              type="checkbox"
              checked={selectedItems.size === filteredItems.length}
              on:change={(e) => e.target.checked ? selectAll() : deselectAll()}
            />
          </div>
          <div class="col-name sortable" on:click={() => toggleSort('name')}>
            Name
            {#if sortBy === 'name'}
              <span class="sort-arrow">{sortAscending ? '↑' : '↓'}</span>
            {/if}
          </div>
          <div class="col-path">Original Location</div>
          <div class="col-size sortable" on:click={() => toggleSort('size')}>
            Size
            {#if sortBy === 'size'}
              <span class="sort-arrow">{sortAscending ? '↑' : '↓'}</span>
            {/if}
          </div>
          <div class="col-date sortable" on:click={() => toggleSort('date')}>
            Deleted
            {#if sortBy === 'date'}
              <span class="sort-arrow">{sortAscending ? '↑' : '↓'}</span>
            {/if}
          </div>
        </div>
        
        <div class="table-body">
          {#each filteredItems as item}
            <div class="table-row" class:selected={selectedItems.has(item.id)}>
              <div class="col-checkbox">
                <input
                  type="checkbox"
                  checked={selectedItems.has(item.id)}
                  on:change={() => toggleSelection(item.id)}
                />
              </div>
              <div class="col-name">
                <span class="file-icon">
                  {item.is_directory ? '📁' : '📄'}
                </span>
                <span class="file-name">{item.name}</span>
              </div>
              <div class="col-path" title={item.original_path}>
                {item.original_path}
              </div>
              <div class="col-size">
                {formatSize(item.size)}
              </div>
              <div class="col-date">
                {formatDate(item.trashed_at)}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="actions">
    <button class="btn btn-secondary" on:click={() => show = false}>
      Close
    </button>
  </div>
</Dialog>

{#if showEmptyConfirm}
  <Dialog
    title="Empty Trash"
    show={showEmptyConfirm}
    on:close={() => showEmptyConfirm = false}
  >
    <div class="confirm-dialog">
      <p>Are you sure you want to permanently delete all items in the trash?</p>
      <p class="warning">This action cannot be undone.</p>
      
      {#if trashStats}
        <div class="trash-info">
          <strong>{trashStats.total_items} items</strong> totaling 
          <strong>{formatSize(trashStats.total_size)}</strong> will be deleted.
        </div>
      {/if}
    </div>
    
    <div slot="actions">
      <button class="btn btn-secondary" on:click={() => showEmptyConfirm = false}>
        Cancel
      </button>
      <button class="btn btn-danger" on:click={emptyTrash}>
        Empty Trash
      </button>
    </div>
  </Dialog>
{/if}

<style>
  .trash-manager {
    display: flex;
    flex-direction: column;
    height: 600px;
    max-height: 70vh;
  }
  
  .toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
  }
  
  .search-box {
    flex: 1;
  }
  
  .search-box input {
    width: 100%;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .stats {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .separator {
    color: var(--fg-tertiary);
  }
  
  .actions {
    display: flex;
    gap: 8px;
  }
  
  .error-message {
    padding: 8px 12px;
    background: var(--error-bg);
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--error);
    font-size: 13px;
    margin: 8px 0;
  }
  
  .loading,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px 20px;
    color: var(--fg-tertiary);
  }
  
  .spinner {
    font-size: 24px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .empty-icon {
    font-size: 48px;
    opacity: 0.5;
  }
  
  .selection-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  
  .selection-controls,
  .selection-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .selection-actions span {
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .btn-small {
    padding: 4px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--fg-primary);
    font-size: 12px;
    cursor: pointer;
  }
  
  .btn-small:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .btn-small:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-small.btn-primary {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }
  
  .btn-small.btn-danger {
    background: var(--error);
    color: white;
    border-color: var(--error);
  }
  
  .items-table {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .table-header,
  .table-row {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    font-size: 13px;
  }
  
  .table-header {
    background: var(--bg-tertiary);
    font-weight: 500;
    color: var(--fg-secondary);
    border-bottom: 1px solid var(--border);
  }
  
  .table-body {
    flex: 1;
    overflow-y: auto;
  }
  
  .table-row {
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  
  .table-row:hover {
    background: var(--bg-hover);
  }
  
  .table-row.selected {
    background: var(--selection-bg);
  }
  
  .col-checkbox {
    width: 40px;
  }
  
  .col-name {
    flex: 2;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  
  .col-path {
    flex: 3;
    color: var(--fg-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .col-size {
    width: 80px;
    text-align: right;
  }
  
  .col-date {
    width: 120px;
    text-align: right;
    color: var(--fg-secondary);
  }
  
  .sortable {
    cursor: pointer;
    user-select: none;
  }
  
  .sortable:hover {
    color: var(--fg-primary);
  }
  
  .sort-arrow {
    margin-left: 4px;
    font-size: 11px;
  }
  
  .file-icon {
    font-size: 16px;
  }
  
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .confirm-dialog {
    padding: 12px 0;
  }
  
  .confirm-dialog p {
    margin: 8px 0;
    font-size: 14px;
  }
  
  .warning {
    color: var(--warning);
    font-weight: 500;
  }
  
  .trash-info {
    margin-top: 16px;
    padding: 12px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 13px;
    text-align: center;
  }
  
  /* Scrollbar */
  .table-body::-webkit-scrollbar {
    width: 10px;
  }
  
  .table-body::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .table-body::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 5px;
  }
  
  .table-body::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
</style>