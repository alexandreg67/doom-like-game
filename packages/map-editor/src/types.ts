export interface MapData {
  sectors: Sector[];
  lineDefs: LineDef[];
  vertices: Vertex[];
  sideDefs: SideDef[];
}

export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface SideDef {
  id: string;
  sector: string; // Reference to sector ID
  textureUpper: string;
  textureMiddle: string;
  textureLower: string;
  offsetX: number;
  offsetY: number;
}

export interface LineDef {
  id: string;
  startVertex: string; // Reference to vertex ID
  endVertex: string; // Reference to vertex ID
  frontSide?: string; // Reference to sideDef ID
  backSide?: string; // Reference to sideDef ID
  flags: LineDefFlags;
  special: number; // Special action (doors, lifts, etc.)
  tag: number; // Sector tag for special actions
}

export interface LineDefFlags {
  blocking: boolean; // Blocks player and monsters
  blockMonsters: boolean; // Blocks monsters only
  twoSided: boolean; // Line has both front and back sides
  upperUnpegged: boolean; // Upper texture is unpegged
  lowerUnpegged: boolean; // Lower texture is unpegged
  secret: boolean; // Secret line (for automap)
  soundBlock: boolean; // Blocks sound
  dontDraw: boolean; // Never shown on automap
  mapped: boolean; // Already seen on automap
}

export interface Sector {
  id: string;
  floorHeight: number;
  ceilingHeight: number;
  floorTexture: string;
  ceilingTexture: string;
  lightLevel: number; // 0-255, DOOM-style lighting
  special: number; // Special sector type (damage, secret, etc.)
  tag: number; // Tag for special actions
  vertices: string[]; // References to vertex IDs forming the sector boundary
  neighbors: string[]; // References to adjacent sector IDs
}

// Legacy compatibility - will be removed in future versions
export interface Line {
  id: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
}
