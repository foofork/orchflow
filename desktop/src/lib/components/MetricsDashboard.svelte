<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { currentMetrics, metricsHistory, isPolling, startMetricsPolling, stopMetricsPolling, formatBytes, formatUptime } from '$lib/services/metrics';
	import type { SystemMetrics } from '$lib/services/metrics';

	export let compact = false;

	let chartContainer: HTMLCanvasElement;
	let chartContext: CanvasRenderingContext2D | null = null;
	let animationFrame: number | null = null;

	// Chart configuration
	const CHART_HEIGHT = 80;
	const CHART_PADDING = 10;
	const MAX_POINTS = 30;

	onMount(() => {
		if (!$isPolling) {
			startMetricsPolling();
		}
		
		if (chartContainer) {
			chartContext = chartContainer.getContext('2d');
			startChartAnimation();
		}

		return () => {
			if (animationFrame) {
				cancelAnimationFrame(animationFrame);
			}
		};
	});

	onDestroy(() => {
		if (animationFrame) {
			cancelAnimationFrame(animationFrame);
		}
	});

	function startChartAnimation() {
		function animate() {
			drawCharts();
			animationFrame = requestAnimationFrame(animate);
		}
		animate();
	}

	function drawCharts() {
		if (!chartContext || !chartContainer) return;

		const width = chartContainer.width;
		const height = chartContainer.height;
		const ctx = chartContext;

		// Clear canvas
		ctx.clearRect(0, 0, width, height);

		if ($metricsHistory.length < 2) return;

		// Get recent data points
		const points = $metricsHistory.slice(-MAX_POINTS);
		const pointWidth = (width - 2 * CHART_PADDING) / (MAX_POINTS - 1);

		// Draw CPU usage chart
		drawMetricChart(ctx, points, width, height / 3, 0, 
			(m: SystemMetrics) => m.cpu.usage, 100, '#3b82f6', 'CPU %');

		// Draw Memory usage chart
		drawMetricChart(ctx, points, width, height / 3, height / 3,
			(m: SystemMetrics) => m.memory.percent, 100, '#10b981', 'Memory %');

		// Draw Network activity chart (normalized)
		const maxNetwork = Math.max(...points.map(p => p.network.bytesReceived + p.network.bytesSent));
		drawMetricChart(ctx, points, width, height / 3, (height / 3) * 2,
			(m: SystemMetrics) => ((m.network.bytesReceived + m.network.bytesSent) / maxNetwork) * 100, 
			100, '#f59e0b', 'Network');
	}

	function drawMetricChart(
		ctx: CanvasRenderingContext2D,
		points: SystemMetrics[],
		width: number,
		height: number,
		offsetY: number,
		valueExtractor: (m: SystemMetrics) => number,
		maxValue: number,
		color: string,
		label: string
	) {
		const chartHeight = height - 2 * CHART_PADDING;
		const pointWidth = (width - 2 * CHART_PADDING) / (points.length - 1);

		// Draw background
		ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
		ctx.fillRect(0, offsetY, width, height);

		// Draw grid lines
		ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
		ctx.lineWidth = 1;
		for (let i = 0; i <= 4; i++) {
			const y = offsetY + CHART_PADDING + (chartHeight / 4) * i;
			ctx.beginPath();
			ctx.moveTo(CHART_PADDING, y);
			ctx.lineTo(width - CHART_PADDING, y);
			ctx.stroke();
		}

		// Draw data line
		ctx.strokeStyle = color;
		ctx.lineWidth = 2;
		ctx.beginPath();

		points.forEach((point, index) => {
			const x = CHART_PADDING + index * pointWidth;
			const value = valueExtractor(point);
			const y = offsetY + CHART_PADDING + chartHeight - (value / maxValue) * chartHeight;
			
			if (index === 0) {
				ctx.moveTo(x, y);
			} else {
				ctx.lineTo(x, y);
			}
		});

		ctx.stroke();

		// Fill area under curve
		ctx.fillStyle = color + '20';
		ctx.beginPath();
		ctx.moveTo(CHART_PADDING, offsetY + height - CHART_PADDING);
		
		points.forEach((point, index) => {
			const x = CHART_PADDING + index * pointWidth;
			const value = valueExtractor(point);
			const y = offsetY + CHART_PADDING + chartHeight - (value / maxValue) * chartHeight;
			ctx.lineTo(x, y);
		});
		
		ctx.lineTo(CHART_PADDING + (points.length - 1) * pointWidth, offsetY + height - CHART_PADDING);
		ctx.closePath();
		ctx.fill();

		// Draw label
		ctx.fillStyle = '#ffffff';
		ctx.font = '12px monospace';
		ctx.fillText(label, CHART_PADDING + 5, offsetY + CHART_PADDING + 15);

		// Draw current value
		if (points.length > 0) {
			const currentValue = valueExtractor(points[points.length - 1]);
			const valueText = `${currentValue.toFixed(1)}${label.includes('%') ? '%' : ''}`;
			const textWidth = ctx.measureText(valueText).width;
			ctx.fillText(valueText, width - CHART_PADDING - textWidth - 5, offsetY + CHART_PADDING + 15);
		}
	}

	function getStatusColor(value: number, type: 'cpu' | 'memory' | 'disk'): string {
		const thresholds = {
			cpu: [50, 80],
			memory: [60, 85],
			disk: [70, 90]
		};

		const [warning, critical] = thresholds[type];
		if (value >= critical) return 'text-red-400';
		if (value >= warning) return 'text-yellow-400';
		return 'text-green-400';
	}

	$: metrics = $currentMetrics;
</script>

<div class="metrics-dashboard" class:compact>
	{#if metrics}
		<!-- Quick Stats -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">🖥️</div>
				<div class="stat-content">
					<div class="stat-label">CPU</div>
					<div class="stat-value {getStatusColor(metrics.cpu.usage, 'cpu')}">
						{metrics.cpu.usage.toFixed(1)}%
					</div>
					<div class="stat-detail">{metrics.cpu.cores} cores</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">🧠</div>
				<div class="stat-content">
					<div class="stat-label">Memory</div>
					<div class="stat-value {getStatusColor(metrics.memory.percent, 'memory')}">
						{metrics.memory.percent.toFixed(1)}%
					</div>
					<div class="stat-detail">{formatBytes(metrics.memory.used)} / {formatBytes(metrics.memory.total)}</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">💾</div>
				<div class="stat-content">
					<div class="stat-label">Disk</div>
					<div class="stat-value {getStatusColor(metrics.disk.percent, 'disk')}">
						{metrics.disk.percent.toFixed(1)}%
					</div>
					<div class="stat-detail">{formatBytes(metrics.disk.used)} / {formatBytes(metrics.disk.total)}</div>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon">🌐</div>
				<div class="stat-content">
					<div class="stat-label">Network</div>
					<div class="stat-value text-blue-400">
						{formatBytes(metrics.network.bytesReceived + metrics.network.bytesSent)}
					</div>
					<div class="stat-detail">
						↓{formatBytes(metrics.network.bytesReceived)} ↑{formatBytes(metrics.network.bytesSent)}
					</div>
				</div>
			</div>
		</div>

		{#if !compact}
			<!-- Charts -->
			<div class="charts-section">
				<h3>System Activity</h3>
				<canvas
					bind:this={chartContainer}
					width="600"
					height="240"
					class="metrics-chart"
				></canvas>
			</div>

			<!-- System Info -->
			<div class="system-info">
				<div class="info-card">
					<h4>System</h4>
					<div class="info-row">
						<span>Uptime:</span>
						<span>{formatUptime(metrics.uptime)}</span>
					</div>
					<div class="info-row">
						<span>Load Average:</span>
						<span>{metrics.loadAverage.map(l => l.toFixed(2)).join(', ')}</span>
					</div>
				</div>

				<div class="info-card">
					<h4>Top Processes</h4>
					<div class="process-list">
						{#each metrics.processes.slice(0, 5) as process (process.pid)}
							<div class="process-row">
								<span class="process-name">{process.name}</span>
								<span class="process-cpu">{process.cpu.toFixed(1)}%</span>
								<span class="process-memory">{formatBytes(process.memory)}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="loading">
			<div class="spinner"></div>
			<p>Loading system metrics...</p>
		</div>
	{/if}
</div>

<style>
	.metrics-dashboard {
		padding: 20px;
		color: var(--fg-primary);
		height: 100%;
		overflow-y: auto;
	}

	.metrics-dashboard.compact {
		padding: 10px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 15px;
		margin-bottom: 30px;
	}

	.metrics-dashboard.compact .stats-grid {
		grid-template-columns: repeat(2, 1fr);
		gap: 10px;
		margin-bottom: 0;
	}

	.stat-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 15px;
		display: flex;
		align-items: center;
		gap: 12px;
		transition: background-color 0.2s;
	}

	.stat-card:hover {
		background: var(--bg-tertiary);
	}

	.stat-icon {
		font-size: 24px;
		width: 40px;
		text-align: center;
	}

	.stat-content {
		flex: 1;
	}

	.stat-label {
		font-size: 12px;
		color: var(--fg-secondary);
		margin-bottom: 4px;
	}

	.stat-value {
		font-size: 18px;
		font-weight: 600;
		font-family: monospace;
	}

	.stat-detail {
		font-size: 11px;
		color: var(--fg-tertiary);
		margin-top: 2px;
	}

	.charts-section {
		margin-bottom: 30px;
	}

	.charts-section h3 {
		margin: 0 0 15px 0;
		font-size: 16px;
		color: var(--fg-primary);
	}

	.metrics-chart {
		width: 100%;
		height: 240px;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
	}

	.system-info {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.info-card {
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 15px;
	}

	.info-card h4 {
		margin: 0 0 12px 0;
		font-size: 14px;
		color: var(--fg-primary);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		margin-bottom: 8px;
		font-size: 12px;
	}

	.info-row span:first-child {
		color: var(--fg-secondary);
	}

	.info-row span:last-child {
		color: var(--fg-primary);
		font-family: monospace;
	}

	.process-list {
		font-size: 11px;
	}

	.process-row {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 8px;
		margin-bottom: 6px;
		padding: 4px 0;
		border-bottom: 1px solid var(--border);
	}

	.process-row:last-child {
		border-bottom: none;
	}

	.process-name {
		color: var(--fg-primary);
		truncate: true;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.process-cpu, .process-memory {
		color: var(--fg-secondary);
		font-family: monospace;
		text-align: right;
	}

	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 200px;
		color: var(--fg-secondary);
	}

	.spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top: 3px solid var(--accent);
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.system-info {
			grid-template-columns: 1fr;
		}
		
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>