import { Vector2 } from '@babylonjs/core';
import type {
  DoomLineDef,
  DoomLineFlags,
  DoomSector,
  DoomSideDef,
  DoomVertex,
} from './doom-geometry';

// JSON format types
export interface LevelVertexData {
  id: string;
  position: { x: number; y: number };
}

export interface LevelSectorData {
  id: string;
  floorHeight: number;
  ceilingHeight: number;
  floorTexture: string;
  ceilingTexture: string;
  lightLevel: number;
  vertices: string[]; // vertex IDs
}

export interface LevelSideDefData {
  id: string;
  sector: string; // sector ID
  textureMiddle: string;
  textureUpper: string;
  textureLower: string;
  offsetX: number;
  offsetY: number;
  needsUpperTexture: boolean;
  needsLowerTexture: boolean;
  needsMiddleTexture: boolean;
}

export interface LevelLineDefData {
  id: string;
  startVertex: string; // vertex ID
  endVertex: string; // vertex ID
  flags: DoomLineFlags;
  frontSide: LevelSideDefData;
  backSide?: LevelSideDefData;
}

export interface LevelPlayerStart {
  position: { x: number; y: number };
  angle: number;
  sector: string; // sector ID
}

export interface LevelData {
  name: string;
  description: string;
  version: string;
  vertices: LevelVertexData[];
  sectors: LevelSectorData[];
  lineDefs: LevelLineDefData[];
  playerStart: LevelPlayerStart;
}

// Parsed level types
export interface ParsedLevel {
  vertices: Map<string, DoomVertex>;
  sectors: Map<string, DoomSector>;
  lineDefs: DoomLineDef[];
  playerStart: {
    position: Vector2;
    angle: number;
    sector: DoomSector;
  };
}

/**
 * Level loader that parses JSON level data into DOOM geometry structures
 */
export class LevelLoader {
  /**
   * Loads and parses a level from JSON data
   */
  public static parseLevel(levelData: LevelData): ParsedLevel {
    console.log(`[LevelLoader] Loading level: ${levelData.name} v${levelData.version}`);

    // Parse vertices first
    const vertices = new Map<string, DoomVertex>();
    for (const vertexData of levelData.vertices) {
      const vertex: DoomVertex = {
        id: vertexData.id,
        position: new Vector2(vertexData.position.x, vertexData.position.y),
      };
      vertices.set(vertex.id, vertex);
    }

    // Parse sectors (without lineDefs initially)
    const sectors = new Map<string, DoomSector>();
    for (const sectorData of levelData.sectors) {
      const sectorVertices: DoomVertex[] = [];

      // Resolve vertex references
      for (const vertexId of sectorData.vertices) {
        const vertex = vertices.get(vertexId);
        if (!vertex) {
          throw new Error(`Vertex ${vertexId} not found for sector ${sectorData.id}`);
        }
        sectorVertices.push(vertex);
      }

      // Calculate bounding box
      const minX = Math.min(...sectorVertices.map((v) => v.position.x));
      const maxX = Math.max(...sectorVertices.map((v) => v.position.x));
      const minY = Math.min(...sectorVertices.map((v) => v.position.y));
      const maxY = Math.max(...sectorVertices.map((v) => v.position.y));

      const sector: DoomSector = {
        id: sectorData.id,
        floorHeight: sectorData.floorHeight,
        ceilingHeight: sectorData.ceilingHeight,
        floorTexture: sectorData.floorTexture,
        ceilingTexture: sectorData.ceilingTexture,
        lightLevel: sectorData.lightLevel,
        vertices: sectorVertices,
        lineDefs: [], // Will be filled later
        neighbors: [], // Will be calculated later
        boundingBox: {
          min: new Vector2(minX, minY),
          max: new Vector2(maxX, maxY),
        },
        meshId: `sector_${sectorData.id}`,
      };

      sectors.set(sector.id, sector);
    }

    // Parse lineDefs
    const lineDefs: DoomLineDef[] = [];
    for (const lineDefData of levelData.lineDefs) {
      const startVertex = vertices.get(lineDefData.startVertex);
      const endVertex = vertices.get(lineDefData.endVertex);

      if (!startVertex || !endVertex) {
        throw new Error(
          `Vertices not found for lineDef ${lineDefData.id}: start=${lineDefData.startVertex}, end=${lineDefData.endVertex}`
        );
      }

      const frontSector = sectors.get(lineDefData.frontSide.sector);
      if (!frontSector) {
        throw new Error(
          `Front sector ${lineDefData.frontSide.sector} not found for lineDef ${lineDefData.id}`
        );
      }

      let backSector: DoomSector | undefined;
      if (lineDefData.backSide) {
        backSector = sectors.get(lineDefData.backSide.sector);
        if (!backSector) {
          throw new Error(
            `Back sector ${lineDefData.backSide.sector} not found for lineDef ${lineDefData.id}`
          );
        }
      }

      // Create front side
      const frontSide: DoomSideDef = {
        id: lineDefData.frontSide.id,
        sector: frontSector,
        textureMiddle: lineDefData.frontSide.textureMiddle,
        textureUpper: lineDefData.frontSide.textureUpper,
        textureLower: lineDefData.frontSide.textureLower,
        offsetX: lineDefData.frontSide.offsetX,
        offsetY: lineDefData.frontSide.offsetY,
        needsUpperTexture: lineDefData.frontSide.needsUpperTexture,
        needsLowerTexture: lineDefData.frontSide.needsLowerTexture,
        needsMiddleTexture: lineDefData.frontSide.needsMiddleTexture,
      };

      // Create back side if present
      let backSide: DoomSideDef | undefined;
      if (lineDefData.backSide && backSector) {
        backSide = {
          id: lineDefData.backSide.id,
          sector: backSector,
          textureMiddle: lineDefData.backSide.textureMiddle,
          textureUpper: lineDefData.backSide.textureUpper,
          textureLower: lineDefData.backSide.textureLower,
          offsetX: lineDefData.backSide.offsetX,
          offsetY: lineDefData.backSide.offsetY,
          needsUpperTexture: lineDefData.backSide.needsUpperTexture,
          needsLowerTexture: lineDefData.backSide.needsLowerTexture,
          needsMiddleTexture: lineDefData.backSide.needsMiddleTexture,
        };
      }

      // Calculate line properties
      const dx = endVertex.position.x - startVertex.position.x;
      const dy = endVertex.position.y - startVertex.position.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const normal = new Vector2(-dy / length, dx / length); // Perpendicular to the line, pointing right

      const lineDef: DoomLineDef = {
        id: lineDefData.id,
        startVertex,
        endVertex,
        flags: lineDefData.flags,
        frontSide,
        ...(backSide ? { backSide } : {}),
        length,
        normal,
      };

      lineDefs.push(lineDef);

      // Add lineDef to sectors
      frontSector.lineDefs.push(lineDef);
      if (backSector) {
        backSector.lineDefs.push(lineDef);

        // Add sectors as neighbors
        if (!frontSector.neighbors.includes(backSector)) {
          frontSector.neighbors.push(backSector);
        }
        if (!backSector.neighbors.includes(frontSector)) {
          backSector.neighbors.push(frontSector);
        }
      }
    }

    // Parse player start
    const playerStartSector = sectors.get(levelData.playerStart.sector);
    if (!playerStartSector) {
      throw new Error(`Player start sector ${levelData.playerStart.sector} not found`);
    }

    const playerStart = {
      position: new Vector2(levelData.playerStart.position.x, levelData.playerStart.position.y),
      angle: levelData.playerStart.angle,
      sector: playerStartSector,
    };

    console.log('[LevelLoader] Level loaded successfully:');
    console.log(`  - ${vertices.size} vertices`);
    console.log(`  - ${sectors.size} sectors`);
    console.log(`  - ${lineDefs.length} lineDefs`);
    console.log(`  - Player starts in sector ${playerStart.sector.id}`);

    return {
      vertices,
      sectors,
      lineDefs,
      playerStart,
    };
  }

  /**
   * Loads level data from JSON string
   */
  public static async loadFromJSON(jsonString: string): Promise<ParsedLevel> {
    const levelData: LevelData = JSON.parse(jsonString);
    return LevelLoader.parseLevel(levelData);
  }

  /**
   * Loads level data from URL
   */
  public static async loadFromURL(url: string): Promise<ParsedLevel> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load level from ${url}: ${response.statusText}`);
    }
    const jsonString = await response.text();
    return LevelLoader.loadFromJSON(jsonString);
  }
}
