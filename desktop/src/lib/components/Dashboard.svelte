<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { manager, sessions as sessionsStore, panes as panesStore } from '$lib/stores/manager';
  import type { Session, Pane } from '$lib/api/manager-client';
  
  interface PaneMetrics {
    paneId: string;
    cpu: number;
    memory: number;
    pid?: number;
  }
  
  interface MetricsHistory {
    cpu: number[];
    memory: number[];
  }
  
  let sessions: Session[] = [];
  let panes: Map<string, Pane> = new Map();
  let paneMetrics = new Map<string, PaneMetrics>();
  let metricsHistory = new Map<string, MetricsHistory>();
  let refreshInterval: number;
  let showTableView = false;
  
  // Subscribe to manager stores
  $: sessions = $sessionsStore;
  $: panes = $panesStore;
  
  onMount(() => {
    // Start metrics collection
    collectMetrics();
    refreshInterval = window.setInterval(collectMetrics, 2000);
  });
  
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  
  async function collectMetrics() {
    // In a real implementation, this would call the Rust backend
    // For now, simulate metrics for active panes
    panes.forEach((pane, paneId) => {
      const currentMetrics = paneMetrics.get(paneId) || {
        paneId,
        cpu: 0,
        memory: 0,
      };
      
      // Simulate CPU and memory values based on pane type
      const isActive = pane.pane_type === 'Terminal';
      const cpu = isActive ? Math.random() * 50 + 10 : Math.random() * 5;
      const memory = isActive ? Math.random() * 200 + 50 : Math.random() * 50;
      
      currentMetrics.cpu = parseFloat(cpu.toFixed(1));
      currentMetrics.memory = parseFloat(memory.toFixed(1));
      
      paneMetrics.set(paneId, currentMetrics);
      
      // Update history
      const history = metricsHistory.get(paneId) || { cpu: [], memory: [] };
      history.cpu.push(currentMetrics.cpu);
      history.memory.push(currentMetrics.memory);
      
      // Keep only last 20 data points
      if (history.cpu.length > 20) {
        history.cpu.shift();
        history.memory.shift();
      }
      
      metricsHistory.set(paneId, history);
    });
    
    // Trigger reactivity
    paneMetrics = paneMetrics;
    metricsHistory = metricsHistory;
  }
  
  function getSessionPanes(sessionId: string): Pane[] {
    return Array.from(panes.values()).filter(p => p.session_id === sessionId);
  }
  
  function getPaneStatusClass(pane: Pane): string {
    // For now, all panes are considered active
    return 'running';
  }
  
  function getPaneStatusText(pane: Pane): string {
    return 'Active';
  }
  
  function formatBytes(bytes: number): string {
    return `${bytes.toFixed(1)} MB`;
  }
  
  function getSparklinePoints(values: number[]): string {
    if (values.length < 2) return '';
    
    const width = 100;
    const height = 30;
    const max = Math.max(...values, 1);
    const step = width / (values.length - 1);
    
    return values
      .map((value, i) => {
        const x = i * step;
        const y = height - (value / max) * height;
        return `${x},${y}`;
      })
      .join(' ');
  }
  
  async function createNewTerminal(sessionId: string) {
    await manager.createTerminal(sessionId, { name: 'Terminal' });
  }
  
  async function createNewSession() {
    const name = prompt('Session name:') || `Session ${sessions.length + 1}`;
    await manager.createSession(name);
  }
</script>

<div class="dashboard">
  <div class="header">
    <h2>Dashboard</h2>
    <div class="actions">
      <button class="toggle-view" on:click={() => showTableView = !showTableView} aria-label="Toggle between grid and table view">
        {showTableView ? '📊 Grid View' : '📋 Table View'}
      </button>
      <button class="refresh" on:click={collectMetrics} aria-label="Refresh dashboard metrics">
        🔄 Refresh
      </button>
      <button class="new-session" on:click={createNewSession} aria-label="Create new session">
        ➕ New Session
      </button>
    </div>
  </div>
  
  {#if sessions.length === 0}
    <div class="empty-state">
      <p>No active sessions</p>
      <button on:click={createNewSession} aria-label="Create your first session">Create First Session</button>
    </div>
  {:else if showTableView}
    <!-- Table View -->
    <div class="table-view">
      <table>
        <thead>
          <tr>
            <th>Session</th>
            <th>Pane</th>
            <th>Type</th>
            <th>Status</th>
            <th>CPU %</th>
            <th>Memory</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each sessions as session}
            {#each getSessionPanes(session.id) as pane}
              <tr>
                <td>{session.name}</td>
                <td>{pane.title}</td>
                <td>
                  <span class="pane-type">{pane.pane_type}</span>
                </td>
                <td>
                  <span class="status {getPaneStatusClass(pane)}">
                    {getPaneStatusText(pane)}
                  </span>
                </td>
                <td>{paneMetrics.get(pane.id)?.cpu || 0}%</td>
                <td>{formatBytes(paneMetrics.get(pane.id)?.memory || 0)}</td>
                <td>
                  <button class="action-btn" on:click={() => manager.focusPane(pane.id)} aria-label="View {pane.title} pane">
                    View
                  </button>
                </td>
              </tr>
            {/each}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <!-- Grid View -->
    <div class="grid-view">
      {#each sessions as session}
        <div class="session-group">
          <h3>{session.name}</h3>
          <div class="panes-grid">
            {#each getSessionPanes(session.id) as pane}
              <button 
                class="pane-card"
                on:click={() => manager.focusPane(pane.id)}
                type="button"
                aria-label="Focus {pane.title || 'pane'}"
              >
                <div class="pane-header">
                  <span class="pane-icon">
                    {#if pane.pane_type === 'Terminal'}📟
                    {:else if pane.pane_type === 'Editor'}📝
                    {:else if pane.pane_type === 'FileExplorer'}📁
                    {:else if pane.pane_type === 'Output'}📄
                    {:else}📋{/if}
                  </span>
                  <span class="pane-name">{pane.title}</span>
                  <span class="status {getPaneStatusClass(pane)}">●</span>
                </div>
                
                <div class="pane-type">{pane.pane_type}</div>
                
                <div class="metrics">
                  <div class="metric">
                    <span class="label">CPU</span>
                    <span class="value">{paneMetrics.get(pane.id)?.cpu || 0}%</span>
                    {#if metricsHistory.get(pane.id)?.cpu && metricsHistory.get(pane.id)?.cpu.length > 1}
                      <svg class="sparkline" viewBox="0 0 100 30">
                        <polyline
                          points={getSparklinePoints(metricsHistory.get(pane.id)?.cpu || [])}
                          fill="none"
                          stroke="var(--accent)"
                          stroke-width="2"
                        />
                      </svg>
                    {/if}
                  </div>
                  
                  <div class="metric">
                    <span class="label">Memory</span>
                    <span class="value">{formatBytes(paneMetrics.get(pane.id)?.memory || 0)}</span>
                    {#if metricsHistory.get(pane.id)?.memory && metricsHistory.get(pane.id)?.memory.length > 1}
                      <svg class="sparkline" viewBox="0 0 100 30">
                        <polyline
                          points={getSparklinePoints(metricsHistory.get(pane.id)?.memory || [])}
                          fill="none"
                          stroke="#4caf50"
                          stroke-width="2"
                        />
                      </svg>
                    {/if}
                  </div>
                </div>
                
                {#if 'working_dir' in pane && typeof pane.working_dir === 'string'}
                  <div class="working-dir" title={pane.working_dir}>
                    📁 {pane.working_dir.split('/').pop()}
                  </div>
                {/if}
              </button>
            {/each}
            
            <!-- Add New Pane Card -->
            <button 
              class="pane-card add-new"
              on:click={() => createNewTerminal(session.id)}
              type="button"
              aria-label="Create new terminal"
            >
              <div class="add-icon">➕</div>
              <div class="add-text">New Terminal</div>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dashboard {
    height: 100%;
    overflow-y: auto;
    padding: 20px;
    background: var(--bg-primary);
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }
  
  .header h2 {
    margin: 0;
    font-size: 24px;
    color: var(--fg-primary);
  }
  
  .actions {
    display: flex;
    gap: 8px;
  }
  
  .actions button {
    padding: 6px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .actions button:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 400px;
    color: var(--fg-secondary);
  }
  
  .empty-state button {
    margin-top: 16px;
    padding: 8px 16px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  /* Grid View */
  .session-group {
    margin-bottom: 32px;
  }
  
  .session-group h3 {
    margin: 0 0 16px 0;
    color: var(--fg-secondary);
    font-size: 16px;
  }
  
  .panes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  
  .pane-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    cursor: pointer;
    /* Reset button styles */
    font: inherit;
    color: inherit;
    text-align: left;
    width: 100%;
    display: block;
    transition: all 0.2s;
  }
  
  .pane-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .pane-card.add-new {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    border-style: dashed;
    opacity: 0.6;
  }
  
  .pane-card.add-new:hover {
    opacity: 1;
  }
  
  .add-icon {
    font-size: 32px;
    margin-bottom: 8px;
  }
  
  .add-text {
    color: var(--fg-secondary);
  }
  
  .pane-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  
  .pane-icon {
    font-size: 20px;
  }
  
  .pane-name {
    flex: 1;
    font-weight: 500;
    color: var(--fg-primary);
  }
  
  .status {
    font-size: 10px;
  }
  
  .status.running {
    color: #4caf50;
  }
  
  .status.idle {
    color: #ff9800;
  }
  
  .status.error {
    color: #f44336;
  }
  
  .pane-type {
    font-size: 12px;
    color: var(--fg-tertiary);
    margin-bottom: 12px;
    text-transform: capitalize;
  }
  
  .metrics {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .metric {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .metric .label {
    font-size: 12px;
    color: var(--fg-tertiary);
    min-width: 50px;
  }
  
  .metric .value {
    font-size: 14px;
    font-weight: 500;
    color: var(--fg-primary);
    min-width: 50px;
  }
  
  .sparkline {
    flex: 1;
    height: 20px;
  }
  
  .working-dir {
    margin-top: 12px;
    font-size: 12px;
    color: var(--fg-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  /* Table View */
  .table-view {
    overflow-x: auto;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th {
    text-align: left;
    padding: 12px;
    background: var(--bg-secondary);
    color: var(--fg-secondary);
    font-weight: 500;
    border-bottom: 2px solid var(--border);
  }
  
  td {
    padding: 12px;
    border-bottom: 1px solid var(--border);
  }
  
  tr:hover {
    background: var(--bg-hover);
  }
  
  .action-btn {
    padding: 4px 8px;
    background: var(--accent);
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  
  .action-btn:hover {
    background: var(--accent-hover);
  }
  
  /* Screen reader only content */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>