import { Vector3 } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnemyStateUtils } from '../../components';
import { IMP_DEFINITION } from '../../definitions/imp-definition';
import { createEnemyOfType, getEnemyFactory } from '../../factories/enemy-factory';
import { EnemyCombatSystem } from '../../systems/enemy-combat-system';
import { EnemyState, EnemyType } from '../../types';

// Mock entity creation function
const createMockEntity = (id: string): Entity => ({
  id,
  components: new Map(),
});

// Mock Transform class
class MockTransform implements Transform {
  constructor(
    public x: number,
    public y: number,
    public z: number
  ) {}
}

describe('EnemyCombatSystem', () => {
  let combatSystem: EnemyCombatSystem;
  let entities: Entity[];
  let playerEntity: Entity;
  let impEntity: Entity;

  beforeEach(() => {
    combatSystem = new EnemyCombatSystem();
    entities = [];

    // Register Imp definition
    getEnemyFactory().registerEnemyDefinition(IMP_DEFINITION);

    // Create player entity
    playerEntity = createMockEntity('player');
    playerEntity.components.set('transform', new MockTransform(0, 0, 0));
    entities.push(playerEntity);

    // Create Imp entity at attack range
    const tempEntity = createEnemyOfType(
      createMockEntity,
      EnemyType.IMP,
      new Vector3(1.0, 0, 0) // 1 meter from player (within 1.5m attack range)
    );
    if (!tempEntity) throw new Error('Failed to create Imp entity');
    impEntity = tempEntity;
    entities.push(impEntity);

    // Set player for combat system
    combatSystem.setPlayer('player');
  });

  afterEach(() => {
    getEnemyFactory().clearDefinitions();
  });

  describe('Combat State Management', () => {
    it('should handle invulnerability timer', () => {
      const stats = impEntity.components.get('enemyStats');

      // Set enemy as invulnerable
      stats.isInvulnerable = true;
      stats.invulnerabilityTime = 1.0;

      combatSystem.update(entities, 0.3); // 0.3 seconds

      // Should reduce invulnerability time
      expect(stats.invulnerabilityTime).toBe(0.7);
      expect(stats.isInvulnerable).toBe(true);

      combatSystem.update(entities, 0.8); // Another 0.8 seconds (total 1.1)

      // Should remove invulnerability
      expect(stats.invulnerabilityTime).toBe(0);
      expect(stats.isInvulnerable).toBe(false);
    });

    it('should transition to DEATH state when health reaches zero', () => {
      const stats = impEntity.components.get('enemyStats');
      const stateComponent = impEntity.components.get('enemyState');

      // Set health to zero
      stats.currentHealth = 0;

      combatSystem.update(entities, 0.016);

      expect(stateComponent.currentState).toBe(EnemyState.DEATH);
    });

    it('should apply health regeneration when applicable', () => {
      const stats = impEntity.components.get('enemyStats');

      // Set partial health and regen rate
      stats.currentHealth = 30;
      stats.healthRegenRate = 10; // 10 HP per second

      combatSystem.update(entities, 0.5); // 0.5 seconds

      // Should regenerate 5 HP
      expect(stats.currentHealth).toBe(35);
    });

    it('should not regenerate above max health', () => {
      const stats = impEntity.components.get('enemyStats');

      // Set near-max health and regen rate
      stats.currentHealth = 58;
      stats.maxHealth = 60;
      stats.healthRegenRate = 10;

      combatSystem.update(entities, 0.5);

      // Should not exceed max health
      expect(stats.currentHealth).toBe(60);
    });
  });

  describe('Attack Execution', () => {
    beforeEach(() => {
      // Set up enemy in ATTACK state
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK);
      aiComponent.isTargetInAttackRange = true;
      aiComponent.lastSeenTime = performance.now(); // Recent sight time
      aiComponent.params.attackCooldown = 1.2;
    });

    it('should generate damage events when attacking', () => {
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up for immediate attack (no cooldown)
      aiComponent.lastSeenTime = performance.now() - 2000; // 2 seconds ago (past cooldown)

      combatSystem.update(entities, 0.016);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents).toHaveLength(1);

      const event = damageEvents[0];
      expect(event.sourceEntityId).toBe(impEntity.id);
      expect(event.targetEntityId).toBe('player');
      expect(event.damage).toBe(20); // Imp attack damage
      expect(event.damageType).toBe('melee');
    });

    it('should respect attack cooldown', () => {
      const aiComponent = impEntity.components.get('enemyAI');

      // Set recent attack time
      aiComponent.lastSeenTime = performance.now() - 500; // 0.5 seconds ago

      combatSystem.update(entities, 0.016);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents).toHaveLength(0); // Should not attack due to cooldown
    });

    it('should not attack when out of range', () => {
      // Move player out of attack range
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 5; // 5 meters away (> 1.5m attack range)

      const aiComponent = impEntity.components.get('enemyAI');
      aiComponent.lastSeenTime = performance.now() - 2000; // Past cooldown

      combatSystem.update(entities, 0.016);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents).toHaveLength(0);
    });

    it('should apply damage multiplier to attack damage', () => {
      const stats = impEntity.components.get('enemyStats');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set damage multiplier
      stats.damageMultiplier = 1.5;
      aiComponent.lastSeenTime = performance.now() - 2000;

      combatSystem.update(entities, 0.016);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents).toHaveLength(1);
      expect(damageEvents[0].damage).toBe(30); // 20 * 1.5
    });
  });

  describe('Damage Application', () => {
    it('should apply damage to enemy correctly', () => {
      const stats = impEntity.components.get('enemyStats');
      const initialHealth = stats.currentHealth;

      const damaged = combatSystem.damageEnemy(entities, impEntity.id, 25, 'test');

      expect(damaged).toBe(true);
      expect(stats.currentHealth).toBe(initialHealth - 25);
    });

    it('should transition to HURT state when damaged', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const stats = impEntity.components.get('enemyStats');

      // Ensure not already in HURT state
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.IDLE);

      combatSystem.damageEnemy(entities, impEntity.id, 15);

      expect(stateComponent.currentState).toBe(EnemyState.HURT);
      expect(stats.isInvulnerable).toBe(true);
      expect(stats.invulnerabilityTime).toBe(0.2);
    });

    it('should not apply damage when invulnerable', () => {
      const stats = impEntity.components.get('enemyStats');

      // Set invulnerable
      stats.isInvulnerable = true;
      const initialHealth = stats.currentHealth;

      const damaged = combatSystem.damageEnemy(entities, impEntity.id, 25);

      expect(damaged).toBe(false);
      expect(stats.currentHealth).toBe(initialHealth);
    });

    it('should not apply damage to dead enemies', () => {
      const stats = impEntity.components.get('enemyStats');

      // Kill the enemy
      stats.currentHealth = 0;

      const damaged = combatSystem.damageEnemy(entities, impEntity.id, 25);

      expect(damaged).toBe(false);
    });

    it('should not apply negative damage', () => {
      const stats = impEntity.components.get('enemyStats');
      const initialHealth = stats.currentHealth;

      const damaged = combatSystem.damageEnemy(entities, impEntity.id, -10);

      expect(damaged).toBe(false);
      expect(stats.currentHealth).toBe(initialHealth);
    });

    it('should handle damage that would kill enemy', () => {
      const stats = impEntity.components.get('enemyStats');

      // Apply massive damage
      const damaged = combatSystem.damageEnemy(entities, impEntity.id, 1000);

      expect(damaged).toBe(true);
      expect(stats.currentHealth).toBe(0);
    });
  });

  describe('Healing', () => {
    it('should heal enemy correctly', () => {
      const stats = impEntity.components.get('enemyStats');

      // Damage enemy first
      stats.currentHealth = 30;

      const healed = combatSystem.healEnemy(entities, impEntity.id, 20);

      expect(healed).toBe(true);
      expect(stats.currentHealth).toBe(50);
    });

    it('should not heal above max health', () => {
      const stats = impEntity.components.get('enemyStats');

      // Set near max health
      stats.currentHealth = 55;
      stats.maxHealth = 60;

      const healed = combatSystem.healEnemy(entities, impEntity.id, 20);

      expect(healed).toBe(true);
      expect(stats.currentHealth).toBe(60); // Capped at max
    });

    it('should not heal dead enemies', () => {
      const stats = impEntity.components.get('enemyStats');

      // Kill enemy
      stats.currentHealth = 0;

      const healed = combatSystem.healEnemy(entities, impEntity.id, 50);

      expect(healed).toBe(false);
      expect(stats.currentHealth).toBe(0);
    });

    it('should not heal at full health', () => {
      const stats = impEntity.components.get('enemyStats');

      // Enemy at full health
      expect(stats.currentHealth).toBe(stats.maxHealth);

      const healed = combatSystem.healEnemy(entities, impEntity.id, 20);

      expect(healed).toBe(false);
    });
  });

  describe('Combat Statistics', () => {
    it('should provide accurate combat statistics', () => {
      // Create second enemy
      const tempEntity2 = createEnemyOfType(createMockEntity, EnemyType.IMP, new Vector3(5, 0, 0));
      if (!tempEntity2) throw new Error('Failed to create second Imp entity');
      const impEntity2 = tempEntity2;
      entities.push(impEntity2);

      // Damage one enemy
      combatSystem.damageEnemy(entities, impEntity.id, 30);

      // Kill second enemy
      combatSystem.damageEnemy(entities, impEntity2.id, 100);

      const stats = combatSystem.getStats(entities);

      expect(stats.aliveEnemies).toBe(1);
      expect(stats.deadEnemies).toBe(1);
      expect(stats.averageHealth).toBeLessThan(1); // Low average due to one being low health
    });

    it('should track attacking enemies', () => {
      const stateComponent = impEntity.components.get('enemyState');

      // Set enemy to ATTACK state
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK);

      const stats = combatSystem.getStats(entities);

      expect(stats.attackingEnemies).toBe(1);
    });

    it('should handle empty entity list', () => {
      const stats = combatSystem.getStats([]);

      expect(stats.aliveEnemies).toBe(0);
      expect(stats.deadEnemies).toBe(0);
      expect(stats.totalDamageDealt).toBe(0);
      expect(stats.averageHealth).toBe(0);
      expect(stats.attackingEnemies).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing player entity gracefully', () => {
      combatSystem.setPlayer('nonexistent');

      expect(() => {
        combatSystem.update(entities, 0.016);
      }).not.toThrow();
    });

    it('should handle entities without required components', () => {
      const invalidEntity = createMockEntity('invalid');
      entities.push(invalidEntity);

      expect(() => {
        combatSystem.update(entities, 0.016);
      }).not.toThrow();
    });

    it('should handle damage to nonexistent entity', () => {
      const damaged = combatSystem.damageEnemy(entities, 'nonexistent', 25);
      expect(damaged).toBe(false);
    });
  });
});
