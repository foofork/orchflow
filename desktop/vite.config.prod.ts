import { defineConfig } from 'vite';
import baseConfig from './vite.config';

// Production-specific optimizations
export default defineConfig({
  ...baseConfig,
  mode: 'production',
  build: {
    ...baseConfig.build,
    // Even smaller chunks for production
    chunkSizeWarningLimit: 300,
    rollupOptions: {
      ...baseConfig.build?.rollupOptions,
      output: {
        ...baseConfig.build?.rollupOptions?.output,
        // More aggressive chunking for production
        manualChunks(id) {
          // Micro-frontend style chunking
          if (id.includes('node_modules')) {
            // Framework chunks
            if (id.includes('svelte') || id.includes('@sveltejs')) {
              return 'framework-svelte';
            }
            
            // Editor chunks - split by feature
            if (id.includes('@codemirror/state') || id.includes('@codemirror/view')) {
              return 'editor-core';
            }
            if (id.includes('@codemirror/lang-')) {
              const lang = id.match(/lang-(\w+)/)?.[1];
              return `editor-lang-${lang}`;
            }
            if (id.includes('@codemirror/')) {
              return 'editor-features';
            }
            
            // Terminal chunks - split by addon
            if (id.includes('@xterm/xterm')) {
              return 'terminal-core';
            }
            if (id.includes('@xterm/addon-')) {
              const addon = id.match(/addon-(\w+)/)?.[1];
              return `terminal-addon-${addon}`;
            }
            
            // Tauri chunks - split by plugin
            if (id.includes('@tauri-apps/api')) {
              return 'tauri-api';
            }
            if (id.includes('@tauri-apps/plugin-')) {
              const plugin = id.match(/plugin-(\w+)/)?.[1];
              return `tauri-plugin-${plugin}`;
            }
            
            // Other utilities
            if (id.includes('fuse.js')) {
              return 'util-search';
            }
            if (id.includes('ws')) {
              return 'util-websocket';
            }
            
            // Remaining vendor code
            return 'vendor-misc';
          }
          
          // Application code chunking
          if (id.includes('/lib/components/')) {
            // Group components by feature
            if (id.includes('Terminal') || id.includes('terminal')) {
              return 'feature-terminal';
            }
            if (id.includes('Editor') || id.includes('editor')) {
              return 'feature-editor';
            }
            if (id.includes('Git') || id.includes('git')) {
              return 'feature-git';
            }
            if (id.includes('Settings') || id.includes('settings') || id.includes('Config')) {
              return 'feature-settings';
            }
            if (id.includes('Plugin') || id.includes('plugin')) {
              return 'feature-plugins';
            }
            if (id.includes('Dashboard') || id.includes('Metrics')) {
              return 'feature-dashboard';
            }
            // Other components
            return 'components-misc';
          }
          
          if (id.includes('/lib/stores/')) {
            return 'stores';
          }
          
          if (id.includes('/lib/utils/')) {
            return 'utils';
          }
          
          if (id.includes('/lib/services/')) {
            return 'services';
          }
        },
        
        // Even more compact output
        compact: true,
        
        // Better compression settings
        generatedCode: {
          constBindings: true,
          objectShorthand: true,
          arrowFunctions: true,
          symbols: true
        }
      }
    },
    
    // Production-specific terser options
    terserOptions: {
      compress: {
        ecma: 2020,
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug', 'console.trace'],
        passes: 5, // More passes for better optimization
        module: true,
        toplevel: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        dead_code: true,
        evaluate: true,
        inline: true,
        join_vars: true,
        keep_fargs: false,
        reduce_vars: true,
        sequences: true,
        side_effects: true,
        switches: true,
        unused: true
      },
      mangle: {
        module: true,
        toplevel: true,
        properties: {
          regex: /^_/,
          reserved: ['__TAURI__', '__TAURI_IPC__', '__TAURI_PLUGIN_FS__']
        }
      },
      format: {
        ecma: 2020,
        comments: false,
        ascii_only: true,
        wrap_iife: true,
        wrap_func_args: false
      },
      safari10: false
    }
  }
});