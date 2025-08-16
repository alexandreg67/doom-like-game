import type { Engine, Scene } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnifiedRenderer, createUnifiedRenderer } from '../unified-renderer';

// Mock Babylon.js Engine and Scene
const mockEngine = {
  getRenderingCanvas: vi.fn(() => ({
    getContext: vi.fn(),
    width: 800,
    height: 600,
  })),
  dispose: vi.fn(),
};

const mockScene = {
  dispose: vi.fn(),
};

// Mock WebGPU and WebGL renderers
const mockWebGPURenderer = {
  initialize: vi.fn(),
  dispose: vi.fn(),
  getCapabilities: vi.fn(() => ({
    maxTextureSize: 8192,
    maxBufferSize: 256 * 1024 * 1024,
    maxBindGroups: 8,
  })),
  getDetailedCapabilities: vi.fn(() => ({
    features: ['texture-compression-bc'],
    limits: { maxTextureDimension2D: 8192 },
  })),
  getBabylonEngine: vi.fn(() => mockEngine),
};

const mockWebGLRenderer = {
  initialize: vi.fn(),
  dispose: vi.fn(),
  getCapabilities: vi.fn(() => ({
    maxTextureSize: 4096,
    maxBufferSize: 128 * 1024 * 1024,
    maxBindGroups: 4,
  })),
};

const mockSectorRenderer = {
  setRenderMode: vi.fn(),
  getRenderMode: vi.fn(() => 'solid'),
  getMetrics: vi.fn(() => ({
    sectors: 2,
    meshes: 6,
    vertices: 144,
    materials: 3,
    renderMode: 'solid',
  })),
  dispose: vi.fn(),
};

// Mock the renderer classes
vi.mock('../webgpu-renderer', () => ({
  WebGPURenderer: vi.fn(() => mockWebGPURenderer),
}));

vi.mock('../webgl-renderer', () => ({
  WebGLRenderer: vi.fn(() => mockWebGLRenderer),
}));

vi.mock('../sector-renderer', () => ({
  SectorRenderer: vi.fn(() => mockSectorRenderer),
}));

// Mock Logger
vi.mock('../../utils/logger', () => ({
  Logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('UnifiedRenderer', () => {
  let unifiedRenderer: UnifiedRenderer;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset mock returns
    mockWebGPURenderer.initialize.mockResolvedValue(undefined);
    mockWebGLRenderer.initialize.mockResolvedValue(undefined);

    // Mock navigator.gpu to simulate WebGPU support
    Object.defineProperty(navigator, 'gpu', {
      value: {
        requestAdapter: vi.fn(),
      },
      configurable: true,
    });

    // Mock the static isWebGPUSupported method
    vi.spyOn(UnifiedRenderer, 'isWebGPUSupported').mockReturnValue(true);
  });

  afterEach(() => {
    unifiedRenderer?.dispose();
  });

  describe('Construction and Initialization', () => {
    it('should create UnifiedRenderer successfully', () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, true);
      expect(unifiedRenderer).toBeDefined();
      expect(['webgpu', 'webgl']).toContain(unifiedRenderer.getRendererType());
    });

    it('should create UnifiedRenderer with WebGL preference', () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      expect(unifiedRenderer.getRendererType()).toBe('webgl');
    });

    it('should throw error if canvas is not available', () => {
      const engineWithoutCanvas = {
        ...mockEngine,
        getRenderingCanvas: vi.fn(() => null),
      };

      expect(() => {
        new UnifiedRenderer(engineWithoutCanvas as Engine, mockScene as Scene);
      }).toThrow('Rendering canvas is not available from engine');
    });

    it('should initialize renderer successfully', async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await unifiedRenderer.initialize();

      // Either WebGPU or WebGL should be initialized
      const webgpuCalled = mockWebGPURenderer.initialize.mock.calls.length > 0;
      const webglCalled = mockWebGLRenderer.initialize.mock.calls.length > 0;
      expect(webgpuCalled || webglCalled).toBe(true);
    });

    it('should handle initialization failure gracefully', async () => {
      // Setup both renderers to fail
      mockWebGPURenderer.initialize.mockReset();
      mockWebGLRenderer.initialize.mockReset();
      mockWebGPURenderer.initialize.mockRejectedValue(new Error('WebGPU failed'));
      mockWebGLRenderer.initialize.mockRejectedValue(new Error('WebGL failed'));

      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, true);

      await expect(unifiedRenderer.initialize()).rejects.toThrow();
    });

    it('should not initialize twice', async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await unifiedRenderer.initialize();

      const initialCalls = mockWebGLRenderer.initialize.mock.calls.length;
      await unifiedRenderer.initialize(); // Second call

      expect(mockWebGLRenderer.initialize.mock.calls.length).toBe(initialCalls);
    });
  });

  describe('Static Methods', () => {
    it('should have static detection methods', () => {
      expect(typeof UnifiedRenderer.isWebGPUSupported).toBe('function');
      expect(typeof UnifiedRenderer.getRecommendedRendererType).toBe('function');
    });

    it('should return valid renderer type recommendations', () => {
      const recommended = UnifiedRenderer.getRecommendedRendererType();
      expect(['webgpu', 'webgl']).toContain(recommended);
    });
  });

  describe('Render Mode Management', () => {
    beforeEach(async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, true);
      await unifiedRenderer.initialize();
    });

    it('should set render mode', () => {
      unifiedRenderer.setRenderMode('wireframe');
      expect(mockSectorRenderer.setRenderMode).toHaveBeenCalledWith('wireframe');
    });

    it('should get render mode', () => {
      const mode = unifiedRenderer.getRenderMode();
      expect(mockSectorRenderer.getRenderMode).toHaveBeenCalled();
      expect(mode).toBe('solid');
    });
  });

  describe('Performance Tracking', () => {
    beforeEach(async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, true);
      await unifiedRenderer.initialize();
    });

    it('should track frame metrics', () => {
      unifiedRenderer.beginFrame();
      unifiedRenderer.addDrawCall(100);
      unifiedRenderer.endFrame();

      const metrics = unifiedRenderer.getMetrics();
      expect(metrics.drawCalls).toBe(1);
      expect(metrics.vertices).toBe(100);
      expect(metrics.triangles).toBe(33); // 100 / 3 rounded down
      expect(metrics.frameTime).toBeGreaterThanOrEqual(0); // Allow 0 for fast tests
    });

    it('should track memory usage', () => {
      unifiedRenderer.addTextureMemory(1024);
      unifiedRenderer.addBufferMemory(2048);

      const metrics = unifiedRenderer.getMetrics();
      expect(metrics.textureMemory).toBe(1024);
      expect(metrics.bufferMemory).toBe(2048);
    });

    it('should reset frame metrics each frame', () => {
      unifiedRenderer.beginFrame();
      unifiedRenderer.addDrawCall(50);
      unifiedRenderer.endFrame();

      unifiedRenderer.beginFrame();
      unifiedRenderer.addDrawCall(25);

      const metrics = unifiedRenderer.getMetrics();
      expect(metrics.drawCalls).toBe(1); // Should be reset
      expect(metrics.vertices).toBe(25); // Should be reset
    });

    it('should include sector metrics', () => {
      const metrics = unifiedRenderer.getMetrics();
      expect(metrics.sectorMetrics).toBeDefined();
      expect(metrics.sectorMetrics.sectors).toBe(2);
      expect(metrics.sectorMetrics.meshes).toBe(6);
    });
  });

  describe('Capabilities', () => {
    it('should return capabilities with required fields', async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await unifiedRenderer.initialize();

      const capabilities = unifiedRenderer.getCapabilities();
      expect(capabilities).toHaveProperty('maxTextureSize');
      expect(capabilities).toHaveProperty('maxBufferSize');
      expect(capabilities).toHaveProperty('supportsCompute');
      expect(capabilities).toHaveProperty('supportsRayTracing');
      expect(capabilities).toHaveProperty('maxBindGroups');

      expect(typeof capabilities.maxTextureSize).toBe('number');
      expect(typeof capabilities.supportsCompute).toBe('boolean');
      expect(capabilities.supportsRayTracing).toBe(false); // Always false for now
    });

    it('should return detailed capabilities', async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await unifiedRenderer.initialize();

      const detailed = unifiedRenderer.getDetailedCapabilities();
      expect(detailed).toBeDefined();
      expect(typeof detailed).toBe('object');
    });

    it('should compute support depend on renderer type', async () => {
      const webglRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await webglRenderer.initialize();

      const capabilities = webglRenderer.getCapabilities();
      // WebGL renderer should not support compute
      expect(capabilities.supportsCompute).toBe(false);

      webglRenderer.dispose();
    });
  });

  describe('Accessors', () => {
    beforeEach(async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);
      await unifiedRenderer.initialize();
    });

    it('should return active renderer', () => {
      const renderer = unifiedRenderer.getActiveRenderer();
      expect(renderer).toBeDefined();
    });

    it('should return sector renderer', () => {
      const sectorRenderer = unifiedRenderer.getSectorRenderer();
      expect(sectorRenderer).toBe(mockSectorRenderer);
    });

    it('should return Babylon engine', () => {
      const engine = unifiedRenderer.getBabylonEngine();
      expect(engine).toBeDefined();
    });

    it('should return renderer type', () => {
      const type = unifiedRenderer.getRendererType();
      expect(['webgpu', 'webgl']).toContain(type);
    });
  });

  describe('Factory Function', () => {
    it('should create and initialize renderer with factory', async () => {
      const renderer = await createUnifiedRenderer(mockEngine as Engine, mockScene as Scene, false);

      expect(['webgpu', 'webgl']).toContain(renderer.getRendererType());
      expect(renderer).toBeDefined();

      renderer.dispose();
    });

    it('should handle factory initialization errors', async () => {
      // Reset mocks
      mockWebGPURenderer.initialize.mockReset();
      mockWebGLRenderer.initialize.mockReset();

      // Set both to fail
      mockWebGPURenderer.initialize.mockRejectedValue(new Error('Init failed'));
      mockWebGLRenderer.initialize.mockRejectedValue(new Error('WebGL failed too'));

      await expect(
        createUnifiedRenderer(mockEngine as Engine, mockScene as Scene, true)
      ).rejects.toThrow();
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      unifiedRenderer = new UnifiedRenderer(mockEngine as Engine, mockScene as Scene, true);
      await unifiedRenderer.initialize();
    });

    it('should dispose all resources', () => {
      unifiedRenderer.dispose();

      expect(mockSectorRenderer.dispose).toHaveBeenCalled();
      expect(mockWebGPURenderer.dispose).toHaveBeenCalled();
    });
  });
});
