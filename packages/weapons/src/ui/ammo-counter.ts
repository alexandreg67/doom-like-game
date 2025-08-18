/**
 * Ammo counter UI component
 * Displays current ammo and reserves in DOOM style
 */

import type { Entity } from '@doom-like/game-logic';
import type { AmmoComponent } from '../components/ammo-component';
import type { WeaponComponent } from '../components/weapon-component';

export interface AmmoCounterConfig {
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom';
  style: 'doom' | 'modern' | 'minimal';
  showReserves: boolean;
  showPercentage: boolean;
  lowAmmoThreshold: number; // Percentage at which to show warning
  criticalAmmoThreshold: number; // Percentage at which to show critical warning
  animateChanges: boolean;
}

export class AmmoCounter {
  private container: HTMLElement;
  private currentAmmoElement!: HTMLElement;
  private reserveAmmoElement!: HTMLElement;
  private ammoBarElement!: HTMLElement;
  private config: AmmoCounterConfig;
  private lastAmmoCount = 0;
  private lastReserveCount = 0;

  constructor(parentElement: HTMLElement, config: AmmoCounterConfig) {
    this.config = config;
    this.container = this.createContainer(parentElement);
    this.setupElements();
    this.applyStyles();
  }

  /**
   * Update ammo display based on entity state
   */
  public update(entity: Entity): void {
    const weapon = entity.components.get('weapon') as WeaponComponent;
    const ammo = entity.components.get('ammo') as AmmoComponent;

    if (!weapon || !ammo) {
      this.hide();
      return;
    }

    this.show();
    this.updateAmmoDisplay(weapon, ammo);
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<AmmoCounterConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyStyles();
  }

  /**
   * Show ammo counter
   */
  public show(): void {
    this.container.style.display = 'block';
  }

  /**
   * Hide ammo counter
   */
  public hide(): void {
    this.container.style.display = 'none';
  }

  /**
   * Set position manually (when using custom position)
   */
  public setPosition(x: number, y: number): void {
    if (this.config.position === 'custom') {
      this.container.style.left = `${x}px`;
      this.container.style.top = `${y}px`;
    }
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    this.container.remove();
  }

  private createContainer(parent: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    container.className = 'ammo-counter';
    parent.appendChild(container);
    return container;
  }

  private setupElements(): void {
    // Current ammo display
    this.currentAmmoElement = document.createElement('div');
    this.currentAmmoElement.className = 'current-ammo';
    this.container.appendChild(this.currentAmmoElement);

    // Separator
    if (this.config.showReserves) {
      const separator = document.createElement('div');
      separator.className = 'ammo-separator';
      separator.textContent = '/';
      this.container.appendChild(separator);

      // Reserve ammo display
      this.reserveAmmoElement = document.createElement('div');
      this.reserveAmmoElement.className = 'reserve-ammo';
      this.container.appendChild(this.reserveAmmoElement);
    }

    // Ammo bar (for visual indication)
    if (this.config.style !== 'minimal') {
      this.ammoBarElement = document.createElement('div');
      this.ammoBarElement.className = 'ammo-bar';

      const barFill = document.createElement('div');
      barFill.className = 'ammo-bar-fill';
      this.ammoBarElement.appendChild(barFill);

      this.container.appendChild(this.ammoBarElement);
    }
  }

  private updateAmmoDisplay(weapon: WeaponComponent, ammo: AmmoComponent): void {
    const currentAmmo = weapon.currentAmmo;
    const maxAmmo = weapon.config.clipSize;
    const reserveAmmo = ammo.ammoReserves.get(weapon.config.ammoType) || 0;

    // Update current ammo
    this.updateCurrentAmmo(currentAmmo, maxAmmo);

    // Update reserve ammo
    if (this.config.showReserves) {
      this.updateReserveAmmo(reserveAmmo, ammo, weapon.config.ammoType);
    }

    // Update ammo bar
    if (this.ammoBarElement) {
      this.updateAmmoBar(currentAmmo, maxAmmo);
    }

    // Apply warning states
    this.updateWarningStates(currentAmmo, maxAmmo, reserveAmmo);

    // Animate changes
    if (this.config.animateChanges) {
      this.animateAmmoChange(currentAmmo, reserveAmmo);
    }

    // Update cached values
    this.lastAmmoCount = currentAmmo;
    this.lastReserveCount = reserveAmmo;
  }

  private updateCurrentAmmo(current: number, max: number): void {
    let displayText = current.toString();

    if (this.config.showPercentage) {
      const percentage = Math.round((current / max) * 100);
      displayText += ` (${percentage}%)`;
    }

    this.currentAmmoElement.textContent = displayText;
  }

  private updateReserveAmmo(reserve: number, ammo: AmmoComponent, ammoType: any): void {
    if (!this.reserveAmmoElement) return;

    let displayText = reserve.toString();

    // Show infinity symbol for infinite ammo
    if (ammo.infiniteAmmo || ammo.infiniteAmmoTypes.has(ammoType)) {
      displayText = '∞';
    }

    this.reserveAmmoElement.textContent = displayText;
  }

  private updateAmmoBar(current: number, max: number): void {
    if (!this.ammoBarElement) return;

    const percentage = (current / max) * 100;
    const fillElement = this.ammoBarElement.querySelector('.ammo-bar-fill') as HTMLElement;

    if (fillElement) {
      fillElement.style.width = `${percentage}%`;
    }
  }

  private updateWarningStates(current: number, max: number, reserve: number): void {
    const percentage = (current / max) * 100;

    // Remove existing warning classes
    this.container.classList.remove('low-ammo', 'critical-ammo', 'no-ammo');

    if (current === 0) {
      this.container.classList.add('no-ammo');
    } else if (percentage <= this.config.criticalAmmoThreshold) {
      this.container.classList.add('critical-ammo');
    } else if (percentage <= this.config.lowAmmoThreshold) {
      this.container.classList.add('low-ammo');
    }

    // Add no-reserves warning
    if (reserve === 0) {
      this.container.classList.add('no-reserves');
    } else {
      this.container.classList.remove('no-reserves');
    }
  }

  private animateAmmoChange(current: number, reserve: number): void {
    // Animate current ammo change
    if (current !== this.lastAmmoCount) {
      this.currentAmmoElement.classList.add('ammo-changed');
      setTimeout(() => {
        this.currentAmmoElement.classList.remove('ammo-changed');
      }, 200);
    }

    // Animate reserve ammo change
    if (reserve !== this.lastReserveCount && this.reserveAmmoElement) {
      this.reserveAmmoElement.classList.add('ammo-changed');
      setTimeout(() => {
        this.reserveAmmoElement.classList.remove('ammo-changed');
      }, 200);
    }
  }

  private applyStyles(): void {
    // Position the container
    this.positionContainer();

    // Apply style theme
    this.applyStyleTheme();
  }

  private positionContainer(): void {
    const container = this.container;

    // Reset positioning
    container.style.position = 'fixed';
    container.style.left = '';
    container.style.right = '';
    container.style.top = '';
    container.style.bottom = '';

    switch (this.config.position) {
      case 'bottom-right':
        container.style.bottom = '20px';
        container.style.right = '20px';
        break;
      case 'bottom-left':
        container.style.bottom = '20px';
        container.style.left = '20px';
        break;
      case 'top-right':
        container.style.top = '20px';
        container.style.right = '20px';
        break;
      case 'top-left':
        container.style.top = '20px';
        container.style.left = '20px';
        break;
      case 'custom':
        // Position will be set manually via setPosition
        break;
    }
  }

  private applyStyleTheme(): void {
    const container = this.container;

    // Remove existing theme classes
    container.classList.remove('doom-style', 'modern-style', 'minimal-style');

    // Add current theme class
    container.classList.add(`${this.config.style}-style`);

    // Apply base styles
    container.style.cssText += `
      font-family: 'Courier New', monospace;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 4px;
      z-index: 1000;
      user-select: none;
    `;

    // Style-specific CSS
    switch (this.config.style) {
      case 'doom':
        container.style.cssText += `
          background: rgba(0, 0, 0, 0.8);
          color: #00ff00;
          border: 2px solid #00ff00;
          font-size: 18px;
          text-shadow: 0 0 4px #00ff00;
        `;
        break;

      case 'modern':
        container.style.cssText += `
          background: rgba(0, 0, 0, 0.6);
          color: #ffffff;
          border: 1px solid #444;
          font-size: 16px;
          backdrop-filter: blur(4px);
        `;
        break;

      case 'minimal':
        container.style.cssText += `
          background: none;
          color: #ffffff;
          font-size: 14px;
          text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        `;
        break;
    }

    // Warning state styles
    const style = document.createElement('style');
    style.textContent = `
      .ammo-counter.low-ammo {
        color: #ffaa00 !important;
        border-color: #ffaa00 !important;
      }
      
      .ammo-counter.critical-ammo {
        color: #ff4444 !important;
        border-color: #ff4444 !important;
        animation: ammo-pulse 1s infinite;
      }
      
      .ammo-counter.no-ammo {
        color: #ff0000 !important;
        border-color: #ff0000 !important;
        animation: ammo-flash 0.5s infinite;
      }
      
      .ammo-changed {
        animation: ammo-change-flash 0.2s ease-out;
      }
      
      @keyframes ammo-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      
      @keyframes ammo-flash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      
      @keyframes ammo-change-flash {
        0% { transform: scale(1); }
        50% { transform: scale(1.1); }
        100% { transform: scale(1); }
      }
      
      .ammo-bar {
        width: 60px;
        height: 6px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 3px;
        overflow: hidden;
      }
      
      .ammo-bar-fill {
        height: 100%;
        background: currentColor;
        transition: width 0.2s ease;
      }
    `;

    if (!document.querySelector('#ammo-counter-styles')) {
      style.id = 'ammo-counter-styles';
      document.head.appendChild(style);
    }
  }
}

/**
 * Default configurations for different use cases
 */
export const AmmoCounterPresets = {
  doom: {
    position: 'bottom-right',
    style: 'doom',
    showReserves: true,
    showPercentage: false,
    lowAmmoThreshold: 30,
    criticalAmmoThreshold: 10,
    animateChanges: true,
  } as AmmoCounterConfig,

  modern: {
    position: 'bottom-right',
    style: 'modern',
    showReserves: true,
    showPercentage: true,
    lowAmmoThreshold: 25,
    criticalAmmoThreshold: 10,
    animateChanges: true,
  } as AmmoCounterConfig,

  minimal: {
    position: 'bottom-right',
    style: 'minimal',
    showReserves: false,
    showPercentage: false,
    lowAmmoThreshold: 20,
    criticalAmmoThreshold: 5,
    animateChanges: false,
  } as AmmoCounterConfig,
} as const;
