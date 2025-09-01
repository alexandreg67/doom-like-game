import {
  type Camera,
  Color3,
  Mesh,
  MeshBuilder,
  type Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core';
import type { Entity, System, Transform } from '@doom-like/game-logic';
// Logger will be imported from the engine package when available
// For now, we'll use console logging

import type { EnemyIdentityComponent, EnemyStateComponent } from '../components';
import {
  BillboardMode,
  type EnemyRenderComponent,
  LODLevel,
  calculateLODLevel,
  calculateSpriteDirection,
  createDefaultEnemyRenderComponent,
  updateAnimation,
} from '../components/enemy-render-component';
import { EnemySpriteManager } from '../rendering/enemy-sprite-manager';
import { EnemyState } from '../types';

/**
 * Performance metrics for the render system
 */
interface EnemyRenderMetrics {
  totalEnemies: number;
  renderedEnemies: number;
  culledEnemies: number;
  animatedEnemies: number;
  frameTime: number;
  averageDistance: number;
  lodBreakdown: Record<LODLevel, number>;
}

/**
 * Configuration for the enemy render system
 */
export interface EnemyRenderSystemConfig {
  /** Maximum number of enemies to render per frame */
  maxRenderedEnemies: number;
  /** Enable LOD system */
  enableLOD: boolean;
  /** Enable animation system */
  enableAnimations: boolean;
  /** Enable debug visualization */
  enableDebug: boolean;
  /** Performance optimization level */
  optimizationLevel: 'low' | 'medium' | 'high';
}

/**
 * EnemyRenderSystem - Manages 3D rendering of all enemies
 *
 * Responsibilities:
 * - Billboard sprite rendering with 8-direction support
 * - Animation state management synced with FSM
 * - LOD system for performance optimization
 * - Integration with Babylon.js scene graph
 * - Performance monitoring and optimization
 */
export class EnemyRenderSystem implements System {
  private scene: Scene;
  private camera: Camera | null = null;
  private spriteManager: EnemySpriteManager;
  private config: EnemyRenderSystemConfig;

  // Performance tracking
  private metrics: EnemyRenderMetrics;

  // Component caches for performance
  private renderComponentsCache: Map<string, EnemyRenderComponent> = new Map();
  private lastCacheUpdate = 0;
  private readonly cacheUpdateInterval = 100; // ms

  constructor(scene: Scene, camera: Camera, config: Partial<EnemyRenderSystemConfig> = {}) {
    this.scene = scene;
    this.camera = camera;
    this.spriteManager = new EnemySpriteManager(scene);

    // Apply default configuration
    this.config = {
      maxRenderedEnemies: 50,
      enableLOD: true,
      enableAnimations: true,
      enableDebug: false,
      optimizationLevel: 'medium',
      ...config,
    };

    this.metrics = this.createEmptyMetrics();

    console.log('[ENEMY_RENDER] EnemyRenderSystem initialized');
  }

  /**
   * Main update loop - called every frame by SceneManager
   */
  async update(entities: Entity[], deltaTime: number): Promise<void> {
    const startTime = performance.now();

    // Update cache periodically
    if (startTime - this.lastCacheUpdate > this.cacheUpdateInterval) {
      this.updateComponentCache(entities);
      this.lastCacheUpdate = startTime;
    }

    // Reset metrics
    this.metrics = this.createEmptyMetrics();

    // Get camera position for distance calculations
    const cameraPosition = this.camera?.position || Vector3.Zero();

    // Process all enemy entities - await each to prevent resource leaks
    const enemyPromises: Promise<void>[] = [];
    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        enemyPromises.push(this.updateEnemyRendering(entity, deltaTime, cameraPosition));
        this.metrics.totalEnemies++;
      }
    }

    // Wait for all enemy updates to complete
    await Promise.allSettled(enemyPromises);

    // Performance cleanup
    this.spriteManager.cleanupCache();

    // Calculate final metrics
    this.metrics.frameTime = performance.now() - startTime;
    this.metrics.averageDistance = this.calculateAverageDistance();
  }

  /**
   * Updates rendering for a single enemy entity
   */
  private async updateEnemyRendering(
    entity: Entity,
    deltaTime: number,
    cameraPosition: Vector3
  ): Promise<void> {
    try {
      // Get required components
      const renderComp = this.getEnemyRenderComponent(entity);
      const stateComp = entity.components.get('enemyState') as EnemyStateComponent;
      const transform = entity.components.get('transform') as Transform;
      const identityComp = entity.components.get('enemyIdentity') as EnemyIdentityComponent;

      if (!renderComp || !stateComp || !transform || !identityComp) {
        return; // Skip if missing required components
      }

      // Update distance and LOD
      this.updateDistanceAndLOD(renderComp, transform, cameraPosition);

      // Skip rendering if culled
      if (renderComp.lodLevel === LODLevel.CULLED) {
        this.hideEnemy(renderComp);
        this.metrics.culledEnemies++;
        return;
      }

      // Initialize or update mesh
      await this.ensureEnemyMesh(renderComp, identityComp, transform);

      // Update sprite direction
      this.updateSpriteDirection(renderComp, transform, cameraPosition);

      // Update animation
      if (this.config.enableAnimations) {
        this.updateEnemyAnimation(renderComp, stateComp, identityComp, deltaTime);
      }

      // Update visual properties
      this.updateVisualProperties(renderComp, stateComp, transform);

      // Update mesh transform
      this.updateMeshTransform(renderComp, transform);

      this.metrics.renderedEnemies++;
      if (renderComp.animationState.isPlaying) {
        this.metrics.animatedEnemies++;
      }

      // Update LOD breakdown
      this.metrics.lodBreakdown[renderComp.lodLevel]++;
    } catch (error) {
      console.error(`[ENEMY_RENDER] Error updating enemy ${entity.id}:`, error);
    }
  }

  /**
   * Ensures enemy has a mesh and material
   */
  private async ensureEnemyMesh(
    renderComp: EnemyRenderComponent,
    identityComp: EnemyIdentityComponent,
    transform: Transform
  ): Promise<void> {
    if (renderComp.mesh && renderComp.material) {
      return; // Already initialized
    }

    try {
      // Create billboard quad mesh
      const mesh = MeshBuilder.CreatePlane(
        `enemy_${identityComp.instanceId}`,
        {
          size: 2.0, // 2x2 units (will be scaled by component)
          updatable: false, // Static geometry
        },
        this.scene
      );

      // Configure billboard behavior
      this.setupBillboard(mesh, renderComp.billboardMode);

      // Create material
      const material = new StandardMaterial(`enemy_mat_${identityComp.instanceId}`, this.scene);

      // Configure material for sprite rendering
      material.diffuseColor = Color3.White();
      material.specularColor = Color3.Black(); // No specular for sprites
      material.emissiveColor = Color3.Black();
      material.backFaceCulling = false; // Show both sides
      material.useAlphaFromDiffuseTexture = true; // Enable transparency

      // Load sprite sheet and set initial texture
      const spriteSheet = await this.spriteManager.loadSpriteSheet(identityComp.type);
      renderComp.spriteSheet = spriteSheet;

      // Set initial texture
      const initialTexture = this.spriteManager.getFrameTexture(
        spriteSheet,
        EnemyState.IDLE,
        renderComp.currentDirection,
        0
      );

      if (initialTexture) {
        material.diffuseTexture = initialTexture;
      }

      // Assign to component
      renderComp.mesh = mesh;
      renderComp.material = material;
      mesh.material = material;

      // Set initial position
      mesh.position.x = transform.x;
      mesh.position.y = transform.y;
      mesh.position.z = transform.z;

      // Apply initial scale
      mesh.scaling = renderComp.scale.clone();

      console.log(`[ENEMY_RENDER] Created mesh for enemy ${identityComp.instanceId}`);
    } catch (error) {
      console.error(
        `[ENEMY_RENDER] Failed to create mesh for enemy ${identityComp.instanceId}:`,
        error
      );
    }
  }

  /**
   * Configures billboard behavior on mesh
   */
  private setupBillboard(mesh: Mesh, billboardMode: BillboardMode): void {
    switch (billboardMode) {
      case BillboardMode.ALL:
        mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
        break;
      case BillboardMode.Y_AXIS:
        mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
        break;
      case BillboardMode.NONE:
        mesh.billboardMode = Mesh.BILLBOARDMODE_NONE;
        break;
    }
  }

  /**
   * Updates distance to camera and LOD level
   */
  private updateDistanceAndLOD(
    renderComp: EnemyRenderComponent,
    transform: Transform,
    cameraPosition: Vector3
  ): void {
    if (!this.config.enableLOD) {
      renderComp.lodLevel = LODLevel.HIGH;
      return;
    }

    // Calculate distance
    const enemyPosition = new Vector3(transform.x, transform.y, transform.z);
    const distance = Vector3.Distance(enemyPosition, cameraPosition);
    renderComp.distanceToCamera = distance;

    // Update LOD
    const newLOD = calculateLODLevel(distance, renderComp.lodThresholds);

    if (newLOD !== renderComp.lodLevel) {
      renderComp.lodLevel = newLOD;
      renderComp.renderStats.lodChanges++;

      // Apply LOD-specific optimizations
      this.applyLODOptimizations(renderComp);
    }
  }

  /**
   * Applies optimizations based on LOD level
   */
  private applyLODOptimizations(renderComp: EnemyRenderComponent): void {
    if (!renderComp.mesh) return;

    switch (renderComp.lodLevel) {
      case LODLevel.HIGH:
        // Full quality
        renderComp.mesh.isVisible = true;
        renderComp.animationState.animationSpeed = 8; // Full animation speed
        break;

      case LODLevel.MEDIUM:
        // Reduced quality
        renderComp.mesh.isVisible = true;
        renderComp.animationState.animationSpeed = 4; // Half animation speed
        break;

      case LODLevel.LOW:
        // Minimal quality
        renderComp.mesh.isVisible = true;
        renderComp.animationState.isPlaying = false; // No animation
        break;

      case LODLevel.CULLED:
        // Not visible
        renderComp.mesh.isVisible = false;
        renderComp.animationState.isPlaying = false;
        break;
    }
  }

  /**
   * Updates sprite direction based on enemy-camera relationship
   */
  private updateSpriteDirection(
    renderComp: EnemyRenderComponent,
    transform: Transform,
    cameraPosition: Vector3
  ): void {
    if (renderComp.billboardMode === BillboardMode.ALL) {
      // Full billboard - no direction needed
      return;
    }

    // Calculate enemy forward direction (simplified - could use rotation)
    const enemyForward = new Vector3(0, 0, 1); // Default forward
    const enemyPosition = new Vector3(transform.x, transform.y, transform.z);

    const newDirection = calculateSpriteDirection(enemyPosition, enemyForward, cameraPosition);

    if (newDirection !== renderComp.currentDirection) {
      renderComp.lastDirection = renderComp.currentDirection;
      renderComp.currentDirection = newDirection;
      renderComp.renderStats.directionChanges++;

      // Update texture for new direction
      this.updateSpriteTexture(renderComp);
    }
  }

  /**
   * Updates animation state and frames
   */
  private updateEnemyAnimation(
    renderComp: EnemyRenderComponent,
    stateComp: EnemyStateComponent,
    identityComp: EnemyIdentityComponent,
    deltaTime: number
  ): void {
    // Check if FSM state changed
    if (stateComp.currentState !== renderComp.lastFSMState) {
      this.transitionToNewState(renderComp, stateComp.currentState, identityComp);
      renderComp.lastFSMState = stateComp.currentState;
    }

    // Update animation timing
    if (updateAnimation(renderComp.animationState, deltaTime)) {
      renderComp.renderStats.animationFrameChanges++;
      this.updateSpriteTexture(renderComp);
    }
  }

  /**
   * Transitions animation to new FSM state
   */
  private transitionToNewState(
    renderComp: EnemyRenderComponent,
    newState: EnemyState,
    identityComp: EnemyIdentityComponent
  ): void {
    if (!renderComp.spriteSheet) return;

    // Get animation config for new state
    const animConfig = this.spriteManager.getAnimationConfig(identityComp.type, newState);
    if (!animConfig) return;

    // Update animation state
    renderComp.animationState = {
      currentFrame: 0,
      totalFrames: animConfig.frameCount,
      animationSpeed: animConfig.fps,
      frameTimer: 0,
      loop: animConfig.loop,
      isPlaying: true,
      sequenceName: animConfig.name,
    };

    console.log(`[ENEMY_RENDER] Transitioned to animation: ${animConfig.name}`);
  }

  /**
   * Updates sprite texture based on current state/direction/frame
   */
  private updateSpriteTexture(renderComp: EnemyRenderComponent): void {
    if (!renderComp.spriteSheet || !renderComp.material || !renderComp.lastFSMState) {
      return;
    }

    const texture = this.spriteManager.getFrameTexture(
      renderComp.spriteSheet,
      renderComp.lastFSMState,
      renderComp.currentDirection,
      renderComp.animationState.currentFrame
    );

    if (texture && texture !== renderComp.material.diffuseTexture) {
      renderComp.material.diffuseTexture = texture;
    }
  }

  /**
   * Updates visual properties like tint, alpha, scale
   */
  private updateVisualProperties(
    renderComp: EnemyRenderComponent,
    stateComp: EnemyStateComponent,
    _transform: Transform
  ): void {
    if (!renderComp.mesh || !renderComp.material) return;

    // Update alpha
    renderComp.material.alpha = renderComp.alpha;

    // Update tint color (for damage effects, etc.)
    if (stateComp.currentState === EnemyState.HURT) {
      renderComp.material.emissiveColor = new Color3(0.3, 0, 0); // Red tint
    } else {
      renderComp.material.emissiveColor = Color3.Black();
    }

    // Update scale
    renderComp.mesh.scaling = renderComp.scale.clone();

    // Update visibility
    renderComp.mesh.isVisible = renderComp.isVisible && renderComp.lodLevel !== LODLevel.CULLED;
  }

  /**
   * Updates mesh transform from ECS transform component
   */
  private updateMeshTransform(renderComp: EnemyRenderComponent, transform: Transform): void {
    if (!renderComp.mesh) return;

    renderComp.mesh.position.x = transform.x;
    renderComp.mesh.position.y = transform.y;
    renderComp.mesh.position.z = transform.z;

    // Note: Rotation handled by billboard system
  }

  /**
   * Hides enemy mesh (for culled enemies)
   */
  private hideEnemy(renderComp: EnemyRenderComponent): void {
    if (renderComp.mesh) {
      renderComp.mesh.isVisible = false;
    }
  }

  /**
   * Gets or creates enemy render component
   */
  private getEnemyRenderComponent(entity: Entity): EnemyRenderComponent {
    let renderComp = entity.components.get('enemyRender') as EnemyRenderComponent;

    if (!renderComp) {
      // Create default render component
      renderComp = createDefaultEnemyRenderComponent();
      entity.components.set('enemyRender', renderComp);
    }

    return renderComp;
  }

  /**
   * Checks if entity is an enemy
   */
  private isEnemyEntity(entity: Entity): boolean {
    return entity.components.has('enemyIdentity');
  }

  /**
   * Updates component cache for performance
   */
  private updateComponentCache(entities: Entity[]): void {
    this.renderComponentsCache.clear();

    for (const entity of entities) {
      if (this.isEnemyEntity(entity)) {
        const renderComp = entity.components.get('enemyRender') as EnemyRenderComponent;
        if (renderComp) {
          this.renderComponentsCache.set(entity.id, renderComp);
        }
      }
    }
  }

  /**
   * Creates empty metrics object
   */
  private createEmptyMetrics(): EnemyRenderMetrics {
    return {
      totalEnemies: 0,
      renderedEnemies: 0,
      culledEnemies: 0,
      animatedEnemies: 0,
      frameTime: 0,
      averageDistance: 0,
      lodBreakdown: {
        [LODLevel.HIGH]: 0,
        [LODLevel.MEDIUM]: 0,
        [LODLevel.LOW]: 0,
        [LODLevel.CULLED]: 0,
      },
    };
  }

  /**
   * Calculates average distance of rendered enemies
   */
  private calculateAverageDistance(): number {
    let totalDistance = 0;
    let count = 0;

    for (const renderComp of this.renderComponentsCache.values()) {
      if (renderComp.lodLevel !== LODLevel.CULLED) {
        totalDistance += renderComp.distanceToCamera;
        count++;
      }
    }

    return count > 0 ? totalDistance / count : 0;
  }

  /**
   * Gets current performance metrics
   */
  getMetrics(): EnemyRenderMetrics {
    return { ...this.metrics };
  }

  /**
   * Sets camera reference
   */
  setCamera(camera: Camera): void {
    this.camera = camera;
  }

  /**
   * Updates system configuration
   */
  updateConfig(newConfig: Partial<EnemyRenderSystemConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('[ENEMY_RENDER] Configuration updated:', this.config);
  }

  /**
   * Enables/disables debug mode
   */
  setDebugMode(enabled: boolean): void {
    this.config.enableDebug = enabled;

    // Update all render components
    for (const renderComp of this.renderComponentsCache.values()) {
      renderComp.showDebug = enabled;
    }
  }

  /**
   * Disposes of all resources
   */
  dispose(): void {
    console.log('[ENEMY_RENDER] Disposing EnemyRenderSystem...');

    // Dispose sprite manager
    this.spriteManager.dispose();

    // Dispose all enemy meshes
    for (const renderComp of this.renderComponentsCache.values()) {
      if (renderComp.mesh) {
        renderComp.mesh.dispose();
      }
      if (renderComp.material) {
        renderComp.material.dispose();
      }
    }

    // Clear caches
    this.renderComponentsCache.clear();

    console.log('[ENEMY_RENDER] EnemyRenderSystem disposed');
  }
}
