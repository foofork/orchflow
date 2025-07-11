import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'performance',
    include: ['src/**/*.performance.test.ts', 'src/**/performance.test.ts'],
    exclude: ['node_modules', 'dist'],
    
    // Performance test specific settings
    testTimeout: 60000, // 60 seconds for performance tests
    hookTimeout: 30000, // 30 seconds for hooks
    
    // Run performance tests in sequence to avoid interference
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    },
    
    // Reporter configuration
    reporters: ['default', 'json'],
    outputFile: {
      json: './test-results/performance-results.json'
    },
    
    // Coverage disabled for performance tests
    coverage: {
      enabled: false
    },
    
    // Environment
    environment: 'node',
    
    // Global setup for performance tests
    globalSetup: './test/setup/performance.setup.ts',
    
    // Benchmark configuration
    benchmark: {
      include: ['**/*.bench.ts'],
      reporters: ['default', 'json'],
      outputFile: './test-results/benchmark-results.json'
    }
  },
  
  resolve: {
    alias: {
      '$lib': resolve('./src/lib'),
      '$app': resolve('./src/app')
    }
  }
});