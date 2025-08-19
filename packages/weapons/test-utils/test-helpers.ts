/**
 * Test utilities and helpers for weapon system tests
 */

import type { Mesh, Scene } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import { vi } from 'vitest';

/**
 * Create a mock Babylon.js scene for testing
 */
export function createMockScene(): Scene {
  return {
    pickWithRay: vi.fn(),
    createPickingRay: vi.fn(),
    pick: vi.fn(),
    multiPick: vi.fn(),
    dispose: vi.fn(),
    registerBeforeRender: vi.fn(),
    unregisterBeforeRender: vi.fn(),
  } as any;
}

/**
 * Create a mock entity for testing
 */
export function createMockEntity(name: string): Entity {
  const mockMesh: Mesh = {
    name,
    position: { x: 0, y: 0, z: 0 },
    dispose: vi.fn(),
    setEnabled: vi.fn(),
    intersectsMesh: vi.fn(),
    getBoundingInfo: vi.fn(),
  } as any;

  return {
    id: `entity_${name}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    mesh: mockMesh,
    type: 'entity',
    team: 'neutral',
    components: new Map(),
    addComponent: vi.fn(),
    removeComponent: vi.fn(),
    getComponent: vi.fn(),
    hasComponent: vi.fn(),
  } as any;
}

/**
 * Create mock weapon configuration for testing
 */
export function createMockWeaponConfig(overrides: any = {}) {
  return {
    name: 'Test Weapon',
    type: 'hitscan',
    category: 'test',
    minDamage: 5,
    maxDamage: 15,
    range: 1000,
    fireRate: 200,
    baseSpread: 0,
    maxSpread: 5,
    spreadIncrease: 1,
    spreadDecay: 5,
    ammoType: 'bullets',
    clipSize: 12,
    reloadTime: 1.5,
    muzzleFlash: true,
    recoil: { x: 0.5, y: 1.0 },
    crosshairStyle: 'dot',
    ...overrides,
  };
}

/**
 * Create mock crosshair configuration for testing
 */
export function createMockCrosshairConfig(overrides: any = {}) {
  return {
    style: 'cross',
    size: 10,
    thickness: 2,
    gap: 4,
    color: '#ffffff',
    opacity: 1.0,
    dynamicExpansion: false,
    ...overrides,
  };
}

/**
 * Create mock ammo component for testing
 */
export function createMockAmmoComponent(overrides: any = {}) {
  return {
    currentAmmo: 12,
    reserveAmmo: 100,
    maxAmmo: 200,
    ammoType: 'bullets',
    infiniteAmmo: false,
    ...overrides,
  };
}

/**
 * Create mock weapon component for testing
 */
export function createMockWeaponComponent(overrides: any = {}) {
  return {
    weaponType: 'pistol',
    name: 'Test Weapon',
    minDamage: 5,
    maxDamage: 15,
    range: 1000,
    fireRate: 200,
    currentAmmo: 12,
    reserveAmmo: 100,
    ammoType: 'bullets',
    clipSize: 12,
    reloadTime: 1.5,
    isReloading: false,
    isFiring: false,
    lastFireTime: 0,
    currentSpread: 0,
    recoilAmount: 0,
    ...overrides,
  };
}

/**
 * Create mock projectile component for testing
 */
export function createMockProjectileComponent(overrides: any = {}) {
  return {
    velocity: { x: 20, y: 0, z: 0 },
    damage: 100,
    explosionRadius: 128,
    lifetime: 5.0,
    age: 0,
    ownerId: 'test_entity',
    hasExploded: false,
    gravityAffected: true,
    bounceCount: 0,
    maxBounces: 0,
    ...overrides,
  };
}

/**
 * Helper to simulate time passage in tests
 */
export function simulateTimePassage(deltaTime: number) {
  return {
    deltaTime,
    timestamp: Date.now(),
  };
}

/**
 * Helper to create mock input event
 */
export function createMockInputEvent(type: string, data: any = {}) {
  return {
    type,
    timestamp: Date.now(),
    ...data,
  };
}

/**
 * Helper to create mock DOM element
 */
export function createMockDOMElement() {
  return {
    style: {},
    classList: {
      add: vi.fn(),
      remove: vi.fn(),
      contains: vi.fn(),
      toggle: vi.fn(),
    },
    appendChild: vi.fn(),
    removeChild: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelector: vi.fn(),
    querySelectorAll: vi.fn(() => []),
    getAttribute: vi.fn(),
    setAttribute: vi.fn(),
    innerHTML: '',
    textContent: '',
  } as any;
}

/**
 * Helper to mock HTML5 Audio API
 */
export function createMockAudioContext() {
  return {
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      gain: { value: 1.0 },
    })),
    createPanner: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      setPosition: vi.fn(),
      setOrientation: vi.fn(),
      panningModel: 'HRTF',
      distanceModel: 'inverse',
    })),
    createBufferSource: vi.fn(() => ({
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      buffer: null,
    })),
    decodeAudioData: vi.fn(),
    destination: {},
    sampleRate: 44100,
    currentTime: 0,
  } as any;
}

/**
 * Helper to create mock performance metrics
 */
export function createMockPerformanceMetrics() {
  return {
    frameTime: 16.67, // 60 FPS
    renderTime: 12.0,
    updateTime: 3.0,
    memoryUsage: 50 * 1024 * 1024, // 50MB
    drawCalls: 150,
    triangles: 50000,
    fps: 60,
  };
}

/**
 * Helper to assert vector equality with tolerance
 */
export function assertVectorEquals(
  actual: { x: number; y: number; z?: number },
  expected: { x: number; y: number; z?: number },
  tolerance = 0.001
) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(tolerance);

  if (expected.z !== undefined && actual.z !== undefined) {
    expect(Math.abs(actual.z - expected.z)).toBeLessThan(tolerance);
  }
}

/**
 * Helper to generate random damage values following DOOM pattern
 * @param baseDamage The base damage value
 * @returns Random damage between (baseDamage-10) and baseDamage, clamped to minimum 5, in multiples of 5
 */
export function generateDoomDamage(baseDamage: number): number {
  // DOOM damage calculation: ensures minimum damage of 5, even when baseDamage < 15
  const minDamage = Math.max(5, baseDamage - 10);
  const maxDamage = baseDamage;
  const damageRange = (maxDamage - minDamage) / 5;
  return minDamage + Math.floor(Math.random() * (damageRange + 1)) * 5;
}

/**
 * Helper to create test scenario for weapon firing
 */
export function createFiringTestScenario() {
  const shooter = createMockEntity('shooter');
  const target = createMockEntity('target');
  const scene = createMockScene();

  return {
    shooter,
    target,
    scene,
    firePosition: { x: 0, y: 0, z: 0 },
    fireDirection: { x: 1, y: 0, z: 0 },
    targetPosition: { x: 500, y: 0, z: 0 },
  };
}

/**
 * Helper to validate DOOM-style damage values
 */
export function validateDoomDamage(damage: number, expectedMin: number, expectedMax: number) {
  expect(damage).toBeGreaterThanOrEqual(expectedMin);
  expect(damage).toBeLessThanOrEqual(expectedMax);
  expect(damage % 5).toBe(0); // DOOM damage always in multiples of 5
}

/**
 * Helper to simulate weapon firing sequence
 */
export function simulateWeaponFiring(weapon: any, rounds = 1) {
  const results = [];

  for (let i = 0; i < rounds; i++) {
    const canFire = weapon.canFire();
    if (canFire) {
      const damage = weapon.fire();
      results.push({ round: i + 1, damage, spread: weapon.getCurrentSpread() });
    } else {
      results.push({ round: i + 1, damage: 0, spread: weapon.getCurrentSpread(), blocked: true });
    }
  }

  return results;
}

/**
 * Helper to create comprehensive weapon test suite
 */
export function createWeaponTestSuite(weaponClass: any, expectedConfig: any) {
  return {
    testBasicProperties: () => {
      const weapon = new weaponClass();
      expect(weapon.getName()).toBe(expectedConfig.name);
      expect(weapon.getCategory()).toBe(expectedConfig.category);
      expect(weapon.getSlotNumber()).toBe(expectedConfig.slot);
    },

    testDamageRange: () => {
      const weapon = new weaponClass();
      const config = weapon.getConfig();
      expect(config.minDamage).toBe(expectedConfig.minDamage);
      expect(config.maxDamage).toBe(expectedConfig.maxDamage);
    },

    testAmmoConfiguration: () => {
      const weapon = new weaponClass();
      const config = weapon.getConfig();
      expect(config.ammoType).toBe(expectedConfig.ammoType);
      expect(config.clipSize).toBe(expectedConfig.clipSize);
    },

    testFiringMechanics: () => {
      const weapon = new weaponClass();
      const config = weapon.getConfig();
      expect(config.fireRate).toBe(expectedConfig.fireRate);
      expect(config.type).toBe(expectedConfig.type);
    },
  };
}
