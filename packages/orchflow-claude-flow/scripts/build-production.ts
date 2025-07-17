#!/usr/bin/env node
/**
 * Production Build Script
 * Ensures error-free, optimized build with all dependencies
 */

import { execSync } from 'child_process';
import { existsSync, rmSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');
const SRC_DIR = join(ROOT_DIR, 'src');

function exec(command: string, cwd = ROOT_DIR): void {
  console.log(chalk.blue(`> ${command}`));
  try {
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(chalk.red(`Failed: ${command}`));
    process.exit(1);
  }
}

function clean(): void {
  console.log(chalk.yellow('🧹 Cleaning previous build...'));
  if (existsSync(DIST_DIR)) {
    rmSync(DIST_DIR, { recursive: true, force: true });
  }
  mkdirSync(DIST_DIR, { recursive: true });
}

function installDependencies(): void {
  console.log(chalk.yellow('📦 Installing dependencies...'));
  exec('npm ci --production=false');
}

function runTypeCheck(): void {
  console.log(chalk.yellow('🔍 Running TypeScript type check...'));
  exec('npx tsc --noEmit');
}

function buildTypeScript(): void {
  console.log(chalk.yellow('🔨 Building TypeScript...'));
  exec('npx tsc');
}

function bundleWithEsbuild(): void {
  console.log(chalk.yellow('📦 Creating optimized bundles...'));
  
  // CLI bundle
  exec(`npx esbuild src/cli.ts --bundle --platform=node --target=node16 --outfile=dist/cli.js --minify --sourcemap --external:child_process --external:fs --external:path --external:os --external:util --external:stream --external:events`);
  
  // Main library bundle
  exec(`npx esbuild src/index.ts --bundle --platform=node --target=node16 --outfile=dist/index.js --minify --sourcemap --format=cjs --external:child_process --external:fs --external:path --external:os --external:util --external:stream --external:events`);
}

function addExecutablePermissions(): void {
  console.log(chalk.yellow('🔧 Setting executable permissions...'));
  exec('chmod +x dist/cli.js');
}

function copyAssets(): void {
  console.log(chalk.yellow('📋 Copying assets...'));
  const assets = ['package.json', 'README.md', 'LICENSE'];
  
  assets.forEach(asset => {
    const src = join(ROOT_DIR, asset);
    const dest = join(DIST_DIR, asset);
    if (existsSync(src)) {
      copyFileSync(src, dest);
    }
  });
}

function runTests(): void {
  console.log(chalk.yellow('🧪 Running tests...'));
  exec('npm test -- --passWithNoTests');
}

function validateBuild(): void {
  console.log(chalk.yellow('✅ Validating build...'));
  
  const requiredFiles = [
    'dist/cli.js',
    'dist/index.js',
    'dist/index.d.ts'
  ];
  
  const missing = requiredFiles.filter(f => !existsSync(join(ROOT_DIR, f)));
  
  if (missing.length > 0) {
    console.error(chalk.red('❌ Missing required files:'));
    missing.forEach(f => console.error(chalk.red(`  - ${f}`)));
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Build validation passed!'));
}

async function main(): Promise<void> {
  console.log(chalk.cyan.bold('\n🚀 OrchFlow Production Build\n'));
  
  try {
    clean();
    installDependencies();
    runTypeCheck();
    buildTypeScript();
    bundleWithEsbuild();
    addExecutablePermissions();
    copyAssets();
    runTests();
    validateBuild();
    
    console.log(chalk.green.bold('\n✅ Production build completed successfully!\n'));
    console.log(chalk.cyan('📦 Output: dist/'));
    console.log(chalk.cyan('📊 Bundle size:'));
    exec('du -sh dist/*', ROOT_DIR);
    
  } catch (error) {
    console.error(chalk.red.bold('\n❌ Build failed!'));
    console.error(error);
    process.exit(1);
  }
}

main().catch(console.error);