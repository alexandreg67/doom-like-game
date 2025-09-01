import {
  Color3,
  type Mesh,
  type Sprite,
  type StandardMaterial,
  type Texture,
  Vector3,
} from '@babylonjs/core';
import type { Component } from '@doom-like/game-logic';
import type { EnemyState } from '../types';

/**
 * Billboard mode for enemy sprites (DOOM-style)
 */
export enum BillboardMode {
  /** Always face camera (full billboard) */
  ALL = 'all',
  /** Only rotate around Y axis (cylindrical billboard) */
  Y_AXIS = 'y-axis',
  /** No billboard rotation (static) */
  NONE = 'none',
}

/**
 * Level of Detail for performance optimization
 */
export enum LODLevel {
  /** High detail: Full animation frames + effects */
  HIGH = 'high',
  /** Medium detail: Reduced animation frames */
  MEDIUM = 'medium',
  /** Low detail: Static sprites only */
  LOW = 'low',
  /** Culled: Not rendered */
  CULLED = 'culled',
}

/**
 * Sprite direction for 8-direction DOOM-style rendering
 */
export enum SpriteDirection {
  FRONT = 0, // 0°   - Face au joueur
  FRONT_RIGHT = 1, // 45°  - Diagonal avant-droite
  RIGHT = 2, // 90°  - Profil droit
  BACK_RIGHT = 3, // 135° - Diagonal arrière-droite
  BACK = 4, // 180° - Dos au joueur
  BACK_LEFT = 5, // 225° - Diagonal arrière-gauche
  LEFT = 6, // 270° - Profil gauche
  FRONT_LEFT = 7, // 315° - Diagonal avant-gauche
}

/**
 * Animation state for sprite sequences
 */
export interface AnimationState {
  /** Current animation frame index */
  currentFrame: number;
  /** Total frames in current animation */
  totalFrames: number;
  /** Animation speed (frames per second) */
  animationSpeed: number;
  /** Time since last frame change */
  frameTimer: number;
  /** Whether animation should loop */
  loop: boolean;
  /** Whether animation is currently playing */
  isPlaying: boolean;
  /** Animation sequence name (walk, attack, etc.) */
  sequenceName: string;
}

/**
 * Sprite sheet data for enemy textures
 */
export interface SpriteSheet {
  /** Base texture atlas */
  texture: Texture;
  /** Frame definitions by state and direction */
  frames: Map<string, Texture[]>; // Key: "state_direction" (e.g., "CHASE_2")
  /** Frame dimensions */
  frameWidth: number;
  frameHeight: number;
  /** Total atlas dimensions */
  atlasWidth: number;
  atlasHeight: number;
}

/**
 * EnemyRender component - handles 3D rendering and visual representation
 * Integrates enemy ECS system with Babylon.js rendering pipeline
 */
export interface EnemyRenderComponent extends Component {
  id: 'enemyRender';

  // === Babylon.js Objects ===
  /** Main mesh for the enemy (billboard quad) */
  mesh: Mesh | null;

  /** Material with current sprite texture */
  material: StandardMaterial | null;

  /** Optional Babylon.js sprite (alternative to mesh) */
  sprite: Sprite | null;

  // === Billboard Configuration ===
  /** Billboard behavior mode */
  billboardMode: BillboardMode;

  /** Current sprite direction (0-7) */
  currentDirection: SpriteDirection;

  /** Last calculated direction for change detection */
  lastDirection: SpriteDirection;

  // === Sprite System ===
  /** Sprite sheet data for all animations */
  spriteSheet: SpriteSheet | null;

  /** Current animation state */
  animationState: AnimationState;

  /** Previous FSM state for animation transitions */
  lastFSMState: EnemyState | null;

  // === LOD System ===
  /** Current level of detail */
  lodLevel: LODLevel;

  /** Distance to camera for LOD calculation */
  distanceToCamera: number;

  /** Maximum render distance before culling */
  cullingDistance: number;

  /** LOD thresholds */
  lodThresholds: {
    highDetailDistance: number;
    mediumDetailDistance: number;
    lowDetailDistance: number;
  };

  // === Visual Properties ===
  /** Base scale of the enemy sprite */
  scale: Vector3;

  /** Tint color for damage/special effects */
  tintColor: Color3;

  /** Alpha transparency (0-1) */
  alpha: number;

  /** Whether mesh should cast shadows */
  castShadows: boolean;

  /** Whether mesh should receive shadows */
  receiveShadows: boolean;

  // === Performance & Debug ===
  /** Whether this enemy is currently visible */
  isVisible: boolean;

  /** Whether to show debug information */
  showDebug: boolean;

  /** Debug wireframe mode */
  wireframe: boolean;

  /** Collision bounds visualization */
  showBounds: boolean;

  /** Last frame update timestamp */
  lastUpdateTime: number;

  /** Render statistics */
  renderStats: {
    frameUpdates: number;
    directionChanges: number;
    animationFrameChanges: number;
    lodChanges: number;
  };
}

/**
 * Creates a default EnemyRenderComponent
 */
export function createDefaultEnemyRenderComponent(): EnemyRenderComponent {
  return {
    id: 'enemyRender',

    // Babylon.js objects
    mesh: null,
    material: null,
    sprite: null,

    // Billboard configuration
    billboardMode: BillboardMode.Y_AXIS, // DOOM-style cylindrical billboard
    currentDirection: SpriteDirection.FRONT,
    lastDirection: SpriteDirection.FRONT,

    // Sprite system
    spriteSheet: null,
    animationState: {
      currentFrame: 0,
      totalFrames: 1,
      animationSpeed: 8, // 8 FPS for DOOM-like animation
      frameTimer: 0,
      loop: true,
      isPlaying: false,
      sequenceName: 'idle',
    },
    lastFSMState: null,

    // LOD system
    lodLevel: LODLevel.HIGH,
    distanceToCamera: 0,
    cullingDistance: 100, // 100 units max render distance
    lodThresholds: {
      highDetailDistance: 20, // < 20 units: full detail
      mediumDetailDistance: 50, // 20-50 units: medium detail
      lowDetailDistance: 100, // 50-100 units: low detail
    },

    // Visual properties
    scale: new Vector3(1, 1, 1),
    tintColor: new Color3(1, 1, 1), // White (no tint)
    alpha: 1.0,
    castShadows: true,
    receiveShadows: true,

    // Performance & debug
    isVisible: true,
    showDebug: false,
    wireframe: false,
    showBounds: false,
    lastUpdateTime: 0,
    renderStats: {
      frameUpdates: 0,
      directionChanges: 0,
      animationFrameChanges: 0,
      lodChanges: 0,
    },
  };
}

/**
 * Calculates sprite direction based on enemy-to-camera angle
 */
export function calculateSpriteDirection(
  enemyPosition: Vector3,
  enemyForward: Vector3,
  cameraPosition: Vector3
): SpriteDirection {
  // Calculate vector from enemy to camera
  const toCamera = cameraPosition.subtract(enemyPosition).normalize();

  // Calculate angle between enemy forward direction and camera direction
  const dot = Vector3.Dot(enemyForward, toCamera);
  const cross = Vector3.Cross(enemyForward, toCamera);
  const angle = Math.atan2(cross.y, dot);

  // Convert to positive angle (0 to 2π)
  const positiveAngle = angle < 0 ? angle + Math.PI * 2 : angle;

  // Convert to sprite direction (8 directions)
  const directionIndex = Math.round((positiveAngle / (Math.PI * 2)) * 8) % 8;

  return directionIndex as SpriteDirection;
}

/**
 * Calculates LOD level based on distance to camera
 */
export function calculateLODLevel(
  distanceToCamera: number,
  lodThresholds: {
    highDetailDistance: number;
    mediumDetailDistance: number;
    lowDetailDistance: number;
  }
): LODLevel {
  if (distanceToCamera <= lodThresholds.highDetailDistance) {
    return LODLevel.HIGH;
  }
  if (distanceToCamera <= lodThresholds.mediumDetailDistance) {
    return LODLevel.MEDIUM;
  }
  if (distanceToCamera <= lodThresholds.lowDetailDistance) {
    return LODLevel.LOW;
  }
  return LODLevel.CULLED;
}

/**
 * Generates sprite frame key for lookup
 */
export function getSpriteFrameKey(state: EnemyState, direction: SpriteDirection): string {
  return `${state}_${direction}`;
}

/**
 * Updates animation state based on time delta
 */
export function updateAnimation(animationState: AnimationState, deltaTime: number): boolean {
  if (!animationState.isPlaying || animationState.totalFrames <= 1) {
    return false; // No animation change
  }

  animationState.frameTimer += deltaTime;
  const frameDuration = 1.0 / animationState.animationSpeed;

  if (animationState.frameTimer >= frameDuration) {
    animationState.frameTimer = 0;
    animationState.currentFrame++;

    if (animationState.currentFrame >= animationState.totalFrames) {
      if (animationState.loop) {
        animationState.currentFrame = 0;
      } else {
        animationState.currentFrame = animationState.totalFrames - 1;
        animationState.isPlaying = false;
      }
    }

    return true; // Animation frame changed
  }

  return false; // No frame change
}

/**
 * Validates EnemyRenderComponent data
 */
export function validateEnemyRenderComponent(component: EnemyRenderComponent): string[] {
  const errors: string[] = [];

  // Check required fields
  if (component.id !== 'enemyRender') {
    errors.push('Invalid component id, expected "enemyRender"');
  }

  // Validate LOD thresholds
  if (
    component.lodThresholds.highDetailDistance >= component.lodThresholds.mediumDetailDistance ||
    component.lodThresholds.mediumDetailDistance >= component.lodThresholds.lowDetailDistance
  ) {
    errors.push('Invalid LOD thresholds: must be in ascending order');
  }

  // Validate animation state
  if (
    component.animationState.currentFrame < 0 ||
    component.animationState.totalFrames < 1 ||
    component.animationState.currentFrame >= component.animationState.totalFrames
  ) {
    errors.push('Invalid animation state: invalid frame values');
  }

  // Validate visual properties
  if (component.alpha < 0 || component.alpha > 1) {
    errors.push('Invalid alpha value: must be between 0 and 1');
  }

  return errors;
}
