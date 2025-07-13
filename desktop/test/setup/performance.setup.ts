import { performance } from 'perf_hooks';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global performance test setup
export async function setup() {
  console.log('\n🚀 Setting up performance test environment...\n');
  
  // Create test results directory
  const resultsDir = path.join(process.cwd(), 'test-results');
  await fs.mkdir(resultsDir, { recursive: true });
  
  // Initialize performance monitoring
  performance.mark('test-suite-start');
  
  // Set up global test utilities
  global.performanceTestUtils = {
    startTime: Date.now(),
    testResults: [],
    
    // Helper to assert performance requirements
    assertLatency(actual: number, expected: number, testName: string) {
      if (actual > expected) {
        throw new Error(
          `Performance requirement not met for ${testName}: ` +
          `${actual.toFixed(2)}ms > ${expected}ms`
        );
      }
    },
    
    // Helper to assert throughput requirements
    assertThroughput(actual: number, expected: number, testName: string) {
      if (actual < expected) {
        throw new Error(
          `Throughput requirement not met for ${testName}: ` +
          `${actual.toFixed(2)} ops/sec < ${expected} ops/sec`
        );
      }
    },
    
    // Store test results for reporting
    recordResult(result: any) {
      global.performanceTestUtils.testResults.push({
        ...result,
        timestamp: Date.now()
      });
    }
  };
  
  // Configure Node.js for performance testing
  if (process.env.NODE_ENV !== 'production') {
    // Enable garbage collection exposure for memory tests
    if (!global.gc) {
      console.log('⚠️  Garbage collection not exposed. Run with --expose-gc for memory tests.\n');
    }
    
    // Increase memory limits for stress tests
    const v8 = await import('v8');
    const heapSize = v8.getHeapStatistics().heap_size_limit / 1024 / 1024;
    console.log(`📊 V8 Heap Size Limit: ${heapSize.toFixed(2)} MB\n`);
  }
  
  return () => {
    // Teardown function
    teardown();
  };
}

export async function teardown() {
  console.log('\n📊 Performance test suite completed\n');
  
  performance.mark('test-suite-end');
  performance.measure('test-suite-duration', 'test-suite-start', 'test-suite-end');
  
  const duration = performance.getEntriesByName('test-suite-duration')[0].duration;
  console.log(`⏱️  Total test duration: ${(duration / 1000).toFixed(2)} seconds\n`);
  
  // Generate performance report
  if (global.performanceTestUtils?.testResults.length > 0) {
    await generatePerformanceReport();
  }
}

async function generatePerformanceReport() {
  const results = global.performanceTestUtils.testResults;
  const reportPath = path.join(process.cwd(), 'test-results', 'performance-report.json');
  
  const report = {
    timestamp: new Date().toISOString(),
    duration: Date.now() - global.performanceTestUtils.startTime,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpus: (await import('os')).cpus().length,
      memory: (await import('os')).totalmem() / 1024 / 1024 / 1024 // GB
    },
    summary: {
      totalTests: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      avgLatency: results.reduce((sum, r) => sum + (r.avgLatency || 0), 0) / results.length,
      avgThroughput: results.reduce((sum, r) => sum + (r.throughput || 0), 0) / results.length
    },
    results
  };
  
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Performance report generated: ${reportPath}\n`);
  
  // Print summary
  console.log('📊 Performance Test Summary:');
  console.log('─'.repeat(60));
  console.log(`  Total Tests: ${report.summary.totalTests}`);
  console.log(`  Passed: ${report.summary.passed} | Failed: ${report.summary.failed}`);
  console.log(`  Average Latency: ${report.summary.avgLatency.toFixed(2)}ms`);
  console.log(`  Average Throughput: ${report.summary.avgThroughput.toFixed(2)} ops/sec`);
  console.log('─'.repeat(60));
}

// Declare global types
declare global {
  var performanceTestUtils: {
    startTime: number;
    testResults: any[];
    assertLatency(actual: number, expected: number, testName: string): void;
    assertThroughput(actual: number, expected: number, testName: string): void;
    recordResult(result: any): void;
  };
}