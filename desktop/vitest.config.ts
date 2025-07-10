import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/*',
        '.svelte-kit/**',
        'build/**',
        'src/routes/**',
        'src/app.html',
        'src/app.d.ts',
        'src/hooks.server.ts',
        'src/hooks.client.ts',
      ],
      include: ['src/lib/**/*.{js,ts,svelte}'],
    },
  },
  resolve: {
    conditions: ['browser', 'svelte'],
  },
});