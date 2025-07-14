import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  
  // SSR configuration
  ssr: {
    noExternal: ['@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search']
  },
  
  // Server configuration with fallback ports and timeouts
  server: {
    port: parseInt(process.env.PORT || '5173'),
    strictPort: false, // Allow fallback to other ports
    host: process.env.HOST || 'localhost',
    // Add timeout configurations for development server
    cors: true,
    hmr: {
      timeout: 30000, // HMR timeout
      overlay: true
    },
    // Development server timeout settings
    middlewareMode: false,
    headers: {
      'Keep-Alive': 'timeout=30, max=1000'
    },
    // Watch configuration to exclude Tauri directories
    watch: {
      ignored: [
        '**/src-tauri/target/**',
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**'
      ]
    },
    fs: {
      allow: ['..']
    }
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
            // Group other vendor dependencies
            return 'vendor';
          }
          // Return undefined for main chunk files to avoid empty chunks
          return undefined;
        },
        // Optimize chunk generation with better settings
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
    },
    
    // Better minification options
    minify: 'esbuild',
    target: 'esnext',
    sourcemap: false
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: ['svelte', '@sveltejs/kit', '@xterm/xterm', '@xterm/addon-fit', '@xterm/addon-web-links', '@xterm/addon-search'],
    exclude: ['@tauri-apps/api', '@tauri-apps/plugin-fs', '@tauri-apps/plugin-shell'],
    force: false, // Don't force re-optimization in development
    entries: ['src/main.ts', 'src/app.html']
  },
  
  // Ensure worker files are handled correctly
  worker: {
    format: 'es'
  },
  
  // Performance optimizations
  esbuild: {
    target: 'esnext',
    platform: 'browser',
    // Remove console logs in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Optimize for smaller bundles
    treeShaking: true
  },
  
  // Define configuration
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
});