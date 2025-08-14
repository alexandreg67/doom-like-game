import { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector, GeometryBounds, TriangulationResult } from './doom-geometry';

/**
 * SectorGeometry class handles geometric operations for DOOM-like sectors
 * Optimized for Babylon.js rendering and DOOM-style 2.5D geometry
 */
export class SectorGeometry {
  private sector: DoomSector;
  private _boundingBox?: GeometryBounds | undefined;
  private _triangulationCache?: TriangulationResult | undefined;

  constructor(sector: DoomSector) {
    this.sector = sector;
    this.validateSector();
    this.calculateBoundingBox();
  }

  /**
   * Validates that the sector has valid geometry
   * Throws error if sector is malformed
   */
  private validateSector(): void {
    if (this.sector.vertices.length < 3) {
      throw new Error(`Sector ${this.sector.id} must have at least 3 vertices`);
    }

    // Check for duplicate vertices
    const uniqueVertices = new Set(
      this.sector.vertices.map((v) => `${v.position.x},${v.position.y}`)
    );
    if (uniqueVertices.size !== this.sector.vertices.length) {
      throw new Error(`Sector ${this.sector.id} contains duplicate vertices`);
    }

    // Validate height relationship
    if (this.sector.floorHeight >= this.sector.ceilingHeight) {
      throw new Error(`Sector ${this.sector.id} floor height must be less than ceiling height`);
    }
  }

  /**
   * Calculates and caches the 2D bounding box of the sector
   */
  private calculateBoundingBox(): void {
    // Note: validateSector() ensures we have at least 3 vertices, so no empty checks are needed.
    const firstVertex = this.sector.vertices[0]!;

    let minX = firstVertex.position.x;
    let maxX = minX;
    let minY = firstVertex.position.y;
    let maxY = minY;

    for (let i = 1; i < this.sector.vertices.length; i++) {
      const vertex = this.sector.vertices[i]!;
      minX = Math.min(minX, vertex.position.x);
      maxX = Math.max(maxX, vertex.position.x);
      minY = Math.min(minY, vertex.position.y);
      maxY = Math.max(maxY, vertex.position.y);
    }

    this._boundingBox = {
      minX,
      maxX,
      minY,
      maxY,
      minZ: this.sector.floorHeight,
      maxZ: this.sector.ceilingHeight,
    };
  }

  /**
   * Returns the 3D bounding box of the sector
   */
  get boundingBox(): GeometryBounds {
    if (!this._boundingBox) {
      this.calculateBoundingBox();
    }
    return this._boundingBox as GeometryBounds;
  }

  /**
   * Calculates the area of the sector using the shoelace formula
   */
  get area(): number {
    // Note: validateSector() ensures at least 3 vertices.
    let area = 0;
    const vertices = this.sector.vertices;

    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      const vi = vertices[i]!;
      const vj = vertices[j]!;
      area += vi.position.x * vj.position.y;
      area -= vj.position.x * vi.position.y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * Calculates the centroid (center point) of the sector
   */
  get centroid(): Vector2 {
    let sumX = 0;
    let sumY = 0;

    for (const vertex of this.sector.vertices) {
      sumX += vertex.position.x;
      sumY += vertex.position.y;
    }

    return new Vector2(sumX / this.sector.vertices.length, sumY / this.sector.vertices.length);
  }

  /**
   * Checks if vertices are ordered clockwise
   * Uses shoelace formula: negative area = clockwise in screen coordinates
   */
  get isClockwise(): boolean {
    let sum = 0;
    const vertices = this.sector.vertices;

    for (let i = 0; i < vertices.length; i++) {
      const curr = vertices[i]!;
      const next = vertices[(i + 1) % vertices.length]!;
      sum += (next.position.x - curr.position.x) * (next.position.y + curr.position.y);
    }

    // In screen coordinates (Y down), clockwise polygons have positive area
    // In math coordinates (Y up), clockwise polygons have negative area
    // DOOM uses screen coordinates convention
    return sum > 0;
  }

  /**
   * Ensures vertices are ordered clockwise (DOOM convention)
   */
  ensureClockwiseOrder(): void {
    if (!this.isClockwise) {
      this.sector.vertices.reverse();
      this._triangulationCache = undefined;
    }
  }

  /**
   * Checks if a 2D point is inside the sector
   * Uses ray casting algorithm
   */
  containsPoint(point: Vector2): boolean {
    let inside = false;
    const vertices = this.sector.vertices;

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      const vi = vertices[i]!.position;
      const vj = vertices[j]!.position;

      if (
        vi.y > point.y !== vj.y > point.y &&
        point.x < ((vj.x - vi.x) * (point.y - vi.y)) / (vj.y - vi.y) + vi.x
      ) {
        inside = !inside;
      }
    }

    return inside;
  }

  /**
   * Triangulates the sector for mesh generation
   * Uses ear clipping algorithm for simple polygons
   */
  triangulate(): TriangulationResult {
    if (this._triangulationCache) {
      return this._triangulationCache;
    }

    this.ensureClockwiseOrder();

    // Simple triangulation for convex polygons
    // For complex polygons, we'll need a more sophisticated algorithm
    const vertices: Vector3[] = [];
    const indices: number[] = [];
    const uvs: Vector2[] = [];

    // Generate floor vertices
    for (const vertex of this.sector.vertices) {
      vertices.push(new Vector3(vertex.position.x, this.sector.floorHeight, vertex.position.y));
      // Simple UV mapping - can be improved later
      const bounds = this.boundingBox;
      const u = (vertex.position.x - bounds.minX) / (bounds.maxX - bounds.minX);
      const v = (vertex.position.y - bounds.minY) / (bounds.maxY - bounds.minY);
      uvs.push(new Vector2(u, v));
    }

    // Generate ceiling vertices
    for (const vertex of this.sector.vertices) {
      vertices.push(new Vector3(vertex.position.x, this.sector.ceilingHeight, vertex.position.y));
      // Ceiling UVs (flipped for proper texture mapping)
      const bounds = this.boundingBox;
      const u = (vertex.position.x - bounds.minX) / (bounds.maxX - bounds.minX);
      const v = 1 - (vertex.position.y - bounds.minY) / (bounds.maxY - bounds.minY);
      uvs.push(new Vector2(u, v));
    }

    // Triangulate floor (counter-clockwise for upward normal)
    for (let i = 1; i < this.sector.vertices.length - 1; i++) {
      indices.push(0, i + 1, i);
    }

    // Triangulate ceiling (clockwise for downward normal)
    const vertexCount = this.sector.vertices.length;
    for (let i = 1; i < vertexCount - 1; i++) {
      indices.push(vertexCount, vertexCount + i, vertexCount + i + 1);
    }

    this._triangulationCache = { vertices, indices, uvs };
    return this._triangulationCache;
  }

  /**
   * Generates wall geometry between this sector and adjacent sectors
   * Returns geometry for walls that need rendering
   */
  generateWallGeometry(lineDef: DoomLineDef): TriangulationResult | null {
    if (!lineDef.frontSide || !lineDef.backSide) {
      // Single-sided line - full wall
      return this.generateFullWall(lineDef);
    }

    // Two-sided line - partial walls
    return this.generatePartialWalls(lineDef);
  }

  private generateFullWall(lineDef: DoomLineDef): TriangulationResult {
    const start = lineDef.startVertex.position;
    const end = lineDef.endVertex.position;
    const floorHeight = this.sector.floorHeight;
    const ceilingHeight = this.sector.ceilingHeight;

    const vertices = [
      // Bottom edge
      new Vector3(start.x, floorHeight, start.y),
      new Vector3(end.x, floorHeight, end.y),
      // Top edge
      new Vector3(end.x, ceilingHeight, end.y),
      new Vector3(start.x, ceilingHeight, start.y),
    ];

    const wallLength = lineDef.length;
    const wallHeight = ceilingHeight - floorHeight;

    const uvs = [
      new Vector2(0, 0),
      new Vector2(wallLength / 64, 0), // Assuming 64-unit texture width
      new Vector2(wallLength / 64, wallHeight / 64),
      new Vector2(0, wallHeight / 64),
    ];

    // Two triangles forming a quad
    const indices = [0, 1, 2, 0, 2, 3];

    return { vertices, indices, uvs };
  }

  private generatePartialWalls(_lineDef: DoomLineDef): TriangulationResult {
    // TODO: Implement upper/lower wall generation for sectors with different heights
    // This will be needed when we have adjacent sectors with different floor/ceiling heights
    throw new Error('Partial wall generation not yet implemented');
  }

  /**
   * Invalidates cached geometry data
   * Call when sector geometry changes
   */
  invalidateCache(): void {
    this._boundingBox = undefined;
    this._triangulationCache = undefined;
  }

  /**
   * Updates the sector reference and invalidates caches
   */
  updateSector(sector: DoomSector): void {
    this.sector = sector;
    this.invalidateCache();
    this.validateSector();
    this.calculateBoundingBox();
  }
}
