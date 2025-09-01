import { Vector3 } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import { Transform } from '@doom-like/game-logic';
import {
  createEnemyAIComponent,
  createEnemyIdentityComponent,
  createEnemyMovementComponent,
  createEnemyStateComponent,
  createEnemyStatsComponent,
} from '../components';
import type { EnemyIdentityComponent, EnemyStateComponent } from '../components';
import type { EnemyDefinition, EnemyInstance, EnemySpawnConfig, EnemyType } from '../types';
import { EnemyState } from '../types';

/**
 * EnemyFactory - Creates and configures enemy entities
 * Uses factory pattern with TypeScript generics for type safety
 */
export class EnemyFactory {
  private static instance: EnemyFactory | null = null;
  private enemyDefinitions: Map<EnemyType, EnemyDefinition> = new Map();
  private entityIdCounter = 0;

  private constructor() {}

  /**
   * Get singleton instance of EnemyFactory
   */
  public static getInstance(): EnemyFactory {
    if (!EnemyFactory.instance) {
      EnemyFactory.instance = new EnemyFactory();
    }
    return EnemyFactory.instance;
  }

  /**
   * Register an enemy definition
   */
  public registerEnemyDefinition(definition: EnemyDefinition): void {
    if (this.enemyDefinitions.has(definition.type)) {
      console.warn(`[ENEMY_FACTORY] Overwriting existing definition for ${definition.type}`);
    }

    this.enemyDefinitions.set(definition.type, definition);
    console.log(`[ENEMY_FACTORY] Registered enemy type: ${definition.type}`);
  }

  /**
   * Get enemy definition by type
   */
  public getEnemyDefinition(type: EnemyType): EnemyDefinition | undefined {
    return this.enemyDefinitions.get(type);
  }

  /**
   * Get all registered enemy types
   */
  public getRegisteredTypes(): EnemyType[] {
    return Array.from(this.enemyDefinitions.keys());
  }

  /**
   * Create a new enemy entity with all required components
   */
  public createEnemy(
    createEntityFn: (id: string) => Entity,
    spawnConfig: EnemySpawnConfig
  ): Entity | null {
    // Get enemy definition
    const definition = this.enemyDefinitions.get(spawnConfig.type);
    if (!definition) {
      console.error(`[ENEMY_FACTORY] Unknown enemy type: ${spawnConfig.type}`);
      return null;
    }

    // Generate unique entity ID
    const entityId = spawnConfig.spawnId || `enemy_${spawnConfig.type}_${++this.entityIdCounter}`;

    try {
      // Create base entity
      const entity = createEntityFn(entityId);

      // Add Transform component (required for positioning)
      const transform = new Transform(
        spawnConfig.position.x,
        spawnConfig.position.y,
        spawnConfig.position.z
      );
      entity.components.set('transform', transform);

      // Add EnemyIdentity component
      const hasAiOverrides = spawnConfig.aiOverrides !== undefined;
      const hasStatsOverrides = spawnConfig.statsOverrides !== undefined;
      const identityOverrides =
        hasAiOverrides || hasStatsOverrides
          ? {
              ...(hasAiOverrides ? { aiOverrides: spawnConfig.aiOverrides } : {}),
              ...(hasStatsOverrides ? { statsOverrides: spawnConfig.statsOverrides } : {}),
            }
          : undefined;

      const identityComponent = createEnemyIdentityComponent(
        entityId,
        spawnConfig.type,
        definition,
        identityOverrides
      );
      entity.components.set('enemyIdentity', identityComponent);

      // Add EnemyState component (start in IDLE)
      const stateComponent = createEnemyStateComponent(EnemyState.IDLE);
      entity.components.set('enemyState', stateComponent);

      // Add EnemyStats component
      const statsComponent = createEnemyStatsComponent(
        definition.stats,
        spawnConfig.statsOverrides
      );
      entity.components.set('enemyStats', statsComponent);

      // Add EnemyAI component
      const aiComponent = createEnemyAIComponent(definition.ai, spawnConfig.aiOverrides);
      entity.components.set('enemyAI', aiComponent);

      // Add EnemyMovement component
      // Use AI parameters from the aiComponent (which has overrides applied)
      const movementComponent = createEnemyMovementComponent(
        spawnConfig.position,
        aiComponent.params.movementSpeed,
        aiComponent.params.turnSpeed,
        aiComponent.params.collisionRadius
      );
      // Set initial facing angle if specified
      if (spawnConfig.facingAngle !== undefined) {
        movementComponent.facingAngle = spawnConfig.facingAngle;
        movementComponent.targetFacingAngle = spawnConfig.facingAngle;
      }
      entity.components.set('enemyMovement', movementComponent);

      console.log(
        `[ENEMY_FACTORY] Created enemy: ${entityId} (${spawnConfig.type}) at ${spawnConfig.position}`
      );

      return entity;
    } catch (error) {
      console.error(`[ENEMY_FACTORY] Failed to create enemy ${entityId}:`, error);
      return null;
    }
  }

  /**
   * Create multiple enemies from spawn configurations
   */
  public createEnemies(
    createEntityFn: (id: string) => Entity,
    spawnConfigs: EnemySpawnConfig[]
  ): Entity[] {
    const enemies: Entity[] = [];

    for (const config of spawnConfigs) {
      const enemy = this.createEnemy(createEntityFn, config);
      if (enemy) {
        enemies.push(enemy);
      }
    }

    console.log(`[ENEMY_FACTORY] Created ${enemies.length}/${spawnConfigs.length} enemies`);
    return enemies;
  }

  /**
   * Create an enemy instance data object (for serialization/networking)
   */
  public createEnemyInstance(entity: Entity): EnemyInstance | null {
    const identityComponent = entity.components.get('enemyIdentity') as
      | EnemyIdentityComponent
      | undefined;
    const stateComponent = entity.components.get('enemyState') as EnemyStateComponent | undefined;
    const transform = entity.components.get('transform') as Transform | undefined;

    if (!identityComponent || !stateComponent || !transform) {
      console.error('[ENEMY_FACTORY] Missing required components for enemy instance');
      return null;
    }

    return {
      id: entity.id,
      definition: identityComponent.definition,
      state: stateComponent.currentState,
      stateStartTime: stateComponent.stateStartTime,
      position: new Vector3(transform.x, transform.y, transform.z),
      isAlive: identityComponent.isAlive,
      targetPlayerId: null, // Will be set by AI system
    };
  }

  /**
   * Clone enemy configuration for spawning similar enemies
   */
  public cloneSpawnConfig(
    baseConfig: EnemySpawnConfig,
    overrides?: Partial<EnemySpawnConfig>
  ): EnemySpawnConfig {
    return {
      ...baseConfig,
      ...overrides,
      // Deep clone position to avoid reference issues
      position: overrides?.position ? overrides.position.clone() : baseConfig.position.clone(),
      // Merge AI overrides
      aiOverrides: {
        ...baseConfig.aiOverrides,
        ...overrides?.aiOverrides,
      },
      // Merge stats overrides
      statsOverrides: {
        ...baseConfig.statsOverrides,
        ...overrides?.statsOverrides,
      },
    };
  }

  /**
   * Validate enemy definition
   */
  public validateEnemyDefinition(definition: EnemyDefinition): boolean {
    const errors: string[] = [];

    // Validate required fields
    if (!definition.type) errors.push('Missing type');
    if (!definition.name) errors.push('Missing name');

    // Validate AI parameters
    if (!definition.ai) {
      errors.push('Missing AI parameters');
    } else {
      if (definition.ai.aggroRange <= 0) errors.push('Invalid aggroRange');
      if (definition.ai.attackRange <= 0) errors.push('Invalid attackRange');
      if (definition.ai.movementSpeed <= 0) errors.push('Invalid movementSpeed');
    }

    // Validate stats
    if (!definition.stats) {
      errors.push('Missing stats');
    } else {
      if (definition.stats.maxHealth <= 0) errors.push('Invalid maxHealth');
      if (definition.stats.radius <= 0) errors.push('Invalid radius');
      if (definition.stats.height <= 0) errors.push('Invalid height');
    }

    // Validate assets
    if (!definition.assets) {
      errors.push('Missing assets');
    } else {
      if (!definition.assets.sprites) errors.push('Missing sprites');
      if (!definition.assets.sounds) errors.push('Missing sounds');
    }

    if (errors.length > 0) {
      console.error(`[ENEMY_FACTORY] Invalid enemy definition for ${definition.type}:`, errors);
      return false;
    }

    return true;
  }

  /**
   * Get factory statistics
   */
  public getStatistics(): {
    registeredTypes: number;
    createdEnemies: number;
    definitions: { type: EnemyType; name: string }[];
  } {
    return {
      registeredTypes: this.enemyDefinitions.size,
      createdEnemies: this.entityIdCounter,
      definitions: Array.from(this.enemyDefinitions.values()).map((def) => ({
        type: def.type,
        name: def.name,
      })),
    };
  }

  /**
   * Clear all registered definitions (for testing)
   */
  public clearDefinitions(): void {
    this.enemyDefinitions.clear();
    this.entityIdCounter = 0;
    console.log('[ENEMY_FACTORY] Cleared all enemy definitions');
  }

  /**
   * Reset factory instance (for testing)
   */
  public static resetInstance(): void {
    EnemyFactory.instance = null;
  }
}

/**
 * Convenience function to get the singleton factory instance
 */
export function getEnemyFactory(): EnemyFactory {
  return EnemyFactory.getInstance();
}

/**
 * Type-safe enemy creation helper
 */
export function createEnemyOfType<T extends EnemyType>(
  createEntityFn: (id: string) => Entity,
  type: T,
  position: Vector3,
  overrides?: {
    facingAngle?: number;
    aiOverrides?: Partial<EnemyDefinition['ai']>;
    statsOverrides?: Partial<EnemyDefinition['stats']>;
    spawnId?: string;
  }
): Entity | null {
  const factory = getEnemyFactory();

  const spawnConfig: EnemySpawnConfig = {
    type,
    position,
    ...(overrides?.facingAngle !== undefined ? { facingAngle: overrides.facingAngle } : {}),
    ...(overrides?.aiOverrides !== undefined ? { aiOverrides: overrides.aiOverrides } : {}),
    ...(overrides?.statsOverrides !== undefined
      ? { statsOverrides: overrides.statsOverrides }
      : {}),
    ...(overrides?.spawnId !== undefined ? { spawnId: overrides.spawnId } : {}),
  };

  return factory.createEnemy(createEntityFn, spawnConfig);
}
