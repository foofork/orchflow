#!/usr/bin/env node
/**
 * Performance CLI Tool
 * Command-line interface for performance optimization and monitoring
 */

import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { SetupOptimizer } from './setup-optimizer';
import { PerformanceMonitor, PerformanceBenchmark } from './performance-monitor';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getOrchFlowHome } from '../utils';

interface PerformanceOptions {
  iterations?: number;
  duration?: number;
  output?: string;
  verbose?: boolean;
  watch?: boolean;
  targets?: string;
}

/**
 * Performance CLI implementation
 */
class PerformanceCLI {
  private optimizer: SetupOptimizer;
  private monitor: PerformanceMonitor;
  private benchmark: PerformanceBenchmark;

  constructor() {
    this.optimizer = new SetupOptimizer();
    this.monitor = new PerformanceMonitor();
    this.benchmark = new PerformanceBenchmark(100);
  }

  /**
   * Run performance optimization
   */
  async optimize(options: PerformanceOptions): Promise<void> {
    const spinner = ora('Optimizing setup performance...').start();

    try {
      await this.optimizer.optimizeSetup();
      spinner.succeed('Setup optimization completed');

      // Run benchmark to verify improvements
      const results = await this.optimizer.runBenchmark();

      console.log(chalk.green('\n✅ Optimization Results:'));
      console.log(chalk.cyan(`Setup Detection: ${results.setupDetection.toFixed(2)}ms`));
      console.log(chalk.cyan(`Config Loading: ${results.configLoading.toFixed(2)}ms`));
      console.log(chalk.cyan(`User Interaction: ${results.userInteraction.toFixed(2)}ms`));
      console.log(chalk.cyan(`Memory Footprint: ${results.memoryFootprint.toFixed(2)}MB`));

      // Generate full report if requested
      if (options.output) {
        const report = await this.optimizer.generateOptimizationReport();
        writeFileSync(options.output, report);
        console.log(chalk.green(`\n📊 Report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail('Optimization failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Run performance benchmark
   */
  async runBenchmark(options: PerformanceOptions): Promise<void> {
    const iterations = options.iterations || 100;
    const spinner = ora(`Running benchmark with ${iterations} iterations...`).start();

    try {
      this.benchmark = new PerformanceBenchmark(iterations);
      await this.benchmark.runBenchmark();

      spinner.succeed('Benchmark completed');

      const report = this.benchmark.generateReport();
      console.log(report);

      if (options.output) {
        writeFileSync(options.output, report);
        console.log(chalk.green(`\n📊 Benchmark report saved to: ${options.output}`));
      }

    } catch (error) {
      spinner.fail('Benchmark failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Start performance monitoring
   */
  async startMonitoring(options: PerformanceOptions): Promise<void> {
    const duration = options.duration || 60; // Default 1 minute
    const interval = 5000; // 5 seconds

    console.log(chalk.cyan(`📊 Starting performance monitoring for ${duration} seconds...`));

    // Setup event handlers
    this.monitor.on('snapshot', (snapshot) => {
      if (options.verbose) {
        console.log(chalk.gray(`[${snapshot.timestamp.toISOString()}] Snapshot captured`));
      }
    });

    this.monitor.on('alert', (alert) => {
      const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
      const color = alert.level === 'critical' ? chalk.red : chalk.yellow;

      console.log(color(`${emoji} ${alert.metric}: ${alert.value.toFixed(2)} (threshold: ${alert.threshold})`));
    });

    // Start monitoring
    this.monitor.start(interval);

    // Stop after duration
    setTimeout(() => {
      this.monitor.stop();

      const report = this.monitor.generateReport();
      console.log(report);

      if (options.output) {
        const filepath = this.monitor.saveToFile(options.output);
        console.log(chalk.green(`\n📊 Monitoring data saved to: ${filepath}`));
      }

      process.exit(0);
    }, duration * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n📊 Stopping monitoring...'));
      this.monitor.stop();
      process.exit(0);
    });
  }

  /**
   * Watch performance in real-time
   */
  async watchPerformance(options: PerformanceOptions): Promise<void> {
    console.log(chalk.cyan('👁️  Starting real-time performance watch...'));
    console.log(chalk.gray('Press Ctrl+C to stop\n'));

    let updateCount = 0;
    const maxLines = 20;

    this.monitor.on('snapshot', (_snapshot) => {
      // Clear previous output
      if (updateCount > 0) {
        process.stdout.write(`\x1b[${  maxLines  }A`); // Move cursor up
        process.stdout.write('\x1b[J'); // Clear from cursor down
      }

      const stats = this.monitor.getStatistics();
      if (stats) {
        console.log(chalk.bold('📊 Real-time Performance Monitor'));
        console.log(chalk.gray('='.repeat(40)));
        console.log(chalk.cyan(`Setup Detection: ${stats.setupDetection.current.toFixed(2)}ms ${this.getTrendIcon(stats.setupDetection.trend)}`));
        console.log(chalk.cyan(`Config Loading: ${stats.configLoading.current.toFixed(2)}ms ${this.getTrendIcon(stats.configLoading.trend)}`));
        console.log(chalk.cyan(`User Interaction: ${stats.userInteraction.current.toFixed(2)}ms ${this.getTrendIcon(stats.userInteraction.trend)}`));
        console.log(chalk.cyan(`Memory Footprint: ${stats.memoryFootprint.current.toFixed(2)}MB ${this.getTrendIcon(stats.memoryFootprint.trend)}`));
        console.log(chalk.cyan(`CPU Usage: ${stats.cpuUsage.current.toFixed(2)}% ${this.getTrendIcon(stats.cpuUsage.trend)}`));
        console.log(chalk.cyan(`Disk Usage: ${stats.diskUsage.current.toFixed(2)}% ${this.getTrendIcon(stats.diskUsage.trend)}`));

        const activeAlerts = this.monitor.getActiveAlerts();
        console.log(chalk.gray('\nActive Alerts:'));
        if (activeAlerts.length === 0) {
          console.log(chalk.green('✅ No active alerts'));
        } else {
          activeAlerts.forEach(alert => {
            const emoji = alert.level === 'critical' ? '🚨' : '⚠️';
            const color = alert.level === 'critical' ? chalk.red : chalk.yellow;
            console.log(color(`${emoji} ${alert.metric}: ${alert.value.toFixed(2)}`));
          });
        }

        console.log(chalk.gray(`\nUpdated: ${new Date().toLocaleTimeString()}`));
        console.log(chalk.gray(`Updates: ${updateCount + 1}`));
      }

      updateCount++;
    });

    this.monitor.start(2000); // Update every 2 seconds

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log(chalk.yellow('\n\n📊 Stopping performance watch...'));
      this.monitor.stop();
      process.exit(0);
    });
  }

  /**
   * Get trend icon for display
   */
  private getTrendIcon(trend: string): string {
    switch (trend) {
      case 'improving': return chalk.green('↗️');
      case 'degrading': return chalk.red('↘️');
      case 'stable': return chalk.gray('➡️');
      default: return '❓';
    }
  }

  /**
   * Generate performance report
   */
  async generateReport(options: PerformanceOptions): Promise<void> {
    const spinner = ora('Generating performance report...').start();

    try {
      // Run optimization check
      await this.optimizer.optimizeSetup();
      const optimizationReport = await this.optimizer.generateOptimizationReport();

      // Run benchmark
      await this.benchmark.runBenchmark();
      const benchmarkReport = this.benchmark.generateReport();

      // Start monitoring for a short period
      this.monitor.start(1000);
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
      this.monitor.stop();
      const monitoringReport = this.monitor.generateReport();

      // Combine reports
      const fullReport = `
📊 OrchFlow Performance Analysis Report
${'='.repeat(50)}

${optimizationReport}

${benchmarkReport}

${monitoringReport}

🕒 Generated at: ${new Date().toLocaleString()}
`;

      spinner.succeed('Report generated successfully');

      if (options.output) {
        writeFileSync(options.output, fullReport);
        console.log(chalk.green(`\n📊 Full report saved to: ${options.output}`));
      } else {
        console.log(fullReport);
      }

    } catch (error) {
      spinner.fail('Report generation failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Reset performance data
   */
  async resetData(_options: PerformanceOptions): Promise<void> {
    const spinner = ora('Resetting performance data...').start();

    try {
      // Reset monitoring data
      this.monitor = new PerformanceMonitor();

      // Clear cached data
      const performanceDir = join(getOrchFlowHome(), 'performance');
      const fs = require('fs');

      if (fs.existsSync(performanceDir)) {
        const files = fs.readdirSync(performanceDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            fs.unlinkSync(join(performanceDir, file));
          }
        }
      }

      spinner.succeed('Performance data reset successfully');
      console.log(chalk.green('✅ All performance data has been cleared'));

    } catch (error) {
      spinner.fail('Reset failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// CLI setup
const cli = new PerformanceCLI();

// Export the CLI class for programmatic use
export { PerformanceCLI };

program
  .name('performance-cli')
  .description('OrchFlow Performance Optimization and Monitoring Tool')
  .version('1.0.0');

program
  .command('optimize')
  .description('Optimize terminal setup performance')
  .option('-o, --output <file>', 'Output report to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await cli.optimize(options);
  });

program
  .command('benchmark')
  .description('Run performance benchmark')
  .option('-i, --iterations <number>', 'Number of iterations', '100')
  .option('-o, --output <file>', 'Output report to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    options.iterations = parseInt(options.iterations);
    await cli.runBenchmark(options);
  });

program
  .command('monitor')
  .description('Monitor performance in real-time')
  .option('-d, --duration <seconds>', 'Monitoring duration in seconds', '60')
  .option('-o, --output <file>', 'Output data to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    options.duration = parseInt(options.duration);
    await cli.startMonitoring(options);
  });

program
  .command('watch')
  .description('Watch performance metrics in real-time')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await cli.watchPerformance(options);
  });

program
  .command('report')
  .description('Generate comprehensive performance report')
  .option('-o, --output <file>', 'Output report to file')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await cli.generateReport(options);
  });

program
  .command('reset')
  .description('Reset all performance data')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    await cli.resetData(options);
  });

// Error handling
program.on('command:*', () => {
  console.error(chalk.red('Invalid command: %s'), program.args.join(' '));
  console.log(chalk.yellow('See --help for available commands'));
  process.exit(1);
});

if (process.argv.length === 2) {
  program.help();
}

program.parse(process.argv);

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('Unhandled error:'), error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught exception:'), error);
  process.exit(1);
});

// Export program for programmatic usage
export { program };
