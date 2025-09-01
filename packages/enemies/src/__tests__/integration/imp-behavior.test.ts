import { Vector3 } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMP_DEFINITION } from '../../definitions/imp-definition';
import { createEnemyOfType, getEnemyFactory } from '../../factories/enemy-factory';
import { EnemyAISystem, EnemyCombatSystem, EnemyMovementSystem } from '../../systems';
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

/**
 * Integration tests for complete Imp behavior
 * Tests the full enemy lifecycle from idle to death
 */
describe('Imp Behavior Integration', () => {
  let aiSystem: EnemyAISystem;
  let movementSystem: EnemyMovementSystem;
  let combatSystem: EnemyCombatSystem;
  let entities: Entity[];
  let playerEntity: Entity;
  let impEntity: Entity;

  beforeEach(() => {
    vi.useFakeTimers();

    // Initialize all systems
    aiSystem = new EnemyAISystem();
    movementSystem = new EnemyMovementSystem();
    combatSystem = new EnemyCombatSystem();
    entities = [];

    // Register Imp definition
    getEnemyFactory().registerEnemyDefinition(IMP_DEFINITION);

    // Create player entity
    playerEntity = createMockEntity('player');
    playerEntity.components.set('transform', new MockTransform(0, 0, 0));
    entities.push(playerEntity);

    // Create Imp entity at medium distance
    const tempEntity = createEnemyOfType(
      createMockEntity,
      EnemyType.IMP,
      new Vector3(12, 0, 0) // 12 meters away (outside aggro range)
    );
    if (!tempEntity) throw new Error('Failed to create Imp entity');
    impEntity = tempEntity;
    entities.push(impEntity);

    // Configure systems
    aiSystem.setPlayer('player');
    combatSystem.setPlayer('player');
  });

  afterEach(() => {
    vi.useRealTimers();
    getEnemyFactory().clearDefinitions();
  });

  describe('Full Combat Cycle', () => {
    it('should complete a full engage-attack-disengage cycle', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      const impTransform = impEntity.components.get('transform') as MockTransform;

      // Phase 1: Player approaches (outside aggro range)
      expect(stateComponent.currentState).toBe(EnemyState.IDLE);

      updateAllSystems(0.016);
      expect(stateComponent.currentState).toBe(EnemyState.IDLE);

      // Phase 2: Player enters aggro range (8m)
      playerTransform.x = 5; // 7m from imp at (12,0,0)

      updateAllSystems(0.016);
      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);

      // Phase 3: Imp should transition to CHASE with line of sight
      updateAllSystems(0.016);
      expect(stateComponent.currentState).toBe(EnemyState.CHASE);

      // Phase 4: Imp moves towards player
      const initialImpX = impTransform.x;
      updateAllSystems(0.1); // Larger delta for visible movement

      // Should have moved towards player
      expect(impTransform.x).toBeLessThan(initialImpX);

      // Phase 5: Move player into attack range
      playerTransform.x = 11; // 1m from imp (within 1.5m attack range)

      updateAllSystems(0.016);
      expect(stateComponent.currentState).toBe(EnemyState.ATTACK);

      // Phase 6: Attack should execute after cooldown
      vi.advanceTimersByTime(1300); // Past 1.2s cooldown

      updateAllSystems(1.3);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents.length).toBeGreaterThan(0);
      expect(damageEvents[0].damage).toBe(20);

      // Phase 7: Player retreats beyond chase range
      playerTransform.x = -10; // Far away

      updateAllSystems(0.016);
      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);

      // Phase 8: After seek duration, should return to idle
      vi.advanceTimersByTime(3500); // Past 3s seek duration

      updateAllSystems(3.5);
      expect(stateComponent.currentState).toBe(EnemyState.IDLE);
    });

    it('should handle player damage and hurt state correctly', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const stats = impEntity.components.get('enemyStats');

      // Damage the imp while in IDLE state
      combatSystem.damageEnemy(entities, impEntity.id, 30, 'player_weapon');

      updateAllSystems(0.016);

      // Should transition to HURT state
      expect(stateComponent.currentState).toBe(EnemyState.HURT);
      expect(stats.currentHealth).toBe(30); // 60 - 30
      expect(stats.isInvulnerable).toBe(true);

      // Wait for hurt duration to pass (0.5s)
      vi.advanceTimersByTime(600);

      updateAllSystems(0.6);

      // Should transition back to appropriate state
      expect(stateComponent.currentState).not.toBe(EnemyState.HURT);
      expect(stats.isInvulnerable).toBe(false);
    });

    it('should handle death sequence correctly', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const identity = impEntity.components.get('enemyIdentity');
      const stats = impEntity.components.get('enemyStats');

      // Apply lethal damage
      combatSystem.damageEnemy(entities, impEntity.id, 100);

      updateAllSystems(0.016);

      // Should transition to DEATH state
      expect(stateComponent.currentState).toBe(EnemyState.DEATH);
      expect(stats.currentHealth).toBe(0);

      // Enemy should still be "alive" for cleanup purposes
      expect(identity.isAlive).toBe(true);

      // Wait for death animation duration (2s)
      vi.advanceTimersByTime(2500);

      updateAllSystems(2.5);

      // Should be marked for cleanup
      expect(identity.isAlive).toBe(false);
    });
  });

  describe('Movement and Positioning', () => {
    it('should pursue player with correct speed and facing', () => {
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      const impTransform = impEntity.components.get('transform') as MockTransform;
      const movementComponent = impEntity.components.get('enemyMovement');

      // Move player into aggro range
      playerTransform.x = 5;

      // Get imp into chase state
      updateAllSystems(0.016); // IDLE → SEEKING
      updateAllSystems(0.016); // SEEKING → CHASE

      // Check movement towards player
      const initialPos = new Vector3(impTransform.x, impTransform.y, impTransform.z);

      updateAllSystems(0.1);

      const finalPos = new Vector3(impTransform.x, impTransform.y, impTransform.z);
      const movement = finalPos.subtract(initialPos);

      // Should have moved towards player (negative X direction)
      expect(movement.x).toBeLessThan(0);
      expect(movement.length()).toBeGreaterThan(0.01);

      // Speed should be within expected range
      const speed = movement.length() / 0.1;
      expect(speed).toBeLessThanOrEqual(movementComponent.movementSpeed + 0.5);
    });

    it('should stop and face player when in attack range', () => {
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      const movementComponent = impEntity.components.get('enemyMovement');

      // Position player in attack range
      playerTransform.x = 11; // 1m from imp at (12,0,0)

      // Get to attack state
      updateAllSystems(0.016); // IDLE → SEEKING
      updateAllSystems(0.016); // SEEKING → CHASE
      updateAllSystems(0.016); // CHASE → ATTACK

      // Should stop movement
      expect(movementComponent.isMoving).toBe(false);
      expect(movementComponent.velocity.length()).toBeLessThan(0.1);

      // Should face towards player
      const expectedAngle = Math.atan2(-1, 0); // Facing towards (11,0,0) from (12,0,0)
      expect(Math.abs(movementComponent.targetFacingAngle - expectedAngle)).toBeLessThan(0.2);
    });

    it('should handle stuck detection and recovery', () => {
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      const impTransform = impEntity.components.get('transform') as MockTransform;
      const movementComponent = impEntity.components.get('enemyMovement');

      // Move player into range to start chasing
      playerTransform.x = 5;

      // Get into chase state
      updateAllSystems(0.016);
      updateAllSystems(0.016);

      // Simulate being stuck by preventing transform updates
      const stuckX = impTransform.x;

      // Run multiple updates while stuck
      for (let i = 0; i < 12; i++) {
        impTransform.x = stuckX; // Force stuck position
        updateAllSystems(0.1);
      }

      // Should detect stuck condition
      expect(movementComponent.stuckTime).toBeGreaterThan(0);

      // Eventually should trigger unstuck behavior
      if (movementComponent.isStuck) {
        expect(movementComponent.unstuckDirection).toBeTruthy();
        expect(movementComponent.unstuckTime).toBeGreaterThan(0);
      }
    });
  });

  describe('Combat Interactions', () => {
    it('should deal damage with proper timing', () => {
      const playerTransform = playerEntity.components.get('transform') as MockTransform;

      // Position for attack
      playerTransform.x = 11;

      // Get to attack state
      updateAllSystems(0.016);
      updateAllSystems(0.016);
      updateAllSystems(0.016);

      // Wait for attack cooldown
      vi.advanceTimersByTime(1300);

      updateAllSystems(1.3);

      const damageEvents = combatSystem.getDamageEvents();
      expect(damageEvents.length).toBeGreaterThan(0);

      const event = damageEvents[0];
      expect(event.damage).toBe(20);
      expect(event.damageType).toBe('melee');
      expect(event.targetEntityId).toBe('player');
    });

    it('should respect invulnerability after taking damage', () => {
      const stats = impEntity.components.get('enemyStats');

      // Apply damage
      combatSystem.damageEnemy(entities, impEntity.id, 20);
      updateAllSystems(0.016);

      expect(stats.isInvulnerable).toBe(true);

      // Try to apply more damage
      const initialHealth = stats.currentHealth;
      combatSystem.damageEnemy(entities, impEntity.id, 15);

      // Should not take additional damage
      expect(stats.currentHealth).toBe(initialHealth);

      // Wait for invulnerability to expire
      updateAllSystems(0.3);

      expect(stats.isInvulnerable).toBe(false);

      // Now should be able to take damage
      combatSystem.damageEnemy(entities, impEntity.id, 15);
      expect(stats.currentHealth).toBe(initialHealth - 15);
    });
  });

  describe('System Statistics and Performance', () => {
    it('should provide comprehensive system statistics', () => {
      // Set up active scenario
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 5;

      updateAllSystems(0.016);
      updateAllSystems(0.016);

      const aiStats = aiSystem.getStats();
      const movementStats = movementSystem.getStats(entities);
      const combatStats = combatSystem.getStats(entities);

      expect(aiStats).toHaveProperty('activeEnemies');
      expect(aiStats).toHaveProperty('stateDistribution');

      expect(movementStats).toHaveProperty('movingEnemies');
      expect(movementStats).toHaveProperty('averageSpeed');

      expect(combatStats).toHaveProperty('aliveEnemies');
      expect(combatStats.aliveEnemies).toBe(1);
    });

    it('should handle multiple imps without interference', () => {
      // Create second imp
      const tempEntity2 = createEnemyOfType(
        createMockEntity,
        EnemyType.IMP,
        new Vector3(-12, 0, 0)
      );
      if (!tempEntity2) throw new Error('Failed to create second Imp entity');
      const imp2Entity = tempEntity2;
      entities.push(imp2Entity);

      // Move player to trigger both
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 5;

      updateAllSystems(0.016);
      updateAllSystems(0.016);

      const state1 = impEntity.components.get('enemyState');
      const state2 = imp2Entity.components.get('enemyState');

      // Both should be in CHASE state
      expect(state1.currentState).toBe(EnemyState.CHASE);
      expect(state2.currentState).toBe(EnemyState.CHASE);

      const combatStats = combatSystem.getStats(entities);
      expect(combatStats.aliveEnemies).toBe(2);
    });
  });

  /**
   * Helper function to update all systems in correct order
   */
  function updateAllSystems(deltaTime: number): void {
    aiSystem.update(entities, deltaTime);
    movementSystem.update(entities, deltaTime);
    combatSystem.update(entities, deltaTime);
  }
});
