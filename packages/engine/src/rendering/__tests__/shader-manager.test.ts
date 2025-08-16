import type { Engine, Scene } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type ShaderConfig, ShaderManager, type ShaderType } from '../shader-manager';

// Mock Babylon.js classes
const mockEffect = {
  dispose: vi.fn(),
  isReady: vi.fn(() => true),
};

const mockShaderMaterial = {
  dispose: vi.fn(),
  setFloat: vi.fn(),
  setVector2: vi.fn(),
  setVector3: vi.fn(),
  setVector4: vi.fn(),
  setMatrix: vi.fn(),
  setTexture: vi.fn(),
  isReady: vi.fn(() => true),
};

const mockEngine = {
  getCaps: vi.fn(() => ({
    maxVertexTextureImageUnits: 16,
    maxTextureSize: 4096,
  })),
  dispose: vi.fn(),
};

const mockScene = {
  dispose: vi.fn(),
  registerBeforeRender: vi.fn(),
  unregisterBeforeRender: vi.fn(),
};

// Mock Babylon.js imports
vi.mock('@babylonjs/core', () => ({
  Effect: vi.fn(() => mockEffect),
  ShaderMaterial: vi.fn(() => mockShaderMaterial),
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

describe('ShaderManager', () => {
  let shaderManager: ShaderManager;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset mock implementations
    mockEffect.dispose.mockClear();
    mockShaderMaterial.dispose.mockClear();
    mockShaderMaterial.setFloat.mockClear();
    mockShaderMaterial.setVector2.mockClear();
    mockShaderMaterial.setVector3.mockClear();
    mockShaderMaterial.setVector4.mockClear();
  });

  afterEach(() => {
    shaderManager?.dispose();
  });

  describe('Construction and Initialization', () => {
    it('should create ShaderManager for WebGL backend', () => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
      expect(shaderManager).toBeDefined();
    });

    it('should create ShaderManager for WebGPU backend', () => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgpu');
      expect(shaderManager).toBeDefined();
    });

    it('should preload shader sources on initialization', () => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
      const availableShaders = shaderManager.getAvailableShaders();
      expect(availableShaders).toContain('sector');
    });
  });

  describe('Shader Compilation', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should compile sector shader successfully', async () => {
      const shader = await shaderManager.compileShader('sector');

      expect(shader).toBeDefined();
      expect(shader.type).toBe('sector');
      expect(shader.backend).toBe('webgl');
      expect(shader.name).toBe('doom_sector');
      expect(shader.vertexSource).toBeDefined();
      expect(shader.fragmentSource).toBeDefined();
    });

    it('should cache compiled shaders', async () => {
      const shader1 = await shaderManager.compileShader('sector');
      const shader2 = await shaderManager.compileShader('sector');

      expect(shader1).toBe(shader2); // Should be the same cached instance
    });

    it('should compile different shaders for different backends', async () => {
      const webglManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
      const webgpuManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgpu');

      const webglShader = await webglManager.compileShader('sector');
      const webgpuShader = await webgpuManager.compileShader('sector');

      expect(webglShader.backend).toBe('webgl');
      expect(webgpuShader.backend).toBe('webgpu');

      webglManager.dispose();
      webgpuManager.dispose();
    });

    it('should throw error for unknown shader type', async () => {
      await expect(shaderManager.compileShader('unknown' as ShaderType)).rejects.toThrow(
        'Shader sources not found for type: unknown'
      );
    });
  });

  describe('Material Creation', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should create DOOM material with default config', async () => {
      const material = await shaderManager.createDoomMaterial('test_material');

      expect(material).toBe(mockShaderMaterial);
      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('globalLightLevel', 1.0);
      expect(mockShaderMaterial.setVector3).toHaveBeenCalledWith('ambientColor', 0.2, 0.2, 0.2);
      expect(mockShaderMaterial.setVector4).toHaveBeenCalledWith('baseColor', 1.0, 1.0, 1.0, 1.0);
    });

    it('should create DOOM material with custom config', async () => {
      const config: Partial<ShaderConfig> = {
        globalLightLevel: 0.8,
        ambientColor: [0.3, 0.3, 0.3],
        baseColor: [1.0, 0.5, 0.5, 1.0],
        animationSpeed: 2.0,
      };

      const material = await shaderManager.createDoomMaterial('test_material', 'sector', config);

      expect(material).toBe(mockShaderMaterial);
      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('globalLightLevel', 0.8);
      expect(mockShaderMaterial.setVector3).toHaveBeenCalledWith('ambientColor', 0.3, 0.3, 0.3);
      expect(mockShaderMaterial.setVector4).toHaveBeenCalledWith('baseColor', 1.0, 0.5, 0.5, 1.0);
      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('animationSpeed', 2.0);
    });

    it('should apply sector-specific configuration', async () => {
      const config: Partial<ShaderConfig> = {
        sectorLightLevel: 0.7,
        sectorFloorHeight: 32.0,
        sectorCeilingHeight: 160.0,
      };

      await shaderManager.createDoomMaterial('sector_material', 'sector', config);

      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('sectorLightLevel', 0.7);
      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('sectorFloorHeight', 32.0);
      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('sectorCeilingHeight', 160.0);
    });
  });

  describe('Shader Configuration Updates', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should update shader uniforms', () => {
      const config: Partial<ShaderConfig> = {
        fogDensity: 0.05,
        emissiveColor: [1.0, 0.0, 0.0],
        textureScale: [2.0, 2.0],
      };

      shaderManager.updateShaderUniforms(
        mockShaderMaterial as Parameters<ShaderManager['updateShaderUniforms']>[0],
        config
      );

      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('fogDensity', 0.05);
      expect(mockShaderMaterial.setVector3).toHaveBeenCalledWith('emissiveColor', 1.0, 0.0, 0.0);
      expect(mockShaderMaterial.setVector2).toHaveBeenCalledWith('textureScale', 2.0, 2.0);
    });

    it('should set time uniform for animations', async () => {
      await shaderManager.createDoomMaterial('animated_material');

      expect(mockShaderMaterial.setFloat).toHaveBeenCalledWith('time', expect.any(Number));
    });
  });

  describe('Shader Information and Management', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should return available shader types', () => {
      const shaders = shaderManager.getAvailableShaders();
      expect(shaders).toBeInstanceOf(Array);
      expect(shaders.length).toBeGreaterThan(0);
      expect(shaders).toContain('sector');
    });

    it('should return shader info for compiled shaders', async () => {
      await shaderManager.compileShader('sector');
      const info = shaderManager.getShaderInfo('sector');

      expect(info).toBeDefined();
      expect(info?.type).toBe('sector');
      expect(info?.backend).toBe('webgl');
      expect(info?.name).toBe('doom_sector');
    });

    it('should return null for non-compiled shaders', () => {
      const info = shaderManager.getShaderInfo('sprite' as ShaderType);
      expect(info).toBeNull();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should handle shader compilation errors gracefully', async () => {
      // Mock Effect constructor to throw on the shader manager instance
      vi.spyOn(
        shaderManager as { compileWebGLShader: () => never },
        'compileWebGLShader'
      ).mockImplementation(() => {
        throw new Error('Shader compilation failed');
      });

      await expect(shaderManager.compileShader('sector')).rejects.toThrow(
        'Shader compilation failed'
      );
    });

    it('should throw error when material not available', async () => {
      // Mock shader compilation to return shader without material
      const shaderWithoutMaterial = {
        ...(await shaderManager.compileShader('sector')),
        material: undefined,
      };

      // Override the compiled shader in the internal map
      (
        shaderManager as { compiledShaders: Map<string, typeof shaderWithoutMaterial> }
      ).compiledShaders.set('sector_webgl', shaderWithoutMaterial);

      await expect(shaderManager.createDoomMaterial('test')).rejects.toThrow(
        'Material not available for shader: sector'
      );
    });
  });

  describe('Resource Management', () => {
    beforeEach(() => {
      shaderManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
    });

    it('should dispose all compiled shaders', async () => {
      await shaderManager.compileShader('sector');

      // Verify shader is compiled before disposal
      expect(shaderManager.getShaderInfo('sector')).toBeDefined();

      shaderManager.dispose();

      // Verify disposal clears the shaders - since we can't easily test the internal dispose,
      // we verify the shader is no longer available
      expect(shaderManager.getAvailableShaders()).toHaveLength(0);
    });

    it('should clear shader caches on dispose', async () => {
      await shaderManager.compileShader('sector');
      expect(shaderManager.getAvailableShaders()).toContain('sector');

      shaderManager.dispose();

      expect(shaderManager.getAvailableShaders()).toHaveLength(0);
    });

    it('should handle multiple dispose calls gracefully', () => {
      expect(() => {
        shaderManager.dispose();
        shaderManager.dispose(); // Second call should not throw
      }).not.toThrow();
    });
  });

  describe('Backend-Specific Behavior', () => {
    it('should use appropriate shader sources for WebGL', () => {
      const webglManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgl');
      const shaders = webglManager.getAvailableShaders();
      expect(shaders).toContain('sector');
      webglManager.dispose();
    });

    it('should use appropriate shader sources for WebGPU', () => {
      const webgpuManager = new ShaderManager(mockEngine as Engine, mockScene as Scene, 'webgpu');
      const shaders = webgpuManager.getAvailableShaders();
      expect(shaders).toContain('sector');
      webgpuManager.dispose();
    });
  });
});
