import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // SSR configuration
  ssr: {
    noExternal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search']
  },
  
  // Server configuration with fallback ports
  server: {
    port: parseInt(process.env.PORT || '5173'),
    strictPort: false, // Allow fallback to other ports
    host: process.env.HOST || 'localhost'
  },
  
  // Env prefix for Tauri
  envPrefix: ['VITE_', 'TAURI_'],
  
  // Build optimizations
  build: {
    // Reduce chunk size warnings
    chunkSizeWarningLimit: 1000,
    
    // Manual chunking for better caching
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Split vendor chunks for better caching
            if (id.includes('codemirror')) {
              return 'vendor-editor';
            }
            if (id.includes('xterm')) {
              return 'vendor-terminal';
            }
            if (id.includes('svelte') || id.includes('@sveltejs')) {
              return 'vendor-svelte';
            }
            if (id.includes('fuse.js')) {
              return 'vendor-search';
            }
            if (id.includes('@tauri-apps')) {
              return 'vendor-tauri';
            }
            // Core vendor chunk for remaining dependencies
            return 'vendor-core';
          }
        },
        // Optimize chunk generation
        experimentalMinChunkSize: 10000
      },
      // Enable better tree shaking
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    
    // Optimize deps
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['svelte', '@sveltejs/kit', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search']
  },
  
  // Ensure worker files are handled correctly
  worker: {
    format: 'es'
  }
});