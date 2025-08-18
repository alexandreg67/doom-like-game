/**
 * Key mappings for different keyboard layouts and game actions
 */

import type { KeyboardLayout } from './keyboard-layout';

export interface KeyMapping {
  readonly primary: string;
  readonly secondary?: string;
  readonly displayName: string;
}

export interface GameKeyMappings {
  // Movement
  readonly moveForward: KeyMapping;
  readonly moveBackward: KeyMapping;
  readonly moveLeft: KeyMapping;
  readonly moveRight: KeyMapping;
  readonly jump: KeyMapping;
  readonly crouch: KeyMapping;
  readonly run: KeyMapping;

  // Combat
  readonly fire: KeyMapping;
  readonly altFire: KeyMapping;
  readonly reload: KeyMapping;
  readonly nextWeapon: KeyMapping;
  readonly prevWeapon: KeyMapping;

  // Weapon selection (DOOM-style slots 1-8)
  readonly selectWeapon1: KeyMapping;
  readonly selectWeapon2: KeyMapping;
  readonly selectWeapon3: KeyMapping;
  readonly selectWeapon4: KeyMapping;
  readonly selectWeapon5: KeyMapping;
  readonly selectWeapon6: KeyMapping;
  readonly selectWeapon7: KeyMapping;
  readonly selectWeapon8: KeyMapping;

  // Interface
  readonly pause: KeyMapping;
  readonly map: KeyMapping;
  readonly interact: KeyMapping;
  readonly flashlight: KeyMapping;
}

/**
 * Predefined key mappings for different keyboard layouts
 */
export namespace KeyMappings {
  /**
   * AZERTY keyboard layout (French)
   */
  export const AZERTY: GameKeyMappings = {
    // Movement - Natural AZERTY positioning
    moveForward: { primary: 'KeyZ', displayName: 'Z' },
    moveBackward: { primary: 'KeyS', displayName: 'S' },
    moveLeft: { primary: 'KeyQ', displayName: 'Q' },
    moveRight: { primary: 'KeyD', displayName: 'D' },
    jump: { primary: 'Space', displayName: 'Espace' },
    crouch: { primary: 'ControlLeft', secondary: 'KeyC', displayName: 'Ctrl' },
    run: { primary: 'ShiftLeft', displayName: 'Maj' },

    // Combat
    fire: { primary: 'MouseLeft', displayName: 'Clic Gauche' },
    altFire: { primary: 'MouseRight', displayName: 'Clic Droit' },
    reload: { primary: 'KeyR', displayName: 'R' },
    nextWeapon: { primary: 'KeyW', displayName: 'W' },
    prevWeapon: { primary: 'KeyA', displayName: 'A' },

    // Weapon selection (DOOM-style slots)
    selectWeapon1: { primary: 'Digit1', displayName: '1' },
    selectWeapon2: { primary: 'Digit2', displayName: '2' },
    selectWeapon3: { primary: 'Digit3', displayName: '3' },
    selectWeapon4: { primary: 'Digit4', displayName: '4' },
    selectWeapon5: { primary: 'Digit5', displayName: '5' },
    selectWeapon6: { primary: 'Digit6', displayName: '6' },
    selectWeapon7: { primary: 'Digit7', displayName: '7' },
    selectWeapon8: { primary: 'Digit8', displayName: '8' },

    // Interface
    pause: { primary: 'Escape', displayName: 'Échap' },
    map: { primary: 'Tab', displayName: 'Tab' },
    interact: { primary: 'KeyE', displayName: 'E' },
    flashlight: { primary: 'KeyF', displayName: 'F' },
  };

  /**
   * QWERTY keyboard layout (International)
   */
  export const QWERTY: GameKeyMappings = {
    // Movement - Traditional WASD
    moveForward: { primary: 'KeyW', displayName: 'W' },
    moveBackward: { primary: 'KeyS', displayName: 'S' },
    moveLeft: { primary: 'KeyA', displayName: 'A' },
    moveRight: { primary: 'KeyD', displayName: 'D' },
    jump: { primary: 'Space', displayName: 'Space' },
    crouch: { primary: 'ControlLeft', secondary: 'KeyC', displayName: 'Ctrl' },
    run: { primary: 'ShiftLeft', displayName: 'Shift' },

    // Combat
    fire: { primary: 'MouseLeft', displayName: 'Left Click' },
    altFire: { primary: 'MouseRight', displayName: 'Right Click' },
    reload: { primary: 'KeyR', displayName: 'R' },
    nextWeapon: { primary: 'KeyE', displayName: 'E' },
    prevWeapon: { primary: 'KeyQ', displayName: 'Q' },

    // Weapon selection (DOOM-style slots)
    selectWeapon1: { primary: 'Digit1', displayName: '1' },
    selectWeapon2: { primary: 'Digit2', displayName: '2' },
    selectWeapon3: { primary: 'Digit3', displayName: '3' },
    selectWeapon4: { primary: 'Digit4', displayName: '4' },
    selectWeapon5: { primary: 'Digit5', displayName: '5' },
    selectWeapon6: { primary: 'Digit6', displayName: '6' },
    selectWeapon7: { primary: 'Digit7', displayName: '7' },
    selectWeapon8: { primary: 'Digit8', displayName: '8' },

    // Interface
    pause: { primary: 'Escape', displayName: 'Esc' },
    map: { primary: 'Tab', displayName: 'Tab' },
    interact: { primary: 'KeyF', displayName: 'F' },
    flashlight: { primary: 'KeyT', displayName: 'T' },
  };

  /**
   * Get key mappings for specified layout
   */
  export function getForLayout(layout: KeyboardLayout): GameKeyMappings {
    switch (layout) {
      case 'azerty':
        return AZERTY;
      default:
        return QWERTY;
    }
  }

  /**
   * Create custom key mappings (for user customization)
   */
  export function createCustom(
    base: GameKeyMappings,
    overrides: Partial<GameKeyMappings>
  ): GameKeyMappings {
    return { ...base, ...overrides };
  }

  /**
   * Get all possible action keys for collision detection
   */
  export function getAllKeys(mappings: GameKeyMappings): string[] {
    const keys: string[] = [];

    for (const action of Object.values(mappings)) {
      keys.push(action.primary);
      if (action.secondary) {
        keys.push(action.secondary);
      }
    }

    return [...new Set(keys)]; // Remove duplicates
  }
}
