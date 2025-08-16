export { ECS } from './ecs/ecs';
export { Transform, Velocity, Health } from './components';
export { MovementSystem, RenderSystem } from './systems';

export type { Component, Entity, System } from './types';

// Input system
export {
  InputManager,
  KeyMappings,
  detectLayout,
  getLayoutDisplayName,
  isAzerty,
  type KeyboardLayout,
  type KeyboardLayoutInfo,
  type KeyMapping,
  type GameKeyMappings,
  type InputState,
  type InputConfig,
  type InputAction,
  type InputListener,
  type KeyBinding,
} from './input';

// Player system
export {
  PlayerController,
  type PlayerMovement,
  type PlayerState,
  type PlayerConfig,
} from './player';

// Camera system
export {
  FPSCameraController,
  type CameraConfig,
  type CameraState,
} from './camera';
