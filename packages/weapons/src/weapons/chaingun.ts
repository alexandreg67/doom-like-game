/**
 * Chaingun weapon - DOOM-style high rate of fire
 * Automatic, high damage potential, accuracy decreases with sustained fire
 */

import { Vector2 } from '@babylonjs/core';
import { BaseWeapon } from './base-weapon';
import type { WeaponConfig, WeaponAudioConfig } from '../types';

export class Chaingun extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Chaingun',
      type: 'hitscan',
      category: 'automatic',
      
      // Damage (DOOM: 5-15 per bullet)
      minDamage: 5,
      maxDamage: 15,
      range: 2048,
      
      // Firing mechanics (DOOM: always fires in pairs)
      fireRate: 525, // RPM - very fast
      burstCount: 2, // Fires in pairs like DOOM
      burstDelay: 50, // ms between burst shots
      
      // Accuracy (DOOM: first 2 shots accurate, then spreads)
      baseSpread: 0, // Perfect first burst
      maxSpread: 5.5,
      spreadIncrease: 1.8, // Rapid spread buildup
      spreadDecay: 6.0, // Slower decay than pistol
      
      // Ammo
      ammoType: 'bullets',
      clipSize: 200, // Large belt-fed magazine
      reloadTime: 3.5,
      
      // Visual
      muzzleFlash: true,
      recoil: new Vector2(1.0, 1.5), // Manageable recoil due to weight
      crosshairStyle: 'cross',
    };

    const audioConfig: WeaponAudioConfig = {
      fireSound: 'chaingun_fire',
      reloadSound: 'chaingun_reload',
      emptySound: 'weapon_empty',
      switchSound: 'weapon_switch',
      volume: 0.95,
      pitch: 1.0,
      spatialAudio: true,
    };

    super(config, audioConfig);
  }

  public getSlotNumber(): number {
    return 4; // DOOM slot 4
  }

  public getDescription(): string {
    return 'High rate of fire automatic weapon. Devastating when you can maintain accuracy. First shots are precise.';
  }

  public getPickupMessage(): string {
    return 'You got the chaingun!';
  }

  /**
   * Calculate DPS (Damage Per Second) for the chaingun
   */
  public calculateDPS(): number {
    const avgDamage = (this.config.minDamage + this.config.maxDamage) / 2;
    const shotsPerSecond = this.config.fireRate / 60;
    const bulletsPerShot = this.config.burstCount || 1;
    
    return avgDamage * shotsPerSecond * bulletsPerShot;
  }

  /**
   * Get accuracy penalty based on sustained fire
   */
  public getAccuracyPenalty(shotsFired: number): number {
    // First 2 shots (1 burst) are accurate
    if (shotsFired <= 2) return 0;
    
    // Accuracy degrades with each additional burst
    const extraBursts = Math.floor((shotsFired - 2) / 2);
    return Math.min(extraBursts * 0.5, 3.0); // Max 3 degrees penalty
  }

  /**
   * Check if weapon should fire in burst mode
   */
  public shouldFireBurst(): boolean {
    return true; // Chaingun always fires in pairs
  }

  /**
   * Get ammo consumption rate (bullets per second)
   */
  public getAmmoConsumptionRate(): number {
    const shotsPerSecond = this.config.fireRate / 60;
    const bulletsPerShot = this.config.burstCount || 1;
    
    return shotsPerSecond * bulletsPerShot;
  }
}