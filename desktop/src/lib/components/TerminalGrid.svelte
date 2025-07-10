<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import StreamingTerminal from './StreamingTerminal.svelte';
  import { terminalIPC } from '$lib/services/terminal-ipc';
  import type { ComponentType } from 'svelte';
  
  export type GridLayout = 'single' | 'split-horizontal' | 'split-vertical' | 'grid-2x2' | 'grid-3x3';
  
  interface TerminalInstance {
    id: string;
    component?: ComponentType;
    title: string;
    active: boolean;
  }
  
  export let layout: GridLayout = 'single';
  export let initialTerminals: number = 1;
  
  let terminals: TerminalInstance[] = [];
  let activeTerminalId: string | null = null;
  let containerEl: HTMLDivElement;
  let terminalRefs: Record<string, StreamingTerminal> = {};
  
  // Generate unique terminal IDs
  let terminalCounter = 0;
  function generateTerminalId(): string {
    return `terminal-${Date.now()}-${terminalCounter++}`;
  }
  
  // Create initial terminals
  onMount(() => {
    for (let i = 0; i < initialTerminals; i++) {
      createTerminal();
    }
  });
  
  onDestroy(() => {
    // Clean up all terminals
    terminals.forEach(term => {
      terminalIPC.stopTerminal(term.id).catch(console.error);
    });
  });
  
  function createTerminal(title?: string) {
    const id = generateTerminalId();
    const terminal: TerminalInstance = {
      id,
      title: title || `Terminal ${terminals.length + 1}`,
      active: terminals.length === 0
    };
    
    terminals = [...terminals, terminal];
    
    if (terminal.active) {
      activeTerminalId = id;
    }
  }
  
  function closeTerminal(id: string) {
    const index = terminals.findIndex(t => t.id === id);
    if (index === -1) return;
    
    // Stop the terminal
    terminalIPC.stopTerminal(id).catch(console.error);
    
    // Remove from list
    terminals = terminals.filter(t => t.id !== id);
    
    // Select another terminal if this was active
    if (activeTerminalId === id && terminals.length > 0) {
      const newIndex = Math.min(index, terminals.length - 1);
      activeTerminalId = terminals[newIndex].id;
      terminals[newIndex].active = true;
    }
  }
  
  function focusTerminal(id: string) {
    terminals = terminals.map(t => ({
      ...t,
      active: t.id === id
    }));
    activeTerminalId = id;
    
    // Focus the actual terminal
    const terminalRef = terminalRefs[id];
    if (terminalRef) {
      terminalRef.focus();
    }
  }
  
  function handleKeyDown(event: KeyboardEvent) {
    // Ctrl+Shift+T: New terminal
    if (event.ctrlKey && event.shiftKey && event.key === 'T') {
      event.preventDefault();
      createTerminal();
    }
    // Ctrl+Shift+W: Close current terminal
    else if (event.ctrlKey && event.shiftKey && event.key === 'W') {
      event.preventDefault();
      if (activeTerminalId) {
        closeTerminal(activeTerminalId);
      }
    }
    // Ctrl+Tab: Next terminal
    else if (event.ctrlKey && event.key === 'Tab') {
      event.preventDefault();
      const currentIndex = terminals.findIndex(t => t.id === activeTerminalId);
      if (currentIndex !== -1) {
        const nextIndex = (currentIndex + 1) % terminals.length;
        focusTerminal(terminals[nextIndex].id);
      }
    }
    // Ctrl+Shift+Tab: Previous terminal
    else if (event.ctrlKey && event.shiftKey && event.key === 'Tab') {
      event.preventDefault();
      const currentIndex = terminals.findIndex(t => t.id === activeTerminalId);
      if (currentIndex !== -1) {
        const prevIndex = (currentIndex - 1 + terminals.length) % terminals.length;
        focusTerminal(terminals[prevIndex].id);
      }
    }
    // Ctrl+1-9: Switch to terminal by number
    else if (event.ctrlKey && event.key >= '1' && event.key <= '9') {
      event.preventDefault();
      const index = parseInt(event.key) - 1;
      if (index < terminals.length) {
        focusTerminal(terminals[index].id);
      }
    }
  }
  
  // Layout-specific grid classes
  function getGridClass(): string {
    switch (layout) {
      case 'split-horizontal':
        return 'grid-split-horizontal';
      case 'split-vertical':
        return 'grid-split-vertical';
      case 'grid-2x2':
        return 'grid-2x2';
      case 'grid-3x3':
        return 'grid-3x3';
      default:
        return 'grid-single';
    }
  }
  
  // Public API
  export function addTerminal(title?: string) {
    createTerminal(title);
  }
  
  export function removeTerminal(id: string) {
    closeTerminal(id);
  }
  
  export function setLayout(newLayout: GridLayout) {
    layout = newLayout;
  }
  
  export function getActiveTerminal(): string | null {
    return activeTerminalId;
  }
  
  export function broadcastInput(data: string) {
    const terminalIds = terminals.map(t => t.id);
    terminalIPC.broadcastInput(terminalIds, data);
  }
</script>

<div 
  class="terminal-grid-container"
  bind:this={containerEl}
  on:keydown={handleKeyDown}
>
  {#if terminals.length === 0}
    <div class="empty-state">
      <p>No terminals open</p>
      <button on:click={() => createTerminal()}>
        Create Terminal
      </button>
    </div>
  {:else}
    <div class="terminal-grid {getGridClass()}">
      {#each terminals as terminal (terminal.id)}
        <div 
          class="terminal-pane"
          class:active={terminal.active}
          on:click={() => focusTerminal(terminal.id)}
        >
          <div class="terminal-header">
            <span class="terminal-title">{terminal.title}</span>
            <button 
              class="terminal-close"
              on:click|stopPropagation={() => closeTerminal(terminal.id)}
              aria-label="Close terminal"
            >
              ×
            </button>
          </div>
          <div class="terminal-content">
            <StreamingTerminal
              bind:this={terminalRefs[terminal.id]}
              terminalId={terminal.id}
              title={terminal.title}
            />
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .terminal-grid-container {
    width: 100%;
    height: 100%;
    background: #11111b;
    position: relative;
    overflow: hidden;
  }
  
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6c7086;
    font-family: system-ui, -apple-system, sans-serif;
  }
  
  .empty-state button {
    margin-top: 1rem;
    padding: 0.5rem 1rem;
    background: #89b4fa;
    color: #1e1e2e;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 500;
  }
  
  .empty-state button:hover {
    background: #74c7ec;
  }
  
  .terminal-grid {
    width: 100%;
    height: 100%;
    display: grid;
    gap: 2px;
    padding: 2px;
  }
  
  .grid-single {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }
  
  .grid-split-horizontal {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr;
  }
  
  .grid-split-vertical {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .grid-2x2 {
    grid-template-columns: 1fr 1fr;
    grid-template-rows: 1fr 1fr;
  }
  
  .grid-3x3 {
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
  
  .terminal-pane {
    display: flex;
    flex-direction: column;
    background: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 4px;
    overflow: hidden;
    transition: border-color 0.2s;
  }
  
  .terminal-pane:hover {
    border-color: #45475a;
  }
  
  .terminal-pane.active {
    border-color: #89b4fa;
  }
  
  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem;
    background: #181825;
    border-bottom: 1px solid #313244;
    font-size: 0.875rem;
    color: #cdd6f4;
  }
  
  .terminal-title {
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .terminal-close {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #6c7086;
    cursor: pointer;
    border-radius: 4px;
    font-size: 1.2rem;
    line-height: 1;
  }
  
  .terminal-close:hover {
    background: #313244;
    color: #cdd6f4;
  }
  
  .terminal-content {
    flex: 1;
    overflow: hidden;
  }
</style>