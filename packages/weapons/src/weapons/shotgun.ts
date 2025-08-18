/**
 * Shotgun weapon - DOOM-style close-range powerhouse
 * Multiple pellets, devastating close range, poor at distance
 */

import { Vector2 } from '@babylonjs/core';
import { BaseWeapon } from './base-weapon';
import type { WeaponConfig, WeaponAudioConfig } from '../types';

export class Shotgun extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Shotgun',
      type: 'hitscan',
      category: 'shotgun',
      
      // Damage per pellet (DOOM: 5-15 per pellet, 7 pellets)
      minDamage: 5,
      maxDamage: 15,
      range: 1024, // Shorter effective range than pistol
      
      // Firing mechanics
      fireRate: 60, // Slow pump-action
      burstCount: 7, // Number of pellets
      
      // Accuracy (wide spread for shotgun)
      baseSpread: 5.6, // DOOM shotgun spread
      maxSpread: 8.0,
      spreadIncrease: 0, // No spread accumulation (single shot)
      spreadDecay: 0,
      
      // Ammo
      ammoType: 'shells',
      clipSize: 8, // Tube magazine
      reloadTime: 2.5,
      
      // Visual
      muzzleFlash: true,
      recoil: new Vector2(2.0, 3.0), // Significant recoil
      crosshairStyle: 'circle',
    };

    const audioConfig: WeaponAudioConfig = {
      fireSound: 'shotgun_fire',
      reloadSound: 'shotgun_reload',
      emptySound: 'weapon_empty',
      switchSound: 'weapon_switch',
      volume: 0.9,
      pitch: 1.0,
      spatialAudio: true,
    };

    super(config, audioConfig);
  }

  public getSlotNumber(): number {
    return 3; // DOOM slot 3
  }

  public getDescription(): string {
    return 'Close-range devastation. Fires multiple pellets in a spread pattern. Deadly up close, useless at range.';
  }

  public getPickupMessage(): string {
    return 'Picked up a shotgun!';
  }

  /**
   * Calculate total damage for all pellets (for UI display)
   */
  public calculateTotalDamage(): number {
    const pelletCount = this.config.burstCount || 7;
    const avgDamagePerPellet = (this.config.minDamage + this.config.maxDamage) / 2;
    return Math.floor(avgDamagePerPellet * pelletCount);
  }

  /**
   * Get effective damage at different ranges
   */
  public getDamageAtRange(distance: number): number {
    const pelletCount = this.config.burstCount || 7;
    const maxRange = this.config.range;
    
    // Calculate how many pellets hit based on distance and spread
    let hitPellets = pelletCount;
    
    if (distance > maxRange * 0.3) {
      // Start losing pellets at 30% of max range
      const falloffFactor = Math.max(0, 1 - (distance - maxRange * 0.3) / (maxRange * 0.7));
      hitPellets = Math.ceil(pelletCount * falloffFactor);
    }
    
    const avgDamagePerPellet = (this.config.minDamage + this.config.maxDamage) / 2;
    return Math.floor(avgDamagePerPellet * hitPellets);
  }
}