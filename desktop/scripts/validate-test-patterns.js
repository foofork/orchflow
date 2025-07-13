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
    error: 'Use createTypedMock, createSyncMock, or createAsyncMock instead of vi.fn()',
    customValidator: (content, matches) => {
      // Filter out vi.fn() in comments and vi.mock blocks
      return matches.filter(match => {
        const lines = content.split('\n');
        let inViMock = false;
        let viMockDepth = 0;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check if we're entering a vi.mock block
          if (line.includes('vi.mock(')) {
            inViMock = true;
            viMockDepth = 0;
          }
          
          // Track braces to know when vi.mock ends
          if (inViMock) {
            viMockDepth += (line.match(/\{/g) || []).length;
            viMockDepth -= (line.match(/\}/g) || []).length;
            
            if (viMockDepth <= 0 && line.includes('}')) {
              inViMock = false;
            }
          }
          
          // Check if this line contains vi.fn()
          if (line.includes('vi.fn()')) {
            // Skip if it's in a comment
            const commentIndex = line.indexOf('//');
            const viFnIndex = line.indexOf('vi.fn()');
            if (commentIndex !== -1 && commentIndex < viFnIndex) {
              continue;
            }
            
            // Skip if it's in a vi.mock block
            if (inViMock) {
              continue;
            }
            
            // This is a real vi.fn() usage that should be flagged
            return true;
          }
        }
        
        return false;
      }).length > 0;
    }
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
  console.warn('🔍 Validating test patterns...\n');
  
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
          // Use custom validator if provided
          const shouldFlag = rule.customValidator 
            ? rule.customValidator(content, matches)
            : matches.length > 0;
            
          if (shouldFlag) {
            fileIssues.push({
              type: 'error',
              rule: rule.name,
              message: rule.error,
              count: rule.customValidator ? undefined : matches.length
            });
          }
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
      console.warn(`✅ ${relativePath}`);
    } else if (!hasErrors) {
      passedFiles++;
      console.warn(`✅ ${relativePath} (with warnings)`);
      fileIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '  ❌' : '  ⚠️';
        const count = issue.count ? ` (${issue.count} occurrences)` : '';
        console.warn(`${icon} ${issue.message}${count}`);
      });
    } else {
      console.warn(`❌ ${relativePath}`);
      fileIssues.forEach(issue => {
        const icon = issue.type === 'error' ? '  ❌' : '  ⚠️';
        const count = issue.count ? ` (${issue.count} occurrences)` : '';
        console.warn(`${icon} ${issue.message}${count}`);
      });
      issues.push({ file: relativePath, issues: fileIssues });
    }
  }
  
  console.warn('\n📊 Summary:');
  console.warn(`Total test files: ${totalFiles}`);
  console.warn(`Passed validation: ${passedFiles}`);
  console.warn(`Failed validation: ${totalFiles - passedFiles}`);
  
  if (issues.length > 0) {
    console.warn('\n❌ Validation failed');
    process.exit(1);
  } else {
    console.warn('\n✅ All tests follow the new patterns!');
  }
}

validateTestPatterns().catch(console.error);