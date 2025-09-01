import { Vector3 } from '@babylonjs/core';
import type { Entity, System, Transform } from '@doom-like/game-logic';
import type {
  EnemyAIComponent,
  EnemyIdentityComponent,
  EnemyStateComponent,
  EnemyStatsComponent,
} from '../components';
import { EnemyAIUtils, EnemyStateUtils, EnemyStatsUtils } from '../components';
import { EnemyState } from '../types';

/**
 * Damage event for enemy attacks
 */
export interface EnemyDamageEvent {
  sourceEntityId: string;
  targetEntityId: string;
  damage: number;
  damageType: 'melee' | 'ranged';
  position: Vector3;
  timestamp: number;
}

/**
 * EnemyCombatSystem - Manages enemy combat behavior
 *
 * Responsibilities:
 * - Melee attack execution and damage dealing
 * - Attack timing and cooldown management
 * - Combat state management (hurt/death transitions)
 * - Damage event generation for external systems
 * - Combat statistics and balancing
 */
export class EnemyCombatSystem implements System {
  private playerEntityId: string | null = null;
  private cachedPlayerEntity: Entity | null = null;
  private damageEvents: EnemyDamageEvent[] = [];

  /**
   * Set the player entity ID for combat targeting
   */
  setPlayer(playerEntityId: string): void {
    this.playerEntityId = playerEntityId;
    this.cachedPlayerEntity = null; // Invalidate cache
  }

  /**
   * Update all enemy combat behavior
   */
  update(entities: Entity[], deltaTime: number): void {
    const currentTime = performance.now();

    // Clear old damage events
    this.damageEvents = [];

    // Find player entity (with caching for performance)
    let playerEntity = this.cachedPlayerEntity;
    if (!playerEntity && this.playerEntityId) {
      playerEntity = entities.find((e) => e.id === this.playerEntityId) || null;
      this.cachedPlayerEntity = playerEntity;
    }

    // Update all enemies
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        this.updateEnemyCombat(entity, playerEntity || null, deltaTime, currentTime);
      }
    }

    // Process any damage events
    this.processDamageEvents(entities);
  }

  /**
   * Check if entity is a combat-capable enemy
   */
  private isEnemyEntity(entity: Entity): boolean {
    return (
      entity.components.has('enemyIdentity') &&
      entity.components.has('enemyStats') &&
      entity.components.has('enemyState') &&
      entity.components.has('enemyAI')
    );
  }

  /**
   * Update individual enemy combat behavior
   */
  private updateEnemyCombat(
    entity: Entity,
    playerEntity: Entity | null,
    deltaTime: number,
    currentTime: number
  ): void {
    const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const stats = entity.components.get('enemyStats') as EnemyStatsComponent;
    const stateComponent = entity.components.get('enemyState') as EnemyStateComponent;
    const aiComponent = entity.components.get('enemyAI') as EnemyAIComponent;

    if (!identity?.isAlive) return;

    // Update invulnerability timer
    EnemyStatsUtils.updateInvulnerability(stats, deltaTime);

    // Check for death condition
    if (EnemyStatsUtils.isDead(stats) && stateComponent.currentState !== EnemyState.DEATH) {
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.DEATH, currentTime);
      console.log(`[COMBAT] ${identity.instanceId} died`);
      return;
    }

    // Handle combat based on current state
    const currentState = stateComponent.currentState;

    if (currentState === EnemyState.ATTACK && playerEntity) {
      this.handleAttackExecution(entity, playerEntity, aiComponent, currentTime);
    }

    // Handle regeneration if applicable
    if (stats.healthRegenRate > 0 && currentState !== EnemyState.DEATH) {
      EnemyStatsUtils.applyRegeneration(stats, deltaTime);
    }
  }

  /**
   * Handle attack execution logic
   */
  private handleAttackExecution(
    attackerEntity: Entity,
    playerEntity: Entity,
    aiComponent: EnemyAIComponent,
    currentTime: number
  ): void {
    const attackTiming = EnemyAIUtils.getAttackTiming(aiComponent);

    if (!attackTiming.shouldStartAttack) return;

    const attackerStats = attackerEntity.components.get('enemyStats') as EnemyStatsComponent;
    const attackerIdentity = attackerEntity.components.get(
      'enemyIdentity'
    ) as EnemyIdentityComponent;
    const attackerTransform = attackerEntity.components.get('transform') as Transform;

    if (!attackerTransform) return;

    const playerTransform = playerEntity.components.get('transform') as Transform;
    if (!playerTransform) return;

    const attackerPos = new Vector3(attackerTransform.x, attackerTransform.y, attackerTransform.z);
    const playerPos = new Vector3(playerTransform.x, playerTransform.y, playerTransform.z);

    // Verify attack range
    const distance = Vector3.Distance(attackerPos, playerPos);
    if (distance > aiComponent.params.attackRange + 0.2) {
      // Small tolerance
      console.log(
        `[COMBAT] ${attackerIdentity.instanceId} attack out of range: ${distance.toFixed(2)}m`
      );
      return;
    }

    // Create damage event
    const damage = EnemyStatsUtils.getActualDamage(attackerStats);
    const damageEvent: EnemyDamageEvent = {
      sourceEntityId: attackerEntity.id,
      targetEntityId: playerEntity.id,
      damage,
      damageType: 'melee',
      position: attackerPos.clone(),
      timestamp: currentTime,
    };

    this.damageEvents.push(damageEvent);

    // Record attack time for proper cooldown enforcement
    EnemyAIUtils.recordAttack(aiComponent);

    console.log(`[COMBAT] ${attackerIdentity.instanceId} dealt ${damage} melee damage to player`);
  }

  /**
   * Process all damage events
   */
  private processDamageEvents(entities: Entity[]): void {
    for (const event of this.damageEvents) {
      const targetEntity = entities.find((e) => e.id === event.targetEntityId);
      if (!targetEntity) continue;

      // For now, just log player damage events
      // Real implementation would apply damage to player health system
      if (event.targetEntityId === this.playerEntityId) {
        console.log(
          `[COMBAT] Player took ${event.damage} ${event.damageType} damage from ${event.sourceEntityId}`
        );
      }
    }
  }

  /**
   * Apply damage to an enemy (called by external systems)
   */
  damageEnemy(
    entities: Entity[],
    targetEntityId: string,
    damage: number,
    damageSource = 'unknown'
  ): boolean {
    const targetEntity = entities.find((e) => e.id === targetEntityId);
    if (!targetEntity || !this.isEnemyEntity(targetEntity)) {
      return false;
    }

    const identity = targetEntity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const stats = targetEntity.components.get('enemyStats') as EnemyStatsComponent;
    const stateComponent = targetEntity.components.get('enemyState') as EnemyStateComponent;

    if (!identity?.isAlive || EnemyStatsUtils.isDead(stats)) {
      return false;
    }

    // Apply damage
    const actualDamage = EnemyStatsUtils.takeDamage(stats, damage);

    if (actualDamage > 0) {
      console.log(
        `[COMBAT] ${identity.instanceId} took ${actualDamage} damage from ${damageSource} (${stats.currentHealth}/${stats.maxHealth} HP)`
      );

      // Transition to HURT state if not already dead
      if (!EnemyStatsUtils.isDead(stats) && stateComponent.currentState !== EnemyState.HURT) {
        EnemyStateUtils.transitionTo(stateComponent, EnemyState.HURT);

        // Set brief invulnerability
        EnemyStatsUtils.setInvulnerable(stats, 0.2);
      }

      return true;
    }

    return false;
  }

  /**
   * Heal an enemy (useful for testing or special abilities)
   */
  healEnemy(entities: Entity[], targetEntityId: string, healAmount: number): boolean {
    const targetEntity = entities.find((e) => e.id === targetEntityId);
    if (!targetEntity || !this.isEnemyEntity(targetEntity)) {
      return false;
    }

    const identity = targetEntity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const stats = targetEntity.components.get('enemyStats') as EnemyStatsComponent;

    if (!identity?.isAlive || EnemyStatsUtils.isDead(stats)) {
      return false;
    }

    const actualHealing = EnemyStatsUtils.heal(stats, healAmount);

    if (actualHealing > 0) {
      console.log(
        `[COMBAT] ${identity.instanceId} healed ${actualHealing} HP (${stats.currentHealth}/${stats.maxHealth})`
      );
      return true;
    }

    return false;
  }

  /**
   * Get latest damage events (for external systems)
   */
  getDamageEvents(): EnemyDamageEvent[] {
    return [...this.damageEvents];
  }

  /**
   * Get combat statistics
   */
  getStats(entities: Entity[]): {
    aliveEnemies: number;
    deadEnemies: number;
    totalDamageDealt: number;
    averageHealth: number;
    attackingEnemies: number;
  } {
    let aliveCount = 0;
    let deadCount = 0;
    let totalHealth = 0;
    let totalMaxHealth = 0;
    let attackingCount = 0;

    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
        const stats = entity.components.get('enemyStats') as EnemyStatsComponent;
        const stateComponent = entity.components.get('enemyState') as EnemyStateComponent;

        if (identity?.isAlive && !EnemyStatsUtils.isDead(stats)) {
          aliveCount++;
          totalHealth += stats.currentHealth;
          totalMaxHealth += stats.maxHealth;

          if (stateComponent.currentState === EnemyState.ATTACK) {
            attackingCount++;
          }
        } else {
          deadCount++;
        }
      }
    }

    return {
      aliveEnemies: aliveCount,
      deadEnemies: deadCount,
      totalDamageDealt: this.damageEvents.reduce((sum, event) => sum + event.damage, 0),
      averageHealth: totalMaxHealth > 0 ? totalHealth / totalMaxHealth : 0,
      attackingEnemies: attackingCount,
    };
  }
}
