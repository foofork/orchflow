#!/usr/bin/env node
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

async function getDirectorySize(dirPath) {
  let totalSize = 0;
  const files = await readdir(dirPath, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = join(dirPath, file.name);
    if (file.isDirectory()) {
      totalSize += await getDirectorySize(filePath);
    } else {
      const stats = await stat(filePath);
      totalSize += stats.size;
    }
  }
  
  return totalSize;
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

async function analyzeBundle() {
  console.log('🔍 Analyzing build output...\n');
  
  try {
    const buildDir = 'build';
    const distDir = 'dist';
    
    // Check build directory
    if (await stat(buildDir).catch(() => false)) {
      const buildSize = await getDirectorySize(buildDir);
      console.log(`📦 Build directory size: ${formatBytes(buildSize)}`);
      
      // Analyze specific file types
      const jsFiles = await readdir(join(buildDir, '_app'), { withFileTypes: true })
        .then(files => files.filter(f => f.name.endsWith('.js')))
        .catch(() => []);
      
      if (jsFiles.length > 0) {
        console.log('\n📄 JavaScript files:');
        for (const file of jsFiles) {
          const filePath = join(buildDir, '_app', file.name);
          const stats = await stat(filePath);
          console.log(`  - ${file.name}: ${formatBytes(stats.size)}`);
        }
      }
    }
    
    // Check dist directory
    if (await stat(distDir).catch(() => false)) {
      const distSize = await getDirectorySize(distDir);
      console.log(`\n📦 Dist directory size: ${formatBytes(distSize)}`);
    }
    
    // Performance recommendations
    console.log('\n💡 Optimization recommendations:');
    console.log('  1. Enable code splitting for routes');
    console.log('  2. Lazy load heavy components');
    console.log('  3. Use dynamic imports for optional features');
    console.log('  4. Enable compression (gzip/brotli)');
    console.log('  5. Minify and tree-shake dependencies');
    
  } catch (error) {
    console.error('Error analyzing bundle:', error.message);
  }
}

analyzeBundle();