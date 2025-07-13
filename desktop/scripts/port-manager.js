#!/usr/bin/env node
import net from 'net';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port range configuration
const PORT_RANGES = {
  dev: { start: 5173, end: 5180 },
  test: { start: 5181, end: 5190 },
  e2e: { start: 5191, end: 5200 },
  visual: { start: 5201, end: 5210 }
};

// Lock file for port allocation tracking
const LOCK_FILE = path.join(__dirname, '../.port-locks.json');

class PortManager {
  static instance = null;
  
  constructor() {
    this.locks = {};
  }
  
  static getInstance() {
    if (!PortManager.instance) {
      PortManager.instance = new PortManager();
    }
    return PortManager.instance;
  }

  async init() {
    try {
      const data = await fs.readFile(LOCK_FILE, 'utf-8');
      this.locks = JSON.parse(data);
      // Clean up stale locks (older than 1 hour)
      await this.cleanStaleLocks();
    } catch {
      this.locks = {};
    }
  }

  async cleanStaleLocks() {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    Object.keys(this.locks).forEach(port => {
      if (now - this.locks[port].timestamp > oneHour) {
        delete this.locks[port];
      }
    });
    
    await this.saveLocks();
  }
  
  // Alias for test compatibility
  async cleanupStaleLocks() {
    return this.cleanStaleLocks();
  }

  async saveLocks() {
    await fs.writeFile(LOCK_FILE, JSON.stringify(this.locks, null, 2));
  }

  async isPortAvailable(port) {
    // Check if port is locked by another process
    if (this.locks[port] && Date.now() - this.locks[port].timestamp < 60 * 60 * 1000) {
      return false;
    }

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
  }

  async findAvailablePort(type = 'dev') {
    const range = PORT_RANGES[type];
    if (!range) {
      throw new Error(`Unknown port type: ${type}`);
    }

    for (let port = range.start; port <= range.end; port++) {
      if (await this.isPortAvailable(port)) {
        // Lock the port
        this.locks[port] = {
          type,
          pid: process.pid,
          timestamp: Date.now()
        };
        await this.saveLocks();
        return port;
      }
    }
    
    throw new Error(`No available ports found in ${type} range (${range.start}-${range.end})`);
  }
  
  // Alias for test compatibility
  async allocatePort(type = 'e2e') {
    return this.findAvailablePort(type);
  }

  async releasePort(port) {
    delete this.locks[port];
    await this.saveLocks();
  }

  async releaseAllForPid(pid) {
    Object.keys(this.locks).forEach(port => {
      if (this.locks[port].pid === pid) {
        delete this.locks[port];
      }
    });
    await this.saveLocks();
  }
  
  // Alias for test compatibility
  async releaseAll() {
    return this.releaseAllForPid(process.pid);
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const type = process.argv[2] || 'dev';
  const manager = new PortManager();
  
  // Clean up on exit
  process.on('exit', async () => {
    await manager.releaseAllForPid(process.pid);
  });
  
  process.on('SIGINT', async () => {
    await manager.releaseAllForPid(process.pid);
    process.exit(0);
  });
  
  try {
    await manager.init();
    const port = await manager.findAvailablePort(type);
    console.log(port);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

export { PortManager, PORT_RANGES };