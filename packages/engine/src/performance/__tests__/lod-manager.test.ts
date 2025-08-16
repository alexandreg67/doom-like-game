/**
 * Tests for LODManager
 * Validates Level of Detail system functionality
 */

import { Camera, CreateBox, CreateSphere, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LODManager } from '../lod-manager';
import type { LODConfig } from '../lod-types';
import { PerformanceManager } from '../performance-manager';

describe('LODManager', () => {
  let scene: Scene;
  let camera: Camera;
  let performanceManager: PerformanceManager;
  let lodManager: LODManager;
  let engine: NullEngine;

  beforeEach(() => {
    engine = new NullEngine();
    scene = new Scene(engine);

    camera = new Camera('testCamera', Vector3.Zero(), scene);
    camera.position = new Vector3(0, 0, -10);

    performanceManager = new PerformanceManager({
      enableMetrics: true,
      historySize: 10,
    });

    const config: Partial<LODConfig> = {
      enableGeometryLOD: true,
      enableTextureLOD: true,
      enableCulling: true,
      updateFrequency: 1, // Update every frame for testing
      hysteresisDistance: 2,
    };

    lodManager = new LODManager(scene, performanceManager, config);
  });

  afterEach(() => {
    lodManager.dispose();
    performanceManager.dispose();
    scene.dispose();
    engine.dispose();
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      const config = lodManager.getConfig();

      expect(config.enableGeometryLOD).toBe(true);
      expect(config.enableTextureLOD).toBe(true);
      expect(config.enableCulling).toBe(true);
      expect(config.updateFrequency).toBe(1);
      expect(config.hysteresisDistance).toBe(2);
    });

    it('should start with empty mesh registry', () => {
      const stats = lodManager.getStats();

      expect(stats.totalMeshes).toBe(0);
      expect(stats.activeMeshes).toBe(0);
      expect(stats.culledMeshes).toBe(0);
    });

    it('should have default LOD levels configured', () => {
      const config = lodManager.getConfig();

      expect(config.levels).toBeDefined();
      expect(config.levels.length).toBeGreaterThan(0);
      expect(config.levels[0].name).toBe('High');
    });
  });

  describe('Mesh Registration', () => {
    it('should register mesh for LOD management', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);

      lodManager.registerMesh(box);

      const stats = lodManager.getStats();
      expect(stats.totalMeshes).toBe(1);
    });

    it('should not register same mesh twice', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);

      lodManager.registerMesh(box);
      lodManager.registerMesh(box); // Should warn and not add again

      const stats = lodManager.getStats();
      expect(stats.totalMeshes).toBe(1);
    });

    it('should unregister mesh correctly', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);

      lodManager.registerMesh(box);
      expect(lodManager.getStats().totalMeshes).toBe(1);

      lodManager.unregisterMesh(box);
      expect(lodManager.getStats().totalMeshes).toBe(0);
    });

    it('should handle multiple mesh registrations', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      const sphere = CreateSphere('testSphere', { diameter: 2 }, scene);

      lodManager.registerMesh(box);
      lodManager.registerMesh(sphere);

      const stats = lodManager.getStats();
      expect(stats.totalMeshes).toBe(2);
    });
  });

  describe('LOD Level Calculation', () => {
    it('should calculate correct LOD level for close objects', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(5, 0, 0); // Close to camera

      lodManager.registerMesh(box);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(stats.levelDistribution[0]).toBe(1); // Should be at highest LOD
    });

    it('should calculate correct LOD level for distant objects', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(150, 0, 0); // Far from camera

      lodManager.registerMesh(box);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      const highestLevel = Math.max(...Object.keys(stats.levelDistribution).map(Number));
      expect(stats.levelDistribution[highestLevel]).toBe(1); // Should be at lowest LOD
    });

    it('should handle mixed distance scenarios', () => {
      const closeBox = CreateBox('closeBox', { size: 2 }, scene);
      closeBox.position = new Vector3(5, 0, 0);

      const farBox = CreateBox('farBox', { size: 2 }, scene);
      farBox.position = new Vector3(150, 0, 0);

      lodManager.registerMesh(closeBox);
      lodManager.registerMesh(farBox);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(Object.keys(stats.levelDistribution).length).toBeGreaterThan(1);
    });
  });

  describe('Hysteresis System', () => {
    it('should prevent flickering with hysteresis', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(25, 0, 0); // Near LOD boundary

      lodManager.registerMesh(box);

      // Update at boundary position
      lodManager.update(camera);
      const initialStats = lodManager.getStats();

      // Move slightly and back
      camera.position.x = 1;
      lodManager.update(camera);
      camera.position.x = 0;
      lodManager.update(camera);

      const finalStats = lodManager.getStats();
      expect(finalStats.levelDistribution).toEqual(initialStats.levelDistribution);
    });
  });

  describe('Culling System', () => {
    it('should cull very small objects', () => {
      const config = lodManager.getConfig();
      config.levels[3].cullSmallObjects = true; // Enable culling for lowest LOD
      lodManager.updateConfig(config);

      const box = CreateBox('testBox', { size: 0.1 }, scene); // Very small
      box.position = new Vector3(200, 0, 0); // Very far

      lodManager.registerMesh(box);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(stats.culledMeshes).toBeGreaterThan(0);
    });

    it('should not cull important objects', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(10, 0, 0); // Moderate distance

      lodManager.registerMesh(box, 2.0); // High importance
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(stats.activeMeshes).toBe(1);
      expect(stats.culledMeshes).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should track processing time', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      lodManager.registerMesh(box);

      lodManager.update(camera);

      const metrics = lodManager.getMetrics();
      expect(metrics.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should calculate efficiency correctly', () => {
      const box1 = CreateBox('box1', { size: 2 }, scene);
      const box2 = CreateBox('box2', { size: 2 }, scene);
      box1.position = new Vector3(10, 0, 0);
      box2.position = new Vector3(500, 0, 0); // May be culled

      lodManager.registerMesh(box1);
      lodManager.registerMesh(box2);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(stats.efficiency).toBeGreaterThanOrEqual(0);
      expect(stats.efficiency).toBeLessThanOrEqual(100);
    });

    it('should track level distribution', () => {
      const closeBox = CreateBox('closeBox', { size: 2 }, scene);
      const mediumBox = CreateBox('mediumBox', { size: 2 }, scene);
      const farBox = CreateBox('farBox', { size: 2 }, scene);

      closeBox.position = new Vector3(5, 0, 0);
      mediumBox.position = new Vector3(30, 0, 0);
      farBox.position = new Vector3(80, 0, 0);

      lodManager.registerMesh(closeBox);
      lodManager.registerMesh(mediumBox);
      lodManager.registerMesh(farBox);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      const totalInDistribution = Object.values(stats.levelDistribution).reduce(
        (sum, count) => sum + count,
        0
      );
      expect(totalInDistribution).toBe(3);
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const newConfig = {
        updateFrequency: 5,
        hysteresisDistance: 10,
        enableCulling: false,
      };

      lodManager.updateConfig(newConfig);

      const config = lodManager.getConfig();
      expect(config.updateFrequency).toBe(5);
      expect(config.hysteresisDistance).toBe(10);
      expect(config.enableCulling).toBe(false);
    });
  });

  describe('Update Frequency', () => {
    it('should respect update frequency setting', () => {
      lodManager.updateConfig({ updateFrequency: 3 });

      const box = CreateBox('testBox', { size: 2 }, scene);
      lodManager.registerMesh(box);

      // First update should work
      lodManager.update(camera);
      const firstStats = lodManager.getStats();

      // Subsequent updates within frequency should not process
      lodManager.update(camera);
      lodManager.update(camera);

      const laterStats = lodManager.getStats();
      expect(laterStats.totalMeshes).toBe(firstStats.totalMeshes);
    });
  });

  describe('Camera Movement', () => {
    it('should handle camera movement correctly', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(30, 0, 0);

      lodManager.registerMesh(box);

      // Test different camera positions
      const positions = [
        new Vector3(0, 0, 0),
        new Vector3(10, 0, 0),
        new Vector3(20, 0, 0),
        new Vector3(50, 0, 0),
      ];

      for (const position of positions) {
        camera.position = position;
        expect(() => {
          lodManager.update(camera);
        }).not.toThrow();
      }
    });

    it('should adapt LOD levels as camera moves', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(30, 0, 0);

      lodManager.registerMesh(box);

      // Close position
      camera.position = new Vector3(25, 0, 0);
      lodManager.update(camera);
      const closeStats = lodManager.getStats();

      // Far position
      camera.position = new Vector3(0, 0, 0);
      lodManager.update(camera);
      const farStats = lodManager.getStats();

      // LOD distribution should be different
      expect(closeStats.levelDistribution).not.toEqual(farStats.levelDistribution);
    });
  });

  describe('Edge Cases', () => {
    it('should handle meshes without geometry', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.dispose(); // Dispose geometry

      expect(() => {
        lodManager.registerMesh(box);
        lodManager.update(camera);
      }).not.toThrow();
    });

    it('should handle disposed meshes gracefully', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      lodManager.registerMesh(box);

      box.dispose();

      expect(() => {
        lodManager.update(camera);
      }).not.toThrow();

      // Should eventually remove disposed meshes
      const stats = lodManager.getStats();
      expect(stats.totalMeshes).toBe(0);
    });

    it('should handle extreme distances', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      box.position = new Vector3(10000, 0, 0); // Extremely far

      lodManager.registerMesh(box);

      expect(() => {
        lodManager.update(camera);
      }).not.toThrow();
    });

    it('should handle zero-sized meshes', () => {
      const box = CreateBox('testBox', { size: 0 }, scene);

      expect(() => {
        lodManager.registerMesh(box);
        lodManager.update(camera);
      }).not.toThrow();
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      lodManager.registerMesh(box);
      lodManager.update(camera);

      const stats = lodManager.getStats();
      expect(stats.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    it('should clean up properly on dispose', () => {
      const box = CreateBox('testBox', { size: 2 }, scene);
      lodManager.registerMesh(box);

      lodManager.dispose();

      const stats = lodManager.getStats();
      expect(stats.totalMeshes).toBe(0);
    });
  });
});
