/**
 * @type {import('@stryker-mutator/api/core').PartialStrykerOptions}
 */
export default {
  packageManager: 'npm',
  reporters: ['html', 'clear-text', 'progress', 'dashboard'],
  testRunner: 'vitest',
  testRunnerNodeArgs: ['--no-warnings'],
  coverageAnalysis: 'perTest',
  mutate: [
    'src/lib/**/*.{js,ts,svelte}',
    '!src/lib/**/*.test.{js,ts}',
    '!src/lib/**/*.spec.{js,ts}',
    '!src/lib/test-utils/**/*',
    '!src/test/**/*'
  ],
  ignorePatterns: [
    'node_modules',
    'dist',
    'coverage',
    '.svelte-kit',
    'src/lib/components/__mocks__'
  ],
  mutator: {
    excludedMutations: []
  },
  disableTypeChecks: '{src,lib}/**/*.{js,ts,svelte}',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
  fileLogLevel: 'warn',
  logLevel: 'info',
  timeoutMS: 60000,
  timeoutFactor: 2,
  dryRunTimeoutMinutes: 5,
  maxConcurrentTestRunners: 4,
  thresholds: {
    high: 80,
    low: 60,
    break: 50
  },
  dashboard: {
    project: 'github.com/orchflow/orchflow',
    version: 'main',
    module: 'desktop',
    reportType: 'full'
  },
  htmlReporter: {
    fileName: 'reports/mutation/index.html'
  },
  incremental: true,
  incrementalFile: '.stryker-incremental.json',
  force: false
};