<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let searchQuery = '';
  let searchResults: SearchResult[] = [];
  let searching = false;
  let includePattern = '';
  let excludePattern = '**/node_modules/**,**/.git/**';
  let caseSensitive = false;
  let useRegex = false;
  
  interface SearchResult {
    file: string;
    line: number;
    column: number;
    text: string;
    match: string;
  }
  
  async function performSearch() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }
    
    searching = true;
    try {
      // For now, we'll simulate search results
      // In a real implementation, this would call a Rust command
      searchResults = await simulateSearch(searchQuery);
    } catch (err) {
      console.error('Search failed:', err);
      searchResults = [];
    } finally {
      searching = false;
    }
  }
  
  // Simulate search results for demo
  async function simulateSearch(query: string): Promise<SearchResult[]> {
    // In production, this would be:
    // return await invoke('search_in_files', {
    //   query,
    //   includePattern,
    //   excludePattern,
    //   caseSensitive,
    //   useRegex
    // });
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return [
      {
        file: 'src/main.rs',
        line: 42,
        column: 15,
        text: '    let result = process_data(&input);',
        match: query
      },
      {
        file: 'src/lib.rs',
        line: 156,
        column: 8,
        text: 'fn process_data(data: &str) -> Result<String> {',
        match: query
      },
      {
        file: 'tests/integration_test.rs',
        line: 23,
        column: 20,
        text: '    assert_eq!(process_data("test"), Ok("expected"));',
        match: query
      }
    ];
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      performSearch();
    }
  }
  
  function openResult(result: SearchResult) {
    dispatch('openFile', {
      path: result.file,
      line: result.line,
      column: result.column
    });
  }
  
  function highlightMatch(text: string, match: string): string {
    if (!match) return text;
    
    const regex = new RegExp(`(${match})`, caseSensitive ? 'g' : 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }
</script>

<div class="search-panel">
  <div class="search-header">
    <input
      type="text"
      class="search-input"
      placeholder="Search"
      bind:value={searchQuery}
      on:keydown={handleKeydown}
    />
    <button 
      class="search-button"
      on:click={performSearch}
      disabled={searching || !searchQuery.trim()}
    >
      {searching ? '⟳' : '🔍'}
    </button>
  </div>
  
  <div class="search-options">
    <label class="option">
      <input type="checkbox" bind:checked={caseSensitive} />
      <span>Match Case</span>
    </label>
    <label class="option">
      <input type="checkbox" bind:checked={useRegex} />
      <span>Use Regex</span>
    </label>
  </div>
  
  <div class="search-filters">
    <div class="filter">
      <label for="include">Include:</label>
      <input
        id="include"
        type="text"
        class="filter-input"
        placeholder="e.g., *.rs, *.ts"
        bind:value={includePattern}
      />
    </div>
    <div class="filter">
      <label for="exclude">Exclude:</label>
      <input
        id="exclude"
        type="text"
        class="filter-input"
        placeholder="e.g., **/node_modules/**"
        bind:value={excludePattern}
      />
    </div>
  </div>
  
  <div class="search-results">
    {#if searching}
      <div class="searching">Searching...</div>
    {:else if searchResults.length === 0 && searchQuery}
      <div class="no-results">No results found</div>
    {:else if searchResults.length > 0}
      <div class="results-count">{searchResults.length} results</div>
      {#each searchResults as result}
        <button
          class="result-item"
          on:click={() => openResult(result)}
        >
          <div class="result-file">
            {result.file}:{result.line}:{result.column}
          </div>
          <div class="result-text">
            {@html highlightMatch(result.text.trim(), searchQuery)}
          </div>
        </button>
      {/each}
    {:else}
      <div class="search-hint">
        Type to search across all files
      </div>
    {/if}
  </div>
</div>

<style>
  .search-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
  }
  
  .search-header {
    display: flex;
    gap: 4px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .search-input {
    flex: 1;
    padding: 6px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .search-input:focus {
    outline: none;
    border-color: var(--accent);
  }
  
  .search-button {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .search-button:hover:not(:disabled) {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .search-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .search-options {
    display: flex;
    gap: 16px;
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .option {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--fg-secondary);
    cursor: pointer;
  }
  
  .option input[type="checkbox"] {
    cursor: pointer;
  }
  
  .search-filters {
    padding: 8px;
    border-bottom: 1px solid var(--border);
  }
  
  .filter {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .filter:last-child {
    margin-bottom: 0;
  }
  
  .filter label {
    font-size: 12px;
    color: var(--fg-secondary);
    min-width: 60px;
  }
  
  .filter-input {
    flex: 1;
    padding: 4px 8px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--fg-primary);
    font-size: 12px;
  }
  
  .search-results {
    flex: 1;
    overflow-y: auto;
  }
  
  .searching,
  .no-results,
  .search-hint {
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .results-count {
    padding: 8px 12px;
    font-size: 12px;
    color: var(--fg-secondary);
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
  }
  
  .result-item {
    width: 100%;
    padding: 8px 12px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--border);
    text-align: left;
    cursor: pointer;
    transition: background 0.1s;
  }
  
  .result-item:hover {
    background: var(--bg-hover);
  }
  
  .result-file {
    font-size: 12px;
    color: var(--accent);
    font-family: monospace;
    margin-bottom: 4px;
  }
  
  .result-text {
    font-size: 13px;
    color: var(--fg-primary);
    font-family: monospace;
    white-space: pre-wrap;
    word-break: break-all;
  }
  
  :global(.result-text mark) {
    background: var(--warning);
    color: var(--bg-primary);
    padding: 0 2px;
    border-radius: 2px;
  }
</style>