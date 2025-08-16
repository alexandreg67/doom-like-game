/**
 * Performance monitoring types for DOOM-like game engine
 * Provides comprehensive metrics collection for BSP, rendering, and system performance
 */

export interface PerformanceMetrics {
  frameTime: number; // Total frame time in ms
  renderTime: number; // Render pass time in ms
  bspTraversalTime: number; // BSP tree traversal time in ms
  lightingTime: number; // Lighting calculations time in ms
  cullingTime: number; // Culling operations time in ms

  // Geometry metrics
  totalSectors: number;
  visibleSectors: number;
  totalLines: number;
  visibleLines: number;
  culledLines: number;

  // BSP metrics
  bspNodes: number;
  bspDepth: number;
  bspTraversals: number;

  // Memory metrics
  heapUsed: number; // MB
  heapTotal: number; // MB
  textureMemory: number; // MB
  bufferMemory: number; // MB

  // FPS metrics
  fps: number;
  avgFrameTime: number; // Rolling average
  maxFrameTime: number; // Max in current measurement window
  minFrameTime: number; // Min in current measurement window
}

export interface CullingMetrics {
  frustumCulled: number;
  occlusionCulled: number;
  distanceCulled: number;
  totalObjects: number;
  cullingEfficiency: number; // Percentage
}

export interface BSPMetrics {
  constructionTime: number; // ms
  traversalTime: number; // ms per frame
  nodesVisited: number;
  leavesReached: number;
  cullingRatio: number; // Percentage of geometry culled
}

export interface LightingMetrics {
  activeLights: number;
  shadowCasters: number;
  lightCulled: number;
  lightingPassTime: number; // ms
  shadowMapUpdates: number;
}

export interface PerformanceConfig {
  enableMetrics: boolean;
  sampleRate: number; // How often to collect metrics (frames)
  historySize: number; // Number of frames to keep in history
  alertThresholds: {
    frameTime: number; // ms - alert if exceeded
    memory: number; // MB - alert if exceeded
    cullingEfficiency: number; // % - alert if below
  };
}

export interface PerformanceSample {
  timestamp: number;
  metrics: PerformanceMetrics;
  frameNumber: number;
}

export interface PerformanceAlert {
  type: 'frameTime' | 'memory' | 'culling' | 'error';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface RenderingMetrics {
  drawCalls: number;
  triangles: number;
  vertices: number;
  materials: number;
  textures: number;
  shaderSwitches: number;
  renderPasses: number;
}

export interface PerformanceProfiler {
  start(label: string): void;
  end(label: string): number; // Returns duration in ms
  mark(label: string): void;
  measure(startMark: string, endMark: string): number;
  getMetrics(): PerformanceMetrics;
  reset(): void;
}
