<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  
  export let show = false;
  export let title = '';
  export let width = '600px';
  export let closeable = true;
  
  const dispatch = createEventDispatcher();
  
  function close() {
    if (closeable) {
      show = false;
      dispatch('close');
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeable) {
      close();
    }
  }
</script>

{#if show}
  <div 
    class="modal-overlay" 
    on:click={close}
    on:keydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-label={title || "Modal Dialog"}
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="modal-content"
      style="max-width: {width}"
      on:click|stopPropagation
      role="document"
      transition:scale={{ duration: 200, start: 0.95 }}
    >
      {#if title || closeable}
        <div class="modal-header">
          {#if title}
            <h2>{title}</h2>
          {/if}
          {#if closeable}
            <button class="close-btn" on:click={close} aria-label="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M1 13L13 1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          {/if}
        </div>
      {/if}
      
      <div class="modal-body">
        <slot />
      </div>
      
      {#if $$slots.footer}
        <div class="modal-footer">
          <slot name="footer" />
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--backdrop-color);
    backdrop-filter: blur(12px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  }
  
  .modal-content {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }
  
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  
  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--fg-primary);
  }
  
  .close-btn {
    background: none;
    border: none;
    padding: 8px;
    cursor: pointer;
    color: var(--fg-secondary);
    border-radius: 4px;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
  
  .modal-footer {
    padding: 16px 20px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  /* Scrollbar styling for modal body */
  .modal-body::-webkit-scrollbar {
    width: 8px;
  }
  
  .modal-body::-webkit-scrollbar-track {
    background: transparent;
  }
  
  .modal-body::-webkit-scrollbar-thumb {
    background: var(--border);
    border-radius: 4px;
  }
  
  .modal-body::-webkit-scrollbar-thumb:hover {
    background: var(--fg-secondary);
  }
</style>