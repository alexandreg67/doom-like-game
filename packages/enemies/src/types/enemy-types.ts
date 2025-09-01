import type { Vector3 } from '@babylonjs/core';

/**
 * Available enemy types in the game
 * This enum will be extended as new enemy types are added
 */
export enum EnemyType {
  IMP = 'imp',
  // Future types:
  // DEMON = 'demon',
  // CACODEMON = 'cacodemon',
  // BARON = 'baron',
}

/**
 * Enemy FSM states
 * Based on classic DOOM enemy behavior patterns
 */
export enum EnemyState {
  /** Idle state - enemy is not aware of player */
  IDLE = 'idle',
  /** Seeking state - enemy knows player exists but can't see them */
  SEEKING = 'seeking',
  /** Chase state - enemy can see player and is moving towards them */
  CHASE = 'chase',
  /** Attack state - enemy is in range and attacking */
  ATTACK = 'attack',
  /** Hurt state - enemy was damaged and is recovering */
  HURT = 'hurt',
  /** Death state - enemy is dying/dead */
  DEATH = 'death',
}

/**
 * Enemy behavior parameters
 * These control how the enemy AI behaves
 */
export interface EnemyAIParams {
  /** Distance at which enemy becomes aware of player */
  aggroRange: number;
  /** Maximum distance enemy will chase player */
  chaseRange: number;
  /** Distance at which enemy will attack */
  attackRange: number;
  /** How long enemy continues seeking after losing sight (seconds) */
  seekDuration: number;
  /** Time between attacks (seconds) */
  attackCooldown: number;
  /** Time spent in hurt state (seconds) */
  hurtDuration: number;
  /** Enemy movement speed (units per second) */
  movementSpeed: number;
  /** Turn speed (radians per second) */
  turnSpeed: number;
}

/**
 * Enemy statistics and attributes
 */
export interface EnemyStats {
  /** Maximum health points */
  maxHealth: number;
  /** Current health points */
  currentHealth: number;
  /** Damage dealt by enemy attacks */
  attackDamage: number;
  /** Physical radius for collision */
  radius: number;
  /** Physical height for collision */
  height: number;
  /** Experience points awarded when killed */
  xpValue: number;
}

/**
 * Enemy visual and audio assets
 */
export interface EnemyAssets {
  /** Sprite textures for different states */
  sprites: {
    idle: string[];
    walk: string[];
    attack: string[];
    hurt: string[];
    death: string[];
  };
  /** Audio samples for different actions */
  sounds: {
    idle?: string[];
    sight?: string;
    attack?: string[];
    hurt?: string[];
    death?: string;
  };
}

/**
 * Enemy pathfinding and movement data
 */
export interface EnemyMovementData {
  /** Current velocity vector */
  velocity: Vector3;
  /** Target position to move towards */
  targetPosition: Vector3 | null;
  /** Last known player position */
  lastPlayerPosition: Vector3 | null;
  /** Current facing direction (radians) */
  facingAngle: number;
  /** Whether enemy is currently moving */
  isMoving: boolean;
  /** Whether enemy is stuck (for unstuck logic) */
  isStuck: boolean;
  /** Time spent being stuck */
  stuckTime: number;
}

/**
 * Enemy attack data
 */
export interface EnemyAttackData {
  /** Whether enemy is currently attacking */
  isAttacking: boolean;
  /** Time since last attack */
  timeSinceLastAttack: number;
  /** Current attack animation frame */
  attackFrame: number;
  /** Attack target entity ID */
  targetId: string | null;
}

/**
 * Enemy renderer data
 */
export interface EnemyRenderData {
  /** Current sprite frame */
  currentFrame: number;
  /** Animation timer */
  animationTimer: number;
  /** Current animation sequence */
  currentAnimation: keyof EnemyAssets['sprites'];
  /** Whether sprite should face player */
  billboard: boolean;
  /** Scale multiplier */
  scale: number;
}

/**
 * Core enemy definition interface
 * This defines the "template" for each enemy type
 */
export interface EnemyDefinition {
  /** Unique enemy type identifier */
  type: EnemyType;
  /** Human-readable name */
  name: string;
  /** AI behavior parameters */
  ai: EnemyAIParams;
  /** Stats and attributes */
  stats: EnemyStats;
  /** Visual and audio assets */
  assets: EnemyAssets;
}

/**
 * Runtime enemy instance data
 * This represents a spawned enemy in the game world
 */
export interface EnemyInstance {
  /** Unique instance ID */
  id: string;
  /** Enemy type definition */
  definition: EnemyDefinition;
  /** Current FSM state */
  state: EnemyState;
  /** State transition timestamp */
  stateStartTime: number;
  /** World position */
  position: Vector3;
  /** Current sector ID (if applicable) */
  sectorId?: string;
  /** Whether enemy is alive */
  isAlive: boolean;
  /** Target player entity ID */
  targetPlayerId: string | null;
}

/**
 * Enemy spawn configuration
 */
export interface EnemySpawnConfig {
  /** Enemy type to spawn */
  type: EnemyType;
  /** Spawn position in world coordinates */
  position: Vector3;
  /** Initial facing angle (radians) */
  facingAngle?: number;
  /** Override AI parameters */
  aiOverrides?: Partial<EnemyAIParams>;
  /** Override stats */
  statsOverrides?: Partial<EnemyStats>;
  /** Unique spawn ID (optional) */
  spawnId?: string;
}

/**
 * Enemy system performance metrics
 */
export interface EnemyMetrics {
  /** Total number of active enemies */
  activeEnemies: number;
  /** Enemies by state count */
  enemiesByState: Record<EnemyState, number>;
  /** Average AI update time per frame (ms) */
  avgAIUpdateTime: number;
  /** Average movement update time per frame (ms) */
  avgMovementUpdateTime: number;
  /** Memory usage approximation (bytes) */
  memoryUsage: number;
  /** Frame rate impact (percentage) */
  frameRateImpact: number;
}

/**
 * Enemy event types for system communication
 */
export enum EnemyEventType {
  SPAWNED = 'enemy_spawned',
  DIED = 'enemy_died',
  PLAYER_SPOTTED = 'player_spotted',
  PLAYER_LOST = 'player_lost',
  ATTACK_STARTED = 'attack_started',
  ATTACK_HIT = 'attack_hit',
  TOOK_DAMAGE = 'took_damage',
  STATE_CHANGED = 'state_changed',
}

/**
 * Enemy event data
 */
export interface EnemyEvent {
  type: EnemyEventType;
  enemyId: string;
  timestamp: number;
  data?: unknown;
}
