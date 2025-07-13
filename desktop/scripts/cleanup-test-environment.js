#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function cleanupTestEnvironment() {
  console.warn('🧹 Cleaning up test environment...\n');
  
  try {
    // Kill development servers
    console.warn('🛑 Stopping development servers...');
    const serverKillCommands = [
      'pkill -f "vite.*dev" || true',
      'pkill -f "npm.*dev" || true',
      'pkill -f "PORT.*npm.*dev" || true',
      'pkill -f "node.*vite" || true',
      'pkill -f "playwright" || true'
    ];
    
    for (const cmd of serverKillCommands) {
      try {
        const { stdout } = await execAsync(cmd);
        if (stdout) console.warn(`  ${stdout.trim()}`);
      } catch {
        // Ignore errors - processes might not exist
      }
    }
    console.warn('✅ Development servers stopped\n');
    
    // Clean up temporary files
    console.warn('🗑️ Cleaning up temporary files...');
    const cleanupCommands = [
      'find /tmp -name "*vite*" -delete 2>/dev/null || true',
      'find /tmp -name "*playwright*" -delete 2>/dev/null || true',
      'rm -f /tmp/.vite-* 2>/dev/null || true',
      'find /tmp -name "*.sock" -delete 2>/dev/null || true',
      'rm -f /tmp/*.lock 2>/dev/null || true'
    ];
    
    for (const cmd of cleanupCommands) {
      try {
        await execAsync(cmd);
      } catch {
        // Ignore errors
      }
    }
    console.warn('✅ Temporary files cleaned up\n');
    
    // Kill processes on common ports
    console.warn('🔌 Freeing up ports...');
    const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];
    
    for (const port of ports) {
      try {
        const { stdout } = await execAsync(`lsof -ti:${port} 2>/dev/null || true`);
        if (stdout.trim()) {
          await execAsync(`kill -9 ${stdout.trim()} 2>/dev/null || true`);
          console.warn(`  Port ${port}: freed`);
        }
      } catch {
        // Ignore errors
      }
    }
    console.warn('✅ Ports cleaned up\n');
    
    // Check final status
    console.warn('📊 Final status check...');
    for (const port of [5173, 5174, 5175]) {
      try {
        const { stdout } = await execAsync(`netstat -tlnp 2>/dev/null | grep :${port} || echo "Port ${port}: Available"`);
        console.warn(`  ${stdout.trim() || `Port ${port}: Available`}`);
      } catch {
        console.warn(`  Port ${port}: Available`);
      }
    }
    
    console.warn('\n✅ Test environment cleanup completed!');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error.message);
    process.exit(1);
  }
}

// Run cleanup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupTestEnvironment().catch(console.error);
}

export { cleanupTestEnvironment };