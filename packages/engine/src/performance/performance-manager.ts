/**
 * PerformanceManager - Core performance monitoring and metrics collection
 * Provides real-time performance tracking and analysis for DOOM-like game engine
 */

import type {
  BSPMetrics,
  CullingMetrics,
  PerformanceProfiler as IPerformanceProfiler,
  LightingMetrics,
  PerformanceAlert,
  PerformanceConfig,
  PerformanceMetrics,
  PerformanceSample,
  RenderingMetrics,
} from './types';

export class PerformanceManager implements IPerformanceProfiler {
  private config: PerformanceConfig;
  private samples: PerformanceSample[] = [];
  private alerts: PerformanceAlert[] = [];
  private currentMetrics: PerformanceMetrics;
  private activeTimers: Map<string, number> = new Map();
  private frameNumber = 0;

  // Rolling averages
  private frameTimes: number[] = [];
  private maxSamples = 120; // 2 seconds at 60fps

  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = {
      enableMetrics: true,
      sampleRate: 1, // Every frame
      historySize: 300, // 5 seconds at 60fps
      alertThresholds: {
        frameTime: 16.7, // 60fps threshold
        memory: 512, // 512MB
        cullingEfficiency: 40, // 40% minimum culling
      },
      ...config,
    };

    this.currentMetrics = this.createEmptyMetrics();

    console.log('[PERFORMANCE] PerformanceManager initialized with config:', this.config);
  }

  private createEmptyMetrics(): PerformanceMetrics {
    return {
      frameTime: 0,
      renderTime: 0,
      bspTraversalTime: 0,
      lightingTime: 0,
      cullingTime: 0,
      totalSectors: 0,
      visibleSectors: 0,
      totalLines: 0,
      visibleLines: 0,
      culledLines: 0,
      bspNodes: 0,
      bspDepth: 0,
      bspTraversals: 0,
      heapUsed: 0,
      heapTotal: 0,
      textureMemory: 0,
      bufferMemory: 0,
      fps: 0,
      avgFrameTime: 0,
      maxFrameTime: 0,
      minFrameTime: 0,
    };
  }

  /**
   * Start timing a performance section
   */
  public start(label: string): void {
    if (!this.config.enableMetrics) return;

    this.activeTimers.set(label, performance.now());
    performance.mark(`${label}_start`);
  }

  /**
   * End timing a performance section and return duration
   */
  public end(label: string): number {
    if (!this.config.enableMetrics) return 0;

    const startTime = this.activeTimers.get(label);
    if (!startTime) {
      console.warn(`[PERFORMANCE] Timer '${label}' was not started`);
      return 0;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    performance.mark(`${label}_end`);
    performance.measure(label, `${label}_start`, `${label}_end`);

    this.activeTimers.delete(label);
    return duration;
  }

  /**
   * Create a performance mark
   */
  public mark(label: string): void {
    if (!this.config.enableMetrics) return;
    performance.mark(label);
  }

  /**
   * Measure time between two marks
   */
  public measure(startMark: string, endMark: string): number {
    if (!this.config.enableMetrics) return 0;

    try {
      performance.measure(`${startMark}_to_${endMark}`, startMark, endMark);
      const measures = performance.getEntriesByName(`${startMark}_to_${endMark}`, 'measure');
      return measures.length > 0 && measures[0] ? measures[0].duration || 0 : 0;
    } catch (error) {
      console.warn(`[PERFORMANCE] Failed to measure ${startMark} to ${endMark}:`, error);
      return 0;
    }
  }

  /**
   * Begin a new frame measurement
   */
  public startFrame(): void {
    if (!this.config.enableMetrics) return;

    this.frameNumber++;
    this.start('frame');
    this.mark('frame_start');
  }

  /**
   * End frame measurement and collect metrics
   */
  public endFrame(): void {
    if (!this.config.enableMetrics) return;

    const frameTime = this.end('frame');
    this.mark('frame_end');

    // Update frame timing
    this.frameTimes.push(frameTime);
    if (this.frameTimes.length > this.maxSamples) {
      this.frameTimes.shift();
    }

    // Calculate FPS and averages
    const avgFrameTime =
      this.frameTimes.reduce((sum, time) => sum + time, 0) / this.frameTimes.length;
    const fps = frameTime > 0 ? 1000 / frameTime : 0;

    this.currentMetrics.frameTime = frameTime;
    this.currentMetrics.avgFrameTime = avgFrameTime;
    this.currentMetrics.fps = fps;
    this.currentMetrics.maxFrameTime = Math.max(...this.frameTimes);
    this.currentMetrics.minFrameTime = Math.min(...this.frameTimes);

    // Collect memory metrics
    this.collectMemoryMetrics();

    // Check for alerts
    this.checkAlerts();

    // Sample metrics if needed
    if (this.frameNumber % this.config.sampleRate === 0) {
      this.collectSample();
    }
  }

  /**
   * Update BSP metrics
   */
  public updateBSPMetrics(metrics: BSPMetrics): void {
    if (!this.config.enableMetrics) return;

    this.currentMetrics.bspTraversalTime = metrics.traversalTime;
    this.currentMetrics.bspNodes = metrics.nodesVisited;
    this.currentMetrics.bspTraversals++;

    // Calculate culling efficiency
    const totalGeometry = this.currentMetrics.totalSectors + this.currentMetrics.totalLines;
    const visibleGeometry = this.currentMetrics.visibleSectors + this.currentMetrics.visibleLines;
    const cullingEfficiency =
      totalGeometry > 0 ? ((totalGeometry - visibleGeometry) / totalGeometry) * 100 : 0;

    console.log(
      `[PERFORMANCE] BSP Culling: ${cullingEfficiency.toFixed(1)}% efficiency, ${metrics.traversalTime.toFixed(3)}ms traversal`
    );
  }

  /**
   * Update culling metrics
   */
  public updateCullingMetrics(metrics: CullingMetrics): void {
    if (!this.config.enableMetrics) return;

    this.currentMetrics.culledLines =
      metrics.frustumCulled + metrics.occlusionCulled + metrics.distanceCulled;
    const cullingStartTime = this.activeTimers.get('culling');
    this.currentMetrics.cullingTime = cullingStartTime ? performance.now() - cullingStartTime : 0;
  }

  /**
   * Update lighting metrics
   */
  public updateLightingMetrics(metrics: LightingMetrics): void {
    if (!this.config.enableMetrics) return;

    this.currentMetrics.lightingTime = metrics.lightingPassTime;

    console.log(
      `[PERFORMANCE] Lighting: ${metrics.activeLights} lights, ${metrics.lightingPassTime.toFixed(3)}ms`
    );
  }

  /**
   * Update rendering metrics
   */
  public updateRenderingMetrics(_metrics: RenderingMetrics): void {
    if (!this.config.enableMetrics) return;

    this.currentMetrics.renderTime = this.activeTimers.has('render')
      ? performance.now() - (this.activeTimers.get('render') || 0)
      : 0;
  }

  /**
   * Update geometry counts
   */
  public updateGeometryMetrics(
    totalSectors: number,
    visibleSectors: number,
    totalLines: number,
    visibleLines: number
  ): void {
    if (!this.config.enableMetrics) return;

    this.currentMetrics.totalSectors = totalSectors;
    this.currentMetrics.visibleSectors = visibleSectors;
    this.currentMetrics.totalLines = totalLines;
    this.currentMetrics.visibleLines = visibleLines;
  }

  /**
   * Collect memory metrics
   */
  private collectMemoryMetrics(): void {
    if ('memory' in performance) {
      const memory = (
        performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }
      ).memory;
      if (memory) {
        this.currentMetrics.heapUsed = memory.usedJSHeapSize / (1024 * 1024); // MB
        this.currentMetrics.heapTotal = memory.totalJSHeapSize / (1024 * 1024); // MB
      }
    }
  }

  /**
   * Check for performance alerts
   */
  private checkAlerts(): void {
    const { frameTime, heapUsed } = this.currentMetrics;
    const { alertThresholds } = this.config;

    // Frame time alert
    if (frameTime > alertThresholds.frameTime) {
      this.addAlert({
        type: 'frameTime',
        severity: frameTime > alertThresholds.frameTime * 2 ? 'critical' : 'warning',
        message: `Frame time exceeded threshold: ${frameTime.toFixed(2)}ms`,
        value: frameTime,
        threshold: alertThresholds.frameTime,
        timestamp: Date.now(),
      });
    }

    // Memory alert
    if (heapUsed > alertThresholds.memory) {
      this.addAlert({
        type: 'memory',
        severity: heapUsed > alertThresholds.memory * 1.5 ? 'critical' : 'warning',
        message: `Memory usage exceeded threshold: ${heapUsed.toFixed(1)}MB`,
        value: heapUsed,
        threshold: alertThresholds.memory,
        timestamp: Date.now(),
      });
    }

    // Culling efficiency alert
    const totalGeometry = this.currentMetrics.totalSectors + this.currentMetrics.totalLines;
    const visibleGeometry = this.currentMetrics.visibleSectors + this.currentMetrics.visibleLines;
    const cullingEfficiency =
      totalGeometry > 0 ? ((totalGeometry - visibleGeometry) / totalGeometry) * 100 : 100;

    if (cullingEfficiency < alertThresholds.cullingEfficiency) {
      this.addAlert({
        type: 'culling',
        severity: 'warning',
        message: `Culling efficiency below threshold: ${cullingEfficiency.toFixed(1)}%`,
        value: cullingEfficiency,
        threshold: alertThresholds.cullingEfficiency,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Add a performance alert
   */
  private addAlert(alert: PerformanceAlert): void {
    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-50);
    }

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`[PERFORMANCE] CRITICAL: ${alert.message}`);
    } else if (alert.severity === 'warning') {
      console.warn(`[PERFORMANCE] WARNING: ${alert.message}`);
    }
  }

  /**
   * Collect a performance sample
   */
  private collectSample(): void {
    const sample: PerformanceSample = {
      timestamp: Date.now(),
      metrics: { ...this.currentMetrics },
      frameNumber: this.frameNumber,
    };

    this.samples.push(sample);

    // Keep history size limit
    if (this.samples.length > this.config.historySize) {
      this.samples.shift();
    }
  }

  /**
   * Get current performance metrics
   */
  public getMetrics(): PerformanceMetrics {
    return { ...this.currentMetrics };
  }

  /**
   * Get recent performance samples
   */
  public getSamples(count?: number): PerformanceSample[] {
    const samples = count ? this.samples.slice(-count) : this.samples;
    return samples.map((sample) => ({ ...sample, metrics: { ...sample.metrics } }));
  }

  /**
   * Get recent alerts
   */
  public getAlerts(count?: number): PerformanceAlert[] {
    const alerts = count ? this.alerts.slice(-count) : this.alerts;
    return alerts.map((alert) => ({ ...alert }));
  }

  /**
   * Reset all metrics and history
   */
  public reset(): void {
    this.samples = [];
    this.alerts = [];
    this.frameTimes = [];
    this.frameNumber = 0;
    this.currentMetrics = this.createEmptyMetrics();
    this.activeTimers.clear();

    console.log('[PERFORMANCE] Metrics reset');
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[PERFORMANCE] Configuration updated:', this.config);
  }

  /**
   * Get performance summary
   */
  public getSummary(): string {
    const { fps, avgFrameTime, heapUsed, visibleSectors, totalSectors } = this.currentMetrics;
    const cullingRatio =
      totalSectors > 0 ? ((totalSectors - visibleSectors) / totalSectors) * 100 : 0;

    return `FPS: ${fps.toFixed(1)} | Frame: ${avgFrameTime.toFixed(2)}ms | Memory: ${heapUsed.toFixed(1)}MB | Culling: ${cullingRatio.toFixed(1)}%`;
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.reset();
    this.activeTimers.clear();
    console.log('[PERFORMANCE] PerformanceManager disposed');
  }
}
