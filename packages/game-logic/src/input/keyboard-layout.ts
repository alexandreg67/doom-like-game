/**
 * Keyboard layout detection and management for AZERTY/QWERTY support
 */

export type KeyboardLayout = 'azerty' | 'qwerty' | 'unknown';

export interface KeyboardLayoutInfo {
  layout: KeyboardLayout;
  confidence: number;
  detectedLanguage?: string;
}

const AZERTY_LANGUAGES = ['fr', 'fr-FR', 'fr-CA', 'fr-BE', 'fr-CH', 'fr-LU'];

/**
 * Detect keyboard layout using multiple heuristics
 */
export function detectLayout(): KeyboardLayoutInfo {
  // Primary detection: Browser language
  const language = navigator.language || navigator.languages?.[0] || '';
  const isAzertyLanguage = AZERTY_LANGUAGES.some((lang) =>
    language.toLowerCase().startsWith(lang.toLowerCase())
  );

  if (isAzertyLanguage) {
    return {
      layout: 'azerty',
      confidence: 0.9,
      detectedLanguage: language,
    };
  }

  // Secondary detection: Navigator platform (for future enhancement)
  const platform = navigator.platform.toLowerCase();
  const isFrenchSystem = platform.includes('fr');

  if (isFrenchSystem) {
    return {
      layout: 'azerty',
      confidence: 0.7,
      detectedLanguage: language,
    };
  }

  // Default fallback
  return {
    layout: 'qwerty',
    confidence: 0.8,
    detectedLanguage: language,
  };
}

/**
 * Get user-friendly layout name
 */
export function getLayoutDisplayName(layout: KeyboardLayout): string {
  switch (layout) {
    case 'azerty':
      return 'AZERTY (Français)';
    case 'qwerty':
      return 'QWERTY (International)';
    default:
      return 'Unknown';
  }
}

/**
 * Check if layout is French AZERTY
 */
export function isAzerty(layout: KeyboardLayout): boolean {
  return layout === 'azerty';
}
