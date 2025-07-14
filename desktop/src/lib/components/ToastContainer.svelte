<script lang="ts">
  import { toasts, toastManager } from '$lib/stores/toast';
  import ToastNotification from './ToastNotification.svelte';

  $: currentToasts = $toasts;

  function handleDismiss(id: string) {
    toastManager.remove(id);
  }
</script>

<div class="toast-container">
  {#each currentToasts as toast (toast.id)}
    <ToastNotification {toast} onDismiss={handleDismiss} />
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    max-width: calc(100vw - 40px);
  }

  .toast-container :global(.toast) {
    pointer-events: auto;
  }

  /* Mobile responsiveness */
  @media (max-width: 640px) {
    .toast-container {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
      align-items: stretch;
    }

    .toast-container :global(.toast) {
      min-width: auto;
      max-width: none;
    }
  }
</style>