#!/usr/bin/env node

/**
 * Validates test files against the new patterns
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_PATTERN_RULES = [
  {
    name: 'No raw vi.fn() usage',
    pattern: /vi\.fn\(\)/g,
    error: 'Use createTypedMock, createSyncMock, or createAsyncMock instead of vi.fn()'
  },
  {
    name: 'Proper cleanup pattern',
    pattern: /let\s+cleanup:\s+Array<\(\)\s*=>\s*void>\s*=/,
    required: true,
    error: 'Missing cleanup array declaration'
  },
  {
    name: 'Cleanup in afterEach',
    pattern: /afterEach\(\s*\(\)\s*=>\s*{[\s\S]*?cleanup\.forEach\(fn\s*=>\s*fn\(\)\)/,
    required: true,
    error: 'Missing cleanup.forEach in afterEach'
  },
  {
    name: 'Import from mock-factory',
    pattern: /from\s+['"]@\/test\/mock-factory['"]/,
    required: true,
    error: 'Missing import from @/test/mock-factory'
  },
  {
    name: 'No mockImplementation without typed mocks',
    pattern: /\.mockImplementation\(/g,
    warning: 'Consider using typed mocks instead of mockImplementation'
  }
];

async function findTestFiles(dir, files = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
      await findTestFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.test.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

async function validateTestPatterns() {
  console.log('🔍 Validating test patterns...\n');
  
  const srcDir = path.join(__dirname, '..', 'src');
  const testFiles = await findTestFiles(srcDir);
  
  let totalFiles = 0;
  let passedFiles = 0;
  const issues = [];
  
  for (const file of testFiles) {
    totalFiles++;
    const content = fs.readFileSync(file, 'utf-8');
    const relativePath = path.relative(path.join(__dirname, '..'), file);
    let fileIssues = [];
    
    for (const rule of TEST_PATTERN_RULES) {
      if (rule.required) {
        // Check if required pattern exists
        if (!rule.pattern.test(content)) {
          fileIssues.push({
            type: 'error',
            rule: rule.name,
            message: rule.error
          });
        }
      } else if (rule.error) {
        // Check if forbidden pattern exists
        const matches = content.match(rule.pattern);
        if (matches) {
          fileIssues.push({
            type: 'error',
            rule: rule.name,
            message: rule.error,
            count: matches.length
          });
        }
      } else if (rule.warning) {
        // Check for warning patterns
        const matches = content.match(rule.pattern);
        if (matches) {
          fileIssues.push({
            type: 'warning',
            rule: rule.name,
            message: rule.warning,
            count: matches.length
          });
        }
      }
    }
    
    const hasErrors = fileIssues.some(issue => issue.type === 'error');
    
    if (fileIssues.length === 0) {
      passedFiles++;
      console.log(`✅ ${relativePath}`);
    } else if (!hasErrors) {
      passedFiles++;
      console.log(`✅ ${relativePath} (with warnings)`);
      fileIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '  ❌' : '  ⚠️';
        const count = issue.count ? ` (${issue.count} occurrences)` : '';
        console.log(`${icon} ${issue.message}${count}`);
      });
    } else {
      console.log(`❌ ${relativePath}`);
      fileIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '  ❌' : '  ⚠️';
        const count = issue.count ? ` (${issue.count} occurrences)` : '';
        console.log(`${icon} ${issue.message}${count}`);
      });
      issues.push({ file: relativePath, issues: fileIssues });
    }
  }
  
  console.log('\n📊 Summary:');
  console.log(`Total test files: ${totalFiles}`);
  console.log(`Passed validation: ${passedFiles}`);
  console.log(`Failed validation: ${totalFiles - passedFiles}`);
  
  if (issues.length > 0) {
    console.log('\n❌ Validation failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests follow the new patterns!');
  }
}

validateTestPatterns().catch(console.error);