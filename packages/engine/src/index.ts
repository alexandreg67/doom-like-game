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
export { CollisionDetector, PhysicsController } from './physics';

export type {
  MovementInput,
  PhysicsConfig,
  CollisionEvent,
  CollisionGeometry,
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
