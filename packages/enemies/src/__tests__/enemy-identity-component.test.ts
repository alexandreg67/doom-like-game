import { Vector3 } from '@babylonjs/core';
import { beforeEach, describe, expect, it } from 'vitest';
import { createEnemyIdentityComponent } from '../components/enemy-identity-component';
import { EnemyType } from '../types';
import type { EnemyDefinition } from '../types';

describe('EnemyIdentityComponent', () => {
  let mockDefinition: EnemyDefinition;

  beforeEach(() => {
    mockDefinition = {
      type: EnemyType.IMP,
      name: 'Test Imp',
      ai: {
        aggroRange: 10,
        chaseRange: 15,
        attackRange: 2,
        seekDuration: 5,
        attackCooldown: 1,
        hurtDuration: 0.5,
        movementSpeed: 3,
        turnSpeed: 2,
      },
      stats: {
        maxHealth: 60,
        currentHealth: 60,
        attackDamage: 20,
        radius: 0.5,
        height: 1.8,
        xpValue: 10,
      },
      assets: {
        sprites: {
          idle: ['imp_idle.png'],
          walk: ['imp_walk_1.png', 'imp_walk_2.png'],
          attack: ['imp_attack.png'],
          hurt: ['imp_hurt.png'],
          death: ['imp_death.png'],
        },
        sounds: {
          sight: 'imp_sight.wav',
          attack: ['imp_attack.wav'],
          hurt: ['imp_hurt.wav'],
          death: 'imp_death.wav',
        },
      },
    };
  });

  it('should create enemy identity component with correct properties', () => {
    const component = createEnemyIdentityComponent('test_imp_1', EnemyType.IMP, mockDefinition);

    expect(component.id).toBe('enemyIdentity');
    expect(component.instanceId).toBe('test_imp_1');
    expect(component.type).toBe(EnemyType.IMP);
    expect(component.definition).toBe(mockDefinition);
    expect(component.isAlive).toBe(true);
    expect(component.spawnTime).toBeTypeOf('number');
    expect(component.spawnTime).toBeGreaterThan(0);
  });

  it('should create component with spawn overrides', () => {
    const overrides = {
      aiOverrides: { movementSpeed: 5 },
      statsOverrides: { maxHealth: 100 },
    };

    const component = createEnemyIdentityComponent(
      'test_imp_2',
      EnemyType.IMP,
      mockDefinition,
      overrides
    );

    expect(component.spawnOverrides).toEqual(overrides);
  });

  it('should create component without overrides', () => {
    const component = createEnemyIdentityComponent('test_imp_3', EnemyType.IMP, mockDefinition);

    expect(component.spawnOverrides).toBeUndefined();
  });

  it('should set spawn time to current timestamp', () => {
    const beforeTime = Date.now();
    const component = createEnemyIdentityComponent('test_imp_4', EnemyType.IMP, mockDefinition);
    const afterTime = Date.now();

    expect(component.spawnTime).toBeGreaterThanOrEqual(beforeTime);
    expect(component.spawnTime).toBeLessThanOrEqual(afterTime);
  });

  it('should preserve definition reference', () => {
    const component = createEnemyIdentityComponent('test_imp_5', EnemyType.IMP, mockDefinition);

    expect(component.definition).toBe(mockDefinition);
    expect(component.definition.name).toBe('Test Imp');
    expect(component.definition.type).toBe(EnemyType.IMP);
  });

  it('should handle empty overrides object', () => {
    const emptyOverrides = {};
    const component = createEnemyIdentityComponent(
      'test_imp_6',
      EnemyType.IMP,
      mockDefinition,
      emptyOverrides
    );

    expect(component.spawnOverrides).toEqual(emptyOverrides);
  });
});
