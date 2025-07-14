<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  import { quadOut } from 'svelte/easing';

  export interface ToastMessage {
    id: string;
    type: 'success' | 'info' | 'warning' | 'error';
    title?: string;
    message: string;
    duration?: number;
    persistent?: boolean;
    actions?: ToastAction[];
  }

  export interface ToastAction {
    label: string;
    variant?: 'primary' | 'secondary';
    handler: () => void;
  }

  export let toast: ToastMessage;
  export let onDismiss: (id: string) => void;

  let visible = true;
  let dismissTimer: ReturnType<typeof setTimeout>;

  const defaultDuration = 5000;
  const duration = toast.persistent ? 0 : (toast.duration ?? defaultDuration);

  // Auto-dismiss non-persistent toasts
  onMount(() => {
    if (duration > 0) {
      dismissTimer = setTimeout(() => {
        dismissToast();
      }, duration);
    }
  });

  onDestroy(() => {
    if (dismissTimer) {
      clearTimeout(dismissTimer);
    }
  });

  function dismissToast() {
    visible = false;
    // Wait for transition to complete before removing from DOM
    setTimeout(() => {
      onDismiss(toast.id);
    }, 300);
  }

  function handleAction(action: ToastAction) {
    action.handler();
    if (!toast.persistent) {
      dismissToast();
    }
  }

  function getIconClass(type: string): string {
    switch (type) {
      case 'success':
        return 'i-carbon:checkmark-filled';
      case 'info':
        return 'i-carbon:information-filled';
      case 'warning':
        return 'i-carbon:warning-filled';
      case 'error':
        return 'i-carbon:error-filled';
      default:
        return 'i-carbon:information-filled';
    }
  }

  function getColorClass(type: string): string {
    switch (type) {
      case 'success':
        return 'toast-success';
      case 'info':
        return 'toast-info';
      case 'warning':
        return 'toast-warning';
      case 'error':
        return 'toast-error';
      default:
        return 'toast-info';
    }
  }
</script>

{#if visible}
  <div
    class="toast {getColorClass(toast.type)}"
    transition:fly={{ x: 300, duration: 300, easing: quadOut }}
    role="alert"
    aria-live="polite"
  >
    <div class="toast-content">
      <div class="toast-icon">
        <div class={getIconClass(toast.type)} />
      </div>
      
      <div class="toast-body">
        {#if toast.title}
          <div class="toast-title">{toast.title}</div>
        {/if}
        <div class="toast-message">{toast.message}</div>
        
        {#if toast.actions && toast.actions.length > 0}
          <div class="toast-actions">
            {#each toast.actions as action}
              <button
                class="toast-action {action.variant || 'secondary'}"
                on:click={() => handleAction(action)}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    
    {#if !toast.persistent}
      <button class="toast-dismiss" on:click={dismissToast} aria-label="Dismiss notification">
        <div class="i-carbon:close" />
      </button>
    {/if}
    
    {#if duration > 0 && !toast.persistent}
      <div class="toast-progress">
        <div class="toast-progress-bar" style="animation-duration: {duration}ms" />
      </div>
    {/if}
  </div>
{/if}

<style>
  .toast {
    display: flex;
    position: relative;
    min-width: 320px;
    max-width: 480px;
    margin-bottom: 8px;
    padding: 16px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 
      0 4px 12px rgba(0, 0, 0, 0.15),
      0 0 0 1px rgba(255, 255, 255, 0.05);
    backdrop-filter: blur(8px);
    overflow: hidden;
  }

  .toast-content {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    flex: 1;
  }

  .toast-icon {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    margin-top: 2px;
  }

  .toast-icon > div {
    width: 100%;
    height: 100%;
  }

  .toast-body {
    flex: 1;
    min-width: 0;
  }

  .toast-title {
    font-size: var(--font-body-sm);
    font-weight: 600;
    color: var(--fg-primary);
    margin-bottom: 4px;
    line-height: 1.4;
  }

  .toast-message {
    font-size: var(--font-body-sm);
    color: var(--fg-secondary);
    line-height: 1.4;
    word-wrap: break-word;
  }

  .toast-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }

  .toast-action {
    padding: 6px 12px;
    border: none;
    border-radius: var(--radius-sm);
    font-size: var(--font-body-xs);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast) var(--ease-out);
  }

  .toast-action.primary {
    background: var(--accent);
    color: var(--accent-fg);
  }

  .toast-action.primary:hover {
    background: var(--accent-hover);
  }

  .toast-action.secondary {
    background: var(--bg-secondary);
    color: var(--fg-primary);
    border: 1px solid var(--border);
  }

  .toast-action.secondary:hover {
    background: var(--bg-tertiary);
  }

  .toast-dismiss {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 24px;
    height: 24px;
    padding: 0;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--fg-tertiary);
    transition: color var(--duration-fast) var(--ease-out);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .toast-dismiss:hover {
    color: var(--fg-secondary);
  }

  .toast-dismiss > div {
    width: 16px;
    height: 16px;
  }

  .toast-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: rgba(255, 255, 255, 0.1);
  }

  .toast-progress-bar {
    height: 100%;
    background: currentColor;
    animation: toast-progress linear forwards;
    transform-origin: left;
  }

  @keyframes toast-progress {
    from {
      transform: scaleX(1);
    }
    to {
      transform: scaleX(0);
    }
  }

  /* Toast type variants */
  .toast-success {
    border-left: 4px solid var(--success);
  }

  .toast-success .toast-icon {
    color: var(--success);
  }

  .toast-info {
    border-left: 4px solid var(--accent);
  }

  .toast-info .toast-icon {
    color: var(--accent);
  }

  .toast-warning {
    border-left: 4px solid var(--warning);
  }

  .toast-warning .toast-icon {
    color: var(--warning);
  }

  .toast-error {
    border-left: 4px solid var(--error);
  }

  .toast-error .toast-icon {
    color: var(--error);
  }

  /* Dark theme adjustments */
  @media (prefers-color-scheme: dark) {
    .toast {
      background: rgba(40, 44, 52, 0.95);
      border-color: rgba(255, 255, 255, 0.1);
    }
  }
</style>