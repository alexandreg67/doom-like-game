/**
 * Weapon factory for creating weapon instances
 */

import type { WeaponComponent } from '../components/weapon-component';
import { createWeaponComponent } from '../components/weapon-component';
import type { BaseWeapon } from './base-weapon';
import { Chaingun } from './chaingun';
import { EnhancedPistol, Pistol } from './pistol';
import { RocketLauncher } from './rocket-launcher';
import { Shotgun } from './shotgun';

export type WeaponType =
  | 'pistol'
  | 'enhanced_pistol'
  | 'shotgun'
  | 'super_shotgun'
  | 'chaingun'
  | 'rocket_launcher'
  | 'plasma_rifle'
  | 'bfg';

export class WeaponFactory {
  private static weaponClasses: Map<WeaponType, new () => BaseWeapon> = new Map([
    ['pistol', Pistol],
    ['enhanced_pistol', EnhancedPistol],
    ['shotgun', Shotgun],
    ['chaingun', Chaingun],
    ['rocket_launcher', RocketLauncher],
    // Add more weapons as they're implemented
  ]);

  /**
   * Create a weapon instance by type
   */
  static createWeapon(type: WeaponType): BaseWeapon {
    const WeaponClass = WeaponFactory.weaponClasses.get(type);

    if (!WeaponClass) {
      throw new Error(`Unknown weapon type: ${type}`);
    }

    return new WeaponClass();
  }

  /**
   * Create a weapon component for ECS
   */
  static createWeaponComponent(type: WeaponType): WeaponComponent {
    const weapon = WeaponFactory.createWeapon(type);
    const config = weapon.getConfig();
    const audioConfig = weapon.getAudioConfig();

    // Create weapon component with both configs
    const component = createWeaponComponent(config);

    // Add audio configuration to the weapon component
    component.audioConfig = audioConfig;

    return component;
  }

  /**
   * Get all available weapon types
   */
  static getAvailableWeaponTypes(): WeaponType[] {
    return Array.from(WeaponFactory.weaponClasses.keys());
  }

  /**
   * Check if weapon type exists
   */
  static isValidWeaponType(type: string): type is WeaponType {
    return WeaponFactory.weaponClasses.has(type as WeaponType);
  }

  /**
   * Get weapon info without creating instance
   */
  static getWeaponInfo(type: WeaponType): { name: string; slot: number; category: string } {
    const weapon = WeaponFactory.createWeapon(type);
    return {
      name: weapon.getName(),
      slot: weapon.getSlotNumber(),
      category: weapon.getCategory(),
    };
  }

  /**
   * Get weapons by slot number
   */
  static getWeaponsBySlot(): Map<number, WeaponType[]> {
    const slotMap = new Map<number, WeaponType[]>();

    for (const type of WeaponFactory.weaponClasses.keys()) {
      const weapon = WeaponFactory.createWeapon(type);
      const slot = weapon.getSlotNumber();

      if (!slotMap.has(slot)) {
        slotMap.set(slot, []);
      }

      slotMap.get(slot)?.push(type);
    }

    return slotMap;
  }

  /**
   * Get default weapon loadout (DOOM-style starting weapons)
   */
  static getDefaultLoadout(): { slot: number; weapon: WeaponType }[] {
    return [
      { slot: 1, weapon: 'pistol' }, // Always available backup
      // Other weapons are acquired during gameplay
    ];
  }

  /**
   * Create weapon component with custom ammo
   */
  static createWeaponComponentWithAmmo(
    type: WeaponType,
    currentAmmo?: number,
    reserveAmmo?: number
  ): WeaponComponent {
    const component = WeaponFactory.createWeaponComponent(type);

    if (currentAmmo !== undefined) {
      component.currentAmmo = currentAmmo;
    }

    if (reserveAmmo !== undefined) {
      component.reserveAmmo = reserveAmmo;
    }

    return component;
  }

  /**
   * Get weapon damage comparison data
   */
  static getWeaponComparison(): Array<{
    type: WeaponType;
    name: string;
    minDamage: number;
    maxDamage: number;
    dps: number;
    range: number;
    ammoType: string;
  }> {
    return WeaponFactory.getAvailableWeaponTypes().map((type) => {
      const weapon = WeaponFactory.createWeapon(type);
      const config = weapon.getConfig();

      // Calculate approximate DPS
      const avgDamage = (config.minDamage + config.maxDamage) / 2;
      const shotsPerSecond = config.fireRate / 60;
      const bulletsPerShot = config.burstCount || 1;
      const dps = avgDamage * shotsPerSecond * bulletsPerShot;

      return {
        type,
        name: config.name,
        minDamage: config.minDamage,
        maxDamage: config.maxDamage,
        dps: Math.round(dps),
        range: config.range,
        ammoType: config.ammoType,
      };
    });
  }
}

/**
 * Weapon progression system - unlock weapons based on level/progress
 */
export class WeaponProgression {
  private unlockedWeapons: Set<WeaponType> = new Set(['pistol']);

  /**
   * Check if weapon is unlocked
   */
  isWeaponUnlocked(type: WeaponType): boolean {
    return this.unlockedWeapons.has(type);
  }

  /**
   * Unlock a weapon
   */
  unlockWeapon(type: WeaponType): boolean {
    if (!WeaponFactory.isValidWeaponType(type)) {
      return false;
    }

    const wasUnlocked = this.unlockedWeapons.has(type);
    this.unlockedWeapons.add(type);
    return !wasUnlocked; // Return true if newly unlocked
  }

  /**
   * Get all unlocked weapons
   */
  getUnlockedWeapons(): WeaponType[] {
    return Array.from(this.unlockedWeapons);
  }

  /**
   * Reset progression (new game)
   */
  reset(): void {
    this.unlockedWeapons.clear();
    this.unlockedWeapons.add('pistol'); // Always start with pistol
  }

  /**
   * Unlock weapons by level progression
   */
  unlockWeaponsForLevel(level: number): void {
    const levelUnlocks: Record<number, WeaponType[]> = {
      1: ['shotgun'],
      2: ['chaingun'],
      3: ['rocket_launcher'],
      4: ['plasma_rifle'],
      5: ['bfg'],
    };

    for (let i = 1; i <= level; i++) {
      const weapons = levelUnlocks[i];
      if (weapons) {
        for (const weapon of weapons) {
          this.unlockWeapon(weapon);
        }
      }
    }
  }
}
