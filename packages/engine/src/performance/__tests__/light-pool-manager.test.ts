/**
 * Tests for LightPoolManager
 * Validates light pooling, culling, and LOD functionality
 */

import { DirectionalLight, NullEngine, PointLight, Scene, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LightConfig, LightInstance } from '../../lighting/types';
import { type LightPoolConfig, LightPoolManager } from '../light-pool-manager';
import { PerformanceManager } from '../performance-manager';

describe('LightPoolManager', () => {
  let scene: Scene;
  let performanceManager: PerformanceManager;
  let lightPool: LightPoolManager;
  let engine: NullEngine;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);

    performanceManager = new PerformanceManager({
      enableMetrics: true,
      historySize: 10,
    });

    const config: Partial<LightPoolConfig> = {
      maxActiveLights: 4,
      poolSize: 8,
      cullingDistance: 50,
      enableLOD: true,
      updateFrequency: 1, // Update every frame for testing
    };

    lightPool = new LightPoolManager(scene, performanceManager, config);
  });

  afterEach(() => {
    lightPool.dispose();
    performanceManager.dispose();
    scene.dispose();
    engine.dispose();
    vi.clearAllMocks();
  });

  function createTestLight(id: string, position: Vector3, intensity = 1): LightInstance {
    const babylonLight = new PointLight(id, position, scene);
    babylonLight.intensity = intensity;

    const config: LightConfig = {
      id,
      type: 'point',
      position: { x: position.x, y: position.y, z: position.z },
      intensity,
      enabled: true,
    };

    return {
      config,
      babylonLight,
      isActive: true,
      lastUpdateTime: performance.now(),
    };
  }

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = lightPool.getConfig();

      expect(config.maxActiveLights).toBe(4);
      expect(config.poolSize).toBe(8);
      expect(config.cullingDistance).toBe(50);
      expect(config.enableLOD).toBe(true);
    });

    it('should start with empty pools', () => {
      const stats = lightPool.getStats();

      expect(stats.active).toBe(0);
      expect(stats.inactive).toBe(0);
      expect(stats.culled).toBe(0);
      expect(stats.total).toBe(0);
    });
  });

  describe('Light Management', () => {
    it('should add lights to the pool', () => {
      const light = createTestLight('test_light', new Vector3(0, 0, 0));
      lightPool.addLight(light, false);

      const stats = lightPool.getStats();
      expect(stats.total).toBe(1);
      expect(stats.inactive).toBe(1); // Starts in inactive pool
    });

    it('should remove lights from the pool', () => {
      const light = createTestLight('test_light', new Vector3(0, 0, 0));
      lightPool.addLight(light, false);
      lightPool.removeLight('test_light');

      const stats = lightPool.getStats();
      expect(stats.total).toBe(0);
    });

    it('should handle static lights correctly', () => {
      const staticLight = createTestLight('static_light', new Vector3(0, 0, 0));
      const dynamicLight = createTestLight('dynamic_light', new Vector3(0, 0, 0));

      lightPool.addLight(staticLight, true);
      lightPool.addLight(dynamicLight, false);

      const stats = lightPool.getStats();
      expect(stats.total).toBe(2);
    });
  });

  describe('Distance Culling', () => {
    it('should activate nearby lights', () => {
      const nearLight = createTestLight('near_light', new Vector3(10, 0, 0));
      lightPool.addLight(nearLight, false);

      // Update with camera at origin
      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.active).toBe(1);
      expect(stats.inactive).toBe(0);
    });

    it('should cull distant lights', () => {
      const farLight = createTestLight('far_light', new Vector3(100, 0, 0)); // Beyond culling distance
      lightPool.addLight(farLight, false);

      // Activate the light first
      lightPool.updateLightCulling(new Vector3(99, 0, 0)); // Close enough to activate
      expect(lightPool.getStats().active).toBe(1);

      // Move camera far away
      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.active).toBe(0);
      expect(stats.culled).toBe(1);
      expect(stats.cullingReasons.distance).toBe(1);
    });

    it('should handle mixed distance scenarios', () => {
      const nearLight = createTestLight('near', new Vector3(10, 0, 0));
      const farLight = createTestLight('far', new Vector3(100, 0, 0));

      lightPool.addLight(nearLight, false);
      lightPool.addLight(farLight, false);

      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.active).toBe(1); // Only near light
      expect(stats.inactive).toBe(1); // Far light remains inactive
    });
  });

  describe('Priority Culling', () => {
    it('should cull low priority lights when at limit', () => {
      // Add more lights than the limit (4)
      for (let i = 0; i < 6; i++) {
        const light = createTestLight(`light_${i}`, new Vector3(i * 5, 0, 0), 1);
        lightPool.addLight(light, false);
      }

      // Update to activate lights
      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.active).toBeLessThanOrEqual(4); // Should not exceed limit
      expect(stats.total).toBe(6);
    });

    it('should prioritize high intensity lights', () => {
      const lowIntensityLight = createTestLight('low', new Vector3(5, 0, 0), 0.1);
      const highIntensityLight = createTestLight('high', new Vector3(6, 0, 0), 2.0);

      lightPool.addLight(lowIntensityLight, false);
      lightPool.addLight(highIntensityLight, false);

      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.active).toBe(2); // Both should be active since under limit
    });
  });

  describe('Performance Culling', () => {
    it('should cull lights when FPS is low', () => {
      // Add several lights
      for (let i = 0; i < 4; i++) {
        const light = createTestLight(`light_${i}`, new Vector3(i * 5, 0, 0));
        lightPool.addLight(light, false);
      }

      // Mock low FPS
      vi.spyOn(performanceManager, 'getMetrics').mockReturnValue({
        fps: 30, // Low FPS
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

      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.cullingReasons.performance).toBeGreaterThan(0);
    });
  });

  describe('LOD System', () => {
    it('should apply LOD based on distance', () => {
      const light = createTestLight('lod_light', new Vector3(30, 0, 0), 1.0);
      lightPool.addLight(light, false);

      // Update with camera at origin (distance = 30)
      lightPool.updateLightCulling(Vector3.Zero());

      // LOD should reduce intensity based on distance
      expect(light.babylonLight.intensity).toBeLessThan(1.0);
    });

    it('should maintain full intensity for close lights', () => {
      const light = createTestLight('close_light', new Vector3(5, 0, 0), 1.0);
      lightPool.addLight(light, false);

      lightPool.updateLightCulling(Vector3.Zero());

      // Close lights should maintain full intensity
      expect(light.babylonLight.intensity).toBeCloseTo(1.0, 2);
    });
  });

  describe('Update Frequency', () => {
    it('should respect update frequency setting', () => {
      lightPool.updateConfig({ updateFrequency: 5 });

      const light = createTestLight('test_light', new Vector3(10, 0, 0));
      lightPool.addLight(light, false);

      // First update should work
      lightPool.updateLightCulling(Vector3.Zero());
      expect(lightPool.getStats().active).toBe(1);

      // Subsequent updates within frequency should not change much
      const statsAfterFirst = lightPool.getStats();

      for (let i = 0; i < 4; i++) {
        lightPool.updateLightCulling(Vector3.Zero());
      }

      const statsAfterMultiple = lightPool.getStats();
      expect(statsAfterMultiple.active).toBe(statsAfterFirst.active);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        maxActiveLights: 8,
        cullingDistance: 100,
        enableLOD: false,
      };

      lightPool.updateConfig(newConfig);

      const config = lightPool.getConfig();
      expect(config.maxActiveLights).toBe(8);
      expect(config.cullingDistance).toBe(100);
      expect(config.enableLOD).toBe(false);
    });
  });

  describe('Metrics and Statistics', () => {
    it('should provide accurate statistics', () => {
      const light1 = createTestLight('light1', new Vector3(10, 0, 0));
      const light2 = createTestLight('light2', new Vector3(100, 0, 0));

      lightPool.addLight(light1, false);
      lightPool.addLight(light2, false);

      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.total).toBe(2);
      expect(stats.active + stats.inactive + stats.culled).toBe(stats.total);
    });

    it('should track culling reasons', () => {
      const farLight = createTestLight('far', new Vector3(100, 0, 0));
      lightPool.addLight(farLight, false);

      // Activate first
      lightPool.updateLightCulling(new Vector3(99, 0, 0));

      // Then cull by distance
      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.cullingReasons.distance).toBe(1);
    });

    it('should provide performance metrics', () => {
      const metrics = lightPool.getMetrics();

      expect(metrics).toHaveProperty('activeLights');
      expect(metrics).toHaveProperty('shadowCasters');
      expect(metrics).toHaveProperty('lightCulled');
      expect(metrics).toHaveProperty('lightingPassTime');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty light pool', () => {
      lightPool.updateLightCulling(Vector3.Zero());

      const stats = lightPool.getStats();
      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
    });

    it('should handle lights with zero intensity', () => {
      const zeroLight = createTestLight('zero', new Vector3(10, 0, 0), 0);
      lightPool.addLight(zeroLight, false);

      lightPool.updateLightCulling(Vector3.Zero());

      // Should still be managed, even with zero intensity
      const stats = lightPool.getStats();
      expect(stats.total).toBe(1);
    });

    it('should handle rapid camera movement', () => {
      const light = createTestLight('test', new Vector3(25, 0, 0));
      lightPool.addLight(light, false);

      // Rapid position changes
      for (let i = 0; i < 10; i++) {
        lightPool.updateLightCulling(new Vector3(i * 10, 0, 0));
      }

      // Should not crash and should maintain valid state
      const stats = lightPool.getStats();
      expect(stats.total).toBe(1);
    });
  });
});
