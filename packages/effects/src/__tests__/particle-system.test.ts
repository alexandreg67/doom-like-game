/**
 * Tests for Impact Particle System
 */

import { Engine, NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImpactData } from '../impact/impact-types';
import { ImpactParticleSystem } from '../particle/particle-system';

describe('ImpactParticleSystem', () => {
  let scene: Scene;
  let particleSystem: ImpactParticleSystem;
  let mockImpactData: ImpactData;

  beforeEach(() => {
    const engine = new NullEngine();
    scene = new Scene(engine);
    particleSystem = new ImpactParticleSystem(scene);

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

  describe('createSparks', () => {
    it('should create spark effect for metal impacts', () => {
      const effectId = particleSystem.createSparks(mockImpactData, 1.0);

      expect(effectId).toBeDefined();
      expect(effectId).toMatch(/^effect_\d+_\w+$/);
      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should handle different intensity levels', () => {
      const lowIntensity = particleSystem.createSparks(mockImpactData, 0.5);
      const highIntensity = particleSystem.createSparks(mockImpactData, 2.0);

      expect(lowIntensity).toBeDefined();
      expect(highIntensity).toBeDefined();
      expect(particleSystem.getActiveEffectCount()).toBe(2);
    });
  });

  describe('createDebris', () => {
    it('should create debris effect for different materials', () => {
      const metalDebris = particleSystem.createDebris(mockImpactData, 'metal');

      const concreteData = { ...mockImpactData, materialType: 'concrete' as const };
      const concreteDebris = particleSystem.createDebris(concreteData, 'concrete');

      expect(metalDebris).toBeDefined();
      expect(concreteDebris).toBeDefined();
      expect(particleSystem.getActiveEffectCount()).toBe(2);
    });

    it('should create different effects for different materials', () => {
      const woodData = { ...mockImpactData, materialType: 'wood' as const };
      const glassData = { ...mockImpactData, materialType: 'glass' as const };

      const woodEffect = particleSystem.createDebris(woodData, 'wood');
      const glassEffect = particleSystem.createDebris(glassData, 'glass');

      expect(woodEffect).not.toBe(glassEffect);
    });
  });

  describe('createDust', () => {
    it('should create dust cloud effect', () => {
      const effectId = particleSystem.createDust(mockImpactData, 'concrete');

      expect(effectId).toBeDefined();
      expect(particleSystem.getActiveEffectCount()).toBe(1);
    });

    it('should handle different material dust colors', () => {
      const concreteData = { ...mockImpactData, materialType: 'concrete' as const };
      const woodData = { ...mockImpactData, materialType: 'wood' as const };

      const concreteDust = particleSystem.createDust(concreteData, 'concrete');
      const woodDust = particleSystem.createDust(woodData, 'wood');

      expect(concreteDust).toBeDefined();
      expect(woodDust).toBeDefined();
    });
  });

  describe('stopEffect', () => {
    it('should stop specific effect', () => {
      const effectId = particleSystem.createSparks(mockImpactData, 1.0);
      expect(particleSystem.getActiveEffectCount()).toBe(1);

      particleSystem.stopEffect(effectId);
      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });

    it('should handle invalid effect IDs gracefully', () => {
      expect(() => {
        particleSystem.stopEffect('invalid_id');
      }).not.toThrow();
    });
  });

  describe('stopAllEffects', () => {
    it('should stop all active effects', () => {
      particleSystem.createSparks(mockImpactData, 1.0);
      particleSystem.createDebris(mockImpactData, 'metal');
      particleSystem.createDust(mockImpactData, 'concrete');

      expect(particleSystem.getActiveEffectCount()).toBe(3);

      particleSystem.stopAllEffects();
      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });
  });

  describe('dispose', () => {
    it('should clean up all resources', () => {
      particleSystem.createSparks(mockImpactData, 1.0);
      particleSystem.createDebris(mockImpactData, 'metal');

      expect(() => {
        particleSystem.dispose();
      }).not.toThrow();

      expect(particleSystem.getActiveEffectCount()).toBe(0);
    });
  });
});
