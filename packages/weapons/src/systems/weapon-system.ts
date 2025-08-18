/**
 * Main weapon system that coordinates firing, reloading, and weapon state
 */

import type { Entity } from '@doom-like/game-logic';
import type { Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import type { WeaponConfig, FiringContext, HitResult, WeaponState } from '../types';
import { WeaponComponent } from '../components/weapon-component';
import { AmmoComponent, AmmoUtils } from '../components/ammo-component';
import { WeaponStateComponent } from '../components/weapon-state-component';
import { HitscanSystem } from './hitscan-system';
import { ProjectileSystem } from './projectile-system';

export class WeaponSystem {
  private hitscanSystem: HitscanSystem;
  private projectileSystem: ProjectileSystem;
  private audioContext?: AudioContext;

  constructor(scene: Scene, audioContext?: AudioContext) {
    this.hitscanSystem = new HitscanSystem(scene);
    this.projectileSystem = new ProjectileSystem(scene);
    this.audioContext = audioContext;
  }

  /**
   * Attempt to fire the current weapon
   */
  public attemptFire(entity: Entity, origin: Vector3, direction: Vector3): HitResult | Entity | null {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const weaponState = entity.components.get('weaponState') as WeaponStateComponent;
    
    if (!weapon || !ammo || !weaponState) {
      return null;
    }

    // Check if weapon can fire
    if (!this.canFire(weapon, ammo, weaponState)) {
      return null;
    }

    // Update weapon state
    this.updateWeaponOnFire(weapon, weaponState);
    
    // Consume ammo
    if (!AmmoUtils.consumeAmmo(ammo, weapon.config.ammoType, 1)) {
      weapon.state = 'empty';
      return null;
    }

    // Create firing context
    const context: FiringContext = {
      entity,
      origin,
      direction,
      spread: this.calculateCurrentSpread(weapon, weaponState),
      timestamp: performance.now(),
    };

    // Fire weapon based on type
    let result: HitResult | Entity;
    
    if (weapon.config.type === 'hitscan') {
      if (weapon.config.category === 'shotgun') {
        // Shotgun fires multiple pellets
        const pelletCount = weapon.config.burstCount || 8;
        const hitResults = this.hitscanSystem.fireSpread(context, pelletCount);
        result = hitResults[0] || this.hitscanSystem.fire(context); // Fallback to single shot
      } else {
        result = this.hitscanSystem.fire(context);
      }
    } else {
      // Projectile weapon
      const projectileConfig = {
        speed: weapon.config.projectileSpeed || 100,
        gravity: 9.81,
        mass: 1.0,
        explosionRadius: weapon.config.explosionRadius,
        lifeTime: 10.0,
        bounces: 0,
      };
      
      result = this.projectileSystem.fire(context, projectileConfig);
    }

    // Play firing sound
    this.playWeaponSound(weapon.config, 'fire');
    
    // Update spread accumulation
    this.updateSpreadAccumulation(weapon, weaponState);
    
    return result;
  }

  /**
   * Start reloading the current weapon
   */
  public startReload(entity: Entity): boolean {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const weaponState = entity.components.get('weaponState') as WeaponStateComponent;
    
    if (!weapon || !ammo || !weaponState) {
      return false;
    }

    // Check if reload is needed and possible
    if (weapon.currentAmmo >= weapon.config.clipSize) {
      return false; // Already full
    }
    
    if (!AmmoUtils.hasAmmo(ammo, weapon.config.ammoType, 1)) {
      return false; // No ammo to reload
    }

    // Start reload process
    weapon.state = 'reloading';
    weaponState.isReloading = true;
    weaponState.reloadStartTime = performance.now();
    weaponState.reloadProgress = 0;
    weapon.lastReloadTime = weaponState.reloadStartTime;

    // Play reload sound
    this.playWeaponSound(weapon.config, 'reload');

    return true;
  }

  /**
   * Update weapon system each frame
   */
  public update(entity: Entity, deltaTime: number): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const weaponState = entity.components.get('weaponState') as WeaponStateComponent;
    
    if (!weapon || !weaponState) return;

    // Update subsystems
    this.hitscanSystem.update(deltaTime);
    this.projectileSystem.update(deltaTime);
    
    // Update weapon state
    this.updateWeaponState(weapon, weaponState, deltaTime);
    
    // Update spread decay
    this.updateSpreadDecay(weapon, weaponState, deltaTime);
    
    // Update reload progress
    if (weaponState.isReloading) {
      this.updateReloadProgress(entity);
    }
    
    // Update muzzle flash
    this.updateMuzzleFlash(weapon, weaponState, deltaTime);
    
    // Update performance metrics
    this.updatePerformanceMetrics(weaponState);
  }

  /**
   * Check if weapon can fire
   */
  private canFire(weapon: WeaponComponent, ammo: AmmoComponent, state: WeaponStateComponent): boolean {
    // Check weapon state
    if (weapon.state !== 'idle' && weapon.state !== 'firing') {
      return false;
    }
    
    // Check reload state
    if (state.isReloading) {
      return false;
    }
    
    // Check switching state
    if (state.isSwitching) {
      return false;
    }
    
    // Check ammo
    if (weapon.currentAmmo <= 0) {
      return false;
    }
    
    // Check fire rate
    const now = performance.now();
    const timeSinceLastShot = now - weapon.lastFireTime;
    const fireInterval = 60000 / weapon.config.fireRate; // Convert RPM to ms
    
    if (timeSinceLastShot < fireInterval) {
      return false;
    }
    
    return true;
  }

  private updateWeaponOnFire(weapon: WeaponComponent, state: WeaponStateComponent): void {
    const now = performance.now();
    
    weapon.state = 'firing';
    weapon.lastFireTime = now;
    weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
    
    state.isFiring = true;
    state.fireStartTime = now;
    state.fireCount++;
    
    // Activate muzzle flash
    weapon.muzzleFlashActive = true;
    weapon.muzzleFlashStartTime = now;
    
    // Track shot for performance metrics
    state.shotTimestamps.push(now);
    
    // Keep only last second of shots for RPM calculation
    const oneSecondAgo = now - 1000;
    state.shotTimestamps = state.shotTimestamps.filter(time => time > oneSecondAgo);
  }

  private calculateCurrentSpread(weapon: WeaponComponent, state: WeaponStateComponent): number {
    let spread = weapon.config.baseSpread + state.spreadAccumulation;
    
    // Apply accuracy modifier
    spread *= (2 - state.currentAccuracy); // Less accuracy = more spread
    
    return Math.min(spread, weapon.config.maxSpread);
  }

  private updateSpreadAccumulation(weapon: WeaponComponent, state: WeaponStateComponent): void {
    state.spreadAccumulation += weapon.config.spreadIncrease;
    state.spreadAccumulation = Math.min(state.spreadAccumulation, weapon.config.maxSpread);
    state.lastSpreadDecayTime = performance.now();
  }

  private updateSpreadDecay(weapon: WeaponComponent, state: WeaponStateComponent, deltaTime: number): void {
    if (state.spreadAccumulation > 0) {
      const decayAmount = weapon.config.spreadDecay * deltaTime;
      state.spreadAccumulation = Math.max(0, state.spreadAccumulation - decayAmount);
    }
  }

  private updateWeaponState(weapon: WeaponComponent, state: WeaponStateComponent, deltaTime: number): void {
    const now = performance.now();
    
    // Update firing state
    if (state.isFiring) {
      const firingDuration = 100; // ms
      if (now - state.fireStartTime > firingDuration) {
        state.isFiring = false;
        weapon.state = weapon.currentAmmo > 0 ? 'idle' : 'empty';
      }
    }
    
    // Update accuracy recovery
    if (!state.isFiring && state.currentAccuracy < 1.0) {
      const recoveryRate = 2.0; // Accuracy per second
      state.currentAccuracy = Math.min(1.0, state.currentAccuracy + recoveryRate * deltaTime);
    }
  }

  private updateReloadProgress(entity: Entity): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;
    
    if (!weapon || !ammo || !state) return;

    const now = performance.now();
    const elapsed = now - state.reloadStartTime;
    const reloadTime = weapon.config.reloadTime * 1000; // Convert to ms
    
    state.reloadProgress = Math.min(elapsed / reloadTime, 1.0);
    
    if (state.reloadProgress >= 1.0) {
      // Complete reload
      this.completeReload(entity);
    }
  }

  private completeReload(entity: Entity): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;
    
    if (!weapon || !ammo || !state) return;

    const ammoNeeded = weapon.config.clipSize - weapon.currentAmmo;
    const ammoAvailable = ammo.ammoReserves.get(weapon.config.ammoType) || 0;
    const ammoToReload = Math.min(ammoNeeded, ammoAvailable);
    
    if (ammoToReload > 0) {
      weapon.currentAmmo += ammoToReload;
      AmmoUtils.consumeAmmo(ammo, weapon.config.ammoType, ammoToReload);
    }
    
    // Reset reload state
    state.isReloading = false;
    state.reloadProgress = 0;
    weapon.state = 'idle';
  }

  private updateMuzzleFlash(weapon: WeaponComponent, state: WeaponStateComponent, deltaTime: number): void {
    if (weapon.muzzleFlashActive) {
      const flashDuration = 50; // ms
      const elapsed = performance.now() - weapon.muzzleFlashStartTime;
      
      if (elapsed > flashDuration) {
        weapon.muzzleFlashActive = false;
      }
    }
  }

  private updatePerformanceMetrics(state: WeaponStateComponent): void {
    const now = performance.now();
    
    // Calculate RPM based on recent shots
    if (state.shotTimestamps.length >= 2) {
      const recentShots = state.shotTimestamps.filter(time => now - time <= 1000);
      state.rpm = recentShots.length * 60; // Shots per minute
    } else {
      state.rpm = 0;
    }
    
    state.lastRpmCalculation = now;
  }

  private playWeaponSound(config: WeaponConfig, soundType: 'fire' | 'reload' | 'empty'): void {
    // Audio implementation would go here
    // This would integrate with your audio system
    console.log(`[WEAPON] Playing ${soundType} sound for ${config.name}`);
  }

  /**
   * Get weapon system for external access
   */
  public getHitscanSystem(): HitscanSystem {
    return this.hitscanSystem;
  }

  public getProjectileSystem(): ProjectileSystem {
    return this.projectileSystem;
  }

  /**
   * Cleanup system
   */
  public dispose(): void {
    this.projectileSystem.dispose();
  }
}