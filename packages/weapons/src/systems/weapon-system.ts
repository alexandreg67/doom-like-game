/**
 * Main weapon system that coordinates firing, reloading, and weapon state
 * Enhanced with audio management and performance tracking
 */

import type { Scene } from '@babylonjs/core';
import type { Vector3 } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import { type SpatialAudioContext, WeaponAudioManager } from '../audio/weapon-audio-manager';
import { type AmmoComponent, AmmoUtils } from '../components/ammo-component';
import type { WeaponComponent } from '../components/weapon-component';
import type { WeaponStateComponent } from '../components/weapon-state-component';
import type { FiringContext, HitResult, WeaponConfig, WeaponState } from '../types';
import type { WeaponType } from '../weapons/weapon-factory';
import { WeaponFactory } from '../weapons/weapon-factory';
import { HitscanSystem } from './hitscan-system';
import { ProjectileSystem } from './projectile-system';

export interface WeaponSystemConfig {
  scene: Scene;
  audioEnabled?: boolean;
  spatialAudioEnabled?: boolean;
  debugMode?: boolean;
}

export class WeaponSystem {
  private scene: Scene;
  private hitscanSystem: HitscanSystem;
  private projectileSystem: ProjectileSystem;
  private audioManager: WeaponAudioManager;

  // Configuration
  private audioEnabled: boolean;
  private spatialAudioEnabled: boolean;
  private debugMode: boolean;

  // Performance tracking
  private lastUpdateTime = 0;
  private frameCount = 0;
  private performanceMetrics = {
    averageFrameTime: 0,
    weaponUpdatesPerSecond: 0,
    activeSounds: 0,
  };

  constructor(config: WeaponSystemConfig) {
    this.scene = config.scene;
    this.audioEnabled = config.audioEnabled ?? true;
    this.spatialAudioEnabled = config.spatialAudioEnabled ?? true;
    this.debugMode = config.debugMode ?? false;

    if (this.debugMode) console.log('[WEAPON_SYSTEM] Constructor called with config:', config);

    // Initialize subsystems
    this.hitscanSystem = new HitscanSystem(config.scene);
    this.projectileSystem = new ProjectileSystem(config.scene);
    this.audioManager = new WeaponAudioManager();

    if (this.debugMode) console.log('[WEAPON_SYSTEM] Starting async initialization...');
    this.initializeSystem();
  }

  /**
   * Initialize the weapon system
   */
  private async initializeSystem(): Promise<void> {
    if (this.debugMode)
      console.log('[WEAPON_SYSTEM] initializeSystem started, audioEnabled:', this.audioEnabled);

    if (this.audioEnabled) {
      if (this.debugMode) console.log('[WEAPON_SYSTEM] Calling preloadAllWeaponSounds...');
      await this.audioManager.preloadAllWeaponSounds();
      if (this.debugMode) console.log('[WEAPON_SYSTEM] preloadAllWeaponSounds completed');
      this.audioManager.setSpatialAudioEnabled(this.spatialAudioEnabled);
    }

    if (this.debugMode) {
      console.log('[WEAPON_SYSTEM] Initialized with config:', {
        audioEnabled: this.audioEnabled,
        spatialAudioEnabled: this.spatialAudioEnabled,
        debugMode: this.debugMode,
      });
    }

    if (this.debugMode) console.log('[WEAPON_SYSTEM] initializeSystem completed');
  }

  /**
   * Attempt to fire the current weapon
   */
  public attemptFire(
    entity: Entity,
    origin: Vector3,
    direction: Vector3
  ): HitResult | Entity | null {
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
    this.playWeaponSound(weapon, 'fire').catch((err) =>
      console.warn('[WEAPON_SYSTEM] Failed to play fire sound:', err)
    );

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
    this.playWeaponSound(weapon, 'reload').catch((err) =>
      console.warn('[WEAPON_SYSTEM] Failed to play reload sound:', err)
    );

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
  private canFire(
    weapon: WeaponComponent,
    ammo: AmmoComponent,
    state: WeaponStateComponent
  ): boolean {
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
    state.shotTimestamps = state.shotTimestamps.filter((time) => time > oneSecondAgo);
  }

  private calculateCurrentSpread(weapon: WeaponComponent, state: WeaponStateComponent): number {
    let spread = weapon.config.baseSpread + state.spreadAccumulation;

    // Apply accuracy modifier
    spread *= 2 - state.currentAccuracy; // Less accuracy = more spread

    return Math.min(spread, weapon.config.maxSpread);
  }

  private updateSpreadAccumulation(weapon: WeaponComponent, state: WeaponStateComponent): void {
    state.spreadAccumulation += weapon.config.spreadIncrease;
    state.spreadAccumulation = Math.min(state.spreadAccumulation, weapon.config.maxSpread);
    state.lastSpreadDecayTime = performance.now();
  }

  private updateSpreadDecay(
    weapon: WeaponComponent,
    state: WeaponStateComponent,
    deltaTime: number
  ): void {
    if (state.spreadAccumulation > 0) {
      const decayAmount = weapon.config.spreadDecay * deltaTime;
      state.spreadAccumulation = Math.max(0, state.spreadAccumulation - decayAmount);
    }
  }

  private updateWeaponState(
    weapon: WeaponComponent,
    state: WeaponStateComponent,
    deltaTime: number
  ): void {
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

  private updateMuzzleFlash(
    weapon: WeaponComponent,
    state: WeaponStateComponent,
    deltaTime: number
  ): void {
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
      const recentShots = state.shotTimestamps.filter((time) => now - time <= 1000);
      state.rpm = recentShots.length * 60; // Shots per minute
    } else {
      state.rpm = 0;
    }

    state.lastRpmCalculation = now;
  }

  private async playWeaponSound(
    weapon: WeaponComponent,
    soundType: 'fire' | 'reload' | 'empty',
    spatialContext?: Partial<SpatialAudioContext>
  ): Promise<void> {
    if (this.debugMode)
      console.log(
        `[WEAPON_SYSTEM] playWeaponSound called with soundType: ${soundType}, audioEnabled: ${this.audioEnabled}`
      );

    if (!this.audioEnabled) {
      if (this.debugMode) console.log(`[WEAPON_SYSTEM] Audio disabled, returning early`);
      return;
    }

    let soundId = '';
    switch (soundType) {
      case 'fire':
        soundId = weapon.audioConfig?.fireSound || 'weapon_fire';
        break;
      case 'reload':
        soundId = weapon.audioConfig?.reloadSound || 'weapon_reload';
        break;
      case 'empty':
        soundId = weapon.audioConfig?.emptySound || 'weapon_empty';
        break;
    }

    if (this.debugMode)
      console.log(
        `[WEAPON_SYSTEM] About to call audioManager.playWeaponSound with soundId: ${soundId}`
      );

    try {
      await this.audioManager.playWeaponSound(
        soundId,
        weapon.audioConfig || {
          fireSound: 'weapon_fire',
          reloadSound: 'weapon_reload',
          emptySound: 'weapon_empty',
          switchSound: 'weapon_switch',
          volume: 1.0,
          pitch: 1.0,
          spatialAudio: this.spatialAudioEnabled,
        },
        spatialContext
      );
      if (this.debugMode)
        console.log(`[WEAPON_SYSTEM] Successfully called audioManager.playWeaponSound`);
    } catch (error) {
      console.error(`[WEAPON_SYSTEM] Error calling audioManager.playWeaponSound:`, error);
    }

    if (this.debugMode) {
      console.log(
        `[WEAPON_SYSTEM] Playing ${soundType} sound: ${soundId} for ${weapon.config.name}`
      );
    }
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
   * Update listener position for 3D audio
   */
  public updateAudioListener(position: Vector3, orientation?: Vector3, up?: Vector3): void {
    if (this.audioEnabled) {
      this.audioManager.updateListenerPosition(position, orientation, up);
    }
  }

  /**
   * Set audio volume
   */
  public setAudioVolume(masterVolume: number, weaponVolume?: number): void {
    this.audioManager.setMasterVolume(masterVolume);
    if (weaponVolume !== undefined) {
      this.audioManager.setWeaponVolume(weaponVolume);
    }
  }

  /**
   * Enable/disable audio
   */
  public setAudioEnabled(enabled: boolean): void {
    this.audioEnabled = enabled;
    if (!enabled) {
      this.audioManager.stopAllSounds();
    }
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * Get audio manager for direct access
   */
  public getAudioManager(): WeaponAudioManager {
    return this.audioManager;
  }

  /**
   * Cleanup system
   */
  public dispose(): void {
    this.audioManager.dispose();
    this.projectileSystem.dispose();

    if (this.debugMode) {
      console.log('[WEAPON_SYSTEM] Disposed');
    }
  }
}
