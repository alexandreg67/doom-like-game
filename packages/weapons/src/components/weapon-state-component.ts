/**
 * Weapon state component for tracking complex weapon behaviors
 */

import { Vector2 } from '@babylonjs/core';
import type { Component } from '@doom-like/game-logic';
import type { WeaponState } from '../types';

export interface WeaponStateComponent extends Component {
  id: 'weaponState';

  // Core state
  currentState: WeaponState;
  previousState: WeaponState;
  stateChangeTime: number;

  // Firing state
  isFiring: boolean;
  fireHeld: boolean;
  fireStartTime: number;
  lastFireTime: number;
  fireCount: number;

  // Burst firing
  burstActive: boolean;
  burstShotsFired: number;
  burstStartTime: number;
  nextBurstShotTime: number;

  // Reloading state
  isReloading: boolean;
  reloadStartTime: number;
  reloadProgress: number; // 0-1
  canCancelReload: boolean;

  // Switching state
  isSwitching: boolean;
  switchFromWeapon?: string;
  switchToWeapon?: string;
  switchStartTime: number;
  switchProgress: number; // 0-1

  // Accuracy and spread
  currentAccuracy: number; // 0-1, 1 = perfect accuracy
  spreadAccumulation: number;
  lastSpreadDecayTime: number;

  // Recoil state
  recoilVector: Vector2;
  recoilRecoveryRate: number;
  maxRecoilReached: boolean;

  // Visual feedback
  muzzleFlashTimer: number;
  shellEjectionTimer: number;
  weaponBobOffset: Vector2;

  // Performance tracking
  rpm: number; // Calculated rounds per minute
  lastRpmCalculation: number;
  shotTimestamps: number[];
}

/**
 * Create weapon state component with default values
 */
export function createWeaponStateComponent(): WeaponStateComponent {
  return {
    id: 'weaponState',
    currentState: 'idle',
    previousState: 'idle',
    stateChangeTime: 0,

    isFiring: false,
    fireHeld: false,
    fireStartTime: 0,
    lastFireTime: 0,
    fireCount: 0,

    burstActive: false,
    burstShotsFired: 0,
    burstStartTime: 0,
    nextBurstShotTime: 0,

    isReloading: false,
    reloadStartTime: 0,
    reloadProgress: 0,
    canCancelReload: true,

    isSwitching: false,
    switchStartTime: 0,
    switchProgress: 0,

    currentAccuracy: 1.0,
    spreadAccumulation: 0,
    lastSpreadDecayTime: 0,

    recoilVector: new Vector2(0, 0),
    recoilRecoveryRate: 5.0,
    maxRecoilReached: false,

    muzzleFlashTimer: 0,
    shellEjectionTimer: 0,
    weaponBobOffset: new Vector2(0, 0),

    rpm: 0,
    lastRpmCalculation: 0,
    shotTimestamps: [],
  };
}

/**
 * Weapon animation component for visual feedback
 */
export interface WeaponAnimationComponent extends Component {
  id: 'weaponAnimation';

  // Animation state
  currentAnimation: string;
  animationTime: number;
  animationDuration: number;
  isLooping: boolean;

  // Animation queue
  animationQueue: Array<{
    name: string;
    duration: number;
    loop: boolean;
    priority: number;
  }>;

  // Visual effects
  muzzleFlashVisible: boolean;
  muzzleFlashIntensity: number;
  shellCasingEjection: boolean;
  weaponSway: Vector2;
  weaponBob: Vector2;

  // Screen effects
  screenShake: number;
  screenFlash: number;
  crosshairExpansion: number;
}

/**
 * Create weapon animation component
 */
export function createWeaponAnimationComponent(): WeaponAnimationComponent {
  return {
    id: 'weaponAnimation',
    currentAnimation: 'idle',
    animationTime: 0,
    animationDuration: 0,
    isLooping: true,
    animationQueue: [],

    muzzleFlashVisible: false,
    muzzleFlashIntensity: 0,
    shellCasingEjection: false,
    weaponSway: new Vector2(0, 0),
    weaponBob: new Vector2(0, 0),

    screenShake: 0,
    screenFlash: 0,
    crosshairExpansion: 1.0,
  };
}
