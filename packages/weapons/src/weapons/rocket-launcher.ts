/**
 * Rocket Launcher weapon - DOOM-style explosive projectile
 * High damage, area effect, self-damage risk
 */

import { Vector2 } from '@babylonjs/core';
import type { WeaponAudioConfig, WeaponConfig } from '../types';
import { BaseWeapon } from './base-weapon';

export class RocketLauncher extends BaseWeapon {
  constructor() {
    const config: WeaponConfig = {
      name: 'Rocket Launcher',
      type: 'projectile',
      category: 'explosive',

      // Damage (DOOM: 20-160 direct hit + splash)
      minDamage: 20,
      maxDamage: 160,
      range: 2048, // Max projectile travel

      // Firing mechanics
      fireRate: 60, // Slow reload between shots

      // Accuracy (rockets are accurate but slow)
      baseSpread: 0,
      maxSpread: 0,
      spreadIncrease: 0,
      spreadDecay: 0,

      // Ammo
      ammoType: 'rockets',
      clipSize: 1, // Single shot
      reloadTime: 2.0,

      // Projectile properties
      projectileSpeed: 20, // Relatively slow
      explosionRadius: 128, // DOOM explosion radius

      // Visual
      muzzleFlash: true,
      recoil: new Vector2(3.0, 4.0), // High recoil
      crosshairStyle: 'cross',
    };

    const audioConfig: WeaponAudioConfig = {
      fireSound: 'rocket_fire',
      reloadSound: 'rocket_reload',
      emptySound: 'weapon_empty',
      switchSound: 'weapon_switch',
      volume: 1.0,
      pitch: 1.0,
      spatialAudio: true,
    };

    super(config, audioConfig);
  }

  public getSlotNumber(): number {
    return 5; // DOOM slot 5
  }

  public getDescription(): string {
    return 'Explosive projectile weapon. Devastating area damage but dangerous at close range. Watch for splash damage!';
  }

  public getPickupMessage(): string {
    return 'You got the rocket launcher!';
  }

  /**
   * Calculate splash damage at distance from explosion
   */
  public calculateSplashDamage(directDamage: number, distanceFromExplosion: number): number {
    const explosionRadius = this.config.explosionRadius || 128;

    if (distanceFromExplosion >= explosionRadius) {
      return 0; // Outside blast radius
    }

    // Linear falloff from full damage at center to 0 at edge
    const damageRatio = 1 - distanceFromExplosion / explosionRadius;
    return Math.floor(directDamage * damageRatio);
  }

  /**
   * Check if shot would cause self-damage
   */
  public wouldCauseSelfDamage(
    firerPosition: { x: number; y: number; z: number },
    targetPosition: { x: number; y: number; z: number }
  ): boolean {
    const distance = Math.sqrt(
      (targetPosition.x - firerPosition.x) ** 2 +
        (targetPosition.y - firerPosition.y) ** 2 +
        (targetPosition.z - firerPosition.z) ** 2
    );

    const explosionRadius = this.config.explosionRadius || 128;
    const safeDistance = explosionRadius * 1.2; // 20% safety margin

    return distance < safeDistance;
  }

  /**
   * Get minimum safe firing distance
   */
  public getMinimumSafeDistance(): number {
    const explosionRadius = this.config.explosionRadius || 128;
    return explosionRadius * 1.5; // 50% safety margin
  }

  /**
   * Calculate rocket travel time to target
   */
  public calculateTravelTime(distance: number): number {
    const speed = this.config.projectileSpeed || 20;
    return distance / speed; // seconds
  }

  /**
   * Check if target is within effective range
   */
  public isTargetInRange(distance: number): boolean {
    return distance <= this.config.range && distance >= this.getMinimumSafeDistance();
  }

  /**
   * Get area of effect radius
   */
  public getAOERadius(): number {
    return this.config.explosionRadius || 128;
  }

  /**
   * Calculate maximum theoretical damage (direct hit + optimal splash)
   */
  public getMaximumDamage(): number {
    // In DOOM, direct hit does max damage, splash is additional
    return this.config.maxDamage;
  }
}
