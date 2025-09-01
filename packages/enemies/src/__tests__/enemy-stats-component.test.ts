import { beforeEach, describe, expect, it } from 'vitest';
import { EnemyStatsUtils, createEnemyStatsComponent } from '../components/enemy-stats-component';
import type { EnemyStats } from '../types';

describe('EnemyStatsComponent', () => {
  let baseStats: EnemyStats;

  beforeEach(() => {
    baseStats = {
      maxHealth: 100,
      currentHealth: 100,
      attackDamage: 25,
      radius: 0.5,
      height: 1.8,
      xpValue: 50,
    };
  });

  describe('createEnemyStatsComponent', () => {
    it('should create stats component with base stats', () => {
      const component = createEnemyStatsComponent(baseStats);

      expect(component.id).toBe('enemyStats');
      expect(component.maxHealth).toBe(100);
      expect(component.currentHealth).toBe(100);
      expect(component.attackDamage).toBe(25);
      expect(component.radius).toBe(0.5);
      expect(component.height).toBe(1.8);
      expect(component.xpValue).toBe(50);
      expect(component.isInvulnerable).toBe(false);
      expect(component.invulnerabilityTime).toBe(0);
      expect(component.damageMultiplier).toBe(1.0);
      expect(component.healthRegenRate).toBe(0);
    });

    it('should apply overrides to base stats', () => {
      const overrides = {
        maxHealth: 150,
        attackDamage: 30,
      };

      const component = createEnemyStatsComponent(baseStats, overrides);

      expect(component.maxHealth).toBe(150);
      expect(component.attackDamage).toBe(30);
      expect(component.currentHealth).toBe(150); // Should match maxHealth
      expect(component.radius).toBe(0.5); // Unchanged
    });

    it('should use currentHealth from overrides if specified', () => {
      const overrides = {
        currentHealth: 75,
      };

      const component = createEnemyStatsComponent(baseStats, overrides);

      expect(component.currentHealth).toBe(75);
    });
  });

  describe('EnemyStatsUtils', () => {
    let component: ReturnType<typeof createEnemyStatsComponent>;

    beforeEach(() => {
      component = createEnemyStatsComponent(baseStats);
    });

    describe('takeDamage', () => {
      it('should reduce health by damage amount', () => {
        const damageDealt = EnemyStatsUtils.takeDamage(component, 30);

        expect(component.currentHealth).toBe(70);
        expect(damageDealt).toBe(30);
      });

      it('should not deal damage when invulnerable', () => {
        component.isInvulnerable = true;

        const damageDealt = EnemyStatsUtils.takeDamage(component, 30);

        expect(component.currentHealth).toBe(100);
        expect(damageDealt).toBe(0);
      });

      it('should not deal negative damage', () => {
        const damageDealt = EnemyStatsUtils.takeDamage(component, -10);

        expect(component.currentHealth).toBe(100);
        expect(damageDealt).toBe(0);
      });

      it('should not reduce health below 0', () => {
        const damageDealt = EnemyStatsUtils.takeDamage(component, 150);

        expect(component.currentHealth).toBe(0);
        expect(damageDealt).toBe(150);
      });

      it('should not kill when canKill is false', () => {
        const damageDealt = EnemyStatsUtils.takeDamage(component, 150, false);

        expect(component.currentHealth).toBe(1);
        expect(damageDealt).toBe(99); // maxHealth - 1
      });

      it('should handle zero damage', () => {
        const damageDealt = EnemyStatsUtils.takeDamage(component, 0);

        expect(component.currentHealth).toBe(100);
        expect(damageDealt).toBe(0);
      });
    });

    describe('heal', () => {
      it('should increase health by heal amount', () => {
        component.currentHealth = 50;

        const healingDone = EnemyStatsUtils.heal(component, 30);

        expect(component.currentHealth).toBe(80);
        expect(healingDone).toBe(30);
      });

      it('should not heal above max health', () => {
        component.currentHealth = 90;

        const healingDone = EnemyStatsUtils.heal(component, 20);

        expect(component.currentHealth).toBe(100);
        expect(healingDone).toBe(10);
      });

      it('should not heal when at full health', () => {
        const healingDone = EnemyStatsUtils.heal(component, 20);

        expect(component.currentHealth).toBe(100);
        expect(healingDone).toBe(0);
      });

      it('should not heal negative amounts', () => {
        component.currentHealth = 50;

        const healingDone = EnemyStatsUtils.heal(component, -10);

        expect(component.currentHealth).toBe(50);
        expect(healingDone).toBe(0);
      });
    });

    describe('setInvulnerable', () => {
      it('should set invulnerability with duration', () => {
        EnemyStatsUtils.setInvulnerable(component, 2.0);

        expect(component.isInvulnerable).toBe(true);
        expect(component.invulnerabilityTime).toBe(2.0);
      });
    });

    describe('updateInvulnerability', () => {
      it('should count down invulnerability timer', () => {
        component.isInvulnerable = true;
        component.invulnerabilityTime = 2.0;

        EnemyStatsUtils.updateInvulnerability(component, 0.5);

        expect(component.isInvulnerable).toBe(true);
        expect(component.invulnerabilityTime).toBe(1.5);
      });

      it('should remove invulnerability when timer expires', () => {
        component.isInvulnerable = true;
        component.invulnerabilityTime = 0.5;

        EnemyStatsUtils.updateInvulnerability(component, 1.0);

        expect(component.isInvulnerable).toBe(false);
        expect(component.invulnerabilityTime).toBe(0);
      });

      it('should not update when not invulnerable', () => {
        EnemyStatsUtils.updateInvulnerability(component, 1.0);

        expect(component.isInvulnerable).toBe(false);
        expect(component.invulnerabilityTime).toBe(0);
      });
    });

    describe('applyRegeneration', () => {
      it('should regenerate health when below max', () => {
        component.currentHealth = 50;
        component.healthRegenRate = 10; // 10 HP per second

        EnemyStatsUtils.applyRegeneration(component, 0.5); // 0.5 seconds

        expect(component.currentHealth).toBe(55); // 50 + (10 * 0.5)
      });

      it('should not regenerate when at full health', () => {
        component.healthRegenRate = 10;

        EnemyStatsUtils.applyRegeneration(component, 1.0);

        expect(component.currentHealth).toBe(100);
      });

      it('should not regenerate when dead', () => {
        component.currentHealth = 0;
        component.healthRegenRate = 10;

        EnemyStatsUtils.applyRegeneration(component, 1.0);

        expect(component.currentHealth).toBe(0);
      });

      it('should not regenerate above max health', () => {
        component.currentHealth = 95;
        component.healthRegenRate = 10;

        EnemyStatsUtils.applyRegeneration(component, 1.0);

        expect(component.currentHealth).toBe(100);
      });
    });

    describe('status checks', () => {
      it('should correctly identify dead enemy', () => {
        component.currentHealth = 0;

        expect(EnemyStatsUtils.isDead(component)).toBe(true);
      });

      it('should correctly identify alive enemy', () => {
        expect(EnemyStatsUtils.isDead(component)).toBe(false);
      });

      it('should correctly identify full health', () => {
        expect(EnemyStatsUtils.isAtFullHealth(component)).toBe(true);

        component.currentHealth = 90;
        expect(EnemyStatsUtils.isAtFullHealth(component)).toBe(false);
      });

      it('should calculate health percentage correctly', () => {
        expect(EnemyStatsUtils.getHealthPercentage(component)).toBe(1.0);

        component.currentHealth = 50;
        expect(EnemyStatsUtils.getHealthPercentage(component)).toBe(0.5);

        component.currentHealth = 0;
        expect(EnemyStatsUtils.getHealthPercentage(component)).toBe(0.0);
      });
    });

    describe('damage multiplier', () => {
      it('should calculate actual damage with multiplier', () => {
        component.damageMultiplier = 1.5;

        const actualDamage = EnemyStatsUtils.getActualDamage(component);

        expect(actualDamage).toBe(37.5); // 25 * 1.5
      });

      it('should set damage multiplier', () => {
        EnemyStatsUtils.setDamageMultiplier(component, 2.0);

        expect(component.damageMultiplier).toBe(2.0);
      });

      it('should not allow negative damage multiplier', () => {
        EnemyStatsUtils.setDamageMultiplier(component, -0.5);

        expect(component.damageMultiplier).toBe(0);
      });
    });

    describe('resetHealth', () => {
      it('should reset to full health and clear invulnerability', () => {
        component.currentHealth = 30;
        component.isInvulnerable = true;
        component.invulnerabilityTime = 1.0;

        EnemyStatsUtils.resetHealth(component);

        expect(component.currentHealth).toBe(100);
        expect(component.isInvulnerable).toBe(false);
        expect(component.invulnerabilityTime).toBe(0);
      });
    });
  });
});
