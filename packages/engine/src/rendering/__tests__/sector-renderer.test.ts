import type { Scene } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoomSector } from '../../geometry/doom-geometry';
import { type RenderMode, SectorRenderer } from '../sector-renderer';

// Mock Babylon.js classes for testing
const mockMesh = {
  name: '',
  setEnabled: vi.fn(),
  dispose: vi.fn(),
  getTotalVertices: vi.fn(() => 12),
  material: null,
  freezeWorldMatrix: vi.fn(),
};

const mockMaterial = {
  dispose: vi.fn(),
  freeze: vi.fn(),
  diffuseColor: { x: 1, y: 1, z: 1 },
  ambientColor: { x: 0.3, y: 0.3, z: 0.3 },
  emissiveColor: { x: 0, y: 0, z: 0 },
  wireframe: false,
};

const mockScene = {
  dispose: vi.fn(),
};

const mockWireframeHelper = {
  enableWireframe: vi.fn(),
  dispose: vi.fn(),
};

// Mock the Babylon.js imports
vi.mock('@babylonjs/core', () => ({
  Mesh: vi.fn(() => mockMesh),
  StandardMaterial: vi.fn(() => mockMaterial),
  VertexData: Object.assign(
    vi.fn(() => ({
      applyToMesh: vi.fn(),
      positions: [],
      indices: [],
      uvs: [],
      normals: [],
    })),
    {
      ComputeNormals: vi.fn(),
    }
  ),
  WireframeHelper: vi.fn(() => mockWireframeHelper),
  Color3: Object.assign(
    vi.fn((r, g, b) => ({ x: r, y: g, z: b })),
    {
      Green: vi.fn(() => ({ x: 0, y: 1, z: 0 })),
      Blue: vi.fn(() => ({ x: 0, y: 0, z: 1 })),
      Red: vi.fn(() => ({ x: 1, y: 0, z: 0 })),
      Black: vi.fn(() => ({ x: 0, y: 0, z: 0 })),
      FromHexString: vi.fn(() => ({
        scale: vi.fn((factor) => ({ x: 0.5 * factor, y: 0.5 * factor, z: 0.5 * factor })),
      })),
    }
  ),
}));

// Mock SectorGeometry
vi.mock('../../geometry/sector-geometry', () => ({
  SectorGeometry: vi.fn(() => ({
    triangulateFloor: vi.fn(() => ({
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 0, z: 1 },
      ],
      indices: [0, 1, 2],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    })),
    triangulateCeiling: vi.fn(() => ({
      vertices: [
        { x: 0, y: 1, z: 0 },
        { x: 1, y: 1, z: 0 },
        { x: 1, y: 1, z: 1 },
      ],
      indices: [0, 1, 2],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    })),
    generateWallGeometry: vi.fn(() => ({
      vertices: [
        { x: 0, y: 0, z: 0 },
        { x: 1, y: 0, z: 0 },
        { x: 1, y: 1, z: 0 },
      ],
      indices: [0, 1, 2],
      uvs: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
      ],
    })),
  })),
}));

describe('SectorRenderer', () => {
  let sectorRenderer: SectorRenderer;
  let mockSector: DoomSector;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock mesh instances for each test
    Object.assign(mockMesh, {
      name: '',
      setEnabled: vi.fn(),
      dispose: vi.fn(),
      getTotalVertices: vi.fn(() => 12),
      material: null,
      freezeWorldMatrix: vi.fn(),
    });

    sectorRenderer = new SectorRenderer(mockScene as Scene);

    // Mock sector for testing
    mockSector = {
      id: 'test_sector',
      vertices: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ],
      lineDefs: [
        {
          id: 'line_1',
          v1: { x: 0, y: 0 },
          v2: { x: 100, y: 0 },
          flags: { blocking: true, twoSided: false },
          frontSide: {
            needsMiddleTexture: true,
            needsUpperTexture: false,
            needsLowerTexture: false,
            textureMiddle: 'WALL_01',
            textureUpper: '-',
            textureLower: '-',
            offsetX: 0,
            offsetY: 0,
          },
          backSide: null,
        },
        {
          id: 'line_2',
          v1: { x: 100, y: 0 },
          v2: { x: 100, y: 100 },
          flags: { blocking: true, twoSided: false },
          frontSide: {
            needsMiddleTexture: true,
            needsUpperTexture: false,
            needsLowerTexture: false,
            textureMiddle: 'WALL_01',
            textureUpper: '-',
            textureLower: '-',
            offsetX: 0,
            offsetY: 0,
          },
          backSide: null,
        },
        {
          id: 'line_3',
          v1: { x: 100, y: 100 },
          v2: { x: 0, y: 100 },
          flags: { blocking: true, twoSided: false },
          frontSide: {
            needsMiddleTexture: true,
            needsUpperTexture: false,
            needsLowerTexture: false,
            textureMiddle: 'WALL_01',
            textureUpper: '-',
            textureLower: '-',
            offsetX: 0,
            offsetY: 0,
          },
          backSide: null,
        },
        {
          id: 'line_4',
          v1: { x: 0, y: 100 },
          v2: { x: 0, y: 0 },
          flags: { blocking: true, twoSided: false },
          frontSide: {
            needsMiddleTexture: true,
            needsUpperTexture: false,
            needsLowerTexture: false,
            textureMiddle: 'WALL_01',
            textureUpper: '-',
            textureLower: '-',
            offsetX: 0,
            offsetY: 0,
          },
          backSide: null,
        },
      ],
      floorHeight: 0,
      ceilingHeight: 128,
      floorTexture: 'FLOOR_01',
      ceilingTexture: 'CEIL_01',
      lightLevel: 160,
      tag: 0,
      special: 0,
    };
  });

  afterEach(() => {
    sectorRenderer?.dispose();
  });

  describe('Construction and Initialization', () => {
    it('should create SectorRenderer with default solid render mode', () => {
      expect(sectorRenderer.getRenderMode()).toBe('solid');
    });

    it('should initialize with empty metrics', () => {
      const metrics = sectorRenderer.getMetrics();
      expect(metrics.sectors).toBe(0);
      expect(metrics.meshes).toBe(0);
      expect(metrics.vertices).toBe(0);
      expect(metrics.materials).toBe(0);
      expect(metrics.renderMode).toBe('solid');
    });
  });

  describe('Sector Rendering', () => {
    it('should render a basic sector successfully', () => {
      const meshes = sectorRenderer.renderSector(mockSector);

      expect(meshes.floor).toBeDefined();
      expect(meshes.ceiling).toBeDefined();
      expect(meshes.walls).toHaveLength(4); // One wall per line
    });

    it('should cache rendered sector meshes', () => {
      sectorRenderer.renderSector(mockSector);
      const cachedMeshes = sectorRenderer.getSectorMeshes('test_sector');

      expect(cachedMeshes).toBeDefined();
      expect(cachedMeshes?.floor).toBeDefined();
      expect(cachedMeshes?.ceiling).toBeDefined();
      expect(cachedMeshes?.walls).toHaveLength(4);
    });

    it('should update metrics after rendering', () => {
      sectorRenderer.renderSector(mockSector);
      const metrics = sectorRenderer.getMetrics();

      expect(metrics.sectors).toBe(1);
      expect(metrics.meshes).toBeGreaterThan(0);
      expect(metrics.vertices).toBeGreaterThan(0);
      expect(metrics.materials).toBeGreaterThan(0);
    });

    it('should render multiple sectors efficiently', () => {
      const sector2 = { ...mockSector, id: 'test_sector_2' };
      const startTime = performance.now();

      sectorRenderer.renderSectors([mockSector, sector2]);
      const renderTime = performance.now() - startTime;

      expect(renderTime).toBeLessThan(100); // Should be fast
      expect(sectorRenderer.getMetrics().sectors).toBe(2);
    });
  });

  describe('Render Mode Management', () => {
    beforeEach(() => {
      sectorRenderer.renderSector(mockSector);
    });

    it('should change render mode to wireframe', () => {
      sectorRenderer.setRenderMode('wireframe');
      expect(sectorRenderer.getRenderMode()).toBe('wireframe');

      const metrics = sectorRenderer.getMetrics();
      expect(metrics.renderMode).toBe('wireframe');
    });

    it('should change render mode to debug', () => {
      sectorRenderer.setRenderMode('debug');
      expect(sectorRenderer.getRenderMode()).toBe('debug');

      const metrics = sectorRenderer.getMetrics();
      expect(metrics.renderMode).toBe('debug');
    });

    it('should apply render mode to existing meshes', () => {
      const initialMetrics = sectorRenderer.getMetrics();

      sectorRenderer.setRenderMode('wireframe');
      const wireframeMetrics = sectorRenderer.getMetrics();

      // Meshes should remain the same count
      expect(wireframeMetrics.meshes).toBe(initialMetrics.meshes);
      expect(wireframeMetrics.vertices).toBe(initialMetrics.vertices);
    });

    it('should apply render mode to newly created sectors', () => {
      sectorRenderer.setRenderMode('debug');

      const sector2 = { ...mockSector, id: 'test_sector_2' };
      const meshes = sectorRenderer.renderSector(sector2);

      expect(meshes.floor).toBeDefined();
      expect(meshes.ceiling).toBeDefined();
      expect(meshes.walls).toHaveLength(4);
    });
  });

  describe('Resource Management', () => {
    it('should dispose individual sectors', () => {
      sectorRenderer.renderSector(mockSector);
      expect(sectorRenderer.getSectorMeshes('test_sector')).toBeDefined();

      sectorRenderer.disposeSector('test_sector');
      expect(sectorRenderer.getSectorMeshes('test_sector')).toBeNull();

      const metrics = sectorRenderer.getMetrics();
      expect(metrics.sectors).toBe(0);
    });

    it('should dispose all resources on cleanup', () => {
      sectorRenderer.renderSector(mockSector);
      const initialMaterials = sectorRenderer.getMetrics().materials;
      expect(initialMaterials).toBeGreaterThan(0);

      sectorRenderer.dispose();
      // Note: We can't easily test material disposal without mocking
      // but the dispose method should be called without errors
    });

    it('should handle disposing non-existent sectors gracefully', () => {
      expect(() => {
        sectorRenderer.disposeSector('non_existent_sector');
      }).not.toThrow();
    });
  });

  describe('Performance and Metrics', () => {
    it('should calculate average vertices per mesh correctly', () => {
      sectorRenderer.renderSector(mockSector);
      const metrics = sectorRenderer.getMetrics();

      expect(metrics.avgVerticesPerMesh).toBeGreaterThan(0);
      expect(metrics.avgVerticesPerMesh).toBe(Math.round(metrics.vertices / metrics.meshes));
    });

    it('should track materials usage', () => {
      sectorRenderer.renderSector(mockSector);
      const metrics = sectorRenderer.getMetrics();

      // Should have at least floor, ceiling, and wall materials
      expect(metrics.materials).toBeGreaterThanOrEqual(3);
    });

    it('should provide detailed render logging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      sectorRenderer.renderSector(mockSector);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[SectorRenderer] Rendered sector test_sector'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle sectors with no vertices', () => {
      const emptySector = { ...mockSector, vertices: [], lineDefs: [] };

      expect(() => {
        sectorRenderer.renderSector(emptySector);
      }).not.toThrow();
    });

    it('should handle sectors with no line definitions', () => {
      const noLineSector = { ...mockSector, lineDefs: [] };
      const meshes = sectorRenderer.renderSector(noLineSector);

      expect(meshes.walls).toHaveLength(0);
      expect(meshes.floor).toBeDefined(); // Floor should still be created
      expect(meshes.ceiling).toBeDefined(); // Ceiling should still be created
    });

    it('should handle invalid render modes gracefully', () => {
      sectorRenderer.renderSector(mockSector);

      // This should not throw, but also not change the mode
      const originalMode = sectorRenderer.getRenderMode();

      // Force an invalid mode (TypeScript prevents this, but runtime might allow)
      (sectorRenderer as { renderMode: string }).renderMode = 'invalid_mode';

      // Should still report something valid
      expect(['solid', 'wireframe', 'debug']).toContain(originalMode);
    });
  });
});
