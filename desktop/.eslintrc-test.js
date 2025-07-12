/**
 * ESLint configuration for test files
 * Enforces usage of test utilities and patterns
 */

module.exports = {
  extends: ['./.eslintrc.js'],
  rules: {
    // Enforce use of test utilities instead of raw vi.fn()
    'no-restricted-syntax': [
      'error',
      {
        selector: 'CallExpression[callee.object.name="vi"][callee.property.name="fn"] > :not(ArrowFunctionExpression):not(FunctionExpression)',
        message: 'Use createTypedMock(), createAsyncMock(), or createSyncMock() instead of raw vi.fn() for better type safety',
      },
      {
        selector: 'CallExpression[callee.name="writable"]:not([parent.type="CallExpression"][parent.callee.name="createMockWritable"])',
        message: 'Use createMockWritable() or enhancedStoreMocks.createTypedWritable() instead of raw writable() in tests',
      },
      {
        selector: 'CallExpression[callee.name="readable"]:not([parent.type="CallExpression"][parent.callee.name="createMockReadable"])',
        message: 'Use createMockReadable() or enhancedStoreMocks.createTypedReadable() instead of raw readable() in tests',
      },
      {
        selector: 'CallExpression[callee.name="derived"]:not([parent.type="CallExpression"][parent.callee.name="createMockDerived"])',
        message: 'Use createMockDerived() or enhancedStoreMocks.createTypedDerived() instead of raw derived() in tests',
      },
    ],

    // Enforce proper imports from test utilities
    'no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'vitest',
            importNames: ['vi'],
            message: 'Import vi from test utilities: import { vi } from "@/test/utils" for enhanced functionality',
          },
          {
            name: 'svelte/store',
            message: 'Import store utilities from test utilities: import { createMockWritable } from "@/test/utils"',
          },
        ],
      },
    ],

    // Require test data builders for complex objects
    'prefer-test-builders': 'error',

    // Require cleanup functions for async tests
    'require-test-cleanup': 'error',

    // Enforce consistent mock naming
    'consistent-mock-naming': 'error',

    // Require type assertions for mocks
    'require-mock-types': 'error',
  },

  overrides: [
    {
      files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
      rules: {
        // Additional test-specific rules
        'max-lines-per-function': ['error', { max: 100 }],
        'max-nested-callbacks': ['error', 4],
        
        // Require describe blocks for organization
        'jest/require-top-level-describe': 'error',
        
        // Enforce consistent test structure
        'jest/consistent-test-it': ['error', { fn: 'test' }],
        
        // Require assertions in tests
        'jest/expect-expect': [
          'error',
          {
            assertFunctionNames: [
              'expect',
              'expectToHaveBeenCalled',
              'expectStoreValue',
              'expectComponentVisible',
            ],
          },
        ],

        // Prevent disabled tests in CI
        'jest/no-disabled-tests': process.env.CI ? 'error' : 'warn',
        
        // Require cleanup in async tests
        'jest/no-done-callback': 'error',
        
        // Enforce proper mock cleanup
        'jest/no-hooks': [
          'error',
          {
            allow: ['beforeEach', 'afterEach'],
          },
        ],
      },
    },
  ],

  // Custom rules for test utilities
  plugins: ['test-utilities'],
  
  env: {
    node: true,
    'vitest-globals/env': true,
  },

  globals: {
    // Test utility globals
    buildSession: 'readonly',
    buildPane: 'readonly',
    buildPlugin: 'readonly',
    buildTerminalConfig: 'readonly',
    buildEditorConfig: 'readonly',
    buildCommandPaletteItem: 'readonly',
    buildDashboardWidget: 'readonly',
    buildFileNode: 'readonly',
    buildDirectoryNode: 'readonly',
    buildGitBranch: 'readonly',
    buildGitCommit: 'readonly',
    buildSearchResult: 'readonly',
    createMockTerminal: 'readonly',
    createMockEditor: 'readonly',
    createMockWritable: 'readonly',
    createMockReadable: 'readonly',
    createMockDerived: 'readonly',
    createTypedMock: 'readonly',
    createAsyncMock: 'readonly',
    createSyncMock: 'readonly',
    enhancedStoreMocks: 'readonly',
    enhancedComponentMocks: 'readonly',
    enhancedDataBuilders: 'readonly',
    testScenarios: 'readonly',
  },
};