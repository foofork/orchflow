<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { orchestrator } from '$lib/stores/orchestrator';
  import type { Session, Pane } from '$lib/api/orchestrator-client';
  
  export let onSelectPane: (pane: Pane) => void = () => {};
  
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
  let isConnected = true;
  
  // Subscribe to orchestrator state
  $: {
    orchestrator.subscribe(state => {
      sessions = state.sessions;
      panes = state.panes;
      isConnected = state.isConnected;
    });
  }
  
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
      const isActive = pane.pane_type === 'terminal';
      const cpu = isActive ? Math.random() * 50 + 10 : Math.random() * 5;
      const memory = isActive ? Math.random() * 200 + 50 : Math.random() * 50;
      
      currentMetrics.cpu = parseFloat(cpu.toFixed(1));
      currentMetrics.memory = parseFloat(memory.toFixed(1));
      
      paneMetrics.set(paneId, currentMetrics);
      
      // Update history
      const history = metricsHistory.get(paneId) || { cpu: [], memory: [] };
      history.cpu.push(currentMetrics.cpu);
      history.memory.push(currentMetrics.memory);
      
      // Keep last 60 data points (2 minutes of history)
      if (history.cpu.length > 60) {
        history.cpu.shift();
        history.memory.shift();
      }
      
      metricsHistory.set(paneId, history);
    });
    
    // Trigger reactivity
    paneMetrics = paneMetrics;
    metricsHistory = metricsHistory;
  }
  
  function getStatusIcon(pane: Pane) {
    // All panes are currently considered active
    return '🟢';
  }
  
  function getStatusColor(pane: Pane) {
    // All panes are currently considered active
    return 'var(--success)';
  }
  
  function getStatusText(pane: Pane) {
    return 'Active';
  }
  
  function getPaneIcon(pane: Pane) {
    switch (pane.pane_type) {
      case 'terminal': return '📟';
      case 'editor': return '📝';
      case 'file_tree': return '📁';
      default: return '📋';
    }
  }
  
  function formatTime(date: Date | undefined) {
    if (!date) return 'Never';
    const d = new Date(date);
    return d.toLocaleTimeString();
  }
  
  function formatCPU(cpu: number): string {
    return `${cpu.toFixed(1)}%`;
  }
  
  function formatMemory(memory: number): string {
    if (memory < 1024) return `${memory.toFixed(0)} MB`;
    return `${(memory / 1024).toFixed(1)} GB`;
  }
  
  async function killPane(pane: Pane) {
    try {
      await orchestrator.closePane(pane.id);
    } catch (error) {
      console.error('Failed to kill pane:', error);
    }
  }
  
  async function restartPane(pane: Pane) {
    try {
      await orchestrator.closePane(pane.id);
      // Re-create terminal in same session
      await orchestrator.createTerminal(pane.session_id, {
        title: pane.title
      });
    } catch (error) {
      console.error('Failed to restart pane:', error);
    }
  }
  
  function attachPane(pane: Pane) {
    orchestrator.setActivePane(pane.id);
    onSelectPane(pane);
  }
  
  function createSparkline(data: number[], width = 100, height = 30): string {
    if (data.length < 2) return '';
    
    const max = Math.max(...data, 1);
    const min = Math.min(...data, 0);
    const range = max - min || 1;
    
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');
    
    return `M ${points}`;
  }
  
  $: allPanes = Array.from(panes.values());
  
  $: stats = {
    total: allPanes.length,
    running: allPanes.length, // All panes are considered running
    busy: 0,
    idle: 0,
    error: 0,
  };
  
  $: systemMetrics = {
    cpu: Math.random() * 30 + 10, // Simulated system CPU
    memory: { used: Math.random() * 8000 + 2000, total: 16384, percentage: 0 },
    uptime: 0,
    agentCount: allPanes.length,
    activeAgents: allPanes.length
  };
</script>

<div class="dashboard-enhanced">
  <div class="header">
    <h2>OrchFlow Dashboard</h2>
    <div class="header-actions">
      <button 
        class="view-toggle" 
        class:active={showTableView}
        on:click={() => showTableView = !showTableView}
      >
        {showTableView ? '📊 Card View' : '📋 Table View'}
      </button>
      <div class="connection-status">
        {#if isConnected}
          <span class="status connected">● Connected</span>
        {:else}
          <span class="status disconnected">● Disconnected</span>
        {/if}
      </div>
    </div>
  </div>
  
  <!-- System Stats -->
  <div class="system-stats">
    <div class="stat-card">
      <div class="stat-icon">💻</div>
      <div class="stat-info">
        <div class="stat-value">{formatCPU(systemMetrics.cpu)}</div>
        <div class="stat-label">System CPU</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🧠</div>
      <div class="stat-info">
        <div class="stat-value">{formatMemory(systemMetrics.memory.used)}</div>
        <div class="stat-label">Memory Used</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">🚀</div>
      <div class="stat-info">
        <div class="stat-value">{stats.running}</div>
        <div class="stat-label">Running</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⏸️</div>
      <div class="stat-info">
        <div class="stat-value">{stats.idle}</div>
        <div class="stat-label">Idle</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon">⚠️</div>
      <div class="stat-info">
        <div class="stat-value" style="color: var(--error)">{stats.error}</div>
        <div class="stat-label">Errors</div>
      </div>
    </div>
  </div>
  
  <!-- Panes View -->
  <div class="agents-section">
    <h3>Active Panes</h3>
    
    {#if allPanes.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📦</span>
        <p>No panes running</p>
        <p class="hint">Press Ctrl+P to open command palette</p>
      </div>
    {:else if showTableView}
      <!-- Table View -->
      <div class="table-container">
        <table class="agents-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Status</th>
              <th>CPU %</th>
              <th>Memory</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each allPanes as pane}
              {@const metrics = paneMetrics.get(pane.id)}
              {@const history = metricsHistory.get(pane.id)}
              <tr>
                <td>
                  <div class="name-cell">
                    <span>{pane.title}</span>
                    <span class="agent-id">{pane.id}</span>
                  </div>
                </td>
                <td>{pane.pane_type}</td>
                <td>
                  <span class="status-badge" style="color: {getStatusColor(pane)}">
                    {getStatusIcon(pane)} {getStatusText(pane)}
                  </span>
                </td>
                <td>
                  <div class="metric-cell">
                    <span>{metrics ? formatCPU(metrics.cpu) : '-'}</span>
                    {#if history && history.cpu.length > 1}
                      <svg class="sparkline" viewBox="0 0 100 30">
                        <path 
                          d={createSparkline(history.cpu)}
                          fill="none"
                          stroke="var(--accent)"
                          stroke-width="2"
                        />
                      </svg>
                    {/if}
                  </div>
                </td>
                <td>{metrics ? formatMemory(metrics.memory) : '-'}</td>
                <td>
                  <div class="action-buttons">
                    <button 
                      class="action-btn kill"
                      on:click={() => killPane(pane)}
                      title="Kill pane"
                    >
                      🞩
                    </button>
                    <button 
                      class="action-btn restart"
                      on:click={() => restartPane(pane)}
                      title="Restart pane"
                    >
                      ↻
                    </button>
                    <button 
                      class="action-btn attach"
                      on:click={() => attachPane(pane)}
                      title="Attach to pane"
                    >
                      🔍
                    </button>
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <!-- Card View -->
      <div class="agent-grid">
        {#each allPanes as pane}
          {@const metrics = paneMetrics.get(pane.id)}
          {@const history = metricsHistory.get(pane.id)}
          <div class="agent-card">
            <div class="card-header">
              <span class="status-icon">{getPaneIcon(pane)}</span>
              <span class="agent-name">{pane.title}</span>
              <span class="agent-type">{pane.pane_type}</span>
            </div>
            
            <div class="card-metrics">
              <div class="metric">
                <span class="metric-label">CPU</span>
                <span class="metric-value">{metrics ? formatCPU(metrics.cpu) : '-'}</span>
              </div>
              <div class="metric">
                <span class="metric-label">Memory</span>
                <span class="metric-value">{metrics ? formatMemory(metrics.memory) : '-'}</span>
              </div>
            </div>
            
            {#if history && history.cpu.length > 1}
              <div class="card-chart">
                <svg viewBox="0 0 100 30">
                  <path 
                    d={createSparkline(history.cpu)}
                    fill="none"
                    stroke="var(--accent)"
                    stroke-width="2"
                  />
                </svg>
              </div>
            {/if}
            
            <div class="card-actions">
              <button 
                class="card-btn"
                on:click={() => attachPane(pane)}
              >
                Attach
              </button>
              <button 
                class="card-btn secondary"
                on:click={() => restartPane(pane)}
              >
                Restart
              </button>
              <button 
                class="card-btn danger"
                on:click={() => killPane(pane)}
              >
                Kill
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .dashboard-enhanced {
    height: 100%;
    overflow-y: auto;
    background: var(--bg-primary);
    color: var(--fg-primary);
    padding: 20px;
  }
  
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }
  
  .header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
  
  .header-actions {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  
  .view-toggle {
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--fg-primary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .view-toggle:hover {
    background: var(--bg-hover);
    border-color: var(--accent);
  }
  
  .view-toggle.active {
    background: var(--accent);
    color: white;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    font-size: 13px;
  }
  
  .status {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .status.connected {
    color: var(--success);
  }
  
  .status.disconnected {
    color: var(--error);
  }
  
  /* System Stats */
  .system-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
    margin-bottom: 32px;
  }
  
  .stat-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .stat-icon {
    font-size: 24px;
  }
  
  .stat-info {
    flex: 1;
  }
  
  .stat-value {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  
  .stat-label {
    font-size: 12px;
    color: var(--fg-secondary);
    text-transform: uppercase;
  }
  
  /* Agents Section */
  .agents-section h3 {
    margin: 0 0 20px 0;
    font-size: 18px;
    font-weight: 600;
  }
  
  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: var(--fg-tertiary);
  }
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .empty-state p {
    margin: 0 0 8px 0;
  }
  
  .hint {
    font-size: 13px;
    color: var(--fg-secondary);
  }
  
  /* Table View */
  .table-container {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .agents-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  
  .agents-table th {
    text-align: left;
    padding: 12px 16px;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    font-weight: 600;
    color: var(--fg-secondary);
    text-transform: uppercase;
    font-size: 12px;
  }
  
  .agents-table td {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  
  .agents-table tr:last-child td {
    border-bottom: none;
  }
  
  .agents-table tr:hover {
    background: var(--bg-hover);
  }
  
  .agents-table tr.error {
    background: rgba(239, 68, 68, 0.1);
  }
  
  .name-cell {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .agent-id {
    font-size: 11px;
    color: var(--fg-tertiary);
  }
  
  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 500;
  }
  
  .metric-cell {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .sparkline {
    width: 60px;
    height: 20px;
  }
  
  .action-buttons {
    display: flex;
    gap: 4px;
  }
  
  .action-btn {
    width: 28px;
    height: 28px;
    padding: 0;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  
  .action-btn:hover:not(:disabled) {
    background: var(--bg-hover);
  }
  
  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .action-btn.kill:hover {
    background: var(--error);
    color: white;
  }
  
  .action-btn.restart:hover {
    background: var(--warning);
    color: black;
  }
  
  .action-btn.attach:hover {
    background: var(--accent);
    color: white;
  }
  
  /* Card View */
  .agent-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
  }
  
  .agent-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.2s;
  }
  
  .agent-card:hover {
    border-color: var(--accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
  
  .agent-card.error {
    border-color: var(--error);
  }
  
  .card-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  
  .status-icon {
    font-size: 16px;
  }
  
  .agent-name {
    flex: 1;
    font-weight: 600;
  }
  
  .agent-type {
    font-size: 12px;
    color: var(--fg-secondary);
    text-transform: uppercase;
  }
  
  .card-metrics {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  
  .metric {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .metric-label {
    font-size: 11px;
    color: var(--fg-secondary);
    text-transform: uppercase;
  }
  
  .metric-value {
    font-size: 16px;
    font-weight: 600;
  }
  
  .card-chart {
    margin-bottom: 12px;
    height: 40px;
  }
  
  .card-chart svg {
    width: 100%;
    height: 100%;
  }
  
  .card-actions {
    display: flex;
    gap: 8px;
  }
  
  .card-btn {
    flex: 1;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 4px;
    color: var(--fg-primary);
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .card-btn:hover:not(:disabled) {
    background: var(--accent);
    color: white;
  }
  
  .card-btn.secondary:hover {
    background: var(--warning);
    color: black;
  }
  
  .card-btn.danger:hover {
    background: var(--error);
    color: white;
  }
  
  .card-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>