import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  
  test: {
    name: 'e2e',
    globals: true,
    environment: 'node',
    
    // Test file patterns
    include: [
      'tests/e2e/smoke/**/*.test.ts',
      'tests/e2e/regression/**/*.test.ts',
      'tests/e2e/critical/**/*.test.ts'
    ],
    exclude: [
      'tests/e2e/helpers/**',
      'tests/e2e/**/fixtures/**',
      'tests/e2e/**/*.d.ts'
    ],
    
    // Timeouts - increased for sequential execution
    testTimeout: 180000, // 3 minutes per test
    hookTimeout: 180000, // 3 minutes for hooks
    
    // Setup files
    setupFiles: ['./tests/setup/e2e-setup.ts'],
    
    // Sequential execution for E2E tests to avoid resource conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,  // Force sequential execution
        isolate: true,
        maxForks: 1,       // Only one fork
        minForks: 1
      }
    },
    
    // Max concurrent tests - limit to 1 for resource management
    maxConcurrency: 1,
    
    // Reporters
    reporters: ['default', 'html', 'json'],
    outputFile: {
      json: './test-results/e2e-results.json',
      html: './test-results/e2e-report.html'
    },
    
    // Coverage (disabled for E2E)
    coverage: {
      enabled: false
    },
    
    // Retry configuration
    retry: process.env.CI ? 2 : 0,
    
    // Fail fast in CI
    bail: process.env.CI ? 5 : 0,
    
    // Test sequence - run sequentially to prevent resource conflicts
    sequence: {
      shuffle: false,
      concurrent: false  // Sequential execution
    },
    
    // Cache
    cache: {
      dir: '.vitest/e2e'
    },
    
    // Watch mode exclusions
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/test-results/**',
      '**/.port-locks.json'
    ]
  },
  
  resolve: {
    alias: {
      '$lib': resolve('./src/lib'),
      '$app': resolve('./src/app'),
      '@': resolve('./src'),
      '~': resolve('./')
    }
  },
  
  // Server configuration for test environment
  server: {
    fs: {
      allow: ['..']
    }
  }
});