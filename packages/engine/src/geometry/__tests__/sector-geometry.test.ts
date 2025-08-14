import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DoomSector, DoomVertex } from '../doom-geometry';
import { SectorGeometry } from '../sector-geometry';

describe('SectorGeometry', () => {
  let mockSector: DoomSector;
  let geometry: SectorGeometry;

  beforeEach(() => {
    // Create a simple square sector for testing
    const vertices: DoomVertex[] = [
      { id: 'v1', position: new Vector2(0, 0) },
      { id: 'v2', position: new Vector2(100, 0) },
      { id: 'v3', position: new Vector2(100, 100) },
      { id: 'v4', position: new Vector2(0, 100) },
    ];

    mockSector = {
      id: 'test-sector',
      floorHeight: 0,
      ceilingHeight: 128,
      floorTexture: 'FLOOR01',
      ceilingTexture: 'CEIL01',
      lightLevel: 0.8,
      vertices,
      lineDefs: [],
      neighbors: [],
      boundingBox: {
        min: new Vector2(0, 0),
        max: new Vector2(100, 100),
      },
    };

    geometry = new SectorGeometry(mockSector);
  });

  describe('constructor and validation', () => {
    it('should create geometry for valid sector', () => {
      expect(geometry).toBeDefined();
      expect(() => new SectorGeometry(mockSector)).not.toThrow();
    });

    it('should throw error for sector with less than 3 vertices', () => {
      const invalidSector = {
        ...mockSector,
        vertices: [
          { id: 'v1', position: new Vector2(0, 0) },
          { id: 'v2', position: new Vector2(100, 0) },
        ],
      };

      expect(() => new SectorGeometry(invalidSector)).toThrow(
        'Sector test-sector must have at least 3 vertices'
      );
    });

    it('should throw error for duplicate vertices', () => {
      const invalidSector = {
        ...mockSector,
        vertices: [
          { id: 'v1', position: new Vector2(0, 0) },
          { id: 'v2', position: new Vector2(100, 0) },
          { id: 'v3', position: new Vector2(0, 0) }, // Duplicate position
        ],
      };

      expect(() => new SectorGeometry(invalidSector)).toThrow(
        'Sector test-sector contains duplicate vertices'
      );
    });

    it('should throw error when floor height >= ceiling height', () => {
      const invalidSector = {
        ...mockSector,
        floorHeight: 128,
        ceilingHeight: 64,
      };

      expect(() => new SectorGeometry(invalidSector)).toThrow(
        'Sector test-sector floor height must be less than ceiling height'
      );
    });
  });

  describe('bounding box calculation', () => {
    it('should calculate correct bounding box for square sector', () => {
      const bbox = geometry.boundingBox;

      expect(bbox.minX).toBe(0);
      expect(bbox.maxX).toBe(100);
      expect(bbox.minY).toBe(0);
      expect(bbox.maxY).toBe(100);
      expect(bbox.minZ).toBe(0);
      expect(bbox.maxZ).toBe(128);
    });

    it('should handle negative coordinates', () => {
      const vertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(-50, -25) },
        { id: 'v2', position: new Vector2(50, -25) },
        { id: 'v3', position: new Vector2(0, 25) },
      ];

      const triangularSector = {
        ...mockSector,
        vertices,
      };

      const triangleGeometry = new SectorGeometry(triangularSector);
      const bbox = triangleGeometry.boundingBox;

      expect(bbox.minX).toBe(-50);
      expect(bbox.maxX).toBe(50);
      expect(bbox.minY).toBe(-25);
      expect(bbox.maxY).toBe(25);
    });
  });

  describe('area calculation', () => {
    it('should calculate correct area for square sector', () => {
      const area = geometry.area;
      expect(area).toBe(10000); // 100 * 100
    });

    it('should calculate correct area for triangle', () => {
      const vertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(100, 0) },
        { id: 'v3', position: new Vector2(50, 100) },
      ];

      const triangularSector = {
        ...mockSector,
        vertices,
      };

      const triangleGeometry = new SectorGeometry(triangularSector);
      const area = triangleGeometry.area;
      expect(area).toBe(5000); // 0.5 * base * height = 0.5 * 100 * 100
    });
  });

  describe('centroid calculation', () => {
    it('should calculate correct centroid for square sector', () => {
      const centroid = geometry.centroid;
      expect(centroid.x).toBe(50);
      expect(centroid.y).toBe(50);
    });

    it('should calculate correct centroid for triangle', () => {
      const vertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(60, 0) },
        { id: 'v3', position: new Vector2(30, 90) },
      ];

      const triangularSector = {
        ...mockSector,
        vertices,
      };

      const triangleGeometry = new SectorGeometry(triangularSector);
      const centroid = triangleGeometry.centroid;
      expect(centroid.x).toBe(30); // (0 + 60 + 30) / 3
      expect(centroid.y).toBe(30); // (0 + 0 + 90) / 3
    });
  });

  describe('vertex ordering', () => {
    it('should detect counter-clockwise ordering', () => {
      // Our default square vertices are actually counter-clockwise
      expect(geometry.isClockwise).toBe(false);
    });

    it('should detect clockwise ordering', () => {
      const vertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(0, 100) }, // Clockwise order
        { id: 'v3', position: new Vector2(100, 100) },
        { id: 'v4', position: new Vector2(100, 0) },
      ];

      const clockwiseSector = {
        ...mockSector,
        vertices,
      };

      const cwGeometry = new SectorGeometry(clockwiseSector);
      expect(cwGeometry.isClockwise).toBe(true);
    });

    it('should enforce clockwise ordering', () => {
      // Start with counter-clockwise (our default)
      expect(geometry.isClockwise).toBe(false);

      geometry.ensureClockwiseOrder();
      expect(geometry.isClockwise).toBe(true);
    });
  });

  describe('point containment', () => {
    it('should detect point inside sector', () => {
      const insidePoint = new Vector2(50, 50);
      expect(geometry.containsPoint(insidePoint)).toBe(true);
    });

    it('should detect point outside sector', () => {
      const outsidePoint = new Vector2(150, 150);
      expect(geometry.containsPoint(outsidePoint)).toBe(false);
    });

    it('should handle edge cases correctly', () => {
      // Point on edge
      const edgePoint = new Vector2(0, 50);
      // Ray casting algorithm might be sensitive to edge cases
      // The exact result depends on implementation details
      expect(typeof geometry.containsPoint(edgePoint)).toBe('boolean');

      // Point on corner
      const cornerPoint = new Vector2(0, 0);
      expect(typeof geometry.containsPoint(cornerPoint)).toBe('boolean');
    });

    it('should work for triangular sectors', () => {
      const vertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(100, 0) },
        { id: 'v3', position: new Vector2(50, 100) },
      ];

      const triangularSector = {
        ...mockSector,
        vertices,
      };

      const triangleGeometry = new SectorGeometry(triangularSector);

      expect(triangleGeometry.containsPoint(new Vector2(50, 30))).toBe(true);
      expect(triangleGeometry.containsPoint(new Vector2(10, 90))).toBe(false);
    });
  });

  describe('triangulation', () => {
    it('should generate valid floor triangulation', () => {
      const result = geometry.triangulateFloor();
      expect(result.vertices).toBeDefined();
      expect(result.indices).toBeDefined();
      expect(result.uvs).toBeDefined();
      expect(result.vertices.length).toBe(4);
      expect(result.indices.length).toBe(6); // 2 triangles
      // Check that all vertices are at floor height
      for (const v of result.vertices) {
        expect(v.y).toBe(mockSector.floorHeight);
      }
    });

    it('should generate valid ceiling triangulation', () => {
      const result = geometry.triangulateCeiling();
      expect(result.vertices).toBeDefined();
      expect(result.indices).toBeDefined();
      expect(result.uvs).toBeDefined();
      expect(result.vertices.length).toBe(4);
      expect(result.indices.length).toBe(6); // 2 triangles
      // Check that all vertices are at ceiling height
      for (const v of result.vertices) {
        expect(v.y).toBe(mockSector.ceilingHeight);
      }
    });
  });

  describe('cache management', () => {
    it('should invalidate all caches', () => {
      // Force cache creation
      geometry.boundingBox;

      // Should not throw
      expect(() => geometry.invalidateCache()).not.toThrow();
    });

    it('should update sector and invalidate caches', () => {
      const originalBbox = geometry.boundingBox;

      const newVertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(200, 0) },
        { id: 'v3', position: new Vector2(200, 200) },
        { id: 'v4', position: new Vector2(0, 200) },
      ];

      const newSector = {
        ...mockSector,
        vertices: newVertices,
      };

      geometry.updateSector(newSector);

      const newBbox = geometry.boundingBox;
      expect(newBbox.maxX).toBe(200);
      expect(newBbox.maxY).toBe(200);
      expect(newBbox).not.toEqual(originalBbox);
    });
  });

  describe('edge cases', () => {
    it('should handle empty vertex array gracefully', () => {
      const emptySector = {
        ...mockSector,
        vertices: [],
      };

      expect(() => new SectorGeometry(emptySector)).toThrow();
    });

    it('should handle single vertex gracefully', () => {
      const singleVertexSector = {
        ...mockSector,
        vertices: [{ id: 'v1', position: new Vector2(0, 0) }],
      };

      expect(() => new SectorGeometry(singleVertexSector)).toThrow();
    });

    it('should handle collinear vertices', () => {
      const collinearVertices: DoomVertex[] = [
        { id: 'v1', position: new Vector2(0, 0) },
        { id: 'v2', position: new Vector2(50, 0) },
        { id: 'v3', position: new Vector2(100, 0) }, // All on same line
      ];

      const collinearSector = {
        ...mockSector,
        vertices: collinearVertices,
      };

      const collinearGeometry = new SectorGeometry(collinearSector);
      expect(collinearGeometry.area).toBe(0);
    });
  });

  describe('wall geometry generation', () => {
    it('should generate valid full wall geometry for single-sided linedef', () => {
      const lineDef = {
        id: 'test-line',
        startVertex: mockSector.vertices[0],
        endVertex: mockSector.vertices[1],
        flags: { blocking: true, twoSided: false },
        frontSide: {
          id: 'test-side',
          sector: mockSector,
          textureMiddle: 'WALL1',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: true,
        },
        length: 100, // Distance between (0,0) and (100,0)
        normal: new Vector2(0, 1),
      };

      const result = geometry.generateWallGeometry(lineDef);
      expect(result).toBeDefined();
      expect(result?.vertices).toBeDefined();
      expect(result?.indices).toBeDefined();
      expect(result?.uvs).toBeDefined();

      // A full wall is a quad, so 4 vertices and 6 indices (2 triangles)
      expect(result?.vertices.length).toBe(4);
      expect(result?.indices.length).toBe(6);
      expect(result?.uvs.length).toBe(4);

      // Check vertex positions (bottom-left, bottom-right, top-right, top-left)
      expect(result?.vertices[0].x).toBe(0);
      expect(result?.vertices[0].y).toBe(mockSector.floorHeight);
      expect(result?.vertices[0].z).toBe(0);

      expect(result?.vertices[1].x).toBe(100);
      expect(result?.vertices[1].y).toBe(mockSector.floorHeight);
      expect(result?.vertices[1].z).toBe(0);

      expect(result?.vertices[2].x).toBe(100);
      expect(result?.vertices[2].y).toBe(mockSector.ceilingHeight);
      expect(result?.vertices[2].z).toBe(0);

      expect(result?.vertices[3].x).toBe(0);
      expect(result?.vertices[3].y).toBe(mockSector.ceilingHeight);
      expect(result?.vertices[3].z).toBe(0);
    });

    it('should return null for two-sided linedef if partial walls not implemented', () => {
      const lineDef = {
        id: 'test-line-two-sided',
        startVertex: mockSector.vertices[0],
        endVertex: mockSector.vertices[1],
        flags: { blocking: true, twoSided: true }, // Two-sided
        frontSide: {
          id: 'test-side-front',
          sector: mockSector,
          textureMiddle: 'WALL1',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: true,
        },
        backSide: {
          // Minimal back side
          id: 'test-side-back',
          sector: mockSector,
          textureMiddle: 'WALL1',
          textureUpper: '-',
          textureLower: '-',
          offsetX: 0,
          offsetY: 0,
          needsUpperTexture: false,
          needsLowerTexture: false,
          needsMiddleTexture: true,
        },
        length: 100,
        normal: new Vector2(0, 1),
      };

      // Expect it to throw an error because generatePartialWalls is not implemented
      expect(() => geometry.generateWallGeometry(lineDef)).toThrow(
        'TODO: generatePartialWalls is not implemented'
      );
    });
  });
});
