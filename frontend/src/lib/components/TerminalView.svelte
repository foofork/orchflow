<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Terminal } from 'xterm';
  import { FitAddon } from 'xterm-addon-fit';
  import { WebLinksAddon } from 'xterm-addon-web-links';
  import { orchestrator } from '$lib/stores/orchestrator';
  import type { Agent } from '$lib/stores/orchestrator';
  
  export let agent: Agent;
  export let active: boolean = false;
  
  let container: HTMLElement;
  let terminal: Terminal;
  let fitAddon: FitAddon;
  let outputInterval: NodeJS.Timeout;
  
  onMount(() => {
    // Create terminal
    terminal = new Terminal({
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5',
      },
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 14,
      lineHeight: 1.2,
      cursorBlink: true,
    });
    
    // Add addons
    fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    
    // Open terminal in container
    terminal.open(container);
    fitAddon.fit();
    
    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
    });
    resizeObserver.observe(container);
    
    // Start polling for output
    startOutputPolling();
    
    // Handle input
    terminal.onData((data) => {
      orchestrator.sendCommand(agent.id, data);
    });
    
    // Cleanup
    return () => {
      resizeObserver.disconnect();
      stopOutputPolling();
      terminal.dispose();
    };
  });
  
  onDestroy(() => {
    stopOutputPolling();
  });
  
  function startOutputPolling() {
    // Initial fetch
    fetchOutput();
    
    // Poll every second when active
    outputInterval = setInterval(() => {
      if (active) {
        fetchOutput();
      }
    }, 1000);
  }
  
  function stopOutputPolling() {
    if (outputInterval) {
      clearInterval(outputInterval);
    }
  }
  
  let lastOutput = '';
  
  async function fetchOutput() {
    try {
      const output = await orchestrator.getOutput(agent.id, 100);
      
      // Only write new content
      if (output !== lastOutput) {
        // Clear and rewrite (simple approach)
        terminal.clear();
        terminal.write(output.replace(/\n/g, '\r\n'));
        lastOutput = output;
      }
    } catch (error) {
      console.error('Failed to fetch output:', error);
    }
  }
  
  $: if (active) {
    fetchOutput();
  }
</script>

<div class="terminal-container" bind:this={container}></div>

<style>
  .terminal-container {
    width: 100%;
    height: 100%;
    background: #1e1e1e;
  }
  
  :global(.xterm) {
    padding: 10px;
    height: 100%;
  }
  
  :global(.xterm-viewport) {
    background-color: transparent !important;
  }
</style>