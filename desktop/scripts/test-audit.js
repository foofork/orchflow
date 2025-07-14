#!/usr/bin/env node

/**
 * Test Audit Script
 * 
 * Analyzes current test suite and provides recommendations for:
 * - Unit test candidates for migration to integration tests
 * - Missing test coverage areas
 * - Test quality metrics
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');
const srcDir = join(projectRoot, 'src');
const testResults = join(projectRoot, 'test-results');

// Ensure test results directory exists
import { mkdirSync } from 'fs';
try {
  mkdirSync(testResults, { recursive: true });
} catch (error) {
  // Directory might already exist
}

class TestAuditor {
  constructor() {
    this.unitTests = [];
    this.integrationTests = [];
    this.e2eTests = [];
    this.sourceFiles = [];
    this.testCoverage = {};
    this.auditResults = {
      summary: {},
      recommendations: [],
      migrationCandidates: [],
      qualityMetrics: {},
      coverageGaps: []
    };
  }

  async run() {
    console.warn('🔍 Starting test audit...');
    
    this.scanTestFiles();
    this.scanSourceFiles();
    this.analyzeTestDistribution();
    this.identifyMigrationCandidates();
    this.analyzeCoverageGaps();
    this.calculateQualityMetrics();
    this.generateRecommendations();
    this.outputResults();
    
    console.warn('✅ Test audit completed');
  }

  scanTestFiles() {
    console.warn('📂 Scanning test files...');
    
    const scanDirectory = (dir, category) => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            this.scanDirectory(fullPath, category);
          } else if (this.isTestFile(item)) {
            const testInfo = this.analyzeTestFile(fullPath, category);
            
            switch (category) {
              case 'unit':
                this.unitTests.push(testInfo);
                break;
              case 'integration':
                this.integrationTests.push(testInfo);
                break;
              case 'e2e':
                this.e2eTests.push(testInfo);
                break;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️  Warning: Could not scan directory ${dir}:`, error.message);
      }
    };

    // Scan different test categories
    scanDirectory(srcDir, 'unit');
    
    try {
      scanDirectory(join(projectRoot, 'tests/e2e'), 'e2e');
    } catch (error) {
      console.warn('ℹ️  No E2E tests directory found');
    }
  }

  scanSourceFiles() {
    console.warn('📂 Scanning source files...');
    
    const scanDirectory = (dir) => {
      try {
        const items = readdirSync(dir);
        
        for (const item of items) {
          const fullPath = join(dir, item);
          const stat = statSync(fullPath);
          
          if (stat.isDirectory()) {
            this.scanDirectory(fullPath);
          } else if (this.isSourceFile(item)) {
            this.sourceFiles.push(this.analyzeSourceFile(fullPath));
          }
        }
      } catch (error) {
        console.warn(`⚠️  Warning: Could not scan source directory ${dir}:`, error.message);
      }
    };

    scanDirectory(srcDir);
  }

  isTestFile(filename) {
    return /\.(test|spec)\.(js|ts)$/.test(filename);
  }

  isSourceFile(filename) {
    return /\.(js|ts|svelte)$/.test(filename) && !this.isTestFile(filename);
  }

  analyzeTestFile(filePath, category) {
    const content = readFileSync(filePath, 'utf8');
    const relativePath = filePath.replace(projectRoot, '');
    
    return {
      path: relativePath,
      category,
      size: content.length,
      testCount: this.countTests(content),
      hasAsyncTests: content.includes('async '),
      usesMocks: this.analyzeModuleDependencies(content),
      usesRealComponents: content.includes('render('),
      usesTauriAPI: content.includes('@tauri-apps'),
      complexity: this.calculateTestComplexity(content),
      integrationScore: this.calculateIntegrationScore(content)
    };
  }

  analyzeSourceFile(filePath) {
    const content = readFileSync(filePath, 'utf8');
    const relativePath = filePath.replace(projectRoot, '');
    
    return {
      path: relativePath,
      size: content.length,
      complexity: this.calculateSourceComplexity(content),
      hasTestFile: this.findCorrespondingTestFile(relativePath),
      dependencies: this.extractDependencies(content),
      isComponent: filePath.endsWith('.svelte'),
      isTauriIntegration: content.includes('@tauri-apps')
    };
  }

  countTests(content) {
    const testMatches = content.match(/\b(it|test)\s*\(/g);
    return testMatches ? testMatches.length : 0;
  }

  analyzeModuleDependencies(content) {
    const mocks = {
      viMocks: (content.match(/vi\.mock\(/g) || []).length,
      createMocks: (content.match(/createMock\./g) || []).length,
      mockRegistry: content.includes('mockRegistry'),
      tauriMocks: content.includes('tauriAPI')
    };
    
    return mocks;
  }

  calculateTestComplexity(content) {
    let complexity = 0;
    
    // Count complexity indicators
    complexity += (content.match(/\b(if|for|while|switch)\b/g) || []).length;
    complexity += (content.match(/\b(async|await)\b/g) || []).length * 0.5;
    complexity += (content.match(/\b(describe|it|test)\b/g) || []).length * 0.3;
    complexity += (content.match(/\b(expect|assert)\b/g) || []).length * 0.1;
    
    return Math.round(complexity);
  }

  calculateIntegrationScore(content) {
    let score = 0;
    
    // Indicators of integration test potential
    if (content.includes('render(')) score += 10;
    if (content.includes('@tauri-apps')) score += 15;
    if (content.includes('fireEvent')) score += 8;
    if (content.includes('waitFor')) score += 12;
    if (content.includes('multiple components')) score += 20;
    if (content.includes('real')) score += 5;
    
    return score;
  }

  calculateSourceComplexity(content) {
    let complexity = 0;
    
    complexity += (content.match(/\bfunction\b/g) || []).length * 2;
    complexity += (content.match(/\bclass\b/g) || []).length * 3;
    complexity += (content.match(/\b(if|for|while|switch)\b/g) || []).length;
    complexity += (content.match(/\b(async|await)\b/g) || []).length;
    
    return complexity;
  }

  findCorrespondingTestFile(sourcePath) {
    const testPath = sourcePath.replace(/\.(js|ts|svelte)$/, '.test.$1');
    const integrationTestPath = sourcePath.replace(/\.(js|ts|svelte)$/, '.integration.test.$1');
    
    const hasUnitTest = this.unitTests.some(test => test.path.includes(testPath));
    const hasIntegrationTest = this.integrationTests.some(test => test.path.includes(integrationTestPath));
    
    return {
      hasUnitTest,
      hasIntegrationTest,
      hasAnyTest: hasUnitTest || hasIntegrationTest
    };
  }

  extractDependencies(content) {
    const imports = content.match(/import .+ from ['"](.+)['"];?/g) || [];
    return imports.map(imp => {
      const match = imp.match(/from ['"](.+)['"];?/);
      return match ? match[1] : '';
    }).filter(Boolean);
  }

  analyzeTestDistribution() {
    const total = this.unitTests.length + this.integrationTests.length + this.e2eTests.length;
    
    this.auditResults.summary = {
      totalTests: total,
      unitTests: this.unitTests.length,
      integrationTests: this.integrationTests.length,
      e2eTests: this.e2eTests.length,
      unitPercentage: total > 0 ? Math.round((this.unitTests.length / total) * 100) : 0,
      integrationPercentage: total > 0 ? Math.round((this.integrationTests.length / total) * 100) : 0,
      e2ePercentage: total > 0 ? Math.round((this.e2eTests.length / total) * 100) : 0,
      targetDistribution: {
        unit: '60%',
        integration: '30%',
        e2e: '10%'
      }
    };
  }

  identifyMigrationCandidates() {
    console.warn('🔄 Identifying migration candidates...');
    
    // Find unit tests that should be integration tests
    const candidates = this.unitTests.filter(test => {
      return test.integrationScore > 20 || 
             (test.usesRealComponents && test.usesTauriAPI) ||
             test.complexity > 15;
    });

    this.auditResults.migrationCandidates = candidates.map(test => ({
      path: test.path,
      reason: this.getMigrationReason(test),
      integrationScore: test.integrationScore,
      complexity: test.complexity,
      priority: this.calculateMigrationPriority(test)
    }));
  }

  getMigrationReason(test) {
    const reasons = [];
    
    if (test.integrationScore > 20) reasons.push('High integration score');
    if (test.usesRealComponents) reasons.push('Uses real components');
    if (test.usesTauriAPI) reasons.push('Uses Tauri API');
    if (test.complexity > 15) reasons.push('High complexity');
    
    return reasons.join(', ');
  }

  calculateMigrationPriority(test) {
    let priority = 0;
    
    priority += test.integrationScore * 0.4;
    priority += test.complexity * 0.3;
    priority += test.testCount * 0.2;
    priority += (test.usesRealComponents ? 10 : 0);
    priority += (test.usesTauriAPI ? 15 : 0);
    
    if (priority > 30) return 'High';
    if (priority > 15) return 'Medium';
    return 'Low';
  }

  analyzeCoverageGaps() {
    console.warn('📊 Analyzing coverage gaps...');
    
    const untestedFiles = this.sourceFiles.filter(file => !file.hasTestFile.hasAnyTest);
    const complexFilesWithoutTests = this.sourceFiles.filter(file => 
      file.complexity > 10 && !file.hasTestFile.hasAnyTest
    );
    
    this.auditResults.coverageGaps = {
      untestedFiles: untestedFiles.length,
      untestedFilePaths: untestedFiles.map(f => f.path),
      complexUntested: complexFilesWithoutTests.length,
      complexUntestedPaths: complexFilesWithoutTests.map(f => f.path),
      totalSourceFiles: this.sourceFiles.length,
      coveragePercentage: Math.round(
        ((this.sourceFiles.length - untestedFiles.length) / this.sourceFiles.length) * 100
      )
    };
  }

  calculateQualityMetrics() {
    console.warn('📈 Calculating quality metrics...');
    
    const totalTests = this.unitTests.length + this.integrationTests.length + this.e2eTests.length;
    const avgTestComplexity = totalTests > 0 ? 
      [...this.unitTests, ...this.integrationTests].reduce((sum, test) => sum + test.complexity, 0) / totalTests : 0;
    
    const testFileRatio = this.sourceFiles.length > 0 ? totalTests / this.sourceFiles.length : 0;
    
    this.auditResults.qualityMetrics = {
      testFileRatio: Math.round(testFileRatio * 100) / 100,
      averageTestComplexity: Math.round(avgTestComplexity * 100) / 100,
      averageTestsPerFile: totalTests > 0 ? 
        Math.round((this.unitTests.reduce((sum, test) => sum + test.testCount, 0) / totalTests) * 100) / 100 : 0,
      mockUsagePercentage: this.calculateMockUsage(),
      highComplexityTests: [...this.unitTests, ...this.integrationTests].filter(test => test.complexity > 20).length
    };
  }

  calculateMockUsage() {
    const testsWithMocks = [...this.unitTests, ...this.integrationTests].filter(test => 
      test.usesMocks.viMocks > 0 || test.usesMocks.createMocks > 0
    );
    
    const totalTests = this.unitTests.length + this.integrationTests.length;
    return totalTests > 0 ? Math.round((testsWithMocks.length / totalTests) * 100) : 0;
  }

  generateRecommendations() {
    // Generating recommendations (removed console.log)
    
    const recommendations = [];
    
    // Test distribution recommendations
    const { unitPercentage, integrationPercentage, e2ePercentage } = this.auditResults.summary;
    
    if (integrationPercentage < 25) {
      recommendations.push({
        type: 'distribution',
        priority: 'High',
        title: 'Increase Integration Test Coverage',
        description: `Current integration test coverage is ${integrationPercentage}%. Target is 30%. Consider migrating ${this.auditResults.migrationCandidates.length} unit tests to integration tests.`,
        actionItems: [
          'Migrate high-scoring unit tests to integration tests',
          'Add integration tests for Tauri API interactions',
          'Create cross-component workflow tests'
        ]
      });
    }

    if (e2ePercentage < 5 && this.e2eTests.length < 5) {
      recommendations.push({
        type: 'e2e',
        priority: 'Medium',
        title: 'Add End-to-End Tests',
        description: 'E2E test coverage is low. Add tests for critical user journeys.',
        actionItems: [
          'Implement user journey tests for core workflows',
          'Add error handling and recovery tests',
          'Test cross-browser compatibility'
        ]
      });
    }

    // Coverage gap recommendations
    if (this.auditResults.coverageGaps.coveragePercentage < 80) {
      recommendations.push({
        type: 'coverage',
        priority: 'High',
        title: 'Improve Test Coverage',
        description: `Test coverage is ${this.auditResults.coverageGaps.coveragePercentage}%. ${this.auditResults.coverageGaps.untestedFiles} files lack tests.`,
        actionItems: [
          'Add tests for untested source files',
          'Focus on complex files without tests',
          'Implement integration tests for Tauri components'
        ]
      });
    }

    // Quality recommendations
    if (this.auditResults.qualityMetrics.mockUsagePercentage < 50) {
      recommendations.push({
        type: 'quality',
        priority: 'Medium',
        title: 'Improve Mock Usage',
        description: `Only ${this.auditResults.qualityMetrics.mockUsagePercentage}% of tests use mocks. Consider using MockRegistry for better test isolation.`,
        actionItems: [
          'Migrate to centralized MockRegistry',
          'Add mock decorators for timing and logging',
          'Implement snapshot functionality for test isolation'
        ]
      });
    }

    this.auditResults.recommendations = recommendations;
  }

  outputResults() {
    const reportPath = join(testResults, 'test-audit-report.json');
    const humanReadablePath = join(testResults, 'test-audit-report.md');
    
    // Write JSON report
    writeFileSync(reportPath, JSON.stringify(this.auditResults, null, 2));
    
    // Write human-readable report
    const markdownReport = this.generateMarkdownReport();
    writeFileSync(humanReadablePath, markdownReport);
    
    // Audit reports written to: ${reportPath} and ${humanReadablePath}
    
    // Output summary to console
    this.printSummary();
  }

  generateMarkdownReport() {
    const { summary, recommendations, migrationCandidates, qualityMetrics, coverageGaps } = this.auditResults;
    
    return `# Test Suite Audit Report

## Summary

- **Total Tests**: ${summary.totalTests}
- **Unit Tests**: ${summary.unitTests} (${summary.unitPercentage}%)
- **Integration Tests**: ${summary.integrationTests} (${summary.integrationPercentage}%)
- **E2E Tests**: ${summary.e2eTests} (${summary.e2ePercentage}%)

### Target Distribution
- Unit: ${summary.targetDistribution.unit}
- Integration: ${summary.targetDistribution.integration}
- E2E: ${summary.targetDistribution.e2e}

## Quality Metrics

- **Test File Ratio**: ${qualityMetrics.testFileRatio}
- **Average Test Complexity**: ${qualityMetrics.averageTestComplexity}
- **Mock Usage**: ${qualityMetrics.mockUsagePercentage}%
- **Coverage**: ${coverageGaps.coveragePercentage}%

## Migration Candidates

${migrationCandidates.length} unit tests identified for migration to integration tests:

${migrationCandidates.map(candidate => 
  `- **${candidate.path}** (${candidate.priority} priority)
    - Reason: ${candidate.reason}
    - Integration Score: ${candidate.integrationScore}
    - Complexity: ${candidate.complexity}`
).join('\n')}

## Coverage Gaps

- **Untested Files**: ${coverageGaps.untestedFiles}
- **Complex Untested Files**: ${coverageGaps.complexUntested}

### Files Needing Tests:
${coverageGaps.untestedFilePaths.slice(0, 10).map(path => `- ${path}`).join('\n')}
${coverageGaps.untestedFilePaths.length > 10 ? `\n... and ${coverageGaps.untestedFilePaths.length - 10} more` : ''}

## Recommendations

${recommendations.map((rec, index) => 
  `### ${index + 1}. ${rec.title} (${rec.priority} Priority)

${rec.description}

**Action Items:**
${rec.actionItems.map(item => `- ${item}`).join('\n')}
`).join('\n')}

---
*Generated on ${new Date().toISOString()}*
`;
  }

  printSummary() {
    const { summary, recommendations, migrationCandidates, coverageGaps } = this.auditResults;
    
    // Output test audit summary to file instead of console
    const summaryOutput = [
      '\n📊 TEST AUDIT SUMMARY',
      '=====================',
      `Total Tests: ${summary.totalTests}`,
      `  Unit: ${summary.unitTests} (${summary.unitPercentage}%)`,
      `  Integration: ${summary.integrationTests} (${summary.integrationPercentage}%)`,
      `  E2E: ${summary.e2eTests} (${summary.e2ePercentage}%)`,
      `\nCoverage: ${coverageGaps.coveragePercentage}%`,
      `Migration Candidates: ${migrationCandidates.length}`,
      `Recommendations: ${recommendations.length}`
    ].join('\n');
    
    if (recommendations.length > 0) {
      console.warn('\n🚨 TOP RECOMMENDATIONS:');
      recommendations.slice(0, 3).forEach((rec, index) => {
        console.warn(`${index + 1}. ${rec.title} (${rec.priority})`);
      });
    }
  }
}

// Run the audit
const auditor = new TestAuditor();
auditor.run().catch(error => {
  console.error('❌ Test audit failed:', error);
  process.exit(1);
});