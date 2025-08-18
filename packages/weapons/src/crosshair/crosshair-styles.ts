/**
 * Pre-defined crosshair styles following 2025 FPS best practices
 */

import type { CrosshairConfig } from '../types';

/**
 * Default crosshair configurations for different scenarios
 */
export const DefaultCrosshairConfigs = {
  /**
   * Professional static cross - most popular among pro players
   * Small, precise, high visibility
   */
  professional: {
    style: 'cross',
    behavior: 'static',
    size: 16,
    thickness: 2,
    gap: 4,
    color: '#00ff00', // Green for high visibility
    outlineColor: '#000000',
    opacity: 1.0,
    expandOnFire: false,
    expandOnMove: false,
  } as CrosshairConfig,

  /**
   * Dynamic cross for newer players learning spray control
   * Expands with movement and firing
   */
  dynamic: {
    style: 'cross',
    behavior: 'dynamic',
    size: 20,
    thickness: 2,
    gap: 6,
    color: '#00ffff', // Cyan for visibility on most maps
    outlineColor: '#000000',
    opacity: 0.9,
    expandOnFire: true,
    expandOnMove: true,
    expansionAmount: 1.5,
  } as CrosshairConfig,

  /**
   * Precision dot for sniper weapons
   * Minimal visual obstruction, maximum accuracy
   */
  precision: {
    style: 'dot',
    behavior: 'static',
    size: 4,
    thickness: 4,
    gap: 0,
    color: '#ff0080', // Magenta for contrast
    outlineColor: '#000000',
    opacity: 1.0,
    expandOnFire: false,
    expandOnMove: false,
  } as CrosshairConfig,

  /**
   * Shotgun circle for spread weapons
   * Shows effective range area
   */
  shotgun: {
    style: 'circle',
    behavior: 'weapon-specific',
    size: 24,
    thickness: 2,
    gap: 0,
    color: '#ffff00', // Yellow for shotgun
    outlineColor: '#000000',
    opacity: 0.8,
    expandOnFire: true,
    expandOnMove: false,
    expansionAmount: 1.3,
  } as CrosshairConfig,

  /**
   * Classic DOOM-style cross
   * Nostalgic feel with modern visibility
   */
  classic: {
    style: 'cross',
    behavior: 'static',
    size: 18,
    thickness: 3,
    gap: 3,
    color: '#ffffff', // White like classic DOOM
    outlineColor: '#000000',
    opacity: 1.0,
    expandOnFire: false,
    expandOnMove: false,
  } as CrosshairConfig,

  /**
   * Minimal dot for competitive play
   * Extremely small, doesn't block view
   */
  minimal: {
    style: 'dot',
    behavior: 'static',
    size: 2,
    thickness: 2,
    gap: 0,
    color: '#00ff00',
    outlineColor: '#000000',
    opacity: 1.0,
    expandOnFire: false,
    expandOnMove: false,
  } as CrosshairConfig,
} as const;

/**
 * Weapon-specific crosshair overrides
 */
export const WeaponCrosshairOverrides = new Map([
  // Precision weapons
  ['pistol', { style: 'dot', size: 6, color: '#00ff00' }],
  ['sniper', { style: 'dot', size: 4, color: '#ff0080' }],

  // Spread weapons
  ['shotgun', { style: 'circle', size: 24, color: '#ffff00', expandOnFire: true }],
  ['supershotgun', { style: 'circle', size: 32, color: '#ff8000', expandOnFire: true }],

  // Automatic weapons
  ['chaingun', { style: 'cross', size: 18, expandOnFire: true, expansionAmount: 1.8 }],
  ['minigun', { style: 'cross', size: 20, expandOnFire: true, expansionAmount: 2.0 }],

  // Explosive weapons
  ['rocketlauncher', { style: 'cross', size: 22, color: '#ff4444' }],
  ['grenadelauncher', { style: 'circle', size: 28, color: '#ff6600' }],

  // Energy weapons
  ['plasmarifle', { style: 'cross', size: 16, color: '#0088ff' }],
  ['bfg', { style: 'circle', size: 36, color: '#00ff00' }],
] as Array<[string, Partial<CrosshairConfig>]>);

/**
 * Color presets for different visibility scenarios
 */
export const CrosshairColors = {
  // High contrast colors
  green: '#00ff00', // Best overall visibility
  cyan: '#00ffff', // Good on warm maps
  magenta: '#ff0080', // Good on green maps
  yellow: '#ffff00', // Good on blue maps
  white: '#ffffff', // Classic, good on dark maps
  red: '#ff0000', // Warning/danger indication

  // Professional player favorites
  proGreen: '#00ff41', // Slightly different green
  proCyan: '#00e6ff', // Slightly blue-shifted cyan
  proWhite: '#f0f0f0', // Slightly off-white

  // Themed colors
  doomRed: '#ff2222', // Classic DOOM red
  doomGreen: '#22ff22', // Classic DOOM green
  retro: '#ffaa00', // Retro orange
} as const;

/**
 * Utility function to create weapon-specific crosshair config
 */
export function createWeaponCrosshair(
  weaponName: string,
  baseConfig: CrosshairConfig = DefaultCrosshairConfigs.professional
): CrosshairConfig {
  const override = WeaponCrosshairOverrides.get(weaponName);

  if (!override) {
    return baseConfig;
  }

  return {
    ...baseConfig,
    ...override,
    weaponOverrides: new Map([[weaponName, override]]),
  };
}

/**
 * Utility function to get color by name
 */
export function getCrosshairColor(colorName: keyof typeof CrosshairColors): string {
  return CrosshairColors[colorName];
}
