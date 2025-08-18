/**
 * Weapon component for ECS entities
 * Contains weapon configuration and current state
 */

import type { Component } from '@doom-like/game-logic';
import type { WeaponConfig, WeaponState, AmmoType } from '../types';

export interface WeaponComponent extends Component {
  id: 'weapon';
  
  // Weapon configuration
  config: WeaponConfig;
  
  // Current state
  state: WeaponState;
  
  // Firing mechanics
  lastFireTime: number;
  currentSpread: number;
  burstCounter: number;
  
  // Ammo management
  currentAmmo: number;
  reserveAmmo: number;
  
  // Timing
  lastReloadTime: number;
  lastSwitchTime: number;
  
  // Visual state
  muzzleFlashActive: boolean;
  muzzleFlashStartTime: number;
  
  // Performance tracking
  shotsThisSecond: number;
  lastShotCountReset: number;
}

/**
 * Create a weapon component with default values
 */
export function createWeaponComponent(config: WeaponConfig): WeaponComponent {
  return {
    id: 'weapon',
    config,
    state: 'idle',
    lastFireTime: 0,
    currentSpread: config.baseSpread,
    burstCounter: 0,
    currentAmmo: config.clipSize,
    reserveAmmo: config.clipSize * 3, // Default 3 clips
    lastReloadTime: 0,
    lastSwitchTime: 0,
    muzzleFlashActive: false,
    muzzleFlashStartTime: 0,
    shotsThisSecond: 0,
    lastShotCountReset: 0,
  };
}

/**
 * Weapon slot component for weapon switching
 */
export interface WeaponSlotComponent extends Component {
  id: 'weaponSlot';
  
  // Weapon slots (1-8 like DOOM)
  slots: Map<number, WeaponComponent | null>;
  currentSlot: number;
  previousSlot: number;
  
  // Switching state
  isSwitching: boolean;
  switchStartTime: number;
  switchDuration: number;
}

/**
 * Create weapon slot component with default empty slots
 */
export function createWeaponSlotComponent(): WeaponSlotComponent {
  const slots = new Map<number, WeaponComponent | null>();
  
  // Initialize 8 weapon slots (DOOM-style)
  for (let i = 1; i <= 8; i++) {
    slots.set(i, null);
  }
  
  return {
    id: 'weaponSlot',
    slots,
    currentSlot: 1,
    previousSlot: 1,
    isSwitching: false,
    switchStartTime: 0,
    switchDuration: 500, // ms
  };
}

/**
 * Weapon pickup component for items in the world
 */
export interface WeaponPickupComponent extends Component {
  id: 'weaponPickup';
  
  weaponConfig: WeaponConfig;
  ammoAmount: number;
  respawnTime?: number;
  lastPickupTime: number;
  isRespawning: boolean;
}