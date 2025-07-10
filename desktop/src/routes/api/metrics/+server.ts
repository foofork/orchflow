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
				memory: Math.random() * 500 * 1024 * 1024, // MB to bytes
				status: 'running'
			},
			{
				pid: 5678,
				name: 'node',
				cpu: Math.random() * 5,
				memory: Math.random() * 200 * 1024 * 1024,
				status: 'running'
			},
			{
				pid: 9012,
				name: 'neovim',
				cpu: Math.random() * 3,
				memory: Math.random() * 150 * 1024 * 1024,
				status: 'running'
			},
			{
				pid: 3456,
				name: 'tmux',
				cpu: Math.random() * 1,
				memory: Math.random() * 50 * 1024 * 1024,
				status: 'running'
			},
			{
				pid: 7890,
				name: 'git',
				cpu: Math.random() * 2,
				memory: Math.random() * 100 * 1024 * 1024,
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
	
	return new Response(JSON.stringify(metrics), {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};