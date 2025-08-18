/**
 * Base weapon class providing common functionality
 */

import type { WeaponConfig, WeaponAudioConfig } from '../types';

export abstract class BaseWeapon {
  protected config: WeaponConfig;
  protected audioConfig: WeaponAudioConfig;

  constructor(config: WeaponConfig, audioConfig: WeaponAudioConfig) {
    this.config = config;
    this.audioConfig = audioConfig;
  }

  /**
   * Get weapon configuration
   */
  public getConfig(): WeaponConfig {
    return { ...this.config };
  }

  /**
   * Get audio configuration
   */
  public getAudioConfig(): WeaponAudioConfig {
    return { ...this.audioConfig };
  }

  /**
   * Calculate actual damage for this shot
   */
  public calculateDamage(): number {
    // DOOM-style damage: random between min and max in multiples of 5
    const range = this.config.maxDamage - this.config.minDamage;
    const steps = Math.floor(range / 5);
    const randomStep = Math.floor(Math.random() * (steps + 1));
    
    return this.config.minDamage + (randomStep * 5);
  }

  /**
   * Get weapon slot number (1-8 like DOOM)
   */
  public abstract getSlotNumber(): number;

  /**
   * Get weapon display name
   */
  public getName(): string {
    return this.config.name;
  }

  /**
   * Get weapon category
   */
  public getCategory(): string {
    return this.config.category;
  }

  /**
   * Check if weapon is automatic
   */
  public isAutomatic(): boolean {
    return this.config.fireRate > 300; // RPM threshold for automatic
  }

  /**
   * Get effective range
   */
  public getEffectiveRange(): number {
    return this.config.range * 0.8; // 80% of max range for effective use
  }

  /**
   * Get weapon description for UI
   */
  public abstract getDescription(): string;

  /**
   * Get weapon pickup message
   */
  public getPickupMessage(): string {
    return `Picked up ${this.config.name}`;
  }
}