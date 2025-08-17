import { Logger } from '../utils/logger';
import type { LevelData } from './level-loader';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalVertices: number;
    totalSectors: number;
    totalLineDefs: number;
    isolatedSectors: string[];
    uncoveredEdges: string[];
  };
}

/**
 * Validates level data for completeness and consistency
 */
export function validateLevel(levelData: LevelData): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  Logger.info(`[LevelValidator] Validating level: ${levelData.name}`);

  // Create vertex lookup
  const vertexMap = new Map<string, { x: number; y: number }>();
  for (const vertex of levelData.vertices) {
    vertexMap.set(vertex.id, vertex.position);
  }

  // Create sector lookup
  const sectorMap = new Map<
    string,
    { id: string; floorHeight: number; ceilingHeight: number; vertices: string[] }
  >();
  for (const sector of levelData.sectors) {
    sectorMap.set(sector.id, sector);
  }

  // Validate basic structure
  if (levelData.vertices.length < 3) {
    errors.push('Level must have at least 3 vertices');
  }

  if (levelData.sectors.length < 1) {
    errors.push('Level must have at least 1 sector');
  }

  if (levelData.lineDefs.length < 3) {
    errors.push('Level must have at least 3 lineDefs to form closed areas');
  }

  // Validate player start
  if (!levelData.playerStart) {
    errors.push('Level must have a player start position');
  } else {
    const startSector = sectorMap.get(levelData.playerStart.sector);
    if (!startSector) {
      errors.push(`Player start sector '${levelData.playerStart.sector}' not found`);
    }
  }

  // Validate sectors
  const isolatedSectors: string[] = [];
  for (const sector of levelData.sectors) {
    // Check if all sector vertices exist
    for (const vertexId of sector.vertices) {
      if (!vertexMap.has(vertexId)) {
        errors.push(`Sector '${sector.id}' references non-existent vertex '${vertexId}'`);
      }
    }

    // Check sector height consistency
    if (sector.floorHeight >= sector.ceilingHeight) {
      errors.push(
        `Sector '${sector.id}' has invalid height: floor (${sector.floorHeight}) >= ceiling (${sector.ceilingHeight})`
      );
    }

    // Check if sector has any lineDefs
    const sectorLineDefs = levelData.lineDefs.filter(
      (lineDef) => lineDef.frontSide?.sector === sector.id || lineDef.backSide?.sector === sector.id
    );

    if (sectorLineDefs.length === 0) {
      isolatedSectors.push(sector.id);
      warnings.push(`Sector '${sector.id}' has no lineDefs (isolated)`);
    }
  }

  // Validate lineDefs
  const edgeCoverage = new Map<string, string[]>(); // edge -> [lineDefIds]

  for (const lineDef of levelData.lineDefs) {
    // Check if vertices exist
    if (!vertexMap.has(lineDef.startVertex)) {
      errors.push(
        `LineDef '${lineDef.id}' references non-existent start vertex '${lineDef.startVertex}'`
      );
    }
    if (!vertexMap.has(lineDef.endVertex)) {
      errors.push(
        `LineDef '${lineDef.id}' references non-existent end vertex '${lineDef.endVertex}'`
      );
    }

    // Check if sectors exist
    if (!sectorMap.has(lineDef.frontSide.sector)) {
      errors.push(
        `LineDef '${lineDef.id}' front side references non-existent sector '${lineDef.frontSide.sector}'`
      );
    }

    if (lineDef.backSide && !sectorMap.has(lineDef.backSide.sector)) {
      errors.push(
        `LineDef '${lineDef.id}' back side references non-existent sector '${lineDef.backSide.sector}'`
      );
    }

    // Track edge coverage
    const edgeKey = `${lineDef.startVertex}-${lineDef.endVertex}`;
    const reverseEdgeKey = `${lineDef.endVertex}-${lineDef.startVertex}`;

    if (!edgeCoverage.has(edgeKey)) {
      edgeCoverage.set(edgeKey, []);
    }
    const edgeArray = edgeCoverage.get(edgeKey);
    if (edgeArray) {
      edgeArray.push(lineDef.id);
    }

    // Check for duplicate edges
    if (edgeCoverage.has(reverseEdgeKey)) {
      const reverseLineDefs = edgeCoverage.get(reverseEdgeKey);
      if (!reverseLineDefs) continue;
      if (reverseLineDefs.length > 0) {
        warnings.push(
          `Edge ${lineDef.startVertex}-${lineDef.endVertex} covered by multiple lineDefs: ${lineDef.id} and ${reverseLineDefs.join(', ')}`
        );
      }
    }

    // Validate two-sided lines
    if (lineDef.flags.twoSided && !lineDef.backSide) {
      errors.push(`LineDef '${lineDef.id}' is marked as two-sided but has no back side`);
    }

    if (!lineDef.flags.twoSided && lineDef.backSide) {
      warnings.push(`LineDef '${lineDef.id}' has back side but is not marked as two-sided`);
    }
  }

  // Check for uncovered sector edges
  const uncoveredEdges: string[] = [];

  for (const sector of levelData.sectors) {
    for (let i = 0; i < sector.vertices.length; i++) {
      const currentVertex = sector.vertices[i];
      const nextVertex = sector.vertices[(i + 1) % sector.vertices.length];

      const edgeKey1 = `${currentVertex}-${nextVertex}`;
      const edgeKey2 = `${nextVertex}-${currentVertex}`;

      if (!edgeCoverage.has(edgeKey1) && !edgeCoverage.has(edgeKey2)) {
        uncoveredEdges.push(edgeKey1);
        warnings.push(`Sector '${sector.id}' edge ${edgeKey1} has no corresponding lineDef`);
      }
    }
  }

  const stats = {
    totalVertices: levelData.vertices.length,
    totalSectors: levelData.sectors.length,
    totalLineDefs: levelData.lineDefs.length,
    isolatedSectors,
    uncoveredEdges,
  };

  const isValid = errors.length === 0;

  Logger.info(`[LevelValidator] Validation complete: ${isValid ? 'VALID' : 'INVALID'}`);
  Logger.info(`[LevelValidator] Errors: ${errors.length}, Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    Logger.error('[LevelValidator] Errors found:');
    for (const error of errors) {
      Logger.error(`  - ${error}`);
    }
  }

  if (warnings.length > 0) {
    Logger.warn('[LevelValidator] Warnings found:');
    for (const warning of warnings) {
      Logger.warn(`  - ${warning}`);
    }
  }

  return {
    isValid,
    errors,
    warnings,
    stats,
  };
}

/**
 * Validates a level and throws if invalid
 */
export function validateLevelOrThrow(levelData: LevelData): void {
  const result = validateLevel(levelData);
  if (!result.isValid) {
    throw new Error(`Level validation failed:\n${result.errors.join('\n')}`);
  }
}
