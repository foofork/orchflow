<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  
  export let sessionId: string = '';
  export let show: boolean = false;
  
  const dispatch = createEventDispatcher();
  
  interface GitFile {
    path: string;
    status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked';
    staged: boolean;
    additions?: number;
    deletions?: number;
  }
  
  interface GitStatus {
    branch: string;
    upstream?: string;
    ahead: number;
    behind: number;
    staged: GitFile[];
    unstaged: GitFile[];
    untracked: GitFile[];
  }
  
  let gitStatus: GitStatus | null = null;
  let selectedFile: GitFile | null = null;
  let diffContent: string = '';
  let commitMessage: string = '';
  let isLoading = false;
  let refreshInterval: number;
  let showDiffView = false;
  
  // Git status icons
  const statusIcons: Record<string, string> = {
    modified: 'M',
    added: 'A',
    deleted: 'D',
    renamed: 'R',
    untracked: '?'
  };
  
  const statusColors: Record<string, string> = {
    modified: 'var(--warning)',
    added: 'var(--success)',
    deleted: 'var(--error)',
    renamed: 'var(--info)',
    untracked: 'var(--fg-tertiary)'
  };
  
  async function loadGitStatus() {
    if (isLoading) return;
    
    isLoading = true;
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        gitStatus = await invoke('git_status');
      } else {
        // Mock data for development
        gitStatus = {
          branch: 'main',
          upstream: 'origin/main',
          ahead: 2,
          behind: 0,
          staged: [
            { path: 'src/components/Header.svelte', status: 'modified', staged: true, additions: 15, deletions: 3 }
          ],
          unstaged: [
            { path: 'src/lib/utils.ts', status: 'modified', staged: false, additions: 20, deletions: 5 },
            { path: 'README.md', status: 'modified', staged: false, additions: 5, deletions: 2 }
          ],
          untracked: [
            { path: 'src/components/NewFeature.svelte', status: 'untracked', staged: false }
          ]
        };
      }
    } catch (error) {
      console.error('Failed to load git status:', error);
      gitStatus = null;
    } finally {
      isLoading = false;
    }
  }
  
  async function loadDiff(file: GitFile) {
    selectedFile = file;
    showDiffView = true;
    
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        diffContent = await invoke('git_diff', { path: file.path, staged: file.staged });
      } else {
        // Mock diff for development
        diffContent = `diff --git a/${file.path} b/${file.path}
index 1234567..abcdefg 100644
--- a/${file.path}
+++ b/${file.path}
@@ -10,7 +10,7 @@
   export let title: string;
   export let subtitle: string;
   
-  const version = "1.0.0";
+  const version = "1.1.0";
   
   function handleClick() {
     console.log('Header clicked');
@@ -25,6 +25,8 @@
     <h1>{title}</h1>
     <p>{subtitle}</p>
     <span class="version">v{version}</span>
+    <!-- New feature button -->
+    <button on:click={handleClick}>Click me</button>
   </div>
 </header>`;
      }
    } catch (error) {
      console.error('Failed to load diff:', error);
      diffContent = 'Failed to load diff';
    }
  }
  
  async function stageFile(file: GitFile) {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_stage', { path: file.path });
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to stage file:', error);
    }
  }
  
  async function unstageFile(file: GitFile) {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_unstage', { path: file.path });
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to unstage file:', error);
    }
  }
  
  async function stageAll() {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_stage_all');
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to stage all files:', error);
    }
  }
  
  async function unstageAll() {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_unstage_all');
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to unstage all files:', error);
    }
  }
  
  async function commit() {
    if (!commitMessage.trim()) {
      alert('Please enter a commit message');
      return;
    }
    
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_commit', { message: commitMessage });
      }
      commitMessage = '';
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to commit:', error);
      alert('Commit failed: ' + error);
    }
  }
  
  async function push() {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_push');
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to push:', error);
      alert('Push failed: ' + error);
    }
  }
  
  async function pull() {
    try {
      if ('__TAURI__' in window) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('git_pull');
      }
      await loadGitStatus();
    } catch (error) {
      console.error('Failed to pull:', error);
      alert('Pull failed: ' + error);
    }
  }
  
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      if (showDiffView) {
        showDiffView = false;
        selectedFile = null;
      } else {
        close();
      }
    } else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      commit();
    }
  }
  
  function close() {
    show = false;
    dispatch('close');
  }
  
  function parseDiff(diff: string): { type: 'header' | 'add' | 'remove' | 'context' | 'meta'; content: string }[] {
    const lines = diff.split('\n');
    return lines.map(line => {
      if (line.startsWith('+++') || line.startsWith('---')) {
        return { type: 'header', content: line };
      } else if (line.startsWith('@@')) {
        return { type: 'meta', content: line };
      } else if (line.startsWith('+')) {
        return { type: 'add', content: line };
      } else if (line.startsWith('-')) {
        return { type: 'remove', content: line };
      } else {
        return { type: 'context', content: line };
      }
    });
  }
  
  onMount(() => {
    loadGitStatus();
    refreshInterval = window.setInterval(loadGitStatus, 5000);
    document.addEventListener('keydown', handleKeydown);
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
    document.removeEventListener('keydown', handleKeydown);
  });
  
  $: allFiles = [
    ...(gitStatus?.staged || []),
    ...(gitStatus?.unstaged || []),
    ...(gitStatus?.untracked || [])
  ];
</script>

{#if show}
  <div class="git-panel-overlay" on:click={close} transition:fade={{ duration: 200 }}>
    <div class="git-panel" on:click|stopPropagation>
      <div class="git-header">
        <h2>Git</h2>
        <div class="git-branch">
          <span class="branch-icon">🌿</span>
          <span class="branch-name">{gitStatus?.branch || 'No branch'}</span>
          {#if gitStatus?.upstream}
            <span class="branch-upstream">→ {gitStatus.upstream}</span>
          {/if}
          {#if gitStatus?.ahead > 0}
            <span class="branch-ahead">↑{gitStatus.ahead}</span>
          {/if}
          {#if gitStatus?.behind > 0}
            <span class="branch-behind">↓{gitStatus.behind}</span>
          {/if}
        </div>
        <button class="close-btn" on:click={close}>✕</button>
      </div>
      
      <div class="git-content">
        {#if showDiffView && selectedFile}
          <!-- Diff View -->
          <div class="diff-view">
            <div class="diff-header">
              <button class="back-btn" on:click={() => showDiffView = false}>
                ← Back
              </button>
              <span class="diff-file">{selectedFile.path}</span>
            </div>
            <div class="diff-content">
              {#each parseDiff(diffContent) as line}
                <div class="diff-line {line.type}">
                  <pre>{line.content}</pre>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <!-- File List View -->
          <div class="file-sections">
            <!-- Staged Changes -->
            <div class="file-section">
              <div class="section-header">
                <h3>Staged Changes ({gitStatus?.staged.length || 0})</h3>
                {#if gitStatus?.staged.length > 0}
                  <button class="section-action" on:click={unstageAll}>
                    Unstage All
                  </button>
                {/if}
              </div>
              {#if gitStatus?.staged.length > 0}
                <div class="file-list">
                  {#each gitStatus.staged as file}
                    <div class="file-item">
                      <span 
                        class="file-status" 
                        style="color: {statusColors[file.status]}"
                      >
                        {statusIcons[file.status]}
                      </span>
                      <span class="file-path" on:click={() => loadDiff(file)}>
                        {file.path}
                      </span>
                      <div class="file-stats">
                        {#if file.additions}
                          <span class="additions">+{file.additions}</span>
                        {/if}
                        {#if file.deletions}
                          <span class="deletions">-{file.deletions}</span>
                        {/if}
                      </div>
                      <button 
                        class="file-action"
                        on:click={() => unstageFile(file)}
                        title="Unstage"
                      >
                        -
                      </button>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="empty-section">No staged changes</div>
              {/if}
            </div>
            
            <!-- Changes -->
            <div class="file-section">
              <div class="section-header">
                <h3>Changes ({gitStatus?.unstaged.length || 0})</h3>
                {#if gitStatus?.unstaged.length > 0}
                  <button class="section-action" on:click={stageAll}>
                    Stage All
                  </button>
                {/if}
              </div>
              {#if gitStatus?.unstaged.length > 0}
                <div class="file-list">
                  {#each gitStatus.unstaged as file}
                    <div class="file-item">
                      <span 
                        class="file-status" 
                        style="color: {statusColors[file.status]}"
                      >
                        {statusIcons[file.status]}
                      </span>
                      <span class="file-path" on:click={() => loadDiff(file)}>
                        {file.path}
                      </span>
                      <div class="file-stats">
                        {#if file.additions}
                          <span class="additions">+{file.additions}</span>
                        {/if}
                        {#if file.deletions}
                          <span class="deletions">-{file.deletions}</span>
                        {/if}
                      </div>
                      <button 
                        class="file-action"
                        on:click={() => stageFile(file)}
                        title="Stage"
                      >
                        +
                      </button>
                    </div>
                  {/each}
                </div>
              {:else}
                <div class="empty-section">No changes</div>
              {/if}
            </div>
            
            <!-- Untracked Files -->
            {#if gitStatus?.untracked.length > 0}
              <div class="file-section">
                <div class="section-header">
                  <h3>Untracked Files ({gitStatus.untracked.length})</h3>
                </div>
                <div class="file-list">
                  {#each gitStatus.untracked as file}
                    <div class="file-item">
                      <span 
                        class="file-status" 
                        style="color: {statusColors[file.status]}"
                      >
                        {statusIcons[file.status]}
                      </span>
                      <span class="file-path" on:click={() => loadDiff(file)}>
                        {file.path}
                      </span>
                      <button 
                        class="file-action"
                        on:click={() => stageFile(file)}
                        title="Stage"
                      >
                        +
                      </button>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          </div>
          
          <!-- Commit Section -->
          <div class="commit-section">
            <textarea
              bind:value={commitMessage}
              placeholder="Commit message (Ctrl+Enter to commit)"
              rows="3"
            ></textarea>
            <div class="commit-actions">
              <button 
                class="commit-btn"
                on:click={commit}
                disabled={!commitMessage.trim() || gitStatus?.staged.length === 0}
              >
                Commit
              </button>
              <button class="push-btn" on:click={push}>
                Push
              </button>
              <button class="pull-btn" on:click={pull}>
                Pull
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .git-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2500;
  }
  
  .git-panel {
    width: 90%;
    max-width: 800px;
    height: 80vh;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 16px 48px rgba(0, 0, 0, 0.3);
  }
  
  .git-header {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    gap: 16px;
  }
  
  .git-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
  }
  
  .git-branch {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
  }
  
  .branch-icon {
    font-size: 16px;
  }
  
  .branch-name {
    font-weight: 600;
    color: var(--fg-primary);
  }
  
  .branch-upstream {
    color: var(--fg-secondary);
  }
  
  .branch-ahead,
  .branch-behind {
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .branch-ahead {
    color: var(--success);
  }
  
  .branch-behind {
    color: var(--warning);
  }
  
  .close-btn {
    background: none;
    border: none;
    color: var(--fg-tertiary);
    font-size: 20px;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .close-btn:hover {
    background: var(--bg-hover);
    color: var(--fg-primary);
  }
  
  .git-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .file-sections {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .file-section {
    margin-bottom: 24px;
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .section-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--fg-secondary);
    text-transform: uppercase;
  }
  
  .section-action {
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .section-action:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .file-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .file-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .file-item:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .file-status {
    font-weight: bold;
    font-family: monospace;
    width: 20px;
    text-align: center;
  }
  
  .file-path {
    flex: 1;
    cursor: pointer;
    font-size: 13px;
  }
  
  .file-path:hover {
    color: var(--accent);
    text-decoration: underline;
  }
  
  .file-stats {
    display: flex;
    gap: 8px;
    font-size: 12px;
    font-family: monospace;
  }
  
  .additions {
    color: var(--success);
  }
  
  .deletions {
    color: var(--error);
  }
  
  .file-action {
    width: 24px;
    height: 24px;
    padding: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .file-action:hover {
    background: var(--accent);
    color: white;
  }
  
  .empty-section {
    padding: 20px;
    text-align: center;
    color: var(--fg-tertiary);
    font-size: 13px;
  }
  
  .commit-section {
    padding: 20px;
    border-top: 1px solid var(--border);
    background: var(--bg-primary);
  }
  
  .commit-section textarea {
    width: 100%;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 12px;
    color: var(--fg-primary);
    font-size: 14px;
    resize: vertical;
    outline: none;
  }
  
  .commit-section textarea:focus {
    border-color: var(--accent);
  }
  
  .commit-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  
  .commit-btn,
  .push-btn,
  .pull-btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .commit-btn {
    background: var(--accent);
    color: white;
  }
  
  .commit-btn:hover:not(:disabled) {
    background: var(--accent-hover);
  }
  
  .commit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .push-btn,
  .pull-btn {
    background: var(--bg-tertiary);
    color: var(--fg-primary);
    border: 1px solid var(--border);
  }
  
  .push-btn:hover,
  .pull-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  /* Diff View */
  .diff-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .diff-header {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-primary);
  }
  
  .back-btn {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .back-btn:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .diff-file {
    font-weight: 600;
    font-size: 14px;
  }
  
  .diff-content {
    flex: 1;
    overflow-y: auto;
    background: var(--bg-primary);
    font-family: monospace;
    font-size: 12px;
    line-height: 1.5;
  }
  
  .diff-line {
    padding: 0 20px;
    white-space: pre-wrap;
  }
  
  .diff-line pre {
    margin: 0;
    white-space: pre-wrap;
    word-wrap: break-word;
  }
  
  .diff-line.header {
    background: var(--bg-tertiary);
    color: var(--fg-secondary);
    font-weight: bold;
  }
  
  .diff-line.meta {
    background: var(--bg-secondary);
    color: var(--accent);
  }
  
  .diff-line.add {
    background: rgba(46, 160, 67, 0.15);
    color: var(--success);
  }
  
  .diff-line.remove {
    background: rgba(248, 81, 73, 0.15);
    color: var(--error);
  }
  
  .diff-line.context {
    color: var(--fg-primary);
  }
</style>