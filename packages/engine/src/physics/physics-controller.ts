import { Vector2, Vector3 } from '@babylonjs/core';
import type { DoomSector } from '../geometry/doom-geometry';
import { Logger } from '../utils/logger';
import { CollisionDetector } from './collision-detector';
import type { 
  PlayerController, 
  MovementInput, 
  PhysicsConfig, 
  CollisionEvent,
  PhysicsMetrics,
  CollisionGeometry
} from './types';

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
      gravity: -9.81,
      jumpForce: 4.5,
      walkSpeed: 2.5,
      sprintSpeed: 4.0,
      friction: 0.8,
      airControl: 0.3,
      maxVelocity: 10.0,
      ...config
    };

    this.player = {
      position: initialPosition.clone(),
      velocity: Vector3.Zero(),
      radius: 0.3, // 30cm radius for collision
      height: 1.8, // 1.8m tall
      groundHeight: 0,
      isOnGround: false,
    };

    Logger.info('[PHYSICS] PhysicsController initialized', {
      position: this.player.position,
      config: this.config
    });
  }

  public setGeometry(geometry: CollisionGeometry): void {
    this.collisionDetector.setGeometry(geometry);
    
    // Find initial sector
    const pos2D = new Vector2(this.player.position.x, this.player.position.z);
    this.currentSector = this.collisionDetector.findSectorAtPosition(pos2D);
    
    if (this.currentSector) {
      this.player.groundHeight = this.currentSector.floorHeight;
      this.player.isOnGround = Math.abs(this.player.position.y - this.player.groundHeight) < 0.1;
      Logger.info(`[PHYSICS] Player in sector: ${this.currentSector.id}`);
    }
  }

  public update(input: MovementInput, deltaTime: number): CollisionEvent[] {
    const startTime = performance.now();
    const events: CollisionEvent[] = [];

    // Apply input to velocity
    this.applyMovementInput(input, deltaTime);

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

  private applyMovementInput(input: MovementInput, deltaTime: number): void {
    const speed = input.sprint ? this.config.sprintSpeed : this.config.walkSpeed;
    const control = this.player.isOnGround ? 1.0 : this.config.airControl;

    // Calculate movement in world space (assuming Y-up, X-right, Z-forward)
    const forwardMovement = new Vector3(0, 0, input.forward * speed * control);
    const strafeMovement = new Vector3(input.strafe * speed * control, 0, 0);
    
    const movement = forwardMovement.add(strafeMovement);
    
    // Add to horizontal velocity
    this.player.velocity.x += movement.x * deltaTime;
    this.player.velocity.z += movement.z * deltaTime;
    
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

    // Friction (only when on ground)
    if (this.player.isOnGround) {
      const friction = Math.pow(this.config.friction, deltaTime);
      this.player.velocity.x *= friction;
      this.player.velocity.z *= friction;
    }
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
        normal: collision.normal
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
    if (!this.currentSector) return;

    const newY = this.player.position.y + this.player.velocity.y * deltaTime;
    const floorY = this.currentSector.floorHeight;
    const ceilingY = this.currentSector.ceilingHeight;

    // Floor collision
    if (newY <= floorY) {
      this.player.position.y = floorY;
      this.player.velocity.y = 0;
      this.player.isOnGround = true;
      this.player.groundHeight = floorY;
      
      events.push({
        type: 'floor',
        position: this.player.position.clone()
      });
    }
    // Ceiling collision
    else if (newY + this.player.height >= ceilingY) {
      this.player.position.y = ceilingY - this.player.height;
      this.player.velocity.y = Math.min(0, this.player.velocity.y); // Don't allow upward velocity
      
      events.push({
        type: 'ceiling',
        position: this.player.position.clone()
      });
    }
    // Normal movement
    else {
      this.player.position.y = newY;
      this.player.isOnGround = false;
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
        oldSector
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
    this.metrics.averageFrameTime = this.frameTimeHistory.reduce((a, b) => a + b, 0) / this.frameTimeHistory.length;
  }

  // Getters
  public getPosition(): Vector3 { return this.player.position.clone(); }
  public getVelocity(): Vector3 { return this.player.velocity.clone(); }
  public getCurrentSector(): DoomSector | null { return this.currentSector; }
  public isOnGround(): boolean { return this.player.isOnGround; }
  public getMetrics(): PhysicsMetrics { return { ...this.metrics }; }

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
