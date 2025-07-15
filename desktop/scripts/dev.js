#!/usr/bin/env node
/**
 * Unified development server launcher
 * Handles both web and desktop (Tauri) modes with automatic port management
 */

import { spawn } from 'child_process';
import { readFile, writeFile } from 'fs/promises';
import { PortManager } from './port-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
const args = process.argv.slice(2);
const mode = args.includes('--desktop') ? 'desktop' : 'web';
const type = args.find(arg => ['dev', 'test', 'e2e', 'visual'].includes(arg)) || 'dev';

async function startDevelopment() {
  const manager = new PortManager();
  await manager.init();
  
  try {
    // Get or allocate port
    const port = await manager.findAvailablePort(type);
    console.log(`\n🚀 Starting ${type} server on port ${port}...\n`);
    
    if (mode === 'desktop') {
      // Update Tauri config with current port
      const tauriConfigPath = path.join(__dirname, '../src-tauri/tauri.conf.json');
      const config = JSON.parse(await readFile(tauriConfigPath, 'utf-8'));
      config.build.devUrl = `http://localhost:${port}`;
      await writeFile(tauriConfigPath, JSON.stringify(config, null, 2));
      
      // Start Vite in background
      const vite = spawn('npx', ['vite', 'dev', '--port', port.toString()], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true
      });
      
      // Wait for Vite to be ready
      await new Promise((resolve) => {
        vite.stdout.on('data', (data) => {
          const output = data.toString();
          if (output.includes('ready in') || output.includes('Local:')) {
            console.log('✅ Frontend server ready');
            resolve();
          }
        });
      });
      
      // Start Tauri
      console.log('🖥️  Launching Tauri desktop app...\n');
      const tauri = spawn('npx', ['tauri', 'dev', '--no-watch'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, SQLX_OFFLINE: 'true' }
      });
      
      // Cleanup on exit
      process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        vite.kill();
        tauri.kill();
        process.exit();
      });
      
    } else {
      // Web mode - just start Vite
      const vite = spawn('npx', ['vite', 'dev', '--port', port.toString()], {
        stdio: 'inherit',
        shell: true
      });
      
      process.on('SIGINT', () => {
        vite.kill();
        process.exit();
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Show usage if --help
if (args.includes('--help')) {
  console.log(`
Usage: npm run dev [options]

Options:
  --desktop    Launch Tauri desktop app (default: web only)
  dev|test|e2e|visual    Use specific port range (default: dev)
  --help       Show this help

Examples:
  npm run dev                 # Web server on dev ports (5173-5180)
  npm run dev --desktop       # Desktop app with web server
  npm run dev test           # Web server on test ports (5181-5190)
  npm run dev visual --desktop # Desktop app on visual ports (5201-5210)
  `);
  process.exit(0);
}

startDevelopment().catch(console.error);