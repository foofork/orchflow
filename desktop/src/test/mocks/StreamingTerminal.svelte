<script lang="ts">
  export let terminalId: string;
  export let title: string = 'Terminal';
  export let initialRows: number = 24;
  export let initialCols: number = 80;
  export let shell: string | undefined = undefined;
  export let cwd: string | undefined = undefined;
  export let env: Record<string, string> | undefined = undefined;
  export let testMode: boolean = true;
  
  export function focus() {
    // Mock focus implementation
  }
</script>

<div class="streaming-terminal-mock" data-terminal-id={terminalId}>
  <div class="terminal-content">
    Mock Terminal: {title}
  </div>
</div>

<style>
  .streaming-terminal-mock {
    width: 100%;
    height: 100%;
    background: #1e1e2e;
    color: #cdd6f4;
    padding: 1rem;
  }
</style>