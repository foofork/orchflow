import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e',
    globals: true,
    environment: 'node',
    include: ['e2e/**/*.e2e.test.{js,ts}'],
    testTimeout: 60000,
    hookTimeout: 60000,
  },
});