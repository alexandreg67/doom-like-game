import { Color3, type Engine, NullEngine, Scene } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FogManager } from '../fog-manager';
import type { FogConfig } from '../types';

describe('FogManager', () => {
  let engine: Engine;
  let scene: Scene;
  let fogManager: FogManager;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);
    fogManager = new FogManager(scene);
  });

  afterEach(() => {
    scene.dispose();
    engine.dispose();
  });

  describe('Fog Configuration', () => {
    it('should initialize with fog disabled', () => {
      expect(scene.fogEnabled).toBe(false);
    });

    it('should apply linear fog configuration', () => {
      const fogConfig: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0.6, 0.6, 0.8),
        start: 10,
        end: 50,
      };

      fogManager.setFog(fogConfig);

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogMode).toBe(Scene.FOGMODE_LINEAR);
      expect(scene.fogStart).toBe(10);
      expect(scene.fogEnd).toBe(50);
      expect(scene.fogColor).toEqual(fogConfig.color);
    });

    it('should apply exponential fog configuration', () => {
      const fogConfig: FogConfig = {
        enabled: true,
        mode: 'exponential',
        color: new Color3(0.4, 0.5, 0.7),
        density: 0.1,
      };

      fogManager.setFog(fogConfig);

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogMode).toBe(Scene.FOGMODE_EXP);
      expect(scene.fogDensity).toBe(0.1);
      expect(scene.fogColor).toEqual(fogConfig.color);
    });

    it('should apply exponential2 fog configuration', () => {
      const fogConfig: FogConfig = {
        enabled: true,
        mode: 'exponential2',
        color: new Color3(0.3, 0.4, 0.6),
        density: 0.05,
      };

      fogManager.setFog(fogConfig);

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogMode).toBe(Scene.FOGMODE_EXP2);
      expect(scene.fogDensity).toBe(0.05);
      expect(scene.fogColor).toEqual(fogConfig.color);
    });

    it('should disable fog when config is undefined or disabled', () => {
      // First enable fog
      fogManager.setFog({
        enabled: true,
        mode: 'linear',
        color: new Color3(0.5, 0.5, 0.5),
        start: 5,
        end: 25,
      });
      expect(scene.fogEnabled).toBe(true);

      // Then disable with undefined
      fogManager.setFog(undefined);
      expect(scene.fogEnabled).toBe(false);

      // Enable again
      fogManager.setFog({
        enabled: true,
        mode: 'linear',
        color: new Color3(0.5, 0.5, 0.5),
        start: 5,
        end: 25,
      });
      expect(scene.fogEnabled).toBe(true);

      // Disable with enabled: false
      fogManager.setFog({
        enabled: false,
        mode: 'linear',
        color: new Color3(0.5, 0.5, 0.5),
        start: 5,
        end: 25,
      });
      expect(scene.fogEnabled).toBe(false);
    });
  });

  describe('Fog Transitions', () => {
    it('should start fog transition', () => {
      const targetFog: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0.8, 0.8, 0.9),
        start: 20,
        end: 80,
      };

      fogManager.setFog(targetFog, true); // Enable transition

      expect(fogManager.isTransitioning()).toBe(true);
      const fogState = fogManager.getFogState();
      expect(fogState.transitionProgress).toBe(0);
    });

    it('should complete fog transition over time', () => {
      vi.useFakeTimers();

      // Start with some fog
      const initialFog: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0.2, 0.2, 0.3),
        start: 10,
        end: 40,
      };
      fogManager.setFog(initialFog);

      // Transition to new fog
      const targetFog: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0.8, 0.8, 0.9),
        start: 20,
        end: 80,
      };
      fogManager.setFog(targetFog, true);

      expect(fogManager.isTransitioning()).toBe(true);

      // Simulate time progression
      const deltaTime = 100;
      for (let i = 0; i < 15; i++) {
        // 1500ms total
        vi.advanceTimersByTime(deltaTime);
        fogManager.updateFogTransition(deltaTime);
      }

      expect(fogManager.isTransitioning()).toBe(false);
      expect(scene.fogStart).toBe(20);
      expect(scene.fogEnd).toBe(80);

      vi.useRealTimers();
    });

    it('should handle transition to disabled fog', () => {
      // Start with fog enabled
      fogManager.setFog({
        enabled: true,
        mode: 'exponential',
        color: new Color3(0.5, 0.5, 0.5),
        density: 0.1,
      });
      expect(scene.fogEnabled).toBe(true);

      // Transition to disabled
      fogManager.setFog(undefined, true);
      expect(fogManager.isTransitioning()).toBe(true);

      // Complete transition
      vi.useFakeTimers();
      for (let i = 0; i < 12; i++) {
        // 1200ms
        vi.advanceTimersByTime(100);
        fogManager.updateFogTransition(100);
      }

      expect(fogManager.isTransitioning()).toBe(false);
      expect(scene.fogEnabled).toBe(false);

      vi.useRealTimers();
    });

    it('should interpolate fog colors during transition', () => {
      vi.useFakeTimers();

      const initialFog: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(1, 0, 0), // Red
        start: 10,
        end: 50,
      };
      fogManager.setFog(initialFog);

      const targetFog: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0, 1, 0), // Green
        start: 20,
        end: 60,
      };
      fogManager.setFog(targetFog, true);

      // Progress halfway through transition
      for (let i = 0; i < 5; i++) {
        // 500ms (halfway through 1000ms transition)
        vi.advanceTimersByTime(100);
        fogManager.updateFogTransition(100);
      }

      // Color should be interpolated between red and green
      // At 50% progress, we expect some red and some green
      expect(scene.fogColor.r).toBeGreaterThan(0.1);
      expect(scene.fogColor.g).toBeGreaterThan(0.1);
      expect(scene.fogColor.b).toBeLessThan(0.2);

      vi.useRealTimers();
    });
  });

  describe('Fog State Management', () => {
    it('should return correct fog state', () => {
      const fogState = fogManager.getFogState();

      expect(typeof fogState.transitionProgress).toBe('number');
      expect(typeof fogState.transitionDuration).toBe('number');
      expect(fogState.currentFog).toBeUndefined();
      expect(fogState.targetFog).toBeUndefined();
    });

    it('should update fog state during transitions', () => {
      const targetFog: FogConfig = {
        enabled: true,
        mode: 'exponential',
        color: new Color3(0.7, 0.7, 0.8),
        density: 0.08,
      };

      fogManager.setFog(targetFog, true);
      const stateAfterStart = fogManager.getFogState();

      expect(stateAfterStart.targetFog).toBeDefined();
      expect(stateAfterStart.transitionProgress).toBe(0);

      // Progress transition
      fogManager.updateFogTransition(500); // Half duration
      const stateHalfway = fogManager.getFogState();

      expect(stateHalfway.transitionProgress).toBeGreaterThan(0);
      expect(stateHalfway.transitionProgress).toBeLessThan(1);
    });

    it('should report isTransitioning correctly', () => {
      expect(fogManager.isTransitioning()).toBe(false);

      fogManager.setFog(
        {
          enabled: true,
          mode: 'linear',
          color: new Color3(0.5, 0.6, 0.7),
          start: 15,
          end: 75,
        },
        true
      );

      expect(fogManager.isTransitioning()).toBe(true);

      // Complete transition
      fogManager.updateFogTransition(2000); // More than default duration

      expect(fogManager.isTransitioning()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid fog modes gracefully', () => {
      // Use unknown to avoid any while still bypassing type checking for test purposes
      const invalidMode = 'invalid_mode' as unknown as FogConfig['mode'];
      const invalidFogConfig = {
        enabled: true,
        mode: invalidMode,
        color: new Color3(0.5, 0.5, 0.5),
        density: 0.1,
      };

      expect(() => {
        fogManager.setFog(invalidFogConfig);
      }).not.toThrow();

      // Should fallback to linear mode or handle gracefully
      expect(scene.fogEnabled).toBe(true);
    });

    it('should handle missing fog parameters', () => {
      const incompleteFogConfig: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(0.5, 0.5, 0.5),
        // Missing start and end for linear mode
      };

      expect(() => {
        fogManager.setFog(incompleteFogConfig);
      }).not.toThrow();

      expect(scene.fogEnabled).toBe(true);
      expect(scene.fogStart).toBeGreaterThan(0); // Should have default
      expect(scene.fogEnd).toBeGreaterThan(scene.fogStart);
    });

    it('should handle transition updates when not transitioning', () => {
      expect(() => {
        fogManager.updateFogTransition(16.67);
      }).not.toThrow();
    });

    it('should handle rapid fog changes', () => {
      const fog1: FogConfig = {
        enabled: true,
        mode: 'linear',
        color: new Color3(1, 0, 0),
        start: 10,
        end: 50,
      };

      const fog2: FogConfig = {
        enabled: true,
        mode: 'exponential',
        color: new Color3(0, 1, 0),
        density: 0.1,
      };

      expect(() => {
        fogManager.setFog(fog1, true);
        fogManager.setFog(fog2, true); // Should override previous transition
        fogManager.updateFogTransition(100);
      }).not.toThrow();
    });
  });
});
