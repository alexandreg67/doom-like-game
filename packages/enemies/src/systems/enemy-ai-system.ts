import { Vector3 } from '@babylonjs/core';
import type { Entity, System, Transform } from '@doom-like/game-logic';
import type { EnemyAIComponent, EnemyIdentityComponent, EnemyStateComponent } from '../components';
import { EnemyAIUtils, EnemyStateUtils } from '../components';
import { EnemyState } from '../types';

/**
 * EnemyAISystem - Manages enemy AI behavior and FSM transitions
 *
 * Responsibilities:
 * - Target detection and tracking
 * - FSM state transitions based on game context
 * - AI decision making for each enemy type
 * - Timer management (seek duration, attack cooldowns)
 */
export class EnemyAISystem implements System {
  private playerEntityId: string | null = null;
  private cachedPlayerEntity: Entity | null = null;

  /**
   * Set the player entity ID for enemy targeting
   */
  setPlayer(playerEntityId: string): void {
    this.playerEntityId = playerEntityId;
    this.cachedPlayerEntity = null; // Invalidate cache
  }

  /**
   * Update all enemy AI behavior
   */
  update(entities: Entity[], deltaTime: number): void {
    const currentTime = performance.now();

    // Find player entity (with caching for performance)
    let playerEntity = this.cachedPlayerEntity;
    if (!playerEntity && this.playerEntityId) {
      playerEntity = entities.find((e) => e.id === this.playerEntityId) || null;
      this.cachedPlayerEntity = playerEntity;
    }

    if (!playerEntity) return;

    const playerTransform = playerEntity.components.get('transform') as Transform;
    if (!playerTransform) return;

    const playerPosition = new Vector3(playerTransform.x, playerTransform.y, playerTransform.z);

    // Update all enemies
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        this.updateEnemyAI(entity, playerPosition, deltaTime, currentTime);
      }
    }
  }

  /**
   * Check if entity is an enemy
   */
  private isEnemyEntity(entity: Entity): boolean {
    return (
      entity.components.has('enemyIdentity') &&
      entity.components.has('enemyAI') &&
      entity.components.has('enemyState')
    );
  }

  /**
   * Update individual enemy AI
   */
  private updateEnemyAI(
    entity: Entity,
    playerPosition: Vector3,
    deltaTime: number,
    currentTime: number
  ): void {
    const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const aiComponent = entity.components.get('enemyAI') as EnemyAIComponent;
    const stateComponent = entity.components.get('enemyState') as EnemyStateComponent;
    const transform = entity.components.get('transform') as Transform;

    if (!identity?.isAlive || !transform) return;

    const enemyPosition = new Vector3(transform.x, transform.y, transform.z);

    // Update state timer
    EnemyStateUtils.updateState(stateComponent, deltaTime, currentTime);

    // Update target information
    const hasLineOfSight = this.checkLineOfSight(enemyPosition, playerPosition);
    EnemyAIUtils.updateTargetInfo(aiComponent, playerPosition, enemyPosition, hasLineOfSight);

    // Update seeking behavior
    EnemyAIUtils.updateSeeking(aiComponent, deltaTime);

    // FSM Logic based on current state
    this.processFSMLogic(entity, aiComponent, stateComponent, currentTime);
  }

  /**
   * Process FSM state transitions and behavior
   */
  private processFSMLogic(
    entity: Entity,
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    const currentState = stateComponent.currentState;

    switch (currentState) {
      case EnemyState.IDLE:
        this.handleIdleState(aiComponent, stateComponent, currentTime);
        break;

      case EnemyState.SEEKING:
        this.handleSeekingState(aiComponent, stateComponent, currentTime);
        break;

      case EnemyState.CHASE:
        this.handleChaseState(aiComponent, stateComponent, currentTime);
        break;

      case EnemyState.ATTACK:
        this.handleAttackState(entity, aiComponent, stateComponent, currentTime);
        break;

      case EnemyState.HURT:
        this.handleHurtState(aiComponent, stateComponent, currentTime);
        break;

      case EnemyState.DEATH:
        this.handleDeathState(entity, stateComponent);
        break;
    }
  }

  /**
   * Handle IDLE state behavior
   */
  private handleIdleState(
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    // Check for player in aggro range
    if (EnemyAIUtils.shouldBecomeAggressive(aiComponent)) {
      // Set player as target
      EnemyAIUtils.setTarget(
        aiComponent,
        this.playerEntityId,
        aiComponent.lastKnownTargetPosition || undefined
      );

      // Transition to SEEKING
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.SEEKING, currentTime);
    }
  }

  /**
   * Handle SEEKING state behavior
   */
  private handleSeekingState(
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    if (!aiComponent.isPursuing) {
      // Lost target, return to idle
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.IDLE, currentTime);
      return;
    }

    // If we can see target, go to chase
    if (aiComponent.hasLineOfSight) {
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE, currentTime);
      return;
    }

    // Continue seeking at last known position
    // Movement system will handle actual movement
  }

  /**
   * Handle CHASE state behavior
   */
  private handleChaseState(
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    if (!aiComponent.isPursuing || !aiComponent.isTargetInAggroRange) {
      // Lost target or out of range
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.SEEKING, currentTime);
      return;
    }

    // Check if in attack range
    if (EnemyAIUtils.canAttack(aiComponent)) {
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK, currentTime);
      return;
    }

    // Continue chasing - movement system handles movement
  }

  /**
   * Handle ATTACK state behavior
   */
  private handleAttackState(
    entity: Entity,
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    const attackTiming = EnemyAIUtils.getAttackTiming(aiComponent);

    // Check if we should start attacking
    if (attackTiming.shouldStartAttack) {
      // Trigger attack - combat system will handle damage
      const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
      console.log(`[ENEMY_AI] ${identity.instanceId} attacking!`);

      // Schedule return to chase after attack animation
      EnemyStateUtils.scheduleTransition(stateComponent, EnemyState.CHASE, 0.5);
    } else if (!EnemyAIUtils.canAttack(aiComponent)) {
      // Target moved out of range
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE, currentTime);
    }
  }

  /**
   * Handle HURT state behavior
   */
  private handleHurtState(
    aiComponent: EnemyAIComponent,
    stateComponent: EnemyStateComponent,
    currentTime: number
  ): void {
    // Hurt state has fixed duration, wait for transition timer
    if (!stateComponent.nextState && stateComponent.timeInState > aiComponent.params.hurtDuration) {
      // Return to appropriate state based on target status
      if (EnemyAIUtils.canAttack(aiComponent)) {
        EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK, currentTime);
      } else if (aiComponent.isTargetInAggroRange) {
        EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE, currentTime);
      } else {
        EnemyStateUtils.transitionTo(stateComponent, EnemyState.IDLE, currentTime);
      }
    }
  }

  /**
   * Handle DEATH state behavior
   */
  private handleDeathState(entity: Entity, stateComponent: EnemyStateComponent): void {
    // Mark entity for cleanup after death animation
    if (stateComponent.timeInState > 2.0) {
      const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
      identity.isAlive = false;

      console.log(`[ENEMY_AI] ${identity.instanceId} marked for cleanup`);
    }
  }

  /**
   * INTENTIONAL LIMITATION: Simplified line of sight check
   *
   * Current implementation only checks distance for MVP functionality.
   * This is acceptable for initial gameplay but will lead to enemies
   * seeing through walls.
   *
   * TODO for production:
   * - Implement proper raycasting against map geometry
   * - Add support for partial occlusion (smoke, darkness)
   * - Consider performance optimizations (spatial partitioning, caching)
   *
   * @param enemyPos Enemy world position
   * @param playerPos Player world position
   * @returns true if enemy has line of sight to player
   */
  private checkLineOfSight(enemyPos: Vector3, playerPos: Vector3): boolean {
    const distance = Vector3.Distance(enemyPos, playerPos);

    // MVP implementation: distance-only check
    return distance <= 50; // Maximum sight range (world units)
  }

  /**
   * Get AI system statistics
   */
  getStats(): {
    activeEnemies: number;
    stateDistribution: Record<EnemyState, number>;
  } {
    // This would be populated during update loop
    return {
      activeEnemies: 0,
      stateDistribution: {
        [EnemyState.IDLE]: 0,
        [EnemyState.SEEKING]: 0,
        [EnemyState.CHASE]: 0,
        [EnemyState.ATTACK]: 0,
        [EnemyState.HURT]: 0,
        [EnemyState.DEATH]: 0,
      },
    };
  }
}
