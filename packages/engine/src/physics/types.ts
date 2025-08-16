import type { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector } from '../geometry/doom-geometry';

// Physics constants
export const PHYSICS_CONSTANTS = {
  /** Threshold for ground detection (player considered grounded if within this distance of floor) */
  GROUND_DETECTION_THRESHOLD: 0.1,
  /** Epsilon for collision normal calculation to avoid division by zero */
  COLLISION_NORMAL_EPSILON: 0.001,
  /** Camera height offset above player feet (eye level) */
  CAMERA_EYE_HEIGHT: 1.6,
  /** Player height for collision calculations */
  PLAYER_HEIGHT: 1.8,
  /** Player radius for collision detection */
  PLAYER_RADIUS: 0.3,
} as const;

// Default physics configuration
export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: -9.81,
  jumpForce: 4.5,
  walkSpeed: 5.0,
  sprintSpeed: 8.0,
  friction: 0.995, // Very high friction for immediate stop
  airControl: 0.3,
  maxVelocity: 15.0,
} as const;

export interface CollisionBox {
  min: Vector2;
  max: Vector2;
}

export interface CollisionResult {
  collided: boolean;
  correction: Vector2;
  normal: Vector2;
  distance: number;
}

export interface PlayerController {
  position: Vector3;
  velocity: Vector3;
  radius: number;
  height: number;
  groundHeight: number;
  isOnGround: boolean;
}

export interface MovementInput {
  forward: number; // -1 to 1
  strafe: number; // -1 to 1
  jump: boolean;
  sprint: boolean;
}

export interface PhysicsConfig {
  gravity: number;
  jumpForce: number;
  walkSpeed: number;
  sprintSpeed: number;
  friction: number;
  airControl: number;
  maxVelocity: number;
}

export interface CollisionGeometry {
  lineDefs: DoomLineDef[];
  sectors: DoomSector[];
}

export interface CollisionEvent {
  type: 'wall' | 'floor' | 'ceiling' | 'sector_change';
  position: Vector3;
  normal?: Vector2;
  lineDef?: DoomLineDef;
  newSector?: DoomSector;
  oldSector?: DoomSector | null;
}

export interface PhysicsMetrics {
  collisionChecks: number;
  lineTestsPerFrame: number;
  sectorChanges: number;
  averageFrameTime: number;
}
