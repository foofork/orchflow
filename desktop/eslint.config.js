import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser
      }
    }
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'no-debugger': 'warn',
      'svelte/no-at-html-tags': 'error',
      'svelte/no-at-debug-tags': 'warn'
    }
  },
  {
    ignores: [
      '**/node_modules/**',
      '**/build/**',
      '**/.svelte-kit/**',
      '**/dist/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/coverage/**',
      '**/.vitest/**',
      '**/src-tauri/target/**',
      'eslint.config.js'
    ]
  }
];