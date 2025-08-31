/**
 * DebugVisualizer - Visual debugging tools for performance optimization
 * Provides real-time visualization of BSP culling, LOD transitions, lighting, and performance metrics
 */

import type { Camera, Engine, Scene } from '@babylonjs/core';
import type {
  BSPDebugInfo,
  DebugAnnotation,
  DebugColorScheme,
  DebugConfig,
  DebugEvent,
  DebugHeatmap,
  DebugMetrics,
  DebugOverlayElement,
  DebugRenderContext,
  DebugVisualization,
  LODDebugInfo,
  LightingDebugInfo,
  PerformanceChart,
} from './debug-types';
import type { PerformanceManager } from './performance-manager';
export class DebugVisualizer {
  private config: DebugConfig;
  private visualizations: Map<string, DebugVisualization> = new Map();
  private overlay!: HTMLElement;
  private canvas2d!: HTMLCanvasElement;
  private ctx2d!: CanvasRenderingContext2D;
  private performanceManager: PerformanceManager | null = null;
  private renderContext: DebugRenderContext | null = null;
  private isInitialized = false;
  private annotations: Map<string, DebugAnnotation> = new Map();
  private events: DebugEvent[] = [];
  private colorScheme: DebugColorScheme;
  private charts: Map<string, PerformanceChart> = new Map();
  private heatmaps: Map<string, DebugHeatmap> = new Map();
  private updateTimer: number | null = null;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      enabled: true,
      showBSPTree: true,
      showCullingInfo: true,
      showLODTransitions: true,
      showLightingDebug: true,
      showPerformanceMetrics: true,
      wireframeMode: false,
      colorByDepth: true,
      showBoundingBoxes: true,
      overlayPosition: 'top-left',
      opacity: 0.8,
      refreshRate: 30, // 30 Hz refresh
      ...config,
    };

    this.colorScheme = {
      bspNodes: {
        visible: '#00ff00',
        culled: '#ff0000',
        leaf: '#ffff00',
        branch: '#00ffff',
      },
      lodLevels: ['#00ff00', '#ffff00', '#ff8800', '#ff0000'],
      lighting: {
        directional: '#ffff00',
        point: '#ff8800',
        spot: '#8800ff',
        shadow: '#404040',
      },
      performance: {
        good: '#00ff00',
        warning: '#ffff00',
        critical: '#ff0000',
      },
    };

    this.initializeOverlay();
    this.initializeDefaultVisualizations();

    console.log('[DEBUG-VIZ] DebugVisualizer initialized');
  }

  /**
   * Initialize the debug overlay
   */
  private initializeOverlay(): void {
    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'debug-visualizer-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 10000;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #ffffff;
      background: rgba(0, 0, 0, 0.7);
      padding: 10px;
      border-radius: 5px;
      max-width: 400px;
      opacity: ${this.config.opacity};
    `;

    this.positionOverlay();

    // Create 2D canvas for wireframe overlays
    this.canvas2d = document.createElement('canvas');
    this.canvas2d.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 9999;
    `;

    const ctx = this.canvas2d.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx2d = ctx;

    document.body.appendChild(this.overlay);
    document.body.appendChild(this.canvas2d);

    // Handle window resize
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });

    this.resizeCanvas();
  }

  /**
   * Position the overlay based on configuration
   */
  private positionOverlay(): void {
    const position = this.config.overlayPosition;

    switch (position) {
      case 'top-left':
        this.overlay.style.top = '10px';
        this.overlay.style.left = '10px';
        break;
      case 'top-right':
        this.overlay.style.top = '10px';
        this.overlay.style.right = '10px';
        break;
      case 'bottom-left':
        this.overlay.style.bottom = '10px';
        this.overlay.style.left = '10px';
        break;
      case 'bottom-right':
        this.overlay.style.bottom = '10px';
        this.overlay.style.right = '10px';
        break;
    }
  }

  /**
   * Resize the 2D canvas to match window size
   */
  private resizeCanvas(): void {
    this.canvas2d.width = window.innerWidth;
    this.canvas2d.height = window.innerHeight;
  }

  /**
   * Set performance manager for metrics access
   */
  public setPerformanceManager(performanceManager: PerformanceManager): void {
    this.performanceManager = performanceManager;
    console.log('[DEBUG-VIZ] PerformanceManager attached');
  }

  /**
   * Initialize the debug visualizer with scene context
   */
  public initialize(scene: Scene, engine: Engine, camera: Camera, canvas: HTMLCanvasElement): void {
    this.renderContext = {
      scene,
      engine,
      camera,
      canvas,
      ctx2d: this.ctx2d,
      overlay: this.overlay,
      metrics: this.getDebugMetrics(),
    };

    this.isInitialized = true;
    this.startUpdateLoop();

    console.log('[DEBUG-VIZ] Initialized with scene context');
  }

  /**
   * Start the debug update loop
   */
  private startUpdateLoop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
    }

    const interval = 1000 / this.config.refreshRate;
    this.updateTimer = setInterval(() => {
      this.update();
    }, interval) as unknown as number;
  }

  /**
   * Main update loop
   */
  private update(): void {
    if (!this.config.enabled || !this.isInitialized || !this.renderContext) {
      return;
    }

    // Update metrics
    this.renderContext.metrics = this.getDebugMetrics();

    // Clear 2D canvas
    this.ctx2d.clearRect(0, 0, this.canvas2d.width, this.canvas2d.height);

    // Update and render all visualizations
    for (const viz of this.visualizations.values()) {
      if (viz.enabled) {
        try {
          viz.update(1000 / this.config.refreshRate);
          viz.render(this.renderContext);
        } catch (error) {
          console.warn(`[DEBUG-VIZ] Error updating visualization ${viz.id}:`, error);
        }
      }
    }

    // Update overlay content
    this.updateOverlay();

    // Clean up old annotations
    this.cleanupAnnotations();

    // Clean up old events
    this.cleanupEvents();
  }

  /**
   * Get current debug metrics
   */
  private getDebugMetrics(): DebugMetrics {
    const perfMetrics = this.performanceManager?.getMetrics();

    return {
      frameTime: perfMetrics?.frameTime || 0,
      fps: perfMetrics?.fps || 0,
      memory: {
        used: this.getMemoryUsage(),
        total: this.getTotalMemory(),
      },
      culling: {
        sectorsVisible: perfMetrics?.visibleSectors || 0,
        sectorsTotal: perfMetrics?.totalSectors || 0,
        cullingTime: perfMetrics?.bspTraversalTime || 0,
      },
      lighting: {
        lightsActive: 0, // Would be filled by lighting manager
        lightsTotal: 0,
        shadowMaps: 0,
        lightingTime: perfMetrics?.lightingTime || 0,
      },
      lod: {
        meshesManaged: 0, // Would be filled by LOD manager
        transitionsThisFrame: 0,
        memoryOptimized: 0,
      },
      bsp: {
        nodesTraversed: perfMetrics?.bspNodes || 0,
        cullingEfficiency: perfMetrics
          ? perfMetrics.totalSectors > 0
            ? ((perfMetrics.totalSectors - perfMetrics.visibleSectors) / perfMetrics.totalSectors) *
              100
            : 0
          : 0,
        traversalTime: perfMetrics?.bspTraversalTime || 0,
      },
    };
  }

  /**
   * Initialize default visualizations
   */
  private initializeDefaultVisualizations(): void {
    // BSP Tree Visualization
    this.addVisualization({
      id: 'bsp-tree',
      type: 'bsp',
      enabled: this.config.showBSPTree,
      priority: 1,
      render: (ctx) => this.renderBSPTree(ctx),
      update: () => {},
      dispose: () => {},
    });

    // Culling Info Visualization
    this.addVisualization({
      id: 'culling-info',
      type: 'culling',
      enabled: this.config.showCullingInfo,
      priority: 2,
      render: (ctx) => this.renderCullingInfo(ctx),
      update: () => {},
      dispose: () => {},
    });

    // LOD Transitions Visualization
    this.addVisualization({
      id: 'lod-transitions',
      type: 'lod',
      enabled: this.config.showLODTransitions,
      priority: 3,
      render: (ctx) => this.renderLODTransitions(ctx),
      update: () => {},
      dispose: () => {},
    });

    // Lighting Debug Visualization
    this.addVisualization({
      id: 'lighting-debug',
      type: 'lighting',
      enabled: this.config.showLightingDebug,
      priority: 4,
      render: (ctx) => this.renderLightingDebug(ctx),
      update: () => {},
      dispose: () => {},
    });

    // Performance Metrics Visualization
    this.addVisualization({
      id: 'performance-metrics',
      type: 'performance',
      enabled: this.config.showPerformanceMetrics,
      priority: 5,
      render: (ctx) => this.renderPerformanceMetrics(ctx),
      update: () => {},
      dispose: () => {},
    });
  }

  /**
   * Add a custom visualization
   */
  public addVisualization(visualization: DebugVisualization): void {
    this.visualizations.set(visualization.id, visualization);
    console.log(`[DEBUG-VIZ] Added visualization: ${visualization.id}`);
  }

  /**
   * Remove a visualization
   */
  public removeVisualization(id: string): void {
    const viz = this.visualizations.get(id);
    if (viz) {
      viz.dispose();
      this.visualizations.delete(id);
      console.log(`[DEBUG-VIZ] Removed visualization: ${id}`);
    }
  }

  /**
   * Toggle visualization on/off
   */
  public toggleVisualization(id: string, enabled?: boolean): void {
    const viz = this.visualizations.get(id);
    if (viz) {
      viz.enabled = enabled !== undefined ? enabled : !viz.enabled;
      console.log(`[DEBUG-VIZ] ${viz.enabled ? 'Enabled' : 'Disabled'} visualization: ${id}`);
    }
  }

  /**
   * Render BSP tree visualization
   */
  private renderBSPTree(_ctx: DebugRenderContext): void {
    if (!this.config.showBSPTree) return;

    // Get BSP debug info (would be provided by BSP manager)
    const bspInfo = this.getBSPDebugInfo();
    if (!bspInfo) return;

    // Draw BSP nodes as wireframe
    for (const node of bspInfo.nodes) {
      const color = node.visible
        ? node.isLeaf
          ? this.colorScheme.bspNodes.leaf
          : this.colorScheme.bspNodes.visible
        : this.colorScheme.bspNodes.culled;

      this.drawBoundingBox(node.bounds, color);

      if (node.splitPlane && !node.isLeaf) {
        this.drawSplitPlane(node.splitPlane, node.bounds);
      }
    }
  }

  /**
   * Render culling information
   */
  private renderCullingInfo(ctx: DebugRenderContext): void {
    if (!this.config.showCullingInfo) return;

    const metrics = ctx.metrics;
    const efficiency = metrics.culling.sectorsVisible / Math.max(1, metrics.culling.sectorsTotal);

    // Draw culling efficiency visualization
    const color =
      efficiency > 0.7
        ? this.colorScheme.performance.good
        : efficiency > 0.4
          ? this.colorScheme.performance.warning
          : this.colorScheme.performance.critical;

    this.addOverlayElement({
      id: 'culling-efficiency',
      type: 'text',
      position: { x: 10, y: 50 },
      size: { width: 200, height: 20 },
      content: `Culling: ${(efficiency * 100).toFixed(1)}% (${metrics.culling.sectorsVisible}/${metrics.culling.sectorsTotal})`,
      style: { textColor: color },
    });
  }

  /**
   * Render LOD transitions
   */
  private renderLODTransitions(_ctx: DebugRenderContext): void {
    if (!this.config.showLODTransitions) return;

    const lodInfo = this.getLODDebugInfo();
    if (!lodInfo) return;

    // Draw LOD levels as colored wireframes
    for (const mesh of lodInfo.meshes) {
      const colorIndex = Math.min(mesh.currentLOD, this.colorScheme.lodLevels.length - 1);
      const color = this.colorScheme.lodLevels[colorIndex] || '#ffffff';

      if (mesh.transitionState === 'transitioning') {
        this.addAnnotation({
          id: `lod-transition-${mesh.id}`,
          worldPosition: mesh.position,
          text: `LOD ${mesh.currentLOD} → ${mesh.currentLOD + 1}`,
          color: '#ffff00',
          fontSize: 12,
          background: true,
          arrow: true,
          lifetime: 2000,
        });
      }

      // Draw mesh bounding sphere with LOD color
      this.drawSphere(mesh.position, 2, color);
    }
  }

  /**
   * Render lighting debug information
   */
  private renderLightingDebug(_ctx: DebugRenderContext): void {
    if (!this.config.showLightingDebug) return;

    const lightingInfo = this.getLightingDebugInfo();
    if (!lightingInfo) return;

    // Draw lights with appropriate colors
    for (const light of lightingInfo.lights) {
      const color = light.visible
        ? this.colorScheme.lighting[light.type]
        : this.colorScheme.lighting.shadow;

      this.drawLight(light, color);

      if (light.castsShadows && light.visible) {
        this.drawLightRange(light, color);
      }
    }
  }

  /**
   * Render performance metrics
   */
  private renderPerformanceMetrics(_ctx: DebugRenderContext): void {
    if (!this.config.showPerformanceMetrics) return;

    const metrics = _ctx.metrics;

    // Update performance chart
    this.updatePerformanceChart('fps', metrics.fps);
    this.updatePerformanceChart('frameTime', metrics.frameTime);
    this.updatePerformanceChart('memory', metrics.memory.used);
  }

  /**
   * Update the overlay content
   */
  private updateOverlay(): void {
    if (!this.renderContext) return;

    const metrics = this.renderContext.metrics;

    let content = '<div style="font-weight: bold; margin-bottom: 10px;">Debug Visualizer</div>';

    // Performance metrics
    content += `<div>FPS: ${metrics.fps.toFixed(1)}</div>`;
    content += `<div>Frame: ${metrics.frameTime.toFixed(2)}ms</div>`;
    content += `<div>Memory: ${metrics.memory.used.toFixed(1)}MB</div>`;

    // Culling metrics
    const cullingEfficiency =
      metrics.culling.sectorsVisible / Math.max(1, metrics.culling.sectorsTotal);
    content += `<div>Culling: ${(cullingEfficiency * 100).toFixed(1)}%</div>`;

    // Lighting metrics
    content += `<div>Lights: ${metrics.lighting.lightsActive}/${metrics.lighting.lightsTotal}</div>`;

    // BSP metrics
    content += `<div>BSP: ${metrics.bsp.nodesTraversed} nodes</div>`;

    // Recent events
    if (this.events.length > 0) {
      content += '<div style="margin-top: 10px; font-weight: bold;">Recent Events:</div>';
      const recentEvents = this.events.slice(-3);
      for (const event of recentEvents) {
        const eventColor =
          event.severity === 'error'
            ? '#ff0000'
            : event.severity === 'warning'
              ? '#ffff00'
              : '#00ff00';
        content += `<div style="color: ${eventColor}; font-size: 10px;">${event.message}</div>`;
      }
    }

    this.overlay.innerHTML = content;
  }

  /**
   * Add debug annotation
   */
  public addAnnotation(annotation: DebugAnnotation): void {
    // Add creation timestamp if not provided
    if (annotation.lifetime && !annotation.createdAt) {
      annotation.createdAt = performance.now();
    }
    this.annotations.set(annotation.id, annotation);
  }

  /**
   * Add debug event
   */
  public addEvent(event: Omit<DebugEvent, 'timestamp'>): void {
    this.events.push({
      ...event,
      timestamp: performance.now(),
    });

    // Keep only last 50 events
    if (this.events.length > 50) {
      this.events = this.events.slice(-50);
    }
  }

  /**
   * Helper methods for drawing
   */
  private drawBoundingBox(
    _bounds: { min: [number, number, number]; max: [number, number, number] },
    _color: string
  ): void {
    // Would project 3D bounds to screen space and draw wireframe
    // Implementation depends on Babylon.js camera projection
  }

  private drawSplitPlane(
    _plane: { normal: [number, number, number]; distance: number },
    _bounds: { min: [number, number, number]; max: [number, number, number] }
  ): void {
    // Draw the BSP split plane
  }

  private drawSphere(_position: [number, number, number], _radius: number, _color: string): void {
    // Project 3D sphere to screen space and draw circle
  }

  private drawLight(_light: unknown, _color: string): void {
    // Draw light visualization based on type
  }

  private drawLightRange(_light: unknown, _color: string): void {
    // Draw light influence range
  }

  private addOverlayElement(_element: DebugOverlayElement): void {
    // Add element to overlay
  }

  private updatePerformanceChart(_metric: string, _value: number): void {
    // Update performance chart with new data point
  }

  private getBSPDebugInfo(): BSPDebugInfo | null {
    // Would get from BSP manager
    return null;
  }

  private getLODDebugInfo(): LODDebugInfo | null {
    // Would get from LOD manager
    return null;
  }

  private getLightingDebugInfo(): LightingDebugInfo | null {
    // Would get from lighting manager
    return null;
  }

  private getMemoryUsage(): number {
    if ('memory' in performance) {
      const memory = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      return memory ? memory.usedJSHeapSize / (1024 * 1024) : 0;
    }
    return 0;
  }

  private getTotalMemory(): number {
    if ('memory' in performance) {
      const memory = (performance as { memory?: { totalJSHeapSize: number } }).memory;
      return memory ? memory.totalJSHeapSize / (1024 * 1024) : 0;
    }
    return 0;
  }

  private cleanupAnnotations(): void {
    const now = performance.now();
    for (const [id, annotation] of this.annotations) {
      if (annotation.lifetime && typeof annotation.createdAt === 'number') {
        if (now - annotation.createdAt > annotation.lifetime) {
          this.annotations.delete(id);
        }
      }
    }
  }

  private cleanupEvents(): void {
    const cutoff = performance.now() - 30000; // Keep 30 seconds of events
    this.events = this.events.filter((event) => event.timestamp > cutoff);
  }

  /**
   * Toggle debug mode on/off
   */
  public toggle(enabled?: boolean): void {
    this.config.enabled = enabled !== undefined ? enabled : !this.config.enabled;

    this.overlay.style.display = this.config.enabled ? 'block' : 'none';
    this.canvas2d.style.display = this.config.enabled ? 'block' : 'none';

    if (this.config.enabled && !this.updateTimer) {
      this.startUpdateLoop();
    } else if (!this.config.enabled && this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    console.log(`[DEBUG-VIZ] ${this.config.enabled ? 'Enabled' : 'Disabled'} debug visualizer`);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update overlay position if changed
    if (newConfig.overlayPosition) {
      this.positionOverlay();
    }

    // Update overlay opacity if changed
    if (newConfig.opacity !== undefined) {
      this.overlay.style.opacity = newConfig.opacity.toString();
    }

    // Update refresh rate if changed
    if (newConfig.refreshRate && this.updateTimer) {
      this.startUpdateLoop();
    }

    // Update visualization states
    this.toggleVisualization('bsp-tree', this.config.showBSPTree);
    this.toggleVisualization('culling-info', this.config.showCullingInfo);
    this.toggleVisualization('lod-transitions', this.config.showLODTransitions);
    this.toggleVisualization('lighting-debug', this.config.showLightingDebug);
    this.toggleVisualization('performance-metrics', this.config.showPerformanceMetrics);

    console.log('[DEBUG-VIZ] Configuration updated');
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    // Dispose all visualizations
    for (const viz of this.visualizations.values()) {
      viz.dispose();
    }
    this.visualizations.clear();

    // Remove DOM elements
    if (this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.canvas2d.parentNode) {
      this.canvas2d.parentNode.removeChild(this.canvas2d);
    }

    this.annotations.clear();
    this.events = [];
    this.charts.clear();
    this.heatmaps.clear();

    console.log('[DEBUG-VIZ] DebugVisualizer disposed');
  }
}
