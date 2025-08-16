/**
 * Debug visualization types and interfaces
 * Visual debugging tools for performance optimization
 */

export interface DebugConfig {
  enabled: boolean;
  showBSPTree: boolean;
  showCullingInfo: boolean;
  showLODTransitions: boolean;
  showLightingDebug: boolean;
  showPerformanceMetrics: boolean;
  wireframeMode: boolean;
  colorByDepth: boolean;
  showBoundingBoxes: boolean;
  overlayPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  opacity: number; // 0.0 to 1.0
  refreshRate: number; // Hz
}

export interface DebugVisualization {
  id: string;
  type: 'bsp' | 'culling' | 'lod' | 'lighting' | 'performance';
  enabled: boolean;
  priority: number;
  render: (context: DebugRenderContext) => void;
  update: (deltaTime: number) => void;
  dispose: () => void;
}

export interface DebugRenderContext {
  scene: any; // Babylon.js Scene
  engine: any; // Babylon.js Engine
  camera: any; // Babylon.js Camera
  canvas: HTMLCanvasElement;
  ctx2d?: CanvasRenderingContext2D;
  overlay: HTMLElement;
  metrics: DebugMetrics;
}

export interface DebugMetrics {
  frameTime: number;
  fps: number;
  memory: {
    used: number;
    total: number;
  };
  culling: {
    sectorsVisible: number;
    sectorsTotal: number;
    cullingTime: number;
  };
  lighting: {
    lightsActive: number;
    lightsTotal: number;
    shadowMaps: number;
    lightingTime: number;
  };
  lod: {
    meshesManaged: number;
    transitionsThisFrame: number;
    memoryOptimized: number;
  };
  bsp: {
    nodesTraversed: number;
    cullingEfficiency: number;
    traversalTime: number;
  };
}

export interface BSPDebugInfo {
  nodes: BSPNodeDebug[];
  camera: {
    position: [number, number, number];
    direction: [number, number, number];
  };
  cullingResult: {
    visibleNodes: string[];
    culledNodes: string[];
  };
}

export interface BSPNodeDebug {
  id: string;
  depth: number;
  bounds: {
    min: [number, number, number];
    max: [number, number, number];
  };
  splitPlane?: {
    normal: [number, number, number];
    distance: number;
  };
  isLeaf: boolean;
  visible: boolean;
  culled: boolean;
  children?: string[];
  sectors?: string[];
}

export interface LODDebugInfo {
  meshes: LODMeshDebug[];
  camera: {
    position: [number, number, number];
  };
  transitions: LODDebugTransition[];
}

export interface LODMeshDebug {
  id: string;
  name: string;
  position: [number, number, number];
  distance: number;
  currentLOD: number;
  availableLODs: number;
  transitionState: 'stable' | 'transitioning' | 'hysteresis';
  vertexCount: number;
  memoryUsage: number;
}

export interface LODDebugTransition {
  meshId: string;
  from: number;
  to: number;
  progress: number; // 0.0 to 1.0
  reason: 'distance' | 'performance' | 'memory';
}

export interface LightingDebugInfo {
  lights: LightDebug[];
  shadowMaps: ShadowMapDebug[];
  camera: {
    position: [number, number, number];
    direction: [number, number, number];
  };
  cullingResult: {
    visibleLights: string[];
    culledLights: string[];
  };
}

export interface LightDebug {
  id: string;
  type: 'directional' | 'point' | 'spot';
  position: [number, number, number];
  direction?: [number, number, number];
  intensity: number;
  range: number;
  visible: boolean;
  culled: boolean;
  castsShadows: boolean;
  shadowMapIndex?: number;
}

export interface ShadowMapDebug {
  id: string;
  lightId: string;
  size: number;
  updateFrequency: number;
  lastUpdate: number;
  memoryUsage: number;
}

export interface DebugWireframe {
  vertices: Float32Array;
  indices: Uint16Array;
  color: [number, number, number, number];
  lineWidth: number;
  drawMode: 'lines' | 'line_strip' | 'line_loop';
}

export interface DebugOverlayElement {
  id: string;
  type: 'text' | 'chart' | 'graph' | 'heatmap';
  position: { x: number; y: number };
  size: { width: number; height: number };
  content: unknown;
  style: {
    backgroundColor?: string;
    textColor?: string;
    fontSize?: number;
    fontFamily?: string;
    borderColor?: string;
    borderWidth?: number;
    opacity?: number;
  };
}

export interface PerformanceChart {
  type: 'line' | 'bar' | 'area';
  data: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      color: string;
      fill?: boolean;
    }[];
  };
  options: {
    maxDataPoints: number;
    timeWindow: number; // milliseconds
    showLegend: boolean;
    showGrid: boolean;
    yAxis: {
      min?: number;
      max?: number;
      unit?: string;
    };
  };
}

export interface DebugHeatmap {
  width: number;
  height: number;
  data: Float32Array; // Heat values 0.0 to 1.0
  colorMap: 'hot' | 'cool' | 'jet' | 'viridis';
  min: number;
  max: number;
  overlay: boolean;
}

export interface DebugColorScheme {
  bspNodes: {
    visible: string;
    culled: string;
    leaf: string;
    branch: string;
  };
  lodLevels: string[]; // Colors for LOD 0, 1, 2, 3+
  lighting: {
    directional: string;
    point: string;
    spot: string;
    shadow: string;
  };
  performance: {
    good: string;
    warning: string;
    critical: string;
  };
}

export interface DebugAnnotation {
  id: string;
  worldPosition: [number, number, number];
  screenPosition?: [number, number];
  text: string;
  color: string;
  fontSize: number;
  background: boolean;
  arrow: boolean;
  lifetime?: number; // Auto-remove after this time (ms)
  createdAt?: number; // Timestamp when annotation was created
}

export interface DebugEvent {
  type: 'lod-transition' | 'culling-change' | 'light-toggle' | 'performance-spike';
  timestamp: number;
  data: unknown;
  severity: 'info' | 'warning' | 'error';
  message: string;
}
