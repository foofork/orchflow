<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy, tick } from 'svelte';
  
  export let title = '';
  export let show = false;
  export let width = '400px';
  export let height = 'auto';
  export let testMode = false;
  export let autoFocus = true;
  export let closeOnBackdrop = true;
  export let closeOnEscape = true;
  export let ariaLabel = '';
  export let ariaDescribedBy = '';
  
  const dispatch = createEventDispatcher();
  
  let dialogElement: HTMLDivElement;
  let previouslyFocused: HTMLElement | null = null;
  let focusableElements: HTMLElement[] = [];
  let dialogId = `dialog-${Math.random().toString(36).substr(2, 9)}`;
  
  // Focus trap implementation
  function getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ];
    
    return Array.from(container.querySelectorAll(selectors.join(', '))) as HTMLElement[];
  }
  
  function trapFocus(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !dialogElement) return;
    
    focusableElements = getFocusableElements(dialogElement);
    
    if (focusableElements.length === 0) {
      event.preventDefault();
      return;
    }
    
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey) {
      if (document.activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }
    } else {
      if (document.activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      dispatch('close');
    } else {
      trapFocus(event);
    }
  }
  
  function handleBackdropClick(event: MouseEvent) {
    if (closeOnBackdrop && event.target === dialogElement) {
      dispatch('close');
    }
  }
  
  async function setupFocus() {
    if (!show || testMode || !autoFocus) return;
    
    // Store the previously focused element
    if (typeof document !== 'undefined' && document.activeElement) {
      previouslyFocused = document.activeElement as HTMLElement;
    }
    
    // Wait for DOM to update
    await tick();
    
    if (dialogElement) {
      focusableElements = getFocusableElements(dialogElement);
      
      // Focus the first focusable element or the dialog itself
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else {
        dialogElement.focus();
      }
    }
  }
  
  function restoreFocus() {
    if (!testMode && previouslyFocused) {
      previouslyFocused.focus();
      previouslyFocused = null;
    }
  }
  
  // Set up focus management when dialog shows/hides
  $: if (show && typeof document !== 'undefined') {
    setupFocus();
  } else if (!show) {
    restoreFocus();
  }
  
  onDestroy(() => {
    restoreFocus();
  });
</script>

{#if show}
  <div 
    class="dialog-backdrop" 
    bind:this={dialogElement}
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    data-testid="dialog-backdrop"
  >
    <div 
      class="dialog" 
      style="width: {width}; height: {height}"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? `${dialogId}-title` : undefined}
      aria-label={ariaLabel || (title ? undefined : 'Dialog')}
      aria-describedby={ariaDescribedBy || undefined}
      tabindex="-1"
      data-testid="dialog"
    >
      {#if title}
        <div class="dialog-header">
          <h3 id="{dialogId}-title" class="dialog-title">{title}</h3>
          <button 
            class="dialog-close" 
            on:click={() => dispatch('close')}
            aria-label="Close dialog"
            data-testid="dialog-close"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      {/if}
      
      <div class="dialog-content" data-testid="dialog-content">
        <slot />
      </div>
      
      {#if $$slots.actions}
        <div class="dialog-actions" data-testid="dialog-actions">
          <slot name="actions" />
        </div>
      {/if}
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