import { Vector2 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector, DoomVertex } from '../doom-geometry';
import { SectorGeometry } from '../sector-geometry';

describe('UV Mapping Tests', () => {
  const createTestSector = (): DoomSector => {
    const vertices: DoomVertex[] = [
      { id: 'v1', position: new Vector2(-5, -5) },
      { id: 'v2', position: new Vector2(5, -5) },
      { id: 'v3', position: new Vector2(5, 5) },
      { id: 'v4', position: new Vector2(-5, 5) },
    ];

    return {
      id: 's1',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices: vertices,
      lineDefs: [],
      neighbors: [],
      boundingBox: { min: new Vector2(0, 0), max: new Vector2(0, 0) },
      meshId: 'sector_s1',
    };
  };

  const createTestLineDef = (sector: DoomSector): DoomLineDef => {
    const v1 = sector.vertices[0]!;
    const v2 = sector.vertices[1]!;

    return {
      id: 'l1',
      startVertex: v1,
      endVertex: v2,
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
        id: 's1_1',
        sector: sector,
        textureMiddle: 'WALL1',
        textureUpper: '-',
        textureLower: '-',
        offsetX: 0,
        offsetY: 0,
        needsUpperTexture: false,
        needsLowerTexture: false,
        needsMiddleTexture: true,
      },
      length: 10,
      normal: new Vector2(0, 1),
    };
  };

  describe('Floor UV Mapping', () => {
    it('should generate UV coordinates in 0-1 range', () => {
      const sector = createTestSector();
      const sectorGeometry = new SectorGeometry(sector);

      const floorTriangulation = sectorGeometry.triangulateFloor();

      // Check that all UV coordinates are in [0, 1] range
      for (const uv of floorTriangulation.uvs) {
        expect(uv.x).toBeGreaterThanOrEqual(0);
        expect(uv.x).toBeLessThanOrEqual(1);
        expect(uv.y).toBeGreaterThanOrEqual(0);
        expect(uv.y).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Ceiling UV Mapping', () => {
    it('should generate UV coordinates in 0-1 range', () => {
      const sector = createTestSector();
      const sectorGeometry = new SectorGeometry(sector);

      const ceilingTriangulation = sectorGeometry.triangulateCeiling();

      // Check that all UV coordinates are in [0, 1] range
      for (const uv of ceilingTriangulation.uvs) {
        expect(uv.x).toBeGreaterThanOrEqual(0);
        expect(uv.x).toBeLessThanOrEqual(1);
        expect(uv.y).toBeGreaterThanOrEqual(0);
        expect(uv.y).toBeLessThanOrEqual(1);
      }
    });
  });

  describe('Wall UV Mapping', () => {
    it('should generate UV coordinates in 0-1 range', () => {
      const sector = createTestSector();
      const sectorGeometry = new SectorGeometry(sector);
      const lineDef = createTestLineDef(sector);

      const wallTriangulation = sectorGeometry.generateWallGeometry(lineDef);

      expect(wallTriangulation).not.toBeNull();
      if (wallTriangulation) {
        // Check that all UV coordinates are in [0, 1] range
        for (const uv of wallTriangulation.uvs) {
          expect(uv.x).toBeGreaterThanOrEqual(0);
          expect(uv.x).toBeLessThanOrEqual(1);
          expect(uv.y).toBeGreaterThanOrEqual(0);
          expect(uv.y).toBeLessThanOrEqual(1);
        }
      }
    });

    it('should have correct UV mapping order', () => {
      const sector = createTestSector();
      const sectorGeometry = new SectorGeometry(sector);
      const lineDef = createTestLineDef(sector);

      const wallTriangulation = sectorGeometry.generateWallGeometry(lineDef);

      expect(wallTriangulation).not.toBeNull();
      if (wallTriangulation) {
        const uvs = wallTriangulation.uvs;
        expect(uvs).toHaveLength(4);

        // Expected UV order: bottom-left, bottom-right, top-right, top-left
        expect(uvs[0]).toEqual(new Vector2(0, 1)); // bottom-left
        expect(uvs[1]).toEqual(new Vector2(1, 1)); // bottom-right
        expect(uvs[2]).toEqual(new Vector2(1, 0)); // top-right
        expect(uvs[3]).toEqual(new Vector2(0, 0)); // top-left
      }
    });
  });
});
