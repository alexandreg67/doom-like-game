/**
 * Pistol weapon - DOOM-style starting weapon
 * Accurate, moderate damage, unlimited ammo backup
 */

import { Vector2 } from '@babylonjs/core';
import { BaseWeapon } from './base-weapon';
import type { WeaponConfig, WeaponAudioConfig } from '../types';

export class Pistol extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Pistol',
      type: 'hitscan',
      category: 'pistol',
      
      // Damage (DOOM: 5-15)
      minDamage: 5,
      maxDamage: 15,
      range: 2048, // DOOM hitscan range
      
      // Firing mechanics
      fireRate: 200, // RPM - semi-automatic
      
      // Accuracy (DOOM: first shot accurate, spread increases)
      baseSpread: 0, // Perfect first shot
      maxSpread: 5.5, // Max spread in degrees
      spreadIncrease: 2.0, // Spread per shot
      spreadDecay: 8.0, // Spread decay per second
      
      // Ammo
      ammoType: 'bullets',
      clipSize: 12, // Modern pistol magazine
      reloadTime: 1.5, // seconds
      
      // Visual
      muzzleFlash: true,
      recoil: new Vector2(0.5, 1.0),
      crosshairStyle: 'dot',
    };

    const audioConfig: WeaponAudioConfig = {
      fireSound: 'pistol_fire',
      reloadSound: 'pistol_reload',
      emptySound: 'weapon_empty',
      switchSound: 'weapon_switch',
      volume: 0.7,
      pitch: 1.0,
      spatialAudio: true,
    };

    super(config, audioConfig);
  }

  public getSlotNumber(): number {
    return 2; // DOOM slot 2
  }

  public getDescription(): string {
    return 'A reliable sidearm. Accurate but limited firepower. Your trusty backup when ammo runs low.';
  }

  public getPickupMessage(): string {
    return 'Picked up a pistol.';
  }
}

/**
 * Enhanced Pistol variant with higher damage and rate of fire
 */
export class EnhancedPistol extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Enhanced Pistol',
      type: 'hitscan',
      category: 'pistol',
      
      // Higher damage than basic pistol
      minDamage: 8,
      maxDamage: 20,
      range: 2048,
      
      // Faster fire rate
      fireRate: 300,
      
      // Better accuracy
      baseSpread: 0,
      maxSpread: 4.0,
      spreadIncrease: 1.5,
      spreadDecay: 10.0,
      
      // Larger magazine
      ammoType: 'bullets',
      clipSize: 15,
      reloadTime: 1.8,
      
      muzzleFlash: true,
      recoil: new Vector2(0.7, 1.2),
      crosshairStyle: 'dot',
    };

    const audioConfig: WeaponAudioConfig = {
      fireSound: 'enhanced_pistol_fire',
      reloadSound: 'pistol_reload',
      emptySound: 'weapon_empty',
      switchSound: 'weapon_switch',
      volume: 0.8,
      pitch: 1.1,
      spatialAudio: true,
    };

    super(config, audioConfig);
  }

  public getSlotNumber(): number {
    return 2;
  }

  public getDescription(): string {
    return 'An upgraded pistol with improved damage and capacity. Better than the standard sidearm.';
  }

  public getPickupMessage(): string {
    return 'Picked up an enhanced pistol.';
  }
}