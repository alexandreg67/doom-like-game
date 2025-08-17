import { Color3, Vector2, Vector3 } from '@babylonjs/core';
import type { LightConfig, LightingSystemConfig, SectorLightingConfig } from '../lighting';
import { Logger } from '../utils/logger';
import type {
  DoomLineDef,
  DoomLineFlags,
  DoomSector,
  DoomSideDef,
  DoomVertex,
} from './doom-geometry';
import { validateLevel } from './level-validator';

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

// Raw JSON lighting data structures
interface RawLightingData {
  globalAmbient: {
    color: { r: number; g: number; b: number };
    intensity: number;
  };
  lights?: Array<{
    id: string;
    type: string;
    color: { r: number; g: number; b: number };
    intensity: number;
    enabled?: boolean;
    position?: { x: number; y: number; z: number };
    direction?: { x: number; y: number; z: number };
    range?: number;
    angle?: number;
    exponent?: number;
    shadows?: {
      enabled?: boolean;
      mapSize?: number;
      bias?: number;
      darkness?: number;
      useBlurExponentialShadowMap?: boolean;
      blurKernel?: number;
    };
  }>;
  sectorLighting?: Array<{
    sectorId: string;
    ambient: {
      color: { r: number; g: number; b: number };
      intensity: number;
    };
    lights?: string[];
    fog?: {
      enabled?: boolean;
      mode?: string;
      color: { r: number; g: number; b: number };
      density?: number;
      start?: number;
      end?: number;
    };
    transitions?: Array<{
      toSectorId: string;
      duration?: number;
      easing?: string;
    }>;
  }>;
  performance?: {
    maxActiveLights?: number;
    shadowMapPoolSize?: number;
    cullingDistance?: number;
    enableLOD?: boolean;
  };
}

export interface LevelData {
  name: string;
  description: string;
  version: string;
  vertices: LevelVertexData[];
  sectors: LevelSectorData[];
  lineDefs: LevelLineDefData[];
  playerStart: LevelPlayerStart;
  lighting?: RawLightingData;
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
  lighting?: LightingSystemConfig | undefined;
}

/**
 * Generates missing wall lineDefs for sectors that don't have complete perimeter coverage
 * DISABLED: Caused z-fighting and sector separation issues
 */
/* function generateMissingWalls(
  sectors: Map<string, DoomSector>,
  existingLineDefs: DoomLineDef[]
): DoomLineDef[] {
  Logger.info('[LevelLoader] Checking for missing walls...');

  const additionalLineDefs: DoomLineDef[] = [];
  let wallCounter = 1000; // Start IDs at 1000 to avoid conflicts

  for (const sector of sectors.values()) {
    // Check if sector has lineDefs for all its edges
    const sectorVertices = sector.vertices;
    const sectorLineDefs = existingLineDefs.filter(
      (lineDef) =>
        lineDef.frontSide?.sector.id === sector.id || lineDef.backSide?.sector.id === sector.id
    );

    // Create a set of edges covered by existing lineDefs
    const coveredEdges = new Set<string>();
    for (const lineDef of sectorLineDefs) {
      const edgeKey1 = `${lineDef.startVertex.id}-${lineDef.endVertex.id}`;
      const edgeKey2 = `${lineDef.endVertex.id}-${lineDef.startVertex.id}`;
      coveredEdges.add(edgeKey1);
      coveredEdges.add(edgeKey2);
    }

    // Check each edge of the sector
    for (let i = 0; i < sectorVertices.length; i++) {
      const currentVertex = sectorVertices[i];
      const nextVertex = sectorVertices[(i + 1) % sectorVertices.length];

      if (!currentVertex || !nextVertex) continue;

      const edgeKey1 = `${currentVertex.id}-${nextVertex.id}`;
      const edgeKey2 = `${nextVertex.id}-${currentVertex.id}`;

      // If this edge is not covered by any lineDef, create one
      if (!coveredEdges.has(edgeKey1) && !coveredEdges.has(edgeKey2)) {
        Logger.info(
          `[LevelLoader] Creating missing wall for sector ${sector.id}: ${currentVertex.id} -> ${nextVertex.id}`
        );

        // Calculate line properties
        const dx = nextVertex.position.x - currentVertex.position.x;
        const dy = nextVertex.position.y - currentVertex.position.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const normal = new Vector2(-dy / length, dx / length);

        // Create the missing lineDef
        const missingLineDef: DoomLineDef = {
          id: `auto_wall_${wallCounter++}`,
          startVertex: currentVertex,
          endVertex: nextVertex,
          flags: {
            blocking: true,
            twoSided: false,
            dontDraw: false,
            mapped: true,
            soundBlock: false,
            secret: false,
            lowerUnpegged: false,
            upperUnpegged: false,
            blockMonsters: true,
          },
          frontSide: {
            id: `auto_wall_${wallCounter}_front`,
            sector: sector,
            textureMiddle: 'WALL_STONE',
            textureUpper: '-',
            textureLower: '-',
            offsetX: 0,
            offsetY: 0,
            needsUpperTexture: false,
            needsLowerTexture: false,
            needsMiddleTexture: true,
          },
          length,
          normal,
        };

        additionalLineDefs.push(missingLineDef);
        sector.lineDefs.push(missingLineDef);

        // Mark this edge as covered
        coveredEdges.add(edgeKey1);
        coveredEdges.add(edgeKey2);
      }
    }
  }

  Logger.info(`[LevelLoader] Generated ${additionalLineDefs.length} missing walls`);
  return additionalLineDefs;
} */

/**
 * Loads and parses a level from JSON data
 */
export function parseLevel(levelData: LevelData): ParsedLevel {
  Logger.info(`[LevelLoader] Loading level: ${levelData.name} v${levelData.version}`);

  // Validate level before parsing
  const validationResult = validateLevel(levelData);
  if (!validationResult.isValid) {
    Logger.error('[LevelLoader] Level validation failed:');
    for (const error of validationResult.errors) {
      Logger.error(`  - ${error}`);
    }
    throw new Error(`Level validation failed: ${validationResult.errors.join(', ')}`);
  }

  if (validationResult.warnings.length > 0) {
    Logger.warn('[LevelLoader] Level validation warnings:');
    for (const warning of validationResult.warnings) {
      Logger.warn(`  - ${warning}`);
    }
  }

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

  // NOTE: Auto-generation of missing walls disabled temporarily due to z-fighting issues
  // const additionalLineDefs = generateMissingWalls(sectors, lineDefs);
  // lineDefs.push(...additionalLineDefs);

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

  // Parse lighting configuration
  let lightingConfig: LightingSystemConfig | undefined;
  if (levelData.lighting) {
    lightingConfig = parseLightingConfig(levelData.lighting);
    Logger.info(`  - ${lightingConfig.lights.length} lights configured`);
    Logger.info(`  - ${lightingConfig.sectorLighting.length} sector lighting configurations`);
  }

  Logger.info('[LevelLoader] Level loaded successfully:');
  Logger.info(`  - ${vertices.size} vertices`);
  Logger.info(`  - ${sectors.size} sectors`);
  Logger.info(`  - ${lineDefs.length} lineDefs`);
  Logger.info(`  - Player starts in sector ${playerStart.sector.id}`);

  return {
    vertices,
    sectors,
    lineDefs,
    playerStart,
    lighting: lightingConfig,
  };
}

/**
 * Parses lighting configuration from JSON format to engine format
 */
function parseLightingConfig(lightingData: RawLightingData): LightingSystemConfig {
  Logger.info('[LevelLoader] Parsing lighting configuration...');

  const lightingConfig: LightingSystemConfig = {
    globalAmbient: {
      color: new Color3(
        lightingData.globalAmbient.color.r,
        lightingData.globalAmbient.color.g,
        lightingData.globalAmbient.color.b
      ),
      intensity: lightingData.globalAmbient.intensity,
    },
    lights: [],
    sectorLighting: [],
    performance: {
      maxActiveLights: lightingData.performance?.maxActiveLights || 8,
      shadowMapPoolSize: lightingData.performance?.shadowMapPoolSize || 4,
      cullingDistance: lightingData.performance?.cullingDistance || 25,
      enableLOD: lightingData.performance?.enableLOD ?? true,
    },
  };

  // Parse light configurations
  for (const lightData of lightingData.lights || []) {
    // Validate light type
    const allowedLightTypes: LightConfig['type'][] = [
      'point',
      'directional',
      'spot',
      'hemispheric',
    ];
    let lightType: LightConfig['type'] = 'point';
    if (allowedLightTypes.includes(lightData.type as LightConfig['type'])) {
      lightType = lightData.type as LightConfig['type'];
    } else {
      Logger.warn(
        `[LevelLoader] Invalid light type "${lightData.type}" for light "${lightData.id}". Defaulting to "point".`
      );
    }

    const lightConfig: LightConfig = {
      id: lightData.id,
      type: lightType,
      color: new Color3(lightData.color.r, lightData.color.g, lightData.color.b),
      intensity: lightData.intensity,
      enabled: lightData.enabled !== false,
    };

    // Add position if present
    if (lightData.position) {
      lightConfig.position = new Vector3(
        lightData.position.x,
        lightData.position.y,
        lightData.position.z
      );
    }

    // Add direction if present
    if (lightData.direction) {
      lightConfig.direction = new Vector3(
        lightData.direction.x,
        lightData.direction.y,
        lightData.direction.z
      );
    }

    // Add range for point/spot lights
    if (lightData.range !== undefined) {
      lightConfig.range = lightData.range;
    }

    // Add angle and exponent for spot lights
    if (lightData.angle !== undefined) {
      lightConfig.angle = lightData.angle;
    }
    if (lightData.exponent !== undefined) {
      lightConfig.exponent = lightData.exponent;
    }

    // Parse shadow configuration
    if (lightData.shadows) {
      lightConfig.shadows = {
        enabled: lightData.shadows.enabled || false,
        mapSize: lightData.shadows.mapSize || 1024,
        bias: lightData.shadows.bias || 0.0001,
        darkness: lightData.shadows.darkness || 0.3,
        useBlurExponentialShadowMap: lightData.shadows.useBlurExponentialShadowMap || false,
        blurKernel: lightData.shadows.blurKernel || 16,
      };
    }

    lightingConfig.lights.push(lightConfig);
  }

  // Parse sector lighting configurations
  for (const sectorData of lightingData.sectorLighting || []) {
    const sectorLightingConfig: SectorLightingConfig = {
      sectorId: sectorData.sectorId,
      ambient: {
        color: new Color3(
          sectorData.ambient.color.r,
          sectorData.ambient.color.g,
          sectorData.ambient.color.b
        ),
        intensity: sectorData.ambient.intensity,
      },
      lights: sectorData.lights || [],
    };

    // Parse fog configuration
    if (sectorData.fog) {
      sectorLightingConfig.fog = {
        enabled: sectorData.fog.enabled || false,
        mode: (sectorData.fog.mode as 'linear' | 'exponential' | 'exponential2') || 'linear',
        color: new Color3(sectorData.fog.color.r, sectorData.fog.color.g, sectorData.fog.color.b),
      };

      if (sectorData.fog.density !== undefined && sectorLightingConfig.fog) {
        sectorLightingConfig.fog.density = sectorData.fog.density;
      }
      if (sectorData.fog.start !== undefined && sectorLightingConfig.fog) {
        sectorLightingConfig.fog.start = sectorData.fog.start;
      }
      if (sectorData.fog.end !== undefined && sectorLightingConfig.fog) {
        sectorLightingConfig.fog.end = sectorData.fog.end;
      }
    }

    // Parse transitions
    if (sectorData.transitions) {
      sectorLightingConfig.transitions = sectorData.transitions.map((transition) => ({
        toSectorId: transition.toSectorId,
        duration: transition.duration || 1000,
        easing:
          (transition.easing as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out') || 'linear',
      }));
    }

    lightingConfig.sectorLighting.push(sectorLightingConfig);
  }

  Logger.info(
    `[LevelLoader] Parsed lighting config: ${lightingConfig.lights.length} lights, ${lightingConfig.sectorLighting.length} sectors`
  );
  return lightingConfig;
}

/**
 * Loads level data from JSON string
 */
export async function loadLevelFromJSON(jsonString: string): Promise<ParsedLevel> {
  const levelData: LevelData = JSON.parse(jsonString);
  return parseLevel(levelData);
}

/**
 * Loads level data from URL
 */
export async function loadLevelFromURL(url: string): Promise<ParsedLevel> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load level from ${url}: ${response.statusText}`);
  }
  const jsonString = await response.text();
  return loadLevelFromJSON(jsonString);
}
