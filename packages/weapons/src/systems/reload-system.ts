/**
 * Reload system for managing weapon reloading mechanics
 */

import type { Entity } from '@doom-like/game-logic';
import type { WeaponComponent } from '../components/weapon-component';
import type { AmmoComponent } from '../components/ammo-component';
import type { WeaponStateComponent } from '../components/weapon-state-component';
import { AmmoUtils } from '../components/ammo-component';

export class ReloadSystem {
  /**
   * Start reload process for a weapon
   */
  public startReload(entity: Entity): boolean {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !ammo || !state) {
      return false;
    }

    // Check if reload is needed
    if (weapon.currentAmmo >= weapon.config.clipSize) {
      return false; // Magazine is full
    }

    // Check if we have ammo to reload
    const availableAmmo = ammo.ammoReserves.get(weapon.config.ammoType) || 0;
    if (availableAmmo <= 0 && !ammo.infiniteAmmo && !ammo.infiniteAmmoTypes.has(weapon.config.ammoType)) {
      return false; // No ammo available
    }

    // Check if already reloading
    if (state.isReloading) {
      return false;
    }

    // Check if currently firing (can't reload while firing)
    if (state.isFiring) {
      return false;
    }

    // Start reload
    this.beginReload(weapon, state);
    return true;
  }

  /**
   * Update reload progress for all reloading weapons
   */
  public update(entity: Entity, deltaTime: number): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !state || !state.isReloading) {
      return;
    }

    this.updateReloadProgress(entity, deltaTime);
  }

  /**
   * Cancel current reload (if possible)
   */
  public cancelReload(entity: Entity): boolean {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !state || !state.isReloading) {
      return false;
    }

    if (!state.canCancelReload) {
      return false; // Reload is past cancellation point
    }

    // Cancel reload
    state.isReloading = false;
    state.reloadProgress = 0;
    weapon.state = weapon.currentAmmo > 0 ? 'idle' : 'empty';

    return true;
  }

  /**
   * Check if entity can reload
   */
  public canReload(entity: Entity): boolean {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !ammo || !state) {
      return false;
    }

    // Can't reload if magazine is full
    if (weapon.currentAmmo >= weapon.config.clipSize) {
      return false;
    }

    // Can't reload if no ammo available
    if (!AmmoUtils.hasAmmo(ammo, weapon.config.ammoType, 1)) {
      return false;
    }

    // Can't reload if already reloading
    if (state.isReloading) {
      return false;
    }

    // Can't reload while firing
    if (state.isFiring) {
      return false;
    }

    // Can't reload while switching weapons
    if (state.isSwitching) {
      return false;
    }

    return true;
  }

  /**
   * Get reload progress (0-1)
   */
  public getReloadProgress(entity: Entity): number {
    const state = entity.components.get('weaponState') as WeaponStateComponent;
    return state?.reloadProgress || 0;
  }

  /**
   * Get time remaining for reload (in seconds)
   */
  public getReloadTimeRemaining(entity: Entity): number {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !state || !state.isReloading) {
      return 0;
    }

    const totalTime = weapon.config.reloadTime;
    const elapsed = state.reloadProgress * totalTime;
    return Math.max(0, totalTime - elapsed);
  }

  private beginReload(weapon: WeaponComponent, state: WeaponStateComponent): void {
    weapon.state = 'reloading';
    state.isReloading = true;
    state.reloadStartTime = performance.now();
    state.reloadProgress = 0;
    state.canCancelReload = true; // Allow cancellation at start
    weapon.lastReloadTime = state.reloadStartTime;
  }

  private updateReloadProgress(entity: Entity, deltaTime: number): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !ammo || !state) {
      return;
    }

    const elapsed = performance.now() - state.reloadStartTime;
    const reloadTime = weapon.config.reloadTime * 1000; // Convert to ms
    
    state.reloadProgress = Math.min(elapsed / reloadTime, 1.0);

    // Check if reload is past cancellation point (75% complete)
    if (state.reloadProgress > 0.75) {
      state.canCancelReload = false;
    }

    // Complete reload when progress reaches 100%
    if (state.reloadProgress >= 1.0) {
      this.completeReload(entity);
    }
  }

  private completeReload(entity: Entity): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !ammo || !state) {
      return;
    }

    // Calculate how much ammo to reload
    const ammoNeeded = weapon.config.clipSize - weapon.currentAmmo;
    const ammoAvailable = ammo.ammoReserves.get(weapon.config.ammoType) || 0;
    
    let ammoToReload = 0;
    
    if (ammo.infiniteAmmo || ammo.infiniteAmmoTypes.has(weapon.config.ammoType)) {
      // Infinite ammo - reload to full capacity
      ammoToReload = ammoNeeded;
    } else {
      // Limited ammo - reload as much as possible
      ammoToReload = Math.min(ammoNeeded, ammoAvailable);
    }

    // Apply the reload
    if (ammoToReload > 0) {
      weapon.currentAmmo += ammoToReload;
      
      // Consume ammo from reserves (unless infinite)
      if (!ammo.infiniteAmmo && !ammo.infiniteAmmoTypes.has(weapon.config.ammoType)) {
        AmmoUtils.consumeAmmo(ammo, weapon.config.ammoType, ammoToReload);
      }
    }

    // Reset reload state
    state.isReloading = false;
    state.reloadProgress = 0;
    state.canCancelReload = true;
    weapon.state = weapon.currentAmmo > 0 ? 'idle' : 'empty';

    console.log(`[WEAPON] Reload complete: ${weapon.config.name} (${weapon.currentAmmo}/${weapon.config.clipSize})`);
  }
}

/**
 * Reload animation states and timing
 */
export enum ReloadState {
  Start = 'reload_start',
  Eject = 'reload_eject',
  Insert = 'reload_insert',
  Chamber = 'reload_chamber',
  Complete = 'reload_complete'
}

/**
 * Reload system with detailed animation support
 */
export class AdvancedReloadSystem extends ReloadSystem {
  private reloadAnimations: Map<string, ReloadAnimationConfig> = new Map();

  /**
   * Configure reload animation for a weapon type
   */
  public configureReloadAnimation(weaponName: string, config: ReloadAnimationConfig): void {
    this.reloadAnimations.set(weaponName, config);
  }

  /**
   * Get current reload animation state
   */
  public getReloadState(entity: Entity): ReloadState {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const state = entity.components.get('weaponState') as WeaponStateComponent;

    if (!weapon || !state || !state.isReloading) {
      return ReloadState.Complete;
    }

    const animConfig = this.reloadAnimations.get(weapon.config.name);
    if (!animConfig) {
      return ReloadState.Start;
    }

    const progress = state.reloadProgress;

    if (progress < animConfig.ejectPoint) {
      return ReloadState.Start;
    } else if (progress < animConfig.insertPoint) {
      return ReloadState.Eject;
    } else if (progress < animConfig.chamberPoint) {
      return ReloadState.Insert;
    } else if (progress < 1.0) {
      return ReloadState.Chamber;
    } else {
      return ReloadState.Complete;
    }
  }
}

/**
 * Configuration for detailed reload animations
 */
export interface ReloadAnimationConfig {
  ejectPoint: number;    // Progress point where magazine ejects (0-1)
  insertPoint: number;   // Progress point where new magazine inserts (0-1)
  chamberPoint: number;  // Progress point where weapon chambers round (0-1)
  cancelPoint: number;   // Progress point where reload can't be cancelled (0-1)
}