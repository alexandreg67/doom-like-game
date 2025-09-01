import type { Vector3 } from '@babylonjs/core';
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
 */
export class EnemyMovementUtils {
  /**
   * Set movement target position
   */
  static setTarget(
    movementComponent: EnemyMovementComponent,
    targetPosition: Vector3 | null
  ): void {
    movementComponent.targetPosition = targetPosition ? targetPosition.clone() : null;
    movementComponent.isMoving = targetPosition !== null;

    if (targetPosition) {
      // Calculate target facing angle
      const currentPos = new Vector3(0, 0, 0); // Will be updated by movement system
      const direction = targetPosition.subtract(currentPos);
      if (direction.length() > 0.01) {
        movementComponent.targetFacingAngle = Math.atan2(direction.x, direction.z);
      }
    }
  }

  /**
   * Update movement towards target (DOOM-style direct movement)
   */
  static updateSimpleMovement(
    movementComponent: EnemyMovementComponent,
    currentPosition: Vector3,
    deltaTime: number
  ): Vector3 {
    if (!movementComponent.targetPosition || !movementComponent.isMoving) {
      // Decelerate to stop
      this.decelerateToStop(movementComponent, deltaTime);
      return new Vector3(0, 0, 0);
    }

    // Calculate direction to target
    const direction = movementComponent.targetPosition.subtract(currentPosition);
    const distance = direction.length();

    // Check if we've reached the target
    if (distance < 0.5) {
      movementComponent.isMoving = false;
      movementComponent.targetPosition = null;
      this.decelerateToStop(movementComponent, deltaTime);
      return new Vector3(0, 0, 0);
    }

    // Normalize direction and apply speed
    direction.normalize();
    const targetVelocity = direction.scale(movementComponent.movementSpeed);

    // Apply acceleration for smooth movement
    movementComponent.velocity = Vector3.Lerp(
      movementComponent.velocity,
      targetVelocity,
      movementComponent.acceleration * deltaTime
    );

    return movementComponent.velocity.scale(deltaTime);
  }

  /**
   * Update facing angle to look at target
   */
  static updateFacing(movementComponent: EnemyMovementComponent, deltaTime: number): void {
    const angleDiff = this.getShortestAngleDifference(
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

      // Normalize angle to [-PI, PI]
      movementComponent.facingAngle = this.normalizeAngle(movementComponent.facingAngle);
    }
  }

  /**
   * Detect if enemy is stuck and apply unstuck behavior
   */
  static updateStuckDetection(
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

    // Check if we've moved enough
    const movementDistance = currentPosition.subtract(movementComponent.previousPosition).length();
    const expectedMovement = movementComponent.stuckThreshold * deltaTime;

    if (movementDistance < expectedMovement) {
      movementComponent.stuckTime += deltaTime;

      if (movementComponent.stuckTime >= 1.0 && !movementComponent.isStuck) {
        // Become stuck - initiate unstuck behavior
        movementComponent.isStuck = true;
        movementComponent.unstuckTime = 2.0; // Try for 2 seconds

        // Generate random unstuck direction
        const randomAngle = Math.random() * Math.PI * 2;
        movementComponent.unstuckDirection = new Vector3(
          Math.sin(randomAngle),
          0,
          Math.cos(randomAngle)
        );
      }
    } else {
      // We're moving, reset stuck detection
      movementComponent.isStuck = false;
      movementComponent.stuckTime = 0;
      movementComponent.unstuckTime = 0;
      movementComponent.unstuckDirection = null;
    }

    movementComponent.previousPosition = currentPosition.clone();
  }

  /**
   * Apply unstuck movement
   */
  static applyUnstuckMovement(
    movementComponent: EnemyMovementComponent,
    deltaTime: number
  ): Vector3 {
    if (!movementComponent.isStuck || !movementComponent.unstuckDirection) {
      return new Vector3(0, 0, 0);
    }

    movementComponent.unstuckTime -= deltaTime;

    if (movementComponent.unstuckTime <= 0) {
      // Give up unstuck attempt
      movementComponent.isStuck = false;
      movementComponent.unstuckDirection = null;
      return new Vector3(0, 0, 0);
    }

    // Move in unstuck direction
    const unstuckVelocity = movementComponent.unstuckDirection.scale(
      movementComponent.movementSpeed * 0.5 // Half speed for unstuck movement
    );

    return unstuckVelocity.scale(deltaTime);
  }

  /**
   * Decelerate velocity to stop
   */
  private static decelerateToStop(
    movementComponent: EnemyMovementComponent,
    deltaTime: number
  ): void {
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

  /**
   * Get the shortest angle difference between two angles
   */
  private static getShortestAngleDifference(from: number, to: number): number {
    let diff = to - from;

    // Normalize to [-PI, PI]
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    return diff;
  }

  /**
   * Normalize angle to [-PI, PI] range
   */
  private static normalizeAngle(angle: number): number {
    while (angle > Math.PI) angle -= 2 * Math.PI;
    while (angle < -Math.PI) angle += 2 * Math.PI;
    return angle;
  }

  /**
   * Set movement parameters
   */
  static setMovementParams(
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

  /**
   * Stop movement immediately
   */
  static stop(movementComponent: EnemyMovementComponent): void {
    movementComponent.isMoving = false;
    movementComponent.targetPosition = null;
    movementComponent.velocity = Vector3.Zero();
    movementComponent.isStuck = false;
    movementComponent.stuckTime = 0;
    movementComponent.unstuckTime = 0;
    movementComponent.unstuckDirection = null;
  }

  /**
   * Check if enemy is effectively stationary
   */
  static isStationary(movementComponent: EnemyMovementComponent): boolean {
    return !movementComponent.isMoving && movementComponent.velocity.length() < 0.01;
  }

  /**
   * Get current movement direction (normalized)
   */
  static getMovementDirection(movementComponent: EnemyMovementComponent): Vector3 {
    const speed = movementComponent.velocity.length();
    return speed > 0.01 ? movementComponent.velocity.normalize() : new Vector3(0, 0, 0);
  }
}
