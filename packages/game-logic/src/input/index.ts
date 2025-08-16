/**
 * Input system exports
 */

export { InputManager } from './input-manager';
export {
  type KeyboardLayout,
  type KeyboardLayoutInfo,
  detectLayout,
  getLayoutDisplayName,
  isAzerty,
} from './keyboard-layout';
export { KeyMappings, type KeyMapping, type GameKeyMappings } from './key-mappings';
export type {
  InputState,
  InputEvent,
  InputConfig,
  InputAction,
  InputListener,
  KeyBinding,
} from './input-types';
