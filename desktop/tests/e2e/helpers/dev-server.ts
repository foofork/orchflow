/**
 * Dev Server Manager for E2E Tests
 * Starts and manages Vite dev servers on allocated ports
 */

import { spawn, type ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';

export interface DevServerOptions {
  port: number;
  timeout?: number;
  env?: Record<string, string>;
}

export class DevServerManager {
  private process?: ChildProcess;
  private port: number;
  private timeout: number;
  private isReady = false;
  private readyPromise?: Promise<void>;

  constructor(options: DevServerOptions) {
    this.port = options.port;
    this.timeout = options.timeout || 30000; // 30 second timeout
  }

  async start(): Promise<void> {
    if (this.process) {
      throw new Error('Dev server is already running');
    }

    console.log(`🚀 Starting dev server on port ${this.port}...`);

    // Start the Vite dev server with optimization disabled for parallel E2E testing
    this.process = spawn('npm', ['run', 'dev', '--', '--port', this.port.toString(), '--force'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'development',
        VITE_PORT: this.port.toString(),
        // Disable dependency optimization to prevent conflicts between parallel servers
        VITE_OPTIMIZE_DEPS_DISABLED: 'true',
        // Use unique cache dir for each server to prevent conflicts
        VITE_CACHE_DIR: `node_modules/.vite-e2e-${this.port}`,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Set up promise for server readiness
    this.readyPromise = this.waitForReady();

    // Handle process events
    this.process.on('error', (error) => {
      console.error(`❌ Dev server process error: ${error.message}`);
    });

    this.process.on('exit', (code, signal) => {
      console.log(`🏁 Dev server process exited with code ${code}, signal ${signal}`);
      this.cleanup();
    });

    // Capture output for debugging
    this.process.stdout?.on('data', (data) => {
      const output = data.toString();
      
      // Check for readiness indicators
      if (output.includes('Local:') || 
          output.includes(`localhost:${this.port}`) ||
          output.includes('ready in') ||
          output.includes('Local') && output.includes(this.port.toString())) {
        this.isReady = true;
        console.log(`📡 Dev server ready signal detected on port ${this.port}`);
      }
    });

    this.process.stderr?.on('data', (data) => {
      const output = data.toString();
      console.error(`📡 Dev server stderr: ${output.trim()}`);
    });

    // Wait for server to be ready
    await this.readyPromise;
    console.log(`✅ Dev server ready on port ${this.port}`);
  }

  private async waitForReady(): Promise<void> {
    const startTime = Date.now();
    
    while (!this.isReady && Date.now() - startTime < this.timeout) {
      // Try to connect to the server
      try {
        const response = await fetch(`http://localhost:${this.port}`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(1000),
        });
        
        if (response.ok || response.status === 404) {
          // Server is responding (404 is fine, means server is up)
          this.isReady = true;
          break;
        }
      } catch (error) {
        // Server not ready yet, continue waiting
      }
      
      // Wait a bit before trying again
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!this.isReady) {
      throw new Error(`Dev server failed to start within ${this.timeout}ms`);
    }
  }

  async stop(): Promise<void> {
    if (!this.process) {
      console.log(`🔍 No dev server process to stop on port ${this.port}`);
      return;
    }

    console.log(`🛑 Stopping dev server on port ${this.port}...`);

    try {
      // Try graceful shutdown first
      this.process.kill('SIGTERM');

      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Force kill if still running
      if (this.process && !this.process.killed) {
        console.log(`⚡ Force killing dev server on port ${this.port}`);
        this.process.kill('SIGKILL');
      }
    } catch (error) {
      console.error(`Error during dev server shutdown: ${error}`);
    }

    this.cleanup();
    console.log(`✅ Dev server stopped on port ${this.port}`);
  }

  private cleanup(): void {
    this.process = undefined;
    this.isReady = false;
    this.readyPromise = undefined;
  }

  isRunning(): boolean {
    return this.process !== undefined && !this.process.killed;
  }

  getPort(): number {
    return this.port;
  }

  getBaseUrl(): string {
    return `http://localhost:${this.port}`;
  }
}

// Global registry to track dev servers for cleanup
const activeServers = new Set<DevServerManager>();

export async function createDevServer(options: DevServerOptions): Promise<DevServerManager> {
  const server = new DevServerManager(options);
  activeServers.add(server);
  
  await server.start();
  return server;
}

export async function stopAllDevServers(): Promise<void> {
  console.log(`🧹 Stopping ${activeServers.size} active dev servers...`);
  
  const stopPromises = Array.from(activeServers).map(async (server) => {
    try {
      await server.stop();
    } catch (error) {
      console.error(`Failed to stop dev server: ${error}`);
    } finally {
      activeServers.delete(server);
    }
  });
  
  await Promise.all(stopPromises);
  console.log(`✅ All dev servers stopped`);
}

// Cleanup on process exit
process.on('exit', () => {
  // Synchronous cleanup
  for (const server of activeServers) {
    if (server.isRunning()) {
      try {
        server.stop();
      } catch (error) {
        console.error(`Failed to stop dev server during exit: ${error}`);
      }
    }
  }
});

process.on('SIGINT', async () => {
  await stopAllDevServers();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await stopAllDevServers();
  process.exit(0);
});