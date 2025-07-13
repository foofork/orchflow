import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}'],
    testTimeout: 60000, // Increased to 60s for slower tests
    hookTimeout: 60000, // Increased to 60s for consistency
    bail: 0, // Don't bail on first failure
    retry: 1, // Retry failed tests once
    server: {
      deps: {
        inline: ['@tauri-apps/api', '@tauri-apps/plugin-fs', '@tauri-apps/plugin-shell', '@tauri-apps/plugin-process', '@tauri-apps/plugin-os', '@tauri-apps/plugin-updater']
      }
    },
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
    alias: {
      '@': resolve(__dirname, './src'),
      '@tauri-apps/api/tauri': resolve(__dirname, './src/test/stubs/tauri-api.ts'),
      '@tauri-apps/api/core': resolve(__dirname, './src/test/stubs/tauri-api.ts'),
      '@tauri-apps/api/event': resolve(__dirname, './src/test/stubs/tauri-api.ts'),
      '@tauri-apps/api/window': resolve(__dirname, './src/test/stubs/tauri-api.ts'),
      '@tauri-apps/api': resolve(__dirname, './src/test/stubs/tauri-api.ts'),
      '@tauri-apps/plugin-fs': resolve(__dirname, './src/test/stubs/tauri-plugins.ts'),
      '@tauri-apps/plugin-shell': resolve(__dirname, './src/test/stubs/tauri-plugins.ts'),
      '@tauri-apps/plugin-process': resolve(__dirname, './src/test/stubs/tauri-plugins.ts'),
      '@tauri-apps/plugin-os': resolve(__dirname, './src/test/stubs/tauri-plugins.ts'),
      '@tauri-apps/plugin-updater': resolve(__dirname, './src/test/stubs/tauri-plugins.ts'),
    }
  },
});