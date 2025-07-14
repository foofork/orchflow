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
    chunkSizeWarningLimit: 500,
    
    // Aggressive code splitting for smaller bundles
    rollupOptions: {
      output: {
        // Let Vite handle automatic chunking
        manualChunks: undefined,
        // Smaller chunks for better caching
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : '';
          if (facadeModuleId.includes('.svelte')) {
            return 'components/[name].[hash].js';
          }
          return 'chunks/[name].[hash].js';
        },
        // Asset file names
        assetFileNames: 'assets/[name].[hash][extname]',
        // Entry file names
        entryFileNames: 'app/[name].[hash].js',
        // Enable compact output
        compact: true,
        // Improve code splitting
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          symbols: true
        }
      },
      // Better tree shaking
      treeshake: {
        moduleSideEffects: 'no-external',
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        unknownGlobalSideEffects: false
      },
      // External dependencies that shouldn't be bundled
      external: []
    },
    
    // CommonJS optimization
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      // Better tree-shaking for CommonJS
      esmExternals: true,
      requireReturnsDefault: 'auto'
    },
    
    // Use terser for better minification
    minify: 'terser',
    terserOptions: {
      compress: {
        ecma: 2020,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
        passes: 3,
        module: true,
        toplevel: true,
        // More aggressive optimizations
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true
      },
      mangle: {
        module: true,
        toplevel: true,
        // Mangle properties for even smaller output
        properties: {
          regex: /^_/
        }
      },
      format: {
        ecma: 2020,
        comments: false,
        ascii_only: true
      },
      module: true,
      toplevel: true
    },
    
    // Target modern browsers for smaller output
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    
    // Disable source maps in production for smaller size
    sourcemap: false,
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Asset inlining threshold (4KB)
    assetsInlineLimit: 4096,
    
    // Report compressed size
    reportCompressedSize: true,
    
    // Better module preload
    modulePreload: {
      polyfill: false
    }
  },
  
  // Optimize dependencies
  optimizeDeps: {
    // Include only essential dependencies
    include: [
      'svelte'
    ],
    // Exclude heavy dependencies that should be lazy loaded
    exclude: [
      '@tauri-apps/api',
      '@tauri-apps/plugin-fs',
      '@tauri-apps/plugin-shell',
      '@codemirror/state',
      '@codemirror/view',
      '@xterm/xterm'
    ],
    // Disable force optimization
    force: false,
    // Entry points for optimization
    entries: ['src/app.html', 'src/routes/+page.svelte'],
    // Enable esbuild optimizations
    esbuildOptions: {
      target: 'es2020',
      supported: {
        'top-level-await': true
      }
    }
  },
  
  // Worker optimization
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        entryFileNames: 'workers/[name].[hash].js'
      }
    }
  },
  
  // CSS optimization
  css: {
    devSourcemap: false,
    // PostCSS optimization in production
    postcss: process.env.NODE_ENV === 'production' ? {
      plugins: [
        {
          postcssPlugin: 'optimize-css',
          Once(root, { result }) {
            // Remove unused CSS variables
            root.walkDecls(decl => {
              if (decl.prop.startsWith('--') && !decl.parent.selector.includes(':root')) {
                decl.remove();
              }
            });
          }
        }
      ]
    } : undefined
  },
  
  // Performance optimizations
  esbuild: {
    target: 'es2020',
    platform: 'browser',
    // Drop console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    // Better tree shaking
    treeShaking: true,
    // Legal comments
    legalComments: 'none',
    // Pure functions for better tree shaking
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
    // Better minification
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  },
  
  // Define configuration
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    'import.meta.env.PROD': process.env.NODE_ENV === 'production',
    'import.meta.env.DEV': process.env.NODE_ENV !== 'production'
  },
  
  // JSON optimization
  json: {
    namedExports: true,
    stringify: true
  }
});