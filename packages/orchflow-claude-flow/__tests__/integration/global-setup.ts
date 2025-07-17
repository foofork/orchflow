/**
 * Global setup for integration tests
 * Prepares the test environment before running tests
 */

import { spawn } from 'child_process';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🔧 Setting up integration test environment...');
  
  // Create necessary directories
  const directories = [
    'temp/integration',
    'logs/integration',
    'coverage/integration',
    '.swarm',
    '.orchflow'
  ];
  
  directories.forEach(dir => {
    const fullPath = join(process.cwd(), dir);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }
  });
  
  // Create test configuration files
  const testConfigPath = join(process.cwd(), 'temp/integration/test-config.json');
  const testConfig = {
    server: {
      port: 8080,
      host: 'localhost',
      enableWebSocket: true
    },
    security: {
      enableAuth: false,
      allowedOrigins: ['*']
    },
    ui: {
      showResourceUsage: true,
      maxWorkersDisplay: 10
    },
    terminal: {
      sessionName: 'orchflow-test',
      multiplexer: 'tmux'
    },
    persistence: {
      enabled: true,
      location: join(process.cwd(), 'temp/integration/data')
    }
  };
  
  writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));
  
  // Set environment variables for tests
  process.env.ORCHFLOW_CONFIG_PATH = testConfigPath;
  process.env.ORCHFLOW_DATA_DIR = join(process.cwd(), 'temp/integration/data');
  process.env.ORCHFLOW_LOG_DIR = join(process.cwd(), 'logs/integration');
  process.env.ORCHFLOW_TEST_MODE = 'integration';
  process.env.NODE_ENV = 'test';
  
  // Compile TypeScript files if needed
  console.log('🔨 Compiling TypeScript...');
  await runCommand('npx', ['tsc', '--noEmit']);
  
  // Install any missing dependencies
  console.log('📦 Checking dependencies...');
  await runCommand('npm', ['install']);
  
  console.log('✅ Integration test environment ready!');
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}: ${command} ${args.join(' ')}`));
      }
    });
    
    child.on('error', (error) => {
      reject(error);
    });
  });
}