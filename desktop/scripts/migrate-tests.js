#!/usr/bin/env node

/**
 * Test Migration Script
 * 
 * Automatically migrates unit tests to integration tests based on
 * audit recommendations and predefined criteria.
 */

import { readFileSync, writeFileSync, copyFileSync, unlinkSync, existsSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const testResults = join(projectRoot, 'test-results');

class TestMigrator {
  constructor() {
    this.migrationQueue = [];
    this.migrationResults = {
      migrated: [],
      failed: [],
      skipped: [],
      summary: {}
    };
    this.dryRun = process.argv.includes('--dry-run');
    this.force = process.argv.includes('--force');
  }

  async run() {
    console.log(`🔄 Starting test migration${this.dryRun ? ' (DRY RUN)' : ''}...`);
    
    await this.loadMigrationCandidates();
    await this.planMigrations();
    await this.executeMigrations();
    this.generateReport();
    
    console.log('✅ Test migration completed');
  }

  async loadMigrationCandidates() {
    console.log('📋 Loading migration candidates...');
    
    // Try to load from audit report first
    const auditReportPath = join(testResults, 'test-audit-report.json');
    
    if (existsSync(auditReportPath)) {
      try {
        const auditReport = JSON.parse(readFileSync(auditReportPath, 'utf8'));
        this.migrationQueue = auditReport.migrationCandidates || [];
        console.log(`📊 Loaded ${this.migrationQueue.length} candidates from audit report`);
      } catch (error) {
        console.warn('⚠️  Could not load audit report, performing manual analysis...');
        await this.performManualAnalysis();
      }
    } else {
      console.log('ℹ️  No audit report found, performing manual analysis...');
      await this.performManualAnalysis();
    }
  }

  async performManualAnalysis() {
    // Manual analysis logic similar to the auditor
    const testFiles = this.findTestFiles(srcDir);
    
    for (const testFile of testFiles) {
      const content = readFileSync(testFile, 'utf8');
      const score = this.calculateIntegrationScore(content);
      
      if (score > 20) {
        this.migrationQueue.push({
          path: testFile.replace(projectRoot, ''),
          reason: 'High integration score from manual analysis',
          integrationScore: score,
          priority: score > 30 ? 'High' : 'Medium'
        });
      }
    }
    
    console.log(`🔍 Manual analysis found ${this.migrationQueue.length} candidates`);
  }

  findTestFiles(dir) {
    const testFiles = [];
    const fs = require('fs');
    
    function scanDir(currentDir) {
      try {
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
          const fullPath = join(currentDir, item);
          const stat = fs.statSync(fullPath);
          
          if (stat.isDirectory()) {
            scanDir(fullPath);
          } else if (item.endsWith('.test.ts') || item.endsWith('.test.js')) {
            // Skip files that are already integration tests
            if (!item.includes('.integration.')) {
              testFiles.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan directory ${currentDir}`);
      }
    }
    
    scanDir(dir);
    return testFiles;
  }

  calculateIntegrationScore(content) {
    let score = 0;
    
    // Indicators of integration test potential
    if (content.includes('render(')) score += 10;
    if (content.includes('@tauri-apps')) score += 15;
    if (content.includes('fireEvent')) score += 8;
    if (content.includes('waitFor')) score += 12;
    if (content.includes('tauriAPI')) score += 15;
    if (content.includes('fileSystemMock')) score += 10;
    if (content.includes('terminalMock')) score += 10;
    if (content.includes('multiple components')) score += 20;
    
    // Check for complex interactions
    const complexityIndicators = [
      'invoke(',
      'Command(',
      'readFile(',
      'writeFile(',
      'createDir(',
      'spawn(',
      'execute('
    ];
    
    complexityIndicators.forEach(indicator => {
      if (content.includes(indicator)) score += 5;
    });
    
    return score;
  }

  async planMigrations() {
    console.log('📋 Planning migrations...');
    
    // Sort by priority and integration score
    this.migrationQueue.sort((a, b) => {
      const priorityWeight = { 'High': 3, 'Medium': 2, 'Low': 1 };
      const priorityDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
      
      if (priorityDiff !== 0) return priorityDiff;
      return b.integrationScore - a.integrationScore;
    });

    // Filter out candidates that already have integration tests
    this.migrationQueue = this.migrationQueue.filter(candidate => {
      const integrationTestPath = this.getIntegrationTestPath(candidate.path);
      const exists = existsSync(join(projectRoot, integrationTestPath));
      
      if (exists && !this.force) {
        this.migrationResults.skipped.push({
          ...candidate,
          reason: 'Integration test already exists'
        });
        return false;
      }
      
      return true;
    });

    console.log(`📊 Planned ${this.migrationQueue.length} migrations`);
    
    if (this.migrationQueue.length > 0) {
      console.log('\nMigration Plan:');
      this.migrationQueue.forEach((candidate, index) => {
        console.log(`${index + 1}. ${candidate.path} (${candidate.priority})`);
        console.log(`   Reason: ${candidate.reason}`);
        console.log(`   Score: ${candidate.integrationScore}`);
      });
    }
  }

  getIntegrationTestPath(unitTestPath) {
    return unitTestPath.replace('.test.', '.integration.test.');
  }

  async executeMigrations() {
    if (this.migrationQueue.length === 0) {
      console.log('ℹ️  No migrations to execute');
      return;
    }

    console.log(`🚀 Executing ${this.migrationQueue.length} migrations...`);
    
    for (const candidate of this.migrationQueue) {
      try {
        await this.migrateTest(candidate);
      } catch (error) {
        console.error(`❌ Failed to migrate ${candidate.path}:`, error.message);
        this.migrationResults.failed.push({
          ...candidate,
          error: error.message
        });
      }
    }
  }

  async migrateTest(candidate) {
    const originalPath = join(projectRoot, candidate.path);
    const integrationPath = join(projectRoot, this.getIntegrationTestPath(candidate.path));
    
    console.log(`🔄 Migrating ${candidate.path}...`);
    
    if (!existsSync(originalPath)) {
      throw new Error(`Original test file not found: ${originalPath}`);
    }

    const originalContent = readFileSync(originalPath, 'utf8');
    const migratedContent = this.transformToIntegrationTest(originalContent, candidate);
    
    if (this.dryRun) {
      console.log(`📝 [DRY RUN] Would create: ${integrationPath}`);
      this.migrationResults.migrated.push({
        ...candidate,
        originalPath,
        integrationPath,
        dryRun: true
      });
      return;
    }

    // Write the new integration test
    writeFileSync(integrationPath, migratedContent);
    
    // Optionally remove or comment out the original test
    if (this.force) {
      this.handleOriginalTest(originalPath, originalContent);
    }
    
    this.migrationResults.migrated.push({
      ...candidate,
      originalPath,
      integrationPath
    });
    
    console.log(`✅ Migrated: ${candidate.path} -> ${this.getIntegrationTestPath(candidate.path)}`);
  }

  transformToIntegrationTest(content, candidate) {
    let transformed = content;
    
    // Update imports for integration testing
    if (!transformed.includes('setup-integration')) {
      transformed = transformed.replace(
        /import.*from.*['"]\.\.?\/test\/setup['"];?\n/,
        `import { tauriAPI, fileSystemMock, terminalMock, storeMocks } from '../test/setup-integration';\n`
      );
    }

    // Add integration test imports if not present
    if (!transformed.includes('mockRegistry')) {
      const importLine = `import { mockRegistry, createMock } from '../test/utils/mock-registry';\n`;
      transformed = importLine + transformed;
    }

    // Update describe block to indicate integration test
    transformed = transformed.replace(
      /describe\s*\(\s*['"`]([^'"`]+)['"`]/,
      `describe('$1 - Integration Test'`
    );

    // Add integration test setup
    const setupCode = `
  beforeEach(() => {
    mockRegistry.reset();
    fileSystemMock._clear();
  });

  afterEach(() => {
    mockRegistry.clearCalls();
  });
`;

    // Insert setup after the first describe block
    transformed = transformed.replace(
      /(describe\s*\([^{]+\{\s*)/,
      `$1${setupCode}\n`
    );

    // Replace simple mocks with integration mocks where appropriate
    transformed = this.updateMockUsage(transformed);
    
    // Add integration test patterns
    transformed = this.addIntegrationPatterns(transformed, candidate);

    // Add header comment
    const header = `/**
 * Integration Test - Migrated from Unit Test
 * 
 * Original: ${candidate.path}
 * Migrated: ${new Date().toISOString()}
 * Reason: ${candidate.reason}
 * Integration Score: ${candidate.integrationScore}
 */

`;

    return header + transformed;
  }

  updateMockUsage(content) {
    let updated = content;
    
    // Replace vi.mock with integration mocks where appropriate
    updated = updated.replace(
      /vi\.mock\s*\(\s*['"`]@tauri-apps\/api['"`][^}]+\}/gs,
      '// Using integration setup for Tauri API mocks'
    );
    
    // Update mock function calls to use mockRegistry
    updated = updated.replace(
      /const\s+(\w+)\s*=\s*vi\.fn\(\)/g,
      'const $1 = createMock.function(\'$1\')'
    );

    return updated;
  }

  addIntegrationPatterns(content, candidate) {
    let enhanced = content;
    
    // If the test involves file operations, ensure it uses fileSystemMock
    if (enhanced.includes('readFile') || enhanced.includes('writeFile')) {
      enhanced = enhanced.replace(
        /(it\s*\(\s*['"`][^'"`]*file[^'"`]*['"`][^{]*\{)/i,
        `$1
    // Setup test files
    fileSystemMock._setFile('/test/sample.txt', 'test content');
`
      );
    }

    // If the test involves terminal operations, ensure it uses terminalMock
    if (enhanced.includes('Command') || enhanced.includes('execute')) {
      enhanced = enhanced.replace(
        /(it\s*\(\s*['"`][^'"`]*command[^'"`]*['"`][^{]*\{)/i,
        `$1
    // Setup terminal mock
    const terminal = terminalMock.spawn();
`
      );
    }

    // Add waitFor patterns for async operations
    if (enhanced.includes('async') && !enhanced.includes('waitFor')) {
      enhanced = enhanced.replace(
        /expect\s*\(\s*([^)]+)\s*\)\s*\.(toBe|toEqual|toContain)/g,
        `await waitFor(() => {
      expect($1).$2`
      );
    }

    return enhanced;
  }

  handleOriginalTest(originalPath, originalContent) {
    // Create a backup
    const backupPath = originalPath + '.backup';
    writeFileSync(backupPath, originalContent);
    
    // Comment out the original test
    const commentedContent = originalContent
      .split('\n')
      .map(line => line.trim() ? `// MIGRATED: ${line}` : line)
      .join('\n');
    
    const migrationNotice = `/**
 * MIGRATED TO INTEGRATION TEST
 * 
 * This unit test has been migrated to an integration test.
 * See the corresponding .integration.test file.
 * 
 * Backup created at: ${basename(backupPath)}
 * Migration date: ${new Date().toISOString()}
 */

`;

    writeFileSync(originalPath, migrationNotice + commentedContent);
  }

  generateReport() {
    const reportPath = join(testResults, 'test-migration-report.json');
    
    this.migrationResults.summary = {
      totalCandidates: this.migrationQueue.length,
      migrated: this.migrationResults.migrated.length,
      failed: this.migrationResults.failed.length,
      skipped: this.migrationResults.skipped.length,
      dryRun: this.dryRun,
      timestamp: new Date().toISOString()
    };

    writeFileSync(reportPath, JSON.stringify(this.migrationResults, null, 2));
    
    console.log(`📊 Migration report written to: ${reportPath}`);
    
    // Print summary
    console.log('\n📊 MIGRATION SUMMARY');
    console.log('===================');
    console.log(`Total Candidates: ${this.migrationResults.summary.totalCandidates}`);
    console.log(`✅ Migrated: ${this.migrationResults.summary.migrated}`);
    console.log(`❌ Failed: ${this.migrationResults.summary.failed}`);
    console.log(`⏭️  Skipped: ${this.migrationResults.summary.skipped}`);
    
    if (this.migrationResults.failed.length > 0) {
      console.log('\n❌ FAILED MIGRATIONS:');
      this.migrationResults.failed.forEach(failure => {
        console.log(`- ${failure.path}: ${failure.error}`);
      });
    }
    
    if (this.migrationResults.migrated.length > 0) {
      console.log('\n✅ SUCCESSFUL MIGRATIONS:');
      this.migrationResults.migrated.forEach(migration => {
        console.log(`- ${migration.path} -> ${this.getIntegrationTestPath(migration.path)}`);
      });
    }

    // Generate next steps
    this.generateNextSteps();
  }

  generateNextSteps() {
    const nextStepsPath = join(testResults, 'migration-next-steps.md');
    
    const nextSteps = `# Test Migration Next Steps

## Migration Summary
- **Migrated**: ${this.migrationResults.summary.migrated} tests
- **Failed**: ${this.migrationResults.summary.failed} tests  
- **Skipped**: ${this.migrationResults.summary.skipped} tests

## Recommended Actions

### 1. Update Test Scripts
Add the new integration tests to your CI pipeline:
\`\`\`bash
npm run test:integration
\`\`\`

### 2. Review Migrated Tests
Check that the migrated integration tests work correctly:
${this.migrationResults.migrated.map(m => `- ${this.getIntegrationTestPath(m.path)}`).join('\n')}

### 3. Update Test Distribution
Current test distribution after migration:
- Unit tests: Reduced by ${this.migrationResults.summary.migrated}
- Integration tests: Increased by ${this.migrationResults.summary.migrated}

### 4. Handle Failed Migrations
${this.migrationResults.failed.length > 0 ? 
  `Review and manually migrate these failed tests:\n${this.migrationResults.failed.map(f => `- ${f.path}: ${f.error}`).join('\n')}` :
  'No failed migrations - all tests migrated successfully!'
}

### 5. Run Full Test Suite
Verify all tests pass after migration:
\`\`\`bash
npm run test:quality
\`\`\`

### 6. Update Documentation
Update your testing documentation to reflect the new test structure.

---
*Generated on ${new Date().toISOString()}*
`;

    writeFileSync(nextStepsPath, nextSteps);
    console.log(`📋 Next steps written to: ${nextStepsPath}`);
  }
}

// Run the migrator
const migrator = new TestMigrator();
migrator.run().catch(error => {
  console.error('❌ Test migration failed:', error);
  process.exit(1);
});