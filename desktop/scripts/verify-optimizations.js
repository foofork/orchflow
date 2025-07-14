#!/usr/bin/env node

import { readFileSync, statSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test configuration
const tests = [
  {
    name: 'GitPanel Lazy Loading',
    check: () => {
      // Check if GitPanel.svelte is now a wrapper
      const gitPanelPath = join(__dirname, '../src/lib/components/GitPanel.svelte');
      const gitPanelContent = readFileSync(gitPanelPath, 'utf8');
      
      const hasLazyComponent = gitPanelContent.includes('LazyComponent');
      const hasDirectImplementation = gitPanelContent.includes('function loadGitStatus');
      
      return {
        passed: hasLazyComponent && !hasDirectImplementation,
        message: hasLazyComponent && !hasDirectImplementation 
          ? 'GitPanel is properly wrapped with LazyComponent'
          : 'GitPanel is not properly lazy-loaded'
      };
    }
  },
  
  {
    name: 'Vite Config Optimizations',
    check: () => {
      const viteConfigPath = join(__dirname, '../vite.config.ts');
      const viteConfigContent = readFileSync(viteConfigPath, 'utf8');
      
      const hasTerser = viteConfigContent.includes('minify: \'terser\'');
      const hasManualChunks = viteConfigContent.includes('manualChunks:');
      const hasTreeShaking = viteConfigContent.includes('treeshake:');
      
      return {
        passed: hasTerser && hasManualChunks && hasTreeShaking,
        message: 'Vite config has terser minification, manual chunking, and tree shaking'
      };
    }
  },
  
  {
    name: 'Lazy Loading Utils',
    check: () => {
      const lazyLoadPath = join(__dirname, '../src/lib/utils/lazyLoad.ts');
      const preloadPath = join(__dirname, '../src/lib/utils/preload.ts');
      
      try {
        const lazyLoadContent = readFileSync(lazyLoadPath, 'utf8');
        const preloadContent = readFileSync(preloadPath, 'utf8');
        
        const hasIntersectionObserver = lazyLoadContent.includes('IntersectionObserver');
        const hasSmartPreloader = preloadContent.includes('SmartPreloader');
        
        return {
          passed: hasIntersectionObserver && hasSmartPreloader,
          message: 'Lazy loading utilities are properly implemented'
        };
      } catch (error) {
        return {
          passed: false,
          message: 'Lazy loading utilities are missing'
        };
      }
    }
  },
  
  {
    name: 'LazyComponent Enhancement',
    check: () => {
      const lazyComponentPath = join(__dirname, '../src/lib/components/LazyComponent.svelte');
      const lazyComponentContent = readFileSync(lazyComponentPath, 'utf8');
      
      const hasRetryLogic = lazyComponentContent.includes('retryCount');
      const hasErrorHandling = lazyComponentContent.includes('error:');
      const hasPropsForwarding = lazyComponentContent.includes('componentProps');
      
      return {
        passed: hasRetryLogic && hasErrorHandling && hasPropsForwarding,
        message: 'LazyComponent has retry logic, error handling, and props forwarding'
      };
    }
  },
  
  {
    name: 'Smart Preloading Integration',
    check: () => {
      const mainPagePath = join(__dirname, '../src/routes/+page.svelte');
      const mainPageContent = readFileSync(mainPagePath, 'utf8');
      
      const hasSmartPreloader = mainPageContent.includes('smartPreloader');
      const hasInitializePreloading = mainPageContent.includes('initializePreloading');
      const hasUsageTracking = mainPageContent.includes('recordUsage');
      
      return {
        passed: hasSmartPreloader && hasInitializePreloading && hasUsageTracking,
        message: 'Smart preloading is properly integrated into the main page'
      };
    }
  },
  
  {
    name: 'Bundle Analysis Tools',
    check: () => {
      const packageJsonPath = join(__dirname, '../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      const hasBuildAnalyze = packageJson.scripts['build:analyze'];
      const hasAnalyzeScript = statSync(join(__dirname, 'analyze-bundle.js')).isFile();
      
      return {
        passed: hasBuildAnalyze && hasAnalyzeScript,
        message: 'Bundle analysis tools are properly configured'
      };
    }
  },
  
  {
    name: 'Production Config',
    check: () => {
      try {
        const prodConfigPath = join(__dirname, '../vite.config.prod.ts');
        const prodConfigContent = readFileSync(prodConfigPath, 'utf8');
        
        const hasMicroChunking = prodConfigContent.includes('manualChunks(id)');
        const hasAggressiveOptimization = prodConfigContent.includes('passes: 5');
        
        return {
          passed: hasMicroChunking && hasAggressiveOptimization,
          message: 'Production config has micro-chunking and aggressive optimization'
        };
      } catch (error) {
        return {
          passed: false,
          message: 'Production config is missing'
        };
      }
    }
  }
];

console.log('🔍 Verifying Bundle Optimizations...\n');

let passed = 0;
let total = tests.length;

tests.forEach((test, index) => {
  const result = test.check();
  const status = result.passed ? '✅' : '❌';
  
  console.log(`${index + 1}. ${status} ${test.name}`);
  console.log(`   ${result.message}\n`);
  
  if (result.passed) {
    passed++;
  }
});

console.log('='.repeat(60));
console.log(`Results: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('🎉 All optimizations verified successfully!');
} else {
  console.log('⚠️  Some optimizations need attention.');
}

console.log('\nNext steps:');
console.log('1. Run "npm run build:analyze" to see bundle sizes');
console.log('2. Monitor loading performance in development');
console.log('3. Test lazy loading functionality');
console.log('4. Check network tab for proper chunk loading');

process.exit(passed === total ? 0 : 1);