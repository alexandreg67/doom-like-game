import type { Vector2, Vector3 } from '@babylonjs/core';

/**
 * DOOM-like geometry types for the engine
 * These types are optimized for rendering and performance
 */

export interface DoomVertex {
  id: string;
  position: Vector2;
}

export interface DoomSector {
  id: string;
  floorHeight: number;
  ceilingHeight: number;
  floorTexture: string;
  ceilingTexture: string;
  lightLevel: number; // 0-255, DOOM-style lighting; normalize to 0-1 for Babylon.js
  vertices: DoomVertex[];
  lineDefs: DoomLineDef[];
  neighbors: DoomSector[];

  // Rendering optimization data
  boundingBox: {
    min: Vector2;
    max: Vector2;
  };
  triangulatedVertices?: Vector2[]; // For mesh generation
  meshId?: string; // Reference to Babylon.js mesh
}

export interface DoomLineDef {
  id: string;
  startVertex: DoomVertex;
  endVertex: DoomVertex;
  frontSide?: DoomSideDef;
  backSide?: DoomSideDef;
  flags: DoomLineFlags;

  // Rendering data
  normal: Vector2; // Perpendicular to line for culling
  length: number; // Cached length for performance
}

export interface DoomSideDef {
  id: string;
  sector: DoomSector;
  textureUpper: string;
  textureMiddle: string;
  textureLower: string;
  offsetX: number;
  offsetY: number;

  // Rendering optimization
  needsUpperTexture: boolean;
  needsLowerTexture: boolean;
  needsMiddleTexture: boolean;
}

export interface DoomLineFlags {
  blocking: boolean;
  blockMonsters: boolean;
  twoSided: boolean;
  upperUnpegged: boolean;
  lowerUnpegged: boolean;
  secret: boolean;
  soundBlock: boolean;
  dontDraw: boolean;
  mapped: boolean;
}

export interface DoomMap {
  sectors: DoomSector[];
  vertices: DoomVertex[];
  lineDefs: DoomLineDef[];
  sideDefs: DoomSideDef[];

  // BSP data (will be added in Story 4)
  bspTree?: BSPNode;
}

// BSP Tree structure (placeholder for Story 4)
export interface BSPNode {
  id: string;
  isLeaf: boolean;
  splitLine?: DoomLineDef;
  frontChild?: BSPNode;
  backChild?: BSPNode;
  sectors?: DoomSector[]; // Only for leaf nodes
}

// Utility types for geometry operations
export interface GeometryBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface TriangulationResult {
  vertices: Vector3[];
  indices: number[];
  uvs: Vector2[];
}
