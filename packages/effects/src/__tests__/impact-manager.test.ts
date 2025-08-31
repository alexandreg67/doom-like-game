/**
 * Tests for Impact Manager
 */

import { Engine, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ImpactManager } from '../impact/impact-manager';
import type { ImpactData } from '../impact/impact-types';

describe('ImpactManager', () => {
  let scene: Scene;
  let impactManager: ImpactManager;
  let mockImpactData: ImpactData;

  beforeEach(() => {
    const engine = new NullEngine();
    scene = new Scene(engine);
    impactManager = new ImpactManager(scene);

    mockImpactData = {
      position: new Vector3(0, 0, 0),
      normal: new Vector3(0, 1, 0),
      velocity: new Vector3(0, 0, -10),
      materialType: 'metal',
      surfaceAngle: 0,
      impactForce: 1.0,
      weaponType: 'pistol',
      damage: 25,
      timestamp: Date.now(),
    };
  });

  describe('processImpact', () => {
    it('should process valid impact data', () => {
      const result = impactManager.processImpact(mockImpactData);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should reject invalid impact data', () => {
      const invalidData: Partial<ImpactData> = { ...mockImpactData };
      invalidData.position = undefined;

      const result = impactManager.processImpact(invalidData as ImpactData);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should apply LOD based on distance', () => {
      // Close impact - should get full effects
      const closeResult = impactManager.processImpact(mockImpactData);

      // Distant impact
      const distantData = {
        ...mockImpactData,
        position: new Vector3(0, 0, -200), // Far away
      };
      const distantResult = impactManager.processImpact(distantData);

      expect(closeResult.particleSystemsCreated).toBeGreaterThanOrEqual(
        distantResult.particleSystemsCreated
      );
    });
  });

  describe('detectMaterialType', () => {
    it('should detect metal material from name', () => {
      const materialType = impactManager.detectMaterialType('metal_wall', undefined);
      expect(materialType).toBe('metal');
    });

    it('should detect concrete material from name', () => {
      const materialType = impactManager.detectMaterialType('concrete_floor', undefined);
      expect(materialType).toBe('concrete');
    });

    it('should fallback to default for unknown materials', () => {
      const materialType = impactManager.detectMaterialType('unknown_material', undefined);
      expect(materialType).toBe('default');
    });

    it('should handle empty inputs', () => {
      const materialType = impactManager.detectMaterialType(undefined, undefined);
      expect(materialType).toBe('default');
    });
  });

  describe('getStats', () => {
    it('should return initial stats', () => {
      const stats = impactManager.getStats();

      expect(stats.totalImpacts).toBe(0);
      expect(stats.activeEffects).toBe(0);
      expect(stats.impactsByMaterial).toBeInstanceOf(Map);
    });

    it('should update stats after processing impacts', () => {
      impactManager.processImpact(mockImpactData);
      const stats = impactManager.getStats();

      expect(stats.totalImpacts).toBe(1);
      expect(stats.impactsByMaterial.get('metal')).toBe(1);
    });
  });

  describe('updatePerformanceConfig', () => {
    it('should update performance settings', () => {
      const newConfig = {
        maxSimultaneousImpacts: 20,
        highDetailDistance: 30,
      };

      expect(() => {
        impactManager.updatePerformanceConfig(newConfig);
      }).not.toThrow();
    });
  });
});
