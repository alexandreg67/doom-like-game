export { Engine } from './core/engine';
export { WebGPURenderer } from './rendering/webgpu-renderer';
export { WebGLRenderer } from './rendering/webgl-renderer';
export { SceneManager } from './core/scene-manager';
export { AssetLoader } from './assets/asset-loader';
export { TextureManager } from './assets/texture-manager';
export { SectorGeometry } from './geometry/sector-geometry';
export {
  parseLevel,
  loadLevelFromJSON,
  loadLevelFromURL,
} from './geometry/level-loader';
export {
  LightManager,
  SectorLightingManager,
  FogManager,
  LightingDebugUI,
} from './lighting';

// Physics system
export {
  CollisionDetector,
  PhysicsController,
  DEFAULT_PHYSICS_CONFIG,
  PHYSICS_CONSTANTS,
} from './physics';

// Performance monitoring and optimization
export {
  PerformanceManager,
  BSPCuller,
  LightPoolManager,
  ShadowPoolManager,
  OptimizedLightingSystem,
  LODManager,
  GeometrySimplifier,
  DashboardManager,
} from './performance';

export type {
  MovementInput,
  PhysicsConfig,
  CollisionEvent,
  CollisionGeometry,
  CollisionResult,
  PlayerController,
  PhysicsMetrics,
} from './physics';
export type { EngineConfig, RenderConfig } from './types';
export type {
  DoomVertex,
  DoomSector,
  DoomLineDef,
  DoomSideDef,
  DoomLineFlags,
  DoomMap,
  BSPNode,
  GeometryBounds,
  TriangulationResult,
} from './geometry/doom-geometry';
export type {
  LevelData,
  ParsedLevel,
  LevelVertexData,
  LevelSectorData,
  LevelLineDefData,
  LevelPlayerStart,
} from './geometry/level-loader';
export type {
  LightConfig,
  LightType,
  ShadowConfig,
  FogConfig,
  SectorLightingConfig,
  LightTransition,
  LightingSystemConfig,
  LightInstance,
  LightingMetrics,
  FogSystemState,
} from './lighting';
export type {
  PerformanceMetrics,
  BSPMetrics,
  CullingMetrics,
  PerformanceConfig,
  PerformanceAlert,
  CullingConfig,
  LODLevel,
  LODConfig,
  LODMetrics,
  GeometryLODOptions,
  TextureLODOptions,
  DashboardConfig,
  DashboardMetrics,
  DashboardAlert,
  MetricChart,
  RealTimeData,
  PerformanceStats,
  DashboardTheme,
} from './performance';
