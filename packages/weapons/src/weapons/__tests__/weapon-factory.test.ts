/**
 * Tests for WeaponFactory and WeaponProgression
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { Chaingun } from '../chaingun';
import { EnhancedPistol, Pistol } from '../pistol';
import { RocketLauncher } from '../rocket-launcher';
import { Shotgun } from '../shotgun';
import { WeaponFactory, WeaponProgression } from '../weapon-factory';
import type { WeaponType } from '../weapon-factory';

describe('WeaponFactory', () => {
  describe('createWeapon', () => {
    it('should create pistol instance', () => {
      const weapon = WeaponFactory.createWeapon('pistol');
      expect(weapon).toBeInstanceOf(Pistol);
      expect(weapon.getName()).toBe('Pistol');
      expect(weapon.getSlotNumber()).toBe(2);
    });

    it('should create enhanced pistol instance', () => {
      const weapon = WeaponFactory.createWeapon('enhanced_pistol');
      expect(weapon).toBeInstanceOf(EnhancedPistol);
      expect(weapon.getName()).toBe('Enhanced Pistol');
      expect(weapon.getSlotNumber()).toBe(2);
    });

    it('should create shotgun instance', () => {
      const weapon = WeaponFactory.createWeapon('shotgun');
      expect(weapon).toBeInstanceOf(Shotgun);
      expect(weapon.getName()).toBe('Shotgun');
      expect(weapon.getSlotNumber()).toBe(3);
    });

    it('should create chaingun instance', () => {
      const weapon = WeaponFactory.createWeapon('chaingun');
      expect(weapon).toBeInstanceOf(Chaingun);
      expect(weapon.getName()).toBe('Chaingun');
      expect(weapon.getSlotNumber()).toBe(4);
    });

    it('should create rocket launcher instance', () => {
      const weapon = WeaponFactory.createWeapon('rocket_launcher');
      expect(weapon).toBeInstanceOf(RocketLauncher);
      expect(weapon.getName()).toBe('Rocket Launcher');
      expect(weapon.getSlotNumber()).toBe(5);
    });

    it('should throw error for unknown weapon type', () => {
      expect(() => {
        WeaponFactory.createWeapon('unknown' as WeaponType);
      }).toThrow('Unknown weapon type: unknown');
    });
  });

  describe('createWeaponComponent', () => {
    it('should create weapon component with correct config', () => {
      const component = WeaponFactory.createWeaponComponent('pistol');

      expect(component.id).toBe('weapon');
      expect(component.config.name).toBe('Pistol');
      expect(component.config.minDamage).toBe(5);
      expect(component.config.maxDamage).toBe(15);
      expect(component.config.ammoType).toBe('bullets');
      expect(component.config.clipSize).toBe(12);
      expect(component.currentAmmo).toBe(12);
    });

    it('should create component with custom ammo values', () => {
      const component = WeaponFactory.createWeaponComponentWithAmmo('shotgun', 4, 20);

      expect(component.id).toBe('weapon');
      expect(component.config.name).toBe('Shotgun');
      expect(component.currentAmmo).toBe(4);
      expect(component.reserveAmmo).toBe(20);
    });
  });

  describe('getAvailableWeaponTypes', () => {
    it('should return all available weapon types', () => {
      const types = WeaponFactory.getAvailableWeaponTypes();

      expect(types).toContain('pistol');
      expect(types).toContain('enhanced_pistol');
      expect(types).toContain('shotgun');
      expect(types).toContain('chaingun');
      expect(types).toContain('rocket_launcher');
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('isValidWeaponType', () => {
    it('should return true for valid weapon types', () => {
      expect(WeaponFactory.isValidWeaponType('pistol')).toBe(true);
      expect(WeaponFactory.isValidWeaponType('shotgun')).toBe(true);
    });

    it('should return false for invalid weapon types', () => {
      expect(WeaponFactory.isValidWeaponType('invalid')).toBe(false);
      expect(WeaponFactory.isValidWeaponType('')).toBe(false);
    });
  });

  describe('getWeaponInfo', () => {
    it('should return weapon info without creating full instance', () => {
      const info = WeaponFactory.getWeaponInfo('pistol');

      expect(info.name).toBe('Pistol');
      expect(info.slot).toBe(2);
      expect(info.category).toBe('pistol');
    });
  });

  describe('getWeaponsBySlot', () => {
    it('should group weapons by slot number', () => {
      const slotMap = WeaponFactory.getWeaponsBySlot();

      expect(slotMap.get(2)).toContain('pistol');
      expect(slotMap.get(2)).toContain('enhanced_pistol');
      expect(slotMap.get(3)).toContain('shotgun');
      expect(slotMap.get(4)).toContain('chaingun');
      expect(slotMap.get(5)).toContain('rocket_launcher');
    });
  });

  describe('getDefaultLoadout', () => {
    it('should return default starting weapons', () => {
      const loadout = WeaponFactory.getDefaultLoadout();

      expect(loadout).toHaveLength(1);
      expect(loadout[0]).toEqual({ slot: 1, weapon: 'pistol' });
    });
  });

  describe('getWeaponComparison', () => {
    it('should return damage comparison data for all weapons', () => {
      const comparison = WeaponFactory.getWeaponComparison();

      expect(comparison.length).toBeGreaterThan(0);

      const pistolData = comparison.find((w) => w.type === 'pistol');
      expect(pistolData).toBeDefined();
      expect(pistolData?.minDamage).toBe(5);
      expect(pistolData?.maxDamage).toBe(15);
      expect(pistolData?.dps).toBeGreaterThan(0);
      expect(pistolData?.ammoType).toBe('bullets');
    });

    it('should calculate DPS correctly', () => {
      const comparison = WeaponFactory.getWeaponComparison();
      const chaingunData = comparison.find((w) => w.type === 'chaingun');

      expect(chaingunData?.dps).toBeGreaterThan(0);
      // Chaingun should have higher DPS than pistol
      const pistolData = comparison.find((w) => w.type === 'pistol');
      expect(chaingunData?.dps).toBeGreaterThan(pistolData?.dps || 0);
    });
  });
});

describe('WeaponProgression', () => {
  let progression: WeaponProgression;

  beforeEach(() => {
    progression = new WeaponProgression();
  });

  describe('initial state', () => {
    it('should start with pistol unlocked', () => {
      expect(progression.isWeaponUnlocked('pistol')).toBe(true);
      expect(progression.getUnlockedWeapons()).toContain('pistol');
    });

    it('should not have other weapons unlocked initially', () => {
      expect(progression.isWeaponUnlocked('shotgun')).toBe(false);
      expect(progression.isWeaponUnlocked('rocket_launcher')).toBe(false);
    });
  });

  describe('unlockWeapon', () => {
    it('should unlock valid weapon type', () => {
      const wasNewlyUnlocked = progression.unlockWeapon('shotgun');

      expect(wasNewlyUnlocked).toBe(true);
      expect(progression.isWeaponUnlocked('shotgun')).toBe(true);
      expect(progression.getUnlockedWeapons()).toContain('shotgun');
    });

    it('should return false for already unlocked weapon', () => {
      progression.unlockWeapon('shotgun');
      const wasNewlyUnlocked = progression.unlockWeapon('shotgun');

      expect(wasNewlyUnlocked).toBe(false);
    });

    it('should return false for invalid weapon type', () => {
      const result = progression.unlockWeapon('invalid' as WeaponType);
      expect(result).toBe(false);
    });
  });

  describe('unlockWeaponsForLevel', () => {
    it('should unlock weapons for level 1', () => {
      progression.unlockWeaponsForLevel(1);

      expect(progression.isWeaponUnlocked('pistol')).toBe(true);
      expect(progression.isWeaponUnlocked('shotgun')).toBe(true);
    });

    it('should unlock cumulative weapons for higher levels', () => {
      progression.unlockWeaponsForLevel(3);

      expect(progression.isWeaponUnlocked('pistol')).toBe(true);
      expect(progression.isWeaponUnlocked('shotgun')).toBe(true);
      expect(progression.isWeaponUnlocked('chaingun')).toBe(true);
      expect(progression.isWeaponUnlocked('rocket_launcher')).toBe(true);
    });

    it('should not unlock weapons beyond specified level', () => {
      progression.unlockWeaponsForLevel(2);

      expect(progression.isWeaponUnlocked('rocket_launcher')).toBe(false);
      expect(progression.isWeaponUnlocked('plasma_rifle')).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      progression.unlockWeapon('shotgun');
      progression.unlockWeapon('chaingun');

      progression.reset();

      expect(progression.getUnlockedWeapons()).toHaveLength(1);
      expect(progression.isWeaponUnlocked('pistol')).toBe(true);
      expect(progression.isWeaponUnlocked('shotgun')).toBe(false);
      expect(progression.isWeaponUnlocked('chaingun')).toBe(false);
    });
  });

  describe('getUnlockedWeapons', () => {
    it('should return array of unlocked weapon types', () => {
      progression.unlockWeapon('shotgun');
      progression.unlockWeapon('chaingun');

      const unlocked = progression.getUnlockedWeapons();

      expect(unlocked).toContain('pistol');
      expect(unlocked).toContain('shotgun');
      expect(unlocked).toContain('chaingun');
      expect(unlocked).not.toContain('rocket_launcher');
    });
  });
});
