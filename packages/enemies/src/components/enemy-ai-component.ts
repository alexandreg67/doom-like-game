import type { Vector3 } from '@babylonjs/core';
import type { Component } from '@doom-like/game-logic';
import type { EnemyAIParams } from '../types';

/**
 * EnemyAI component - manages AI behavior parameters and player tracking
 */
export interface EnemyAIComponent extends Component {
  id: 'enemyAI';

  /** Base AI parameters (can be modified at runtime) */
  params: EnemyAIParams;

  /** Current target entity ID (usually player) */
  targetId: string | null;

  /** Last known target position */
  lastKnownTargetPosition: Vector3 | null;

  /** Time when target was last seen */
  lastSeenTime: number;

  /** Whether enemy currently has line of sight to target */
  hasLineOfSight: boolean;

  /** Distance to current target (updated each frame) */
  distanceToTarget: number;

  /** Whether target is within aggro range */
  isTargetInAggroRange: boolean;

  /** Whether target is within attack range */
  isTargetInAttackRange: boolean;

  /** Direction to target (normalized vector) */
  directionToTarget: Vector3 | null;

  /** Alert level (0 = calm, 1 = fully alert) */
  alertLevel: number;

  /** Time spent seeking without finding target */
  seekingTime: number;

  /** Whether enemy is currently pursuing target */
  isPursuing: boolean;

  /** Custom behavior flags for special enemy types */
  behaviorFlags: {
    canFly?: boolean;
    canOpenDoors?: boolean;
    canJump?: boolean;
    groupBehavior?: boolean;
    territorialBehavior?: boolean;
  };
}

/**
 * Factory function to create EnemyAI component
 */
export function createEnemyAIComponent(
  baseParams: EnemyAIParams,
  overrides?: Partial<EnemyAIParams>
): EnemyAIComponent {
  const params = { ...baseParams, ...overrides };

  return {
    id: 'enemyAI',
    params,
    targetId: null,
    lastKnownTargetPosition: null,
    lastSeenTime: 0,
    hasLineOfSight: false,
    distanceToTarget: Number.MAX_VALUE,
    isTargetInAggroRange: false,
    isTargetInAttackRange: false,
    directionToTarget: null,
    alertLevel: 0,
    seekingTime: 0,
    isPursuing: false,
    behaviorFlags: {},
  };
}

/**
 * Utility functions for AI component management
 */
export class EnemyAIUtils {
  /**
   * Set target for enemy to pursue
   */
  static setTarget(
    aiComponent: EnemyAIComponent,
    targetId: string | null,
    targetPosition?: Vector3
  ): void {
    aiComponent.targetId = targetId;

    if (targetId && targetPosition) {
      aiComponent.lastKnownTargetPosition = targetPosition.clone();
      aiComponent.lastSeenTime = performance.now();
      aiComponent.hasLineOfSight = true;
      aiComponent.isPursuing = true;
    } else {
      aiComponent.hasLineOfSight = false;
      aiComponent.isPursuing = false;
    }
  }

  /**
   * Update target information
   */
  static updateTargetInfo(
    aiComponent: EnemyAIComponent,
    targetPosition: Vector3,
    enemyPosition: Vector3,
    hasLineOfSight: boolean
  ): void {
    // Calculate distance and direction
    const direction = targetPosition.subtract(enemyPosition);
    aiComponent.distanceToTarget = direction.length();
    aiComponent.directionToTarget = direction.normalize();

    // Update line of sight
    if (hasLineOfSight) {
      aiComponent.hasLineOfSight = true;
      aiComponent.lastKnownTargetPosition = targetPosition.clone();
      aiComponent.lastSeenTime = performance.now();
      aiComponent.seekingTime = 0;
    } else {
      aiComponent.hasLineOfSight = false;
    }

    // Update range checks
    aiComponent.isTargetInAggroRange =
      aiComponent.distanceToTarget <= aiComponent.params.aggroRange;
    aiComponent.isTargetInAttackRange =
      aiComponent.distanceToTarget <= aiComponent.params.attackRange;

    // Update alert level based on proximity and line of sight
    const maxAlert = 1.0;
    const minAlert = 0.0;

    if (hasLineOfSight && aiComponent.isTargetInAggroRange) {
      // Fully alert when can see target in aggro range
      aiComponent.alertLevel = maxAlert;
    } else if (aiComponent.isTargetInAggroRange) {
      // Partially alert when target nearby but no line of sight
      aiComponent.alertLevel = Math.max(0.5, aiComponent.alertLevel);
    } else {
      // Gradually reduce alert level when target is far
      aiComponent.alertLevel = Math.max(minAlert, aiComponent.alertLevel - 0.1);
    }
  }

  /**
   * Update seeking behavior
   */
  static updateSeeking(aiComponent: EnemyAIComponent, deltaTime: number): void {
    if (!aiComponent.hasLineOfSight && aiComponent.isPursuing) {
      aiComponent.seekingTime += deltaTime;

      // Stop seeking after duration expires
      if (aiComponent.seekingTime >= aiComponent.params.seekDuration) {
        aiComponent.isPursuing = false;
        aiComponent.targetId = null;
        aiComponent.lastKnownTargetPosition = null;
        aiComponent.alertLevel = Math.max(0, aiComponent.alertLevel - 0.5);
      }
    }
  }

  /**
   * Check if enemy should become aggressive
   */
  static shouldBecomeAggressive(aiComponent: EnemyAIComponent): boolean {
    return (
      aiComponent.isTargetInAggroRange &&
      (aiComponent.hasLineOfSight || aiComponent.alertLevel > 0.3)
    );
  }

  /**
   * Check if enemy can attack
   */
  static canAttack(aiComponent: EnemyAIComponent): boolean {
    return (
      aiComponent.isTargetInAttackRange &&
      aiComponent.hasLineOfSight &&
      aiComponent.targetId !== null
    );
  }

  /**
   * Get movement target position
   */
  static getMovementTarget(aiComponent: EnemyAIComponent): Vector3 | null {
    if (aiComponent.hasLineOfSight && aiComponent.directionToTarget) {
      // Move directly towards visible target
      return aiComponent.lastKnownTargetPosition;
    } else if (aiComponent.isPursuing && aiComponent.lastKnownTargetPosition) {
      // Move towards last known position
      return aiComponent.lastKnownTargetPosition;
    }

    return null;
  }

  /**
   * Reset AI state (for respawn, etc.)
   */
  static reset(aiComponent: EnemyAIComponent): void {
    aiComponent.targetId = null;
    aiComponent.lastKnownTargetPosition = null;
    aiComponent.lastSeenTime = 0;
    aiComponent.hasLineOfSight = false;
    aiComponent.distanceToTarget = Number.MAX_VALUE;
    aiComponent.isTargetInAggroRange = false;
    aiComponent.isTargetInAttackRange = false;
    aiComponent.directionToTarget = null;
    aiComponent.alertLevel = 0;
    aiComponent.seekingTime = 0;
    aiComponent.isPursuing = false;
  }

  /**
   * Set behavior flag
   */
  static setBehaviorFlag(
    aiComponent: EnemyAIComponent,
    flag: keyof EnemyAIComponent['behaviorFlags'],
    value: boolean
  ): void {
    aiComponent.behaviorFlags[flag] = value;
  }

  /**
   * Check behavior flag
   */
  static hasBehaviorFlag(
    aiComponent: EnemyAIComponent,
    flag: keyof EnemyAIComponent['behaviorFlags']
  ): boolean {
    return aiComponent.behaviorFlags[flag] === true;
  }

  /**
   * Calculate optimal attack timing
   */
  static getAttackTiming(aiComponent: EnemyAIComponent): {
    shouldStartAttack: boolean;
    timeUntilNextAttack: number;
  } {
    const now = performance.now();
    const timeSinceLastSeen = (now - aiComponent.lastSeenTime) / 1000;

    return {
      shouldStartAttack: aiComponent.canAttack && timeSinceLastSeen < 0.5,
      timeUntilNextAttack: Math.max(0, aiComponent.params.attackCooldown - timeSinceLastSeen),
    };
  }
}
