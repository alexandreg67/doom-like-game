/**
 * Tests for Rocket Launcher weapon
 */

import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { RocketLauncher } from '../rocket-launcher';

describe('RocketLauncher', () => {
  let rocketLauncher: RocketLauncher;

  beforeEach(() => {
    rocketLauncher = new RocketLauncher();
  });

  describe('configuration', () => {
    it('should have correct basic properties', () => {
      expect(rocketLauncher.getName()).toBe('Rocket Launcher');
      expect(rocketLauncher.getCategory()).toBe('explosive');
      expect(rocketLauncher.getSlotNumber()).toBe(5);
    });

    it('should have high DOOM-style damage', () => {
      const config = rocketLauncher.getConfig();
      expect(config.minDamage).toBe(20);
      expect(config.maxDamage).toBe(160);
      expect(config.maxDamage).toBeGreaterThan(100); // Much higher than other weapons
    });

    it('should be projectile weapon', () => {
      const config = rocketLauncher.getConfig();
      expect(config.type).toBe('projectile');
    });

    it('should have correct ammo configuration', () => {
      const config = rocketLauncher.getConfig();
      expect(config.ammoType).toBe('rockets');
      expect(config.clipSize).toBe(1); // Single shot
      expect(config.reloadTime).toBe(2.0);
    });

    it('should have slow fire rate', () => {
      const config = rocketLauncher.getConfig();
      expect(config.fireRate).toBe(60); // Very slow
    });

    it('should have perfect accuracy', () => {
      const config = rocketLauncher.getConfig();
      expect(config.baseSpread).toBe(0);
      expect(config.maxSpread).toBe(0);
      expect(config.spreadIncrease).toBe(0);
      expect(config.spreadDecay).toBe(0);
    });

    it('should have high recoil', () => {
      const config = rocketLauncher.getConfig();
      expect(config.recoil).toEqual(new Vector2(3.0, 4.0));
    });

    it('should have projectile properties', () => {
      const config = rocketLauncher.getConfig();
      expect(config.projectileSpeed).toBe(20); // Relatively slow
      expect(config.explosionRadius).toBe(128); // DOOM explosion radius
    });

    it('should have correct visual properties', () => {
      const config = rocketLauncher.getConfig();
      expect(config.muzzleFlash).toBe(true);
      expect(config.crosshairStyle).toBe('cross');
    });
  });

  describe('audio configuration', () => {
    it('should have correct audio settings', () => {
      const audioConfig = rocketLauncher.getAudioConfig();
      expect(audioConfig.fireSound).toBe('rocket_fire');
      expect(audioConfig.reloadSound).toBe('rocket_reload');
      expect(audioConfig.volume).toBe(1.0); // Loudest weapon
      expect(audioConfig.spatialAudio).toBe(true);
    });
  });

  describe('weapon methods', () => {
    it('should return correct description', () => {
      const description = rocketLauncher.getDescription();
      expect(description).toContain('Explosive');
      expect(description).toContain('area damage');
      expect(description).toContain('splash damage');
    });

    it('should return pickup message', () => {
      const message = rocketLauncher.getPickupMessage();
      expect(message).toBe('You got the rocket launcher!');
    });
  });

  describe('splash damage calculation', () => {
    describe('calculateSplashDamage', () => {
      it('should return full damage at explosion center', () => {
        const directDamage = 100;
        const splashDamage = rocketLauncher.calculateSplashDamage(directDamage, 0);

        expect(splashDamage).toBe(directDamage);
      });

      it('should return zero damage outside blast radius', () => {
        const directDamage = 100;
        const explosionRadius = rocketLauncher.getAOERadius();
        const splashDamage = rocketLauncher.calculateSplashDamage(
          directDamage,
          explosionRadius + 10
        );

        expect(splashDamage).toBe(0);
      });

      it('should return partial damage within blast radius', () => {
        const directDamage = 100;
        const explosionRadius = rocketLauncher.getAOERadius();
        const halfRadius = explosionRadius / 2;

        const splashDamage = rocketLauncher.calculateSplashDamage(directDamage, halfRadius);

        expect(splashDamage).toBeGreaterThan(0);
        expect(splashDamage).toBeLessThan(directDamage);
        expect(splashDamage).toBe(50); // 50% damage at half radius
      });

      it('should follow linear falloff', () => {
        const directDamage = 160;
        const explosionRadius = rocketLauncher.getAOERadius();

        const damages = [
          rocketLauncher.calculateSplashDamage(directDamage, 0),
          rocketLauncher.calculateSplashDamage(directDamage, explosionRadius * 0.25),
          rocketLauncher.calculateSplashDamage(directDamage, explosionRadius * 0.5),
          rocketLauncher.calculateSplashDamage(directDamage, explosionRadius * 0.75),
          rocketLauncher.calculateSplashDamage(directDamage, explosionRadius),
        ];

        // Damage should decrease linearly
        expect(damages[0]).toBe(160); // Full damage
        expect(damages[1]).toBe(120); // 75% damage
        expect(damages[2]).toBe(80); // 50% damage
        expect(damages[3]).toBe(40); // 25% damage
        expect(damages[4]).toBe(0); // No damage at edge
      });
    });
  });

  describe('self-damage prevention', () => {
    describe('wouldCauseSelfDamage', () => {
      it('should detect self-damage risk at close range', () => {
        const firerPos = { x: 0, y: 0, z: 0 };
        const closeTarget = { x: 50, y: 0, z: 0 }; // Very close

        const wouldHurt = rocketLauncher.wouldCauseSelfDamage(firerPos, closeTarget);
        expect(wouldHurt).toBe(true);
      });

      it('should be safe at sufficient distance', () => {
        const firerPos = { x: 0, y: 0, z: 0 };
        const farTarget = { x: 300, y: 0, z: 0 }; // Far away

        const wouldHurt = rocketLauncher.wouldCauseSelfDamage(firerPos, farTarget);
        expect(wouldHurt).toBe(false);
      });

      it('should account for 3D distance', () => {
        const firerPos = { x: 0, y: 0, z: 0 };
        const target3D = { x: 100, y: 60, z: 80 }; // 3D position

        const distance3D = Math.sqrt(100 * 100 + 60 * 60 + 80 * 80); // ~141 units
        const safeDistance = rocketLauncher.getMinimumSafeDistance();

        const wouldHurt = rocketLauncher.wouldCauseSelfDamage(firerPos, target3D);
        expect(wouldHurt).toBe(distance3D < safeDistance);
      });
    });

    describe('getMinimumSafeDistance', () => {
      it('should return safe distance with margin', () => {
        const explosionRadius = rocketLauncher.getAOERadius();
        const safeDistance = rocketLauncher.getMinimumSafeDistance();

        expect(safeDistance).toBeGreaterThan(explosionRadius);
        expect(safeDistance).toBe(explosionRadius * 1.5); // 50% safety margin
      });
    });

    describe('isTargetInRange', () => {
      it('should reject targets too close', () => {
        const tooClose = rocketLauncher.getMinimumSafeDistance() - 10;
        expect(rocketLauncher.isTargetInRange(tooClose)).toBe(false);
      });

      it('should reject targets too far', () => {
        const config = rocketLauncher.getConfig();
        const tooFar = config.range + 10;
        expect(rocketLauncher.isTargetInRange(tooFar)).toBe(false);
      });

      it('should accept targets in optimal range', () => {
        const config = rocketLauncher.getConfig();
        const optimalDistance = (rocketLauncher.getMinimumSafeDistance() + config.range) / 2;
        expect(rocketLauncher.isTargetInRange(optimalDistance)).toBe(true);
      });
    });
  });

  describe('projectile mechanics', () => {
    describe('calculateTravelTime', () => {
      it('should calculate correct travel time', () => {
        const distance = 400;
        const speed = rocketLauncher.getConfig().projectileSpeed || 20;
        const expectedTime = distance / speed;

        const travelTime = rocketLauncher.calculateTravelTime(distance);
        expect(travelTime).toBe(expectedTime);
      });

      it('should handle zero distance', () => {
        const travelTime = rocketLauncher.calculateTravelTime(0);
        expect(travelTime).toBe(0);
      });
    });

    describe('getAOERadius', () => {
      it('should return explosion radius', () => {
        const radius = rocketLauncher.getAOERadius();
        expect(radius).toBe(128); // DOOM explosion radius
      });
    });

    describe('getMaximumDamage', () => {
      it('should return max direct hit damage', () => {
        const maxDamage = rocketLauncher.getMaximumDamage();
        const config = rocketLauncher.getConfig();
        expect(maxDamage).toBe(config.maxDamage);
      });
    });
  });

  describe('performance characteristics', () => {
    it('should have highest damage potential', () => {
      const config = rocketLauncher.getConfig();
      expect(config.maxDamage).toBeGreaterThan(100); // Much higher than other weapons
    });

    it('should be slow but devastating', () => {
      const config = rocketLauncher.getConfig();
      expect(config.fireRate).toBeLessThan(100); // Very slow
      expect(config.projectileSpeed).toBeLessThan(50); // Slow projectile
    });

    it('should have area of effect advantage', () => {
      const aoeRadius = rocketLauncher.getAOERadius();
      expect(aoeRadius).toBeGreaterThan(100); // Large area of effect
    });
  });

  describe('damage calculation', () => {
    it('should calculate damage within range', () => {
      const damage = rocketLauncher.calculateDamage();
      expect(damage).toBeGreaterThanOrEqual(20);
      expect(damage).toBeLessThanOrEqual(160);
      expect(damage % 5).toBe(0); // DOOM damage in multiples of 5
    });

    it('should have high damage variance', () => {
      const damages = Array.from({ length: 100 }, () => rocketLauncher.calculateDamage());
      const minCalculated = Math.min(...damages);
      const maxCalculated = Math.max(...damages);
      const variance = maxCalculated - minCalculated;

      expect(variance).toBeGreaterThan(100); // Large damage range
    });
  });

  describe('tactical considerations', () => {
    it('should be dangerous in confined spaces', () => {
      const config = rocketLauncher.getConfig();
      const explosionRadius = config.explosionRadius || 128;
      const safeDistance = rocketLauncher.getMinimumSafeDistance();

      // In a small room (200 units), rocket might be risky
      expect(safeDistance).toBeGreaterThan(explosionRadius);
    });

    it('should be effective against groups', () => {
      const aoeRadius = rocketLauncher.getAOERadius();
      const directDamage = rocketLauncher.getConfig().maxDamage;

      // Multiple targets within blast radius would all take damage
      const enemyPositions = [
        { distance: 50, expectedDamage: Math.floor(directDamage * (1 - 50 / aoeRadius)) },
        { distance: 80, expectedDamage: Math.floor(directDamage * (1 - 80 / aoeRadius)) },
        { distance: 120, expectedDamage: Math.floor(directDamage * (1 - 120 / aoeRadius)) },
      ];

      for (const { distance, expectedDamage } of enemyPositions) {
        const actualDamage = rocketLauncher.calculateSplashDamage(directDamage, distance);
        expect(actualDamage).toBe(expectedDamage);
      }
    });
  });
});
