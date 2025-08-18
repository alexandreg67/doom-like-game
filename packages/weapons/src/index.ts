/**
 * @doom-like/weapons
 * Weapon system and aiming mechanics for DOOM-like game
 */

// Core types and interfaces (exclude internal WeaponType to avoid name clash)
export type {
  WeaponCategory,
  WeaponState,
  AmmoType,
  CrosshairStyle,
  CrosshairBehavior,
  HitResult,
  WeaponConfig,
  CrosshairConfig,
  FiringContext,
  ProjectileConfig,
  WeaponAudioConfig,
} from './types';

// Crosshair system
export * from './crosshair';

// ECS Components
export * from './components';

// Weapon systems
export * from './systems';

// Weapon implementations
export { BaseWeapon, Pistol, Shotgun, Chaingun, RocketLauncher, WeaponFactory } from './weapons';
export type { WeaponType } from './weapons/weapon-factory';

// User interface
export * from './ui';

// Audio system
export { WeaponAudioManager } from './audio/weapon-audio-manager';
export type { SpatialAudioContext, CustomAudioBuffer } from './audio/weapon-audio-manager';
