import type { Component } from '@doom-like/game-logic';
import type { EnemyStats } from '../types';

/**
 * EnemyStats component - manages enemy health, damage, and physical properties
 */
export interface EnemyStatsComponent extends Component {
  id: 'enemyStats';

  /** Maximum health points */
  maxHealth: number;

  /** Current health points */
  currentHealth: number;

  /** Damage dealt by enemy attacks */
  attackDamage: number;

  /** Physical radius for collision detection (meters) */
  radius: number;

  /** Physical height for collision detection (meters) */
  height: number;

  /** Experience points awarded when killed */
  xpValue: number;

  /** Whether enemy is currently invulnerable */
  isInvulnerable: boolean;

  /** Time remaining for invulnerability (seconds) */
  invulnerabilityTime: number;

  /** Damage multiplier (for difficulty scaling) */
  damageMultiplier: number;

  /** Health regeneration rate (HP per second, 0 = no regen) */
  healthRegenRate: number;
}

/**
 * Factory function to create EnemyStats component
 */
export function createEnemyStatsComponent(
  baseStats: EnemyStats,
  overrides?: Partial<EnemyStats>
): EnemyStatsComponent {
  const stats = { ...baseStats, ...overrides };

  return {
    id: 'enemyStats',
    maxHealth: stats.maxHealth,
    currentHealth: stats.currentHealth || stats.maxHealth,
    attackDamage: stats.attackDamage,
    radius: stats.radius,
    height: stats.height,
    xpValue: stats.xpValue,
    isInvulnerable: false,
    invulnerabilityTime: 0,
    damageMultiplier: 1.0,
    healthRegenRate: 0,
  };
}

/**
 * Utility functions for enemy stats management
 */
function takeDamage(statsComponent: EnemyStatsComponent, damage: number, canKill = true): number {
  if (statsComponent.isInvulnerable || damage <= 0) {
    return 0;
  }

  const actualDamage = Math.max(0, damage);
  statsComponent.currentHealth -= actualDamage;

  if (!canKill && statsComponent.currentHealth <= 0) {
    statsComponent.currentHealth = 1;
    return statsComponent.maxHealth - 1;
  }

  statsComponent.currentHealth = Math.max(0, statsComponent.currentHealth);
  return actualDamage;
}

function heal(statsComponent: EnemyStatsComponent, healAmount: number): number {
  if (healAmount <= 0 || statsComponent.currentHealth >= statsComponent.maxHealth) {
    return 0;
  }

  const oldHealth = statsComponent.currentHealth;
  statsComponent.currentHealth = Math.min(
    statsComponent.maxHealth,
    statsComponent.currentHealth + healAmount
  );

  return statsComponent.currentHealth - oldHealth;
}

function setInvulnerable(statsComponent: EnemyStatsComponent, duration: number): void {
  statsComponent.isInvulnerable = true;
  statsComponent.invulnerabilityTime = duration;
}

function updateInvulnerability(statsComponent: EnemyStatsComponent, deltaTime: number): void {
  if (statsComponent.isInvulnerable) {
    statsComponent.invulnerabilityTime -= deltaTime;
    if (statsComponent.invulnerabilityTime <= 0) {
      statsComponent.isInvulnerable = false;
      statsComponent.invulnerabilityTime = 0;
    }
  }
}

function applyRegeneration(statsComponent: EnemyStatsComponent, deltaTime: number): void {
  if (
    statsComponent.healthRegenRate > 0 &&
    statsComponent.currentHealth < statsComponent.maxHealth &&
    statsComponent.currentHealth > 0
  ) {
    const regenAmount = statsComponent.healthRegenRate * deltaTime;
    heal(statsComponent, regenAmount);
  }
}

function isDead(statsComponent: EnemyStatsComponent): boolean {
  return statsComponent.currentHealth <= 0;
}

function isAtFullHealth(statsComponent: EnemyStatsComponent): boolean {
  return statsComponent.currentHealth >= statsComponent.maxHealth;
}

function getHealthPercentage(statsComponent: EnemyStatsComponent): number {
  return statsComponent.currentHealth / statsComponent.maxHealth;
}

function getActualDamage(statsComponent: EnemyStatsComponent): number {
  return statsComponent.attackDamage * statsComponent.damageMultiplier;
}

function setDamageMultiplier(statsComponent: EnemyStatsComponent, multiplier: number): void {
  statsComponent.damageMultiplier = Math.max(0, multiplier);
}

function resetHealth(statsComponent: EnemyStatsComponent): void {
  statsComponent.currentHealth = statsComponent.maxHealth;
  statsComponent.isInvulnerable = false;
  statsComponent.invulnerabilityTime = 0;
}

export const EnemyStatsUtils = {
  takeDamage,
  heal,
  setInvulnerable,
  updateInvulnerability,
  applyRegeneration,
  isDead,
  isAtFullHealth,
  getHealthPercentage,
  getActualDamage,
  setDamageMultiplier,
  resetHealth,
} as const;
