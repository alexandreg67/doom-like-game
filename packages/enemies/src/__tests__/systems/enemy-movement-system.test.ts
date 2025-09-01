import { Vector3 } from '@babylonjs/core';
import type { Entity, Transform } from '@doom-like/game-logic';
import { beforeEach, describe, expect, it } from 'vitest';
import { EnemyStateUtils } from '../../components';
import { IMP_DEFINITION } from '../../definitions/imp-definition';
import { createEnemyOfType, getEnemyFactory } from '../../factories/enemy-factory';
import { EnemyMovementSystem } from '../../systems/enemy-movement-system';
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

describe('EnemyMovementSystem', () => {
  let movementSystem: EnemyMovementSystem;
  let entities: Entity[];
  let impEntity: Entity;

  beforeEach(() => {
    movementSystem = new EnemyMovementSystem();
    entities = [];

    // Register Imp definition
    getEnemyFactory().registerEnemyDefinition(IMP_DEFINITION);

    // Create Imp entity
    const tempEntity = createEnemyOfType(createMockEntity, EnemyType.IMP, new Vector3(0, 0, 0));
    if (!tempEntity) throw new Error('Failed to create Imp entity');
    impEntity = tempEntity;
    entities.push(impEntity);
  });

  afterEach(() => {
    getEnemyFactory().clearDefinitions();
  });

  describe('Movement Target Setting', () => {
    it('should stop movement when in IDLE state', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');

      // Ensure IDLE state
      stateComponent.currentState = EnemyState.IDLE;

      // Set some initial movement
      movementComponent.isMoving = true;
      movementComponent.targetPosition = new Vector3(10, 0, 0);

      movementSystem.update(entities, 0.016);

      expect(movementComponent.isMoving).toBe(false);
      expect(movementComponent.targetPosition).toBe(null);
    });

    it('should move towards target in CHASE state', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');
      const transform = impEntity.components.get('transform') as MockTransform;

      // Set up CHASE state with target
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(10, 0, 0);
      aiComponent.hasLineOfSight = true;

      const initialX = transform.x;

      movementSystem.update(entities, 0.1); // Larger delta for visible movement

      // Should have moved towards target
      expect(transform.x).toBeGreaterThan(initialX);
      expect(movementComponent.isMoving).toBe(true);
    });

    it('should stop movement during ATTACK state when in range', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up ATTACK state with target in range
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK);
      aiComponent.isTargetInAttackRange = true;
      aiComponent.directionToTarget = new Vector3(1, 0, 0).normalize();

      movementSystem.update(entities, 0.016);

      expect(movementComponent.isMoving).toBe(false);
      expect(movementComponent.velocity.length()).toBe(0);
    });

    it('should stop movement during HURT state', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');

      // Set initial movement
      movementComponent.isMoving = true;
      movementComponent.velocity = new Vector3(2, 0, 0);

      // Transition to HURT state
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.HURT);

      movementSystem.update(entities, 0.016);

      expect(movementComponent.isMoving).toBe(false);
    });
  });

  describe('Movement Physics', () => {
    it('should apply smooth acceleration towards target', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');
      const _transform = impEntity.components.get('transform') as MockTransform;

      // Set up movement scenario
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(20, 0, 0);
      aiComponent.hasLineOfSight = true;

      const initialVelocity = movementComponent.velocity.length();

      movementSystem.update(entities, 0.1);

      const finalVelocity = movementComponent.velocity.length();

      // Velocity should increase due to acceleration
      expect(finalVelocity).toBeGreaterThan(initialVelocity);
    });

    it('should respect maximum movement speed', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up movement scenario
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(100, 0, 0); // Far away
      aiComponent.hasLineOfSight = true;

      // Run several updates to reach max speed
      for (let i = 0; i < 10; i++) {
        movementSystem.update(entities, 0.1);
      }

      const finalSpeed = movementComponent.velocity.length();
      const maxSpeed = movementComponent.movementSpeed;

      // Should not exceed max speed (with small tolerance for floating point)
      expect(finalSpeed).toBeLessThanOrEqual(maxSpeed + 0.1);
    });

    it('should stop near target position', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');
      const _transform = impEntity.components.get('transform') as MockTransform;

      // Set up movement to very close target
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(0.3, 0, 0); // Very close
      aiComponent.hasLineOfSight = true;

      movementSystem.update(entities, 0.016);

      // Should stop moving when very close
      expect(movementComponent.isMoving).toBe(false);
      expect(movementComponent.targetPosition).toBe(null);
    });
  });

  describe('Stuck Detection and Recovery', () => {
    it('should detect when enemy is stuck', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');
      const transform = impEntity.components.get('transform') as MockTransform;

      // Set up movement scenario
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(10, 0, 0);
      aiComponent.hasLineOfSight = true;

      // Don't actually move the transform (simulating collision/stuck)
      const originalX = transform.x;

      // Run multiple updates without position change
      for (let i = 0; i < 10; i++) {
        transform.x = originalX; // Force no movement
        movementSystem.update(entities, 0.1);
      }

      // After enough time, should detect stuck condition
      expect(movementComponent.stuckTime).toBeGreaterThan(0);
    });

    it('should apply unstuck behavior when stuck', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const transform = impEntity.components.get('transform') as MockTransform;

      // Manually set stuck state
      movementComponent.isStuck = true;
      movementComponent.unstuckTime = 1.0;
      movementComponent.unstuckDirection = new Vector3(1, 0, 0);

      const initialX = transform.x;

      movementSystem.update(entities, 0.1);

      // Should apply unstuck movement
      expect(Math.abs(transform.x - initialX)).toBeGreaterThan(0.01);
    });
  });

  describe('Collision and Boundaries', () => {
    it('should handle world boundary collisions', () => {
      const transform = impEntity.components.get('transform') as MockTransform;
      const movementComponent = impEntity.components.get('enemyMovement');

      // Position near world boundary
      transform.x = 49.8; // Near 50 unit boundary
      movementComponent.velocity = new Vector3(2, 0, 0); // Moving toward boundary

      const initialVelocityX = movementComponent.velocity.x;

      movementSystem.update(entities, 0.1);

      // Velocity should be reversed or dampened due to boundary collision
      expect(movementComponent.velocity.x).not.toBe(initialVelocityX);
    });
  });

  describe('Facing Direction', () => {
    it('should rotate towards movement direction', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up movement towards target
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.CHASE);
      aiComponent.lastKnownTargetPosition = new Vector3(10, 0, 10);
      aiComponent.hasLineOfSight = true;

      const initialFacing = movementComponent.facingAngle;

      movementSystem.update(entities, 0.1);

      // Facing angle should change towards target direction
      expect(movementComponent.targetFacingAngle).not.toBe(initialFacing);
    });

    it('should face target during ATTACK state', () => {
      const movementComponent = impEntity.components.get('enemyMovement');
      const stateComponent = impEntity.components.get('enemyState');
      const aiComponent = impEntity.components.get('enemyAI');

      // Set up ATTACK state
      EnemyStateUtils.transitionTo(stateComponent, EnemyState.ATTACK);
      aiComponent.isTargetInAttackRange = true;
      aiComponent.directionToTarget = new Vector3(1, 0, 1).normalize();

      movementSystem.update(entities, 0.016);

      // Should set facing angle towards target
      const expectedAngle = Math.atan2(1, 1); // 45 degrees
      expect(Math.abs(movementComponent.targetFacingAngle - expectedAngle)).toBeLessThan(0.1);
    });
  });

  describe('System Control', () => {
    it('should stop all enemy movement when requested', () => {
      const movementComponent = impEntity.components.get('enemyMovement');

      // Set initial movement
      movementComponent.isMoving = true;
      movementComponent.velocity = new Vector3(3, 0, 0);

      movementSystem.stopAllMovement(entities);

      expect(movementComponent.isMoving).toBe(false);
      expect(movementComponent.velocity.length()).toBe(0);
    });

    it('should provide movement statistics', () => {
      const movementComponent = impEntity.components.get('enemyMovement');

      // Set up moving enemy
      movementComponent.isMoving = true;
      movementComponent.velocity = new Vector3(2, 0, 0);

      const stats = movementSystem.getStats(entities);

      expect(stats).toHaveProperty('movingEnemies');
      expect(stats).toHaveProperty('stuckEnemies');
      expect(stats).toHaveProperty('averageSpeed');
      expect(stats.movingEnemies).toBe(1);
    });

    it('should enable debug mode', () => {
      expect(() => {
        movementSystem.setDebugMode(true);
      }).not.toThrow();
    });
  });
});
