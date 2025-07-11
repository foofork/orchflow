<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { fade, slide } from 'svelte/transition';
  
  export let sessionId: string;
  
  interface TestSuite {
    id: string;
    session_id: string;
    name: string;
    project_path: string;
    test_framework: string;
    created_at: string;
    updated_at: string;
  }
  
  interface TestRunSummary {
    id: string;
    suite_name: string;
    project_path: string;
    status: string;
    total_tests: number;
    passed_tests: number;
    failed_tests: number;
    duration_ms: number | null;
    coverage_percent: number | null;
    started_at: string;
    completed_at: string | null;
  }
  
  interface TestResult {
    id: string;
    test_file: string;
    test_name: string;
    test_path: string;
    status: string;
    duration_ms: number | null;
    error_message: string | null;
    error_stack: string | null;
  }
  
  interface TestCoverage {
    file_path: string;
    lines_covered: number;
    lines_total: number;
    branches_covered: number;
    branches_total: number;
    functions_covered: number;
    functions_total: number;
    statements_covered: number;
    statements_total: number;
  }
  
  let testHistory: TestRunSummary[] = [];
  let selectedRun: TestRunSummary | null = null;
  let testResults: TestResult[] = [];
  let testCoverage: TestCoverage[] = [];
  let showFailedOnly = false;
  let loading = false;
  let activeTab: 'results' | 'coverage' = 'results';
  
  let unlistenTestUpdate: UnlistenFn;
  
  onMount(async () => {
    await loadTestHistory();
    
    // Listen for test updates
    unlistenTestUpdate = await listen('test-update', (event) => {
      loadTestHistory();
    });
  });
  
  onDestroy(() => {
    unlistenTestUpdate?.();
  });
  
  async function loadTestHistory() {
    loading = true;
    try {
      testHistory = await invoke('get_test_history', {
        sessionId,
        limit: 20
      });
    } catch (err) {
      console.error('Failed to load test history:', err);
    } finally {
      loading = false;
    }
  }
  
  async function selectRun(run: TestRunSummary) {
    selectedRun = run;
    loading = true;
    
    try {
      const [results, coverage] = await Promise.all([
        invoke<TestResult[]>('get_test_results', { runId: run.id }),
        invoke<TestCoverage[]>('get_test_coverage', { runId: run.id })
      ]);
      
      testResults = results;
      testCoverage = coverage;
    } catch (err) {
      console.error('Failed to load test details:', err);
    } finally {
      loading = false;
    }
  }
  
  function getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'skipped': return '○';
      case 'running': return '⟳';
      default: return '?';
    }
  }
  
  function getStatusColor(status: string): string {
    switch (status) {
      case 'passed': return 'var(--color-success, #a6e3a1)';
      case 'failed': return 'var(--color-error, #f38ba8)';
      case 'skipped': return 'var(--color-warning, #f9e2af)';
      case 'running': return 'var(--color-info, #89b4fa)';
      default: return 'var(--color-text-secondary, #bac2de)';
    }
  }
  
  function formatDuration(ms: number | null): string {
    if (ms === null) return '-';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${((ms % 60000) / 1000).toFixed(0)}s`;
  }
  
  function formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString();
    } catch {
      return dateStr;
    }
  }
  
  function calculateCoveragePercent(covered: number, total: number): number {
    if (total === 0) return 100;
    return Math.round((covered / total) * 100);
  }
  
  function getCoverageColor(percent: number): string {
    if (percent >= 80) return 'var(--color-success, #a6e3a1)';
    if (percent >= 60) return 'var(--color-warning, #f9e2af)';
    return 'var(--color-error, #f38ba8)';
  }
  
  $: filteredResults = showFailedOnly 
    ? testResults.filter(r => r.status === 'failed')
    : testResults;
  
  $: groupedResults = filteredResults.reduce((acc, result) => {
    if (!acc[result.test_file]) {
      acc[result.test_file] = [];
    }
    acc[result.test_file].push(result);
    return acc;
  }, {} as Record<string, TestResult[]>);
  
  $: overallCoverage = testCoverage.length > 0 ? {
    lines: calculateCoveragePercent(
      testCoverage.reduce((sum, c) => sum + c.lines_covered, 0),
      testCoverage.reduce((sum, c) => sum + c.lines_total, 0)
    ),
    branches: calculateCoveragePercent(
      testCoverage.reduce((sum, c) => sum + c.branches_covered, 0),
      testCoverage.reduce((sum, c) => sum + c.branches_total, 0)
    ),
    functions: calculateCoveragePercent(
      testCoverage.reduce((sum, c) => sum + c.functions_covered, 0),
      testCoverage.reduce((sum, c) => sum + c.functions_total, 0)
    ),
    statements: calculateCoveragePercent(
      testCoverage.reduce((sum, c) => sum + c.statements_covered, 0),
      testCoverage.reduce((sum, c) => sum + c.statements_total, 0)
    )
  } : null;
</script>

<div class="test-results-view">
  <div class="header">
    <h2>Test Results</h2>
    <button class="refresh-btn" on:click={loadTestHistory} disabled={loading}>
      <span class:rotating={loading}>⟳</span>
    </button>
  </div>
  
  <div class="layout">
    <div class="sidebar">
      <h3>Recent Runs</h3>
      {#if loading && testHistory.length === 0}
        <div class="loading">Loading...</div>
      {:else if testHistory.length === 0}
        <div class="empty">No test runs yet</div>
      {:else}
        <div class="run-list">
          {#each testHistory as run}
            <button 
              class="run-item"
              class:selected={selectedRun?.id === run.id}
              class:passed={run.status === 'passed'}
              class:failed={run.status === 'failed'}
              class:running={run.status === 'running'}
              on:click={() => selectRun(run)}
            >
              <div class="run-header">
                <span class="status-icon" style="color: {getStatusColor(run.status)}">
                  {getStatusIcon(run.status)}
                </span>
                <span class="suite-name">{run.suite_name}</span>
              </div>
              <div class="run-meta">
                <span class="test-count">
                  {run.passed_tests}/{run.total_tests} passed
                </span>
                {#if run.coverage_percent !== null}
                  <span class="coverage" style="color: {getCoverageColor(run.coverage_percent)}">
                    {run.coverage_percent.toFixed(0)}%
                  </span>
                {/if}
              </div>
              <div class="run-time">
                {formatDate(run.started_at)}
              </div>
              {#if run.duration_ms}
                <div class="duration">
                  Duration: {formatDuration(run.duration_ms)}
                </div>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
    </div>
    
    <div class="main">
      {#if selectedRun}
        <div class="run-details">
          <div class="run-summary">
            <h3>{selectedRun.suite_name}</h3>
            <div class="stats">
              <div class="stat passed">
                <span class="label">Passed</span>
                <span class="value">{selectedRun.passed_tests}</span>
              </div>
              <div class="stat failed">
                <span class="label">Failed</span>
                <span class="value">{selectedRun.failed_tests}</span>
              </div>
              <div class="stat total">
                <span class="label">Total</span>
                <span class="value">{selectedRun.total_tests}</span>
              </div>
              {#if selectedRun.coverage_percent !== null}
                <div class="stat coverage">
                  <span class="label">Coverage</span>
                  <span class="value">{selectedRun.coverage_percent.toFixed(1)}%</span>
                </div>
              {/if}
            </div>
          </div>
          
          <div class="tabs">
            <button 
              class="tab"
              class:active={activeTab === 'results'}
              on:click={() => activeTab = 'results'}
            >
              Test Results
            </button>
            <button 
              class="tab"
              class:active={activeTab === 'coverage'}
              on:click={() => activeTab = 'coverage'}
              disabled={testCoverage.length === 0}
            >
              Coverage
            </button>
            
            {#if activeTab === 'results'}
              <label class="filter-toggle">
                <input 
                  type="checkbox" 
                  bind:checked={showFailedOnly}
                />
                Failed only
              </label>
            {/if}
          </div>
          
          {#if activeTab === 'results'}
            <div class="results-content">
              {#if loading}
                <div class="loading">Loading test results...</div>
              {:else if Object.keys(groupedResults).length === 0}
                <div class="empty">
                  {showFailedOnly ? 'No failed tests' : 'No test results'}
                </div>
              {:else}
                {#each Object.entries(groupedResults) as [file, results]}
                  <div class="file-group" transition:slide>
                    <h4>{file}</h4>
                    <div class="test-list">
                      {#each results as result}
                        <div 
                          class="test-item"
                          class:passed={result.status === 'passed'}
                          class:failed={result.status === 'failed'}
                          class:skipped={result.status === 'skipped'}
                        >
                          <span class="status-icon" style="color: {getStatusColor(result.status)}">
                            {getStatusIcon(result.status)}
                          </span>
                          <span class="test-name">{result.test_name}</span>
                          {#if result.duration_ms}
                            <span class="duration">{result.duration_ms}ms</span>
                          {/if}
                          
                          {#if result.error_message}
                            <div class="error-details">
                              <div class="error-message">{result.error_message}</div>
                              {#if result.error_stack}
                                <pre class="error-stack">{result.error_stack}</pre>
                              {/if}
                            </div>
                          {/if}
                        </div>
                      {/each}
                    </div>
                  </div>
                {/each}
              {/if}
            </div>
          {:else}
            <div class="coverage-content">
              {#if overallCoverage}
                <div class="overall-coverage">
                  <h4>Overall Coverage</h4>
                  <div class="coverage-stats">
                    <div class="coverage-stat">
                      <span class="label">Lines</span>
                      <div class="progress-bar">
                        <div 
                          class="progress-fill"
                          style="width: {overallCoverage.lines}%; background: {getCoverageColor(overallCoverage.lines)}"
                        ></div>
                      </div>
                      <span class="percent">{overallCoverage.lines}%</span>
                    </div>
                    <div class="coverage-stat">
                      <span class="label">Branches</span>
                      <div class="progress-bar">
                        <div 
                          class="progress-fill"
                          style="width: {overallCoverage.branches}%; background: {getCoverageColor(overallCoverage.branches)}"
                        ></div>
                      </div>
                      <span class="percent">{overallCoverage.branches}%</span>
                    </div>
                    <div class="coverage-stat">
                      <span class="label">Functions</span>
                      <div class="progress-bar">
                        <div 
                          class="progress-fill"
                          style="width: {overallCoverage.functions}%; background: {getCoverageColor(overallCoverage.functions)}"
                        ></div>
                      </div>
                      <span class="percent">{overallCoverage.functions}%</span>
                    </div>
                    <div class="coverage-stat">
                      <span class="label">Statements</span>
                      <div class="progress-bar">
                        <div 
                          class="progress-fill"
                          style="width: {overallCoverage.statements}%; background: {getCoverageColor(overallCoverage.statements)}"
                        ></div>
                      </div>
                      <span class="percent">{overallCoverage.statements}%</span>
                    </div>
                  </div>
                </div>
              {/if}
              
              <div class="file-coverage">
                <h4>File Coverage</h4>
                <div class="coverage-table">
                  <div class="table-header">
                    <div class="file-col">File</div>
                    <div class="coverage-col">Lines</div>
                    <div class="coverage-col">Branches</div>
                    <div class="coverage-col">Functions</div>
                    <div class="coverage-col">Statements</div>
                  </div>
                  {#each testCoverage as coverage}
                    <div class="table-row">
                      <div class="file-col">{coverage.file_path}</div>
                      <div class="coverage-col">
                        <span style="color: {getCoverageColor(calculateCoveragePercent(coverage.lines_covered, coverage.lines_total))}">
                          {coverage.lines_covered}/{coverage.lines_total}
                        </span>
                      </div>
                      <div class="coverage-col">
                        <span style="color: {getCoverageColor(calculateCoveragePercent(coverage.branches_covered, coverage.branches_total))}">
                          {coverage.branches_covered}/{coverage.branches_total}
                        </span>
                      </div>
                      <div class="coverage-col">
                        <span style="color: {getCoverageColor(calculateCoveragePercent(coverage.functions_covered, coverage.functions_total))}">
                          {coverage.functions_covered}/{coverage.functions_total}
                        </span>
                      </div>
                      <div class="coverage-col">
                        <span style="color: {getCoverageColor(calculateCoveragePercent(coverage.statements_covered, coverage.statements_total))}">
                          {coverage.statements_covered}/{coverage.statements_total}
                        </span>
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="empty-state">
          <p>Select a test run to view details</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .test-results-view {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--color-bg-primary, #11111b);
  }
  
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .header h2 {
    margin: 0;
    font-size: 20px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .refresh-btn {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
  }
  
  .refresh-btn:hover {
    background: var(--color-bg-hover, #45475a);
  }
  
  .refresh-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .rotating {
    display: inline-block;
    animation: rotate 1s linear infinite;
  }
  
  @keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  .layout {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  
  .sidebar {
    width: 300px;
    background: var(--color-bg-secondary, #1e1e2e);
    border-right: 1px solid var(--color-border, #45475a);
    display: flex;
    flex-direction: column;
  }
  
  .sidebar h3 {
    margin: 0;
    padding: 16px 20px;
    font-size: 16px;
    color: var(--color-text-primary, #cdd6f4);
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .run-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }
  
  .run-item {
    width: 100%;
    text-align: left;
    background: var(--color-bg-primary, #11111b);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .run-item:hover {
    background: var(--color-bg-tertiary, #313244);
  }
  
  .run-item.selected {
    background: var(--color-bg-tertiary, #313244);
    border-color: var(--color-primary, #89b4fa);
  }
  
  .run-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }
  
  .status-icon {
    font-size: 16px;
  }
  
  .suite-name {
    font-weight: 500;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .run-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    margin-bottom: 4px;
  }
  
  .test-count {
    color: var(--color-text-secondary, #bac2de);
  }
  
  .coverage {
    font-weight: 500;
  }
  
  .run-time {
    font-size: 12px;
    color: var(--color-text-secondary, #6c7086);
  }
  
  .duration {
    font-size: 12px;
    color: var(--color-text-secondary, #6c7086);
  }
  
  .main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .run-details {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .run-summary {
    padding: 20px;
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .run-summary h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .stats {
    display: flex;
    gap: 24px;
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat .label {
    font-size: 12px;
    color: var(--color-text-secondary, #bac2de);
    margin-bottom: 4px;
  }
  
  .stat .value {
    font-size: 24px;
    font-weight: 600;
  }
  
  .stat.passed .value {
    color: var(--color-success, #a6e3a1);
  }
  
  .stat.failed .value {
    color: var(--color-error, #f38ba8);
  }
  
  .stat.total .value {
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .stat.coverage .value {
    color: var(--color-info, #89b4fa);
  }
  
  .tabs {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    border-bottom: 1px solid var(--color-border, #45475a);
  }
  
  .tab {
    padding: 12px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    cursor: pointer;
    transition: all 0.2s;
  }
  
  .tab:hover {
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .tab.active {
    color: var(--color-primary, #89b4fa);
    border-bottom-color: var(--color-primary, #89b4fa);
  }
  
  .tab:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .filter-toggle {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
  }
  
  .results-content,
  .coverage-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
  }
  
  .file-group {
    margin-bottom: 24px;
  }
  
  .file-group h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-family: monospace;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .test-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .test-item {
    display: flex;
    align-items: start;
    gap: 8px;
    padding: 8px 12px;
    background: var(--color-bg-secondary, #1e1e2e);
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
  }
  
  .test-item.failed {
    border-color: var(--color-error, #f38ba8);
    background: rgba(243, 139, 168, 0.1);
  }
  
  .test-name {
    flex: 1;
    font-size: 13px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .error-details {
    width: 100%;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--color-border, #45475a);
  }
  
  .error-message {
    font-size: 13px;
    color: var(--color-error, #f38ba8);
    margin-bottom: 8px;
  }
  
  .error-stack {
    font-size: 12px;
    font-family: monospace;
    color: var(--color-text-secondary, #bac2de);
    background: var(--color-bg-primary, #11111b);
    padding: 8px;
    border-radius: 4px;
    overflow-x: auto;
  }
  
  .empty,
  .loading,
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 200px;
    color: var(--color-text-secondary, #6c7086);
    font-size: 14px;
  }
  
  .overall-coverage {
    margin-bottom: 32px;
  }
  
  .overall-coverage h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .coverage-stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .coverage-stat {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .coverage-stat .label {
    font-size: 14px;
    color: var(--color-text-secondary, #bac2de);
    min-width: 80px;
  }
  
  .progress-bar {
    flex: 1;
    height: 8px;
    background: var(--color-bg-tertiary, #313244);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .progress-fill {
    height: 100%;
    transition: width 0.3s ease;
  }
  
  .coverage-stat .percent {
    font-size: 14px;
    font-weight: 500;
    min-width: 40px;
    text-align: right;
  }
  
  .file-coverage h4 {
    margin: 0 0 16px 0;
    font-size: 16px;
    color: var(--color-text-primary, #cdd6f4);
  }
  
  .coverage-table {
    border: 1px solid var(--color-border, #45475a);
    border-radius: 4px;
    overflow: hidden;
  }
  
  .table-header,
  .table-row {
    display: grid;
    grid-template-columns: 1fr 100px 100px 100px 100px;
    align-items: center;
    padding: 8px 12px;
  }
  
  .table-header {
    background: var(--color-bg-tertiary, #313244);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary, #bac2de);
  }
  
  .table-row {
    border-top: 1px solid var(--color-border, #45475a);
    font-size: 13px;
  }
  
  .table-row:hover {
    background: var(--color-bg-secondary, #1e1e2e);
  }
  
  .file-col {
    font-family: monospace;
    color: var(--color-text-primary, #cdd6f4);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .coverage-col {
    text-align: center;
    font-family: monospace;
  }
</style>