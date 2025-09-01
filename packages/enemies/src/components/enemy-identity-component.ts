import type { Component } from '@doom-like/game-logic';
import type { EnemyDefinition, EnemyType } from '../types';

/**
 * EnemyIdentity component - identifies an entity as an enemy
 * Contains core enemy identification and definition data
 */
export interface EnemyIdentityComponent extends Component {
  id: 'enemyIdentity';

  /** Unique instance identifier */
  instanceId: string;

  /** Enemy type (imp, demon, etc.) */
  type: EnemyType;

  /** Reference to enemy definition (stats, AI params, assets) */
  definition: EnemyDefinition;

  /** Spawn timestamp for age tracking */
  spawnTime: number;

  /** Whether this enemy is alive */
  isAlive: boolean;

  /** Optional spawn configuration overrides */
  spawnOverrides?: {
    aiOverrides?: Partial<EnemyDefinition['ai']>;
    statsOverrides?: Partial<EnemyDefinition['stats']>;
  };
}

/**
 * Factory function to create EnemyIdentity component
 */
export function createEnemyIdentityComponent(
  instanceId: string,
  type: EnemyType,
  definition: EnemyDefinition,
  overrides?: EnemyIdentityComponent['spawnOverrides']
): EnemyIdentityComponent {
  return {
    id: 'enemyIdentity',
    instanceId,
    type,
    definition,
    spawnTime: Date.now(),
    isAlive: true,
    spawnOverrides: overrides,
  };
}
