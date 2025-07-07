import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';

export interface CPUMetrics {
	usage: number;
	frequency: number;
	temperature?: number;
	cores: number;
}

export interface MemoryMetrics {
	total: number;
	used: number;
	free: number;
	available: number;
	percent: number;
}

export interface DiskMetrics {
	total: number;
	used: number;
	free: number;
	percent: number;
}

export interface NetworkMetrics {
	bytesReceived: number;
	bytesSent: number;
	packetsReceived: number;
	packetsSent: number;
}

export interface ProcessMetrics {
	pid: number;
	name: string;
	cpu: number;
	memory: number;
	status: string;
}

export interface SystemMetrics {
	timestamp: number;
	cpu: CPUMetrics;
	memory: MemoryMetrics;
	disk: DiskMetrics;
	network: NetworkMetrics;
	processes: ProcessMetrics[];
	uptime: number;
	loadAverage: [number, number, number];
}

// Stores
export const currentMetrics = writable<SystemMetrics | null>(null);
export const metricsHistory = writable<SystemMetrics[]>([]);
export const metricsError = writable<string | null>(null);
export const isPolling = writable(false);

// Configuration
const MAX_HISTORY = 60; // Keep 2 minutes of history at 2s intervals
let pollingInterval: number | null = null;
let ws: WebSocket | null = null;

// Start polling for metrics
export function startMetricsPolling() {
	if (get(isPolling)) return;
	
	isPolling.set(true);
	metricsError.set(null);
	
	// Initial fetch
	fetchMetrics();
	
	// Set up polling interval (2 seconds)
	pollingInterval = window.setInterval(() => {
		fetchMetrics();
	}, 2000);
	
	// Set up WebSocket for real-time updates if available
	if (browser) {
		connectWebSocket();
	}
}

// Stop polling
export function stopMetricsPolling() {
	isPolling.set(false);
	
	if (pollingInterval) {
		clearInterval(pollingInterval);
		pollingInterval = null;
	}
	
	if (ws) {
		ws.close();
		ws = null;
	}
}

// Fetch metrics from API
async function fetchMetrics() {
	try {
		// Check if running in Tauri
		if ('__TAURI__' in window) {
			const { invoke } = await import('@tauri-apps/api/tauri');
			const metrics = await invoke<SystemMetrics>('get_system_metrics');
			updateMetrics(metrics);
		} else {
			// Fallback to REST API
			const response = await fetch('/api/metrics');
			if (!response.ok) throw new Error('Failed to fetch metrics');
			const metrics = await response.json();
			updateMetrics(metrics);
		}
	} catch (error) {
		console.error('Failed to fetch metrics:', error);
		metricsError.set(error instanceof Error ? error.message : 'Unknown error');
		
		// Generate mock data in development
		if (import.meta.env.DEV) {
			updateMetrics(generateMockMetrics());
		}
	}
}

// Connect to WebSocket for real-time updates
function connectWebSocket() {
	try {
		ws = new WebSocket('ws://localhost:8081/metrics');
		
		ws.onopen = () => {
			console.log('Connected to metrics WebSocket');
			metricsError.set(null);
		};
		
		ws.onmessage = (event) => {
			try {
				const metrics = JSON.parse(event.data);
				updateMetrics(metrics);
			} catch (error) {
				console.error('Failed to parse WebSocket message:', error);
			}
		};
		
		ws.onerror = (error) => {
			console.error('WebSocket error:', error);
			metricsError.set('WebSocket connection failed');
		};
		
		ws.onclose = () => {
			console.log('WebSocket connection closed');
			ws = null;
			
			// Attempt to reconnect after 5 seconds if still polling
			if (get(isPolling)) {
				setTimeout(connectWebSocket, 5000);
			}
		};
	} catch (error) {
		console.error('Failed to connect WebSocket:', error);
	}
}

// Update metrics and maintain history
function updateMetrics(metrics: SystemMetrics) {
	currentMetrics.set(metrics);
	
	metricsHistory.update(history => {
		const newHistory = [...history, metrics];
		// Keep only the last MAX_HISTORY entries
		if (newHistory.length > MAX_HISTORY) {
			return newHistory.slice(-MAX_HISTORY);
		}
		return newHistory;
	});
}

// Generate mock metrics for development
function generateMockMetrics(): SystemMetrics {
	const now = Date.now();
	const baseMemory = 16 * 1024 * 1024 * 1024; // 16GB
	const usedMemory = baseMemory * (0.4 + Math.random() * 0.3);
	
	return {
		timestamp: now,
		cpu: {
			usage: Math.random() * 100,
			frequency: 2400 + Math.random() * 600,
			temperature: 50 + Math.random() * 30,
			cores: 8
		},
		memory: {
			total: baseMemory,
			used: usedMemory,
			free: baseMemory - usedMemory,
			available: baseMemory - usedMemory,
			percent: (usedMemory / baseMemory) * 100
		},
		disk: {
			total: 512 * 1024 * 1024 * 1024, // 512GB
			used: 256 * 1024 * 1024 * 1024,
			free: 256 * 1024 * 1024 * 1024,
			percent: 50
		},
		network: {
			bytesReceived: Math.floor(Math.random() * 1000000),
			bytesSent: Math.floor(Math.random() * 500000),
			packetsReceived: Math.floor(Math.random() * 1000),
			packetsSent: Math.floor(Math.random() * 500)
		},
		processes: [
			{
				pid: 1234,
				name: 'orchflow',
				cpu: Math.random() * 10,
				memory: Math.random() * 500,
				status: 'running'
			},
			{
				pid: 5678,
				name: 'node',
				cpu: Math.random() * 5,
				memory: Math.random() * 200,
				status: 'running'
			},
			{
				pid: 9012,
				name: 'neovim',
				cpu: Math.random() * 3,
				memory: Math.random() * 150,
				status: 'running'
			}
		],
		uptime: Math.floor((now - 1000000000) / 1000),
		loadAverage: [
			1.5 + Math.random() * 0.5,
			1.3 + Math.random() * 0.5,
			1.1 + Math.random() * 0.5
		]
	};
}

// Utility functions
export function formatBytes(bytes: number): string {
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = bytes;
	let unitIndex = 0;
	
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	
	return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatUptime(seconds: number): string {
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor((seconds % 86400) / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	
	if (days > 0) {
		return `${days}d ${hours}h ${minutes}m`;
	} else if (hours > 0) {
		return `${hours}h ${minutes}m`;
	} else {
		return `${minutes}m`;
	}
}

// Auto-start in browser
if (browser) {
	startMetricsPolling();
}