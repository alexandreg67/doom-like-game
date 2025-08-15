import type { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomLineDef, DoomSector } from '../geometry/doom-geometry';

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
