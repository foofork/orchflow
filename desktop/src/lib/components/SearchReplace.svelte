<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Dialog from './Dialog.svelte';
  import type { SearchOptions, SearchResults, ReplaceResult } from '$lib/types';
  
  const dispatch = createEventDispatcher();
  
  export let show = false;
  export let initialPattern = '';
  export let testMode = false;
  export let autoLoad = true;
  export let initialResults: SearchResults | null = null;
  
  // Search state
  let searchPattern = initialPattern;
  let replacePattern = '';
  let caseSensitive = false;
  let wholeWord = false;
  let useRegex = false;
  let searchPath = '';
  let includePatterns: string[] = [];
  let excludePatterns: string[] = ['node_modules/**', 'target/**', '.git/**'];
  let includePatternsText = '';
  let excludePatternsText = excludePatterns.join('\n');
  
  // Results state
  let searchResults: SearchResults | null = null;
  let selectedFiles = new Set<string>();
  let loading = false;
  let error = '';
  
  // Replace state
  let replaceMode = false;
  let replacePreview: ReplaceResult[] = [];
  let replacing = false;
  
  // History and saved searches
  let searchHistory: string[] = [];
  let savedSearches: Array<{ name: string; options: SearchOptions }> = [];
  let showSaveDialog = false;
  let saveSearchName = '';
  
  onMount(async () => {
    if (testMode && initialResults) {
      searchResults = initialResults;
    } else if (autoLoad && browser && '__TAURI__' in window && !testMode) {
      await loadSearchHistory();
      await loadSavedSearches();
    }
  });
  
  async function loadSearchHistory() {
    if (testMode) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      searchHistory = await invoke('get_search_history', { limit: 20 });
    } catch (err) {
      console.error('Failed to load search history:', err);
    }
  }
  
  async function loadSavedSearches() {
    if (testMode) return;
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      savedSearches = await invoke('get_saved_searches');
    } catch (err) {
      console.error('Failed to load saved searches:', err);
    }
  }
  
  async function performSearch() {
    if (!searchPattern.trim()) {
      error = 'Search pattern cannot be empty';
      return;
    }
    
    if (testMode && initialResults) {
      searchResults = initialResults;
      // Auto-select all files by default
      if (searchResults?.results) {
        searchResults.results.forEach(r => {
          selectedFiles.add(r.path);
        });
        selectedFiles = selectedFiles;
      }
      return;
    }
    
    loading = true;
    error = '';
    searchResults = null;
    selectedFiles.clear();
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      const options: SearchOptions = {
        pattern: searchPattern,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex: useRegex,
        path: searchPath || null,
        include_patterns: includePatterns.filter(p => p.trim()),
        exclude_patterns: excludePatterns.filter(p => p.trim()),
        max_results: 1000,
        context_lines: 2,
        follow_symlinks: false,
        search_hidden: false,
        max_file_size: 10 * 1024 * 1024,
      };
      
      searchResults = await invoke('search_project', { options });
      
      // Auto-select all files by default
      if (searchResults?.results) {
        searchResults.results.forEach(r => {
          selectedFiles.add(r.path);
        });
        selectedFiles = selectedFiles;
      }
      
      await loadSearchHistory();
    } catch (err) {
      error = `Search failed: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  async function previewReplace() {
    if (!searchPattern.trim() || !replacePattern.trim()) {
      error = 'Both search and replace patterns are required';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      const options: SearchOptions = {
        pattern: searchPattern,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex: useRegex,
        path: searchPath || null,
        include_patterns: includePatterns.filter(p => p.trim()),
        exclude_patterns: excludePatterns.filter(p => p.trim()),
        max_results: null,
        context_lines: 0,
        follow_symlinks: false,
        search_hidden: false,
        max_file_size: 10 * 1024 * 1024,
      };
      
      // Filter to only selected files
      if (selectedFiles.size > 0 && searchResults) {
        options.include_patterns = Array.from(selectedFiles);
      }
      
      replacePreview = await invoke('replace_in_files', {
        searchOptions: options,
        replacement: replacePattern,
        dryRun: true,
      });
      
      replaceMode = true;
    } catch (err) {
      error = `Replace preview failed: ${err}`;
    } finally {
      loading = false;
    }
  }
  
  async function performReplace() {
    replacing = true;
    error = '';
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      const options: SearchOptions = {
        pattern: searchPattern,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex: useRegex,
        path: searchPath || null,
        include_patterns: Array.from(selectedFiles),
        exclude_patterns: excludePatterns.filter(p => p.trim()),
        max_results: null,
        context_lines: 0,
        follow_symlinks: false,
        search_hidden: false,
        max_file_size: 10 * 1024 * 1024,
      };
      
      const results = await invoke('replace_in_files', {
        searchOptions: options,
        replacement: replacePattern,
        dryRun: false,
      });
      
      const successCount = results.filter(r => r.success).length;
      const totalReplacements = results.reduce((sum, r) => sum + r.replacements, 0);
      
      dispatch('replaced', {
        files: successCount,
        replacements: totalReplacements,
        results,
      });
      
      show = false;
    } catch (err) {
      error = `Replace failed: ${err}`;
    } finally {
      replacing = false;
    }
  }
  
  async function saveSearch() {
    if (!saveSearchName.trim()) {
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/tauri');
      
      const options: SearchOptions = {
        pattern: searchPattern,
        case_sensitive: caseSensitive,
        whole_word: wholeWord,
        regex: useRegex,
        path: searchPath || null,
        include_patterns: includePatterns.filter(p => p.trim()),
        exclude_patterns: excludePatterns.filter(p => p.trim()),
        max_results: 1000,
        context_lines: 2,
        follow_symlinks: false,
        search_hidden: false,
        max_file_size: 10 * 1024 * 1024,
      };
      
      await invoke('save_search', { name: saveSearchName, options });
      await loadSavedSearches();
      showSaveDialog = false;
      saveSearchName = '';
    } catch (err) {
      error = `Failed to save search: ${err}`;
    }
  }
  
  async function loadSavedSearch(search: { name: string; options: SearchOptions }) {
    searchPattern = search.options.pattern;
    caseSensitive = search.options.case_sensitive;
    wholeWord = search.options.whole_word;
    useRegex = search.options.regex;
    searchPath = search.options.path || '';
    includePatterns = search.options.include_patterns || [];
    excludePatterns = search.options.exclude_patterns || [];
    includePatternsText = includePatterns.join('\n');
    excludePatternsText = excludePatterns.join('\n');
  }
  
  function toggleFileSelection(path: string) {
    if (selectedFiles.has(path)) {
      selectedFiles.delete(path);
    } else {
      selectedFiles.add(path);
    }
    selectedFiles = selectedFiles;
  }
  
  function selectAll() {
    if (searchResults?.results) {
      searchResults.results.forEach(r => {
        selectedFiles.add(r.path);
      });
      selectedFiles = selectedFiles;
    }
  }
  
  function deselectAll() {
    selectedFiles.clear();
    selectedFiles = selectedFiles;
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && event.metaKey) {
      performSearch();
    }
  }
</script>

<Dialog 
  title="Search & Replace" 
  {show}
  width="800px"
  on:close={() => show = false}
>
  <div class="search-replace">
    <div class="search-form">
      <div class="form-row">
        <input
          type="text"
          class="search-input"
          placeholder="Search pattern..."
          bind:value={searchPattern}
          on:keydown={handleKeydown}
          disabled={loading || replacing}
        />
        
        {#if searchHistory.length > 0}
          <select 
            class="history-select" 
            on:change={(e) => searchPattern = e.target.value}
            title="Search history"
          >
            <option value="">History</option>
            {#each searchHistory as pattern}
              <option value={pattern}>{pattern}</option>
            {/each}
          </select>
        {/if}
      </div>
      
      <div class="form-row">
        <input
          type="text"
          class="replace-input"
          placeholder="Replace with..."
          bind:value={replacePattern}
          disabled={loading || replacing}
        />
      </div>
      
      <div class="options-row">
        <label class="checkbox">
          <input type="checkbox" bind:checked={caseSensitive} />
          Case sensitive
        </label>
        
        <label class="checkbox">
          <input type="checkbox" bind:checked={wholeWord} />
          Whole word
        </label>
        
        <label class="checkbox">
          <input type="checkbox" bind:checked={useRegex} />
          Regular expression
        </label>
      </div>
      
      <details class="advanced-options">
        <summary>Advanced Options</summary>
        
        <div class="form-group">
          <label>Search path (leave empty for project root):</label>
          <input
            type="text"
            bind:value={searchPath}
            placeholder="/path/to/search"
            disabled={loading || replacing}
          />
        </div>
        
        <div class="form-group">
          <label>Include patterns (one per line):</label>
          <textarea
            rows="3"
            bind:value={includePatternsText}
            placeholder="*.js&#10;src/**/*.ts"
            disabled={loading || replacing}
            on:input={() => includePatterns = includePatternsText.split('\n').filter(p => p.trim())}
          />
        </div>
        
        <div class="form-group">
          <label>Exclude patterns (one per line):</label>
          <textarea
            rows="3"
            bind:value={excludePatternsText}
            placeholder="node_modules/**&#10;*.log"
            disabled={loading || replacing}
            on:input={() => excludePatterns = excludePatternsText.split('\n').filter(p => p.trim())}
          />
        </div>
      </details>
    </div>
    
    {#if error}
      <div class="error-message">{error}</div>
    {/if}
    
    {#if loading}
      <div class="loading">
        <span class="spinner">⟳</span> Searching...
      </div>
    {:else if searchResults}
      <div class="results-section">
        <div class="results-header">
          <span class="results-count">
            {searchResults.total_matches} matches in {searchResults.results.length} files
            {#if searchResults.truncated}
              <span class="warning">(truncated)</span>
            {/if}
          </span>
          
          <div class="selection-controls">
            <button class="btn-small" on:click={selectAll}>Select All</button>
            <button class="btn-small" on:click={deselectAll}>Select None</button>
          </div>
        </div>
        
        <div class="results-list">
          {#each searchResults.results as result}
            <div class="file-result">
              <label class="file-header">
                <input
                  type="checkbox"
                  checked={selectedFiles.has(result.path)}
                  on:change={() => toggleFileSelection(result.path)}
                />
                <span class="file-path">{result.path}</span>
                <span class="match-count">({result.total_matches} matches)</span>
              </label>
              
              <div class="matches">
                {#each result.matches.slice(0, 5) as match}
                  <div class="match-line">
                    <span class="line-number">{match.line_number}:</span>
                    <pre class="line-text">{match.line_text}</pre>
                  </div>
                {/each}
                {#if result.matches.length > 5}
                  <div class="more-matches">
                    ...and {result.matches.length - 5} more matches
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    {#if replaceMode && replacePreview.length > 0}
      <div class="replace-preview">
        <h3>Replace Preview</h3>
        <div class="preview-list">
          {#each replacePreview as preview}
            <div class="preview-item" class:error={!preview.success}>
              <span class="file-path">{preview.path}</span>
              {#if preview.success}
                <span class="replacements">{preview.replacements} replacements</span>
              {:else}
                <span class="error-text">{preview.error}</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>
  
  <div slot="actions">
    {#if savedSearches.length > 0}
      <select 
        class="saved-searches"
        on:change={(e) => {
          const search = savedSearches.find(s => s.name === e.target.value);
          if (search) loadSavedSearch(search);
        }}
      >
        <option value="">Load saved search...</option>
        {#each savedSearches as search}
          <option value={search.name}>{search.name}</option>
        {/each}
      </select>
    {/if}
    
    <button class="btn btn-secondary" on:click={() => showSaveDialog = true}>
      Save Search
    </button>
    
    <div class="spacer"></div>
    
    <button class="btn btn-secondary" on:click={() => show = false}>
      Cancel
    </button>
    
    {#if !replaceMode}
      <button 
        class="btn btn-primary" 
        on:click={performSearch}
        disabled={!searchPattern.trim() || loading}
      >
        Search
      </button>
      
      {#if searchResults && selectedFiles.size > 0}
        <button 
          class="btn btn-warning" 
          on:click={previewReplace}
          disabled={!replacePattern.trim() || loading}
        >
          Preview Replace
        </button>
      {/if}
    {:else}
      <button 
        class="btn btn-secondary" 
        on:click={() => replaceMode = false}
      >
        Back
      </button>
      
      <button 
        class="btn btn-danger" 
        on:click={performReplace}
        disabled={replacing}
      >
        {replacing ? 'Replacing...' : 'Replace All'}
      </button>
    {/if}
  </div>
</Dialog>

{#if showSaveDialog}
  <Dialog 
    title="Save Search" 
    show={showSaveDialog}
    on:close={() => showSaveDialog = false}
  >
    <div class="save-form">
      <label>
        Search name:
        <input 
          type="text" 
          bind:value={saveSearchName}
          on:keydown={(e) => e.key === 'Enter' && saveSearch()}
        />
      </label>
    </div>
    
    <div slot="actions">
      <button class="btn btn-secondary" on:click={() => showSaveDialog = false}>
        Cancel
      </button>
      <button 
        class="btn btn-primary" 
        on:click={saveSearch}
        disabled={!saveSearchName.trim()}
      >
        Save
      </button>
    </div>
  </Dialog>
{/if}

<style>
  .search-replace {
    display: flex;
    flex-direction: column;
    gap: 16px;
    max-height: 70vh;
  }
  
  .search-form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .form-row {
    display: flex;
    gap: 8px;
  }
  
  .search-input,
  .replace-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 14px;
    font-family: 'SF Mono', Monaco, monospace;
  }
  
  .history-select,
  .saved-searches {
    padding: 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
  }
  
  .options-row {
    display: flex;
    gap: 20px;
    align-items: center;
  }
  
  .checkbox {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--fg-secondary);
    cursor: pointer;
  }
  
  .checkbox input {
    cursor: pointer;
  }
  
  .advanced-options {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px;
  }
  
  .advanced-options summary {
    cursor: pointer;
    font-size: 13px;
    color: var(--fg-secondary);
    font-weight: 500;
  }
  
  .form-group {
    margin-top: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  
  .form-group label {
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .form-group input,
  .form-group textarea {
    padding: 6px 10px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
    resize: vertical;
  }
  
  .error-message {
    padding: 8px 12px;
    background: var(--error-bg);
    border: 1px solid var(--error);
    border-radius: 4px;
    color: var(--error);
    font-size: 13px;
  }
  
  .loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 20px;
    color: var(--fg-tertiary);
  }
  
  .spinner {
    font-size: 20px;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .results-section {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border);
  }
  
  .results-count {
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .warning {
    color: var(--warning);
  }
  
  .selection-controls {
    display: flex;
    gap: 8px;
  }
  
  .btn-small {
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--fg-secondary);
    font-size: 12px;
    cursor: pointer;
  }
  
  .btn-small:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .results-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
  }
  
  .file-result {
    margin-bottom: 16px;
    border: 1px solid var(--border);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .file-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-tertiary);
    cursor: pointer;
  }
  
  .file-header:hover {
    background: var(--bg-hover);
  }
  
  .file-path {
    flex: 1;
    font-size: 13px;
    font-family: 'SF Mono', Monaco, monospace;
    color: var(--fg-primary);
  }
  
  .match-count {
    font-size: 12px;
    color: var(--fg-tertiary);
  }
  
  .matches {
    padding: 8px 12px;
    background: var(--bg-secondary);
  }
  
  .match-line {
    display: flex;
    gap: 8px;
    margin-bottom: 4px;
    font-size: 12px;
  }
  
  .line-number {
    color: var(--fg-tertiary);
    min-width: 40px;
    text-align: right;
  }
  
  .line-text {
    flex: 1;
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: 'SF Mono', Monaco, monospace;
    color: var(--fg-primary);
  }
  
  .more-matches {
    font-size: 12px;
    color: var(--fg-tertiary);
    font-style: italic;
    margin-top: 8px;
  }
  
  .replace-preview {
    border-top: 1px solid var(--border);
    padding-top: 16px;
  }
  
  .replace-preview h3 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-primary);
  }
  
  .preview-list {
    max-height: 200px;
    overflow-y: auto;
  }
  
  .preview-item {
    display: flex;
    justify-content: space-between;
    padding: 6px 8px;
    font-size: 13px;
    border-radius: 3px;
  }
  
  .preview-item:hover {
    background: var(--bg-hover);
  }
  
  .preview-item.error {
    background: var(--error-bg);
  }
  
  .replacements {
    color: var(--success);
  }
  
  .error-text {
    color: var(--error);
  }
  
  .save-form {
    padding: 12px 0;
  }
  
  .save-form label {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  .save-form input {
    padding: 8px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 14px;
  }
  
  .spacer {
    flex: 1;
  }
  
  /* Scrollbar styling */
  .results-list::-webkit-scrollbar,
  .preview-list::-webkit-scrollbar {
    width: 10px;
  }
  
  .results-list::-webkit-scrollbar-track,
  .preview-list::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .results-list::-webkit-scrollbar-thumb,
  .preview-list::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 5px;
  }
  
  .results-list::-webkit-scrollbar-thumb:hover,
  .preview-list::-webkit-scrollbar-thumb:hover {
    background: var(--fg-tertiary);
  }
</style>