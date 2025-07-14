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

export interface DiskInfo {
	name: string;
	mountPoint: string;
	fileSystem: string;
	total: number;
	used: number;
	free: number;
	percent: number;
}

export interface DiskMetrics {
	disks: DiskInfo[];
	totalSpace: number;
	totalUsed: number;
	totalFree: number;
	averageUsagePercent: number;
}

export interface NetworkInterface {
	name: string;
	bytesReceived: number;
	bytesSent: number;
	packetsReceived: number;
	packetsSent: number;
	speed?: number; // bits per second
	isUp: boolean;
	interfaceType: string;
}

export interface NetworkMetrics {
	interfaces: NetworkInterface[];
	totalBytesReceived: number;
	totalBytesSent: number;
	totalPacketsReceived: number;
	totalPacketsSent: number;
	downloadSpeed: number; // bytes per second
	uploadSpeed: number;   // bytes per second
}

export interface ProcessMetrics {
	pid: number;
	name: string;
	cpu: number;
	memory: number;
	virtualMemory: number;
	status: string;
	cmd: string[];
	startTime: number;
	diskUsage?: [number, number]; // [read_bytes, written_bytes]
}

export interface GpuMetrics {
	name: string;
	utilization?: number;
	memoryUsed?: number;
	memoryTotal?: number;
	temperature?: number;
	powerUsage?: number;
}

export interface BatteryMetrics {
	percentage: number;
	isCharging: boolean;
	timeRemaining?: number; // seconds
	health?: number;
	cycleCount?: number;
	powerConsumption?: number; // watts
}

export interface ThermalMetrics {
	cpuTemperature?: number;
	gpuTemperature?: number;
	systemTemperature?: number;
	fanSpeeds: [string, number][]; // [fan_name, rpm]
}

export interface SystemMetrics {
	timestamp: number;
	cpu: CPUMetrics;
	memory: MemoryMetrics;
	disk: DiskMetrics;
	network: NetworkMetrics;
	processes: ProcessMetrics[];
	gpu: GpuMetrics[];
	battery?: BatteryMetrics;
	thermal: ThermalMetrics;
	uptime: number;
	loadAverage: [number, number, number];
	hostname: string;
	osVersion: string;
	kernelVersion: string;
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
			const { invoke } = await import('@tauri-apps/api/core');
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
			disks: [
				{
					name: '/dev/disk1s1',
					mountPoint: '/',
					fileSystem: 'apfs',
					total: 512 * 1024 * 1024 * 1024, // 512GB
					used: 256 * 1024 * 1024 * 1024,
					free: 256 * 1024 * 1024 * 1024,
					percent: 50
				}
			],
			totalSpace: 512 * 1024 * 1024 * 1024,
			totalUsed: 256 * 1024 * 1024 * 1024,
			totalFree: 256 * 1024 * 1024 * 1024,
			averageUsagePercent: 50
		},
		network: {
			interfaces: [
				{
					name: 'eth0',
					bytesReceived: Math.floor(Math.random() * 1000000),
					bytesSent: Math.floor(Math.random() * 500000),
					packetsReceived: Math.floor(Math.random() * 1000),
					packetsSent: Math.floor(Math.random() * 500),
					speed: 1000000000, // 1 Gbps
					isUp: true,
					interfaceType: 'ethernet'
				}
			],
			totalBytesReceived: Math.floor(Math.random() * 1000000),
			totalBytesSent: Math.floor(Math.random() * 500000),
			totalPacketsReceived: Math.floor(Math.random() * 1000),
			totalPacketsSent: Math.floor(Math.random() * 500),
			downloadSpeed: Math.random() * 10000, // bytes/sec
			uploadSpeed: Math.random() * 5000    // bytes/sec
		},
		processes: [
			{
				pid: 1234,
				name: 'orchflow',
				cpu: Math.random() * 10,
				memory: Math.random() * 500 * 1024 * 1024,
				virtualMemory: Math.random() * 800 * 1024 * 1024,
				status: 'running',
				cmd: ['./orchflow', '--serve'],
				startTime: Date.now() - 3600000,
				diskUsage: [Math.random() * 1000000, Math.random() * 500000]
			},
			{
				pid: 5678,
				name: 'node',
				cpu: Math.random() * 5,
				memory: Math.random() * 200 * 1024 * 1024,
				virtualMemory: Math.random() * 400 * 1024 * 1024,
				status: 'running',
				cmd: ['node', 'server.js'],
				startTime: Date.now() - 1800000,
				diskUsage: [Math.random() * 500000, Math.random() * 200000]
			},
			{
				pid: 9012,
				name: 'neovim',
				cpu: Math.random() * 3,
				memory: Math.random() * 150 * 1024 * 1024,
				virtualMemory: Math.random() * 300 * 1024 * 1024,
				status: 'running',
				cmd: ['nvim', 'file.ts'],
				startTime: Date.now() - 900000,
				diskUsage: [Math.random() * 100000, Math.random() * 50000]
			}
		],
		gpu: [
			{
				name: 'Mock GPU',
				utilization: Math.random() * 100,
				memoryUsed: Math.random() * 8 * 1024 * 1024 * 1024,
				memoryTotal: 8 * 1024 * 1024 * 1024,
				temperature: 60 + Math.random() * 20,
				powerUsage: 150 + Math.random() * 100
			}
		],
		battery: {
			percentage: 75 + Math.random() * 20,
			isCharging: Math.random() > 0.5,
			timeRemaining: 3600 + Math.random() * 7200,
			health: 85 + Math.random() * 10,
			cycleCount: 500 + Math.floor(Math.random() * 1000),
			powerConsumption: 10 + Math.random() * 20
		},
		thermal: {
			cpuTemperature: 45 + Math.random() * 25,
			gpuTemperature: 50 + Math.random() * 30,
			systemTemperature: 40 + Math.random() * 20,
			fanSpeeds: [['CPU Fan', 1500 + Math.floor(Math.random() * 1000)], ['System Fan', 1200 + Math.floor(Math.random() * 800)]]
		},
		uptime: Math.floor((now - 1000000000) / 1000),
		loadAverage: [
			1.5 + Math.random() * 0.5,
			1.3 + Math.random() * 0.5,
			1.1 + Math.random() * 0.5
		],
		hostname: 'dev-machine',
		osVersion: 'macOS 14.0',
		kernelVersion: '23.0.0'
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

export function formatSpeed(bytesPerSecond: number): string {
	const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
	let value = bytesPerSecond;
	let unitIndex = 0;
	
	while (value >= 1024 && unitIndex < units.length - 1) {
		value /= 1024;
		unitIndex++;
	}
	
	return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function formatTemperature(celsius?: number): string {
	if (celsius === undefined) return 'N/A';
	return `${celsius.toFixed(1)}°C`;
}

export function formatPercentage(value?: number): string {
	if (value === undefined) return 'N/A';
	return `${value.toFixed(1)}%`;
}

export function formatPower(watts?: number): string {
	if (watts === undefined) return 'N/A';
	return `${watts.toFixed(1)}W`;
}

export function formatTime(milliseconds: number): string {
	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	
	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	} else if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	} else {
		return `${seconds}s`;
	}
}

export function getNetworkTotalBandwidth(metrics: SystemMetrics): number {
	return metrics.network.interfaces.reduce((total, iface) => {
		return total + (iface.speed || 0);
	}, 0);
}

export function getDiskTotalUsagePercent(metrics: SystemMetrics): number {
	return metrics.disk.averageUsagePercent;
}

export function getTopProcessesByMetric(metrics: SystemMetrics, metric: 'cpu' | 'memory', limit: number = 5): ProcessMetrics[] {
	return [...metrics.processes]
		.sort((a, b) => b[metric] - a[metric])
		.slice(0, limit);
}

// Auto-start in browser
if (browser) {
	startMetricsPolling();
}