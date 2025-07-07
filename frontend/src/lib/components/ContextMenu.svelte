<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let x: number;
  export let y: number;
  
  const dispatch = createEventDispatcher();
  
  let menu: HTMLDivElement;
  let adjustedX = x;
  let adjustedY = y;
  
  onMount(() => {
    // Adjust position to keep menu on screen
    const rect = menu.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    if (x + rect.width > windowWidth) {
      adjustedX = x - rect.width;
    }
    
    if (y + rect.height > windowHeight) {
      adjustedY = y - rect.height;
    }
    
    // Close on outside click
    function handleClick(event: MouseEvent) {
      if (!menu.contains(event.target as Node)) {
        dispatch('close');
      }
    }
    
    // Close on escape
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        dispatch('close');
      }
    }
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div 
  class="context-menu"
  bind:this={menu}
  style="left: {adjustedX}px; top: {adjustedY}px"
  transition:fade={{ duration: 150 }}
>
  <slot />
</div>

<style>
  .context-menu {
    position: fixed;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    padding: 4px;
    min-width: 150px;
    z-index: 1000;
    font-size: 13px;
  }
  
  :global(.context-menu button) {
    font-family: var(--font-family);
  }
</style>