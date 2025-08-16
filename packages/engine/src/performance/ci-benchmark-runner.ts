/**
 * CI Benchmark Runner - Automated performance testing for CI/CD pipelines
 * Integrates with GitHub Actions and other CI systems
 *
 * Note: This module is designed for Node.js environments only (CI/CD)
 */

import { BenchmarkManager } from './benchmark-manager';
import type { BenchmarkReport, CIBenchmarkConfig } from './benchmark-types';
import { PerformanceManager } from './performance-manager';

// Dynamic imports for Node.js modules to avoid browser compatibility issues
const isNodeEnvironment = typeof process !== 'undefined' && process.versions?.node;

async function getNodeModules() {
  if (!isNodeEnvironment) {
    throw new Error('CI Benchmark Runner is only available in Node.js environments');
  }

  const { writeFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  return { writeFileSync, join };
}

export class CIBenchmarkRunner {
  private config: CIBenchmarkConfig;
  private benchmarkManager: BenchmarkManager;
  private performanceManager: PerformanceManager;

  constructor(config: Partial<CIBenchmarkConfig> = {}) {
    // Check if we're in a Node.js environment
    if (!isNodeEnvironment) {
      throw new Error('CIBenchmarkRunner is only available in Node.js environments (CI/CD)');
    }
    this.config = {
      enabled: true,
      triggerOn: ['push', 'pr'],
      failOnRegression: true,
      regressionThreshold: 10, // 10% performance drop fails CI
      uploadArtifacts: true,
      notifyOn: ['failure', 'regression'],
      baselineBranch: 'main',
      timeoutMinutes: 10,
      ...config,
    };

    this.performanceManager = new PerformanceManager({
      enableMetrics: true,
      sampleRate: 1,
      historySize: 1000,
    });

    this.benchmarkManager = new BenchmarkManager({
      duration: 5000, // 5 seconds per test in CI
      warmupFrames: 30,
      targetFPS: 60,
      maxFrameTime: 16.7,
      maxMemoryUsage: 512,
      tolerance: 0.15, // More lenient in CI
      samples: 2, // Fewer samples for CI speed
      enableStressTest: false,
      enableRegressionTest: true,
      outputFormat: 'all',
    });

    this.benchmarkManager.setPerformanceManager(this.performanceManager);

    console.log('[CI-BENCHMARK] CI Benchmark Runner initialized');
  }

  /**
   * Main entry point for CI benchmark execution
   */
  public async runCIBenchmarks(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[CI-BENCHMARK] Benchmarks disabled, skipping...');
      return;
    }

    const startTime = Date.now();
    console.log('[CI-BENCHMARK] Starting CI benchmark suite...');

    try {
      // Set timeout for entire benchmark suite
      const timeoutMs = this.config.timeoutMinutes * 60 * 1000;
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Benchmark timeout')), timeoutMs);
      });

      // Run benchmarks with timeout
      const report = await Promise.race([this.benchmarkManager.runBenchmarks(), timeoutPromise]);

      await this.processBenchmarkResults(report);

      const duration = (Date.now() - startTime) / 1000;
      console.log(`[CI-BENCHMARK] Benchmark suite completed in ${duration.toFixed(1)}s`);
    } catch (error) {
      console.error('[CI-BENCHMARK] Benchmark suite failed:', error);
      await this.handleBenchmarkFailure(error);
      process.exit(1);
    } finally {
      this.dispose();
    }
  }

  /**
   * Process benchmark results and determine CI outcome
   */
  private async processBenchmarkResults(report: BenchmarkReport): Promise<void> {
    console.log(
      `[CI-BENCHMARK] Benchmark Results: ${report.summary.overallScore}/100 (${report.summary.performanceGrade})`
    );
    console.log(
      `[CI-BENCHMARK] Scenarios: ${report.summary.passedScenarios}/${report.summary.totalScenarios} passed`
    );

    // Save artifacts
    if (this.config.uploadArtifacts) {
      await this.saveArtifacts(report);
    }

    // Check for regressions
    if (this.config.failOnRegression && report.comparison?.regressionDetected) {
      const improvement = report.comparison.overallImprovement;
      if (improvement < -this.config.regressionThreshold) {
        throw new Error(
          `Performance regression detected: ${Math.abs(improvement).toFixed(1)}% performance drop (threshold: ${this.config.regressionThreshold}%)`
        );
      }
    }

    // Check if any critical benchmarks failed
    const criticalFailures = report.runs.filter((run) => !run.success && run.errors.length > 0);
    if (criticalFailures.length > 0) {
      const failedScenarios = criticalFailures.map((run) => run.scenarioId).join(', ');
      throw new Error(`Critical benchmark failures: ${failedScenarios}`);
    }

    // Output summary for CI logs
    this.outputCISummary(report);

    // Set GitHub Actions outputs if available
    await this.setGitHubOutputs(report);
  }

  /**
   * Save benchmark artifacts for CI
   */
  private async saveArtifacts(report: BenchmarkReport): Promise<void> {
    const artifactsDir = process.env.CI_ARTIFACTS_DIR || './benchmark-artifacts';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    try {
      const { writeFileSync, join } = await getNodeModules();

      // Ensure artifacts directory exists
      const { mkdirSync } = await import('node:fs');
      mkdirSync(artifactsDir, { recursive: true });

      // Save JSON report
      const jsonPath = join(artifactsDir, `benchmark-report-${timestamp}.json`);
      writeFileSync(jsonPath, this.benchmarkManager.exportReport(report, 'json'));
      console.log(`[CI-BENCHMARK] Saved JSON report: ${jsonPath}`);

      // Save JUnit XML for CI integration
      const junitPath = join(artifactsDir, `benchmark-results-${timestamp}.xml`);
      writeFileSync(junitPath, this.benchmarkManager.exportReport(report, 'junit'));
      console.log(`[CI-BENCHMARK] Saved JUnit report: ${junitPath}`);

      // Save console report
      const consolePath = join(artifactsDir, `benchmark-summary-${timestamp}.txt`);
      writeFileSync(consolePath, this.benchmarkManager.exportReport(report, 'console'));
      console.log(`[CI-BENCHMARK] Saved console report: ${consolePath}`);

      // Save baseline if this is the main branch
      if (this.isBaselineBranch()) {
        const baselinePath = join(artifactsDir, 'baseline.json');
        const baseline = this.createBaseline(report);
        writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
        console.log(`[CI-BENCHMARK] Updated baseline: ${baselinePath}`);
      }
    } catch (error) {
      console.warn('[CI-BENCHMARK] Failed to save artifacts:', error);
    }
  }

  /**
   * Create baseline from current report
   */
  private createBaseline(report: BenchmarkReport) {
    return {
      version: process.env.GITHUB_SHA || 'unknown',
      timestamp: Date.now(),
      environment: report.environment,
      scenarios: report.runs.reduce(
        (acc, run) => {
          acc[run.scenarioId] = run.metrics;
          return acc;
        },
        {} as Record<string, any>
      ),
      overallScore: report.summary.overallScore,
    };
  }

  /**
   * Check if current branch is the baseline branch
   */
  private isBaselineBranch(): boolean {
    const currentBranch = process.env.GITHUB_REF_NAME || process.env.CI_BRANCH || 'unknown';
    return currentBranch === this.config.baselineBranch;
  }

  /**
   * Output formatted summary for CI logs
   */
  private outputCISummary(report: BenchmarkReport): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log('🎯 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `📊 Overall Score: ${report.summary.overallScore}/100 (Grade: ${report.summary.performanceGrade})`
    );
    console.log(
      `✅ Passed Scenarios: ${report.summary.passedScenarios}/${report.summary.totalScenarios}`
    );

    if (report.summary.failedScenarios > 0) {
      console.log(`❌ Failed Scenarios: ${report.summary.failedScenarios}`);
    }

    if (report.comparison) {
      const improvement = report.comparison.overallImprovement;
      const icon = improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️';
      console.log(
        `${icon} Performance Change: ${improvement > 0 ? '+' : ''}${improvement.toFixed(1)}%`
      );

      if (report.comparison.regressionDetected) {
        console.log('⚠️  Performance Regression Detected!');
      }
    }

    // Show top performing and worst performing scenarios
    const sortedRuns = [...report.runs].sort(
      (a, b) => b.metrics.fps.average - a.metrics.fps.average
    );

    if (sortedRuns.length > 0) {
      console.log('\n🏆 Best Performing Scenario:');
      const best = sortedRuns[0];
      console.log(`   ${best?.scenarioId}: ${best?.metrics.fps.average.toFixed(1)} FPS`);

      if (sortedRuns.length > 1) {
        console.log('\n🐌 Worst Performing Scenario:');
        const worst = sortedRuns[sortedRuns.length - 1];
        console.log(`   ${worst?.scenarioId}: ${worst?.metrics.fps.average.toFixed(1)} FPS`);
      }
    }

    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      for (const rec of report.recommendations) {
        console.log(`   • ${rec}`);
      }
    }

    console.log(`${'='.repeat(60)}\n`);
  }

  /**
   * Set GitHub Actions outputs for workflow integration
   */
  private async setGitHubOutputs(report: BenchmarkReport): Promise<void> {
    if (!process.env.GITHUB_OUTPUT) return;

    try {
      const outputs = [
        `benchmark-score=${report.summary.overallScore}`,
        `benchmark-grade=${report.summary.performanceGrade}`,
        `scenarios-passed=${report.summary.passedScenarios}`,
        `scenarios-total=${report.summary.totalScenarios}`,
        `benchmark-success=${report.summary.failedScenarios === 0}`,
      ];

      if (report.comparison) {
        outputs.push(`performance-change=${report.comparison.overallImprovement.toFixed(1)}`);
        outputs.push(`regression-detected=${report.comparison.regressionDetected}`);
      }

      const outputFile = process.env.GITHUB_OUTPUT;
      const outputContent = `${outputs.join('\n')}\n`;

      const { appendFileSync } = await import('node:fs');
      appendFileSync(outputFile, outputContent);

      console.log('[CI-BENCHMARK] Set GitHub Actions outputs');
    } catch (error) {
      console.warn('[CI-BENCHMARK] Failed to set GitHub outputs:', error);
    }
  }

  /**
   * Handle benchmark failures in CI context
   */
  private async handleBenchmarkFailure(error: unknown): Promise<void> {
    console.error('[CI-BENCHMARK] Benchmark suite failed:', error);

    // Create failure report
    const failureReport = {
      success: false,
      error: String(error),
      timestamp: Date.now(),
      environment: {
        platform: process.platform,
        nodeVersion: process.version,
        ci: process.env.CI || 'false',
      },
    };

    // Save failure artifact if possible
    if (this.config.uploadArtifacts) {
      try {
        const { writeFileSync, join } = await getNodeModules();
        const artifactsDir = process.env.CI_ARTIFACTS_DIR || './benchmark-artifacts';
        const { mkdirSync } = await import('node:fs');
        mkdirSync(artifactsDir, { recursive: true });

        const failurePath = join(artifactsDir, `benchmark-failure-${Date.now()}.json`);
        writeFileSync(failurePath, JSON.stringify(failureReport, null, 2));
        console.log(`[CI-BENCHMARK] Saved failure report: ${failurePath}`);
      } catch (saveError) {
        console.warn('[CI-BENCHMARK] Failed to save failure report:', saveError);
      }
    }

    // Set GitHub Actions outputs for failure
    if (process.env.GITHUB_OUTPUT) {
      try {
        const outputs = [
          'benchmark-success=false',
          `benchmark-error=${String(error).replace(/\n/g, ' ')}`,
        ];

        const { appendFileSync } = await import('node:fs');
        appendFileSync(process.env.GITHUB_OUTPUT, `${outputs.join('\n')}\n`);
      } catch (outputError) {
        console.warn('[CI-BENCHMARK] Failed to set failure outputs:', outputError);
      }
    }
  }

  /**
   * Add CI-specific benchmark scenarios
   */
  public addCIScenarios(): void {
    // Lightweight CI scenarios optimized for speed
    this.benchmarkManager.addScenario({
      id: 'ci-basic-rendering',
      name: 'CI Basic Rendering',
      description: 'Fast basic rendering test for CI',
      setup: () => {
        // Setup minimal scene for CI
        console.log('[CI-BENCHMARK] Setting up basic rendering scenario');
      },
      teardown: () => {
        // Cleanup
        console.log('[CI-BENCHMARK] Cleaning up basic rendering scenario');
      },
      duration: 3000, // Shorter duration for CI
      expectedMetrics: {
        fps: { min: 45, target: 60 },
        frameTime: { max: 22, target: 16.7 },
        memory: { max: 400, target: 200 },
        cullingEfficiency: { min: 25, target: 50 },
      },
      stressLevel: 'low',
    });

    this.benchmarkManager.addScenario({
      id: 'ci-optimization-validation',
      name: 'CI Optimization Validation',
      description: 'Validate that optimizations are working',
      setup: () => {
        console.log('[CI-BENCHMARK] Setting up optimization validation');
      },
      teardown: () => {
        console.log('[CI-BENCHMARK] Cleaning up optimization validation');
      },
      duration: 4000,
      expectedMetrics: {
        fps: { min: 40, target: 55 },
        frameTime: { max: 25, target: 18 },
        memory: { max: 512, target: 300 },
        cullingEfficiency: { min: 35, target: 60 },
      },
      stressLevel: 'medium',
    });
  }

  /**
   * CLI entry point for npm scripts
   */
  public static async runFromCLI(): Promise<void> {
    const args = process.argv.slice(2);
    const config: Partial<CIBenchmarkConfig> = {};

    // Parse CLI arguments
    for (let i = 0; i < args.length; i += 2) {
      const key = args[i]?.replace('--', '');
      const value = args[i + 1];

      switch (key) {
        case 'timeout':
          config.timeoutMinutes = Number.parseInt(value || '10', 10);
          break;
        case 'regression-threshold':
          config.regressionThreshold = Number.parseFloat(value || '10');
          break;
        case 'no-artifacts':
          config.uploadArtifacts = false;
          break;
        case 'no-regression-check':
          config.failOnRegression = false;
          break;
      }
    }

    const runner = new CIBenchmarkRunner(config);
    runner.addCIScenarios();
    await runner.runCIBenchmarks();
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.benchmarkManager.dispose();
    this.performanceManager.dispose();
    console.log('[CI-BENCHMARK] CI Benchmark Runner disposed');
  }
}

// CLI execution (only in Node.js environment)
if (isNodeEnvironment && typeof require !== 'undefined' && require.main === module) {
  CIBenchmarkRunner.runFromCLI().catch((error) => {
    console.error('[CI-BENCHMARK] CLI execution failed:', error);
    process.exit(1);
  });
}
