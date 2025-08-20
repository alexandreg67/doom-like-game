/**
 * Hitscan weapon system using Babylon.js raycast
 * Implements DOOM-style instant hit mechanics
 */

import { Ray, Vector3 } from '@babylonjs/core';
import type { Scene, AbstractMesh } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import type { WeaponComponent } from '../components/weapon-component';
import type { FiringContext, HitResult, WeaponConfig, MaterialType } from '../types';

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
    _angle: number,
    _maxDistance: number
  ): Entity[] {
    const entities: Entity[] = [];
    const _halfAngle = _angle / 2;

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
        // Calculate surface angle and impact properties
        const surfaceAngle = this.calculateSurfaceAngle(direction, normal);
        const impactVelocity = direction.scale(config.range / 10); // Rough velocity estimation
        
        // Detect material type from mesh
        const materialType = this.detectMaterialType(pickInfo.pickedMesh);
        
        result = {
          hit: true,
          position: pickInfo.pickedPoint,
          normal,
          distance: pickInfo.distance,
          damage: 0, // Will be calculated later
          // entity: this.getEntityFromMesh(pickInfo.pickedMesh), // Need ECS integration
          
          // Impact system properties
          materialType,
          surfaceAngle,
          impactVelocity,
          meshName: pickInfo.pickedMesh?.name,
          materialName: pickInfo.pickedMesh?.material?.name,
          canPenetrate: this.canPenetrateMaterial(materialType, config),
          ricochetAngle: this.calculateRicochetAngle(surfaceAngle, materialType)
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

  /**
   * Detect material type from mesh properties
   */
  private detectMaterialType(mesh?: AbstractMesh | null): MaterialType {
    if (!mesh) {
      return 'default';
    }

    const meshName = mesh.name?.toLowerCase() || '';
    const materialName = mesh.material?.name?.toLowerCase() || '';
    
    // Check mesh name patterns
    if (meshName.includes('metal') || meshName.includes('steel') || meshName.includes('iron')) {
      return 'metal';
    }
    if (meshName.includes('concrete') || meshName.includes('cement') || meshName.includes('wall')) {
      return 'concrete';
    }
    if (meshName.includes('stone') || meshName.includes('rock') || meshName.includes('brick')) {
      return 'stone';
    }
    if (meshName.includes('wood') || meshName.includes('timber') || meshName.includes('plank')) {
      return 'wood';
    }
    if (meshName.includes('glass') || meshName.includes('window')) {
      return 'glass';
    }
    if (meshName.includes('water') || meshName.includes('liquid')) {
      return 'water';
    }
    if (meshName.includes('dirt') || meshName.includes('soil') || meshName.includes('ground')) {
      return 'dirt';
    }
    if (meshName.includes('fabric') || meshName.includes('cloth') || meshName.includes('carpet')) {
      return 'fabric';
    }
    if (meshName.includes('plastic') || meshName.includes('polymer')) {
      return 'plastic';
    }

    // Check material name patterns
    if (materialName.includes('metal') || materialName.includes('steel')) {
      return 'metal';
    }
    if (materialName.includes('concrete') || materialName.includes('stone')) {
      return 'concrete';
    }
    if (materialName.includes('wood')) {
      return 'wood';
    }
    if (materialName.includes('glass')) {
      return 'glass';
    }
    
    return 'default';
  }

  /**
   * Calculate angle between projectile and surface
   */
  private calculateSurfaceAngle(direction: Vector3, normal: Vector3): number {
    const dot = Vector3.Dot(direction.normalize(), normal.normalize());
    return Math.acos(Math.abs(dot)); // Angle in radians
  }

  /**
   * Determine if projectile can penetrate material
   */
  private canPenetrateMaterial(materialType: MaterialType, config: WeaponConfig): boolean {
    const penetrationPower = config.penetration || 0;
    
    const materialResistance = {
      glass: 0.1,
      wood: 0.3,
      fabric: 0.1,
      plastic: 0.2,
      dirt: 0.4,
      flesh: 0.2,
      default: 0.5,
      concrete: 0.9,
      stone: 0.8,
      metal: 0.7,
      water: 0.0
    };

    const resistance = materialResistance[materialType] || materialResistance.default;
    return penetrationPower > resistance;
  }

  /**
   * Calculate ricochet angle based on surface properties
   */
  private calculateRicochetAngle(surfaceAngle: number, materialType: MaterialType): number {
    const ricochetChances = {
      metal: 0.8,
      concrete: 0.4,
      stone: 0.3,
      water: 0.2,
      default: 0.3,
      wood: 0.1,
      glass: 0.05,
      fabric: 0.0,
      plastic: 0.1,
      dirt: 0.1,
      flesh: 0.0
    };

    const chance = ricochetChances[materialType] || ricochetChances.default;
    
    // Shallow angles have higher ricochet chance
    const angleMultiplier = 1 - (surfaceAngle / (Math.PI / 2));
    const finalChance = chance * angleMultiplier;
    
    return Math.random() < finalChance ? surfaceAngle * 2 : 0;
  }
}
