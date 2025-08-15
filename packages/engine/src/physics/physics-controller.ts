import { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomSector } from '../geometry/doom-geometry';
import { Logger } from '../utils/logger';
import { CollisionDetector } from './collision-detector';
import type {
  CollisionEvent,
  CollisionGeometry,
  MovementInput,
  PhysicsConfig,
  PhysicsMetrics,
  PlayerController,
} from './types';
import { DEFAULT_PHYSICS_CONFIG, PHYSICS_CONSTANTS } from './types';

export class PhysicsController {
  private collisionDetector: CollisionDetector;
  private player: PlayerController;
  private config: PhysicsConfig;
  private currentSector: DoomSector | null = null;
  private metrics: PhysicsMetrics = {
    collisionChecks: 0,
    lineTestsPerFrame: 0,
    sectorChanges: 0,
    averageFrameTime: 0,
  };

  private frameTimeHistory: number[] = [];
  private readonly FRAME_HISTORY_SIZE = 60; // 1 second at 60fps

  constructor(initialPosition: Vector3, config?: Partial<PhysicsConfig>) {
    this.collisionDetector = new CollisionDetector();

    this.config = {
      ...DEFAULT_PHYSICS_CONFIG,
      ...config,
    };

    this.player = {
      position: initialPosition.clone(),
      velocity: Vector3.Zero(),
      radius: PHYSICS_CONSTANTS.PLAYER_RADIUS,
      height: PHYSICS_CONSTANTS.PLAYER_HEIGHT,
      groundHeight: 0,
      isOnGround: false,
    };

    Logger.info('[PHYSICS] PhysicsController initialized', {
      position: this.player.position,
      config: this.config,
    });
  }

  public setGeometry(geometry: CollisionGeometry): void {
    this.collisionDetector.setGeometry(geometry);

    // Find initial sector
    const pos2D = new Vector2(this.player.position.x, this.player.position.z);
    this.currentSector = this.collisionDetector.findSectorAtPosition(pos2D);

    if (this.currentSector) {
      this.player.groundHeight = this.currentSector.floorHeight;
      this.player.isOnGround =
        Math.abs(this.player.position.y - this.player.groundHeight) <
        PHYSICS_CONSTANTS.GROUND_DETECTION_THRESHOLD;
      Logger.info(`[PHYSICS] Player in sector: ${this.currentSector.id}`);
    }
  }

  public update(
    input: MovementInput,
    deltaTime: number,
    cameraDirection?: Vector3
  ): CollisionEvent[] {
    const startTime = performance.now();
    const events: CollisionEvent[] = [];

    // Apply input to velocity
    this.applyMovementInput(input, deltaTime, cameraDirection);

    // Apply physics (gravity, friction)
    this.applyPhysics(deltaTime);

    // Collision detection and response
    const collisionEvents = this.updateCollisions(deltaTime);
    events.push(...collisionEvents);

    // Sector change detection
    const sectorEvent = this.updateSectorDetection();
    if (sectorEvent) {
      events.push(sectorEvent);
    }

    // Update metrics
    const frameTime = performance.now() - startTime;
    this.updateMetrics(frameTime);

    return events;
  }

  private applyMovementInput(
    input: MovementInput,
    _deltaTime: number,
    cameraDirection?: Vector3
  ): void {
    const speed = input.sprint ? this.config.sprintSpeed : this.config.walkSpeed;
    const control = this.player.isOnGround ? 1.0 : this.config.airControl;

    // DOOM-style movement: direct velocity control instead of acceleration
    if (cameraDirection && (input.forward !== 0 || input.strafe !== 0)) {
      // Calculate forward direction (camera direction projected on horizontal plane)
      const forward = new Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();

      // Calculate right direction (90 degrees clockwise from forward)
      const right = new Vector3(forward.z, 0, -forward.x);

      // Combine forward/backward and strafe movements
      const forwardMovement = forward.scale(input.forward * speed * control);
      const strafeMovement = right.scale(input.strafe * speed * control);

      const movement = forwardMovement.add(strafeMovement);

      // Set velocity directly (DOOM-style instant response)
      this.player.velocity.x = movement.x;
      this.player.velocity.z = movement.z;
    } else if (input.forward === 0 && input.strafe === 0) {
      // No input = immediate stop (DOOM-style)
      this.player.velocity.x = 0;
      this.player.velocity.z = 0;
    } else {
      // Fallback to world-space movement if no camera direction provided
      this.player.velocity.x = input.strafe * speed * control;
      this.player.velocity.z = input.forward * speed * control;
    }

    // Jump
    if (input.jump && this.player.isOnGround) {
      this.player.velocity.y = this.config.jumpForce;
      this.player.isOnGround = false;
    }

    // Limit velocity
    const horizontalSpeed = Math.sqrt(this.player.velocity.x ** 2 + this.player.velocity.z ** 2);
    if (horizontalSpeed > this.config.maxVelocity) {
      const scale = this.config.maxVelocity / horizontalSpeed;
      this.player.velocity.x *= scale;
      this.player.velocity.z *= scale;
    }
  }

  private applyPhysics(deltaTime: number): void {
    // Gravity
    if (!this.player.isOnGround) {
      this.player.velocity.y += this.config.gravity * deltaTime;
    }

    // No horizontal friction needed - movement is controlled directly
  }

  private updateCollisions(deltaTime: number): CollisionEvent[] {
    const events: CollisionEvent[] = [];

    // Horizontal collision detection (X-Z plane)
    const pos2D = new Vector2(this.player.position.x, this.player.position.z);
    const vel2D = new Vector2(this.player.velocity.x, this.player.velocity.z);

    const collision = this.collisionDetector.testCircleLineCollision(
      pos2D,
      this.player.radius,
      vel2D,
      deltaTime
    );

    if (collision.collided) {
      // Apply collision correction
      this.player.position.x += collision.correction.x;
      this.player.position.z += collision.correction.y;

      // Remove velocity component perpendicular to collision normal
      const velocityDot = Vector2.Dot(vel2D, collision.normal);
      if (velocityDot < 0) {
        const velocityCorrection = collision.normal.scale(velocityDot);
        this.player.velocity.x -= velocityCorrection.x;
        this.player.velocity.z -= velocityCorrection.y;
      }

      events.push({
        type: 'wall',
        position: this.player.position.clone(),
        normal: collision.normal,
      });
    } else {
      // Apply movement if no collision
      this.player.position.x += this.player.velocity.x * deltaTime;
      this.player.position.z += this.player.velocity.z * deltaTime;
    }

    // Vertical collision (floor/ceiling)
    this.updateVerticalCollision(deltaTime, events);

    return events;
  }

  private updateVerticalCollision(deltaTime: number, events: CollisionEvent[]): void {
    if (!this.currentSector) {
      Logger.warn('[PHYSICS] No current sector for vertical collision');
      return;
    }

    const newY = this.player.position.y + this.player.velocity.y * deltaTime;
    const floorY = this.currentSector.floorHeight;
    const ceilingY = this.currentSector.ceilingHeight;

    // Floor collision - only check if player is moving down or not on ground
    if (newY < floorY || (!this.player.isOnGround && newY <= floorY)) {
      this.player.position.y = floorY;
      this.player.velocity.y = 0;
      this.player.isOnGround = true;
      this.player.groundHeight = floorY;

      events.push({
        type: 'floor',
        position: this.player.position.clone(),
      });
    }
    // Ceiling collision
    else if (newY + this.player.height >= ceilingY) {
      this.player.position.y = ceilingY - this.player.height;
      this.player.velocity.y = Math.min(0, this.player.velocity.y); // Don't allow upward velocity

      events.push({
        type: 'ceiling',
        position: this.player.position.clone(),
      });
    }
    // Normal movement (only if not touching floor or ceiling)
    else {
      this.player.position.y = newY;
      // Only set isOnGround to false if we're actually moving away from the ground
      if (
        this.player.velocity.y > 0 ||
        newY > floorY + PHYSICS_CONSTANTS.GROUND_DETECTION_THRESHOLD
      ) {
        this.player.isOnGround = false;
      }
    }
  }

  private updateSectorDetection(): CollisionEvent | null {
    const pos2D = new Vector2(this.player.position.x, this.player.position.z);
    const newSector = this.collisionDetector.findSectorAtPosition(pos2D);

    if (newSector && newSector !== this.currentSector) {
      const oldSector = this.currentSector;
      this.currentSector = newSector;

      // Update ground height
      this.player.groundHeight = newSector.floorHeight;
      this.metrics.sectorChanges++;

      Logger.debug(`[PHYSICS] Sector change: ${oldSector?.id || 'null'} → ${newSector.id}`);

      return {
        type: 'sector_change',
        position: this.player.position.clone(),
        newSector,
        oldSector,
      };
    }

    return null;
  }

  private updateMetrics(frameTime: number): void {
    this.frameTimeHistory.push(frameTime);
    if (this.frameTimeHistory.length > this.FRAME_HISTORY_SIZE) {
      this.frameTimeHistory.shift();
    }

    const collisionMetrics = this.collisionDetector.getMetrics();
    this.metrics.collisionChecks = collisionMetrics.collisionChecks;
    this.metrics.lineTestsPerFrame = collisionMetrics.lineTests;
    this.metrics.averageFrameTime =
      this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
  }

  // Getters
  public getPosition(): Vector3 {
    return this.player.position.clone();
  }
  public getVelocity(): Vector3 {
    return this.player.velocity.clone();
  }
  public getCurrentSector(): DoomSector | null {
    return this.currentSector;
  }
  public isOnGround(): boolean {
    return this.player.isOnGround;
  }
  public getMetrics(): PhysicsMetrics {
    return { ...this.metrics };
  }

  // Setters
  public setPosition(position: Vector3): void {
    this.player.position = position.clone();
    // Update sector detection
    this.updateSectorDetection();
  }

  public setConfig(config: Partial<PhysicsConfig>): void {
    Object.assign(this.config, config);
    Logger.info('[PHYSICS] Updated config', this.config);
  }

  public dispose(): void {
    this.collisionDetector.dispose();
    Logger.info('[PHYSICS] PhysicsController disposed');
  }
}
