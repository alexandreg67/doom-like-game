/**
 * Core types and interfaces for the weapon system
 */

import type { Vector2, Vector3 } from '@babylonjs/core';
import type { Component, Entity } from '@doom-like/game-logic';

/**
 * Weapon firing types - inspired by DOOM mechanics
 */
export type WeaponType = 'hitscan' | 'projectile';

/**
 * Weapon categories for different gameplay mechanics
 */
export type WeaponCategory = 'melee' | 'pistol' | 'shotgun' | 'automatic' | 'explosive' | 'energy';

/**
 * Weapon state enumeration
 */
export type WeaponState = 'idle' | 'firing' | 'reloading' | 'switching' | 'empty';

/**
 * Ammo types supported by the weapon system
 */
export type AmmoType = 'bullets' | 'shells' | 'rockets' | 'cells' | 'energy';

/**
 * Crosshair styles following 2025 FPS best practices
 */
export type CrosshairStyle = 'dot' | 'cross' | 'circle' | 'custom';

/**
 * Crosshair behavior modes
 */
export type CrosshairBehavior = 'static' | 'dynamic' | 'weapon-specific';

/**
 * Material types for impact system
 */
export type MaterialType = 
  | 'metal'
  | 'concrete' 
  | 'stone'
  | 'wood'
  | 'glass'
  | 'water'
  | 'flesh'
  | 'dirt'
  | 'fabric'
  | 'plastic'
  | 'default';

/**
 * Hit result from weapon firing
 */
export interface HitResult {
  hit: boolean;
  position: Vector3;
  normal: Vector3;
  distance: number;
  entity?: Entity;
  damage: number;
  
  // Impact system properties
  materialType?: MaterialType;
  surfaceAngle?: number;
  impactVelocity?: Vector3;
  meshName?: string;
  materialName?: string;
  canPenetrate?: boolean;
  ricochetAngle?: number;
}

/**
 * Weapon configuration interface
 */
export interface WeaponConfig {
  // Basic properties
  name: string;
  type: WeaponType;
  category: WeaponCategory;

  // Damage and range
  minDamage: number;
  maxDamage: number;
  range: number;

  // Firing mechanics
  fireRate: number; // rounds per minute
  burstCount?: number;
  burstDelay?: number;

  // Accuracy and spread
  baseSpread: number; // in degrees
  maxSpread: number;
  spreadIncrease: number;
  spreadDecay: number;

  // Ammo
  ammoType: AmmoType;
  clipSize: number;
  reloadTime: number;

  // Visual and audio
  muzzleFlash: boolean;
  recoil: Vector2; // x = horizontal, y = vertical
  crosshairStyle: CrosshairStyle;

  // Special properties
  penetration?: number;
  explosionRadius?: number;
  projectileSpeed?: number;

  // Audio configuration
  audioConfig?: WeaponAudioConfig;
}

/**
 * Crosshair configuration
 */
export interface CrosshairConfig {
  style: CrosshairStyle;
  behavior: CrosshairBehavior;
  size: number;
  thickness: number;
  gap: number;
  color: string;
  outlineColor?: string;
  opacity: number;

  // Dynamic behavior
  expandOnFire?: boolean;
  expandOnMove?: boolean;
  expansionAmount?: number;

  // Weapon-specific overrides
  weaponOverrides?: Map<string, Partial<CrosshairConfig>>;
}

/**
 * Weapon firing context
 */
export interface FiringContext {
  entity: Entity;
  origin: Vector3;
  direction: Vector3;
  spread: number;
  timestamp: number;
}

/**
 * Projectile configuration for non-hitscan weapons
 */
export interface ProjectileConfig {
  speed: number;
  gravity: number;
  mass: number;
  explosionRadius?: number;
  bounces?: number;
  lifeTime: number;
  trailEffect?: string;
}

/**
 * Audio configuration for weapons
 */
export interface WeaponAudioConfig {
  fireSound: string;
  reloadSound: string;
  emptySound: string;
  switchSound: string;
  volume: number;
  pitch: number;
  spatialAudio: boolean;
}
