import { type EnemyDefinition, EnemyType } from '../types';

/**
 * IMP Enemy Definition
 *
 * The Imp is the first and most basic enemy type - a small, agile demon
 * that serves as the foundation for enemy behavior testing.
 *
 * Behavior Profile:
 * - Fast detection and reaction
 * - Moderate movement speed (slower than player)
 * - Close-range melee attacker
 * - Low-medium health (3-4 pistol shots)
 * - Quick attack cooldown
 */
export const IMP_DEFINITION: EnemyDefinition = {
  type: EnemyType.IMP,
  name: 'Imp',

  // AI Behavior Configuration
  ai: {
    // Detection and Aggression
    aggroRange: 8.0, // 8 meters - medium detection range
    chaseRange: 12.0, // 12 meters - will pursue further than initial detection
    attackRange: 1.5, // 1.5 meters - close melee range

    // Timing and Persistence
    seekDuration: 3.0, // 3 seconds - moderate search time at last known position
    attackCooldown: 1.2, // 1.2 seconds - fairly rapid attacks
    hurtDuration: 0.5, // 0.5 seconds - brief stun when damaged

    // Movement Characteristics
    movementSpeed: 3.5, // 3.5 m/s - slower than typical player (4-5 m/s)
    turnSpeed: 4.0, // 4 rad/s - quick rotation for responsiveness
    collisionRadius: 0.4, // 0.4m collision radius - standard humanoid size
  },

  // Physical and Combat Stats
  stats: {
    // Health and Survivability
    maxHealth: 60, // 60 HP - survives 3-4 pistol shots (15-20 dmg each)
    currentHealth: 60, // Spawn at full health

    // Combat Capabilities
    attackDamage: 20, // 20 damage - significant but not overwhelming (20% player health)

    // Physical Properties
    radius: 0.4, // 0.4 meters - smaller than player for easier dodging
    height: 1.2, // 1.2 meters - shorter than player (usually ~1.8m)

    // Rewards
    xpValue: 25, // 25 XP - basic enemy reward
  },

  // Visual and Audio Assets (placeholders for now)
  assets: {
    sprites: {
      idle: ['imp_idle_01.png'],
      walk: ['imp_walk_01.png', 'imp_walk_02.png', 'imp_walk_03.png', 'imp_walk_04.png'],
      attack: ['imp_attack_01.png', 'imp_attack_02.png'],
      hurt: ['imp_hurt_01.png'],
      death: ['imp_death_01.png', 'imp_death_02.png', 'imp_death_03.png'],
    },
    sounds: {
      sight: 'imp_sight.wav', // When first sees player
      attack: ['imp_attack_01.wav', 'imp_attack_02.wav'],
      hurt: ['imp_hurt_01.wav', 'imp_hurt_02.wav'],
      death: 'imp_death.wav',
    },
  },
};

/**
 * Imp Behavior Analysis:
 *
 * ENGAGEMENT PATTERN:
 * - Player approaches within 8m → Imp detects and starts seeking
 * - Imp moves at 3.5 m/s toward player (slightly slower than typical player speed)
 * - At 1.5m range → Imp attacks for 20 damage every 1.2 seconds
 * - If player retreats beyond 12m → Imp searches for 3 seconds then gives up
 *
 * COMBAT EFFECTIVENESS:
 * - Time to kill player (100 HP): 5-6 seconds of continuous attacks
 * - Time for player to kill Imp: 3-4 pistol shots or 2 shotgun blasts
 * - Movement allows for circle-strafe dodging strategies
 *
 * BALANCING NOTES:
 * - Slower than player: enables tactical withdrawal
 * - Short attack range: rewards positioning and movement
 * - Moderate health: satisfying to kill without being bullet sponge
 * - Quick cooldown: dangerous if player gets trapped
 */

/**
 * Create an Imp with optional parameter overrides
 */
export function createImpDefinition(overrides?: {
  ai?: Partial<EnemyDefinition['ai']>;
  stats?: Partial<EnemyDefinition['stats']>;
}): EnemyDefinition {
  return {
    ...IMP_DEFINITION,
    ai: { ...IMP_DEFINITION.ai, ...overrides?.ai },
    stats: { ...IMP_DEFINITION.stats, ...overrides?.stats },
  };
}

/**
 * Predefined Imp Variants for different difficulty levels
 */
export const IMP_VARIANTS = {
  // Easier version for early game
  WEAK_IMP: createImpDefinition({
    stats: {
      maxHealth: 40, // Dies in 2-3 pistol shots
      attackDamage: 15, // 15% player health per hit
    },
    ai: {
      movementSpeed: 3.0, // Even slower
      attackCooldown: 1.5, // Slower attacks
    },
  }),

  // Standard version (same as base IMP_DEFINITION)
  STANDARD_IMP: IMP_DEFINITION,

  // Harder version for late game
  TOUGH_IMP: createImpDefinition({
    stats: {
      maxHealth: 80, // Requires 4-5 pistol shots
      attackDamage: 25, // 25% player health per hit
    },
    ai: {
      aggroRange: 10.0, // Detects from further away
      movementSpeed: 4.0, // Nearly as fast as player
      attackCooldown: 1.0, // Faster attacks
    },
  }),

  // Pack leader variant
  ALPHA_IMP: createImpDefinition({
    stats: {
      maxHealth: 100, // Mini-boss level health
      attackDamage: 30, // High damage
      xpValue: 50, // Double XP reward
    },
    ai: {
      aggroRange: 12.0, // Long detection range
      chaseRange: 20.0, // Very persistent
      movementSpeed: 4.2, // Faster than player
      attackCooldown: 0.8, // Rapid attacks
    },
  }),
} as const;
