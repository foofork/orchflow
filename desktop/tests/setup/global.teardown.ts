import { type FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function globalTeardown(_config: FullConfig) {
  console.log('🧹 Starting Playwright global teardown...');
  
  try {
    // Close global browser if it exists
    await closeGlobalBrowser();
    
    // Clean up development servers
    await cleanupDevServers();
    
    // Clean up test artifacts
    await cleanupTestArtifacts();
    
    // Final cleanup
    await finalCleanup();
    
    console.log('✅ Playwright global teardown completed');
  } catch (error) {
    console.error('❌ Playwright global teardown failed:', error);
    // Don't throw to avoid masking test failures
  }
}

async function closeGlobalBrowser() {
  try {
    const browser = (global as any).__BROWSER__;
    if (browser) {
      console.log('🌐 Closing global browser instance...');
      await browser.close();
      delete (global as any).__BROWSER__;
      console.log('✅ Global browser closed');
    }
  } catch (error) {
    console.warn('⚠️ Failed to close global browser:', (error as Error).message);
  }
}

async function cleanupDevServers() {
  console.log('🛑 Stopping development servers...');
  
  const serverKillCommands = [
    'pkill -f "vite.*dev" || true',
    'pkill -f "npm.*dev" || true',
    'pkill -f "PORT.*npm.*dev" || true',
    'pkill -f "node.*vite" || true'
  ];
  
  for (const cmd of serverKillCommands) {
    try {
      await execAsync(cmd);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      // Ignore errors - processes might not exist
    }
  }
  
  console.log('✅ Development servers stopped');
}

async function cleanupTestArtifacts() {
  console.log('🗑️ Cleaning up test artifacts...');
  
  const cleanupCommands = [
    // Clean up temporary files
    'find /tmp -name "*vite*" -delete 2>/dev/null || true',
    'find /tmp -name "*playwright*" -delete 2>/dev/null || true',
    'rm -f /tmp/.vite-* 2>/dev/null || true',
    
    // Clean up socket files
    'find /tmp -name "*.sock" -delete 2>/dev/null || true',
    
    // Clean up lock files
    'rm -f /tmp/*.lock 2>/dev/null || true',
    
    // Clean up test reports (optional - comment out if you want to keep them)
    // 'rm -rf test-results/temp-* 2>/dev/null || true'
  ];
  
  for (const cmd of cleanupCommands) {
    try {
      await execAsync(cmd);
    } catch (error) {
      // Ignore errors
    }
  }
  
  console.log('✅ Test artifacts cleaned up');
}

async function finalCleanup() {
  console.log('🔧 Performing final cleanup...');
  
  try {
    // Force kill any remaining processes on common ports
    const ports = [5173, 5174, 5175, 5176, 5177];
    
    for (const port of ports) {
      try {
        await execAsync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`);
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Wait for final cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ Final cleanup completed');
  } catch (error) {
    console.warn('⚠️ Final cleanup warning:', (error as Error).message);
  }
}

export default globalTeardown;