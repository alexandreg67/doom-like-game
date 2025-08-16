/**
 * Benchmark system types and interfaces
 * Automated performance testing for CI/CD pipeline
 */

export interface BenchmarkConfig {
  duration: number; // Test duration in ms
  warmupFrames: number; // Frames to ignore for warmup
  targetFPS: number; // Expected FPS baseline
  maxFrameTime: number; // Maximum acceptable frame time (ms)
  maxMemoryUsage: number; // Maximum acceptable memory usage (MB)
  tolerance: number; // Acceptable variance percentage (0.0-1.0)
  samples: number; // Number of test runs for averaging
  enableStressTest: boolean; // Enable high-load scenarios
  enableRegressionTest: boolean; // Compare against baseline
  outputFormat: 'console' | 'json' | 'junit' | 'all';
}

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  setup: () => Promise<void> | void;
  teardown: () => Promise<void> | void;
  duration: number; // Override global duration if needed
  expectedMetrics: {
    fps: { min: number; target: number };
    frameTime: { max: number; target: number };
    memory: { max: number; target: number };
    cullingEfficiency: { min: number; target: number };
  };
  stressLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export interface BenchmarkRun {
  scenarioId: string;
  startTime: number;
  endTime: number;
  duration: number;
  frameCount: number;
  metrics: BenchmarkMetrics;
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface BenchmarkMetrics {
  fps: {
    min: number;
    max: number;
    average: number;
    p95: number; // 95th percentile
    p99: number; // 99th percentile
    variance: number;
  };
  frameTime: {
    min: number;
    max: number;
    average: number;
    p95: number;
    p99: number;
    variance: number;
  };
  memory: {
    initial: number;
    peak: number;
    final: number;
    average: number;
    leakDetected: boolean;
  };
  culling: {
    efficiency: number;
    bspTraversalTime: number;
    geometryCulled: number;
    geometryRendered: number;
  };
  lighting: {
    passTime: number;
    activeLights: number;
    culledLights: number;
    shadowMapsUpdated: number;
  };
  lod: {
    processingTime: number;
    meshesManaged: number;
    transitionsPerFrame: number;
    memoryOptimization: number;
  };
}

export interface BenchmarkBaseline {
  version: string;
  timestamp: number;
  environment: {
    platform: string;
    engine: string;
    browser?: string;
    nodeVersion?: string;
  };
  scenarios: Record<string, BenchmarkMetrics>;
  overallScore: number; // 0-100 performance score
}

export interface BenchmarkComparison {
  baselineVersion: string;
  currentVersion: string;
  timestamp: number;
  scenarios: Record<
    string,
    {
      baseline: BenchmarkMetrics;
      current: BenchmarkMetrics;
      improvement: number; // Percentage improvement (-100 to +100)
      regression: boolean;
      significant: boolean; // Statistically significant change
    }
  >;
  overallImprovement: number;
  regressionDetected: boolean;
  summary: {
    improved: string[];
    regressed: string[];
    stable: string[];
  };
}

export interface BenchmarkReport {
  id: string;
  timestamp: number;
  config: BenchmarkConfig;
  environment: {
    platform: string;
    userAgent?: string;
    memory: number;
    cpuCores: number;
  };
  runs: BenchmarkRun[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    overallScore: number;
    performanceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  baseline?: BenchmarkBaseline;
  comparison?: BenchmarkComparison;
  recommendations: string[];
  artifactPaths: string[];
}

export interface StressTestConfig {
  geometry: {
    sectorCount: number;
    lineCount: number;
    complexityMultiplier: number;
  };
  lighting: {
    dynamicLights: number;
    shadowCasters: number;
    lightingQuality: number;
  };
  lod: {
    meshCount: number;
    lodLevels: number;
    transitionFrequency: number;
  };
  duration: number;
  rampUpTime: number; // Gradually increase load
}

export type BenchmarkEvent =
  | { type: 'start'; timestamp: number; data: BenchmarkRun; message: string }
  | { type: 'end'; timestamp: number; data: BenchmarkRun; message: string }
  | { type: 'scenario-start'; timestamp: number; data: BenchmarkScenario; message: string }
  | { type: 'scenario-end'; timestamp: number; data: BenchmarkScenario; message: string }
  | { type: 'error'; timestamp: number; data: Error; message: string }
  | { type: 'warning'; timestamp: number; data: Record<string, unknown>; message: string };

export interface CIBenchmarkConfig {
  enabled: boolean;
  triggerOn: ('push' | 'pr' | 'nightly' | 'release')[];
  failOnRegression: boolean;
  regressionThreshold: number; // Percentage drop that fails CI
  uploadArtifacts: boolean;
  notifyOn: ('failure' | 'regression' | 'improvement')[];
  baselineBranch: string;
  timeoutMinutes: number;
}
