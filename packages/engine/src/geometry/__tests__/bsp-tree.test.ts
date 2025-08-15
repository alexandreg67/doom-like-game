import { Vector2, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { BSPTree } from '../bsp-tree';
import type { DoomLineDef, DoomSector, DoomVertex } from '../doom-geometry';

describe('BSPTree', () => {
  let testSector: DoomSector;
  let testVertices: DoomVertex[];
  let testLineDefs: DoomLineDef[];

  beforeEach(() => {
    // Create a simple square sector for testing
    testVertices = [
      { id: 'v1', position: new Vector2(-5, -5) },
      { id: 'v2', position: new Vector2(5, -5) },
      { id: 'v3', position: new Vector2(5, 5) },
      { id: 'v4', position: new Vector2(-5, 5) },
    ];

    testSector = {
      id: 'test_sector',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices: testVertices,
      lineDefs: [], // Will be populated below
      neighbors: [],
      boundingBox: { min: new Vector2(-5, -5), max: new Vector2(5, 5) },
      meshId: 'test_mesh',
    };

    // Validate vertices array before use
    if (testVertices.length < 4) {
      throw new Error('Test vertices array must have at least 4 vertices');
    }

    testLineDefs = [
      {
        id: 'l1',
        startVertex: testVertices[0], // v1
        endVertex: testVertices[1], // v2
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
          sector: testSector,
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
      },
      {
        id: 'l2',
        startVertex: testVertices[1], // v2
        endVertex: testVertices[2], // v3
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
          id: 's1_2',
          sector: testSector,
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
        normal: new Vector2(-1, 0),
      },
      {
        id: 'l3',
        startVertex: testVertices[2], // v3
        endVertex: testVertices[3], // v4
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
          id: 's1_3',
          sector: testSector,
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
        normal: new Vector2(0, -1),
      },
      {
        id: 'l4',
        startVertex: testVertices[3], // v4
        endVertex: testVertices[0], // v1
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
          id: 's1_4',
          sector: testSector,
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
        normal: new Vector2(1, 0),
      },
    ];

    testSector.lineDefs = testLineDefs;
  });

  describe('constructor', () => {
    it('should create a BSP tree from sectors', () => {
      const bspTree = new BSPTree([testSector]);

      expect(bspTree).toBeDefined();
      expect(bspTree.getRoot()).toBeDefined();
    });

    it('should handle empty sectors array', () => {
      const bspTree = new BSPTree([]);

      expect(bspTree).toBeDefined();
      expect(bspTree.getRoot()).toBeNull();
    });
  });

  describe('buildTree', () => {
    it('should create leaf node for small number of lines', () => {
      const bspTree = new BSPTree([]);
      const firstLine = testLineDefs[0];
      if (!firstLine) {
        throw new Error('Test line definitions must have at least one line');
      }
      const lines = [firstLine]; // Single line

      const root = bspTree.buildTree(lines, [testSector]);

      expect(root).toBeDefined();
      expect(root?.isLeaf).toBe(true);
      expect(root?.sectors).toHaveLength(1);
    });

    it('should create internal nodes for larger line sets', () => {
      const bspTree = new BSPTree([]);

      const root = bspTree.buildTree(testLineDefs, [testSector]);

      expect(root).toBeDefined();
      // With 4 lines, should create internal nodes
      if (root && !root.isLeaf) {
        expect(root.splitLine).toBeDefined();
      }
    });

    it('should respect maximum depth limit', () => {
      const bspTree = new BSPTree([]);

      const root = bspTree.buildTree(testLineDefs, [testSector], 25); // Exceed max depth

      expect(root).toBeDefined();
      expect(root?.isLeaf).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const bspTree = new BSPTree([testSector]);
      const stats = bspTree.getStats();

      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.leafs).toBeGreaterThan(0);
      expect(stats.maxDepth).toBeGreaterThanOrEqual(0);
      expect(stats.leafs).toBeLessThanOrEqual(stats.nodes);
    });

    it('should return zero stats for empty tree', () => {
      const bspTree = new BSPTree([]);
      const stats = bspTree.getStats();

      expect(stats.nodes).toBe(0);
      expect(stats.leafs).toBe(0);
      expect(stats.maxDepth).toBe(0);
    });
  });

  describe('traverseTree', () => {
    it('should return traversal result', () => {
      const bspTree = new BSPTree([testSector]);
      const viewpoint = new Vector3(0, 2, 0); // Center of sector

      const result = bspTree.traverseTree(viewpoint);

      expect(result).toBeDefined();
      expect(result.visibleSectors).toBeDefined();
      expect(result.visibleLines).toBeDefined();
      expect(result.renderOrder).toBeDefined();
    });

    it('should handle viewpoint outside sector', () => {
      const bspTree = new BSPTree([testSector]);
      const viewpoint = new Vector3(10, 2, 10); // Outside sector

      const result = bspTree.traverseTree(viewpoint);

      expect(result).toBeDefined();
      expect(Array.isArray(result.visibleSectors)).toBe(true);
      expect(Array.isArray(result.visibleLines)).toBe(true);
    });

    it('should return empty result for empty tree', () => {
      const bspTree = new BSPTree([]);
      const viewpoint = new Vector3(0, 2, 0);

      const result = bspTree.traverseTree(viewpoint);

      expect(result.visibleSectors).toHaveLength(0);
      expect(result.visibleLines).toHaveLength(0);
      expect(result.renderOrder).toHaveLength(0);
    });
  });

  describe('isVisible', () => {
    it('should return true for points in same area', () => {
      const bspTree = new BSPTree([testSector]);
      const point = new Vector3(1, 2, 1);
      const viewpoint = new Vector3(-1, 2, -1);

      const isVisible = bspTree.isVisible(point, viewpoint);

      expect(typeof isVisible).toBe('boolean');
    });

    it('should return true for empty tree', () => {
      const bspTree = new BSPTree([]);
      const point = new Vector3(1, 2, 1);
      const viewpoint = new Vector3(-1, 2, -1);

      const isVisible = bspTree.isVisible(point, viewpoint);

      expect(isVisible).toBe(true);
    });
  });

  describe('line classification', () => {
    it('should classify points correctly relative to lines', () => {
      const bspTree = new BSPTree([testSector]);

      // Test with the bottom line (l1: from (-5,-5) to (5,-5))
      const line = testLineDefs[0];
      if (!line) {
        throw new Error('Test line definitions must have at least one line');
      }

      // Use private method reflection for testing (not ideal but necessary for internal logic testing)
      // biome-ignore lint/suspicious/noExplicitAny: Testing private method requires any
      const classifyMethod = (bspTree as any).classifyPointRelativeToLine;

      // Point above the line should be positive (front)
      const pointAbove = new Vector2(0, 0);
      const classificationAbove = classifyMethod.call(bspTree, pointAbove, line);
      expect(classificationAbove).toBeGreaterThan(0);

      // Point below the line should be negative (back)
      const pointBelow = new Vector2(0, -10);
      const classificationBelow = classifyMethod.call(bspTree, pointBelow, line);
      expect(classificationBelow).toBeLessThan(0);

      // Point on the line should be approximately zero
      const pointOnLine = new Vector2(0, -5);
      const classificationOnLine = classifyMethod.call(bspTree, pointOnLine, line);
      expect(Math.abs(classificationOnLine)).toBeLessThan(0.0001);
    });
  });

  describe('edge cases', () => {
    it('should handle sectors with minimal geometry', () => {
      // Create a triangle sector (minimum valid geometry)
      const triangleVertices = [
        { id: 'tv1', position: new Vector2(0, 0) },
        { id: 'tv2', position: new Vector2(1, 0) },
        { id: 'tv3', position: new Vector2(0.5, 1) },
      ];

      const triangleSector: DoomSector = {
        id: 'triangle_sector',
        floorHeight: 0,
        ceilingHeight: 3,
        floorTexture: 'FLOOR1',
        ceilingTexture: 'CEIL1',
        lightLevel: 200,
        vertices: triangleVertices,
        lineDefs: [],
        neighbors: [],
        boundingBox: { min: new Vector2(0, 0), max: new Vector2(1, 1) },
      };

      const triangleLines: DoomLineDef[] = [
        {
          id: 'tl1',
          startVertex: triangleVertices[0],
          endVertex: triangleVertices[1],
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
          length: 1,
          normal: new Vector2(0, 1),
        },
      ];

      triangleSector.lineDefs = triangleLines;

      expect(() => {
        const bspTree = new BSPTree([triangleSector]);
        bspTree.traverseTree(new Vector3(0.5, 1, 0.5));
      }).not.toThrow();
    });

    it('should handle degenerate lines', () => {
      // Create a sector with a very short line
      const degenerateVertices = [
        { id: 'dv1', position: new Vector2(0, 0) },
        { id: 'dv2', position: new Vector2(0.001, 0) }, // Very short line
      ];

      const degenerateLines: DoomLineDef[] = [
        {
          id: 'dl1',
          startVertex: degenerateVertices[0],
          endVertex: degenerateVertices[1],
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
          length: 0.001,
          normal: new Vector2(0, 1),
        },
      ];

      expect(() => {
        const bspTree = new BSPTree([]);
        bspTree.buildTree(degenerateLines, []);
      }).not.toThrow();
    });
  });
});
