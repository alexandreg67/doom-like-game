import { Vector3 } from '@babylonjs/core';
import type { Entity } from '@doom-like/game-logic';
import { IMP_DEFINITION, IMP_VARIANTS } from '../definitions/imp-definition';
import { createEnemyOfType, getEnemyFactory } from '../factories/enemy-factory';
import { EnemyType } from '../types';

/**
 * Imp creation helpers and utilities
 * Provides convenient functions for creating and managing Imp enemies
 */

/**
 * Initialize the Imp enemy system by registering definitions
 * Should be called once during game initialization
 */
export function initializeImpSystem(): void {
  const factory = getEnemyFactory();

  // Register the standard Imp definition
  factory.registerEnemyDefinition(IMP_DEFINITION);

  console.log('[IMP_HELPERS] Imp enemy system initialized');
}

/**
 * Create a standard Imp enemy at specified position
 */
export function createImp(
  createEntityFn: (id: string) => Entity,
  position: Vector3,
  options?: {
    facingAngle?: number;
    spawnId?: string;
    aiOverrides?: Partial<typeof IMP_DEFINITION.ai>;
    statsOverrides?: Partial<typeof IMP_DEFINITION.stats>;
  }
): Entity | null {
  return createEnemyOfType(createEntityFn, EnemyType.IMP, position, options);
}

/**
 * Create a weak Imp (easier variant)
 */
export function createWeakImp(
  createEntityFn: (id: string) => Entity,
  position: Vector3,
  options?: {
    facingAngle?: number;
    spawnId?: string;
  }
): Entity | null {
  const factory = getEnemyFactory();

  // Temporarily register weak variant if not already registered
  if (!factory.getEnemyDefinition('weak_imp' as EnemyType)) {
    factory.registerEnemyDefinition({
      ...IMP_VARIANTS.WEAK_IMP,
      type: 'weak_imp' as EnemyType,
    });
  }

  return createEnemyOfType(createEntityFn, 'weak_imp' as EnemyType, position, options);
}

/**
 * Create a tough Imp (harder variant)
 */
export function createToughImp(
  createEntityFn: (id: string) => Entity,
  position: Vector3,
  options?: {
    facingAngle?: number;
    spawnId?: string;
  }
): Entity | null {
  const factory = getEnemyFactory();

  if (!factory.getEnemyDefinition('tough_imp' as EnemyType)) {
    factory.registerEnemyDefinition({
      ...IMP_VARIANTS.TOUGH_IMP,
      type: 'tough_imp' as EnemyType,
    });
  }

  return createEnemyOfType(createEntityFn, 'tough_imp' as EnemyType, position, options);
}

/**
 * Create an Alpha Imp (boss variant)
 */
export function createAlphaImp(
  createEntityFn: (id: string) => Entity,
  position: Vector3,
  options?: {
    facingAngle?: number;
    spawnId?: string;
  }
): Entity | null {
  const factory = getEnemyFactory();

  if (!factory.getEnemyDefinition('alpha_imp' as EnemyType)) {
    factory.registerEnemyDefinition({
      ...IMP_VARIANTS.ALPHA_IMP,
      type: 'alpha_imp' as EnemyType,
    });
  }

  return createEnemyOfType(createEntityFn, 'alpha_imp' as EnemyType, position, options);
}

/**
 * Create multiple Imps in formation
 */
export function createImpSquad(
  createEntityFn: (id: string) => Entity,
  centerPosition: Vector3,
  count = 3,
  formation: 'line' | 'circle' | 'scattered' = 'circle',
  spacing = 2.0
): Entity[] {
  const imps: Entity[] = [];

  for (let i = 0; i < count; i++) {
    let position: Vector3;

    switch (formation) {
      case 'line':
        position = centerPosition.add(new Vector3(i * spacing - ((count - 1) * spacing) / 2, 0, 0));
        break;

      case 'circle': {
        const angle = (i / count) * Math.PI * 2;
        const radius = spacing;
        position = centerPosition.add(
          new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius)
        );
        break;
      }

      case 'scattered':
        position = centerPosition.add(
          new Vector3((Math.random() - 0.5) * spacing * 2, 0, (Math.random() - 0.5) * spacing * 2)
        );
        break;

      default:
        position = centerPosition.clone();
    }

    const imp = createImp(createEntityFn, position, {
      spawnId: `imp_squad_${i}_${Date.now()}`,
    });

    if (imp) {
      imps.push(imp);
    }
  }

  console.log(`[IMP_HELPERS] Created ${imps.length}/${count} Imps in ${formation} formation`);
  return imps;
}

/**
 * Create a mixed difficulty imp patrol
 */
export function createImpPatrol(
  createEntityFn: (id: string) => Entity,
  centerPosition: Vector3,
  patrolSize: 'small' | 'medium' | 'large' = 'medium'
): Entity[] {
  const imps: Entity[] = [];

  const configs = {
    small: { weak: 2, standard: 1, tough: 0, alpha: 0 },
    medium: { weak: 1, standard: 2, tough: 1, alpha: 0 },
    large: { weak: 2, standard: 3, tough: 2, alpha: 1 },
  };

  const config = configs[patrolSize];
  let positionOffset = 0;

  // Create weak imps
  for (let i = 0; i < config.weak; i++) {
    const position = centerPosition.add(new Vector3(positionOffset * 2, 0, 0));
    const imp = createWeakImp(createEntityFn, position);
    if (imp) imps.push(imp);
    positionOffset++;
  }

  // Create standard imps
  for (let i = 0; i < config.standard; i++) {
    const position = centerPosition.add(new Vector3(positionOffset * 2, 0, 0));
    const imp = createImp(createEntityFn, position);
    if (imp) imps.push(imp);
    positionOffset++;
  }

  // Create tough imps
  for (let i = 0; i < config.tough; i++) {
    const position = centerPosition.add(new Vector3(positionOffset * 2, 0, 0));
    const imp = createToughImp(createEntityFn, position);
    if (imp) imps.push(imp);
    positionOffset++;
  }

  // Create alpha imp (patrol leader)
  for (let i = 0; i < config.alpha; i++) {
    const position = centerPosition.add(new Vector3(positionOffset * 2, 0, 0));
    const imp = createAlphaImp(createEntityFn, position, {
      spawnId: `alpha_imp_leader_${Date.now()}`,
    });
    if (imp) imps.push(imp);
    positionOffset++;
  }

  console.log(`[IMP_HELPERS] Created ${patrolSize} imp patrol with ${imps.length} enemies`);
  return imps;
}

/**
 * Get Imp-specific statistics from an entity
 */
export function getImpStats(imp: Entity): {
  type: string;
  health: { current: number; max: number; percentage: number };
  damage: number;
  state: string;
  isAlive: boolean;
} | null {
  const identity = imp.components.get('enemyIdentity') as
    | { type: string; isAlive: boolean }
    | undefined;
  const stats = imp.components.get('enemyStats') as
    | { currentHealth: number; maxHealth: number; attackDamage: number; damageMultiplier: number }
    | undefined;
  const state = imp.components.get('enemyState') as { currentState: string } | undefined;

  if (!identity || !stats || !state) return null;

  return {
    type: identity.type,
    health: {
      current: stats.currentHealth,
      max: stats.maxHealth,
      percentage: stats.currentHealth / stats.maxHealth,
    },
    damage: stats.attackDamage * stats.damageMultiplier,
    state: state.currentState,
    isAlive: identity.isAlive && stats.currentHealth > 0,
  };
}

/**
 * Check if an entity is an Imp
 */
export function isImp(entity: Entity): boolean {
  const identity = entity.components.get('enemyIdentity') as { type: string } | undefined;
  return (
    identity?.type === EnemyType.IMP ||
    identity?.type === 'weak_imp' ||
    identity?.type === 'tough_imp' ||
    identity?.type === 'alpha_imp'
  );
}

/**
 * Get all Imp entities from a list of entities
 */
export function getAllImps(entities: Entity[]): Entity[] {
  return entities.filter(isImp);
}

/**
 * Count living Imps in entity list
 */
export function countLivingImps(entities: Entity[]): number {
  return getAllImps(entities).filter((imp) => {
    const stats = getImpStats(imp);
    return stats?.isAlive ?? false;
  }).length;
}

/**
 * Imp behavior configuration presets for different game situations
 */
export const IMP_PRESETS = {
  // Early game tutorial enemy
  TUTORIAL: {
    aiOverrides: {
      aggroRange: 6, // Shorter detection
      movementSpeed: 2.5, // Slower movement
      attackCooldown: 2.0, // Slower attacks
    },
    statsOverrides: {
      maxHealth: 30, // Very weak
      attackDamage: 10, // Low damage
    },
  },

  // Standard balanced enemy
  BALANCED: {}, // Uses default IMP_DEFINITION

  // Late game challenge
  VETERAN: {
    aiOverrides: {
      aggroRange: 12, // Long detection
      movementSpeed: 4.5, // Fast movement
      attackCooldown: 0.8, // Rapid attacks
    },
    statsOverrides: {
      maxHealth: 90, // Tanky
      attackDamage: 30, // High damage
    },
  },
} as const;
