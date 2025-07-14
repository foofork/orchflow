<script lang="ts">
  import LazyComponent from '$lib/components/LazyComponent.svelte';
  
  export let show: boolean = false;
  
  // Lazy load the actual GitPanel implementation
  const GitPanelLazy = () => import('./GitPanelLazy.svelte');
</script>

{#if show}
  <LazyComponent loader={GitPanelLazy} {show} on:close />
{/if}