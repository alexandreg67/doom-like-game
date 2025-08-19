/**
 * Tests for Pistol and EnhancedPistol weapons
 */

import { Vector2 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnhancedPistol, Pistol } from '../pistol';

describe('Pistol', () => {
  let pistol: Pistol;

  beforeEach(() => {
    pistol = new Pistol();
  });

  describe('configuration', () => {
    it('should have correct basic properties', () => {
      expect(pistol.getName()).toBe('Pistol');
      expect(pistol.getCategory()).toBe('pistol');
      expect(pistol.getSlotNumber()).toBe(2);
    });

    it('should have DOOM-style damage range', () => {
      const config = pistol.getConfig();
      expect(config.minDamage).toBe(5);
      expect(config.maxDamage).toBe(15);
      expect(config.range).toBe(2048);
    });

    it('should be hitscan weapon', () => {
      const config = pistol.getConfig();
      expect(config.type).toBe('hitscan');
    });

    it('should have correct ammo configuration', () => {
      const config = pistol.getConfig();
      expect(config.ammoType).toBe('bullets');
      expect(config.clipSize).toBe(12);
      expect(config.reloadTime).toBe(1.5);
    });

    it('should have correct firing mechanics', () => {
      const config = pistol.getConfig();
      expect(config.fireRate).toBe(200);
      expect(config.baseSpread).toBe(0); // Perfect first shot
      expect(config.maxSpread).toBe(5.5);
      expect(config.spreadIncrease).toBe(2.0);
      expect(config.spreadDecay).toBe(8.0);
    });

    it('should have correct visual properties', () => {
      const config = pistol.getConfig();
      expect(config.muzzleFlash).toBe(true);
      expect(config.recoil).toEqual(new Vector2(0.5, 1.0));
      expect(config.crosshairStyle).toBe('dot');
    });
  });

  describe('audio configuration', () => {
    it('should have correct audio settings', () => {
      const audioConfig = pistol.getAudioConfig();
      expect(audioConfig.fireSound).toBe('pistol_fire');
      expect(audioConfig.reloadSound).toBe('pistol_reload');
      expect(audioConfig.emptySound).toBe('weapon_empty');
      expect(audioConfig.switchSound).toBe('weapon_switch');
      expect(audioConfig.volume).toBe(0.7);
      expect(audioConfig.pitch).toBe(1.0);
      expect(audioConfig.spatialAudio).toBe(true);
    });
  });

  describe('weapon methods', () => {
    it('should return correct description', () => {
      const description = pistol.getDescription();
      expect(description).toContain('reliable');
      expect(description).toContain('backup');
    });

    it('should return pickup message', () => {
      const message = pistol.getPickupMessage();
      expect(message).toBe('Picked up a pistol.');
    });
  });

  describe('damage calculation', () => {
    it('should calculate damage within range', () => {
      const damage = pistol.calculateDamage();
      expect(damage).toBeGreaterThanOrEqual(5);
      expect(damage).toBeLessThanOrEqual(15);
      expect(damage % 5).toBe(0); // DOOM damage in multiples of 5
    });

    it('should be consistent when called multiple times', () => {
      const damages = Array.from({ length: 100 }, () => pistol.calculateDamage());
      const minCalculated = Math.min(...damages);
      const maxCalculated = Math.max(...damages);

      expect(minCalculated).toBeGreaterThanOrEqual(5);
      expect(maxCalculated).toBeLessThanOrEqual(15);
    });
  });

  describe('spread configuration', () => {
    it('should have zero base spread', () => {
      const config = pistol.getConfig();
      expect(config.baseSpread).toBe(0);
    });

    it('should have spread mechanics configured', () => {
      const config = pistol.getConfig();
      expect(config.maxSpread).toBe(5.5);
      expect(config.spreadIncrease).toBe(2.0);
      expect(config.spreadDecay).toBe(8.0);
    });
  });
});

describe('EnhancedPistol', () => {
  let enhancedPistol: EnhancedPistol;

  beforeEach(() => {
    enhancedPistol = new EnhancedPistol();
  });

  describe('configuration', () => {
    it('should have correct basic properties', () => {
      expect(enhancedPistol.getName()).toBe('Enhanced Pistol');
      expect(enhancedPistol.getCategory()).toBe('pistol');
      expect(enhancedPistol.getSlotNumber()).toBe(2);
    });

    it('should have higher damage than regular pistol', () => {
      const config = enhancedPistol.getConfig();
      expect(config.minDamage).toBe(8);
      expect(config.maxDamage).toBe(20);
      expect(config.minDamage).toBeGreaterThan(5);
      expect(config.maxDamage).toBeGreaterThan(15);
    });

    it('should have faster fire rate than regular pistol', () => {
      const config = enhancedPistol.getConfig();
      expect(config.fireRate).toBe(300);
      expect(config.fireRate).toBeGreaterThan(200);
    });

    it('should have larger magazine', () => {
      const config = enhancedPistol.getConfig();
      expect(config.clipSize).toBe(15);
      expect(config.clipSize).toBeGreaterThan(12);
    });

    it('should have better accuracy than regular pistol', () => {
      const config = enhancedPistol.getConfig();
      expect(config.maxSpread).toBe(4.0);
      expect(config.spreadIncrease).toBe(1.5);
      expect(config.spreadDecay).toBe(10.0);

      // Better than regular pistol
      expect(config.maxSpread).toBeLessThan(5.5);
      expect(config.spreadIncrease).toBeLessThan(2.0);
      expect(config.spreadDecay).toBeGreaterThan(8.0);
    });

    it('should have higher recoil than regular pistol', () => {
      const config = enhancedPistol.getConfig();
      expect(config.recoil).toEqual(new Vector2(0.7, 1.2));
    });
  });

  describe('audio configuration', () => {
    it('should have enhanced audio settings', () => {
      const audioConfig = enhancedPistol.getAudioConfig();
      expect(audioConfig.fireSound).toBe('enhanced_pistol_fire');
      expect(audioConfig.volume).toBe(0.8);
      expect(audioConfig.pitch).toBe(1.1);
    });
  });

  describe('weapon methods', () => {
    it('should return correct description', () => {
      const description = enhancedPistol.getDescription();
      expect(description).toContain('upgraded');
      expect(description).toContain('improved');
    });

    it('should return pickup message', () => {
      const message = enhancedPistol.getPickupMessage();
      expect(message).toBe('Picked up an enhanced pistol.');
    });
  });

  describe('damage calculation', () => {
    it('should calculate higher damage than regular pistol', () => {
      const regularPistol = new Pistol();

      const enhancedDamages = Array.from({ length: 100 }, () => enhancedPistol.calculateDamage());
      const regularDamages = Array.from({ length: 100 }, () => regularPistol.calculateDamage());

      const avgEnhanced = enhancedDamages.reduce((a, b) => a + b) / enhancedDamages.length;
      const avgRegular = regularDamages.reduce((a, b) => a + b) / regularDamages.length;

      expect(avgEnhanced).toBeGreaterThan(avgRegular);
    });
  });
});

describe('Pistol vs EnhancedPistol comparison', () => {
  it('should show enhanced pistol is superior in all aspects except recoil', () => {
    const pistol = new Pistol();
    const enhanced = new EnhancedPistol();

    const pistolConfig = pistol.getConfig();
    const enhancedConfig = enhanced.getConfig();

    // Damage
    expect(enhancedConfig.minDamage).toBeGreaterThan(pistolConfig.minDamage);
    expect(enhancedConfig.maxDamage).toBeGreaterThan(pistolConfig.maxDamage);

    // Fire rate
    expect(enhancedConfig.fireRate).toBeGreaterThan(pistolConfig.fireRate);

    // Magazine size
    expect(enhancedConfig.clipSize).toBeGreaterThan(pistolConfig.clipSize);

    // Accuracy (lower spread is better)
    expect(enhancedConfig.maxSpread).toBeLessThan(pistolConfig.maxSpread);
    expect(enhancedConfig.spreadIncrease).toBeLessThan(pistolConfig.spreadIncrease);
    expect(enhancedConfig.spreadDecay).toBeGreaterThan(pistolConfig.spreadDecay);

    // Recoil (enhanced has more recoil as tradeoff)
    expect(enhancedConfig.recoil.x).toBeGreaterThan(pistolConfig.recoil.x);
    expect(enhancedConfig.recoil.y).toBeGreaterThan(pistolConfig.recoil.y);
  });
});
