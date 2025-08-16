/**
 * Performance Dashboard types and interfaces
 * Real-time performance monitoring and visualization
 */

export interface DashboardConfig {
  updateInterval: number; // ms
  maxDataPoints: number;
  enableCharts: boolean;
  enableAlerts: boolean;
  autoScale: boolean;
  displayMode: 'overlay' | 'panel' | 'minimal';
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0.0 - 1.0
  theme: 'dark' | 'light' | 'auto';
}

export interface MetricChart {
  id: string;
  title: string;
  type: 'line' | 'bar' | 'gauge' | 'histogram';
  dataKey: string;
  color: string;
  unit: string;
  min?: number;
  max?: number;
  threshold?: {
    warning: number;
    critical: number;
  };
  visible: boolean;
  smoothing: boolean;
}

export interface DashboardMetrics {
  // Performance metrics
  fps: number[];
  frameTime: number[];
  renderTime: number[];

  // Memory metrics
  heapUsed: number[];
  textureMemory: number[];
  bufferMemory: number[];

  // Engine metrics
  bspTraversalTime: number[];
  lightingTime: number[];
  lodProcessingTime: number[];

  // Culling metrics
  cullingEfficiency: number[];
  visibleSectors: number[];
  culledObjects: number[];

  // Timing data
  timestamps: number[];
}

export interface DashboardAlert {
  id: string;
  type: 'performance' | 'memory' | 'culling' | 'rendering';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  duration?: number; // ms to keep visible
  acknowledged: boolean;
}

export interface DashboardSection {
  id: string;
  title: string;
  charts: MetricChart[];
  collapsed: boolean;
  priority: number;
}

export interface DashboardLayout {
  sections: DashboardSection[];
  customWidgets: DashboardWidget[];
  gridSize: { width: number; height: number };
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'gauge' | 'text' | 'alert' | 'custom';
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: Record<string, unknown>;
  visible: boolean;
}

export interface RealTimeData {
  current: {
    fps: number;
    frameTime: number;
    memory: number;
    cullingEfficiency: number;
    alertCount: number;
  };
  average: {
    fps: number;
    frameTime: number;
    memory: number;
  };
  peak: {
    frameTime: number;
    memory: number;
  };
}

export interface PerformanceStats {
  uptime: number;
  totalFrames: number;
  averageFPS: number;
  frameDrops: number;
  memoryLeaks: number;
  performanceScore: number; // 0-100
}

export interface DashboardTheme {
  background: string;
  foreground: string;
  accent: string;
  success: string;
  warning: string;
  error: string;
  border: string;
  text: {
    primary: string;
    secondary: string;
    muted: string;
  };
  chart: {
    grid: string;
    axis: string;
    colors: string[];
  };
}

export interface DashboardExport {
  format: 'json' | 'csv' | 'png' | 'pdf';
  timeRange: {
    start: number;
    end: number;
  };
  metrics: string[];
  includeCharts: boolean;
  includeAlerts: boolean;
}
