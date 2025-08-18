/**
 * Crosshair manager handles crosshair state and weapon-specific configurations
 */

import type { CrosshairConfig, WeaponConfig, WeaponState } from '../types';
import { CrosshairRenderer } from './crosshair-renderer';

export class CrosshairManager {
  private renderer: CrosshairRenderer;
  private baseConfig: CrosshairConfig;
  private currentWeaponConfig?: WeaponConfig;
  private movementExpansion = 1.0;
  private firingExpansion = 1.0;

  constructor(parentElement: HTMLElement, config: CrosshairConfig) {
    this.baseConfig = config;
    this.renderer = new CrosshairRenderer(parentElement, config);
  }

  /**
   * Update base crosshair configuration
   */
  public updateConfig(config: Partial<CrosshairConfig>): void {
    this.baseConfig = { ...this.baseConfig, ...config };
    this.updateRenderer();
  }

  /**
   * Set current weapon configuration
   */
  public setWeapon(weaponConfig: WeaponConfig): void {
    this.currentWeaponConfig = weaponConfig;
    this.updateRenderer();
  }

  /**
   * Update crosshair based on weapon state
   */
  public updateWeaponState(state: WeaponState): void {
    switch (state) {
      case 'firing':
        this.onWeaponFire();
        break;
      case 'reloading':
        this.onWeaponReload();
        break;
      case 'empty':
        this.onWeaponEmpty();
        break;
      case 'idle':
        this.onWeaponIdle();
        break;
    }
  }

  /**
   * Update crosshair based on player movement
   */
  public updateMovement(isMoving: boolean, velocity: number): void {
    if (!this.baseConfig.expandOnMove) return;

    const maxExpansion = this.baseConfig.expansionAmount || 1.3;
    const normalizedVelocity = Math.min(velocity / 10, 1); // Normalize to 0-1

    this.movementExpansion = isMoving ? 1 + (maxExpansion - 1) * normalizedVelocity : 1;

    this.updateDynamicSize();
  }

  /**
   * Update crosshair based on weapon spread
   */
  public updateSpread(currentSpread: number, maxSpread: number): void {
    if (this.baseConfig.behavior !== 'dynamic') return;

    const spreadRatio = currentSpread / maxSpread;
    const expansionAmount = this.baseConfig.expansionAmount || 1.5;

    this.firingExpansion = 1 + (expansionAmount - 1) * spreadRatio;
    this.updateDynamicSize();
  }

  /**
   * Show or hide crosshair
   */
  public setVisible(visible: boolean): void {
    this.renderer.setVisible(visible);
  }

  /**
   * Get renderer for advanced customization
   */
  public getRenderer(): CrosshairRenderer {
    return this.renderer;
  }

  /**
   * Cleanup manager
   */
  public dispose(): void {
    this.renderer.dispose();
  }

  private onWeaponFire(): void {
    // Trigger expansion animation
    this.renderer.animateExpansion(150);

    // Update spread-based expansion if dynamic
    if (this.baseConfig.behavior === 'dynamic' && this.currentWeaponConfig) {
      const spreadIncrease = this.currentWeaponConfig.spreadIncrease;
      // This would be updated by the weapon system with actual spread values
    }
  }

  private onWeaponReload(): void {
    // Could add reload-specific crosshair effects
    // For now, keep current behavior
  }

  private onWeaponEmpty(): void {
    // Could change crosshair color or add visual indicator
    // For example, make crosshair red or add pulsing effect
  }

  private onWeaponIdle(): void {
    // Reset to base state
    this.firingExpansion = 1;
    this.updateDynamicSize();
  }

  private updateRenderer(): void {
    let effectiveConfig = { ...this.baseConfig };

    // Apply weapon-specific overrides
    if (this.currentWeaponConfig && this.baseConfig.behavior === 'weapon-specific') {
      const weaponName = this.currentWeaponConfig.name;
      const weaponOverride = this.baseConfig.weaponOverrides?.get(weaponName);

      if (weaponOverride) {
        effectiveConfig = { ...effectiveConfig, ...weaponOverride };
      }

      // Use weapon's crosshair style if specified
      effectiveConfig.style = this.currentWeaponConfig.crosshairStyle;
    }

    this.renderer.updateConfig(effectiveConfig);
  }

  private updateDynamicSize(): void {
    const totalExpansion = Math.max(this.movementExpansion, this.firingExpansion);
    this.renderer.setDynamicSize(totalExpansion);
  }
}
