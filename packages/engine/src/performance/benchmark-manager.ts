/**
 * BenchmarkManager - Automated performance testing system
 * Provides comprehensive performance benchmarking for CI/CD integration
 */

import type {
  BenchmarkBaseline,
  BenchmarkComparison,
  BenchmarkConfig,
  BenchmarkEvent,
  BenchmarkMetrics,
  BenchmarkReport,
  BenchmarkRun,
  BenchmarkScenario,
} from './benchmark-types';
import type { PerformanceManager } from './performance-manager';

export class BenchmarkManager {
  private config: BenchmarkConfig;
  private scenarios: Map<string, BenchmarkScenario> = new Map();
  private runs: BenchmarkRun[] = [];
  private events: BenchmarkEvent[] = [];
  private performanceManager: PerformanceManager | null = null;
  private baseline: BenchmarkBaseline | null = null;
  private isRunning = false;
  // private currentRun: BenchmarkRun | null = null;

  constructor(config: Partial<BenchmarkConfig> = {}) {
    this.config = {
      duration: 10000, // 10 seconds default
      warmupFrames: 60, // 1 second at 60fps
      targetFPS: 60,
      maxFrameTime: 16.7, // 60fps = 16.7ms
      maxMemoryUsage: 512, // 512MB
      tolerance: 0.1, // 10% tolerance
      samples: 3, // Run each test 3 times
      enableStressTest: false,
      enableRegressionTest: true,
      outputFormat: 'console',
      ...config,
    };

    this.initializeDefaultScenarios();
    console.log('[BENCHMARK] BenchmarkManager initialized');
  }

  /**
   * Set performance manager for metrics collection
   */
  public setPerformanceManager(performanceManager: PerformanceManager): void {
    this.performanceManager = performanceManager;
    console.log('[BENCHMARK] PerformanceManager attached');
  }

  /**
   * Add custom benchmark scenario
   */
  public addScenario(scenario: BenchmarkScenario): void {
    this.scenarios.set(scenario.id, scenario);
    console.log(`[BENCHMARK] Added scenario: ${scenario.name}`);
  }

  /**
   * Run all benchmark scenarios
   */
  public async runBenchmarks(): Promise<BenchmarkReport> {
    if (this.isRunning) {
      throw new Error('Benchmarks are already running');
    }

    this.isRunning = true;
    this.runs = [];
    this.events = [];

    this.emitEvent('start', {}, 'Benchmark suite started');

    try {
      // Load baseline if regression testing is enabled
      if (this.config.enableRegressionTest) {
        await this.loadBaseline();
      }

      // Run each scenario multiple times for averaging
      const scenarioIds = Array.from(this.scenarios.keys());

      for (const scenarioId of scenarioIds) {
        const scenario = this.scenarios.get(scenarioId)!;

        this.emitEvent('scenario-start', { scenarioId }, `Starting scenario: ${scenario.name}`);

        const scenarioRuns: BenchmarkRun[] = [];

        for (let sample = 0; sample < this.config.samples; sample++) {
          try {
            const run = await this.runScenario(scenario, sample);
            scenarioRuns.push(run);
            this.runs.push(run);
          } catch (error) {
            this.emitEvent(
              'error',
              { scenarioId, sample, error },
              `Error in scenario ${scenario.name}, sample ${sample}: ${error}`
            );
          }
        }

        this.emitEvent(
          'scenario-end',
          { scenarioId, samples: scenarioRuns.length },
          `Completed scenario: ${scenario.name}`
        );
      }

      const report = this.generateReport();

      this.emitEvent('end', { report }, 'Benchmark suite completed');

      return report;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run single benchmark scenario
   */
  private async runScenario(scenario: BenchmarkScenario, _sample: number): Promise<BenchmarkRun> {
    const startTime = performance.now();

    const run: BenchmarkRun = {
      scenarioId: scenario.id,
      startTime,
      endTime: 0,
      duration: 0,
      frameCount: 0,
      metrics: this.createEmptyMetrics(),
      success: false,
      errors: [],
      warnings: [],
    };

    // this.currentRun = run;

    try {
      // Setup scenario
      await scenario.setup();

      // Warmup period
      // const warmupStart = performance.now();
      let frameCount = 0;

      while (frameCount < this.config.warmupFrames) {
        await this.waitForFrame();
        frameCount++;
      }

      console.log(`[BENCHMARK] Warmup completed for ${scenario.name} (${frameCount} frames)`);

      // Reset performance manager metrics
      if (this.performanceManager) {
        this.performanceManager.reset();
      }

      // Run actual benchmark
      const benchmarkStart = performance.now();
      const duration = scenario.duration || this.config.duration;
      frameCount = 0;

      const frameMetrics: { fps: number; frameTime: number; memory: number }[] = [];

      while (performance.now() - benchmarkStart < duration) {
        const frameStart = performance.now();

        await this.waitForFrame();

        const frameEnd = performance.now();
        const frameTime = frameEnd - frameStart;
        const fps = frameTime > 0 ? 1000 / frameTime : 0;
        const memory = this.getMemoryUsage();

        frameMetrics.push({ fps, frameTime, memory });
        frameCount++;
      }

      // Collect final metrics
      run.metrics = this.calculateMetrics(frameMetrics);
      run.frameCount = frameCount;
      run.endTime = performance.now();
      run.duration = run.endTime - run.startTime;

      // Validate against expected metrics
      run.success = this.validateMetrics(run.metrics, scenario.expectedMetrics);

      // Teardown scenario
      await scenario.teardown();

      console.log(
        `[BENCHMARK] Completed ${scenario.name} - FPS: ${run.metrics.fps.average.toFixed(1)}, Success: ${run.success}`
      );
    } catch (error) {
      run.errors.push(String(error));
      run.success = false;
      this.emitEvent(
        'error',
        { scenarioId: scenario.id, error },
        `Error in scenario ${scenario.name}: ${error}`
      );
    }

    return run;
  }

  /**
   * Calculate comprehensive metrics from frame data
   */
  private calculateMetrics(
    frameMetrics: { fps: number; frameTime: number; memory: number }[]
  ): BenchmarkMetrics {
    if (frameMetrics.length === 0) {
      return this.createEmptyMetrics();
    }

    const fpsValues = frameMetrics.map((f) => f.fps).sort((a, b) => a - b);
    const frameTimeValues = frameMetrics.map((f) => f.frameTime).sort((a, b) => a - b);
    const memoryValues = frameMetrics.map((f) => f.memory);

    return {
      fps: {
        min: Math.min(...fpsValues),
        max: Math.max(...fpsValues),
        average: fpsValues.reduce((sum, val) => sum + val, 0) / fpsValues.length,
        p95: this.percentile(fpsValues, 0.95),
        p99: this.percentile(fpsValues, 0.99),
        variance: this.calculateVariance(fpsValues),
      },
      frameTime: {
        min: Math.min(...frameTimeValues),
        max: Math.max(...frameTimeValues),
        average: frameTimeValues.reduce((sum, val) => sum + val, 0) / frameTimeValues.length,
        p95: this.percentile(frameTimeValues, 0.95),
        p99: this.percentile(frameTimeValues, 0.99),
        variance: this.calculateVariance(frameTimeValues),
      },
      memory: {
        initial: memoryValues[0] || 0,
        peak: Math.max(...memoryValues),
        final: memoryValues[memoryValues.length - 1] || 0,
        average: memoryValues.reduce((sum, val) => sum + val, 0) / memoryValues.length,
        leakDetected: this.detectMemoryLeak(memoryValues),
      },
      culling: {
        efficiency: this.getCullingEfficiency(),
        bspTraversalTime: this.getBSPTraversalTime(),
        geometryCulled: 0,
        geometryRendered: 0,
      },
      lighting: {
        passTime: this.getLightingPassTime(),
        activeLights: 0,
        culledLights: 0,
        shadowMapsUpdated: 0,
      },
      lod: {
        processingTime: this.getLODProcessingTime(),
        meshesManaged: 0,
        transitionsPerFrame: 0,
        memoryOptimization: 0,
      },
    };
  }

  /**
   * Validate metrics against expected thresholds
   */
  private validateMetrics(
    metrics: BenchmarkMetrics,
    expected: BenchmarkScenario['expectedMetrics']
  ): boolean {
    const tolerance = this.config.tolerance;

    // Check FPS
    if (metrics.fps.average < expected.fps.min * (1 - tolerance)) {
      return false;
    }

    // Check frame time
    if (metrics.frameTime.average > expected.frameTime.max * (1 + tolerance)) {
      return false;
    }

    // Check memory
    if (metrics.memory.peak > expected.memory.max * (1 + tolerance)) {
      return false;
    }

    // Check culling efficiency
    if (metrics.culling.efficiency < expected.cullingEfficiency.min * (1 - tolerance)) {
      return false;
    }

    return true;
  }

  /**
   * Generate comprehensive benchmark report
   */
  private generateReport(): BenchmarkReport {
    const timestamp = Date.now();
    const passedRuns = this.runs.filter((run) => run.success);
    const failedRuns = this.runs.filter((run) => !run.success);

    const overallScore = this.calculateOverallScore();
    const performanceGrade = this.calculatePerformanceGrade(overallScore);

    const report: BenchmarkReport = {
      id: `benchmark-${timestamp}`,
      timestamp,
      config: this.config,
      environment: {
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'node',
        ...(typeof navigator !== 'undefined' &&
          navigator.userAgent && { userAgent: navigator.userAgent }),
        memory: this.getMemoryUsage(),
        cpuCores:
          typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
            ? navigator.hardwareConcurrency || 1
            : 1,
      },
      runs: this.runs,
      summary: {
        totalScenarios: this.scenarios.size,
        passedScenarios: passedRuns.length,
        failedScenarios: failedRuns.length,
        overallScore,
        performanceGrade,
      },
      recommendations: this.generateRecommendations(),
      artifactPaths: [],
    };

    // Add baseline comparison if available
    if (this.baseline && this.config.enableRegressionTest) {
      const comparison = this.compareWithBaseline();
      if (comparison) {
        report.comparison = comparison;
      }
    }

    return report;
  }

  /**
   * Initialize default benchmark scenarios
   */
  private initializeDefaultScenarios(): void {
    // Basic rendering scenario
    this.addScenario({
      id: 'basic-rendering',
      name: 'Basic Rendering',
      description: 'Simple scene rendering with minimal geometry',
      setup: () => {
        /* Setup basic scene */
      },
      teardown: () => {
        /* Cleanup */
      },
      duration: 5000,
      expectedMetrics: {
        fps: { min: 55, target: 60 },
        frameTime: { max: 18, target: 16.7 },
        memory: { max: 256, target: 128 },
        cullingEfficiency: { min: 30, target: 50 },
      },
      stressLevel: 'low',
    });

    // BSP culling stress test
    this.addScenario({
      id: 'bsp-culling-stress',
      name: 'BSP Culling Stress Test',
      description: 'High geometry count with intensive BSP culling',
      setup: () => {
        /* Setup complex geometry */
      },
      teardown: () => {
        /* Cleanup */
      },
      duration: 10000,
      expectedMetrics: {
        fps: { min: 45, target: 60 },
        frameTime: { max: 22, target: 16.7 },
        memory: { max: 512, target: 256 },
        cullingEfficiency: { min: 60, target: 80 },
      },
      stressLevel: 'high',
    });

    // Lighting performance test
    this.addScenario({
      id: 'lighting-performance',
      name: 'Dynamic Lighting Performance',
      description: 'Multiple dynamic lights with shadow mapping',
      setup: () => {
        /* Setup lighting scene */
      },
      teardown: () => {
        /* Cleanup */
      },
      duration: 8000,
      expectedMetrics: {
        fps: { min: 40, target: 60 },
        frameTime: { max: 25, target: 16.7 },
        memory: { max: 384, target: 256 },
        cullingEfficiency: { min: 40, target: 60 },
      },
      stressLevel: 'medium',
    });

    // LOD system test
    this.addScenario({
      id: 'lod-system',
      name: 'LOD System Performance',
      description: 'Large number of meshes with active LOD management',
      setup: () => {
        /* Setup LOD scene */
      },
      teardown: () => {
        /* Cleanup */
      },
      duration: 12000,
      expectedMetrics: {
        fps: { min: 50, target: 60 },
        frameTime: { max: 20, target: 16.7 },
        memory: { max: 400, target: 200 },
        cullingEfficiency: { min: 70, target: 85 },
      },
      stressLevel: 'medium',
    });
  }

  private createEmptyMetrics(): BenchmarkMetrics {
    return {
      fps: { min: 0, max: 0, average: 0, p95: 0, p99: 0, variance: 0 },
      frameTime: { min: 0, max: 0, average: 0, p95: 0, p99: 0, variance: 0 },
      memory: { initial: 0, peak: 0, final: 0, average: 0, leakDetected: false },
      culling: { efficiency: 0, bspTraversalTime: 0, geometryCulled: 0, geometryRendered: 0 },
      lighting: { passTime: 0, activeLights: 0, culledLights: 0, shadowMapsUpdated: 0 },
      lod: { processingTime: 0, meshesManaged: 0, transitionsPerFrame: 0, memoryOptimization: 0 },
    };
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))] || 0;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + (val - mean) ** 2, 0) / values.length;
    return variance;
  }

  private detectMemoryLeak(memoryValues: number[]): boolean {
    if (memoryValues.length < 10) return false;

    const initial = memoryValues.slice(0, 5).reduce((sum, val) => sum + val, 0) / 5;
    const final = memoryValues.slice(-5).reduce((sum, val) => sum + val, 0) / 5;

    // Consider it a leak if memory increased by more than 20%
    return (final - initial) / initial > 0.2;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    }
    return 0;
  }

  private getCullingEfficiency(): number {
    return this.performanceManager?.getMetrics().visibleSectors || 0;
  }

  private getBSPTraversalTime(): number {
    return this.performanceManager?.getMetrics().bspTraversalTime || 0;
  }

  private getLightingPassTime(): number {
    return this.performanceManager?.getMetrics().lightingTime || 0;
  }

  private getLODProcessingTime(): number {
    // Would get from LOD metrics when available
    return 0;
  }

  private calculateOverallScore(): number {
    if (this.runs.length === 0) return 0;

    const successRate = this.runs.filter((run) => run.success).length / this.runs.length;
    const avgFPS =
      this.runs.reduce((sum, run) => sum + run.metrics.fps.average, 0) / this.runs.length;
    const fpsScore = Math.min(100, (avgFPS / this.config.targetFPS) * 100);

    return Math.round(successRate * fpsScore);
  }

  private calculatePerformanceGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Analyze failed runs for recommendations
    const failedRuns = this.runs.filter((run) => !run.success);

    if (failedRuns.length > 0) {
      const avgFPS =
        failedRuns.reduce((sum, run) => sum + run.metrics.fps.average, 0) / failedRuns.length;
      if (avgFPS < this.config.targetFPS * 0.8) {
        recommendations.push('Consider optimizing rendering pipeline - FPS below target');
      }

      const avgMemory =
        failedRuns.reduce((sum, run) => sum + run.metrics.memory.peak, 0) / failedRuns.length;
      if (avgMemory > this.config.maxMemoryUsage) {
        recommendations.push('Memory usage exceeds threshold - check for memory leaks');
      }

      const memoryLeaks = failedRuns.filter((run) => run.metrics.memory.leakDetected).length;
      if (memoryLeaks > 0) {
        recommendations.push(`Memory leaks detected in ${memoryLeaks} scenarios`);
      }
    }

    return recommendations;
  }

  // private getEnvironmentInfo() {
  //   return {
  //     platform: typeof navigator !== 'undefined' ? navigator.platform : 'node',
  //     userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  //     memory: this.getMemoryUsage(),
  //     cpuCores: typeof navigator !== 'undefined' && 'hardwareConcurrency' in navigator
  //       ? navigator.hardwareConcurrency || 1 : 1,
  //   };
  // }

  private async waitForFrame(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16); // ~60fps fallback
      }
    });
  }

  private emitEvent(type: BenchmarkEvent['type'], data: any, message: string): void {
    const event: BenchmarkEvent = {
      type,
      timestamp: performance.now(),
      data,
      message,
    };

    this.events.push(event);

    if (this.config.outputFormat === 'console' || this.config.outputFormat === 'all') {
      console.log(`[BENCHMARK] ${message}`);
    }
  }

  private async loadBaseline(): Promise<void> {
    // In a real implementation, this would load from file system or database
    console.log('[BENCHMARK] Loading baseline for regression testing...');
    // this.baseline = await loadBaselineFromStorage();
  }

  private compareWithBaseline(): BenchmarkComparison | undefined {
    if (!this.baseline) return undefined;

    // Implementation would compare current runs with baseline
    // For now, return undefined
    return undefined;
  }

  /**
   * Export benchmark report in specified format
   */
  public exportReport(
    report: BenchmarkReport,
    format: 'json' | 'junit' | 'console' = 'json'
  ): string {
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2);

      case 'junit':
        return this.generateJUnitXML(report);

      case 'console':
        return this.generateConsoleReport(report);

      default:
        return JSON.stringify(report, null, 2);
    }
  }

  private generateJUnitXML(report: BenchmarkReport): string {
    const testCases = report.runs
      .map((run) => {
        const scenario = this.scenarios.get(run.scenarioId);
        return `
    <testcase name="${scenario?.name || run.scenarioId}" 
              classname="BenchmarkTest" 
              time="${(run.duration / 1000).toFixed(3)}">
      ${
        !run.success
          ? `<failure message="Performance threshold not met">
        FPS: ${run.metrics.fps.average.toFixed(1)} (expected: ${scenario?.expectedMetrics.fps.min})
        Frame Time: ${run.metrics.frameTime.average.toFixed(2)}ms (max: ${scenario?.expectedMetrics.frameTime.max})
      </failure>`
          : ''
      }
    </testcase>`;
      })
      .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="PerformanceBenchmarks" 
           tests="${report.runs.length}" 
           failures="${report.summary.failedScenarios}" 
           time="${(report.runs.reduce((sum, run) => sum + run.duration, 0) / 1000).toFixed(3)}">
  ${testCases}
</testsuite>`;
  }

  private generateConsoleReport(report: BenchmarkReport): string {
    let output = '\n=== Performance Benchmark Report ===\n';
    output += `Overall Score: ${report.summary.overallScore}/100 (${report.summary.performanceGrade})\n`;
    output += `Scenarios: ${report.summary.passedScenarios}/${report.summary.totalScenarios} passed\n\n`;

    for (const run of report.runs) {
      const scenario = this.scenarios.get(run.scenarioId);
      output += `${scenario?.name || run.scenarioId}: ${run.success ? '✅' : '❌'}\n`;
      output += `  FPS: ${run.metrics.fps.average.toFixed(1)} (min: ${run.metrics.fps.min.toFixed(1)})\n`;
      output += `  Frame Time: ${run.metrics.frameTime.average.toFixed(2)}ms\n`;
      output += `  Memory: ${run.metrics.memory.peak.toFixed(1)}MB\n\n`;
    }

    if (report.recommendations.length > 0) {
      output += 'Recommendations:\n';
      for (const rec of report.recommendations) {
        output += `  • ${rec}\n`;
      }
    }

    return output;
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.isRunning = false;
    this.scenarios.clear();
    this.runs = [];
    this.events = [];
    console.log('[BENCHMARK] BenchmarkManager disposed');
  }
}
