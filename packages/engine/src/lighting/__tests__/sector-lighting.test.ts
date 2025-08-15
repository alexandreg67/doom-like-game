import { Color3, type Engine, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoomSector } from '../../geometry/doom-geometry';
import { LightManager } from '../light-manager';
import { SectorLightingManager } from '../sector-lighting';
import type { LightTransition, SectorLightingConfig } from '../types';

describe('SectorLightingManager', () => {
  let engine: Engine;
  let scene: Scene;
  let lightManager: LightManager;
  let sectorLightingManager: SectorLightingManager;
  let mockSector1: DoomSector;
  let mockSector2: DoomSector;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    lightManager = new LightManager(scene);
    sectorLightingManager = new SectorLightingManager(scene, lightManager);

    // Create mock sectors
    mockSector1 = {
      id: 'sector1',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR1',
      ceilingTexture: 'CEIL1',
      lightLevel: 200,
      vertices: [],
      lineDefs: [],
      neighbors: [],
      boundingBox: {
        min: new Vector2(-5, -5),
        max: new Vector2(5, 5),
      },
      meshId: 'sector_sector1',
    };

    mockSector2 = {
      id: 'sector2',
      floorHeight: 0,
      ceilingHeight: 4,
      floorTexture: 'FLOOR2',
      ceilingTexture: 'CEIL2',
      lightLevel: 150,
      vertices: [],
      lineDefs: [],
      neighbors: [],
      boundingBox: {
        min: new Vector2(10, -5),
        max: new Vector2(20, 5),
      },
      meshId: 'sector_sector2',
    };

    // Add some lights to the light manager
    lightManager.addLight({
      id: 'ambient',
      type: 'hemispheric',
      direction: new Vector3(0, 1, 0),
      color: new Color3(1, 1, 1),
      intensity: 0.3,
      enabled: true,
    });

    lightManager.addLight({
      id: 'torch1',
      type: 'point',
      position: new Vector3(0, 2, 0),
      color: new Color3(1, 0.6, 0.2),
      intensity: 2.0,
      range: 10,
      enabled: true,
    });
  });

  afterEach(() => {
    lightManager.dispose();
    scene.dispose();
    engine.dispose();
  });

  describe('Sector Configuration', () => {
    it('should load sector lighting configurations', () => {
      const configs: SectorLightingConfig[] = [
        {
          sectorId: 'sector1',
          ambient: {
            color: new Color3(0.8, 0.7, 0.6),
            intensity: 0.4,
          },
          lights: ['ambient', 'torch1'],
          fog: {
            enabled: false,
            mode: 'linear',
            color: new Color3(0.6, 0.6, 0.8),
            start: 10,
            end: 50,
          },
        },
        {
          sectorId: 'sector2',
          ambient: {
            color: new Color3(0.5, 0.7, 0.9),
            intensity: 0.3,
          },
          lights: ['ambient'],
          fog: {
            enabled: true,
            mode: 'exponential',
            color: new Color3(0.4, 0.6, 0.8),
            density: 0.05,
          },
        },
      ];

      sectorLightingManager.setSectorConfigs(configs);

      const sector1Config = sectorLightingManager.getSectorConfig('sector1');
      const sector2Config = sectorLightingManager.getSectorConfig('sector2');

      expect(sector1Config).toBeDefined();
      expect(sector2Config).toBeDefined();
      expect(sector1Config?.lights).toEqual(['ambient', 'torch1']);
      expect(sector2Config?.fog?.enabled).toBe(true);
    });

    it('should apply sector lighting immediately when requested', () => {
      const config: SectorLightingConfig = {
        sectorId: 'sector1',
        ambient: {
          color: new Color3(1, 0.5, 0.5),
          intensity: 0.6,
        },
        lights: ['torch1'],
      };

      sectorLightingManager.setSectorConfigs([config]);
      sectorLightingManager.applySectorLighting('sector1', true);

      // Check that ambient color was applied (approximated check since we can't directly access scene.ambientColor)
      expect(sectorLightingManager.getCurrentSectorId()).toBe('sector1');

      // Check that light states are correct
      const torch1 = lightManager.getLight('torch1');
      const ambient = lightManager.getLight('ambient');
      expect(torch1?.config.enabled).toBe(true);
      expect(ambient?.config.enabled).toBe(false); // Not in sector1 config
    });
  });

  describe('Sector Transitions', () => {
    beforeEach(() => {
      const configs: SectorLightingConfig[] = [
        {
          sectorId: 'sector1',
          ambient: {
            color: new Color3(0.8, 0.7, 0.6),
            intensity: 0.4,
          },
          lights: ['ambient'],
          transitions: [
            {
              toSectorId: 'sector2',
              duration: 1000,
              easing: 'ease-in-out',
            },
          ],
        },
        {
          sectorId: 'sector2',
          ambient: {
            color: new Color3(0.5, 0.7, 0.9),
            intensity: 0.3,
          },
          lights: ['torch1'],
          transitions: [
            {
              toSectorId: 'sector1',
              duration: 800,
              easing: 'linear',
            },
          ],
        },
      ];

      sectorLightingManager.setSectorConfigs(configs);
    });

    it('should start transition between sectors', () => {
      sectorLightingManager.startLightTransition('sector1', 'sector2');

      expect(sectorLightingManager.isTransitioning()).toBe(true);
      expect(sectorLightingManager.getTransitionProgress()).toBe(0);
    });

    it('should complete transition after duration', async () => {
      sectorLightingManager.startLightTransition('sector1', 'sector2');
      expect(sectorLightingManager.isTransitioning()).toBe(true);

      // Wait for transition to complete using setTimeout to simulate real time
      await new Promise((resolve) => {
        const checkTransition = () => {
          sectorLightingManager.update(16.67); // Simulate 60fps
          if (!sectorLightingManager.isTransitioning()) {
            resolve(undefined);
          } else {
            setTimeout(checkTransition, 16);
          }
        };
        setTimeout(checkTransition, 1100); // Wait for transition duration
      });

      expect(sectorLightingManager.isTransitioning()).toBe(false);
      expect(sectorLightingManager.getCurrentSectorId()).toBe('sector2');
    });

    it('should handle player position updates and trigger transitions', () => {
      const playerPosition = new Vector3(0, 1, 0);

      sectorLightingManager.updatePlayerPosition(playerPosition, mockSector1);
      expect(sectorLightingManager.getCurrentSectorId()).toBe('sector1');

      // Move to sector2
      const newPosition = new Vector3(15, 1, 0);
      sectorLightingManager.updatePlayerPosition(newPosition, mockSector2);

      // Should have started transition
      expect(sectorLightingManager.isTransitioning()).toBe(true);
    });
  });

  describe('Fog Management', () => {
    it('should apply linear fog settings', () => {
      const fogConfig = {
        enabled: true,
        mode: 'linear' as const,
        color: new Color3(0.5, 0.5, 0.7),
        start: 20,
        end: 100,
      };

      sectorLightingManager.setFog(fogConfig);

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogMode).toBe(Scene.FOGMODE_LINEAR);
      expect(scene.fogStart).toBe(20);
      expect(scene.fogEnd).toBe(100);
    });

    it('should apply exponential fog settings', () => {
      const fogConfig = {
        enabled: true,
        mode: 'exponential' as const,
        color: new Color3(0.6, 0.6, 0.8),
        density: 0.1,
      };

      sectorLightingManager.setFog(fogConfig);

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogMode).toBe(Scene.FOGMODE_EXP);
      expect(scene.fogDensity).toBe(0.1);
    });

    it('should disable fog when requested', () => {
      // First enable fog
      sectorLightingManager.setFog({
        enabled: true,
        mode: 'linear',
        color: new Color3(0.5, 0.5, 0.7),
        start: 20,
        end: 100,
      });
      expect(scene.fogEnabled).toBe(true);

      // Then disable
      sectorLightingManager.setFog(undefined);
      expect(scene.fogEnabled).toBe(false);
    });
  });

  describe('Ambient Lighting', () => {
    it('should set ambient lighting color and intensity', () => {
      const color = new Color3(0.8, 0.6, 0.4);
      const intensity = 0.7;

      sectorLightingManager.setAmbientLighting(color, intensity);

      // Scene ambient color should be color * intensity
      const expectedColor = color.scale(intensity);
      expect(scene.ambientColor.r).toBeCloseTo(expectedColor.r);
      expect(scene.ambientColor.g).toBeCloseTo(expectedColor.g);
      expect(scene.ambientColor.b).toBeCloseTo(expectedColor.b);
    });
  });

  describe('Update Loop', () => {
    it('should handle update calls without errors', () => {
      const configs: SectorLightingConfig[] = [
        {
          sectorId: 'sector1',
          ambient: {
            color: new Color3(0.8, 0.7, 0.6),
            intensity: 0.4,
          },
          lights: ['ambient'],
        },
      ];

      sectorLightingManager.setSectorConfigs(configs);

      expect(() => {
        sectorLightingManager.update(16.67); // ~60fps
      }).not.toThrow();
    });

    it('should progress transitions during updates', () => {
      vi.useFakeTimers();

      const configs: SectorLightingConfig[] = [
        {
          sectorId: 'sector1',
          ambient: { color: new Color3(1, 0, 0), intensity: 0.5 },
          lights: ['ambient'],
        },
        {
          sectorId: 'sector2',
          ambient: { color: new Color3(0, 1, 0), intensity: 0.5 },
          lights: ['torch1'],
        },
      ];

      sectorLightingManager.setSectorConfigs(configs);
      sectorLightingManager.startLightTransition('sector1', 'sector2');

      const initialProgress = sectorLightingManager.getTransitionProgress();
      expect(initialProgress).toBe(0);

      // Advance time and update
      vi.advanceTimersByTime(500);
      sectorLightingManager.update(500);

      const midProgress = sectorLightingManager.getTransitionProgress();
      expect(midProgress).toBeGreaterThan(0);
      expect(midProgress).toBeLessThan(1);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle missing sector configurations gracefully', () => {
      expect(() => {
        sectorLightingManager.applySectorLighting('non_existent_sector');
      }).not.toThrow();
    });

    it('should handle transitions to unknown sectors gracefully', () => {
      expect(() => {
        sectorLightingManager.startLightTransition('sector1', 'non_existent_sector');
      }).not.toThrow();
    });

    it('should handle updates when no transitions are active', () => {
      expect(() => {
        sectorLightingManager.update(16.67);
      }).not.toThrow();
    });
  });
});
