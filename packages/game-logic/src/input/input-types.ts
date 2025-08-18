/**
 * Type definitions for input system
 */

export interface InputState {
  // Movement
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
  jump: boolean;
  crouch: boolean;
  run: boolean;

  // Combat
  fire: boolean;
  altFire: boolean;
  reload: boolean;
  nextWeapon: boolean;
  prevWeapon: boolean;

  // Weapon selection (DOOM-style slots 1-8)
  selectWeapon1: boolean;
  selectWeapon2: boolean;
  selectWeapon3: boolean;
  selectWeapon4: boolean;
  selectWeapon5: boolean;
  selectWeapon6: boolean;
  selectWeapon7: boolean;
  selectWeapon8: boolean;

  // Interface
  pause: boolean;
  map: boolean;
  interact: boolean;
  flashlight: boolean;

  // Mouse
  mouseDeltaX: number;
  mouseDeltaY: number;
  mouseX: number;
  mouseY: number;
  isPointerLocked: boolean;
}

export interface InputEvent {
  type: 'keydown' | 'keyup' | 'mousemove' | 'mousedown' | 'mouseup' | 'wheel';
  code?: string;
  button?: number;
  deltaX?: number;
  deltaY?: number;
  clientX?: number;
  clientY?: number;
  timestamp: number;
}

export interface InputConfig {
  mouseSensitivity: number;
  mouseInvertY: boolean;
  keyRepeatDelay: number;
  keyRepeatRate: number;
  deadzone: number; // For future gamepad support
  weaponSwitchTimeoutMs: number;
}

export type InputAction = keyof Omit<
  InputState,
  'mouseDeltaX' | 'mouseDeltaY' | 'mouseX' | 'mouseY' | 'isPointerLocked'
>;

export interface InputListener {
  onInputChange(action: InputAction, value: boolean): void;
  onMouseMove(deltaX: number, deltaY: number): void;
  onPointerLockChange(locked: boolean): void;
}

export interface KeyBinding {
  action: InputAction;
  primary: string;
  secondary?: string;
}
