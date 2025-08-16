/**
 * Tests for BenchmarkManager
 * Validates automated performance testing functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BenchmarkManager } from '../benchmark-manager';
import type { BenchmarkConfig, BenchmarkScenario } from '../benchmark-types';
import { PerformanceManager } from '../performance-manager';

// Mock performance.now for consistent testing
const mockPerformanceNow = vi.fn();
Object.defineProperty(global, 'performance', {
  value: {
    now: mockPerformanceNow,
    memory: {
      usedJSHeapSize: 100 * 1024 * 1024, // 100MB
    },
  },
});

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

describe('BenchmarkManager', () => {
  let benchmarkManager: BenchmarkManager;
  let performanceManager: PerformanceManager;
  let timeCounter = 0;

  beforeEach(() => {
    vi.clearAllMocks();
    timeCounter = 0;

    // Mock performance.now to return incremental time
    mockPerformanceNow.mockImplementation(() => {
      timeCounter += 16; // Simulate 60fps
      return timeCounter;
    });

    const config: Partial<BenchmarkConfig> = {
      duration: 100, // Short duration for testing
      warmupFrames: 3,
      targetFPS: 60,
      maxFrameTime: 16.7,
      maxMemoryUsage: 512,
      tolerance: 0.1,
      samples: 1, // Single sample for faster tests
      enableStressTest: false,
      enableRegressionTest: false,
      outputFormat: 'console',
    };

    benchmarkManager = new BenchmarkManager(config);
    performanceManager = new PerformanceManager();
    benchmarkManager.setPerformanceManager(performanceManager);
  });

  afterEach(() => {
    benchmarkManager.dispose();
    performanceManager.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const customConfig: BenchmarkConfig = {
        duration: 5000,
        warmupFrames: 120,
        targetFPS: 30,
        maxFrameTime: 33.3,
        maxMemoryUsage: 1024,
        tolerance: 0.2,
        samples: 5,
        enableStressTest: true,
        enableRegressionTest: true,
        outputFormat: 'json',
      };

      const customBenchmark = new BenchmarkManager(customConfig);
      expect(customBenchmark).toBeDefined();
      customBenchmark.dispose();
    });

    it('should initialize with default scenarios', () => {
      expect(benchmarkManager).toBeDefined();
      // Default scenarios should be loaded
    });

    it('should set performance manager correctly', () => {
      const manager = new PerformanceManager();
      benchmarkManager.setPerformanceManager(manager);

      // Should not throw
      expect(() => benchmarkManager.setPerformanceManager(manager)).not.toThrow();
      manager.dispose();
    });
  });

  describe('Scenario Management', () => {
    it('should add custom scenarios', () => {
      const scenario: BenchmarkScenario = {
        id: 'test-scenario',
        name: 'Test Scenario',
        description: 'A test scenario for validation',
        setup: vi.fn(),
        teardown: vi.fn(),
        duration: 1000,
        expectedMetrics: {
          fps: { min: 55, target: 60 },
          frameTime: { max: 18, target: 16.7 },
          memory: { max: 256, target: 128 },
          cullingEfficiency: { min: 30, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      // Should not throw when adding scenarios
      expect(() => benchmarkManager.addScenario(scenario)).not.toThrow();
    });

    it('should handle scenarios with different stress levels', () => {
      const scenarios: BenchmarkScenario[] = [
        {
          id: 'low-stress',
          name: 'Low Stress',
          description: 'Low stress test',
          setup: vi.fn(),
          teardown: vi.fn(),
          duration: 100,
          expectedMetrics: {
            fps: { min: 58, target: 60 },
            frameTime: { max: 17, target: 16.7 },
            memory: { max: 200, target: 150 },
            cullingEfficiency: { min: 40, target: 60 },
          },
          stressLevel: 'low',
        },
        {
          id: 'high-stress',
          name: 'High Stress',
          description: 'High stress test',
          setup: vi.fn(),
          teardown: vi.fn(),
          duration: 100,
          expectedMetrics: {
            fps: { min: 30, target: 45 },
            frameTime: { max: 33, target: 22 },
            memory: { max: 800, target: 400 },
            cullingEfficiency: { min: 60, target: 80 },
          },
          stressLevel: 'high',
        },
      ];

      for (const scenario of scenarios) {
        benchmarkManager.addScenario(scenario);
      }

      expect(() => benchmarkManager.addScenario(scenarios[0])).not.toThrow();
    });
  });

  describe('Benchmark Execution', () => {
    it('should run benchmarks successfully', async () => {
      // Add a simple test scenario
      const scenario: BenchmarkScenario = {
        id: 'simple-test',
        name: 'Simple Test',
        description: 'Basic performance test',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 64, // 4 frames at 16ms each
        expectedMetrics: {
          fps: { min: 50, target: 60 },
          frameTime: { max: 20, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      expect(report).toBeDefined();
      expect(report.runs).toHaveLength(1); // One sample
      expect(report.summary.totalScenarios).toBeGreaterThan(0);
      expect(scenario.setup).toHaveBeenCalled();
      expect(scenario.teardown).toHaveBeenCalled();
    });

    it('should handle benchmark failures gracefully', async () => {
      const failingScenario: BenchmarkScenario = {
        id: 'failing-test',
        name: 'Failing Test',
        description: 'Test that should fail',
        setup: vi.fn().mockRejectedValue(new Error('Setup failed')),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 100,
        expectedMetrics: {
          fps: { min: 60, target: 60 },
          frameTime: { max: 16.7, target: 16.7 },
          memory: { max: 100, target: 100 },
          cullingEfficiency: { min: 90, target: 95 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(failingScenario);

      const report = await benchmarkManager.runBenchmarks();

      expect(report).toBeDefined();
      expect(report.summary.failedScenarios).toBeGreaterThan(0);
    });

    it('should validate metrics against thresholds', async () => {
      // Mock performance to simulate poor performance
      mockPerformanceNow.mockImplementation(() => {
        timeCounter += 33; // Simulate 30fps (poor performance)
        return timeCounter;
      });

      const strictScenario: BenchmarkScenario = {
        id: 'strict-test',
        name: 'Strict Performance Test',
        description: 'Test with strict performance requirements',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 100,
        expectedMetrics: {
          fps: { min: 58, target: 60 }, // Strict FPS requirement
          frameTime: { max: 17, target: 16.7 },
          memory: { max: 200, target: 150 },
          cullingEfficiency: { min: 50, target: 70 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(strictScenario);

      const report = await benchmarkManager.runBenchmarks();

      // Should detect performance issues
      const run = report.runs.find((r) => r.scenarioId === 'strict-test');
      expect(run?.success).toBe(false);
    });

    it('should detect memory leaks', async () => {
      let memoryUsage = 100 * 1024 * 1024; // Start at 100MB

      Object.defineProperty(global, 'performance', {
        value: {
          now: mockPerformanceNow,
          memory: {
            get usedJSHeapSize() {
              memoryUsage += 5 * 1024 * 1024; // Increase by 5MB each time
              return memoryUsage;
            },
          },
        },
      });

      const memoryTestScenario: BenchmarkScenario = {
        id: 'memory-test',
        name: 'Memory Leak Test',
        description: 'Test for memory leak detection',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 200, // Longer duration to accumulate memory
        expectedMetrics: {
          fps: { min: 30, target: 60 },
          frameTime: { max: 50, target: 16.7 },
          memory: { max: 1000, target: 200 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(memoryTestScenario);

      const report = await benchmarkManager.runBenchmarks();

      const run = report.runs.find((r) => r.scenarioId === 'memory-test');
      expect(run?.metrics.memory.leakDetected).toBe(true);
    });
  });

  describe('Metrics Calculation', () => {
    it('should calculate FPS statistics correctly', async () => {
      // Mock consistent 60fps performance
      mockPerformanceNow.mockImplementation(() => {
        timeCounter += 16.667; // Exactly 60fps
        return timeCounter;
      });

      const scenario: BenchmarkScenario = {
        id: 'fps-test',
        name: 'FPS Test',
        description: 'Test FPS calculation',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 100,
        expectedMetrics: {
          fps: { min: 58, target: 60 },
          frameTime: { max: 18, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      const run = report.runs.find((r) => r.scenarioId === 'fps-test');
      expect(run?.metrics.fps.average).toBeCloseTo(60, 1);
    });

    it('should calculate percentiles correctly', async () => {
      // Mock variable frame times
      const frameTimes = [10, 15, 16, 17, 18, 20, 25, 30, 35, 40];
      let frameIndex = 0;

      mockPerformanceNow.mockImplementation(() => {
        const frameTime = frameTimes[frameIndex % frameTimes.length];
        frameIndex++;
        timeCounter += frameTime;
        return timeCounter;
      });

      const scenario: BenchmarkScenario = {
        id: 'percentile-test',
        name: 'Percentile Test',
        description: 'Test percentile calculations',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 160, // Enough time for all frame times
        expectedMetrics: {
          fps: { min: 20, target: 60 },
          frameTime: { max: 50, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      const run = report.runs.find((r) => r.scenarioId === 'percentile-test');
      expect(run?.metrics.frameTime.p95).toBeGreaterThan(run?.metrics.frameTime.average || 0);
      expect(run?.metrics.frameTime.p99).toBeGreaterThan(run?.metrics.frameTime.p95 || 0);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive reports', async () => {
      const scenario: BenchmarkScenario = {
        id: 'report-test',
        name: 'Report Test',
        description: 'Test report generation',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 64,
        expectedMetrics: {
          fps: { min: 55, target: 60 },
          frameTime: { max: 18, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      expect(report.id).toBeDefined();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.environment).toBeDefined();
      expect(report.summary).toBeDefined();
      expect(report.summary.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.summary.overallScore).toBeLessThanOrEqual(100);
      expect(['A', 'B', 'C', 'D', 'F']).toContain(report.summary.performanceGrade);
    });

    it('should export reports in different formats', async () => {
      const scenario: BenchmarkScenario = {
        id: 'export-test',
        name: 'Export Test',
        description: 'Test report export formats',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 64,
        expectedMetrics: {
          fps: { min: 50, target: 60 },
          frameTime: { max: 20, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      // Test JSON export
      const jsonReport = benchmarkManager.exportReport(report, 'json');
      expect(() => JSON.parse(jsonReport)).not.toThrow();

      // Test JUnit XML export
      const junitReport = benchmarkManager.exportReport(report, 'junit');
      expect(junitReport).toContain('<?xml version="1.0"');
      expect(junitReport).toContain('<testsuite');

      // Test Console export
      const consoleReport = benchmarkManager.exportReport(report, 'console');
      expect(consoleReport).toContain('Performance Benchmark Report');
      expect(consoleReport).toContain('Overall Score:');
    });

    it('should generate recommendations based on results', async () => {
      // Mock poor performance to trigger recommendations
      mockPerformanceNow.mockImplementation(() => {
        timeCounter += 50; // Simulate 20fps
        return timeCounter;
      });

      Object.defineProperty(global, 'performance', {
        value: {
          now: mockPerformanceNow,
          memory: {
            usedJSHeapSize: 1000 * 1024 * 1024, // 1GB - excessive memory
          },
        },
      });

      const scenario: BenchmarkScenario = {
        id: 'recommendation-test',
        name: 'Recommendation Test',
        description: 'Test recommendation generation',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 100,
        expectedMetrics: {
          fps: { min: 55, target: 60 },
          frameTime: { max: 18, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 40, target: 60 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(
        report.recommendations.some((rec) => rec.includes('FPS') || rec.includes('memory'))
      ).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle concurrent benchmark runs', async () => {
      const scenario: BenchmarkScenario = {
        id: 'concurrent-test',
        name: 'Concurrent Test',
        description: 'Test concurrent run handling',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 1000,
        expectedMetrics: {
          fps: { min: 50, target: 60 },
          frameTime: { max: 20, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      // Start first benchmark
      const promise1 = benchmarkManager.runBenchmarks();

      // Try to start second benchmark - should throw
      await expect(benchmarkManager.runBenchmarks()).rejects.toThrow('already running');

      // Wait for first to complete
      await promise1;
    });

    it('should handle scenario setup/teardown errors', async () => {
      const errorScenario: BenchmarkScenario = {
        id: 'error-test',
        name: 'Error Test',
        description: 'Test error handling',
        setup: vi.fn().mockRejectedValue(new Error('Setup failed')),
        teardown: vi.fn().mockRejectedValue(new Error('Teardown failed')),
        duration: 100,
        expectedMetrics: {
          fps: { min: 50, target: 60 },
          frameTime: { max: 20, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(errorScenario);

      const report = await benchmarkManager.runBenchmarks();

      const run = report.runs.find((r) => r.scenarioId === 'error-test');
      expect(run?.success).toBe(false);
      expect(run?.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Environment Detection', () => {
    it('should detect environment information', async () => {
      const scenario: BenchmarkScenario = {
        id: 'env-test',
        name: 'Environment Test',
        description: 'Test environment detection',
        setup: vi.fn().mockResolvedValue(undefined),
        teardown: vi.fn().mockResolvedValue(undefined),
        duration: 64,
        expectedMetrics: {
          fps: { min: 50, target: 60 },
          frameTime: { max: 20, target: 16.7 },
          memory: { max: 512, target: 256 },
          cullingEfficiency: { min: 0, target: 50 },
        },
        stressLevel: 'low',
      };

      benchmarkManager.addScenario(scenario);

      const report = await benchmarkManager.runBenchmarks();

      expect(report.environment.platform).toBeDefined();
      expect(report.environment.memory).toBeGreaterThanOrEqual(0);
      expect(report.environment.cpuCores).toBeGreaterThan(0);
    });
  });
});
