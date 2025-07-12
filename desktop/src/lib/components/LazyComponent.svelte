<script lang="ts">
  import { onMount } from 'svelte';
  
  export let loader: () => Promise<{ default: any }>;
  export let props: Record<string, any> = {};
  export let placeholder = 'Loading...';
  
  let Component: any = null;
  let loading = true;
  let error: Error | null = null;
  
  onMount(async () => {
    try {
      const module = await loader();
      Component = module.default;
    } catch (e) {
      error = e as Error;
      console.error('Failed to load component:', e);
    } finally {
      loading = false;
    }
  });
</script>

{#if loading}
  <div class="lazy-loading">
    <div class="spinner"></div>
    <p>{placeholder}</p>
  </div>
{:else if error}
  <div class="lazy-error">
    <p>Failed to load component</p>
    <small>{error.message}</small>
  </div>
{:else if Component}
  <svelte:component this={Component} {...props} />
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
  }
</style>