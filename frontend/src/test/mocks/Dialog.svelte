<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let title = '';
  export let show = false;
  export let width = '400px';
  
  const dispatch = createEventDispatcher();
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
    }
  }
</script>

{#if show}
  <div class="dialog" style="width: {width}" on:keydown={handleKeydown}>
    {#if title}
      <h3>{title}</h3>
    {/if}
    <slot />
  </div>
{/if}