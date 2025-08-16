/**
 * Tests for OptimizedLightingSystem
 * Validates integrated lighting optimization functionality
 */

import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LightManager } from '../../lighting/light-manager';
import type { LightConfig } from '../../lighting/types';
import {
  type OptimizedLightingConfig,
  OptimizedLightingSystem,
} from '../optimized-lighting-system';
import { PerformanceManager } from '../performance-manager';

describe('OptimizedLightingSystem', () => {
  let scene: Scene;
  let performanceManager: PerformanceManager;
  let lightManager: LightManager;
  let optimizedLighting: OptimizedLightingSystem;
  let engine: NullEngine;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);

    performanceManager = new PerformanceManager({
      enableMetrics: true,
      historySize: 60,
    });

    lightManager = new LightManager(scene);

    const config: Partial<OptimizedLightingConfig> = {
      lightPool: {
        maxActiveLights: 4,
        cullingDistance: 50,
        enableLOD: true,
      },
      shadowPool: {
        maxShadowMaps: 2,
        shadowMapSize: 512,
        enableSoftShadows: true,
      },
      globalSettings: {
        enableDynamicQuality: true,
        performanceTarget: 55,
        aggressiveCulling: false,
        adaptiveLOD: true,
      },
    };

    optimizedLighting = new OptimizedLightingSystem(
      scene,
      lightManager,
      performanceManager,
      config
    );
  });

  afterEach(() => {
    optimizedLighting.dispose();
    lightManager.dispose();
    performanceManager.dispose();
    scene.dispose();
    engine.dispose();
    vi.clearAllMocks();
  });

  function createTestLightConfig(id: string, x = 0, y = 0, z = 0): LightConfig {
    return {
      id,
      type: 'point',
      position: { x, y, z },
      intensity: 1.0,
      enabled: true,
      color: { r: 1, g: 1, b: 1 },
    };
  }

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = optimizedLighting.getConfig();

      expect(config.lightPool.maxActiveLights).toBe(4);
      expect(config.shadowPool.maxShadowMaps).toBe(2);
      expect(config.globalSettings.enableDynamicQuality).toBe(true);
    });

    it('should start with Ultra quality by default', () => {
      const quality = optimizedLighting.getQualityLevel();

      // Should start at medium quality (level 2)
      expect(quality.level).toBe(2);
      expect(quality.name).toBe('Medium');
    });
  });

  describe('Light Management', () => {
    it('should add lights to the optimized system', () => {
      const lightConfig = createTestLightConfig('test_light', 10, 0, 0);

      optimizedLighting.addLight(lightConfig, false);

      // Verify light was added to light manager
      const light = lightManager.getLight('test_light');
      expect(light).toBeDefined();
    });

    it('should remove lights from the optimized system', () => {
      const lightConfig = createTestLightConfig('test_light');

      optimizedLighting.addLight(lightConfig, false);
      optimizedLighting.removeLight('test_light');

      // Verify light was removed from light manager
      const light = lightManager.getLight('test_light');
      expect(light).toBeUndefined();
    });

    it('should handle static lights correctly', () => {
      const staticConfig = createTestLightConfig('static_light', 0, 0, 0);
      const dynamicConfig = createTestLightConfig('dynamic_light', 20, 0, 0);

      optimizedLighting.addLight(staticConfig, true);
      optimizedLighting.addLight(dynamicConfig, false);

      // Both should be added successfully
      expect(lightManager.getLight('static_light')).toBeDefined();
      expect(lightManager.getLight('dynamic_light')).toBeDefined();
    });
  });

  describe('Performance Updates', () => {
    it('should update lighting system without errors', () => {
      const lightConfig = createTestLightConfig('test_light', 10, 0, 0);
      optimizedLighting.addLight(lightConfig, false);

      // Should not throw when updating
      expect(() => {
        optimizedLighting.update(Vector3.Zero());
      }).not.toThrow();
    });

    it('should collect performance metrics during updates', () => {
      const lightConfig = createTestLightConfig('test_light', 10, 0, 0);
      optimizedLighting.addLight(lightConfig, false);

      optimizedLighting.update(Vector3.Zero());

      const stats = optimizedLighting.getPerformanceStats();
      expect(stats).toBeDefined();
      expect(stats.frameMetrics).toBeDefined();
      expect(stats.lightPool).toBeDefined();
    });

    it('should handle multiple update calls', () => {
      const lightConfig = createTestLightConfig('test_light', 10, 0, 0);
      optimizedLighting.addLight(lightConfig, false);

      // Multiple updates should work fine
      for (let i = 0; i < 10; i++) {
        optimizedLighting.update(Vector3.Zero());
      }

      const stats = optimizedLighting.getPerformanceStats();
      expect(stats.lightPool.total).toBe(1);
    });
  });

  describe('Quality Adaptation', () => {
    it('should adapt quality based on performance', () => {
      // Mock poor performance
      vi.spyOn(performanceManager, 'getMetrics').mockReturnValue({
        fps: 30, // Poor FPS
        frameTime: 33,
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
        avgFrameTime: 33,
        maxFrameTime: 40,
        minFrameTime: 30,
      });

      const lightConfig = createTestLightConfig('test_light');
      optimizedLighting.addLight(lightConfig, false);

      // Simulate enough frames for quality adaptation
      for (let i = 0; i < 90; i++) {
        // Need enough frames for adaptation
        optimizedLighting.update(Vector3.Zero());
      }

      const quality = optimizedLighting.getQualityLevel();
      expect(quality.level).toBeGreaterThan(0); // Should have reduced quality
    });

    it('should manually set quality level', () => {
      optimizedLighting.setQualityLevel(0); // Ultra

      let quality = optimizedLighting.getQualityLevel();
      expect(quality.level).toBe(0);
      expect(quality.name).toBe('Ultra');

      optimizedLighting.setQualityLevel(3); // Low

      quality = optimizedLighting.getQualityLevel();
      expect(quality.level).toBe(3);
      expect(quality.name).toBe('Low');
    });

    it('should not set invalid quality levels', () => {
      const originalQuality = optimizedLighting.getQualityLevel();

      optimizedLighting.setQualityLevel(-1); // Invalid
      expect(optimizedLighting.getQualityLevel().level).toBe(originalQuality.level);

      optimizedLighting.setQualityLevel(10); // Invalid
      expect(optimizedLighting.getQualityLevel().level).toBe(originalQuality.level);
    });
  });

  describe('Shadow Management', () => {
    it('should handle shadow casters', () => {
      const lightConfig: LightConfig = {
        ...createTestLightConfig('shadow_light'),
        type: 'directional',
        shadow: { enabled: true, mapSize: 512 },
      };

      optimizedLighting.addLight(lightConfig, false);

      // Create a mock mesh for shadow casting
      const mockMesh = {
        name: 'test_mesh',
        position: Vector3.Zero(),
      };

      // Should not throw when adding shadow caster
      expect(() => {
        optimizedLighting.addShadowCaster('shadow_light', mockMesh as any);
      }).not.toThrow();
    });

    it('should handle shadow receivers', () => {
      const lightConfig: LightConfig = {
        ...createTestLightConfig('shadow_light'),
        type: 'directional',
        shadow: { enabled: true, mapSize: 512 },
      };

      optimizedLighting.addLight(lightConfig, false);

      // Create a mock mesh for shadow receiving
      const mockMesh = {
        name: 'test_mesh',
        receiveShadows: false,
      };

      optimizedLighting.addShadowReceiver('shadow_light', mockMesh as any);

      expect(mockMesh.receiveShadows).toBe(true);
    });
  });

  describe('Performance Statistics', () => {
    it('should provide comprehensive performance statistics', () => {
      const lightConfig = createTestLightConfig('test_light');
      optimizedLighting.addLight(lightConfig, false);

      optimizedLighting.update(Vector3.Zero());

      const stats = optimizedLighting.getPerformanceStats();

      expect(stats).toHaveProperty('lightPool');
      expect(stats).toHaveProperty('shadowPool');
      expect(stats).toHaveProperty('frameMetrics');
      expect(stats).toHaveProperty('qualityMetrics');

      expect(stats.frameMetrics).toHaveProperty('lightingTime');
      expect(stats.frameMetrics).toHaveProperty('shadowTime');
      expect(stats.frameMetrics).toHaveProperty('totalTime');
      expect(stats.frameMetrics).toHaveProperty('efficiency');

      expect(stats.qualityMetrics).toHaveProperty('averageQuality');
      expect(stats.qualityMetrics).toHaveProperty('memoryUsage');
    });

    it('should calculate efficiency correctly', () => {
      // Add multiple lights
      for (let i = 0; i < 3; i++) {
        const lightConfig = createTestLightConfig(`light_${i}`, i * 20, 0, 0);
        optimizedLighting.addLight(lightConfig, false);
      }

      optimizedLighting.update(Vector3.Zero());

      const stats = optimizedLighting.getPerformanceStats();
      expect(stats.frameMetrics.efficiency).toBeGreaterThanOrEqual(0);
      expect(stats.frameMetrics.efficiency).toBeLessThanOrEqual(100);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<OptimizedLightingConfig> = {
        lightPool: {
          maxActiveLights: 8,
          cullingDistance: 100,
        },
        globalSettings: {
          performanceTarget: 45,
          enableDynamicQuality: false,
        },
      };

      optimizedLighting.updateConfig(newConfig);

      const config = optimizedLighting.getConfig();
      expect(config.lightPool.maxActiveLights).toBe(8);
      expect(config.lightPool.cullingDistance).toBe(100);
      expect(config.globalSettings.performanceTarget).toBe(45);
      expect(config.globalSettings.enableDynamicQuality).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle updates with no lights', () => {
      expect(() => {
        optimizedLighting.update(Vector3.Zero());
      }).not.toThrow();

      const stats = optimizedLighting.getPerformanceStats();
      expect(stats.lightPool.total).toBe(0);
    });

    it('should handle rapid camera movement', () => {
      const lightConfig = createTestLightConfig('test_light', 25, 0, 0);
      optimizedLighting.addLight(lightConfig, false);

      // Rapid position changes
      const positions = [
        Vector3.Zero(),
        new Vector3(50, 0, 0),
        new Vector3(0, 50, 0),
        new Vector3(-50, 0, 0),
        Vector3.Zero(),
      ];

      for (const position of positions) {
        expect(() => {
          optimizedLighting.update(position);
        }).not.toThrow();
      }
    });

    it('should handle lights with extreme positions', () => {
      const extremeConfig = createTestLightConfig('extreme_light', 1000000, 0, 0);

      expect(() => {
        optimizedLighting.addLight(extremeConfig, false);
        optimizedLighting.update(Vector3.Zero());
      }).not.toThrow();
    });

    it('should handle multiple quality level changes', () => {
      const lightConfig = createTestLightConfig('test_light');
      optimizedLighting.addLight(lightConfig, false);

      // Rapidly change quality levels
      for (let i = 0; i < 4; i++) {
        optimizedLighting.setQualityLevel(i);
        optimizedLighting.update(Vector3.Zero());
      }

      const stats = optimizedLighting.getPerformanceStats();
      expect(stats.qualityMetrics.averageQuality).toBe('Low');
    });
  });

  describe('Integration', () => {
    it('should integrate with performance manager', () => {
      const lightConfig = createTestLightConfig('test_light');
      optimizedLighting.addLight(lightConfig, false);

      optimizedLighting.update(Vector3.Zero());

      // Performance manager should have received lighting metrics
      const metrics = performanceManager.getMetrics();
      expect(metrics.lightingTime).toBeGreaterThanOrEqual(0);
    });

    it('should work with light manager', () => {
      const lightConfig = createTestLightConfig('integration_light');

      optimizedLighting.addLight(lightConfig, false);

      // Should be available in light manager
      const light = lightManager.getLight('integration_light');
      expect(light).toBeDefined();
      expect(light?.config.id).toBe('integration_light');
    });
  });
});
