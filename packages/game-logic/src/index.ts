export { ECS } from './ecs/ecs';
export { Transform, Velocity, Health } from './components';
export { MovementSystem, RenderSystem } from './systems';

export type { Component, Entity, System } from './types';

// Input system
export {
  InputManager,
  KeyboardLayoutDetector,
  KeyMappings,
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
