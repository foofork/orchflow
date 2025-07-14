import type { RequestHandler } from './$types';

// Mock metrics for non-Tauri environments
export const GET: RequestHandler = async () => {
	const now = Date.now();
	const baseMemory = 16 * 1024 * 1024 * 1024; // 16GB
	const usedMemory = baseMemory * (0.4 + Math.random() * 0.3);
	
	const metrics = {
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
				memory: Math.random() * 500 * 1024 * 1024, // MB to bytes
				virtualMemory: Math.random() * 800 * 1024 * 1024,
				status: 'running',
				cmd: ['./orchflow', '--serve'],
				startTime: now - 3600000,
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
				startTime: now - 1800000,
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
				startTime: now - 900000,
				diskUsage: [Math.random() * 100000, Math.random() * 50000]
			},
			{
				pid: 3456,
				name: 'tmux',
				cpu: Math.random() * 1,
				memory: Math.random() * 50 * 1024 * 1024,
				virtualMemory: Math.random() * 100 * 1024 * 1024,
				status: 'running',
				cmd: ['tmux'],
				startTime: now - 7200000,
				diskUsage: [Math.random() * 50000, Math.random() * 25000]
			},
			{
				pid: 7890,
				name: 'git',
				cpu: Math.random() * 2,
				memory: Math.random() * 100 * 1024 * 1024,
				virtualMemory: Math.random() * 200 * 1024 * 1024,
				status: 'running',
				cmd: ['git', 'status'],
				startTime: now - 300000,
				diskUsage: [Math.random() * 25000, Math.random() * 10000]
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
		osVersion: 'Linux 6.8.0',
		kernelVersion: '6.8.0-1027-azure'
	};
	
	return new Response(JSON.stringify(metrics), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};