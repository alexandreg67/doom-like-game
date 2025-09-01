import { Vector3 } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EnemyFactory, createEnemyOfType, getEnemyFactory } from '../factories/enemy-factory';
import { EnemyState, EnemyType } from '../types';
import type { EnemyDefinition, EnemySpawnConfig } from '../types';

// Mock entity creation function
const createMockEntity = (id: string): Entity => ({
  id,
  components: new Map(),
});

describe('EnemyFactory', () => {
  let factory: EnemyFactory;
  let mockDefinition: EnemyDefinition;

  beforeEach(() => {
    // Reset singleton instance
    EnemyFactory.resetInstance();
    factory = EnemyFactory.getInstance();

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

  afterEach(() => {
    EnemyFactory.resetInstance();
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const factory1 = EnemyFactory.getInstance();
      const factory2 = EnemyFactory.getInstance();

      expect(factory1).toBe(factory2);
    });

    it('should be same as getEnemyFactory helper', () => {
      const factory1 = EnemyFactory.getInstance();
      const factory2 = getEnemyFactory();

      expect(factory1).toBe(factory2);
    });
  });

  describe('registerEnemyDefinition', () => {
    it('should register enemy definition', () => {
      factory.registerEnemyDefinition(mockDefinition);

      const retrieved = factory.getEnemyDefinition(EnemyType.IMP);
      expect(retrieved).toBe(mockDefinition);
    });

    it('should overwrite existing definition', () => {
      factory.registerEnemyDefinition(mockDefinition);

      const newDefinition = { ...mockDefinition, name: 'New Imp' };
      factory.registerEnemyDefinition(newDefinition);

      const retrieved = factory.getEnemyDefinition(EnemyType.IMP);
      expect(retrieved?.name).toBe('New Imp');
    });

    it('should track registered types', () => {
      factory.registerEnemyDefinition(mockDefinition);

      const types = factory.getRegisteredTypes();
      expect(types).toContain(EnemyType.IMP);
      expect(types).toHaveLength(1);
    });
  });

  describe('createEnemy', () => {
    beforeEach(() => {
      factory.registerEnemyDefinition(mockDefinition);
    });

    it('should create enemy with all required components', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(10, 0, 5),
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);

      expect(enemy).toBeTruthy();
      if (!enemy) throw new Error('Failed to create enemy');
      expect(enemy.components.has('transform')).toBe(true);
      expect(enemy.components.has('enemyIdentity')).toBe(true);
      expect(enemy.components.has('enemyState')).toBe(true);
      expect(enemy.components.has('enemyStats')).toBe(true);
      expect(enemy.components.has('enemyAI')).toBe(true);
      expect(enemy.components.has('enemyMovement')).toBe(true);
    });

    it('should set transform position correctly', () => {
      const position = new Vector3(15, 2, 8);
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position,
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      const transform = enemy.components.get('transform');

      expect(transform.x).toBe(15);
      expect(transform.y).toBe(2);
      expect(transform.z).toBe(8);
    });

    it('should set facing angle when specified', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
        facingAngle: Math.PI / 2,
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      const movement = enemy.components.get('enemyMovement');

      expect(movement.facingAngle).toBe(Math.PI / 2);
      expect(movement.targetFacingAngle).toBe(Math.PI / 2);
    });

    it('should apply AI overrides', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
        aiOverrides: {
          movementSpeed: 5,
          aggroRange: 15,
        },
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      const ai = enemy.components.get('enemyAI');
      const movement = enemy.components.get('enemyMovement');

      expect(ai.params.movementSpeed).toBe(5);
      expect(ai.params.aggroRange).toBe(15);
      expect(movement.movementSpeed).toBe(5); // Should also update movement component
    });

    it('should apply stats overrides', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
        statsOverrides: {
          maxHealth: 100,
          attackDamage: 30,
        },
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      const stats = enemy.components.get('enemyStats');

      expect(stats.maxHealth).toBe(100);
      expect(stats.currentHealth).toBe(100);
      expect(stats.attackDamage).toBe(30);
    });

    it('should use custom spawn ID when provided', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
        spawnId: 'boss_imp_1',
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      expect(enemy.id).toBe('boss_imp_1');
    });

    it('should generate unique IDs when no spawn ID provided', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
      };

      const enemy1 = factory.createEnemy(createMockEntity, spawnConfig);
      const enemy2 = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy1 || !enemy2) throw new Error('Failed to create enemies');

      expect(enemy1.id).not.toBe(enemy2.id);
      expect(enemy1.id).toContain('enemy_imp_');
      expect(enemy2.id).toContain('enemy_imp_');
    });

    it('should return null for unknown enemy type', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: 'unknown' as EnemyType,
        position: new Vector3(0, 0, 0),
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);

      expect(enemy).toBeNull();
    });

    it('should start enemy in IDLE state', () => {
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
      };

      const enemy = factory.createEnemy(createMockEntity, spawnConfig);
      if (!enemy) throw new Error('Failed to create enemy');
      const state = enemy.components.get('enemyState');

      expect(state.currentState).toBe(EnemyState.IDLE);
      expect(state.previousState).toBe(EnemyState.IDLE);
    });
  });

  describe('createEnemies', () => {
    beforeEach(() => {
      factory.registerEnemyDefinition(mockDefinition);
    });

    it('should create multiple enemies from configs', () => {
      const configs: EnemySpawnConfig[] = [
        { type: EnemyType.IMP, position: new Vector3(0, 0, 0) },
        { type: EnemyType.IMP, position: new Vector3(10, 0, 0) },
        { type: EnemyType.IMP, position: new Vector3(20, 0, 0) },
      ];

      const enemies = factory.createEnemies(createMockEntity, configs);

      expect(enemies).toHaveLength(3);
      expect(enemies[0].id).toContain('enemy_imp_');
      expect(enemies[1].id).toContain('enemy_imp_');
      expect(enemies[2].id).toContain('enemy_imp_');
    });

    it('should skip invalid configs', () => {
      const configs: EnemySpawnConfig[] = [
        { type: EnemyType.IMP, position: new Vector3(0, 0, 0) },
        { type: 'invalid' as EnemyType, position: new Vector3(10, 0, 0) },
        { type: EnemyType.IMP, position: new Vector3(20, 0, 0) },
      ];

      const enemies = factory.createEnemies(createMockEntity, configs);

      expect(enemies).toHaveLength(2);
    });
  });

  describe('validateEnemyDefinition', () => {
    it('should validate complete definition', () => {
      const isValid = factory.validateEnemyDefinition(mockDefinition);
      expect(isValid).toBe(true);
    });

    it('should reject definition missing type', () => {
      const invalidDef = { ...mockDefinition, type: undefined } as unknown as EnemyDefinition;

      const isValid = factory.validateEnemyDefinition(invalidDef);
      expect(isValid).toBe(false);
    });

    it('should reject definition with invalid AI params', () => {
      const invalidDef = {
        ...mockDefinition,
        ai: { ...mockDefinition.ai, aggroRange: -1 },
      };

      const isValid = factory.validateEnemyDefinition(invalidDef);
      expect(isValid).toBe(false);
    });

    it('should reject definition with invalid stats', () => {
      const invalidDef = {
        ...mockDefinition,
        stats: { ...mockDefinition.stats, maxHealth: 0 },
      };

      const isValid = factory.validateEnemyDefinition(invalidDef);
      expect(isValid).toBe(false);
    });

    it('should reject definition missing assets', () => {
      const invalidDef = { ...mockDefinition, assets: undefined } as unknown as EnemyDefinition;

      const isValid = factory.validateEnemyDefinition(invalidDef);
      expect(isValid).toBe(false);
    });
  });

  describe('cloneSpawnConfig', () => {
    it('should clone spawn config with overrides', () => {
      const baseConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(5, 0, 5),
        aiOverrides: { movementSpeed: 3 },
      };

      const cloned = factory.cloneSpawnConfig(baseConfig, {
        position: new Vector3(10, 0, 10),
        aiOverrides: { aggroRange: 15 },
      });

      expect(cloned.position).toEqual(new Vector3(10, 0, 10));
      expect(cloned.aiOverrides).toEqual({ movementSpeed: 3, aggroRange: 15 });
    });

    it('should not modify original config', () => {
      const baseConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(5, 0, 5),
      };

      const cloned = factory.cloneSpawnConfig(baseConfig, {
        position: new Vector3(10, 0, 10),
      });

      expect(baseConfig.position).toEqual(new Vector3(5, 0, 5));
      expect(cloned.position).toEqual(new Vector3(10, 0, 10));
    });
  });

  describe('getStatistics', () => {
    it('should return factory statistics', () => {
      factory.registerEnemyDefinition(mockDefinition);

      // Create a few enemies
      const spawnConfig: EnemySpawnConfig = {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
      };
      factory.createEnemy(createMockEntity, spawnConfig);
      factory.createEnemy(createMockEntity, spawnConfig);

      const stats = factory.getStatistics();

      expect(stats.registeredTypes).toBe(1);
      expect(stats.createdEnemies).toBe(2);
      expect(stats.definitions).toHaveLength(1);
      expect(stats.definitions[0].type).toBe(EnemyType.IMP);
      expect(stats.definitions[0].name).toBe('Test Imp');
    });
  });

  describe('clearDefinitions', () => {
    it('should clear all definitions and reset counter', () => {
      factory.registerEnemyDefinition(mockDefinition);
      factory.createEnemy(createMockEntity, {
        type: EnemyType.IMP,
        position: new Vector3(0, 0, 0),
      });

      factory.clearDefinitions();

      const stats = factory.getStatistics();
      expect(stats.registeredTypes).toBe(0);
      expect(stats.createdEnemies).toBe(0);
      expect(factory.getEnemyDefinition(EnemyType.IMP)).toBeUndefined();
    });
  });
});

describe('createEnemyOfType helper', () => {
  beforeEach(() => {
    EnemyFactory.resetInstance();
    const factory = getEnemyFactory();
    factory.registerEnemyDefinition({
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
          walk: ['imp_walk_1.png'],
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
    });
  });

  it('should create enemy using helper function', () => {
    const enemy = createEnemyOfType(createMockEntity, EnemyType.IMP, new Vector3(5, 0, 5), {
      facingAngle: Math.PI,
    });

    expect(enemy).toBeTruthy();
    if (!enemy) throw new Error('Failed to create enemy');
    expect(enemy.components.has('enemyIdentity')).toBe(true);

    const movement = enemy.components.get('enemyMovement');
    expect(movement.facingAngle).toBe(Math.PI);
  });
});
