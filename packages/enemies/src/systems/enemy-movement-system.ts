import { Vector3 } from '@babylonjs/core';
import type { Entity, System, Transform } from '@doom-like/game-logic';
import type {
  EnemyAIComponent,
  EnemyIdentityComponent,
  EnemyMovementComponent,
  EnemyStateComponent,
} from '../components';
import { EnemyMovementUtils } from '../components';
import { EnemyState } from '../types';

/**
 * EnemyMovementSystem - Manages enemy movement and navigation
 *
 * Responsibilities:
 * - DOOM-style direct movement towards targets
 * - Collision detection and bounce behavior
 * - Smooth rotation towards movement direction
 * - Stuck detection and unstuck behavior
 * - Integration with AI system for target positions
 */
export class EnemyMovementSystem implements System {
  private debugMode = false;

  /**
   * Enable/disable debug logging
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }

  /**
   * Update all enemy movement
   */
  update(entities: Entity[], deltaTime: number): void {
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        this.updateEnemyMovement(entity, deltaTime);
      }
    }
  }

  /**
   * Check if entity is an enemy with movement capability
   */
  private isEnemyEntity(entity: Entity): boolean {
    return (
      entity.components.has('enemyIdentity') &&
      entity.components.has('enemyMovement') &&
      entity.components.has('enemyState') &&
      entity.components.has('enemyAI')
    );
  }

  /**
   * Update individual enemy movement
   */
  private updateEnemyMovement(entity: Entity, deltaTime: number): void {
    const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const movementComponent = entity.components.get('enemyMovement') as EnemyMovementComponent;
    const stateComponent = entity.components.get('enemyState') as EnemyStateComponent;
    const aiComponent = entity.components.get('enemyAI') as EnemyAIComponent;
    const transform = entity.components.get('transform') as Transform;

    if (!identity?.isAlive || !transform) return;

    const currentPosition = new Vector3(transform.x, transform.y, transform.z);

    // Update movement target based on AI state
    this.updateMovementTarget(movementComponent, aiComponent, stateComponent, currentPosition);

    // Update stuck detection
    EnemyMovementUtils.updateStuckDetection(movementComponent, currentPosition, deltaTime);

    // Calculate movement delta
    let movementDelta: Vector3;

    if (movementComponent.isStuck) {
      // Apply unstuck movement
      movementDelta = EnemyMovementUtils.applyUnstuckMovement(movementComponent, deltaTime);

      if (this.debugMode) {
        console.log(`[MOVEMENT] ${identity.instanceId} applying unstuck movement`);
      }
    } else {
      // Normal movement towards target
      movementDelta = EnemyMovementUtils.updateSimpleMovement(
        movementComponent,
        currentPosition,
        deltaTime
      );
    }

    // Update facing direction
    EnemyMovementUtils.updateFacing(movementComponent, deltaTime);

    // Apply movement to transform (with collision check)
    if (movementDelta.length() > 0.001) {
      const newPosition = currentPosition.add(movementDelta);

      // Simple collision check and bounce (placeholder)
      const finalPosition = this.checkCollisionAndBounce(
        entity,
        currentPosition,
        newPosition,
        movementComponent
      );

      // Update transform
      transform.x = finalPosition.x;
      transform.y = finalPosition.y;
      transform.z = finalPosition.z;

      if (this.debugMode) {
        const speed = movementDelta.length() / deltaTime;
        console.log(
          `[MOVEMENT] ${identity.instanceId} moved to (${finalPosition.x.toFixed(1)}, ${finalPosition.z.toFixed(1)}) at ${speed.toFixed(1)} m/s`
        );
      }
    }
  }

  /**
   * Update movement target based on AI state and decisions
   */
  private updateMovementTarget(
    movementComponent: EnemyMovementComponent,
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentPosition: Vector3
  ): void {
    const currentState = stateComponent.currentState;

    switch (currentState) {
      case EnemyState.IDLE:
      case EnemyState.DEATH:
        // No movement
        EnemyMovementUtils.setTarget(movementComponent, null);
        break;

      case EnemyState.HURT:
        // Stop movement during hurt state
        EnemyMovementUtils.stop(movementComponent);
        break;

      case EnemyState.SEEKING:
      case EnemyState.CHASE: {
        // Move towards target
        const targetPosition = EnemyAIUtils.getMovementTarget(aiComponent);
        if (targetPosition) {
          EnemyMovementUtils.setTarget(movementComponent, targetPosition, currentPosition);
        } else {
          EnemyMovementUtils.setTarget(movementComponent, null);
        }
        break;
      }

      case EnemyState.ATTACK:
        // Slow movement or stop during attack
        if (aiComponent.isTargetInAttackRange) {
          // Face target but don't move closer
          EnemyMovementUtils.stop(movementComponent);

          // Set facing direction towards target
          if (aiComponent.directionToTarget) {
            const direction = aiComponent.directionToTarget;
            movementComponent.targetFacingAngle = Math.atan2(direction.x, direction.z);
          }
        } else {
          // Target moved, chase again
          const targetPosition = EnemyAIUtils.getMovementTarget(aiComponent);
          if (targetPosition) {
            EnemyMovementUtils.setTarget(movementComponent, targetPosition, currentPosition);
          }
        }
        break;
    }
  }

  /**
   * Simple collision detection with bounce behavior
   * In a real game, this would integrate with the physics system
   */
  private checkCollisionAndBounce(
    entity: Entity,
    fromPosition: Vector3,
    toPosition: Vector3,
    movementComponent: EnemyMovementComponent
  ): Vector3 {
    // Placeholder collision system
    // Real implementation would check against map geometry

    const stats = entity.components.get('enemyStats') as { radius?: number } | undefined;
    const radius = stats?.radius || 0.4;

    // Simple boundary checks (example: world bounds)
    const worldSize = 50;
    const finalPosition = toPosition.clone();

    // Bounce off world boundaries
    if (Math.abs(finalPosition.x) > worldSize - radius) {
      finalPosition.x = Math.sign(finalPosition.x) * (worldSize - radius);
      // Reverse X velocity component for bounce
      if (movementComponent.velocity.x !== 0) {
        movementComponent.velocity.x *= -0.5; // Dampened bounce
      }
    }

    if (Math.abs(finalPosition.z) > worldSize - radius) {
      finalPosition.z = Math.sign(finalPosition.z) * (worldSize - radius);
      // Reverse Z velocity component for bounce
      if (movementComponent.velocity.z !== 0) {
        movementComponent.velocity.z *= -0.5; // Dampened bounce
      }
    }

    // Keep Y position (no vertical movement for now)
    finalPosition.y = fromPosition.y;

    return finalPosition;
  }

  /**
   * Force stop all enemy movement (useful for pause/debug)
   */
  stopAllMovement(entities: Entity[]): void {
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const movementComponent = entity.components.get('enemyMovement') as EnemyMovementComponent;
        EnemyMovementUtils.stop(movementComponent);
      }
    }
  }

  /**
   * Get movement statistics
   */
  getStats(entities: Entity[]): {
    movingEnemies: number;
    stuckEnemies: number;
    averageSpeed: number;
    totalDistance: number;
  } {
    let movingCount = 0;
    let stuckCount = 0;
    let totalSpeed = 0;
    let totalDistance = 0;

    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const movementComponent = entity.components.get('enemyMovement') as EnemyMovementComponent;
        const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;

        if (!identity?.isAlive) continue;

        if (movementComponent.isMoving) {
          movingCount++;
          const speed = movementComponent.velocity.length();
          totalSpeed += speed;
        }

        if (movementComponent.isStuck) {
          stuckCount++;
        }

        // Approximate distance traveled (would need to track over time)
        totalDistance += movementComponent.velocity.length();
      }
    }

    return {
      movingEnemies: movingCount,
      stuckEnemies: stuckCount,
      averageSpeed: movingCount > 0 ? totalSpeed / movingCount : 0,
      totalDistance,
    };
  }
}

// Import AI utils (avoiding circular import)
import { EnemyAIUtils } from '../components';
