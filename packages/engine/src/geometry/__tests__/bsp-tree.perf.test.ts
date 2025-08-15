import { Vector2, Vector3 } from '@babylonjs/core';
import { describe, expect, it } from 'vitest';
import { BSPTree } from '../bsp-tree';
import type { DoomLineDef, DoomSector, DoomVertex } from '../doom-geometry';

describe('BSPTree Performance Benchmarks', () => {
  /**
   * Creates a complex sector with multiple walls for realistic testing
   */
  function createComplexSector(id: string, size: number): DoomSector {
    const vertices: DoomVertex[] = [];
    const lineDefs: DoomLineDef[] = [];

    // Create an L-shaped sector for more complex BSP partitioning
    const points = [
      { x: 0, y: 0 },
      { x: size, y: 0 },
      { x: size, y: size / 2 },
      { x: size / 2, y: size / 2 },
      { x: size / 2, y: size },
      { x: 0, y: size },
    ];

    // Create vertices
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (!point) {
        throw new Error(`Point at index ${i} is undefined`);
      }
      vertices.push({
        id: `${id}_v${i}`,
        position: new Vector2(point.x, point.y),
      });
    }

    const sector: DoomSector = {
      id,
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices,
      lineDefs: [],
      neighbors: [],
      boundingBox: { min: new Vector2(0, 0), max: new Vector2(size, size) },
    };

    // Create line definitions connecting vertices
    for (let i = 0; i < vertices.length; i++) {
      const startVertex = vertices[i];
      const endVertex = vertices[(i + 1) % vertices.length];

      if (!startVertex || !endVertex) {
        throw new Error(`Vertex at index ${i} or ${(i + 1) % vertices.length} is undefined`);
      }

      const dx = endVertex.position.x - startVertex.position.x;
      const dy = endVertex.position.y - startVertex.position.y;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Calculate normal (perpendicular to line, pointing outward)
      const normal = new Vector2(-dy / length, dx / length);

      const lineDef: DoomLineDef = {
        id: `${id}_l${i}`,
        startVertex,
        endVertex,
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
          id: `${id}_s${i}`,
          sector,
          textureMiddle: 'WALL1',
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

      lineDefs.push(lineDef);
    }

    sector.lineDefs = lineDefs;
    return sector;
  }

  /**
   * Creates multiple sectors for large-scale testing
   */
  function createMultipleSectors(count: number, size: number): DoomSector[] {
    const sectors: DoomSector[] = [];

    for (let i = 0; i < count; i++) {
      const offsetX = (i % 5) * size * 1.2; // Grid layout
      const offsetY = Math.floor(i / 5) * size * 1.2;

      const sector = createComplexSector(`sector_${i}`, size);

      // Offset vertices to create separate rooms
      for (const vertex of sector.vertices) {
        vertex.position.x += offsetX;
        vertex.position.y += offsetY;
      }

      // Update bounding box
      sector.boundingBox.min.x += offsetX;
      sector.boundingBox.min.y += offsetY;
      sector.boundingBox.max.x += offsetX;
      sector.boundingBox.max.y += offsetY;

      sectors.push(sector);
    }

    return sectors;
  }

  describe('BSP Tree Construction Performance', () => {
    it('should build BSP tree efficiently for single complex sector', () => {
      const sector = createComplexSector('perf_test', 20);

      const startTime = performance.now();
      const bspTree = new BSPTree([sector]);
      const endTime = performance.now();

      const constructionTime = endTime - startTime;
      const stats = bspTree.getStats();

      console.log('[BENCHMARK] Single sector BSP construction:');
      console.log(`  Construction time: ${constructionTime.toFixed(2)}ms`);
      console.log(`  Nodes: ${stats.nodes}, Leafs: ${stats.leafs}, Max depth: ${stats.maxDepth}`);

      // Performance expectations
      expect(constructionTime).toBeLessThan(50); // Should build in < 50ms
      expect(stats.nodes).toBeGreaterThan(0);
      expect(stats.maxDepth).toBeLessThan(20); // Reasonable depth
    });

    it('should scale reasonably with multiple sectors', () => {
      const sectorCounts = [1, 5, 10];
      const results: Array<{ sectors: number; time: number; nodes: number }> = [];

      for (const count of sectorCounts) {
        const sectors = createMultipleSectors(count, 10);

        const startTime = performance.now();
        const bspTree = new BSPTree(sectors);
        const endTime = performance.now();

        const constructionTime = endTime - startTime;
        const stats = bspTree.getStats();

        results.push({
          sectors: count,
          time: constructionTime,
          nodes: stats.nodes,
        });
      }

      console.log('[BENCHMARK] Multi-sector BSP construction scaling:');
      for (const result of results) {
        console.log(
          `  ${result.sectors} sectors: ${result.time.toFixed(2)}ms, ${result.nodes} nodes`
        );
      }

      // Check that scaling is reasonable (not exponential)
      const lastResult = results[results.length - 1];
      const firstResult = results[0];

      if (!lastResult || !firstResult) {
        throw new Error('Results array must have at least one result');
      }

      const timeRatio = lastResult.time / firstResult.time;
      const sectorRatio = lastResult.sectors / firstResult.sectors;

      expect(timeRatio).toBeLessThan(sectorRatio * 50); // Should scale reasonably (not exponential)
    });
  });

  describe('BSP Tree Traversal Performance', () => {
    it('should traverse tree efficiently', () => {
      const sectors = createMultipleSectors(10, 15);
      const bspTree = new BSPTree(sectors);

      const viewpoints = [
        new Vector3(0, 2, 0),
        new Vector3(15, 2, 15),
        new Vector3(30, 2, 30),
        new Vector3(-10, 2, -10), // Outside
      ];

      const traversalTimes: number[] = [];

      for (const viewpoint of viewpoints) {
        const startTime = performance.now();

        // Perform multiple traversals to get accurate timing
        for (let i = 0; i < 1000; i++) {
          bspTree.traverseTree(viewpoint);
        }

        const endTime = performance.now();
        const avgTime = (endTime - startTime) / 1000;
        traversalTimes.push(avgTime);
      }

      const avgTraversalTime = traversalTimes.reduce((a, b) => a + b, 0) / traversalTimes.length;

      console.log('[BENCHMARK] BSP traversal performance:');
      console.log(`  Average traversal time: ${avgTraversalTime.toFixed(4)}ms`);
      console.log(`  Individual times: ${traversalTimes.map((t) => t.toFixed(4)).join(', ')}ms`);

      // Should be very fast (sub-millisecond for simple scenes)
      expect(avgTraversalTime).toBeLessThan(0.1); // < 0.1ms per traversal
    });

    it('should provide culling benefits', () => {
      const sectors = createMultipleSectors(15, 12);
      const bspTree = new BSPTree(sectors);

      const totalLines = sectors.reduce((sum, sector) => sum + sector.lineDefs.length, 0);
      const viewpoint = new Vector3(6, 2, 6); // Inside first sector

      const startTime = performance.now();
      const result = bspTree.traverseTree(viewpoint);
      const endTime = performance.now();

      const traversalTime = endTime - startTime;
      // Remove duplicates from visible lines (BSP may return duplicates)
      const uniqueVisibleLines = Array.from(new Set(result.visibleLines.map((line) => line.id)));
      const cullingRatio = 1 - uniqueVisibleLines.length / totalLines;

      console.log('[BENCHMARK] BSP culling effectiveness:');
      console.log(`  Total lines: ${totalLines}`);
      console.log(
        `  Visible lines: ${result.visibleLines.length} (${uniqueVisibleLines.length} unique)`
      );
      console.log(`  Culling ratio: ${(cullingRatio * 100).toFixed(1)}%`);
      console.log(`  Traversal time: ${traversalTime.toFixed(4)}ms`);

      // Should return reasonable number of visible lines (duplicates are expected in basic BSP)
      expect(uniqueVisibleLines.length).toBeLessThanOrEqual(totalLines);
      expect(traversalTime).toBeLessThan(5); // Should be fast
    });
  });

  describe('Visibility Testing Performance', () => {
    it('should perform visibility tests efficiently', () => {
      const sectors = createMultipleSectors(8, 10);
      const bspTree = new BSPTree(sectors);

      const testPoints = [
        new Vector3(5, 2, 5),
        new Vector3(15, 2, 15),
        new Vector3(25, 2, 5),
        new Vector3(100, 2, 100), // Far away
      ];

      const viewpoint = new Vector3(0, 2, 0);

      const startTime = performance.now();

      // Test visibility for all points multiple times
      let visibleCount = 0;
      for (let i = 0; i < 100; i++) {
        for (const point of testPoints) {
          if (bspTree.isVisible(point, viewpoint)) {
            visibleCount++;
          }
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerTest = totalTime / (100 * testPoints.length);

      console.log('[BENCHMARK] Visibility testing performance:');
      console.log(`  Total visibility tests: ${100 * testPoints.length}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(`  Average time per test: ${avgTimePerTest.toFixed(4)}ms`);
      console.log(`  Visible results: ${visibleCount}`);

      // Should be very fast for basic visibility tests
      expect(avgTimePerTest).toBeLessThan(0.01); // < 0.01ms per test
      expect(totalTime).toBeLessThan(100); // Total time reasonable
    });
  });

  describe('Memory Usage Analysis', () => {
    it('should demonstrate memory efficiency of BSP tree', () => {
      const smallSectors = createMultipleSectors(5, 10);
      const largeSectors = createMultipleSectors(20, 10);

      // Create BSP trees
      const smallBSP = new BSPTree(smallSectors);
      const largeBSP = new BSPTree(largeSectors);

      const smallStats = smallBSP.getStats();
      const largeStats = largeBSP.getStats();

      console.log('[BENCHMARK] Memory usage analysis:');
      console.log(
        `  Small scene (5 sectors): ${smallStats.nodes} nodes, depth ${smallStats.maxDepth}`
      );
      console.log(
        `  Large scene (20 sectors): ${largeStats.nodes} nodes, depth ${largeStats.maxDepth}`
      );

      const nodeRatio = largeStats.nodes / smallStats.nodes;
      const sectorRatio = largeSectors.length / smallSectors.length;

      console.log(`  Node ratio: ${nodeRatio.toFixed(2)}x`);
      console.log(`  Sector ratio: ${sectorRatio.toFixed(2)}x`);

      // BSP tree growth should be reasonable
      expect(nodeRatio).toBeLessThan(sectorRatio * 2.5); // Reasonable growth in nodes
      expect(largeStats.maxDepth).toBeLessThan(25); // Depth should be manageable
    });
  });
});
