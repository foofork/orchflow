<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { muxEventHandler } from '$lib/services/mux-event-handler';
  import { formatTimestamp } from '$lib/utils/timestamp';
  
  // Example component showing how to use the mux event handler
  
  let events: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }> = [];
  
  let unsubscribe: (() => void) | null = null;
  
  onMount(() => {
    // Subscribe to mux events
    unsubscribe = muxEventHandler.subscribe({
      onPaneOutput: (paneId, data, timestamp) => {
        events = [...events, {
          type: 'output',
          message: `Pane ${paneId}: ${data.substring(0, 50)}...`,
          timestamp
        }];
      },
      
      onPaneExit: (paneId, exitCode, timestamp) => {
        events = [...events, {
          type: 'exit',
          message: `Pane ${paneId} exited with code ${exitCode}`,
          timestamp
        }];
      },
      
      onSessionCreated: (sessionId, name, timestamp) => {
        events = [...events, {
          type: 'session',
          message: `Session created: ${name} (${sessionId})`,
          timestamp
        }];
      },
      
      onPaneCreated: (paneId, sessionId, timestamp) => {
        events = [...events, {
          type: 'pane',
          message: `Pane ${paneId} created in session ${sessionId}`,
          timestamp
        }];
      },
      
      onMuxError: (error, context, timestamp) => {
        events = [...events, {
          type: 'error',
          message: `Error: ${error}${context ? ` (${context})` : ''}`,
          timestamp
        }];
      }
    });
  });
  
  onDestroy(() => {
    if (unsubscribe) {
      unsubscribe();
    }
  });
  
  function clearEvents() {
    events = [];
  }
</script>

<div class="mux-terminal-example">
  <h3>Mux Backend Events</h3>
  
  <div class="controls">
    <button on:click={clearEvents}>Clear Events</button>
    <span class="event-count">{events.length} events</span>
  </div>
  
  <div class="event-list">
    {#each events as event, index (index)}
      <div class="event event-{event.type}">
        <span class="timestamp">
          {formatTimestamp(event.timestamp, { relative: true })}
        </span>
        <span class="type">[{event.type.toUpperCase()}]</span>
        <span class="message">{event.message}</span>
      </div>
    {/each}
    
    {#if events.length === 0}
      <div class="no-events">
        No events received yet. Events will appear here when the mux backend emits them.
      </div>
    {/if}
  </div>
</div>

<style>
  .mux-terminal-example {
    padding: 1rem;
    background-color: var(--color-surface);
    border-radius: 8px;
    max-height: 400px;
    display: flex;
    flex-direction: column;
  }
  
  h3 {
    margin: 0 0 1rem 0;
    color: var(--color-text-primary);
  }
  
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .event-count {
    color: var(--color-text-secondary);
    font-size: 0.875rem;
  }
  
  .event-list {
    flex: 1;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.875rem;
  }
  
  .event {
    padding: 0.5rem;
    border-bottom: 1px solid var(--color-border-subtle);
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
  }
  
  .event:hover {
    background-color: var(--color-hover);
  }
  
  .timestamp {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
    min-width: 100px;
  }
  
  .type {
    font-weight: bold;
    min-width: 80px;
  }
  
  .event-output .type {
    color: var(--color-success);
  }
  
  .event-exit .type {
    color: var(--color-warning);
  }
  
  .event-session .type,
  .event-pane .type {
    color: var(--color-info);
  }
  
  .event-error .type {
    color: var(--color-error);
  }
  
  .message {
    flex: 1;
    word-break: break-word;
  }
  
  .no-events {
    text-align: center;
    color: var(--color-text-secondary);
    padding: 2rem;
  }
  
  button {
    padding: 0.25rem 0.75rem;
    background-color: var(--color-primary);
    color: var(--color-text-on-primary);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  button:hover {
    background-color: var(--color-primary-hover);
  }
</style>