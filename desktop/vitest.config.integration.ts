import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    name: 'integration',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup-integration.ts'],
    include: ['src/**/*.integration.test.{js,ts}'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    conditions: ['browser', 'svelte'],
  },
});