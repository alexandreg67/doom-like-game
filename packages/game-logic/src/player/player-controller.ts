/**
 * Player controller for FPS movement with AZERTY support
 */

import { Vector2, Vector3 } from '@babylonjs/core';
import type { CollisionDetector, DoomSector } from '@doom-like/engine';
import type { Transform } from '../components';
import type { InputAction, InputListener, InputManager } from '../input';
import type { Component, Entity } from '../types';

export interface PlayerMovement extends Component {
  id: 'playerMovement';
  velocity: Vector3;
  acceleration: Vector3;
  maxSpeed: number;
  friction: number;
  airFriction: number;
  jumpSpeed: number;
  crouchSpeed: number;
  runMultiplier: number;
  isGrounded: boolean;
  isCrouching: boolean;
  isRunning: boolean;
}

export interface PlayerState extends Component {
  id: 'playerState';
  health: number;
  maxHealth: number;
  isAlive: boolean;
  isInvulnerable: boolean;
  invulnerabilityTime: number;
}

export interface PlayerConfig {
  // Movement physics
  moveSpeed: number;
  runSpeed: number;
  crouchSpeed: number;
  jumpSpeed: number;
  friction: number;
  airFriction: number;
  gravity: number;

  // Physical properties
  height: number;
  crouchHeight: number;
  radius: number;
  groundLevel: number;

  // Camera
  eyeHeight: number;
  crouchEyeHeight: number;
}

export class PlayerController implements InputListener {
  /**
   * Multiplier applied to movement acceleration to control player responsiveness.
   * Value 10 was chosen through playtesting to provide a balance between snappy and smooth movement.
   * Increasing this value makes the player accelerate faster, while decreasing it results in slower acceleration.
   * This constant directly affects how quickly the player reaches max speed when moving.
   */
  private static readonly ACCELERATION_MULTIPLIER = 10;

  /**
   * Threshold for checking ground collision to prevent floating point precision issues.
   * Value -0.1 ensures we only check for ground collision when there is actual downward movement,
   * preventing unnecessary collision checks during upward movement or when stationary.
   * This value ensures reliable ground detection while accounting for minor velocity fluctuations.
   */
  private static readonly GROUND_CHECK_THRESHOLD = -0.1;

  private entity: Entity;
  private inputManager: InputManager;
  private config: PlayerConfig;
  private collisionDetector: CollisionDetector | null = null;
  private currentSector: DoomSector | null = null;

  private moveDirection = new Vector2(0, 0);
  private inputState = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    crouch: false,
    run: false,
  };

  constructor(
    entity: Entity,
    inputManager: InputManager,
    collisionDetector?: CollisionDetector,
    config?: Partial<PlayerConfig>
  ) {
    this.entity = entity;
    this.inputManager = inputManager;
    this.collisionDetector = collisionDetector || null;

    // Default configuration
    this.config = {
      // Movement physics (units per second)
      moveSpeed: 5.0,
      runSpeed: 8.0,
      crouchSpeed: 2.5,
      jumpSpeed: 7.0,
      friction: 0.8,
      airFriction: 0.95,
      gravity: 20.0,

      // Physical properties (meters)
      height: 1.8,
      crouchHeight: 1.2,
      radius: 0.3,
      groundLevel: 0.0,

      // Camera (relative to feet)
      eyeHeight: 1.6,
      crouchEyeHeight: 1.0,

      ...config,
    };

    this.initializeComponents();
    this.inputManager.addListener(this);

    console.log('[PLAYER] PlayerController initialized with AZERTY support');
  }

  /**
   * Update player movement and state (called each frame)
   */
  public update(deltaTime: number): void {
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;
    const transform = this.entity.components.get('transform') as Transform;

    if (!movement || !transform) {
      console.warn('[PLAYER] Missing required components');
      return;
    }

    this.updateMovementInput();
    this.updateMovementPhysics(movement, deltaTime);
    this.updateCrouchState(movement);
    this.updateRunState(movement);

    // Apply movement to transform
    transform.x += movement.velocity.x * deltaTime;
    transform.y += movement.velocity.y * deltaTime;
    transform.z += movement.velocity.z * deltaTime;
  }

  /**
   * Get current player configuration
   */
  public getConfig(): PlayerConfig {
    return { ...this.config };
  }

  /**
   * Update player configuration
   */
  public updateConfig(newConfig: Partial<PlayerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Set collision detector for physics integration
   */
  public setCollisionDetector(collisionDetector: CollisionDetector): void {
    this.collisionDetector = collisionDetector;
    this.updateCurrentSector();
  }

  /**
   * Get current eye position for camera
   */
  public getEyePosition(): Vector3 {
    const transform = this.entity.components.get('transform') as Transform;
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;

    if (!transform || !movement) {
      return new Vector3(0, 0, 0);
    }

    const eyeHeight = movement.isCrouching ? this.config.crouchEyeHeight : this.config.eyeHeight;
    return new Vector3(transform.x, transform.y + eyeHeight, transform.z);
  }

  /**
   * Check if player can jump
   */
  public canJump(): boolean {
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;
    return movement?.isGrounded || false;
  }

  /**
   * Force jump (for external triggers)
   */
  public jump(): void {
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;
    if (movement && this.canJump()) {
      movement.velocity.y = this.config.jumpSpeed;
      movement.isGrounded = false;
    }
  }

  /**
   * Set grounded state (called by collision system)
   */
  public setGrounded(grounded: boolean): void {
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;
    if (movement) {
      movement.isGrounded = grounded;
    }
  }

  /**
   * Cleanup and remove listeners
   */
  public dispose(): void {
    this.inputManager.removeListener(this);
    this.resetMovement();
  }

  // InputListener implementation
  public onInputChange(action: InputAction, value: boolean): void {
    switch (action) {
      case 'moveForward':
        this.inputState.forward = value;
        break;
      case 'moveBackward':
        this.inputState.backward = value;
        break;
      case 'moveLeft':
        this.inputState.left = value;
        break;
      case 'moveRight':
        this.inputState.right = value;
        break;
      case 'jump':
        this.inputState.jump = value;
        if (value) this.handleJump();
        break;
      case 'crouch':
        this.inputState.crouch = value;
        break;
      case 'run':
        this.inputState.run = value;
        break;
    }
  }

  public onMouseMove(_deltaX: number, _deltaY: number): void {
    // Mouse movement will be handled by camera controller
    // Store the values for potential future use
  }

  public onPointerLockChange(locked: boolean): void {
    console.log(`[PLAYER] Pointer lock ${locked ? 'acquired' : 'released'}`);
  }

  private initializeComponents(): void {
    // Add PlayerMovement component if not exists
    if (!this.entity.components.has('playerMovement')) {
      const movement: PlayerMovement = {
        id: 'playerMovement',
        velocity: new Vector3(0, 0, 0),
        acceleration: new Vector3(0, 0, 0),
        maxSpeed: this.config.moveSpeed,
        friction: this.config.friction,
        airFriction: this.config.airFriction,
        jumpSpeed: this.config.jumpSpeed,
        crouchSpeed: this.config.crouchSpeed,
        runMultiplier: this.config.runSpeed / this.config.moveSpeed,
        isGrounded: true,
        isCrouching: false,
        isRunning: false,
      };
      this.entity.components.set('playerMovement', movement);
    }

    // Add PlayerState component if not exists
    if (!this.entity.components.has('playerState')) {
      const state: PlayerState = {
        id: 'playerState',
        health: 100,
        maxHealth: 100,
        isAlive: true,
        isInvulnerable: false,
        invulnerabilityTime: 0,
      };
      this.entity.components.set('playerState', state);
    }
  }

  private updateMovementInput(): void {
    // Calculate movement direction from AZERTY/QWERTY input
    this.moveDirection.x = 0;
    this.moveDirection.y = 0;

    if (this.inputState.forward) this.moveDirection.y += 1;
    if (this.inputState.backward) this.moveDirection.y -= 1;
    if (this.inputState.left) this.moveDirection.x -= 1;
    if (this.inputState.right) this.moveDirection.x += 1;

    // Normalize diagonal movement
    if (this.moveDirection.length() > 0) {
      this.moveDirection.normalize();
    }
  }

  private updateMovementPhysics(movement: PlayerMovement, deltaTime: number): void {
    const transform = this.entity.components.get('transform') as Transform;
    if (!transform) return;

    // Apply gravity
    if (!movement.isGrounded) {
      movement.velocity.y -= this.config.gravity * deltaTime;
    }

    // Calculate target speed based on state
    let targetSpeed = this.config.moveSpeed;
    if (movement.isCrouching) {
      targetSpeed = this.config.crouchSpeed;
    } else if (movement.isRunning) {
      targetSpeed = this.config.runSpeed;
    }

    // Apply horizontal movement
    const targetVelocityX = this.moveDirection.x * targetSpeed;
    const targetVelocityZ = this.moveDirection.y * targetSpeed;

    // Apply friction/acceleration
    const friction = movement.isGrounded ? this.config.friction : this.config.airFriction;

    movement.velocity.x = this.lerp(
      movement.velocity.x,
      targetVelocityX,
      friction * deltaTime * PlayerController.ACCELERATION_MULTIPLIER
    );
    movement.velocity.z = this.lerp(
      movement.velocity.z,
      targetVelocityZ,
      friction * deltaTime * PlayerController.ACCELERATION_MULTIPLIER
    );

    // Apply collision detection if available
    if (this.collisionDetector) {
      this.handleCollisionDetection(movement, transform, deltaTime);
    } else {
      // Fallback to simple ground collision
      this.handleSimpleGroundCollision(movement, transform);
    }

    // Update current sector
    this.updateCurrentSector();
  }

  private updateCrouchState(movement: PlayerMovement): void {
    movement.isCrouching = this.inputState.crouch;
  }

  private updateRunState(movement: PlayerMovement): void {
    movement.isRunning = this.inputState.run && !movement.isCrouching;
  }

  private handleJump(): void {
    if (this.canJump()) {
      this.jump();
    }
  }

  private resetMovement(): void {
    const movement = this.entity.components.get('playerMovement') as PlayerMovement;
    if (movement) {
      movement.velocity.set(0, 0, 0);
      movement.acceleration.set(0, 0, 0);
    }
  }

  /**
   * Handle collision detection using CollisionDetector
   */
  private handleCollisionDetection(
    movement: PlayerMovement,
    transform: Transform,
    deltaTime: number
  ): void {
    if (!this.collisionDetector) return;

    const currentPosition = new Vector2(transform.x, transform.z);
    const velocity2D = new Vector2(movement.velocity.x, movement.velocity.z);

    // Test horizontal collision
    const collision = this.collisionDetector.testCircleLineCollision(
      currentPosition,
      this.config.radius,
      velocity2D,
      deltaTime
    );

    if (collision.collided) {
      // Apply collision correction
      movement.velocity.x += collision.correction.x / deltaTime;
      movement.velocity.z += collision.correction.y / deltaTime;

      // Slide along walls by removing velocity component in collision normal direction
      const velocityDotNormal =
        movement.velocity.x * collision.normal.x + movement.velocity.z * collision.normal.y;
      if (velocityDotNormal < 0) {
        movement.velocity.x -= velocityDotNormal * collision.normal.x;
        movement.velocity.z -= velocityDotNormal * collision.normal.y;
      }
    }

    // Handle vertical movement and ground detection
    this.handleVerticalCollision(movement, transform);
  }

  /**
   * Handle vertical collision and ground detection
   */
  private handleVerticalCollision(movement: PlayerMovement, transform: Transform): void {
    if (!this.collisionDetector || !this.currentSector) {
      this.handleSimpleGroundCollision(movement, transform);
      return;
    }

    const playerPosition = new Vector2(transform.x, transform.z);
    const sector =
      this.collisionDetector.findSectorAtPosition(playerPosition) || this.currentSector;

    // Check ground collision
    if (movement.velocity.y < PlayerController.GROUND_CHECK_THRESHOLD) {
      const groundHeight = sector.floorHeight;
      if (transform.y <= groundHeight + 0.1) {
        transform.y = groundHeight;
        movement.velocity.y = 0;
        movement.isGrounded = true;
      }
    }

    // Check ceiling collision
    const ceilingHeight = sector.ceilingHeight;
    if (transform.y + this.config.height >= ceilingHeight) {
      transform.y = ceilingHeight - this.config.height;
      if (movement.velocity.y > 0) {
        movement.velocity.y = 0;
      }
    }

    // Update sector if changed
    if (sector !== this.currentSector) {
      console.log(`[PLAYER] Sector changed: ${this.currentSector?.id} -> ${sector.id}`);
      this.currentSector = sector;
    }
  }

  /**
   * Fallback simple ground collision for when no CollisionDetector is available
   */
  private handleSimpleGroundCollision(movement: PlayerMovement, transform: Transform): void {
    if (movement.velocity.y < PlayerController.GROUND_CHECK_THRESHOLD) {
      if (transform.y <= this.config.groundLevel) {
        transform.y = this.config.groundLevel;
        movement.velocity.y = 0;
        movement.isGrounded = true;
      }
    }
  }

  /**
   * Update current sector based on player position
   */
  private updateCurrentSector(): void {
    if (!this.collisionDetector) return;

    const transform = this.entity.components.get('transform') as Transform;
    if (!transform) return;

    const playerPosition = new Vector2(transform.x, transform.z);
    const newSector = this.collisionDetector.findSectorAtPosition(playerPosition);

    if (newSector && newSector !== this.currentSector) {
      const oldSector = this.currentSector;
      this.currentSector = newSector;
      console.log(`[PLAYER] Moved to sector: ${newSector.id} (from ${oldSector?.id || 'none'})`);
    }
  }

  /**
   * Get current sector information
   */
  public getCurrentSector(): DoomSector | null {
    return this.currentSector;
  }

  /**
   * Get player entity for external access
   */
  public getEntity(): Entity {
    return this.entity;
  }

  /**
   * Get input manager for external access
   */
  public getInputManager(): InputManager {
    return this.inputManager;
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * Math.min(factor, 1);
  }
}
