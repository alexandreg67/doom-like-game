/**
 * @doom-like/weapons
 * Weapon system and aiming mechanics for DOOM-like game
 */

// Core types and interfaces
export * from './types';

// Crosshair system
export * from './crosshair';

// ECS Components
export * from './components';

// Weapon systems
export * from './systems';

// Weapon implementations
export { BaseWeapon, Pistol, Shotgun, Chaingun, RocketLauncher, WeaponFactory } from './weapons';

// User interface
export * from './ui';

// Audio system
// export * from './audio';  // TODO: Implement audio system