import { chromium, type FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function findAvailablePort(startPort: number = 5174): Promise<number> {
  const net = await import('net');
  const maxPort = 5200;
  
  const isPortFree = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  };
  
  for (let port = startPort; port <= maxPort; port++) {
    if (await isPortFree(port)) {
      return port;
    }
  }
  throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
}

async function globalSetup(_config: FullConfig) {
  console.log('🚀 Starting Playwright global setup...');
  
  try {
    // Clean up any leftover processes and files
    await cleanup();
    
    // Find and set available port
    const availablePort = await findAvailablePort();
    process.env.PLAYWRIGHT_PORT = availablePort.toString();
    console.log(`🎯 Selected port: ${availablePort}`);
    
    // Ensure proper port allocation
    await ensurePortAvailability();
    
    // Setup browser for reuse if needed
    if (process.env.REUSE_BROWSER === 'true') {
      await setupGlobalBrowser();
    }
    
    console.log('✅ Playwright global setup completed');
  } catch (error) {
    console.error('❌ Playwright global setup failed:', error);
    throw error;
  }
}

async function cleanup() {
  console.log('🧹 Cleaning up leftover processes and files...');
  
  try {
    // Kill any leftover development servers
    const killCommands = [
      'pkill -f "vite.*dev" || true',
      'pkill -f "npm.*dev" || true',
      'pkill -f "node.*5173" || true',
      'pkill -f "node.*5174" || true',
      'pkill -f "node.*5175" || true'
    ];
    
    for (const cmd of killCommands) {
      try {
        await execAsync(cmd);
      } catch (error) {
        // Ignore errors - processes might not exist
      }
    }
    
    // Clean up socket files and temp files
    const cleanupCommands = [
      'find /tmp -name "*vite*" -delete 2>/dev/null || true',
      'find /tmp -name "*playwright*" -delete 2>/dev/null || true',
      'rm -f /tmp/.vite-* 2>/dev/null || true'
    ];
    
    for (const cmd of cleanupCommands) {
      try {
        await execAsync(cmd);
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log('✅ Cleanup completed');
  } catch (error) {
    console.warn('⚠️ Cleanup warning:', (error as Error).message);
  }
}

async function ensurePortAvailability() {
  console.log('🔍 Checking port availability...');
  
  const net = await import('net');
  
  const isPortFree = (port: number): Promise<boolean> => {
    return new Promise((resolve) => {
      const server = net.createServer();
      
      server.once('error', () => {
        resolve(false);
      });
      
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      
      server.listen(port);
    });
  };
  
  // Check common ports
  const portsToCheck = [5173, 5174, 5175, 5176, 5177];
  
  for (const port of portsToCheck) {
    const isFree = await isPortFree(port);
    console.log(`Port ${port}: ${isFree ? '✅ Available' : '❌ In use'}`);
  }
}

async function setupGlobalBrowser() {
  console.log('🌐 Setting up global browser instance...');
  
  try {
    const browser = await chromium.launch({
      headless: process.env.CI === 'true',
    });
    
    // Store browser for potential reuse
    (global as any).__BROWSER__ = browser;
    
    console.log('✅ Global browser setup completed');
  } catch (error) {
    console.error('❌ Failed to setup global browser:', error);
    throw error;
  }
}

export default globalSetup;