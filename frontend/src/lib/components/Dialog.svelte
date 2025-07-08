<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  
  export let title = '';
  export let show = false;
  export let width = '400px';
  
  const dispatch = createEventDispatcher();
  
  let dialog: HTMLDivElement;
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      dispatch('close');
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (event.target === dialog) {
      dispatch('close');
    }
  }
  
  onMount(() => {
    const firstInput = dialog?.querySelector('input');
    if (firstInput) {
      firstInput.focus();
    }
  });
</script>

{#if show}
  <div 
    class="dialog-backdrop" 
    bind:this={dialog}
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
  >
    <div class="dialog" style="width: {width}">
      {#if title}
        <div class="dialog-header">
          <h3 class="dialog-title">{title}</h3>
          <button class="dialog-close" on:click={() => dispatch('close')}>
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      {/if}
      
      <div class="dialog-content">
        <slot />
      </div>
      
      <div class="dialog-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease-out;
  }
  
  .dialog {
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
    max-width: 90vw;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.2s ease-out;
  }
  
  .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
  }
  
  .dialog-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--fg-primary);
  }
  
  .dialog-close {
    width: 32px;
    height: 32px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 4px;
    color: var(--fg-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.1s;
  }
  
  .dialog-close:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .dialog-content {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
  }
  
  .dialog-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    padding: 16px 20px;
    border-top: 1px solid var(--border);
  }
  
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
</style>