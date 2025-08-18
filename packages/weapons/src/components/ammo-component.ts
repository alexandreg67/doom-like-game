/**
 * Ammo management component
 * Tracks ammunition for different weapon types
 */

import type { Component } from '@doom-like/game-logic';
import type { AmmoType } from '../types';

export interface AmmoComponent extends Component {
  id: 'ammo';
  
  // Ammo reserves by type
  ammoReserves: Map<AmmoType, number>;
  
  // Maximum ammo capacity by type
  maxAmmo: Map<AmmoType, number>;
  
  // Infinite ammo flags (for cheats/special modes)
  infiniteAmmo: boolean;
  infiniteAmmoTypes: Set<AmmoType>;
}

/**
 * Create ammo component with DOOM-like default values
 */
export function createAmmoComponent(): AmmoComponent {
  const ammoReserves = new Map<AmmoType, number>([
    ['bullets', 200],     // Pistol/Chaingun ammo
    ['shells', 50],       // Shotgun ammo  
    ['rockets', 50],      // Rocket launcher ammo
    ['cells', 300],       // Plasma rifle/BFG ammo
    ['energy', 100],      // Generic energy ammo
  ]);
  
  const maxAmmo = new Map<AmmoType, number>([
    ['bullets', 400],     // DOOM max bullet ammo
    ['shells', 100],      // DOOM max shell ammo
    ['rockets', 100],     // DOOM max rocket ammo
    ['cells', 600],       // DOOM max cell ammo
    ['energy', 200],      // Generic energy max
  ]);
  
  return {
    id: 'ammo',
    ammoReserves,
    maxAmmo,
    infiniteAmmo: false,
    infiniteAmmoTypes: new Set(),
  };
}

/**
 * Ammo pickup component for items in the world
 */
export interface AmmoPickupComponent extends Component {
  id: 'ammoPickup';
  
  ammoType: AmmoType;
  amount: number;
  isLargePickup: boolean; // Affects pickup amount multiplier
  respawnTime?: number;
  lastPickupTime: number;
  isRespawning: boolean;
}

/**
 * Utility functions for ammo management
 */
export class AmmoUtils {
  /**
   * Check if entity has enough ammo for a weapon
   */
  static hasAmmo(ammoComponent: AmmoComponent, ammoType: AmmoType, required: number): boolean {
    if (ammoComponent.infiniteAmmo || ammoComponent.infiniteAmmoTypes.has(ammoType)) {
      return true;
    }
    
    const current = ammoComponent.ammoReserves.get(ammoType) || 0;
    return current >= required;
  }
  
  /**
   * Consume ammo from reserves
   */
  static consumeAmmo(ammoComponent: AmmoComponent, ammoType: AmmoType, amount: number): boolean {
    if (ammoComponent.infiniteAmmo || ammoComponent.infiniteAmmoTypes.has(ammoType)) {
      return true;
    }
    
    const current = ammoComponent.ammoReserves.get(ammoType) || 0;
    if (current < amount) {
      return false;
    }
    
    ammoComponent.ammoReserves.set(ammoType, current - amount);
    return true;
  }
  
  /**
   * Add ammo to reserves (returns amount actually added)
   */
  static addAmmo(ammoComponent: AmmoComponent, ammoType: AmmoType, amount: number): number {
    const current = ammoComponent.ammoReserves.get(ammoType) || 0;
    const max = ammoComponent.maxAmmo.get(ammoType) || 0;
    const canAdd = Math.max(0, max - current);
    const actualAmount = Math.min(amount, canAdd);
    
    if (actualAmount > 0) {
      ammoComponent.ammoReserves.set(ammoType, current + actualAmount);
    }
    
    return actualAmount;
  }
  
  /**
   * Get ammo percentage for UI
   */
  static getAmmoPercentage(ammoComponent: AmmoComponent, ammoType: AmmoType): number {
    const current = ammoComponent.ammoReserves.get(ammoType) || 0;
    const max = ammoComponent.maxAmmo.get(ammoType) || 0;
    
    if (max === 0) return 0;
    return (current / max) * 100;
  }
  
  /**
   * Check if ammo is at maximum capacity
   */
  static isAmmoFull(ammoComponent: AmmoComponent, ammoType: AmmoType): boolean {
    const current = ammoComponent.ammoReserves.get(ammoType) || 0;
    const max = ammoComponent.maxAmmo.get(ammoType) || 0;
    return current >= max;
  }
  
  /**
   * Get total ammo weight (for inventory limits)
   */
  static getTotalAmmoWeight(ammoComponent: AmmoComponent): number {
    let weight = 0;
    
    // Weight per ammo type (bullets are lighter than rockets)
    const weights: Record<AmmoType, number> = {
      bullets: 0.01,
      shells: 0.05,
      rockets: 1.0,
      cells: 0.02,
      energy: 0.01,
    };
    
    for (const [ammoType, amount] of ammoComponent.ammoReserves) {
      weight += amount * (weights[ammoType] || 0.01);
    }
    
    return weight;
  }
}