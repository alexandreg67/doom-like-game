/**
 * FPS camera controller with mouse look and AZERTY support
 */

import { Vector3 } from '@babylonjs/core';
import type { InputAction, InputListener, InputManager } from '../input';
import type { PlayerController } from '../player';

export interface CameraConfig {
  // Mouse sensitivity
  mouseSensitivity: number;
  mouseInvertY: boolean;

  // View limits
  maxPitch: number;
  minPitch: number;

  // Smoothing
  smoothing: number;
  rotationSmoothing: number;

  // Field of view
  fov: number;
  nearPlane: number;
  farPlane: number;
}

export interface CameraState {
  // Position (follows player)
  position: Vector3;

  // Rotation (pitch/yaw in radians)
  yaw: number;
  pitch: number;

  // Smoothed values
  smoothedYaw: number;
  smoothedPitch: number;

  // Look direction
  forward: Vector3;
  right: Vector3;
  up: Vector3;
}

export class FPSCameraController implements InputListener {
  private static readonly TARGET_FPS = 60;

  private inputManager: InputManager;
  private playerController: PlayerController;
  private config: CameraConfig;
  private state: CameraState;

  private pointerLocked = false;

  constructor(
    inputManager: InputManager,
    playerController: PlayerController,
    config?: Partial<CameraConfig>
  ) {
    this.inputManager = inputManager;
    this.playerController = playerController;

    // Default configuration
    this.config = {
      // Mouse sensitivity
      mouseSensitivity: 0.002,
      mouseInvertY: false,

      // View limits (in radians)
      maxPitch: Math.PI / 2 - 0.1, // 89 degrees
      minPitch: -Math.PI / 2 + 0.1, // -89 degrees

      // Smoothing
      smoothing: 1.0, // No smoothing by default for responsive FPS
      rotationSmoothing: 1.0,

      // Field of view
      fov: Math.PI / 3, // 60 degrees
      nearPlane: 0.1,
      farPlane: 1000.0,

      ...config,
    };

    // Initialize camera state
    this.state = {
      position: new Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      smoothedYaw: 0,
      smoothedPitch: 0,
      forward: new Vector3(0, 0, 1),
      right: new Vector3(1, 0, 0),
      up: new Vector3(0, 1, 0),
    };

    this.inputManager.addListener(this);

    console.log(
      '[CAMERA] FPS Camera Controller initialized with mouse sensitivity:',
      this.config.mouseSensitivity
    );
  }

  /**
   * Update camera state (called each frame)
   */
  public update(deltaTime: number): void {
    this.updatePosition();
    this.updateRotation(deltaTime);
    this.updateDirectionVectors();
  }

  /**
   * Get current camera configuration
   */
  public getConfig(): CameraConfig {
    return { ...this.config };
  }

  /**
   * Update camera configuration
   */
  public updateConfig(newConfig: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Apply mouse sensitivity to input manager
    this.inputManager.updateConfig({
      mouseSensitivity: this.config.mouseSensitivity,
    });
  }

  /**
   * Get current camera state (read-only)
   */
  public getState(): Readonly<CameraState> {
    return {
      position: this.state.position.clone(),
      yaw: this.state.yaw,
      pitch: this.state.pitch,
      smoothedYaw: this.state.smoothedYaw,
      smoothedPitch: this.state.smoothedPitch,
      forward: this.state.forward.clone(),
      right: this.state.right.clone(),
      up: this.state.up.clone(),
    };
  }

  /**
   * Get view matrix for rendering
   */
  public getViewMatrix(): Float32Array {
    const target = this.state.position.add(this.state.forward);

    // Create look-at matrix
    return this.createLookAtMatrix(this.state.position, target, this.state.up);
  }

  /**
   * Get projection matrix for rendering
   */
  public getProjectionMatrix(aspectRatio: number): Float32Array {
    return this.createPerspectiveMatrix(
      this.config.fov,
      aspectRatio,
      this.config.nearPlane,
      this.config.farPlane
    );
  }

  /**
   * Request pointer lock for mouse look
   */
  public async requestPointerLock(): Promise<boolean> {
    return await this.inputManager.requestPointerLock();
  }

  /**
   * Exit pointer lock
   */
  public exitPointerLock(): void {
    this.inputManager.exitPointerLock();
  }

  /**
   * Set camera rotation (for external control)
   */
  public setRotation(yaw: number, pitch: number): void {
    this.state.yaw = yaw;
    this.state.pitch = Math.max(this.config.minPitch, Math.min(this.config.maxPitch, pitch));
    this.state.smoothedYaw = this.state.yaw;
    this.state.smoothedPitch = this.state.pitch;
  }

  /**
   * Add rotation (for external control)
   */
  public addRotation(deltaYaw: number, deltaPitch: number): void {
    this.state.yaw += deltaYaw;
    this.state.pitch = Math.max(
      this.config.minPitch,
      Math.min(this.config.maxPitch, this.state.pitch + deltaPitch)
    );
  }

  /**
   * Cleanup and remove listeners
   */
  public dispose(): void {
    this.inputManager.removeListener(this);
  }

  // InputListener implementation
  public onInputChange(_action: InputAction, _value: boolean): void {
    // Camera doesn't handle discrete key input, only mouse movement
    // Could be extended for camera-specific actions like zoom, etc.
  }

  public onMouseMove(deltaX: number, deltaY: number): void {
    if (!this.pointerLocked) return;

    // Apply mouse sensitivity and inversion
    const yawDelta = deltaX * this.config.mouseSensitivity;
    const pitchDelta = -deltaY * this.config.mouseSensitivity * (this.config.mouseInvertY ? -1 : 1);

    this.addRotation(yawDelta, pitchDelta);
  }

  public onPointerLockChange(locked: boolean): void {
    this.pointerLocked = locked;
    console.log(`[CAMERA] Pointer lock ${locked ? 'acquired' : 'released'}`);
  }

  private updatePosition(): void {
    // Follow player eye position
    const eyePosition = this.playerController.getEyePosition();
    this.state.position.copyFrom(eyePosition);
  }

  private updateRotation(deltaTime: number): void {
    // Apply smoothing if configured
    if (this.config.rotationSmoothing < 1.0) {
      const smoothingFactor =
        1.0 - (1.0 - this.config.rotationSmoothing) ** (deltaTime * FPSCameraController.TARGET_FPS);

      this.state.smoothedYaw = this.lerp(this.state.smoothedYaw, this.state.yaw, smoothingFactor);
      this.state.smoothedPitch = this.lerp(
        this.state.smoothedPitch,
        this.state.pitch,
        smoothingFactor
      );
    } else {
      this.state.smoothedYaw = this.state.yaw;
      this.state.smoothedPitch = this.state.pitch;
    }
  }

  private updateDirectionVectors(): void {
    // Calculate forward vector from yaw and pitch
    const cosYaw = Math.cos(this.state.smoothedYaw);
    const sinYaw = Math.sin(this.state.smoothedYaw);
    const cosPitch = Math.cos(this.state.smoothedPitch);
    const sinPitch = Math.sin(this.state.smoothedPitch);

    this.state.forward.set(sinYaw * cosPitch, sinPitch, cosYaw * cosPitch);

    // Calculate right vector (perpendicular to forward and world up)
    this.state.right.set(cosYaw, 0, -sinYaw);

    // Calculate up vector (perpendicular to forward and right)
    this.state.up = this.state.forward.cross(this.state.right);

    // Normalize vectors
    this.state.forward.normalize();
    this.state.right.normalize();
    this.state.up.normalize();
  }

  private createLookAtMatrix(position: Vector3, target: Vector3, up: Vector3): Float32Array {
    const zAxis = position.subtract(target).normalize();
    const xAxis = up.cross(zAxis).normalize();
    const yAxis = zAxis.cross(xAxis);

    return new Float32Array([
      xAxis.x,
      yAxis.x,
      zAxis.x,
      0,
      xAxis.y,
      yAxis.y,
      zAxis.y,
      0,
      xAxis.z,
      yAxis.z,
      zAxis.z,
      0,
      -xAxis.dot(position),
      -yAxis.dot(position),
      -zAxis.dot(position),
      1,
    ]);
  }

  private createPerspectiveMatrix(
    fov: number,
    aspect: number,
    near: number,
    far: number
  ): Float32Array {
    const f = Math.tan(Math.PI * 0.5 - 0.5 * fov);
    const rangeInv = 1.0 / (near - far);

    return new Float32Array([
      f / aspect,
      0,
      0,
      0,
      0,
      f,
      0,
      0,
      0,
      0,
      (near + far) * rangeInv,
      -1,
      0,
      0,
      near * far * rangeInv * 2,
      0,
    ]);
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * Math.min(factor, 1);
  }
}
