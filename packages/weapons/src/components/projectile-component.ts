/**
 * Projectile component for non-hitscan weapons
 */

import { Vector3 } from '@babylonjs/core';
import type { Component, Entity } from '@doom-like/game-logic';
import type { ProjectileConfig } from '../types';

export interface ProjectileComponent extends Component {
  id: 'projectile';

  // Configuration
  config: ProjectileConfig;

  // Physics
  velocity: Vector3;
  acceleration: Vector3;

  // Lifetime tracking
  spawnTime: number;
  maxLifetime: number;
  distanceTraveled: number;

  // Collision
  hasCollided: boolean;
  collisionPoint?: Vector3;
  collisionNormal?: Vector3;
  collidedEntity?: Entity;

  // Bouncing
  bounceCount: number;
  maxBounces: number;
  bounceDamping: number;

  // Damage properties
  damage: number;
  damageRadius: number;
  damageOwner?: Entity | undefined;

  // Visual properties
  trailEffect?: string;
  glowEffect?: boolean;
  rotationSpeed: number;

  // Special behaviors
  isHoming?: boolean;
  homingTarget?: Entity;
  homingStrength?: number;

  isSticky?: boolean;
  stickTime?: number;

  // Explosion properties
  explodeOnImpact: boolean;
  explodeOnTimeout: boolean;
  explosionDamage: number;
  explosionRadius: number;
  explosionForce: number;
}

/**
 * Create projectile component with config
 */
export function createProjectileComponent(
  config: ProjectileConfig,
  initialVelocity: Vector3,
  damage: number,
  owner?: Entity
): ProjectileComponent {
  return {
    id: 'projectile',
    config,
    velocity: initialVelocity.clone(),
    acceleration: new Vector3(0, -config.gravity, 0),

    spawnTime: performance.now(),
    maxLifetime: config.lifeTime * 1000, // Convert to ms
    distanceTraveled: 0,

    hasCollided: false,

    bounceCount: 0,
    maxBounces: config.bounces || 0,
    bounceDamping: 0.7,

    damage,
    damageRadius: config.explosionRadius || 0,
    damageOwner: owner,

    trailEffect: config.trailEffect,
    glowEffect: false,
    rotationSpeed: 0,

    explodeOnImpact: !!config.explosionRadius,
    explodeOnTimeout: !!config.explosionRadius,
    explosionDamage: damage,
    explosionRadius: config.explosionRadius || 0,
    explosionForce: 10.0,
  };
}

/**
 * Explosion component for projectile explosions
 */
export interface ExplosionComponent extends Component {
  id: 'explosion';

  // Position and timing
  position: Vector3;
  startTime: number;
  duration: number;

  // Damage properties
  maxDamage: number;
  radius: number;
  falloffType: 'linear' | 'quadratic' | 'none';

  // Force properties
  force: number;
  forceFalloff: number;

  // Visual properties
  effectName: string;
  scale: number;

  // Damage tracking
  entitiesAffected: Set<Entity>;
  damageOwner?: Entity;

  // Special effects
  screenShake: number;
  soundEffect: string;
  particleEffect: string;
}

/**
 * Create explosion component
 */
export function createExplosionComponent(
  position: Vector3,
  damage: number,
  radius: number,
  owner?: Entity
): ExplosionComponent {
  return {
    id: 'explosion',
    position: position.clone(),
    startTime: performance.now(),
    duration: 1000, // 1 second explosion effect

    maxDamage: damage,
    radius,
    falloffType: 'quadratic',

    force: 15.0,
    forceFalloff: 2.0,

    effectName: 'explosion',
    scale: radius / 32, // Scale relative to standard explosion size

    entitiesAffected: new Set(),
    damageOwner: owner,

    screenShake: Math.min(radius / 10, 5.0),
    soundEffect: 'explosion',
    particleEffect: 'explosion_particles',
  };
}

/**
 * Trail component for projectile visual effects
 */
export interface TrailComponent extends Component {
  id: 'trail';

  // Trail properties
  points: Vector3[];
  maxPoints: number;
  pointSpacing: number;
  lastPointDistance: number;

  // Visual properties
  width: number;
  color: string;
  opacity: number;
  fadeRate: number;

  // Texture properties
  texture?: string;
  uvScrollSpeed: number;

  // Lifetime
  pointLifetime: number;
  pointAges: number[];
}

/**
 * Create trail component for projectiles
 */
export function createTrailComponent(maxPoints = 20): TrailComponent {
  return {
    id: 'trail',
    points: [],
    maxPoints,
    pointSpacing: 0.1,
    lastPointDistance: 0,

    width: 0.1,
    color: '#ffffff',
    opacity: 1.0,
    fadeRate: 2.0,

    uvScrollSpeed: 1.0,

    pointLifetime: 1000, // 1 second
    pointAges: [],
  };
}
