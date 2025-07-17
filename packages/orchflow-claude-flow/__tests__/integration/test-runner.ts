/**
 * Integration Test Runner
 * Runs all integration tests in the correct order and provides comprehensive reporting
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

interface TestResult {
  testFile: string;
  passed: boolean;
  duration: number;
  errors: string[];
  warnings: string[];
}

interface TestSuite {
  name: string;
  file: string;
  dependencies: string[];
  description: string;
}

const testSuites: TestSuite[] = [
  {
    name: 'Unified Setup',
    file: 'unified-setup.test.ts',
    dependencies: [],
    description: 'Tests UnifiedSetupOrchestrator with both CLI entry points'
  },
  {
    name: 'Tmux Wiring',
    file: 'tmux-wiring.test.ts',
    dependencies: ['unified-setup'],
    description: 'Tests TmuxInstaller wiring and fallback mechanisms'
  },
  {
    name: 'MCP Registration',
    file: 'mcp-registration.test.ts',
    dependencies: ['unified-setup'],
    description: 'Tests MCP tool registration through public API'
  },
  {
    name: 'Manager Consolidation',
    file: 'manager-consolidation.test.ts',
    dependencies: ['unified-setup', 'mcp-registration'],
    description: 'Tests consolidated managers working together'
  }
];

class IntegrationTestRunner {
  private results: TestResult[] = [];
  private startTime: number = 0;
  private totalTime: number = 0;

  async runAllTests(): Promise<void> {
    console.log(chalk.cyan('🧪 OrchFlow Integration Test Suite'));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
    console.log('');

    this.startTime = Date.now();
    
    // Run tests in dependency order
    const sortedTests = this.sortTestsByDependencies();
    
    for (const testSuite of sortedTests) {
      await this.runTestSuite(testSuite);
    }
    
    this.totalTime = Date.now() - this.startTime;
    
    this.displayResults();
  }

  private sortTestsByDependencies(): TestSuite[] {
    const sorted: TestSuite[] = [];
    const visited = new Set<string>();
    
    const visit = (testSuite: TestSuite) => {
      if (visited.has(testSuite.name)) return;
      
      for (const dep of testSuite.dependencies) {
        const depSuite = testSuites.find(s => s.name.toLowerCase().includes(dep));
        if (depSuite && !visited.has(depSuite.name)) {
          visit(depSuite);
        }
      }
      
      visited.add(testSuite.name);
      sorted.push(testSuite);
    };
    
    for (const testSuite of testSuites) {
      visit(testSuite);
    }
    
    return sorted;
  }

  private async runTestSuite(testSuite: TestSuite): Promise<void> {
    console.log(chalk.yellow(`🔍 Running ${testSuite.name} Tests`));
    console.log(chalk.gray(`   ${testSuite.description}`));
    
    const testFilePath = join(__dirname, testSuite.file);
    
    if (!existsSync(testFilePath)) {
      console.log(chalk.red(`❌ Test file not found: ${testSuite.file}`));
      this.results.push({
        testFile: testSuite.file,
        passed: false,
        duration: 0,
        errors: [`Test file not found: ${testFilePath}`],
        warnings: []
      });
      return;
    }
    
    const startTime = Date.now();
    const result = await this.runJestTest(testFilePath);
    const duration = Date.now() - startTime;
    
    this.results.push({
      testFile: testSuite.file,
      passed: result.passed,
      duration,
      errors: result.errors,
      warnings: result.warnings
    });
    
    if (result.passed) {
      console.log(chalk.green(`✅ ${testSuite.name} tests passed (${duration}ms)`));
    } else {
      console.log(chalk.red(`❌ ${testSuite.name} tests failed (${duration}ms)`));
      if (result.errors.length > 0) {
        console.log(chalk.red('   Errors:'));
        result.errors.forEach(error => {
          console.log(chalk.red(`     • ${error}`));
        });
      }
    }
    
    console.log('');
  }

  private async runJestTest(testFile: string): Promise<{
    passed: boolean;
    errors: string[];
    warnings: string[];
  }> {
    return new Promise((resolve) => {
      const jest = spawn('npx', ['jest', testFile, '--verbose'], {
        cwd: process.cwd(),
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';
      const errors: string[] = [];
      const warnings: string[] = [];

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        // Parse Jest output for errors and warnings
        const lines = (stdout + stderr).split('\n');
        
        for (const line of lines) {
          if (line.includes('FAIL') || line.includes('Error:') || line.includes('Failed:')) {
            errors.push(line.trim());
          } else if (line.includes('Warning:') || line.includes('WARN')) {
            warnings.push(line.trim());
          }
        }

        resolve({
          passed: code === 0,
          errors,
          warnings
        });
      });

      jest.on('error', (error) => {
        resolve({
          passed: false,
          errors: [error.message],
          warnings: []
        });
      });
    });
  }

  private displayResults(): void {
    console.log(chalk.cyan('📊 Integration Test Results'));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    
    console.log(`${chalk.green('✅ Passed:')} ${passed}/${total}`);
    console.log(`${chalk.red('❌ Failed:')} ${failed}/${total}`);
    console.log(`${chalk.yellow('⏱️  Total Time:')} ${this.totalTime}ms`);
    console.log('');
    
    // Detailed results
    console.log(chalk.cyan('📋 Detailed Results:'));
    console.log('');
    
    this.results.forEach((result, index) => {
      const status = result.passed ? 
        chalk.green('✅ PASS') : 
        chalk.red('❌ FAIL');
      
      console.log(`${index + 1}. ${status} ${result.testFile} (${result.duration}ms)`);
      
      if (result.errors.length > 0) {
        console.log(chalk.red('   Errors:'));
        result.errors.slice(0, 3).forEach(error => {
          console.log(chalk.red(`     • ${error.substring(0, 80)}...`));
        });
        
        if (result.errors.length > 3) {
          console.log(chalk.red(`     ... and ${result.errors.length - 3} more errors`));
        }
      }
      
      if (result.warnings.length > 0) {
        console.log(chalk.yellow('   Warnings:'));
        result.warnings.slice(0, 2).forEach(warning => {
          console.log(chalk.yellow(`     • ${warning.substring(0, 80)}...`));
        });
      }
    });
    
    console.log('');
    
    // Summary
    if (failed === 0) {
      console.log(chalk.green('🎉 All integration tests passed!'));
      console.log(chalk.green('✅ OrchFlow components are properly integrated'));
    } else {
      console.log(chalk.red(`💥 ${failed} integration test${failed > 1 ? 's' : ''} failed`));
      console.log(chalk.yellow('⚠️  Some OrchFlow components may not be properly integrated'));
    }
    
    console.log('');
    console.log(chalk.cyan('📝 Integration Test Coverage:'));
    console.log('   • UnifiedSetupOrchestrator CLI entry points');
    console.log('   • TmuxInstaller wiring and fallback mechanisms');
    console.log('   • MCP tool registration through public API');
    console.log('   • Consolidated manager interactions');
    console.log('   • Cross-component data flow');
    console.log('   • Error handling and recovery');
    console.log('   • Performance under load');
    console.log('');
  }

  async runSingleTest(testName: string): Promise<void> {
    const testSuite = testSuites.find(s => 
      s.name.toLowerCase().includes(testName.toLowerCase()) ||
      s.file.toLowerCase().includes(testName.toLowerCase())
    );
    
    if (!testSuite) {
      console.log(chalk.red(`❌ Test suite not found: ${testName}`));
      console.log(chalk.yellow('Available test suites:'));
      testSuites.forEach(suite => {
        console.log(`   • ${suite.name} (${suite.file})`);
      });
      return;
    }
    
    console.log(chalk.cyan(`🧪 Running Single Test: ${testSuite.name}`));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
    console.log('');
    
    this.startTime = Date.now();
    await this.runTestSuite(testSuite);
    this.totalTime = Date.now() - this.startTime;
    
    this.displayResults();
  }

  async validateTestEnvironment(): Promise<boolean> {
    console.log(chalk.cyan('🔍 Validating Test Environment'));
    console.log(chalk.cyan('═══════════════════════════════════════════════════════════'));
    
    const validations = [
      {
        name: 'Jest installation',
        check: () => this.checkCommand('npx jest --version')
      },
      {
        name: 'Test files exist',
        check: () => this.checkTestFiles()
      },
      {
        name: 'TypeScript compilation',
        check: () => this.checkCommand('npx tsc --noEmit')
      },
      {
        name: 'Node.js version',
        check: () => this.checkNodeVersion()
      }
    ];
    
    let allValid = true;
    
    for (const validation of validations) {
      const result = await validation.check();
      if (result) {
        console.log(chalk.green(`✅ ${validation.name}`));
      } else {
        console.log(chalk.red(`❌ ${validation.name}`));
        allValid = false;
      }
    }
    
    console.log('');
    
    if (allValid) {
      console.log(chalk.green('🎉 Test environment is ready!'));
    } else {
      console.log(chalk.red('💥 Test environment has issues'));
    }
    
    return allValid;
  }

  private async checkCommand(command: string): Promise<boolean> {
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { stdio: 'pipe' });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });
      
      child.on('error', () => {
        resolve(false);
      });
    });
  }

  private checkTestFiles(): boolean {
    return testSuites.every(suite => 
      existsSync(join(__dirname, suite.file))
    );
  }

  private checkNodeVersion(): boolean {
    const version = process.version;
    const major = parseInt(version.split('.')[0].substring(1));
    return major >= 16;
  }
}

// CLI interface
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    runner.runAllTests();
  } else if (args[0] === '--validate') {
    runner.validateTestEnvironment();
  } else if (args[0] === '--test') {
    if (args[1]) {
      runner.runSingleTest(args[1]);
    } else {
      console.log(chalk.red('❌ Please specify a test name'));
    }
  } else {
    console.log(chalk.yellow('Usage:'));
    console.log('  npm run test:integration          # Run all tests');
    console.log('  npm run test:integration --validate # Validate environment');
    console.log('  npm run test:integration --test <name> # Run specific test');
  }
}

export { IntegrationTestRunner, TestResult, TestSuite };