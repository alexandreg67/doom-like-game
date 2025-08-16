/**
 * DashboardManager - Real-time performance monitoring dashboard
 * Provides live visualization and monitoring of engine performance
 */

import type {
  DashboardAlert,
  DashboardConfig,
  DashboardMetrics,
  DashboardTheme,
  MetricChart,
  PerformanceStats,
  RealTimeData,
} from './dashboard-types';
import type { LODMetrics } from './lod-types';
import type { BSPMetrics, LightingMetrics, PerformanceMetrics } from './types';

export class DashboardManager {
  private config: DashboardConfig;
  private metrics: DashboardMetrics;
  private alerts: DashboardAlert[] = [];
  private charts: Map<string, MetricChart> = new Map();
  private updateTimer: number | null = null;
  private startTime: number;
  private frameCount = 0;
  private theme: DashboardTheme;

  // DOM elements for rendering
  private container: HTMLElement | null = null;
  private isVisible = false;

  constructor(config: Partial<DashboardConfig> = {}) {
    this.config = {
      updateInterval: 100, // 10 FPS updates
      maxDataPoints: 300, // 30 seconds at 10 FPS
      enableCharts: true,
      enableAlerts: true,
      autoScale: true,
      displayMode: 'overlay',
      position: 'top-right',
      opacity: 0.9,
      theme: 'dark',
      ...config,
    };

    this.metrics = this.createEmptyMetrics();
    this.startTime = performance.now();
    this.theme = this.createTheme();
    this.initializeCharts();

    console.log('[DASHBOARD] DashboardManager initialized');
  }

  private createEmptyMetrics(): DashboardMetrics {
    return {
      fps: [],
      frameTime: [],
      renderTime: [],
      heapUsed: [],
      textureMemory: [],
      bufferMemory: [],
      bspTraversalTime: [],
      lightingTime: [],
      lodProcessingTime: [],
      cullingEfficiency: [],
      visibleSectors: [],
      culledObjects: [],
      timestamps: [],
    };
  }

  private createTheme(): DashboardTheme {
    const isDark = this.config.theme === 'dark';
    return {
      background: isDark ? '#1a1a1a' : '#ffffff',
      foreground: isDark ? '#2a2a2a' : '#f0f0f0',
      accent: '#3b82f6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      border: isDark ? '#404040' : '#d1d5db',
      text: {
        primary: isDark ? '#ffffff' : '#000000',
        secondary: isDark ? '#d1d5db' : '#6b7280',
        muted: isDark ? '#9ca3af' : '#9ca3af',
      },
      chart: {
        grid: isDark ? '#374151' : '#e5e7eb',
        axis: isDark ? '#6b7280' : '#9ca3af',
        colors: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'],
      },
    };
  }

  private initializeCharts(): void {
    const colors = this.theme.chart.colors;
    const defaultCharts: MetricChart[] = [
      {
        id: 'fps',
        title: 'FPS',
        type: 'line',
        dataKey: 'fps',
        color: colors[0] || '#3b82f6',
        unit: 'fps',
        threshold: { warning: 45, critical: 30 },
        visible: true,
        smoothing: true,
      },
      {
        id: 'frameTime',
        title: 'Frame Time',
        type: 'line',
        dataKey: 'frameTime',
        color: colors[1] || '#10b981',
        unit: 'ms',
        threshold: { warning: 16.7, critical: 33.3 },
        visible: true,
        smoothing: true,
      },
      {
        id: 'memory',
        title: 'Memory Usage',
        type: 'line',
        dataKey: 'heapUsed',
        color: colors[2] || '#f59e0b',
        unit: 'MB',
        threshold: { warning: 512, critical: 1024 },
        visible: true,
        smoothing: false,
      },
      {
        id: 'culling',
        title: 'Culling Efficiency',
        type: 'line',
        dataKey: 'cullingEfficiency',
        color: colors[3] || '#ef4444',
        unit: '%',
        min: 0,
        max: 100,
        threshold: { warning: 40, critical: 20 },
        visible: true,
        smoothing: true,
      },
      {
        id: 'bspTime',
        title: 'BSP Traversal',
        type: 'line',
        dataKey: 'bspTraversalTime',
        color: colors[4] || '#8b5cf6',
        unit: 'ms',
        threshold: { warning: 1, critical: 5 },
        visible: false,
        smoothing: true,
      },
      {
        id: 'lightingTime',
        title: 'Lighting Time',
        type: 'line',
        dataKey: 'lightingTime',
        color: colors[5] || '#06b6d4',
        unit: 'ms',
        threshold: { warning: 2, critical: 10 },
        visible: false,
        smoothing: true,
      },
    ];

    for (const chart of defaultCharts) {
      this.charts.set(chart.id, chart);
    }
  }

  /**
   * Start the dashboard
   */
  public start(): void {
    if (this.updateTimer) return;

    this.createDOMElements();
    this.updateTimer = window.setInterval(() => {
      this.render();
    }, this.config.updateInterval);

    this.isVisible = true;
    console.log('[DASHBOARD] Started dashboard updates');
  }

  /**
   * Stop the dashboard
   */
  public stop(): void {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }

    this.isVisible = false;
    console.log('[DASHBOARD] Stopped dashboard updates');
  }

  /**
   * Update dashboard with performance metrics
   */
  public updateMetrics(metrics: PerformanceMetrics): void {
    const timestamp = performance.now();
    this.frameCount++;

    // Add new data points
    this.addDataPoint('fps', metrics.fps, timestamp);
    this.addDataPoint('frameTime', metrics.frameTime, timestamp);
    this.addDataPoint('renderTime', metrics.renderTime, timestamp);
    this.addDataPoint('heapUsed', metrics.heapUsed, timestamp);
    this.addDataPoint('textureMemory', metrics.textureMemory, timestamp);
    this.addDataPoint('bufferMemory', metrics.bufferMemory, timestamp);

    // Calculate culling efficiency
    const totalGeometry = metrics.totalSectors + metrics.totalLines;
    const visibleGeometry = metrics.visibleSectors + metrics.visibleLines;
    const cullingEfficiency =
      totalGeometry > 0 ? ((totalGeometry - visibleGeometry) / totalGeometry) * 100 : 0;

    this.addDataPoint('cullingEfficiency', cullingEfficiency, timestamp);
    this.addDataPoint('visibleSectors', metrics.visibleSectors, timestamp);

    // Check for alerts
    this.checkPerformanceAlerts(metrics);
  }

  /**
   * Update BSP metrics
   */
  public updateBSPMetrics(metrics: BSPMetrics): void {
    const timestamp = performance.now();
    this.addDataPoint('bspTraversalTime', metrics.traversalTime, timestamp);
  }

  /**
   * Update lighting metrics
   */
  public updateLightingMetrics(metrics: LightingMetrics): void {
    const timestamp = performance.now();
    this.addDataPoint('lightingTime', metrics.lightingPassTime, timestamp);
  }

  /**
   * Update LOD metrics
   */
  public updateLODMetrics(metrics: LODMetrics): void {
    const timestamp = performance.now();
    this.addDataPoint('lodProcessingTime', metrics.processingTime, timestamp);
    this.addDataPoint('culledObjects', metrics.culledMeshes, timestamp);
  }

  private addDataPoint(key: keyof DashboardMetrics, value: number, timestamp: number): void {
    if (key === 'timestamps') return;

    const data = this.metrics[key] as number[];
    data.push(value);

    // Maintain max data points
    if (data.length > this.config.maxDataPoints) {
      data.shift();
    }

    // Update timestamps
    this.metrics.timestamps.push(timestamp);
    if (this.metrics.timestamps.length > this.config.maxDataPoints) {
      this.metrics.timestamps.shift();
    }
  }

  private checkPerformanceAlerts(metrics: PerformanceMetrics): void {
    if (!this.config.enableAlerts) return;

    // FPS alert
    if (metrics.fps < 30) {
      this.addAlert({
        id: `fps_${Date.now()}`,
        type: 'performance',
        severity: metrics.fps < 15 ? 'critical' : 'warning',
        title: 'Low FPS',
        message: `FPS dropped to ${metrics.fps.toFixed(1)}`,
        value: metrics.fps,
        threshold: 30,
        timestamp: Date.now(),
        duration: 5000,
        acknowledged: false,
      });
    }

    // Frame time alert
    if (metrics.frameTime > 33.3) {
      this.addAlert({
        id: `frametime_${Date.now()}`,
        type: 'performance',
        severity: metrics.frameTime > 66.6 ? 'critical' : 'warning',
        title: 'High Frame Time',
        message: `Frame time: ${metrics.frameTime.toFixed(2)}ms`,
        value: metrics.frameTime,
        threshold: 33.3,
        timestamp: Date.now(),
        duration: 5000,
        acknowledged: false,
      });
    }

    // Memory alert
    if (metrics.heapUsed > 512) {
      this.addAlert({
        id: `memory_${Date.now()}`,
        type: 'memory',
        severity: metrics.heapUsed > 1024 ? 'critical' : 'warning',
        title: 'High Memory Usage',
        message: `Memory: ${metrics.heapUsed.toFixed(1)}MB`,
        value: metrics.heapUsed,
        threshold: 512,
        timestamp: Date.now(),
        duration: 10000,
        acknowledged: false,
      });
    }
  }

  private addAlert(alert: DashboardAlert): void {
    // Check for duplicate alerts
    const exists = this.alerts.some(
      (a) => a.type === alert.type && a.title === alert.title && !a.acknowledged
    );

    if (!exists) {
      this.alerts.push(alert);

      // Auto-remove after duration
      if (alert.duration) {
        setTimeout(() => {
          this.removeAlert(alert.id);
        }, alert.duration);
      }

      console.warn(`[DASHBOARD] ${alert.severity.toUpperCase()}: ${alert.message}`);
    }

    // Keep only recent alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-25);
    }
  }

  private removeAlert(id: string): void {
    this.alerts = this.alerts.filter((alert) => alert.id !== id);
  }

  /**
   * Get current real-time data
   */
  public getRealTimeData(): RealTimeData {
    const current = this.getCurrentValues();
    const average = this.getAverageValues();
    const peak = this.getPeakValues();

    return { current, average, peak };
  }

  private getCurrentValues() {
    const getLatest = (key: keyof DashboardMetrics): number => {
      const data = this.metrics[key] as number[];
      return data.length > 0 ? (data[data.length - 1] ?? 0) : 0;
    };

    return {
      fps: getLatest('fps'),
      frameTime: getLatest('frameTime'),
      memory: getLatest('heapUsed'),
      cullingEfficiency: getLatest('cullingEfficiency'),
      alertCount: this.alerts.filter((a) => !a.acknowledged).length,
    };
  }

  private getAverageValues() {
    const getAverage = (key: keyof DashboardMetrics): number => {
      const data = this.metrics[key] as number[];
      return data.length > 0 ? data.reduce((sum, val) => sum + val, 0) / data.length : 0;
    };

    return {
      fps: getAverage('fps'),
      frameTime: getAverage('frameTime'),
      memory: getAverage('heapUsed'),
    };
  }

  private getPeakValues() {
    const getPeak = (key: keyof DashboardMetrics): number => {
      const data = this.metrics[key] as number[];
      return data.length > 0 ? Math.max(...data) : 0;
    };

    return {
      frameTime: getPeak('frameTime'),
      memory: getPeak('heapUsed'),
    };
  }

  /**
   * Get performance statistics
   */
  public getStats(): PerformanceStats {
    const uptime = performance.now() - this.startTime;
    const averageFPS = this.getAverageValues().fps;
    const frameDrops = this.metrics.fps.filter((fps) => fps < 30).length;

    // Simple performance score calculation
    const performanceScore = Math.min(
      100,
      Math.max(0, (averageFPS / 60) * 100 * 0.6 + (Math.max(0, 100 - frameDrops) / 100) * 100 * 0.4)
    );

    return {
      uptime,
      totalFrames: this.frameCount,
      averageFPS,
      frameDrops,
      memoryLeaks: 0, // TODO: Implement memory leak detection
      performanceScore,
    };
  }

  private createDOMElements(): void {
    if (this.container) return;

    this.container = document.createElement('div');
    this.container.id = 'performance-dashboard';
    this.container.style.cssText = `
      position: fixed;
      ${this.config.position.includes('top') ? 'top: 10px;' : 'bottom: 10px;'}
      ${this.config.position.includes('right') ? 'right: 10px;' : 'left: 10px;'}
      background: ${this.theme.background};
      border: 1px solid ${this.theme.border};
      border-radius: 8px;
      padding: 12px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 12px;
      color: ${this.theme.text.primary};
      z-index: 10000;
      opacity: ${this.config.opacity};
      min-width: 300px;
      max-width: 400px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;

    document.body.appendChild(this.container);
  }

  private render(): void {
    if (!this.container || !this.isVisible) return;

    const realTimeData = this.getRealTimeData();
    const stats = this.getStats();
    const activeAlerts = this.alerts.filter((a) => !a.acknowledged);

    let html = `
      <div style="font-weight: bold; margin-bottom: 8px; color: ${this.theme.accent};">
        Performance Dashboard
      </div>
    `;

    // Current metrics
    html += `
      <div style="margin-bottom: 8px;">
        <div>FPS: <span style="color: ${this.getFPSColor(realTimeData.current.fps)};">${realTimeData.current.fps.toFixed(1)}</span></div>
        <div>Frame: ${realTimeData.current.frameTime.toFixed(2)}ms</div>
        <div>Memory: ${realTimeData.current.memory.toFixed(1)}MB</div>
        <div>Culling: ${realTimeData.current.cullingEfficiency.toFixed(1)}%</div>
      </div>
    `;

    // Statistics
    html += `
      <div style="margin-bottom: 8px; border-top: 1px solid ${this.theme.border}; padding-top: 8px;">
        <div>Score: ${stats.performanceScore.toFixed(0)}/100</div>
        <div>Uptime: ${(stats.uptime / 1000).toFixed(1)}s</div>
        <div>Frames: ${stats.totalFrames}</div>
      </div>
    `;

    // Alerts
    if (activeAlerts.length > 0) {
      html += `
        <div style="margin-top: 8px; border-top: 1px solid ${this.theme.border}; padding-top: 8px;">
          <div style="font-weight: bold; color: ${this.theme.warning};">Alerts (${activeAlerts.length})</div>
      `;

      for (const alert of activeAlerts.slice(0, 3)) {
        const color = alert.severity === 'critical' ? this.theme.error : this.theme.warning;
        html += `<div style="color: ${color}; font-size: 11px;">${alert.title}: ${alert.message}</div>`;
      }

      html += '</div>';
    }

    this.container.innerHTML = html;
  }

  private getFPSColor(fps: number): string {
    if (fps >= 50) return this.theme.success;
    if (fps >= 30) return this.theme.warning;
    return this.theme.error;
  }

  /**
   * Toggle dashboard visibility
   */
  public toggle(): void {
    this.isVisible = !this.isVisible;
    if (this.container) {
      this.container.style.display = this.isVisible ? 'block' : 'none';
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<DashboardConfig>): void {
    this.config = { ...this.config, ...config };
    this.theme = this.createTheme();

    if (this.container) {
      this.container.remove();
      this.container = null;
      if (this.isVisible) {
        this.createDOMElements();
      }
    }
  }

  /**
   * Export dashboard data
   */
  public exportData(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(
        {
          config: this.config,
          metrics: this.metrics,
          alerts: this.alerts,
          stats: this.getStats(),
          timestamp: Date.now(),
        },
        null,
        2
      );
    }

    // CSV export (simplified)
    const headers = ['timestamp', 'fps', 'frameTime', 'memory', 'cullingEfficiency'];
    const rows = [headers.join(',')];

    for (let i = 0; i < this.metrics.fps.length; i++) {
      const row = [
        this.metrics.timestamps[i] || 0,
        this.metrics.fps[i] || 0,
        this.metrics.frameTime[i] || 0,
        this.metrics.heapUsed[i] || 0,
        this.metrics.cullingEfficiency[i] || 0,
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Get active alerts
   */
  public getAlerts(): DashboardAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge alert
   */
  public acknowledgeAlert(id: string): void {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.stop();

    if (this.container) {
      this.container.remove();
      this.container = null;
    }

    this.metrics = this.createEmptyMetrics();
    this.alerts = [];
    this.charts.clear();

    console.log('[DASHBOARD] DashboardManager disposed');
  }
}
