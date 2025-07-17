#!/usr/bin/env node
/**
 * Quick Performance Test
 * Simple test runner for performance optimization
 */

import { SetupOptimizer } from './setup-optimizer';
import { PerformanceMonitor, PerformanceBenchmark } from './performance-monitor';

async function runQuickTest() {
  console.log('🚀 Starting OrchFlow Performance Test...');
  console.log('='  .repeat(50));
  
  try {
    // Test 1: Setup Optimizer
    console.log('\n📊 Testing Setup Optimizer...');
    const optimizer = new SetupOptimizer();
    
    await optimizer.optimizeSetup();
    console.log('✅ Setup optimization completed');
    
    const results = await optimizer.runBenchmark();
    console.log('\n📈 Performance Results:');
    console.log(`  Setup Detection: ${results.setupDetection.toFixed(2)}ms (target: <200ms)`);
    console.log(`  Config Loading: ${results.configLoading.toFixed(2)}ms (target: <50ms)`);
    console.log(`  User Interaction: ${results.userInteraction.toFixed(2)}ms (target: <100ms)`);
    console.log(`  Memory Footprint: ${results.memoryFootprint.toFixed(2)}MB (target: <10MB)`);
    
    // Check if targets are met
    const targetsMetCount = [
      results.setupDetection <= 200,
      results.configLoading <= 50,
      results.userInteraction <= 100,
      results.memoryFootprint <= 10
    ].filter(Boolean).length;
    
    console.log(`\n🎯 Targets Met: ${targetsMetCount}/4`);
    
    // Test 2: Performance Monitor
    console.log('\n🔍 Testing Performance Monitor...');
    const monitor = new PerformanceMonitor();
    
    monitor.start(1000);
    await new Promise(resolve => setTimeout(resolve, 3000)); // Monitor for 3 seconds
    monitor.stop();
    
    const stats = monitor.getStatistics();
    if (stats) {
      console.log('✅ Performance monitoring completed');
      console.log(`  Current Setup Detection: ${stats.setupDetection.current.toFixed(2)}ms`);
      console.log(`  Current Config Loading: ${stats.configLoading.current.toFixed(2)}ms`);
      console.log(`  Current User Interaction: ${stats.userInteraction.current.toFixed(2)}ms`);
      console.log(`  Current Memory Footprint: ${stats.memoryFootprint.current.toFixed(2)}MB`);
    }
    
    // Test 3: Benchmark
    console.log('\n🏁 Running Performance Benchmark...');
    const benchmark = new PerformanceBenchmark(10); // 10 iterations for quick test
    
    await benchmark.runBenchmark();
    console.log('✅ Benchmark completed');
    
    // Generate report
    console.log('\n📋 Generating optimization report...');
    await optimizer.generateOptimizationReport();
    console.log('✅ Report generated');
    
    console.log('\n🎉 All performance tests completed successfully!');
    console.log('='  .repeat(50));
    
  } catch (error) {
    console.error('❌ Performance test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  runQuickTest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { runQuickTest };
