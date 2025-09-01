import { Vector3 } from '@babylonjs/core';
import type { Component } from '@doom-like/game-logic';

/**
 * EnemyMovement component - manages enemy movement, velocity, and pathfinding
 */
export interface EnemyMovementComponent extends Component {
  id: 'enemyMovement';

  /** Current velocity vector (units per second) */
  velocity: Vector3;

  /** Target position to move towards */
  targetPosition: Vector3 | null;

  /** Current facing angle in radians (0 = facing +Z) */
  facingAngle: number;

  /** Target facing angle for smooth rotation */
  targetFacingAngle: number;

  /** Whether enemy is currently moving */
  isMoving: boolean;

  /** Movement speed (units per second) */
  movementSpeed: number;

  /** Turn/rotation speed (radians per second) */
  turnSpeed: number;

  /** Acceleration for smooth movement */
  acceleration: number;

  /** Deceleration for smooth stopping */
  deceleration: number;

  /** Whether enemy is stuck (for unstuck behavior) */
  isStuck: boolean;

  /** Time spent being stuck */
  stuckTime: number;

  /** Threshold for stuck detection (minimum movement per second) */
  stuckThreshold: number;

  /** Previous position for stuck detection */
  previousPosition: Vector3;

  /** Random movement direction when stuck */
  unstuckDirection: Vector3 | null;

  /** Time remaining for unstuck movement */
  unstuckTime: number;

  /** Whether to use simple direct movement or more complex pathfinding */
  useSimpleMovement: boolean;

  /** Ground collision height offset */
  groundOffset: number;
}

/**
 * Factory function to create EnemyMovement component
 */
export function createEnemyMovementComponent(
  initialPosition: Vector3,
  movementSpeed: number,
  turnSpeed: number
): EnemyMovementComponent {
  return {
    id: 'enemyMovement',
    velocity: new Vector3(0, 0, 0),
    targetPosition: null,
    facingAngle: 0,
    targetFacingAngle: 0,
    isMoving: false,
    movementSpeed,
    turnSpeed,
    acceleration: movementSpeed * 3, // Quick acceleration
    deceleration: movementSpeed * 4, // Quick stopping
    isStuck: false,
    stuckTime: 0,
    stuckThreshold: 0.1, // Must move at least 0.1 units per second
    previousPosition: initialPosition.clone(),
    unstuckDirection: null,
    unstuckTime: 0,
    useSimpleMovement: true, // Start with simple DOOM-like movement
    groundOffset: 0.1,
  };
}

/**
 * Utility functions for enemy movement management
 * Movement helpers converted from static-only class to module functions
 */
// Internal helpers
function decelerateToStop(movementComponent: EnemyMovementComponent, deltaTime: number): void {
  const currentSpeed = movementComponent.velocity.length();

  if (currentSpeed > 0.01) {
    const decelAmount = movementComponent.deceleration * deltaTime;
    const newSpeed = Math.max(0, currentSpeed - decelAmount);

    if (newSpeed === 0) {
      movementComponent.velocity = new Vector3(0, 0, 0);
    } else {
      movementComponent.velocity = movementComponent.velocity.normalize().scale(newSpeed);
    }
  } else {
    movementComponent.velocity = new Vector3(0, 0, 0);
  }
}

function getShortestAngleDifference(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  return diff;
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
function setTarget(
  movementComponent: EnemyMovementComponent,
  targetPosition: Vector3 | null,
  currentPosition?: Vector3
): void {
  movementComponent.targetPosition = targetPosition ? targetPosition.clone() : null;
  movementComponent.isMoving = targetPosition !== null;

  if (targetPosition && currentPosition) {
    const direction = targetPosition.subtract(currentPosition);
    if (direction.length() > 0.01) {
      movementComponent.targetFacingAngle = Math.atan2(direction.x, direction.z);
    }
  }
}

function updateSimpleMovement(
  movementComponent: EnemyMovementComponent,
  currentPosition: Vector3,
  deltaTime: number
): Vector3 {
  if (!movementComponent.targetPosition || !movementComponent.isMoving) {
    decelerateToStop(movementComponent, deltaTime);
    return new Vector3(0, 0, 0);
  }

  const direction = movementComponent.targetPosition.subtract(currentPosition);
  const distance = direction.length();

  if (distance < 0.5) {
    movementComponent.isMoving = false;
    movementComponent.targetPosition = null;
    decelerateToStop(movementComponent, deltaTime);
    return new Vector3(0, 0, 0);
  }

  direction.normalize();
  const targetVelocity = direction.scale(movementComponent.movementSpeed);
  movementComponent.velocity = Vector3.Lerp(
    movementComponent.velocity,
    targetVelocity,
    movementComponent.acceleration * deltaTime
  );

  return movementComponent.velocity.scale(deltaTime);
}

function updateFacing(movementComponent: EnemyMovementComponent, deltaTime: number): void {
  const angleDiff = getShortestAngleDifference(
    movementComponent.facingAngle,
    movementComponent.targetFacingAngle
  );

  if (Math.abs(angleDiff) > 0.01) {
    const turnAmount = movementComponent.turnSpeed * deltaTime;
    const turnDirection = Math.sign(angleDiff);

    if (Math.abs(angleDiff) <= turnAmount) {
      movementComponent.facingAngle = movementComponent.targetFacingAngle;
    } else {
      movementComponent.facingAngle += turnDirection * turnAmount;
    }

    movementComponent.facingAngle = normalizeAngle(movementComponent.facingAngle);
  }
}

function updateStuckDetection(
  movementComponent: EnemyMovementComponent,
  currentPosition: Vector3,
  deltaTime: number
): void {
  if (!movementComponent.isMoving) {
    movementComponent.isStuck = false;
    movementComponent.stuckTime = 0;
    movementComponent.unstuckTime = 0;
    movementComponent.previousPosition = currentPosition.clone();
    return;
  }

  const movementDistance = currentPosition.subtract(movementComponent.previousPosition).length();
  const expectedMovement = movementComponent.stuckThreshold * deltaTime;

  if (movementDistance < expectedMovement) {
    movementComponent.stuckTime += deltaTime;

    if (movementComponent.stuckTime >= 1.0 && !movementComponent.isStuck) {
      movementComponent.isStuck = true;
      movementComponent.unstuckTime = 2.0;

      const randomAngle = Math.random() * Math.PI * 2;
      movementComponent.unstuckDirection = new Vector3(
        Math.sin(randomAngle),
        0,
        Math.cos(randomAngle)
      );
    }
  } else {
    movementComponent.isStuck = false;
    movementComponent.stuckTime = 0;
    movementComponent.unstuckTime = 0;
    movementComponent.unstuckDirection = null;
  }

  movementComponent.previousPosition = currentPosition.clone();
}

function applyUnstuckMovement(
  movementComponent: EnemyMovementComponent,
  deltaTime: number
): Vector3 {
  if (!movementComponent.isStuck || !movementComponent.unstuckDirection) {
    return new Vector3(0, 0, 0);
  }

  movementComponent.unstuckTime -= deltaTime;

  if (movementComponent.unstuckTime <= 0) {
    movementComponent.isStuck = false;
    movementComponent.unstuckDirection = null;
    return new Vector3(0, 0, 0);
  }

  const unstuckVelocity = movementComponent.unstuckDirection.scale(
    movementComponent.movementSpeed * 0.5
  );

  return unstuckVelocity.scale(deltaTime);
}

function setMovementParams(
  movementComponent: EnemyMovementComponent,
  speed?: number,
  turnSpeed?: number,
  acceleration?: number
): void {
  if (speed !== undefined) {
    movementComponent.movementSpeed = speed;
  }
  if (turnSpeed !== undefined) {
    movementComponent.turnSpeed = turnSpeed;
  }
  if (acceleration !== undefined) {
    movementComponent.acceleration = acceleration;
  }
}

function stop(movementComponent: EnemyMovementComponent): void {
  movementComponent.isMoving = false;
  movementComponent.targetPosition = null;
  movementComponent.velocity = new Vector3(0, 0, 0);
  movementComponent.isStuck = false;
  movementComponent.stuckTime = 0;
  movementComponent.unstuckTime = 0;
  movementComponent.unstuckDirection = null;
}

function isStationary(movementComponent: EnemyMovementComponent): boolean {
  return !movementComponent.isMoving && movementComponent.velocity.length() < 0.01;
}

function getMovementDirection(movementComponent: EnemyMovementComponent): Vector3 {
  const speed = movementComponent.velocity.length();
  return speed > 0.01 ? movementComponent.velocity.normalize() : new Vector3(0, 0, 0);
}

export const EnemyMovementUtils = {
  setTarget,
  updateSimpleMovement,
  updateFacing,
  updateStuckDetection,
  applyUnstuckMovement,
  setMovementParams,
  stop,
  isStationary,
  getMovementDirection,
} as const;
