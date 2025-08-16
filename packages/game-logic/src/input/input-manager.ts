/**
 * Central input management system with AZERTY support and key binding
 */

import type { InputAction, InputConfig, InputListener, InputState } from './input-types';
import { type GameKeyMappings, KeyMappings } from './key-mappings';
import { type KeyboardLayout, KeyboardLayoutDetector } from './keyboard-layout';

export class InputManager {
  private canvas: HTMLCanvasElement;
  private keyboardLayout: KeyboardLayout;
  private keyMappings: GameKeyMappings;
  private listeners: Set<InputListener> = new Set();

  private inputState: InputState = {
    // Movement
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
    jump: false,
    crouch: false,
    run: false,

    // Combat
    fire: false,
    altFire: false,
    reload: false,
    nextWeapon: false,
    prevWeapon: false,

    // Interface
    pause: false,
    map: false,
    interact: false,
    flashlight: false,

    // Mouse
    mouseDeltaX: 0,
    mouseDeltaY: 0,
    mouseX: 0,
    mouseY: 0,
    isPointerLocked: false,
  };

  private config: InputConfig = {
    mouseSensitivity: 1.0,
    mouseInvertY: false,
    keyRepeatDelay: 100,
    keyRepeatRate: 50,
    deadzone: 0.1,
  };

  private keyActionMap: Map<string, InputAction> = new Map();
  private pressedKeys: Set<string> = new Set();
  private isEnabled = true;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    // Detect keyboard layout
    const layoutInfo = KeyboardLayoutDetector.detectLayout();
    this.keyboardLayout = layoutInfo.layout;
    this.keyMappings = KeyMappings.getForLayout(this.keyboardLayout);

    console.log(
      `[INPUT] Detected keyboard layout: ${KeyboardLayoutDetector.getLayoutDisplayName(this.keyboardLayout)} (confidence: ${Math.round(layoutInfo.confidence * 100)}%)`
    );

    this.buildKeyActionMap();
    this.setupEventListeners();
  }

  /**
   * Add input listener for game logic
   */
  public addListener(listener: InputListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove input listener
   */
  public removeListener(listener: InputListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Get current input state (read-only)
   */
  public getInputState(): Readonly<InputState> {
    return { ...this.inputState };
  }

  /**
   * Get current keyboard layout
   */
  public getKeyboardLayout(): KeyboardLayout {
    return this.keyboardLayout;
  }

  /**
   * Get current key mappings
   */
  public getKeyMappings(): GameKeyMappings {
    return this.keyMappings;
  }

  /**
   * Update input configuration
   */
  public updateConfig(newConfig: Partial<InputConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Request pointer lock for FPS controls
   */
  public async requestPointerLock(): Promise<boolean> {
    try {
      await this.canvas.requestPointerLock();
      return true;
    } catch (error) {
      console.warn('[INPUT] Failed to request pointer lock:', error);
      return false;
    }
  }

  /**
   * Exit pointer lock
   */
  public exitPointerLock(): void {
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
  }

  /**
   * Enable/disable input processing
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.clearInputState();
    }
  }

  /**
   * Force override keyboard layout (for user preference)
   */
  public setKeyboardLayout(layout: KeyboardLayout): void {
    if (layout !== this.keyboardLayout) {
      this.keyboardLayout = layout;
      this.keyMappings = KeyMappings.getForLayout(layout);
      this.buildKeyActionMap();
      console.log(
        `[INPUT] Switched to ${KeyboardLayoutDetector.getLayoutDisplayName(layout)} layout`
      );
    }
  }

  /**
   * Cleanup and remove event listeners
   */
  public dispose(): void {
    this.removeEventListeners();
    this.listeners.clear();
    this.clearInputState();
  }

  private buildKeyActionMap(): void {
    this.keyActionMap.clear();

    // Build reverse mapping from key codes to actions
    for (const [action, mapping] of Object.entries(this.keyMappings)) {
      this.keyActionMap.set(mapping.primary, action as InputAction);
      if (mapping.secondary) {
        this.keyActionMap.set(mapping.secondary, action as InputAction);
      }
    }
  }

  private setupEventListeners(): void {
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);

    // Mouse events
    this.canvas.addEventListener('mousedown', this.handleMouseDown);
    this.canvas.addEventListener('mouseup', this.handleMouseUp);
    this.canvas.addEventListener('mousemove', this.handleMouseMove);
    this.canvas.addEventListener('wheel', this.handleWheel);

    // Pointer lock events
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    document.addEventListener('pointerlockerror', this.handlePointerLockError);

    // Context menu prevention
    this.canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  private removeEventListeners(): void {
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('keyup', this.handleKeyUp);
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mouseup', this.handleMouseUp);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('wheel', this.handleWheel);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    document.removeEventListener('pointerlockerror', this.handlePointerLockError);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    const action = this.keyActionMap.get(event.code);
    if (action && !this.pressedKeys.has(event.code)) {
      this.pressedKeys.add(event.code);
      this.setInputAction(action, true);
      event.preventDefault();
    }
  };

  private handleKeyUp = (event: KeyboardEvent): void => {
    if (!this.isEnabled) return;

    const action = this.keyActionMap.get(event.code);
    if (action && this.pressedKeys.has(event.code)) {
      this.pressedKeys.delete(event.code);
      this.setInputAction(action, false);
      event.preventDefault();
    }
  };

  private handleMouseDown = (event: MouseEvent): void => {
    if (!this.isEnabled) return;

    const action = this.getMouseAction(event.button);
    if (action) {
      this.setInputAction(action, true);
      event.preventDefault();
    }
  };

  private handleMouseUp = (event: MouseEvent): void => {
    if (!this.isEnabled) return;

    const action = this.getMouseAction(event.button);
    if (action) {
      this.setInputAction(action, false);
      event.preventDefault();
    }
  };

  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.isEnabled) return;

    // Update mouse position
    this.inputState.mouseX = event.clientX;
    this.inputState.mouseY = event.clientY;

    // Handle mouse delta (for FPS camera)
    if (this.inputState.isPointerLocked) {
      const deltaX = event.movementX * this.config.mouseSensitivity;
      const deltaY =
        event.movementY * this.config.mouseSensitivity * (this.config.mouseInvertY ? -1 : 1);

      this.inputState.mouseDeltaX = deltaX;
      this.inputState.mouseDeltaY = deltaY;

      // Notify listeners
      for (const listener of this.listeners) {
        listener.onMouseMove(deltaX, deltaY);
      }
    }
  };

  private handleWheel = (event: WheelEvent): void => {
    if (!this.isEnabled) return;

    // Handle weapon switching via mouse wheel
    if (event.deltaY < 0) {
      this.setInputAction('nextWeapon', true);
      setTimeout(() => this.setInputAction('nextWeapon', false), 100);
    } else if (event.deltaY > 0) {
      this.setInputAction('prevWeapon', true);
      setTimeout(() => this.setInputAction('prevWeapon', false), 100);
    }

    event.preventDefault();
  };

  private handlePointerLockChange = (): void => {
    const isLocked = document.pointerLockElement === this.canvas;
    this.inputState.isPointerLocked = isLocked;

    for (const listener of this.listeners) {
      listener.onPointerLockChange(isLocked);
    }
  };

  private handlePointerLockError = (event: Event): void => {
    console.warn('[INPUT] Pointer lock error:', event);
  };

  private handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };

  private getMouseAction(button: number): InputAction | null {
    switch (button) {
      case 0:
        return 'fire'; // Left click
      case 2:
        return 'altFire'; // Right click
      default:
        return null;
    }
  }

  private setInputAction(action: InputAction, value: boolean): void {
    if (this.inputState[action] !== value) {
      this.inputState[action] = value;

      // Notify listeners
      for (const listener of this.listeners) {
        listener.onInputChange(action, value);
      }
    }
  }

  private clearInputState(): void {
    // Reset all boolean inputs
    const booleanKeys: Array<keyof InputState> = [
      'moveForward',
      'moveBackward',
      'moveLeft',
      'moveRight',
      'jump',
      'crouch',
      'run',
      'fire',
      'altFire',
      'reload',
      'nextWeapon',
      'prevWeapon',
      'pause',
      'map',
      'interact',
      'flashlight',
    ];

    for (const key of booleanKeys) {
      (this.inputState[key] as boolean) = false;
    }

    // Reset mouse deltas
    this.inputState.mouseDeltaX = 0;
    this.inputState.mouseDeltaY = 0;

    this.pressedKeys.clear();
  }
}
