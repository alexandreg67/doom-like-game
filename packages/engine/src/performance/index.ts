/**
 * Performance monitoring and optimization module
 * Provides comprehensive performance tracking, BSP culling, and metrics collection
 */

export * from './types';
export * from './performance-manager';
export * from './bsp-culler';

// Re-export commonly used types
export type {
  PerformanceMetrics,
  BSPMetrics,
  CullingMetrics,
  LightingMetrics,
  PerformanceConfig,
  PerformanceAlert,
} from './types';
