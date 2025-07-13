#!/usr/bin/env node

import net from 'net';

async function testPortAllocation() {
  console.warn('🔍 Testing port allocation logic...\n');
  
  const isPortAvailable = (port) => {
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
  
  const findAvailablePort = async (startPort = 5173) => {
    const maxPort = 5180;
    
    for (let port = startPort; port <= maxPort; port++) {
      if (await isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found between ${startPort} and ${maxPort}`);
  };
  
  // Test port availability
  console.warn('📊 Port availability check:');
  const portsToCheck = [5173, 5174, 5175, 5176, 5177];
  
  for (const port of portsToCheck) {
    const available = await isPortAvailable(port);
    console.warn(`  Port ${port}: ${available ? '✅ Available' : '❌ In use'}`);
  }
  
  console.warn();
  
  // Find next available port
  try {
    const availablePort = await findAvailablePort();
    console.warn(`🎯 Next available port: ${availablePort}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
  
  console.warn('\n✅ Port allocation test completed!');
}

testPortAllocation().catch(console.error);