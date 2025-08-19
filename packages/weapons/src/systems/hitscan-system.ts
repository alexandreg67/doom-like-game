/**
 * Hitscan weapon system using Babylon.js raycast
 * Implements DOOM-style instant hit mechanics
 */

import { Ray, Vector3 } from '@babylonjs/core';
import type { Scene } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import type { WeaponComponent } from '../components/weapon-component';
import type { FiringContext, HitResult, WeaponConfig } from '../types';

export class HitscanSystem {
  private scene: Scene;
  private raycastCache: Map<string, HitResult> = new Map();
  private lastCacheClear = 0;
  private readonly CACHE_DURATION = 16; // 1 frame at 60fps

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Fire a hitscan weapon
   */
  public fire(context: FiringContext): HitResult {
    const { entity, origin, direction, spread } = context;
    const weaponComponent = entity.components.get('weapon') as WeaponComponent;

    if (!weaponComponent) {
      return this.createMissResult(origin, direction);
    }

    // Apply weapon spread
    const spreadDirection = this.applySpread(direction, spread);

    // Perform raycast
    const hitResult = this.performRaycast(origin, spreadDirection, weaponComponent.config);

    // Apply DOOM-style damage calculation
    if (hitResult.hit) {
      hitResult.damage = this.calculateDamage(weaponComponent.config);
    }

    return hitResult;
  }

  /**
   * Fire multiple rays for shotgun-style weapons
   */
  public fireSpread(context: FiringContext, pelletCount: number): HitResult[] {
    const results: HitResult[] = [];
    const weaponComponent = context.entity.components.get('weapon') as WeaponComponent;

    if (!weaponComponent) {
      return [this.createMissResult(context.origin, context.direction)];
    }

    for (let i = 0; i < pelletCount; i++) {
      // Each pellet gets its own spread
      const pelletSpread = context.spread + (Math.random() - 0.5) * 0.1; // Add randomness
      const hitResult = this.fire({
        ...context,
        spread: pelletSpread,
      });

      results.push(hitResult);
    }

    return results;
  }

  /**
   * Check if line of sight is clear between two points
   */
  public hasLineOfSight(from: Vector3, to: Vector3, maxDistance?: number): boolean {
    const direction = to.subtract(from).normalize();
    const distance = maxDistance || Vector3.Distance(from, to);

    const ray = new Ray(from, direction, distance);
    const hit = this.scene.pickWithRay(ray);

    return !hit?.hit || hit.distance >= distance;
  }

  /**
   * Get all entities in a cone (for area effect hitscan)
   *
   * TODO: This method requires integration with the ECS (Entity Component System).
   * Implementation depends on the specific ECS structure being used in the game.
   * When ECS integration is available, this method should:
   * 1. Query all entities with position components within maxDistance
   * 2. Filter entities within the specified cone angle
   * 3. Return array of entities that can be hit by area effect weapons
   */
  public getEntitiesInCone(
    _origin: Vector3,
    _direction: Vector3,
    angle: number,
    _maxDistance: number
  ): Entity[] {
    const entities: Entity[] = [];
    const _halfAngle = angle / 2;

    // ECS integration required: return empty array until ECS system is connected

    return entities;
  }

  /**
   * Update system (cleanup cache, etc.)
   */
  public update(_deltaTime: number): void {
    const now = performance.now();

    // Clear raycast cache periodically
    if (now - this.lastCacheClear > this.CACHE_DURATION) {
      this.raycastCache.clear();
      this.lastCacheClear = now;
    }
  }

  private performRaycast(origin: Vector3, direction: Vector3, config: WeaponConfig): HitResult {
    // Create cache key for potential optimization
    const cacheKey = `${origin.x},${origin.y},${origin.z}:${direction.x},${direction.y},${direction.z}`;

    const cachedResult = this.raycastCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const ray = new Ray(origin, direction, config.range);
    const pickInfo = this.scene.pickWithRay(ray);

    let result: HitResult;

    if (pickInfo?.hit && pickInfo.pickedPoint && pickInfo.getNormal()) {
      const normal = pickInfo.getNormal();
      if (normal) {
        result = {
          hit: true,
          position: pickInfo.pickedPoint,
          normal,
          distance: pickInfo.distance,
          damage: 0, // Will be calculated later
          // entity: this.getEntityFromMesh(pickInfo.pickedMesh), // Need ECS integration
        };
      } else {
        result = this.createMissResult(origin, direction);
      }
    } else {
      result = this.createMissResult(origin, direction);
    }

    this.raycastCache.set(cacheKey, result);
    return result;
  }

  private applySpread(direction: Vector3, spread: number): Vector3 {
    if (spread <= 0) return direction;

    // Convert spread from degrees to radians
    const spreadRad = (spread * Math.PI) / 180;

    // Generate random spread within cone
    const randomAngle = Math.random() * Math.PI * 2;
    const randomRadius = Math.random() * spreadRad;

    // Create spread offset
    const spreadX = Math.cos(randomAngle) * Math.sin(randomRadius);
    const spreadY = Math.sin(randomAngle) * Math.sin(randomRadius);
    const spreadZ = Math.cos(randomRadius);

    // Create local coordinate system
    const forward = direction.normalize();
    const right = Vector3.Cross(forward, Vector3.Up()).normalize();
    const up = Vector3.Cross(right, forward).normalize();

    // Apply spread
    const spreadDirection = forward.scale(spreadZ).add(right.scale(spreadX)).add(up.scale(spreadY));

    return spreadDirection.normalize();
  }

  private calculateDamage(config: WeaponConfig): number {
    // DOOM-style damage: random between min and max, in multiples of 5
    const range = config.maxDamage - config.minDamage;
    const randomMultiplier = Math.random();
    const damage = config.minDamage + Math.floor(randomMultiplier * (range / 5)) * 5;

    return Math.min(damage, config.maxDamage);
  }

  private createMissResult(origin: Vector3, direction: Vector3): HitResult {
    return {
      hit: false,
      position: origin.add(direction.scale(1000)), // Far away position
      normal: Vector3.Zero(),
      distance: 1000,
      damage: 0,
    };
  }
}

/**
 * Utility functions for hitscan calculations
 */
export class HitscanUtils {
  /**
   * Calculate spread based on weapon state
   */
  static calculateCurrentSpread(
    baseSpread: number,
    spreadAccumulation: number,
    maxSpread: number,
    isMoving: boolean,
    isCrouching: boolean
  ): number {
    let currentSpread = baseSpread + spreadAccumulation;

    // Movement affects accuracy
    if (isMoving) {
      currentSpread *= isCrouching ? 1.2 : 1.5;
    } else if (isCrouching) {
      currentSpread *= 0.8; // More accurate when crouching
    }

    return Math.min(currentSpread, maxSpread);
  }

  /**
   * Calculate damage falloff over distance
   */
  static calculateDamageFalloff(
    baseDamage: number,
    distance: number,
    maxRange: number,
    falloffStart = 0.5
  ): number {
    if (distance <= maxRange * falloffStart) {
      return baseDamage;
    }

    const falloffDistance = distance - maxRange * falloffStart;
    const falloffRange = maxRange * (1 - falloffStart);
    const falloffRatio = Math.min(falloffDistance / falloffRange, 1);

    // Linear falloff to 50% damage at max range
    return baseDamage * (1 - falloffRatio * 0.5);
  }

  /**
   * Check if hit was a critical hit (headshot, etc.)
   */
  static isCriticalHit(
    hitPosition: Vector3,
    targetPosition: Vector3,
    targetHeight: number
  ): boolean {
    const relativeHeight = hitPosition.y - targetPosition.y;
    const headHeight = targetHeight * 0.8; // Top 20% is considered head

    return relativeHeight >= headHeight;
  }

  /**
   * Calculate penetration through surfaces
   */
  static calculatePenetration(
    damage: number,
    penetrationPower: number,
    surfaceThickness: number,
    surfaceMaterial: string
  ): { canPenetrate: boolean; remainingDamage: number } {
    const materialModifiers: Record<string, number> = {
      wood: 0.5,
      metal: 2.0,
      concrete: 3.0,
      glass: 0.1,
      flesh: 0.2,
    };

    const materialResistance = materialModifiers[surfaceMaterial] || 1.0;
    const requiredPenetration = surfaceThickness * materialResistance;

    const canPenetrate = penetrationPower >= requiredPenetration;
    const remainingDamage = canPenetrate
      ? damage * (1 - requiredPenetration / penetrationPower)
      : 0;

    return { canPenetrate, remainingDamage };
  }
}
