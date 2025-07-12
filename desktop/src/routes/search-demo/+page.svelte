<script lang="ts">
  import SearchReplace from '$lib/components/SearchReplace.svelte';
  
  let showSearch = false;
  let lastReplaceResult: any = null;
  
  function handleReplaced(event: any) {
    lastReplaceResult = event.detail;
    showSearch = false;
  }
</script>

<div class="search-demo">
  <h1>Search & Replace Demo</h1>
  
  <button on:click={() => showSearch = true}>
    Open Search & Replace
  </button>
  
  {#if lastReplaceResult}
    <div class="result">
      <h2>Last Replace Result</h2>
      <p>Files modified: {lastReplaceResult.files}</p>
      <p>Total replacements: {lastReplaceResult.replacements}</p>
    </div>
  {/if}
  
  <SearchReplace 
    bind:show={showSearch}
    on:replaced={handleReplaced}
  />
</div>

<style>
  .search-demo {
    padding: 20px;
  }
  
  button {
    padding: 8px 16px;
    background: #007acc;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  button:hover {
    background: #005fa3;
  }
  
  .result {
    margin-top: 20px;
    padding: 16px;
    background: #f0f0f0;
    border-radius: 4px;
  }
</style>