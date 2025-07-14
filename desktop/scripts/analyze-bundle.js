#!/usr/bin/env node

import { readdirSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildDir = join(__dirname, '../build');

function formatBytes(bytes) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

function analyzeBundle(dir) {
  const files = [];
  
  function walk(currentDir) {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stats = statSync(fullPath);
      
      if (stats.isDirectory()) {
        walk(fullPath);
      } else if (item.endsWith('.js') || item.endsWith('.css')) {
        files.push({
          path: fullPath.replace(buildDir, ''),
          size: stats.size,
          type: item.endsWith('.js') ? 'JavaScript' : 'CSS'
        });
      }
    }
  }
  
  walk(dir);
  
  // Sort by size
  files.sort((a, b) => b.size - a.size);
  
  // Group by type
  const jsFiles = files.filter(f => f.type === 'JavaScript');
  const cssFiles = files.filter(f => f.type === 'CSS');
  
  console.warn('\n=== Bundle Size Analysis ===\n');
  
  console.warn('JavaScript Files:');
  console.warn('-'.repeat(60));
  let totalJS = 0;
  jsFiles.forEach(file => {
    console.warn(`${file.path.padEnd(40)} ${formatBytes(file.size).padStart(10)}`);
    totalJS += file.size;
  });
  
  console.warn('\nCSS Files:');
  console.warn('-'.repeat(60));
  let totalCSS = 0;
  cssFiles.forEach(file => {
    console.warn(`${file.path.padEnd(40)} ${formatBytes(file.size).padStart(10)}`);
    totalCSS += file.size;
  });
  
  console.warn('\n' + '='.repeat(60));
  console.warn(`Total JavaScript: ${formatBytes(totalJS)}`);
  console.warn(`Total CSS: ${formatBytes(totalCSS)}`);
  console.warn(`Total Bundle Size: ${formatBytes(totalJS + totalCSS)}`);
  console.warn('='.repeat(60) + '\n');
  
  // Chunk analysis
  const chunks = jsFiles.filter(f => f.path.includes('chunks/') || f.path.includes('components/'));
  if (chunks.length > 0) {
    console.warn('\nChunk Analysis:');
    console.warn('-'.repeat(60));
    
    const vendorChunks = chunks.filter(f => f.path.includes('vendor'));
    const componentChunks = chunks.filter(f => f.path.includes('components/'));
    const otherChunks = chunks.filter(f => !f.path.includes('vendor') && !f.path.includes('components/'));
    
    console.warn(`Vendor chunks: ${vendorChunks.length} files, ${formatBytes(vendorChunks.reduce((sum, f) => sum + f.size, 0))}`);
    console.warn(`Component chunks: ${componentChunks.length} files, ${formatBytes(componentChunks.reduce((sum, f) => sum + f.size, 0))}`);
    console.warn(`Other chunks: ${otherChunks.length} files, ${formatBytes(otherChunks.reduce((sum, f) => sum + f.size, 0))}`);
  }
  
  // Find large chunks
  const largeChunks = files.filter(f => f.size > 50 * 1024); // 50KB
  if (largeChunks.length > 0) {
    console.warn('\n⚠️  Large chunks (>50KB):');
    console.warn('-'.repeat(60));
    largeChunks.forEach(file => {
      console.warn(`${file.path.padEnd(40)} ${formatBytes(file.size).padStart(10)}`);
    });
  }
  
  // Recommendations
  console.warn('\n📊 Recommendations:');
  console.warn('-'.repeat(60));
  
  if (totalJS > 500 * 1024) {
    console.warn('⚠️  Total JavaScript size exceeds 500KB. Consider:');
    console.warn('   - Implementing more aggressive code splitting');
    console.warn('   - Removing unused dependencies');
    console.warn('   - Using dynamic imports for large components');
  }
  
  const emptyChunks = files.filter(f => f.size < 1024);
  if (emptyChunks.length > 0) {
    console.warn(`⚠️  Found ${emptyChunks.length} very small chunks (<1KB). Consider consolidating.`);
  }
  
  const largeVendorChunks = (typeof vendorChunks !== 'undefined') ? vendorChunks.filter(f => f.size > 100 * 1024) : [];
  if (largeVendorChunks.length > 0) {
    console.warn('⚠️  Large vendor chunks detected. Consider:');
    console.warn('   - Splitting vendor chunks by usage frequency');
    console.warn('   - Lazy loading heavy dependencies');
  }
  
  console.warn('\n✅ Optimization Status:');
  console.warn(`   - Code splitting: ${chunks.length > 5 ? '✓ Active' : '✗ Limited'}`);
  console.warn(`   - Vendor separation: ${(typeof vendorChunks !== 'undefined') ? vendorChunks.length > 0 ? '✓ Enabled' : '✗ Disabled' : '✗ Disabled'}`);
  console.warn(`   - Component chunking: ${(typeof componentChunks !== 'undefined') ? componentChunks.length > 0 ? '✓ Active' : '✗ Inactive' : '✗ Inactive'}`);
}

// Check if build directory exists
try {
  statSync(buildDir);
  analyzeBundle(buildDir);
} catch (_error) {
  console.error('Build directory not found. Please run "npm run build" first.');
  process.exit(1);
}