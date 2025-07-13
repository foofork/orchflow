/**
 * E2E Test Environment Setup
 * Configures the test environment for E2E tests
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { PortManager } from '../../scripts/port-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global type declarations
declare global {
  var E2E_CONFIG: {
    headless: boolean;
    slowMo: number;
    video: boolean;
    trace: boolean;
    screenshots: boolean;
    defaultTimeout: number;
    baseUrl: string;
  };
  var testHelpers: {
    waitFor(condition: () => boolean | Promise<boolean>, options?: { timeout?: number; interval?: number; message?: string }): Promise<void>;
    createTestId(): string;
    getTestArtifactDir(testName: string): string;
  };
}

// Global test configuration
globalThis.E2E_CONFIG = {
  headless: process.env.CI === 'true',
  slowMo: parseInt(process.env.E2E_SLOWMO || '0'),
  video: process.env.E2E_VIDEO === 'true',
  trace: process.env.E2E_TRACE === 'true',
  screenshots: process.env.E2E_SCREENSHOTS !== 'false',
  defaultTimeout: 30000,
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost'
};

// Port manager instance
let portManager: PortManager;

// Setup before all tests
beforeAll(async () => {
  console.log('🚀 Setting up E2E test environment...');
  
  // Initialize port manager
  portManager = PortManager.getInstance();
  await portManager.init();
  
  // Clean up stale port locks
  await portManager.cleanupStaleLocks();
  
  // Create test result directories
  const dirs = [
    './test-results',
    './test-results/screenshots',
    './test-results/videos',
    './test-results/traces',
    './test-results/state',
    './test-results/reports'
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  // Set up test data directory
  const testDataDir = './test-data';
  await fs.mkdir(testDataDir, { recursive: true });
  
  // Log test configuration
  console.log('📋 E2E Test Configuration:');
  console.log(`  - Headless: ${globalThis.E2E_CONFIG.headless}`);
  console.log(`  - Video Recording: ${globalThis.E2E_CONFIG.video}`);
  console.log(`  - Trace Recording: ${globalThis.E2E_CONFIG.trace}`);
  console.log(`  - Screenshots: ${globalThis.E2E_CONFIG.screenshots}`);
  console.log(`  - Base URL: ${globalThis.E2E_CONFIG.baseUrl}`);
  
  // Set up global error handlers
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection in E2E test:', reason);
  });
  
  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception in E2E test:', error);
  });
});

// Cleanup after all tests
afterAll(async () => {
  console.log('🧹 Cleaning up E2E test environment...');
  
  // Release all allocated ports
  if (portManager) {
    await portManager.releaseAll();
  }
  
  // Generate test summary if in CI
  if (process.env.CI) {
    await generateTestSummary();
  }
  
  console.log('✅ E2E test environment cleanup complete');
});

// Setup before each test
beforeEach(async ({ task }) => {
  // Log test start
  console.log(`\n🧪 Starting test: ${task.name}`);
  
  // Clear any previous test artifacts for this test
  const testName = task.name.replace(/[^a-zA-Z0-9]/g, '-');
  const testArtifactsDir = `./test-results/artifacts/${testName}`;
  
  try {
    await fs.rm(testArtifactsDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }
  
  await fs.mkdir(testArtifactsDir, { recursive: true });
  
  // Store test metadata
  const metadata = {
    name: task.name,
    file: task.file?.name,
    started: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      ci: process.env.CI || false
    }
  };
  
  await fs.writeFile(
    path.join(testArtifactsDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2)
  );
});

// Cleanup after each test
afterEach(async ({ task }) => {
  const duration = Date.now() - (task.result?.startTime || Date.now());
  const status = task.result?.state || 'unknown';
  
  console.log(`\n📊 Test completed: ${task.name}`);
  console.log(`   Status: ${status}`);
  console.log(`   Duration: ${duration}ms`);
  
  // Update test metadata with results
  const testName = task.name.replace(/[^a-zA-Z0-9]/g, '-');
  const testArtifactsDir = `./test-results/artifacts/${testName}`;
  const metadataPath = path.join(testArtifactsDir, 'metadata.json');
  
  try {
    const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
    metadata.completed = new Date().toISOString();
    metadata.duration = duration;
    metadata.status = status;
    
    if (task.result?.errors && Array.isArray(task.result.errors)) {
      metadata.errors = {
        message: task.result.errors[0]?.message || 'Unknown error',
        stack: task.result.errors[0]?.stack || 'No stack trace'
      };
    }
    
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  } catch {
    // Metadata might not exist if test setup failed
  }
});

/**
 * Generate test summary report
 */
async function generateTestSummary() {
  try {
    const resultsPath = './test-results/e2e-results.json';
    const results = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
    
    const summary = {
      totalTests: results.numTotalTests || 0,
      passed: results.numPassedTests || 0,
      failed: results.numFailedTests || 0,
      skipped: results.numPendingTests || 0,
      duration: results.duration || 0,
      timestamp: new Date().toISOString(),
      testSuites: results.testResults?.map((suite: any) => ({
        name: suite.name,
        tests: suite.assertionResults?.length || 0,
        passed: suite.assertionResults?.filter((t: any) => t.status === 'passed').length || 0,
        failed: suite.assertionResults?.filter((t: any) => t.status === 'failed').length || 0,
        duration: suite.duration || 0
      })) || []
    };
    
    await fs.writeFile(
      './test-results/summary.json',
      JSON.stringify(summary, null, 2)
    );
    
    // Print summary to console
    console.log('\n📊 E2E Test Summary:');
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   ✅ Passed: ${summary.passed}`);
    console.log(`   ❌ Failed: ${summary.failed}`);
    console.log(`   ⏭️  Skipped: ${summary.skipped}`);
    console.log(`   ⏱️  Duration: ${(summary.duration / 1000).toFixed(2)}s`);
  } catch (error) {
    console.error('Failed to generate test summary:', error);
  }
}

/**
 * Custom test helpers
 */
export const testHelpers = {
  /**
   * Wait for a condition with timeout
   */
  async waitFor(
    condition: () => boolean | Promise<boolean>,
    options: { timeout?: number; interval?: number; message?: string } = {}
  ): Promise<void> {
    const { timeout = 10000, interval = 100, message = 'Condition not met' } = options;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`${message} (timeout: ${timeout}ms)`);
  },
  
  /**
   * Create a unique test ID
   */
  createTestId(): string {
    return `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  },
  
  /**
   * Get test artifact directory
   */
  getTestArtifactDir(testName: string): string {
    const safeName = testName.replace(/[^a-zA-Z0-9]/g, '-');
    return `./test-results/artifacts/${safeName}`;
  }
};

// Make test helpers globally available
globalThis.testHelpers = testHelpers;

// Export for TypeScript
export {};