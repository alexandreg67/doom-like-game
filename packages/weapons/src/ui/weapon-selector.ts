/**
 * Weapon selector UI component
 * Shows available weapons in DOOM-style slot interface
 */

import type { Entity } from '@doom-like/game-logic';
import type { WeaponSlotComponent } from '../components/weapon-component';
import { WeaponFactory } from '../weapons/weapon-factory';

export interface WeaponSelectorConfig {
  position: 'bottom-center' | 'top-center' | 'left-side' | 'right-side';
  style: 'doom' | 'modern' | 'icons';
  showOnlyAvailable: boolean;
  showKeybinds: boolean;
  autoHide: boolean;
  autoHideDelay: number; // ms
  horizontalLayout: boolean;
}

export class WeaponSelector {
  private container: HTMLElement;
  private slotElements: Map<number, HTMLElement> = new Map();
  private config: WeaponSelectorConfig;
  private isVisible = false;
  private hideTimeout?: number;

  constructor(parentElement: HTMLElement, config: WeaponSelectorConfig) {
    this.config = config;
    this.container = this.createContainer(parentElement);
    this.setupSlots();
    this.applyStyles();
    this.hide(); // Start hidden
  }

  /**
   * Update weapon selector based on entity state
   */
  public update(entity: Entity): void {
    const slots = entity.components.get('weaponSlot') as WeaponSlotComponent;

    if (!slots) {
      this.hide();
      return;
    }

    this.updateSlots(slots);
  }

  /**
   * Show weapon selector
   */
  public show(): void {
    this.isVisible = true;
    this.container.style.display = 'flex';

    // Clear auto-hide timeout
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }

    // Set auto-hide if configured
    if (this.config.autoHide) {
      this.hideTimeout = window.setTimeout(() => {
        this.hide();
      }, this.config.autoHideDelay);
    }
  }

  /**
   * Hide weapon selector
   */
  public hide(): void {
    this.isVisible = false;
    this.container.style.display = 'none';

    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
      this.hideTimeout = undefined;
    }
  }

  /**
   * Toggle weapon selector visibility
   */
  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  /**
   * Highlight specific weapon slot
   */
  public highlightSlot(slotNumber: number): void {
    // Remove previous highlights
    this.slotElements.forEach((element) => {
      element.classList.remove('highlighted');
    });

    // Add highlight to specified slot
    const slotElement = this.slotElements.get(slotNumber);
    if (slotElement) {
      slotElement.classList.add('highlighted');
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(newConfig: Partial<WeaponSelectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.applyStyles();
  }

  /**
   * Set custom position (when not using preset positions)
   */
  public setPosition(x: number, y: number): void {
    this.container.style.left = `${x}px`;
    this.container.style.top = `${y}px`;
  }

  /**
   * Cleanup
   */
  public dispose(): void {
    if (this.hideTimeout) {
      clearTimeout(this.hideTimeout);
    }
    this.container.remove();
  }

  private createContainer(parent: HTMLElement): HTMLElement {
    const container = document.createElement('div');
    container.className = 'weapon-selector';
    parent.appendChild(container);
    return container;
  }

  private setupSlots(): void {
    // Create 8 weapon slots (DOOM-style)
    for (let i = 1; i <= 8; i++) {
      const slotElement = this.createSlotElement(i);
      this.slotElements.set(i, slotElement);
      this.container.appendChild(slotElement);
    }
  }

  private createSlotElement(slotNumber: number): HTMLElement {
    const slot = document.createElement('div');
    slot.className = 'weapon-slot';
    slot.dataset.slot = slotNumber.toString();

    // Slot number
    const slotNumberElement = document.createElement('div');
    slotNumberElement.className = 'slot-number';
    slotNumberElement.textContent = slotNumber.toString();
    slot.appendChild(slotNumberElement);

    // Weapon icon/name
    const weaponDisplay = document.createElement('div');
    weaponDisplay.className = 'weapon-display';
    slot.appendChild(weaponDisplay);

    // Keybind display
    if (this.config.showKeybinds) {
      const keybind = document.createElement('div');
      keybind.className = 'weapon-keybind';
      keybind.textContent = slotNumber.toString();
      slot.appendChild(keybind);
    }

    // Add click handler
    slot.addEventListener('click', () => {
      this.onSlotClick(slotNumber);
    });

    return slot;
  }

  private updateSlots(slots: WeaponSlotComponent): void {
    for (let i = 1; i <= 8; i++) {
      const slotElement = this.slotElements.get(i);
      const weapon = slots.slots.get(i);

      if (!slotElement) continue;

      if (weapon) {
        this.updateSlotWithWeapon(slotElement, weapon, i === slots.currentSlot);

        if (this.config.showOnlyAvailable) {
          slotElement.style.display = 'flex';
        }
      } else {
        this.updateSlotEmpty(slotElement);

        if (this.config.showOnlyAvailable) {
          slotElement.style.display = 'none';
        }
      }
    }
  }

  private updateSlotWithWeapon(slotElement: HTMLElement, weapon: any, isCurrent: boolean): void {
    const weaponDisplay = slotElement.querySelector('.weapon-display') as HTMLElement;

    if (!weaponDisplay) return;

    // Update weapon name/icon
    if (this.config.style === 'icons') {
      // TODO: Add weapon icons
      weaponDisplay.innerHTML = `<img src="/icons/${weapon.config.name.toLowerCase()}.png" alt="${weapon.config.name}" />`;
    } else {
      weaponDisplay.textContent = this.getWeaponDisplayName(weapon.config.name);
    }

    // Update ammo display
    const ammoText = `${weapon.currentAmmo}/${weapon.config.clipSize}`;
    weaponDisplay.setAttribute('data-ammo', ammoText);

    // Set current weapon state
    slotElement.classList.toggle('current', isCurrent);
    slotElement.classList.toggle('available', true);
    slotElement.classList.toggle('empty', weapon.currentAmmo === 0);
  }

  private updateSlotEmpty(slotElement: HTMLElement): void {
    const weaponDisplay = slotElement.querySelector('.weapon-display') as HTMLElement;

    if (!weaponDisplay) return;

    weaponDisplay.textContent = '---';
    weaponDisplay.removeAttribute('data-ammo');

    slotElement.classList.remove('current', 'available', 'empty');
  }

  private getWeaponDisplayName(weaponName: string): string {
    // Abbreviate weapon names for compact display
    const abbreviations: Record<string, string> = {
      Pistol: 'PSTL',
      'Enhanced Pistol': 'EPST',
      Shotgun: 'SHOT',
      'Super Shotgun': 'SSHT',
      Chaingun: 'CHNG',
      'Rocket Launcher': 'RCKT',
      'Plasma Rifle': 'PLSM',
      BFG: 'BFG9',
    };

    return abbreviations[weaponName] || weaponName.substring(0, 4).toUpperCase();
  }

  private onSlotClick(slotNumber: number): void {
    // Dispatch custom event for weapon selection
    const event = new CustomEvent('weaponSelect', {
      detail: { slot: slotNumber },
    });
    this.container.dispatchEvent(event);
  }

  private applyStyles(): void {
    this.positionContainer();
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
    container.style.transform = '';

    switch (this.config.position) {
      case 'bottom-center':
        container.style.bottom = '60px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        break;
      case 'top-center':
        container.style.top = '20px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
        break;
      case 'left-side':
        container.style.left = '20px';
        container.style.top = '50%';
        container.style.transform = 'translateY(-50%)';
        break;
      case 'right-side':
        container.style.right = '20px';
        container.style.top = '50%';
        container.style.transform = 'translateY(-50%)';
        break;
    }

    // Set layout direction
    container.style.flexDirection = this.config.horizontalLayout ? 'row' : 'column';
  }

  private applyStyleTheme(): void {
    const container = this.container;

    // Remove existing theme classes
    container.classList.remove('doom-style', 'modern-style', 'icons-style');

    // Add current theme class
    container.classList.add(`${this.config.style}-style`);

    // Apply base styles
    container.style.cssText += `
      display: flex;
      gap: 4px;
      padding: 8px;
      z-index: 1000;
      user-select: none;
    `;

    // Create or update styles
    if (!document.querySelector('#weapon-selector-styles')) {
      this.createStyleSheet();
    }
  }

  private createStyleSheet(): void {
    const style = document.createElement('style');
    style.id = 'weapon-selector-styles';
    style.textContent = `
      .weapon-selector {
        font-family: 'Courier New', monospace;
        font-weight: bold;
      }

      .weapon-slot {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-width: 60px;
        min-height: 60px;
        padding: 8px;
        border: 2px solid transparent;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(0, 0, 0, 0.6);
      }

      .weapon-slot:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .weapon-slot.available {
        border-color: #444;
        color: #fff;
      }

      .weapon-slot.current {
        border-color: #00ff00;
        background: rgba(0, 255, 0, 0.1);
        color: #00ff00;
        text-shadow: 0 0 4px #00ff00;
      }

      .weapon-slot.empty {
        color: #ff4444;
        border-color: #ff4444;
      }

      .weapon-slot.highlighted {
        animation: weapon-highlight 0.5s ease;
      }

      .slot-number {
        font-size: 12px;
        opacity: 0.7;
      }

      .weapon-display {
        font-size: 10px;
        text-align: center;
        margin: 2px 0;
      }

      .weapon-display img {
        width: 24px;
        height: 24px;
        object-fit: contain;
      }

      .weapon-keybind {
        font-size: 10px;
        opacity: 0.5;
      }

      /* DOOM style */
      .weapon-selector.doom-style {
        background: rgba(0, 0, 0, 0.8);
        border: 2px solid #00ff00;
        border-radius: 8px;
      }

      .weapon-selector.doom-style .weapon-slot {
        background: rgba(0, 100, 0, 0.2);
        border-color: #006600;
      }

      .weapon-selector.doom-style .weapon-slot.current {
        border-color: #00ff00;
        box-shadow: 0 0 8px #00ff00;
      }

      /* Modern style */
      .weapon-selector.modern-style {
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        border-radius: 12px;
        border: 1px solid #333;
      }

      .weapon-selector.modern-style .weapon-slot {
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
      }

      .weapon-selector.modern-style .weapon-slot.current {
        background: rgba(0, 150, 255, 0.2);
        border-color: #0096ff;
        box-shadow: 0 0 6px rgba(0, 150, 255, 0.4);
      }

      /* Icons style */
      .weapon-selector.icons-style .weapon-slot {
        min-width: 40px;
        min-height: 40px;
        padding: 4px;
      }

      .weapon-selector.icons-style .slot-number,
      .weapon-selector.icons-style .weapon-keybind {
        display: none;
      }

      @keyframes weapon-highlight {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); box-shadow: 0 0 12px currentColor; }
      }
    `;

    document.head.appendChild(style);
  }
}

/**
 * Default configurations for different use cases
 */
export const WeaponSelectorPresets = {
  doom: {
    position: 'bottom-center',
    style: 'doom',
    showOnlyAvailable: false,
    showKeybinds: true,
    autoHide: true,
    autoHideDelay: 3000,
    horizontalLayout: true,
  } as WeaponSelectorConfig,

  modern: {
    position: 'bottom-center',
    style: 'modern',
    showOnlyAvailable: true,
    showKeybinds: true,
    autoHide: true,
    autoHideDelay: 2500,
    horizontalLayout: true,
  } as WeaponSelectorConfig,

  compact: {
    position: 'right-side',
    style: 'icons',
    showOnlyAvailable: true,
    showKeybinds: false,
    autoHide: false,
    autoHideDelay: 0,
    horizontalLayout: false,
  } as WeaponSelectorConfig,
} as const;
