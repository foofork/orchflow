<script lang="ts">
  export let sessionName: string = 'orchflow-main';
  export let paneId: string | null = null;
  export let command: string | undefined = undefined;
  export let title: string = 'Terminal';
</script>

<div class="mock-tauri-terminal" data-testid="tauri-terminal">
  <div class="terminal-header">{title}</div>
  <div class="terminal-content">
    Mock Terminal - Session: {sessionName}, Pane: {paneId}
  </div>
</div>

<style>
  .mock-tauri-terminal {
    width: 100%;
    height: 100%;
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 8px;
  }
  
  .terminal-header {
    font-weight: bold;
    margin-bottom: 8px;
  }
</style>