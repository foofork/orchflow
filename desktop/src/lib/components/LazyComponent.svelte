<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  
  export let loader: () => Promise<{ default: any }>;
  export let placeholder = 'Loading...';
  export let retryCount = 3;
  export let retryDelay = 1000;
  
  // Accept all other props to forward to the loaded component
  let { loader: _, placeholder: __, retryCount: ___, retryDelay: ____, ...componentProps } = $$props;
  
  const dispatch = createEventDispatcher();
  
  let Component: any = null;
  let loading = true;
  let error: Error | null = null;
  let attempt = 0;
  
  async function loadComponent() {
    try {
      loading = true;
      error = null;
      const module = await loader();
      Component = module.default;
      dispatch('loaded', { component: Component });
    } catch (e) {
      error = e as Error;
      console.error('Failed to load component:', e);
      
      // Retry logic
      if (attempt < retryCount) {
        attempt++;
        setTimeout(() => {
          loadComponent();
        }, retryDelay * attempt);
      } else {
        dispatch('error', { error });
      }
    } finally {
      loading = false;
    }
  }
  
  onMount(() => {
    loadComponent();
  });
  
  // Update componentProps when props change
  $: ({ loader: _, placeholder: __, retryCount: ___, retryDelay: ____, ...componentProps } = $$props);
</script>

{#if loading}
  <div class="lazy-loading">
    <div class="spinner"></div>
    <p>{placeholder}</p>
    {#if attempt > 0}
      <small>Retry attempt {attempt} of {retryCount}</small>
    {/if}
  </div>
{:else if error}
  <div class="lazy-error">
    <p>Failed to load component</p>
    <small>{error.message}</small>
    {#if attempt < retryCount}
      <button on:click={loadComponent}>Retry</button>
    {/if}
  </div>
{:else if Component}
  <svelte:component this={Component} {...componentProps} on:close on:open />
{/if}

<style>
  .lazy-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--fg-tertiary);
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid var(--bg-tertiary);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .lazy-error {
    padding: 20px;
    color: var(--error);
    text-align: center;
  }
  
  .lazy-error small {
    opacity: 0.7;
    font-size: 12px;
    display: block;
    margin-bottom: 8px;
  }
  
  .lazy-error button {
    margin-top: 8px;
    padding: 6px 12px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 13px;
    transition: opacity 0.2s;
  }
  
  .lazy-error button:hover {
    opacity: 0.9;
  }
  
  .lazy-loading small {
    margin-top: 8px;
    font-size: 12px;
    opacity: 0.7;
  }
</style>