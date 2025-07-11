import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // SSR configuration
  ssr: {
    noExternal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search']
  },
  
  // Tauri expects a fixed port
  server: {
    port: 5173,
    strictPort: true
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
        manualChunks: {
          // Core vendor libs in separate chunk (removed @sveltejs/kit as it's external)
          'vendor-core': ['svelte'],
          
          // Terminal-related libs
          'vendor-terminal': ['@xterm/xterm', '@xterm/addon-fit'],
        }
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