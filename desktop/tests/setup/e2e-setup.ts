import { exec } from 'child_process';
import { promisify } from 'util';
import { PortManager } from '../../scripts/port-manager.js';

const execAsync = promisify(exec);

/**
 * E2E Test Setup
 * 
 * Handles application server startup and teardown for E2E tests
 */

let devServerProcess: any = null;
let portManager: PortManager;
let testPort: number;

export async function setupE2EEnvironment() {
  console.log('🚀 Setting up E2E test environment...');
  
  // Initialize port manager
  portManager = new PortManager();
  await portManager.init();
  
  // Get a dedicated port for E2E tests
  testPort = await portManager.findAvailablePort('e2e');
  console.log(`📡 Using port ${testPort} for E2E tests`);
  
  // Set environment variables
  process.env.PORT = testPort.toString();
  process.env.NODE_ENV = 'test';
  process.env.PLAYWRIGHT_PORT = testPort.toString();
  process.env.PLAYWRIGHT_BASE_URL = `http://localhost:${testPort}`;
  
  // Start the development server
  try {
    console.log('🔧 Starting development server...');
    
    const { spawn } = await import('child_process');
    devServerProcess = spawn('npm', ['run', 'dev:e2e'], {
      env: {
        ...process.env,
        PORT: testPort.toString()
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Handle server output
    devServerProcess.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      if (output.includes('Local:') || output.includes('ready')) {
        console.log('✅ Development server ready');
      }
    });
    
    devServerProcess.stderr.on('data', (data: Buffer) => {
      const error = data.toString();
      if (!error.includes('EADDRINUSE') && !error.includes('Warning')) {
        console.error('❌ Server error:', error);
      }
    });
    
    // Wait for server to start
    await waitForServer(testPort);
    console.log(`✅ E2E server running on port ${testPort}`);
    
  } catch (error) {
    console.error('❌ Failed to start development server:', error);
    throw error;
  }
}

export async function teardownE2EEnvironment() {
  console.log('🧹 Tearing down E2E test environment...');
  
  // Kill the development server
  if (devServerProcess) {
    try {
      devServerProcess.kill('SIGTERM');
      
      // Wait a bit for graceful shutdown
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Force kill if still running
      if (!devServerProcess.killed) {
        devServerProcess.kill('SIGKILL');
      }
      
      console.log('✅ Development server stopped');
    } catch (error) {
      console.warn('⚠️ Error stopping server:', error);
    }
  }
  
  // Release the port
  if (portManager && testPort) {
    await portManager.releasePort(testPort);
    console.log(`✅ Released port ${testPort}`);
  }
  
  // Clean up any remaining processes
  try {
    await execAsync(`pkill -f "vite.*dev.*port.*${testPort}" || true`);
    await execAsync(`lsof -ti:${testPort} | xargs kill -9 || true`);
  } catch (error) {
    // Ignore errors - processes might not exist
  }
  
  console.log('✅ E2E environment cleanup complete');
}

async function waitForServer(port: number, maxAttempts = 30): Promise<void> {
  const net = await import('net');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = new net.Socket();
        
        socket.setTimeout(1000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve();
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('Timeout'));
        });
        
        socket.on('error', () => {
          socket.destroy();
          reject(new Error('Connection failed'));
        });
        
        socket.connect(port, 'localhost');
      });
      
      // Server is ready
      return;
      
    } catch (error) {
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw new Error(`Server on port ${port} did not start within ${maxAttempts} seconds`);
}

// Global setup and teardown hooks
beforeAll(async () => {
  await setupE2EEnvironment();
}, 60000); // 60 second timeout for setup

afterAll(async () => {
  await teardownE2EEnvironment();
}, 30000); // 30 second timeout for teardown

// Cleanup on process exit
process.on('exit', () => {
  if (devServerProcess && !devServerProcess.killed) {
    devServerProcess.kill('SIGKILL');
  }
});

process.on('SIGINT', async () => {
  await teardownE2EEnvironment();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await teardownE2EEnvironment();
  process.exit(0);
});