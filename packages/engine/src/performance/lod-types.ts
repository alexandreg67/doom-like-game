/**
 * LOD (Level of Detail) system types and interfaces
 * Provides automatic geometry and texture optimization based on distance
 */

export interface LODLevel {
  distance: number;
  geometryScale: number; // 0.0 - 1.0
  textureScale: number; // 0.0 - 1.0
  name: string;
  cullSmallObjects: boolean;
  maxTriangles?: number;
  maxVertices?: number;
}

export interface LODConfig {
  enableGeometryLOD: boolean;
  enableTextureLOD: boolean;
  enableCulling: boolean;
  updateFrequency: number; // frames between updates
  hysteresisDistance: number; // prevent flickering between levels
  levels: LODLevel[];
  globalLODBias: number; // -1.0 to 1.0, shifts LOD levels
}

export interface LODInstance {
  meshId: string;
  currentLevel: number;
  targetLevel: number;
  lastDistance: number;
  lastUpdateFrame: number;
  originalGeometry?: {
    vertexCount: number;
    triangleCount: number;
    boundingBox: {
      min: { x: number; y: number; z: number };
      max: { x: number; y: number; z: number };
    };
  };
  lodGeometry?: Map<number, unknown>; // Pre-computed LOD geometries
  lodTextures?: Map<number, string>; // Pre-computed LOD textures
  isVisible: boolean;
  isCulled: boolean;
}

export interface LODMetrics {
  totalMeshes: number;
  activeMeshes: number;
  culledMeshes: number;
  levelDistribution: Record<number, number>;
  geometryMemory: number; // MB
  textureMemory: number; // MB
  processingTime: number; // ms
  transitionCount: number;
}

export interface GeometryLODOptions {
  preserveBoundary: boolean;
  preserveUVs: boolean;
  preserveNormals: boolean;
  maxSimplificationRatio: number; // 0.0 - 1.0
  adaptiveThreshold: number;
}

export interface TextureLODOptions {
  mipmapGeneration: boolean;
  compressionQuality: number; // 0.0 - 1.0
  formatFallback: string[];
  anisotropicFiltering: number;
}

export interface LODTransition {
  meshId: string;
  fromLevel: number;
  toLevel: number;
  startTime: number;
  duration: number; // ms
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface LODCullingData {
  boundingSphere: {
    center: { x: number; y: number; z: number };
    radius: number;
  };
  screenSpaceSize: number;
  pixelThreshold: number;
  importance: number; // 0.0 - 1.0
}
