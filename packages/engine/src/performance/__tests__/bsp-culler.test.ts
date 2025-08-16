/**
 * Tests for BSPCuller
 * Validates advanced culling functionality and performance optimization
 */

import { type Engine, Matrix, NullEngine, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BSPTree } from '../../geometry/bsp-tree';
import type { DoomLineDef, DoomSector, DoomVertex } from '../../geometry/doom-geometry';
import { BSPCuller } from '../bsp-culler';
import type { CullingConfig } from '../bsp-culler';
import { PerformanceManager } from '../performance-manager';

// Mock Babylon.js Frustum
vi.mock('@babylonjs/core', async () => {
  const actual = await vi.importActual<typeof import('@babylonjs/core')>('@babylonjs/core');
  return {
    ...actual,
    Frustum: class MockFrustum {
      planes = Array(6)
        .fill(null)
        .map(() => ({
          dotCoordinate: vi.fn().mockReturnValue(1), // Always inside frustum
        }));

      static GetPlanesFromTransformMatrix = vi.fn();
    },
  };
});

describe('BSPCuller', () => {
  let bspCuller: BSPCuller;
  let performanceManager: PerformanceManager;
  let engine: Engine;
  let testSectors: DoomSector[];
  let bspTree: BSPTree;

  beforeEach(() => {
    // Create null engine for testing
    engine = new NullEngine();

    // Create performance manager
    performanceManager = new PerformanceManager({
      enableMetrics: true,
      historySize: 10,
    });

    // Create test sectors
    testSectors = createTestSectors();

    // Create BSP tree
    bspTree = new BSPTree(testSectors);

    // Create BSP culler with test config
    const config: Partial<CullingConfig> = {
      enableFrustumCulling: true,
      enableOcclusionCulling: true,
      enableDistanceCulling: true,
      maxRenderDistance: 100,
      lodDistances: [25, 50, 75, 100],
      occlusionTestSamples: 4,
    };

    bspCuller = new BSPCuller(performanceManager, config);
  });

  afterEach(() => {
    bspCuller.dispose();
    performanceManager.dispose();
    engine.dispose();
    vi.clearAllMocks();
  });

  function createTestSectors(): DoomSector[] {
    // Create vertices for a simple square sector
    const vertices: DoomVertex[] = [
      { id: 0, position: { x: -10, y: -10 } },
      { id: 1, position: { x: 10, y: -10 } },
      { id: 2, position: { x: 10, y: 10 } },
      { id: 3, position: { x: -10, y: 10 } },
    ];

    const lineDefs: DoomLineDef[] = [
      {
        id: 0,
        startVertex: vertices[0],
        endVertex: vertices[1],
        flags: { blocking: true, twoSided: false },
        frontSector: 0,
        backSector: null,
      },
      {
        id: 1,
        startVertex: vertices[1],
        endVertex: vertices[2],
        flags: { blocking: true, twoSided: false },
        frontSector: 0,
        backSector: null,
      },
      {
        id: 2,
        startVertex: vertices[2],
        endVertex: vertices[3],
        flags: { blocking: true, twoSided: false },
        frontSector: 0,
        backSector: null,
      },
      {
        id: 3,
        startVertex: vertices[3],
        endVertex: vertices[0],
        flags: { blocking: true, twoSided: false },
        frontSector: 0,
        backSector: null,
      },
    ];

    const nearSector: DoomSector = {
      id: 0,
      vertices,
      lineDefs,
      floorHeight: 0,
      ceilingHeight: 10,
      floorTexture: 'floor1',
      ceilingTexture: 'ceiling1',
      lightLevel: 128,
      tag: 0,
      type: 0,
    };

    // Create a far sector
    const farVertices: DoomVertex[] = [
      { id: 4, position: { x: 90, y: 90 } },
      { id: 5, position: { x: 110, y: 90 } },
      { id: 6, position: { x: 110, y: 110 } },
      { id: 7, position: { x: 90, y: 110 } },
    ];

    const farLineDefs: DoomLineDef[] = [
      {
        id: 4,
        startVertex: farVertices[0],
        endVertex: farVertices[1],
        flags: { blocking: true, twoSided: false },
        frontSector: 1,
        backSector: null,
      },
      {
        id: 5,
        startVertex: farVertices[1],
        endVertex: farVertices[2],
        flags: { blocking: true, twoSided: false },
        frontSector: 1,
        backSector: null,
      },
      {
        id: 6,
        startVertex: farVertices[2],
        endVertex: farVertices[3],
        flags: { blocking: true, twoSided: false },
        frontSector: 1,
        backSector: null,
      },
      {
        id: 7,
        startVertex: farVertices[3],
        endVertex: farVertices[0],
        flags: { blocking: true, twoSided: false },
        frontSector: 1,
        backSector: null,
      },
    ];

    const farSector: DoomSector = {
      id: 1,
      vertices: farVertices,
      lineDefs: farLineDefs,
      floorHeight: 0,
      ceilingHeight: 10,
      floorTexture: 'floor1',
      ceilingTexture: 'ceiling1',
      lightLevel: 128,
      tag: 0,
      type: 0,
    };

    return [nearSector, farSector];
  }

  describe('Initialization', () => {
    it('should initialize with default config', () => {
      const defaultCuller = new BSPCuller(performanceManager);
      const config = defaultCuller.getConfig();

      expect(config.enableFrustumCulling).toBe(true);
      expect(config.enableOcclusionCulling).toBe(true);
      expect(config.enableDistanceCulling).toBe(true);
      expect(config.maxRenderDistance).toBe(1000);

      defaultCuller.dispose();
    });

    it('should initialize with custom config', () => {
      const config = bspCuller.getConfig();

      expect(config.maxRenderDistance).toBe(100);
      expect(config.lodDistances).toEqual([25, 50, 75, 100]);
      expect(config.occlusionTestSamples).toBe(4);
    });
  });

  describe('Culling Operations', () => {
    it('should perform basic culling', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );

      expect(result).toBeDefined();
      expect(result.visibleSectors).toBeDefined();
      expect(result.culledSectors).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.lodLevel).toBeGreaterThanOrEqual(0);
    });

    it('should calculate culling efficiency', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );

      expect(result.metrics.totalObjects).toBe(testSectors.length);
      expect(result.metrics.cullingEfficiency).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cullingEfficiency).toBeLessThanOrEqual(100);
    });

    it('should update performance manager with metrics', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      bspCuller.cull(bspTree, viewPosition, viewMatrix, projectionMatrix, testSectors);

      const metrics = performanceManager.getMetrics();
      expect(metrics.totalSectors).toBeGreaterThan(0);
      expect(metrics.bspTraversalTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Distance Culling', () => {
    it('should cull distant sectors', () => {
      // Position view very close to origin, far sector should be culled
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );

      // Should have some culled sectors - either by distance or BSP
      expect(result.culledSectors.length + result.visibleSectors.length).toBe(testSectors.length);
      expect(result.metrics.cullingEfficiency).toBeGreaterThan(0);
    });

    it('should not cull near sectors', () => {
      // Disable other culling to test distance only
      bspCuller.updateConfig({
        enableFrustumCulling: false,
        enableOcclusionCulling: false,
        maxRenderDistance: 1000, // Large distance
      });

      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );

      // Should have visible sectors since distance limit is high
      expect(result.visibleSectors.length).toBeGreaterThan(0);
    });
  });

  describe('LOD Calculation', () => {
    it('should calculate appropriate LOD level based on performance', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      // Mock good performance
      vi.spyOn(performanceManager, 'getMetrics').mockReturnValue({
        fps: 60,
        frameTime: 16,
        renderTime: 0,
        bspTraversalTime: 0,
        lightingTime: 0,
        cullingTime: 0,
        totalSectors: 0,
        visibleSectors: 0,
        totalLines: 0,
        visibleLines: 0,
        culledLines: 0,
        bspNodes: 0,
        bspDepth: 0,
        bspTraversals: 0,
        heapUsed: 0,
        heapTotal: 0,
        textureMemory: 0,
        bufferMemory: 0,
        avgFrameTime: 16,
        maxFrameTime: 20,
        minFrameTime: 14,
      });

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );
      expect(result.lodLevel).toBe(0); // High quality

      // Mock poor performance
      vi.spyOn(performanceManager, 'getMetrics').mockReturnValue({
        fps: 25,
        frameTime: 40,
        renderTime: 0,
        bspTraversalTime: 0,
        lightingTime: 0,
        cullingTime: 0,
        totalSectors: 0,
        visibleSectors: 0,
        totalLines: 0,
        visibleLines: 0,
        culledLines: 0,
        bspNodes: 0,
        bspDepth: 0,
        bspTraversals: 0,
        heapUsed: 0,
        heapTotal: 0,
        textureMemory: 0,
        bufferMemory: 0,
        avgFrameTime: 40,
        maxFrameTime: 50,
        minFrameTime: 30,
      });

      const result2 = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );
      expect(result2.lodLevel).toBe(3); // Very low quality
    });
  });

  describe('Statistics and Config', () => {
    it('should track culling statistics', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      bspCuller.cull(bspTree, viewPosition, viewMatrix, projectionMatrix, testSectors);

      const stats = bspCuller.getStats();
      expect(stats.totalCullingTests).toBeGreaterThan(0);
      expect(stats.totalTraversalTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      bspCuller.cull(bspTree, viewPosition, viewMatrix, projectionMatrix, testSectors);
      bspCuller.resetStats();

      const stats = bspCuller.getStats();
      expect(stats.totalCullingTests).toBe(0);
      expect(stats.frustumCulled).toBe(0);
      expect(stats.occlusionCulled).toBe(0);
      expect(stats.distanceCulled).toBe(0);
      expect(stats.totalTraversalTime).toBe(0);
    });

    it('should update configuration', () => {
      const newConfig = {
        enableFrustumCulling: false,
        maxRenderDistance: 200,
        lodDistances: [50, 100, 150, 200],
      };

      bspCuller.updateConfig(newConfig);

      const config = bspCuller.getConfig();
      expect(config.enableFrustumCulling).toBe(false);
      expect(config.maxRenderDistance).toBe(200);
      expect(config.lodDistances).toEqual([50, 100, 150, 200]);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty sector list', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const emptyBSP = new BSPTree([]);
      const result = bspCuller.cull(emptyBSP, viewPosition, viewMatrix, projectionMatrix, []);

      expect(result.visibleSectors).toHaveLength(0);
      expect(result.culledSectors).toHaveLength(0);
      expect(result.metrics.totalObjects).toBe(0);
      expect(result.metrics.cullingEfficiency).toBe(0);
    });

    it('should handle sectors with no vertices', () => {
      const emptySector: DoomSector = {
        id: 99,
        vertices: [],
        lineDefs: [],
        floorHeight: 0,
        ceilingHeight: 10,
        floorTexture: 'floor1',
        ceilingTexture: 'ceiling1',
        lightLevel: 128,
        tag: 0,
        type: 0,
      };

      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const emptyBSP = new BSPTree([emptySector]);
      const result = bspCuller.cull(emptyBSP, viewPosition, viewMatrix, projectionMatrix, [
        emptySector,
      ]);

      // Should not crash
      expect(result).toBeDefined();
    });

    it('should handle all culling disabled', () => {
      bspCuller.updateConfig({
        enableFrustumCulling: false,
        enableOcclusionCulling: false,
        enableDistanceCulling: false,
      });

      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      const result = bspCuller.cull(
        bspTree,
        viewPosition,
        viewMatrix,
        projectionMatrix,
        testSectors
      );

      // Should have all sectors visible (only BSP culling active)
      expect(result.metrics.frustumCulled).toBe(0);
      expect(result.metrics.occlusionCulled).toBe(0);
      expect(result.metrics.distanceCulled).toBe(0);
    });
  });

  describe('Performance Integration', () => {
    it('should update performance manager correctly', () => {
      const viewPosition = new Vector3(0, 5, 0);
      const viewMatrix = Matrix.LookAtLH(viewPosition, Vector3.Zero(), Vector3.Up());
      const projectionMatrix = Matrix.PerspectiveFovLH(Math.PI / 4, 1, 0.1, 1000);

      bspCuller.cull(bspTree, viewPosition, viewMatrix, projectionMatrix, testSectors);

      const metrics = performanceManager.getMetrics();
      expect(metrics.bspTraversalTime).toBeGreaterThanOrEqual(0);
      expect(metrics.totalSectors).toBe(testSectors.length);
    });
  });
});
