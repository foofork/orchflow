<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { fly } from 'svelte/transition';

  interface UpdateStatus {
    available: boolean;
    version?: string;
    notes?: string;
    pub_date?: string;
    error?: string;
  }

  interface UpdateProgress {
    downloaded: number;
    total: number;
    percentage: number;
  }

  let updateAvailable = false;
  let updateStatus: UpdateStatus | null = null;
  let downloading = false;
  let progress = 0;
  let currentVersion = '';
  let showNotification = false;
  let error: string | null = null;

  let unlistenAvailable: UnlistenFn;
  let unlistenProgress: UnlistenFn;
  let unlistenDownloaded: UnlistenFn;
  let unlistenError: UnlistenFn;

  onMount(async () => {
    // Get current version
    try {
      currentVersion = await invoke('get_current_version');
    } catch (e) {
      console.error('Failed to get current version:', e);
    }

    // Listen for update events
    unlistenAvailable = await listen<UpdateStatus>('update-available', (event) => {
      updateStatus = event.payload;
      updateAvailable = true;
      showNotification = true;
    });

    unlistenProgress = await listen<UpdateProgress>('update-progress', (event) => {
      progress = Math.round(event.payload.percentage);
    });

    unlistenDownloaded = await listen('update-downloaded', () => {
      downloading = false;
      showNotification = false;
      // Show restart prompt
      if (confirm('Update downloaded successfully. Restart now to apply the update?')) {
        restartApp();
      }
    });

    unlistenError = await listen<string>('update-error', (event) => {
      error = event.payload;
      downloading = false;
    });

    // Check for updates manually on mount
    checkForUpdates();
  });

  onDestroy(() => {
    unlistenAvailable?.();
    unlistenProgress?.();
    unlistenDownloaded?.();
    unlistenError?.();
  });

  async function checkForUpdates() {
    try {
      const status = await invoke<UpdateStatus>('check_for_update');
      if (status.available) {
        updateStatus = status;
        updateAvailable = true;
        showNotification = true;
      }
    } catch (e) {
      console.error('Failed to check for updates:', e);
    }
  }

  async function downloadUpdate() {
    if (downloading) return;

    downloading = true;
    progress = 0;
    error = null;

    try {
      await invoke('download_and_install_update');
    } catch (e) {
      error = String(e);
      downloading = false;
    }
  }

  async function restartApp() {
    try {
      await invoke('restart_app');
    } catch (e) {
      console.error('Failed to restart app:', e);
    }
  }

  function dismissNotification() {
    showNotification = false;
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  }
</script>

{#if showNotification && updateAvailable && updateStatus}
  <div 
    class="update-notification"
    transition:fly={{ y: -100, duration: 300 }}
  >
    <div class="update-header">
      <h3>Update Available!</h3>
      <button class="close-btn" on:click={dismissNotification}>×</button>
    </div>
    
    <div class="update-content">
      <p class="version-info">
        Version {updateStatus.version} is available
        <span class="current-version">(current: {currentVersion})</span>
      </p>
      
      {#if updateStatus.pub_date}
        <p class="release-date">Released: {formatDate(updateStatus.pub_date)}</p>
      {/if}
      
      {#if updateStatus.notes}
        <div class="release-notes">
          <h4>What's New:</h4>
          <div class="notes-content">
            {@html updateStatus.notes}
          </div>
        </div>
      {/if}
      
      {#if error}
        <div class="error-message">
          Error: {error}
        </div>
      {/if}
      
      <div class="update-actions">
        {#if downloading}
          <div class="progress-container">
            <div class="progress-bar">
              <div class="progress-fill" style="width: {progress}%"></div>
            </div>
            <span class="progress-text">{progress}%</span>
          </div>
        {:else}
          <button 
            class="update-btn primary"
            on:click={downloadUpdate}
            disabled={downloading}
          >
            Download & Install
          </button>
          <button 
            class="update-btn secondary"
            on:click={dismissNotification}
          >
            Later
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .update-notification {
    position: fixed;
    top: 20px;
    right: 20px;
    width: 400px;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
    z-index: 1000;
    overflow: hidden;
  }

  .update-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--color-bg-tertiary, #313244);
    border-bottom: 1px solid var(--color-border, #45475a);
  }

  .update-header h3 {
    margin: 0;
    font-size: 18px;
    color: var(--color-text-primary, #cdd6f4);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 24px;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: var(--color-bg-hover, #45475a);
    color: var(--color-text-primary, #cdd6f4);
  }

  .update-content {
    padding: 20px;
  }

  .version-info {
    font-size: 16px;
    margin: 0 0 8px 0;
    color: var(--color-text-primary, #cdd6f4);
  }

  .current-version {
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    margin-left: 8px;
  }

  .release-date {
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    margin: 0 0 16px 0;
  }

  .release-notes {
    margin: 16px 0;
    padding: 12px;
    background: var(--color-bg-primary, #11111b);
    border-radius: 4px;
    border: 1px solid var(--color-border, #45475a);
  }

  .release-notes h4 {
    margin: 0 0 8px 0;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
  }

  .notes-content {
    font-size: 14px;
    color: var(--color-text-primary, #cdd6f4);
    max-height: 200px;
    overflow-y: auto;
  }

  .error-message {
    margin: 12px 0;
    padding: 8px 12px;
    background: var(--color-error-bg, #f38ba8);
    color: var(--color-error-text, #11111b);
    border-radius: 4px;
    font-size: 14px;
  }

  .update-actions {
    margin-top: 20px;
    display: flex;
    gap: 12px;
  }

  .update-btn {
    flex: 1;
    padding: 10px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .update-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .update-btn.primary {
    background: var(--color-primary, #89b4fa);
    color: var(--color-bg-primary, #11111b);
  }

  .update-btn.primary:hover:not(:disabled) {
    background: var(--color-primary-hover, #74a8f5);
  }

  .update-btn.secondary {
    background: var(--color-bg-tertiary, #313244);
    color: var(--color-text-primary, #cdd6f4);
    border: 1px solid var(--color-border, #45475a);
  }

  .update-btn.secondary:hover {
    background: var(--color-bg-hover, #45475a);
  }

  .progress-container {
    width: 100%;
  }

  .progress-bar {
    height: 24px;
    background: var(--color-bg-tertiary, #313244);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-primary, #89b4fa);
    transition: width 0.3s ease;
  }

  .progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary, #cdd6f4);
  }

  /* Scrollbar styling */
  .notes-content::-webkit-scrollbar {
    width: 8px;
  }

  .notes-content::-webkit-scrollbar-track {
    background: var(--color-bg-secondary, #1e1e2e);
    border-radius: 4px;
  }

  .notes-content::-webkit-scrollbar-thumb {
    background: var(--color-border, #45475a);
    border-radius: 4px;
  }

  .notes-content::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-secondary, #bac2de);
  }
</style>