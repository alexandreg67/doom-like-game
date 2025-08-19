/**
 * Tests for Shotgun weapon
 */

import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { Shotgun } from '../shotgun';

describe('Shotgun', () => {
  let shotgun: Shotgun;

  beforeEach(() => {
    shotgun = new Shotgun();
  });

  describe('configuration', () => {
    it('should have correct basic properties', () => {
      expect(shotgun.getName()).toBe('Shotgun');
      expect(shotgun.getCategory()).toBe('shotgun');
      expect(shotgun.getSlotNumber()).toBe(3);
    });

    it('should have DOOM-style damage per pellet', () => {
      const config = shotgun.getConfig();
      expect(config.minDamage).toBe(5);
      expect(config.maxDamage).toBe(15);
      expect(config.burstCount).toBe(7); // 7 pellets like DOOM
    });

    it('should be hitscan weapon', () => {
      const config = shotgun.getConfig();
      expect(config.type).toBe('hitscan');
    });

    it('should have correct ammo configuration', () => {
      const config = shotgun.getConfig();
      expect(config.ammoType).toBe('shells');
      expect(config.clipSize).toBe(8); // Tube magazine
      expect(config.reloadTime).toBe(2.5);
    });

    it('should have slow pump-action fire rate', () => {
      const config = shotgun.getConfig();
      expect(config.fireRate).toBe(60); // Slow compared to pistol
    });

    it('should have wide spread pattern', () => {
      const config = shotgun.getConfig();
      expect(config.baseSpread).toBe(5.6); // DOOM shotgun spread
      expect(config.maxSpread).toBe(8.0);
      expect(config.spreadIncrease).toBe(0); // No accumulation (single shot)
      expect(config.spreadDecay).toBe(0);
    });

    it('should have significant recoil', () => {
      const config = shotgun.getConfig();
      expect(config.recoil).toEqual(new Vector2(2.0, 3.0));
    });

    it('should have correct visual properties', () => {
      const config = shotgun.getConfig();
      expect(config.muzzleFlash).toBe(true);
      expect(config.crosshairStyle).toBe('circle');
    });

    it('should have shorter range than pistol', () => {
      const config = shotgun.getConfig();
      expect(config.range).toBe(1024);
      expect(config.range).toBeLessThan(2048); // Less than pistol range
    });
  });

  describe('audio configuration', () => {
    it('should have correct audio settings', () => {
      const audioConfig = shotgun.getAudioConfig();
      expect(audioConfig.fireSound).toBe('shotgun_fire');
      expect(audioConfig.reloadSound).toBe('shotgun_reload');
      expect(audioConfig.volume).toBe(0.9); // Louder than pistol
      expect(audioConfig.spatialAudio).toBe(true);
    });
  });

  describe('weapon methods', () => {
    it('should return correct description', () => {
      const description = shotgun.getDescription();
      expect(description).toContain('Close-range');
      expect(description).toContain('pellets');
      expect(description).toContain('spread');
    });

    it('should return pickup message', () => {
      const message = shotgun.getPickupMessage();
      expect(message).toBe('Picked up a shotgun!');
    });
  });

  describe('damage calculation methods', () => {
    describe('calculateTotalDamage', () => {
      it('should calculate total damage for all pellets', () => {
        const totalDamage = shotgun.calculateTotalDamage();
        const expectedMin = 5 * 7; // min damage per pellet * pellet count
        const expectedMax = 15 * 7; // max damage per pellet * pellet count
        const expectedAvg = Math.floor(((5 + 15) / 2) * 7);

        expect(totalDamage).toBe(expectedAvg);
        expect(totalDamage).toBeGreaterThanOrEqual(expectedMin);
        expect(totalDamage).toBeLessThanOrEqual(expectedMax);
      });
    });

    describe('getDamageAtRange', () => {
      it('should return full damage at close range', () => {
        const closeDamage = shotgun.getDamageAtRange(100);
        const maxPossibleDamage = shotgun.calculateTotalDamage();

        expect(closeDamage).toBe(maxPossibleDamage);
      });

      it('should reduce damage at medium range', () => {
        const config = shotgun.getConfig();
        const maxRange = config.range;
        const mediumRange = maxRange * 0.6; // Beyond falloff start

        const mediumDamage = shotgun.getDamageAtRange(mediumRange);
        const closeDamage = shotgun.getDamageAtRange(100);

        expect(mediumDamage).toBeLessThan(closeDamage);
        expect(mediumDamage).toBeGreaterThan(0);
      });

      it('should do minimal damage at maximum range', () => {
        const config = shotgun.getConfig();
        const maxRange = config.range;

        const longRangeDamage = shotgun.getDamageAtRange(maxRange);
        const closeDamage = shotgun.getDamageAtRange(100);

        expect(longRangeDamage).toBeLessThan(closeDamage);
        expect(longRangeDamage).toBeGreaterThanOrEqual(0); // Should still hit with at least 1 pellet or 0
      });

      it('should follow damage falloff curve', () => {
        const config = shotgun.getConfig();
        const maxRange = config.range;

        const ranges = [
          100, // Close
          maxRange * 0.3, // Start of falloff
          maxRange * 0.5, // Mid falloff
          maxRange * 0.8, // Late falloff
          maxRange, // Max range
        ];

        const damages = ranges.map((range) => shotgun.getDamageAtRange(range));

        // Damage should generally decrease with distance
        expect(damages[0]).toBeGreaterThanOrEqual(damages[1]);
        expect(damages[1]).toBeGreaterThanOrEqual(damages[2]);
        expect(damages[2]).toBeGreaterThanOrEqual(damages[3]);
        expect(damages[3]).toBeGreaterThanOrEqual(damages[4]);
      });

      it('should handle edge cases', () => {
        expect(shotgun.getDamageAtRange(0)).toBeGreaterThan(0);
        expect(shotgun.getDamageAtRange(-10)).toBeGreaterThan(0); // Negative distance

        const config = shotgun.getConfig();
        const beyondMaxRange = config.range * 2;
        expect(shotgun.getDamageAtRange(beyondMaxRange)).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('pellet mechanics', () => {
    it('should have correct pellet count', () => {
      const config = shotgun.getConfig();
      expect(config.burstCount).toBe(7); // Classic DOOM shotgun pellet count
    });

    it('should spread pellets over wide area', () => {
      const config = shotgun.getConfig();
      expect(config.baseSpread).toBeGreaterThan(5); // Wide spread
      expect(config.baseSpread).toBeLessThan(10); // But not too wide
    });
  });

  describe('performance characteristics', () => {
    it('should be effective at close range', () => {
      const closeRangeDamage = shotgun.getDamageAtRange(200);
      expect(closeRangeDamage).toBeGreaterThan(50); // Should be devastating up close
    });

    it('should be less effective at long range', () => {
      const config = shotgun.getConfig();
      const longRangeDamage = shotgun.getDamageAtRange(config.range * 0.9);
      const closeRangeDamage = shotgun.getDamageAtRange(200);

      expect(longRangeDamage).toBeLessThan(closeRangeDamage * 0.5); // Less than half damage
    });

    it('should have slower fire rate than pistol', () => {
      const config = shotgun.getConfig();
      expect(config.fireRate).toBeLessThan(200); // Slower than pistol
    });

    it('should have longer reload time', () => {
      const config = shotgun.getConfig();
      expect(config.reloadTime).toBeGreaterThan(2); // Longer than pistol
    });
  });

  describe('damage consistency', () => {
    it('should calculate damage within expected bounds', () => {
      const damage = shotgun.calculateDamage();
      expect(damage).toBeGreaterThanOrEqual(5);
      expect(damage).toBeLessThanOrEqual(15);
      expect(damage % 5).toBe(0); // DOOM damage in multiples of 5
    });

    it('should have consistent pellet behavior', () => {
      // Multiple damage calculations should be within pellet damage range
      const damages = Array.from({ length: 100 }, () => shotgun.calculateDamage());
      const minCalculated = Math.min(...damages);
      const maxCalculated = Math.max(...damages);

      expect(minCalculated).toBeGreaterThanOrEqual(5);
      expect(maxCalculated).toBeLessThanOrEqual(15);
    });
  });
});
