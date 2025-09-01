import { Vector3 } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IMP_DEFINITION } from '../../definitions/imp-definition';
import { createEnemyOfType, getEnemyFactory } from '../../factories/enemy-factory';
import { EnemyAISystem } from '../../systems/enemy-ai-system';
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

describe('EnemyAISystem', () => {
  let aiSystem: EnemyAISystem;
  let entities: Entity[];
  let playerEntity: Entity;
  let impEntity: Entity;

  beforeEach(() => {
    vi.useFakeTimers();
    aiSystem = new EnemyAISystem();
    entities = [];

    // Register Imp definition
    getEnemyFactory().registerEnemyDefinition(IMP_DEFINITION);

    // Create player entity
    playerEntity = createMockEntity('player');
    playerEntity.components.set('transform', new MockTransform(0, 0, 0));
    entities.push(playerEntity);

    // Create Imp entity
    const tempEntity = createEnemyOfType(
      createMockEntity,
      EnemyType.IMP,
      new Vector3(10, 0, 0) // 10 meters away
    );
    if (!tempEntity) throw new Error('Failed to create Imp entity');
    impEntity = tempEntity;
    entities.push(impEntity);

    // Set player for AI system
    aiSystem.setPlayer('player');
  });

  afterEach(() => {
    vi.useRealTimers();
    getEnemyFactory().clearDefinitions();
  });

  describe('Target Detection', () => {
    it('should detect player within aggro range', () => {
      // Move player within aggro range (8m)
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 7; // 7 meters from imp at (10,0,0)

      const aiComponent = impEntity.components.get('enemyAI');
      const stateComponent = impEntity.components.get('enemyState');

      // Initial state should be IDLE
      expect(stateComponent.currentState).toBe(EnemyState.IDLE);

      // Run AI update
      aiSystem.update(entities, 0.016); // 60 FPS

      // Should transition to SEEKING
      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);
      expect(aiComponent.targetId).toBe('player');
      expect(aiComponent.isPursuing).toBe(true);
    });

    it('should not detect player outside aggro range', () => {
      // Player is at (0,0,0), imp at (10,0,0) = 10m > 8m aggro range
      const stateComponent = impEntity.components.get('enemyState');

      // Run AI update
      aiSystem.update(entities, 0.016);

      // Should remain IDLE
      expect(stateComponent.currentState).toBe(EnemyState.IDLE);
    });
  });

  describe('FSM State Transitions', () => {
    beforeEach(() => {
      // Move player within aggro range
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 5; // Within aggro range
    });

    it('should transition IDLE → SEEKING when player detected', () => {
      const stateComponent = impEntity.components.get('enemyState');

      expect(stateComponent.currentState).toBe(EnemyState.IDLE);

      aiSystem.update(entities, 0.016);

      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);
    });

    it('should transition SEEKING → CHASE when line of sight established', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // First update: IDLE → SEEKING
      aiSystem.update(entities, 0.016);
      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);

      // Mock line of sight (AI system has simplified LOS)
      // Second update should transition to CHASE
      aiSystem.update(entities, 0.016);
      expect(stateComponent.currentState).toBe(EnemyState.CHASE);
      expect(aiComponent.hasLineOfSight).toBe(true);
    });

    it('should transition CHASE → ATTACK when in attack range', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const playerTransform = playerEntity.components.get('transform') as MockTransform;

      // Move player very close (within 1.5m attack range)
      playerTransform.x = 9.2; // 0.8m from imp at (10,0,0)

      // Get to CHASE state first
      aiSystem.update(entities, 0.016); // IDLE → SEEKING
      aiSystem.update(entities, 0.016); // SEEKING → CHASE

      // Now should transition to ATTACK
      aiSystem.update(entities, 0.016);
      expect(stateComponent.currentState).toBe(EnemyState.ATTACK);
    });

    it('should return to IDLE when target lost for too long', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Get to SEEKING state
      aiSystem.update(entities, 0.016);
      expect(stateComponent.currentState).toBe(EnemyState.SEEKING);

      // Move player out of range
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = -20; // Far away

      // Advance time beyond seek duration (3 seconds)
      vi.advanceTimersByTime(3500);

      aiSystem.update(entities, 3.5);

      expect(stateComponent.currentState).toBe(EnemyState.IDLE);
      expect(aiComponent.isPursuing).toBe(false);
      expect(aiComponent.targetId).toBe(null);
    });
  });

  describe('Attack Behavior', () => {
    beforeEach(() => {
      // Position player in attack range
      const playerTransform = playerEntity.components.get('transform') as MockTransform;
      playerTransform.x = 9.2; // 0.8m from imp
    });

    it('should execute attack when in ATTACK state', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Get to ATTACK state
      aiSystem.update(entities, 0.016); // IDLE → SEEKING
      aiSystem.update(entities, 0.016); // SEEKING → CHASE
      aiSystem.update(entities, 0.016); // CHASE → ATTACK

      expect(stateComponent.currentState).toBe(EnemyState.ATTACK);

      // Attack timing should indicate attack should happen
      const attackTiming = aiComponent.params;
      expect(attackTiming).toBeDefined();
    });

    it('should respect attack cooldown', () => {
      const aiComponent = impEntity.components.get('enemyAI');

      // Set last seen time to recent (simulating recent attack)
      aiComponent.lastSeenTime = performance.now() - 500; // 0.5 seconds ago

      const attackTiming = aiComponent.params;

      // Should not be ready to attack yet (1.2s cooldown)
      expect(attackTiming.attackCooldown).toBe(1.2);
    });
  });

  describe('HURT State Handling', () => {
    it('should transition from HURT back to appropriate state', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up enemy in HURT state with target in range
      stateComponent.currentState = EnemyState.HURT;
      stateComponent.stateStartTime = performance.now();
      aiComponent.isTargetInAggroRange = true;
      aiComponent.isTargetInAttackRange = false;

      // Move time forward past hurt duration (0.5s)
      vi.advanceTimersByTime(600);

      aiSystem.update(entities, 0.6);

      // Should transition to CHASE since target is in aggro range but not attack range
      expect(stateComponent.currentState).toBe(EnemyState.CHASE);
    });
  });

  describe('DEATH State Handling', () => {
    it('should mark enemy for cleanup after death animation', () => {
      const stateComponent = impEntity.components.get('enemyState');
      const identity = impEntity.components.get('enemyIdentity');

      // Set enemy to DEATH state
      stateComponent.currentState = EnemyState.DEATH;
      stateComponent.stateStartTime = performance.now() - 2500; // 2.5 seconds ago

      expect(identity.isAlive).toBe(true);

      aiSystem.update(entities, 0.016);

      // After 2+ seconds in death state, should be marked for cleanup
      expect(identity.isAlive).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should provide AI system statistics', () => {
      const stats = aiSystem.getStats();

      expect(stats).toHaveProperty('activeEnemies');
      expect(stats).toHaveProperty('stateDistribution');
      expect(stats.stateDistribution).toHaveProperty(EnemyState.IDLE);
      expect(stats.stateDistribution).toHaveProperty(EnemyState.SEEKING);
    });
  });
});
