/**
 * Performance monitoring and optimization module
 * Provides comprehensive performance tracking, BSP culling, lighting optimization, and metrics collection
 */

export * from './types';
export * from './performance-manager';
export * from './bsp-culler';
export * from './light-pool-manager';
export * from './shadow-pool-manager';
export * from './optimized-lighting-system';

// Re-export commonly used types
export type {
  PerformanceMetrics,
  BSPMetrics,
  CullingMetrics,
  LightingMetrics,
  PerformanceConfig,
  PerformanceAlert,
} from './types';
