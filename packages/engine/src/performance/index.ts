/**
 * Performance monitoring and optimization module
 * Provides comprehensive performance tracking, BSP culling, lighting optimization, and metrics collection
 */

export * from './types';
export * from './lod-types';
export * from './dashboard-types';
export * from './debug-types';
export * from './performance-manager';
export * from './bsp-culler';
export * from './light-pool-manager';
export * from './shadow-pool-manager';
export * from './optimized-lighting-system';
export * from './lod-manager';
export * from './geometry-simplifier';
export * from './dashboard-manager';
export * from './debug-visualizer';
export * from './benchmark-types';
export * from './benchmark-manager';
export * from './ci-benchmark-runner';

// Re-export commonly used types
export type {
  PerformanceMetrics,
  BSPMetrics,
  CullingMetrics,
  LightingMetrics,
  PerformanceConfig,
  PerformanceAlert,
} from './types';

export type {
  LODLevel,
  LODConfig,
  LODInstance,
  LODMetrics,
  GeometryLODOptions,
  TextureLODOptions,
} from './lod-types';

export type {
  DashboardConfig,
  DashboardMetrics,
  DashboardAlert,
  MetricChart,
  RealTimeData,
  PerformanceStats,
  DashboardTheme,
} from './dashboard-types';

export type {
  DebugConfig,
  DebugVisualization,
  DebugMetrics,
  BSPDebugInfo,
  LODDebugInfo,
  LightingDebugInfo,
  DebugAnnotation,
  DebugEvent,
} from './debug-types';

export type {
  BenchmarkConfig,
  BenchmarkScenario,
  BenchmarkReport,
  BenchmarkMetrics,
  BenchmarkRun,
  CIBenchmarkConfig,
} from './benchmark-types';
