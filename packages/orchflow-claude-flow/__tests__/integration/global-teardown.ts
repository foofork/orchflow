/**
 * Global teardown for integration tests
 * Cleans up the test environment after running tests
 */

import { rmSync, existsSync } from 'fs';
import { join } from 'path';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up integration test environment...');
  
  // Clean up temporary directories
  const tempDirs = [
    'temp/integration',
    'logs/integration'
  ];
  
  tempDirs.forEach(dir => {
    const fullPath = join(process.cwd(), dir);
    if (existsSync(fullPath)) {
      try {
        rmSync(fullPath, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to clean up ${fullPath}:`, error);
      }
    }
  });
  
  // Clean up test configuration
  const testConfigPath = join(process.cwd(), 'temp/integration/test-config.json');
  if (existsSync(testConfigPath)) {
    try {
      rmSync(testConfigPath, { force: true });
    } catch (error) {
      console.warn(`Failed to clean up test config:`, error);
    }
  }
  
  // Clean up any hanging processes
  process.removeAllListeners('unhandledRejection');
  process.removeAllListeners('uncaughtException');
  
  console.log('✅ Integration test environment cleaned up!');
}