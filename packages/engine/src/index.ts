export { Engine } from './core/engine';
export { WebGPURenderer } from './rendering/webgpu-renderer';
export { WebGLRenderer } from './rendering/webgl-renderer';
export { SceneManager } from './core/scene-manager';
export { AssetLoader } from './assets/asset-loader';
export { SectorGeometry } from './geometry/sector-geometry';
export { LevelLoader } from './geometry/level-loader';

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
