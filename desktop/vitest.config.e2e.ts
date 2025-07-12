import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.e2e.test.{js,ts}'],
    testTimeout: 120000, // Increased for E2E tests
    hookTimeout: 120000,
    setupFiles: ['./tests/setup/e2e-setup.ts'],
    pool: 'forks', // Run E2E tests in separate processes
    poolOptions: {
      forks: {
        singleFork: true // Prevent port conflicts
      }
    }
  },
});