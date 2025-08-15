import { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector, GeometryBounds, TriangulationResult } from './doom-geometry';

/**
 * SectorGeometry class handles geometric operations for DOOM-like sectors
 * Optimized for Babylon.js rendering and DOOM-style 2.5D geometry
 */
export class SectorGeometry {
  private sector: DoomSector;
  private _boundingBox?: GeometryBounds | undefined;

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
    // biome-ignore lint/style/noNonNullAssertion: validateSector ensures at least 3 vertices.
    const firstVertex = this.sector.vertices[0]!;

    let minX = firstVertex.position.x;
    let maxX = minX;
    let minY = firstVertex.position.y;
    let maxY = minY;

    for (let i = 1; i < this.sector.vertices.length; i++) {
      // biome-ignore lint/style/noNonNullAssertion: Loop bounds are checked.
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
    // biome-ignore lint/style/noNonNullAssertion: calculateBoundingBox is guaranteed to set this property.
    return this._boundingBox!;
  }

  /**
   * Calculates the area of the sector using the shoelace formula
   */
  get area(): number {
    const vertices = this.sector.vertices;
    if (vertices.length < 3) {
      return 0;
    }

    let area = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
      const vi = vertices[i]!;
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
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
    const vertices = this.sector.vertices;
    if (vertices.length === 0) {
      return new Vector2(0, 0);
    }

    let sumX = 0;
    let sumY = 0;

    for (const vertex of vertices) {
      sumX += vertex.position.x;
      sumY += vertex.position.y;
    }

    return new Vector2(sumX / vertices.length, sumY / vertices.length);
  }

  /**
   * Checks if vertices are ordered clockwise
   * Uses shoelace formula: negative area = clockwise in screen coordinates
   */
  get isClockwise(): boolean {
    const vertices = this.sector.vertices;
    if (vertices.length < 3) {
      return false;
    }

    let sum = 0;
    for (let i = 0; i < vertices.length; i++) {
      const j = (i + 1) % vertices.length;
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
      const curr = vertices[i]!;
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
      const next = vertices[j]!;
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
    }
  }

  /**
   * Checks if a 2D point is inside the sector
   * Uses ray casting algorithm
   */
  containsPoint(point: Vector2): boolean {
    let inside = false;
    const vertices = this.sector.vertices;
    if (vertices.length < 3) {
      return false;
    }

    for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
      const vi = vertices[i]!.position;
      // biome-ignore lint/style/noNonNullAssertion: Length is checked above.
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
   * Triangulates the sector floor for mesh generation
   */
  triangulateFloor(): TriangulationResult {
    this.ensureClockwiseOrder();

    const vertices: Vector3[] = [];
    const indices: number[] = [];
    const uvs: Vector2[] = [];

    for (const vertex of this.sector.vertices) {
      vertices.push(new Vector3(vertex.position.x, this.sector.floorHeight, vertex.position.y));
      const bounds = this.boundingBox;
      const u = (vertex.position.x - bounds.minX) / (bounds.maxX - bounds.minX);
      const v = (vertex.position.y - bounds.minY) / (bounds.maxY - bounds.minY);
      uvs.push(new Vector2(u, v));
    }

    // Triangulate floor (fan triangulation from the first vertex, counter-clockwise for upward normal)
    for (let i = 1; i < this.sector.vertices.length - 1; i++) {
      indices.push(0, i + 1, i);
    }

    return { vertices, indices, uvs };
  }

  /**
   * Triangulates the sector ceiling for mesh generation
   */
  triangulateCeiling(): TriangulationResult {
    this.ensureClockwiseOrder();

    const vertices: Vector3[] = [];
    const indices: number[] = [];
    const uvs: Vector2[] = [];

    for (const vertex of this.sector.vertices) {
      vertices.push(new Vector3(vertex.position.x, this.sector.ceilingHeight, vertex.position.y));
      const bounds = this.boundingBox;
      const u = (vertex.position.x - bounds.minX) / (bounds.maxX - bounds.minX);
      // UV coordinates normalized to sector bounding box
      const v = (vertex.position.y - bounds.minY) / (bounds.maxY - bounds.minY);
      uvs.push(new Vector2(u, v));
    }

    // Triangulate ceiling (fan triangulation from first vertex, clockwise for downward normal)
    for (let i = 1; i < this.sector.vertices.length - 1; i++) {
      indices.push(0, i, i + 1); // Consistent clockwise winding order
    }

    return { vertices, indices, uvs };
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

    // UV coordinates that match the vertex order: bottom-left, bottom-right, top-right, top-left
    const uvs = [
      new Vector2(0, 1), // bottom-left (start, floor) - bottom of texture
      new Vector2(1, 1), // bottom-right (end, floor) - bottom of texture
      new Vector2(1, 0), // top-right (end, ceiling) - top of texture
      new Vector2(0, 0), // top-left (start, ceiling) - top of texture
    ];

    // Two triangles forming a quad (counter-clockwise winding)
    // First triangle: 0->2->1 (bottom-left -> top-right -> bottom-right)
    // Second triangle: 0->3->2 (bottom-left -> top-left -> top-right)
    const indices = [0, 2, 1, 0, 3, 2];

    return { vertices, indices, uvs };
  }

  /**
   * Generates upper/lower wall geometry for sectors with different heights.
   * This handles the DOOM-like rendering where adjacent sectors can have different
   * floor/ceiling heights, requiring upper and lower wall segments.
   */
  private generatePartialWalls(lineDef: DoomLineDef): TriangulationResult {
    if (!lineDef.frontSide || !lineDef.backSide) {
      throw new Error('generatePartialWalls requires both front and back sides');
    }

    const frontSector = lineDef.frontSide.sector;
    const backSector = lineDef.backSide.sector;
    const start = lineDef.startVertex.position;
    const end = lineDef.endVertex.position;

    const vertices: Vector3[] = [];
    const indices: number[] = [];
    const uvs: Vector2[] = [];

    // Calculate wall segments based on height differences
    const frontFloor = frontSector.floorHeight;
    const frontCeiling = frontSector.ceilingHeight;
    const backFloor = backSector.floorHeight;
    const backCeiling = backSector.ceilingHeight;

    // Determine the visible wall segments
    const lowerWallTop = Math.max(frontFloor, backFloor);
    const upperWallBottom = Math.min(frontCeiling, backCeiling);

    let vertexIndex = 0;

    // Generate lower wall if back sector floor is higher than front sector floor
    if (backFloor > frontFloor && lineDef.frontSide.needsLowerTexture) {
      const lowerVertices = [
        new Vector3(start.x, frontFloor, start.y),
        new Vector3(end.x, frontFloor, end.y),
        new Vector3(end.x, backFloor, end.y),
        new Vector3(start.x, backFloor, start.y),
      ];

      const lowerUvs = [
        new Vector2(0, 1), // bottom-left
        new Vector2(1, 1), // bottom-right
        new Vector2(1, 0), // top-right
        new Vector2(0, 0), // top-left
      ];

      vertices.push(...lowerVertices);
      uvs.push(...lowerUvs);

      // Add indices for lower wall (2 triangles)
      const baseIndex = vertexIndex;
      indices.push(
        baseIndex,
        baseIndex + 2,
        baseIndex + 1, // First triangle
        baseIndex,
        baseIndex + 3,
        baseIndex + 2 // Second triangle
      );

      vertexIndex += 4;
    }

    // Generate upper wall if back sector ceiling is lower than front sector ceiling
    if (backCeiling < frontCeiling && lineDef.frontSide.needsUpperTexture) {
      const upperVertices = [
        new Vector3(start.x, backCeiling, start.y),
        new Vector3(end.x, backCeiling, end.y),
        new Vector3(end.x, frontCeiling, end.y),
        new Vector3(start.x, frontCeiling, start.y),
      ];

      const upperUvs = [
        new Vector2(0, 1), // bottom-left
        new Vector2(1, 1), // bottom-right
        new Vector2(1, 0), // top-right
        new Vector2(0, 0), // top-left
      ];

      vertices.push(...upperVertices);
      uvs.push(...upperUvs);

      // Add indices for upper wall (2 triangles)
      const baseIndex = vertexIndex;
      indices.push(
        baseIndex,
        baseIndex + 2,
        baseIndex + 1, // First triangle
        baseIndex,
        baseIndex + 3,
        baseIndex + 2 // Second triangle
      );

      vertexIndex += 4;
    }

    // Generate middle wall if there's a gap and middle texture is needed
    if (lowerWallTop < upperWallBottom && lineDef.frontSide.needsMiddleTexture) {
      const middleVertices = [
        new Vector3(start.x, lowerWallTop, start.y),
        new Vector3(end.x, lowerWallTop, end.y),
        new Vector3(end.x, upperWallBottom, end.y),
        new Vector3(start.x, upperWallBottom, start.y),
      ];

      const middleUvs = [
        new Vector2(0, 1), // bottom-left
        new Vector2(1, 1), // bottom-right
        new Vector2(1, 0), // top-right
        new Vector2(0, 0), // top-left
      ];

      vertices.push(...middleVertices);
      uvs.push(...middleUvs);

      // Add indices for middle wall (2 triangles)
      const baseIndex = vertexIndex;
      indices.push(
        baseIndex,
        baseIndex + 2,
        baseIndex + 1, // First triangle
        baseIndex,
        baseIndex + 3,
        baseIndex + 2 // Second triangle
      );
    }

    return { vertices, indices, uvs };
  }

  /**
   * Invalidates cached geometry data
   * Call when sector geometry changes
   */
  invalidateCache(): void {
    this._boundingBox = undefined;
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
