import { Color3, type Engine, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LightManager } from '../light-manager';
import type { LightConfig } from '../types';

describe('LightManager', () => {
  let engine: Engine;
  let scene: Scene;
  let lightManager: LightManager;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    lightManager = new LightManager(scene);
  });

  afterEach(() => {
    lightManager.dispose();
    scene.dispose();
    engine.dispose();
  });

  describe('Light Creation and Management', () => {
    it('should create and add a hemispheric light', () => {
      const lightConfig: LightConfig = {
        id: 'test_hemispheric',
        type: 'hemispheric',
        direction: new Vector3(0, 1, 0),
        color: new Color3(1, 1, 1),
        intensity: 0.5,
        enabled: true,
      };

      lightManager.addLight(lightConfig);
      const light = lightManager.getLight('test_hemispheric');

      expect(light).toBeDefined();
      expect(light?.config.type).toBe('hemispheric');
      expect(light?.config.intensity).toBe(0.5);
      expect(light?.isActive).toBe(true);
    });

    it('should create and add a directional light with shadows', () => {
      const lightConfig: LightConfig = {
        id: 'test_directional',
        type: 'directional',
        direction: new Vector3(0, -1, 0),
        color: new Color3(1, 0.9, 0.8),
        intensity: 1.0,
        shadows: {
          enabled: true,
          mapSize: 1024,
          bias: 0.0001,
          darkness: 0.3,
        },
        enabled: true,
      };

      lightManager.addLight(lightConfig);
      const light = lightManager.getLight('test_directional');

      expect(light).toBeDefined();
      expect(light?.config.type).toBe('directional');
      expect(light?.shadowGenerator).toBeDefined();
      // Note: In test environment (NullEngine), shadow map size might be 0
      // but we can still verify the shadow generator exists
      expect(light?.shadowGenerator?.getShadowMap()).toBeDefined();
    });

    it('should create and add a point light', () => {
      const lightConfig: LightConfig = {
        id: 'test_point',
        type: 'point',
        position: new Vector3(5, 2, 3),
        color: new Color3(1, 0.5, 0.2),
        intensity: 2.0,
        range: 10,
        enabled: true,
      };

      lightManager.addLight(lightConfig);
      const light = lightManager.getLight('test_point');

      expect(light).toBeDefined();
      expect(light?.config.type).toBe('point');
      expect(light?.config.position).toEqual(new Vector3(5, 2, 3));
      expect(light?.config.range).toBe(10);
    });

    it('should create and add a spot light', () => {
      const lightConfig: LightConfig = {
        id: 'test_spot',
        type: 'spot',
        position: new Vector3(0, 5, 0),
        direction: new Vector3(0, -1, 0),
        color: new Color3(1, 1, 0.9),
        intensity: 3.0,
        range: 15,
        angle: Math.PI / 4,
        exponent: 2,
        enabled: true,
      };

      lightManager.addLight(lightConfig);
      const light = lightManager.getLight('test_spot');

      expect(light).toBeDefined();
      expect(light?.config.type).toBe('spot');
      expect(light?.config.angle).toBe(Math.PI / 4);
      expect(light?.config.exponent).toBe(2);
    });

    it('should prevent adding duplicate light IDs', () => {
      const lightConfig: LightConfig = {
        id: 'duplicate_test',
        type: 'hemispheric',
        direction: new Vector3(0, 1, 0),
        color: new Color3(1, 1, 1),
        intensity: 0.5,
        enabled: true,
      };

      lightManager.addLight(lightConfig);
      lightManager.addLight(lightConfig); // Should not add duplicate

      const allLights = lightManager.getAllLights();
      const duplicateLights = Array.from(allLights.keys()).filter((id) => id === 'duplicate_test');
      expect(duplicateLights.length).toBe(1);
    });
  });

  describe('Light Updates and Control', () => {
    beforeEach(() => {
      const lightConfig: LightConfig = {
        id: 'update_test',
        type: 'point',
        position: new Vector3(1, 1, 1),
        color: new Color3(1, 1, 1),
        intensity: 1.0,
        range: 5,
        enabled: true,
      };
      lightManager.addLight(lightConfig);
    });

    it('should update light properties', () => {
      lightManager.updateLight('update_test', {
        intensity: 2.0,
        color: new Color3(1, 0.5, 0.5),
        range: 10,
      });

      const light = lightManager.getLight('update_test');
      expect(light?.config.intensity).toBe(2.0);
      expect(light?.config.color).toEqual(new Color3(1, 0.5, 0.5));
      expect(light?.config.range).toBe(10);
    });

    it('should enable and disable lights', () => {
      const light = lightManager.getLight('update_test');
      expect(light?.isActive).toBe(true);

      lightManager.setLightEnabled('update_test', false);
      expect(lightManager.getLight('update_test')?.config.enabled).toBe(false);

      lightManager.setLightEnabled('update_test', true);
      expect(lightManager.getLight('update_test')?.config.enabled).toBe(true);
    });

    it('should remove lights', () => {
      expect(lightManager.getLight('update_test')).toBeDefined();

      lightManager.removeLight('update_test');
      expect(lightManager.getLight('update_test')).toBeUndefined();
    });
  });

  describe('Light Culling', () => {
    beforeEach(() => {
      // Add multiple lights at different distances
      const lights: LightConfig[] = [
        {
          id: 'near_light',
          type: 'point',
          position: new Vector3(2, 0, 2),
          color: new Color3(1, 1, 1),
          intensity: 1.0,
          range: 5,
          enabled: true,
        },
        {
          id: 'far_light',
          type: 'point',
          position: new Vector3(100, 0, 100),
          color: new Color3(1, 1, 1),
          intensity: 1.0,
          range: 5,
          enabled: true,
        },
        {
          id: 'global_light',
          type: 'directional',
          direction: new Vector3(0, -1, 0),
          color: new Color3(1, 1, 1),
          intensity: 1.0,
          enabled: true,
        },
      ];

      for (const light of lights) {
        lightManager.addLight(light);
      }
    });

    it('should cull distant point lights', () => {
      const cameraPosition = new Vector3(0, 0, 0);

      lightManager.updateCulling(cameraPosition);

      const nearLight = lightManager.getLight('near_light');
      const farLight = lightManager.getLight('far_light');
      const globalLight = lightManager.getLight('global_light');

      expect(nearLight?.isActive).toBe(true);
      expect(farLight?.isActive).toBe(false); // Should be culled due to distance
      expect(globalLight?.isActive).toBe(true); // Directional lights are not culled
    });

    it('should never cull global lights', () => {
      const cameraPosition = new Vector3(1000, 1000, 1000);

      lightManager.updateCulling(cameraPosition);

      const globalLight = lightManager.getLight('global_light');
      expect(globalLight?.isActive).toBe(true);
    });
  });

  describe('Shadow System', () => {
    it('should create shadow generators for supported lights', () => {
      const directionalConfig: LightConfig = {
        id: 'shadow_directional',
        type: 'directional',
        direction: new Vector3(0, -1, 0),
        color: new Color3(1, 1, 1),
        intensity: 1.0,
        shadows: {
          enabled: true,
          mapSize: 512,
          bias: 0.001,
          darkness: 0.5,
        },
        enabled: true,
      };

      lightManager.addLight(directionalConfig);
      const light = lightManager.getLight('shadow_directional');

      expect(light?.shadowGenerator).toBeDefined();
      expect(light?.shadowGenerator?.getShadowMap()).toBeDefined();
    });

    it('should not create shadows for hemispheric lights', () => {
      const hemisphericConfig: LightConfig = {
        id: 'shadow_hemispheric',
        type: 'hemispheric',
        direction: new Vector3(0, 1, 0),
        color: new Color3(1, 1, 1),
        intensity: 1.0,
        shadows: {
          enabled: true,
          mapSize: 512,
          bias: 0.001,
          darkness: 0.5,
        },
        enabled: true,
      };

      lightManager.addLight(hemisphericConfig);
      const light = lightManager.getLight('shadow_hemispheric');

      expect(light?.shadowGenerator).toBeUndefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should track lighting metrics', () => {
      // Add multiple lights
      for (let i = 0; i < 5; i++) {
        lightManager.addLight({
          id: `metric_light_${i}`,
          type: 'point',
          position: new Vector3(i, 0, 0),
          color: new Color3(1, 1, 1),
          intensity: 1.0,
          enabled: true,
        });
      }

      lightManager.updateCulling(new Vector3(0, 0, 0));
      const metrics = lightManager.getMetrics();

      expect(metrics.activeLights).toBeGreaterThan(0);
      expect(metrics.lightCullingTime).toBeGreaterThanOrEqual(0);
      expect(typeof metrics.totalLightingTime).toBe('number');
    });

    it('should update performance config', () => {
      lightManager.setPerformanceConfig({
        maxActiveLights: 16,
        cullingDistance: 100,
        enableLOD: false,
      });

      // Performance config is internal, but we can test that it doesn't throw
      expect(() => lightManager.updateCulling(new Vector3(0, 0, 0))).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle updates to non-existent lights gracefully', () => {
      expect(() => {
        lightManager.updateLight('non_existent', { intensity: 2.0 });
      }).not.toThrow();
    });

    it('should handle removal of non-existent lights gracefully', () => {
      expect(() => {
        lightManager.removeLight('non_existent');
      }).not.toThrow();
    });

    it('should handle invalid light type gracefully', () => {
      // Use unknown to bypass type checking while avoiding 'any'
      const invalidLightType = 'invalid_type' as unknown as LightConfig['type'];
      const invalidConfig = {
        id: 'invalid_light',
        type: invalidLightType,
        color: new Color3(1, 1, 1),
        intensity: 1.0,
        enabled: true,
      };

      expect(() => {
        lightManager.addLight(invalidConfig);
      }).not.toThrow();

      const light = lightManager.getLight('invalid_light');
      expect(light).toBeUndefined();
    });
  });
});
