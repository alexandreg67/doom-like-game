/**
 * LODManager - Automatic Level of Detail system for optimal performance
 * Manages geometry and texture LOD based on distance and screen space size
 */

import { type AbstractMesh, type Camera, type Scene, Vector3 } from '@babylonjs/core';
import type {
  LODConfig,
  LODCullingData,
  LODInstance,
  LODLevel,
  LODMetrics,
  LODTransition,
} from './lod-types';
import type { PerformanceManager } from './performance-manager';

export class LODManager {
  private scene: Scene;
  private performanceManager: PerformanceManager;
  private config: LODConfig;

  // LOD tracking
  private lodInstances: Map<string, LODInstance> = new Map();
  private activeTransitions: Map<string, LODTransition> = new Map();
  private frameCounter = 0;
  private lastUpdateFrame = 0;

  // Performance metrics
  private metrics: LODMetrics = {
    totalMeshes: 0,
    activeMeshes: 0,
    culledMeshes: 0,
    levelDistribution: {},
    geometryMemory: 0,
    textureMemory: 0,
    processingTime: 0,
    transitionCount: 0,
  };

  // Default LOD levels for DOOM-like game
  private readonly DEFAULT_LOD_LEVELS: LODLevel[] = [
    {
      distance: 0,
      geometryScale: 1.0,
      textureScale: 1.0,
      name: 'High',
      cullSmallObjects: false,
      maxTriangles: 50000,
      maxVertices: 30000,
    },
    {
      distance: 25,
      geometryScale: 0.75,
      textureScale: 0.75,
      name: 'Medium',
      cullSmallObjects: false,
      maxTriangles: 20000,
      maxVertices: 15000,
    },
    {
      distance: 50,
      geometryScale: 0.5,
      textureScale: 0.5,
      name: 'Low',
      cullSmallObjects: true,
      maxTriangles: 8000,
      maxVertices: 6000,
    },
    {
      distance: 100,
      geometryScale: 0.25,
      textureScale: 0.25,
      name: 'VeryLow',
      cullSmallObjects: true,
      maxTriangles: 2000,
      maxVertices: 1500,
    },
  ];

  constructor(
    scene: Scene,
    performanceManager: PerformanceManager,
    config: Partial<LODConfig> = {}
  ) {
    this.scene = scene;
    this.performanceManager = performanceManager;

    this.config = {
      enableGeometryLOD: true,
      enableTextureLOD: true,
      enableCulling: true,
      updateFrequency: 2, // Update every 2 frames
      hysteresisDistance: 5, // 5 units hysteresis
      levels: this.DEFAULT_LOD_LEVELS,
      globalLODBias: 0.0,
      ...config,
    };

    console.log('[LOD] LODManager initialized with config:', this.config);
  }

  /**
   * Register a mesh for LOD management
   */
  public registerMesh(mesh: AbstractMesh, _importance = 1.0): void {
    const meshId = mesh.uniqueId.toString();

    if (this.lodInstances.has(meshId)) {
      console.warn(`[LOD] Mesh '${mesh.name}' is already registered`);
      return;
    }

    // Calculate bounding info
    const boundingInfo = mesh.getBoundingInfo();
    const boundingBox = {
      min: {
        x: boundingInfo.boundingBox.minimumWorld.x,
        y: boundingInfo.boundingBox.minimumWorld.y,
        z: boundingInfo.boundingBox.minimumWorld.z,
      },
      max: {
        x: boundingInfo.boundingBox.maximumWorld.x,
        y: boundingInfo.boundingBox.maximumWorld.y,
        z: boundingInfo.boundingBox.maximumWorld.z,
      },
    };

    const lodInstance: LODInstance = {
      meshId,
      currentLevel: 0,
      targetLevel: 0,
      lastDistance: 0,
      lastUpdateFrame: 0,
      originalGeometry: {
        vertexCount: mesh.getTotalVertices(),
        triangleCount: mesh.getTotalIndices() / 3,
        boundingBox,
      },
      lodGeometry: new Map(),
      lodTextures: new Map(),
      isVisible: mesh.isVisible,
      isCulled: false,
    };

    this.lodInstances.set(meshId, lodInstance);
    this.metrics.totalMeshes++;

    // Pre-generate LOD levels
    this.generateMeshLODLevels(mesh, lodInstance);

    console.log(
      `[LOD] Registered mesh '${mesh.name}' (${lodInstance.originalGeometry?.vertexCount} vertices)`
    );
  }

  /**
   * Unregister a mesh from LOD management
   */
  public unregisterMesh(mesh: AbstractMesh): void {
    const meshId = mesh.uniqueId.toString();

    if (this.lodInstances.delete(meshId)) {
      this.activeTransitions.delete(meshId);
      this.metrics.totalMeshes--;
      console.log(`[LOD] Unregistered mesh '${mesh.name}'`);
    }
  }

  /**
   * Update LOD system (call once per frame)
   */
  public update(camera: Camera): void {
    this.performanceManager.start('lod_update');

    this.frameCounter++;

    // Only update every N frames for performance
    if (this.frameCounter - this.lastUpdateFrame < this.config.updateFrequency) {
      this.performanceManager.end('lod_update');
      return;
    }

    this.lastUpdateFrame = this.frameCounter;

    // Reset metrics
    this.resetFrameMetrics();

    // Update all registered meshes
    for (const [meshId, lodInstance] of this.lodInstances) {
      const mesh = this.getMeshById(meshId);
      if (!mesh || mesh.isDisposed()) {
        // Mesh was disposed, remove from tracking
        this.lodInstances.delete(meshId);
        this.metrics.totalMeshes--;
        continue;
      }

      this.updateMeshLOD(mesh, lodInstance, camera);
    }

    // Process active transitions
    this.updateTransitions();

    // Update metrics
    this.updateMetrics();

    const updateTime = this.performanceManager.end('lod_update');
    this.metrics.processingTime = updateTime;

    // Log performance periodically
    if (this.frameCounter % 300 === 0) {
      // Every 5 seconds at 60fps
      this.logLODSummary();
    }
  }

  /**
   * Update LOD for a specific mesh
   */
  private updateMeshLOD(mesh: AbstractMesh, lodInstance: LODInstance, camera: Camera): void {
    // Calculate distance to camera
    const distance = Vector3.Distance(mesh.getAbsolutePosition(), camera.position);
    lodInstance.lastDistance = distance;

    // Apply global LOD bias
    const biasedDistance = distance * (1.0 + this.config.globalLODBias);

    // Determine target LOD level
    const targetLevel = this.calculateLODLevel(biasedDistance, lodInstance);

    // Check if level change is needed (with hysteresis)
    if (this.shouldChangeLODLevel(lodInstance, targetLevel, biasedDistance)) {
      lodInstance.targetLevel = targetLevel;
      this.transitionToLODLevel(mesh, lodInstance, targetLevel);
    }

    // Update culling
    if (this.config.enableCulling) {
      this.updateMeshCulling(mesh, lodInstance, camera);
    }

    lodInstance.lastUpdateFrame = this.frameCounter;
  }

  /**
   * Calculate appropriate LOD level for given distance
   */
  private calculateLODLevel(distance: number, _lodInstance: LODInstance): number {
    // Find the appropriate LOD level
    for (let i = this.config.levels.length - 1; i >= 0; i--) {
      const level = this.config.levels[i];
      if (level && distance >= level.distance) {
        return i;
      }
    }
    return 0; // Highest quality by default
  }

  /**
   * Check if LOD level should change (with hysteresis)
   */
  private shouldChangeLODLevel(
    lodInstance: LODInstance,
    targetLevel: number,
    distance: number
  ): boolean {
    if (targetLevel === lodInstance.currentLevel) {
      return false;
    }

    // Apply hysteresis to prevent flickering
    const currentLevelConfig = this.config.levels[lodInstance.currentLevel];
    if (!currentLevelConfig) return false;
    const targetLevelConfig = this.config.levels[targetLevel];
    if (!targetLevelConfig) return false;

    if (targetLevel > lodInstance.currentLevel) {
      // Moving to lower quality - require distance + hysteresis
      return distance > targetLevelConfig.distance + this.config.hysteresisDistance;
    }
    // Moving to higher quality - require distance - hysteresis
    return distance < currentLevelConfig.distance - this.config.hysteresisDistance;
  }

  /**
   * Transition mesh to new LOD level
   */
  private transitionToLODLevel(
    mesh: AbstractMesh,
    lodInstance: LODInstance,
    targetLevel: number
  ): void {
    const transition: LODTransition = {
      meshId: lodInstance.meshId,
      fromLevel: lodInstance.currentLevel,
      toLevel: targetLevel,
      startTime: performance.now(),
      duration: 150, // 150ms transition
      easing: 'ease-out',
    };

    this.activeTransitions.set(lodInstance.meshId, transition);

    // Apply immediate LOD changes
    this.applyGeometryLOD(mesh, lodInstance, targetLevel);
    this.applyTextureLOD(mesh, lodInstance, targetLevel);

    lodInstance.currentLevel = targetLevel;
    this.metrics.transitionCount++;

    console.log(
      `[LOD] Transitioning mesh '${mesh.name}' to level ${targetLevel} (${this.config.levels[targetLevel]?.name || 'Unknown'})`
    );
  }

  /**
   * Apply geometry LOD to mesh
   */
  private applyGeometryLOD(mesh: AbstractMesh, lodInstance: LODInstance, level: number): void {
    if (!this.config.enableGeometryLOD) return;

    const levelConfig = this.config.levels[level];
    if (!levelConfig) return;

    // Check if we have pre-computed LOD geometry
    const lodGeometry = lodInstance.lodGeometry?.get(level);
    if (lodGeometry) {
      // Apply pre-computed geometry
      this.applyPrecomputedGeometry(mesh, lodGeometry);
    } else {
      // Apply runtime geometry scaling (simplified approach)
      this.applyGeometryScaling(mesh, levelConfig.geometryScale);
    }
  }

  /**
   * Apply texture LOD to mesh
   */
  private applyTextureLOD(mesh: AbstractMesh, _lodInstance: LODInstance, level: number): void {
    if (!this.config.enableTextureLOD) return;

    const levelConfig = this.config.levels[level];
    if (!levelConfig) return;

    // Get material and apply texture scaling
    const material = mesh.material;
    if (material && 'diffuseTexture' in material) {
      const texture = (material as any).diffuseTexture;
      if (texture) {
        // Apply LOD bias to texture
        texture.lodLevelInAlpha = false;
        texture.lodGenerationOffset = level;
        texture.lodGenerationScale = levelConfig.textureScale;
      }
    }
  }

  /**
   * Update mesh culling based on screen space size
   */
  private updateMeshCulling(mesh: AbstractMesh, lodInstance: LODInstance, camera: Camera): void {
    const cullingData = this.calculateCullingData(mesh, camera);
    const levelConfig = this.config.levels[lodInstance.currentLevel];
    if (!levelConfig) return;

    // Cull if screen space size is too small
    const shouldCull =
      levelConfig.cullSmallObjects && cullingData.screenSpaceSize < cullingData.pixelThreshold;

    if (shouldCull !== lodInstance.isCulled) {
      lodInstance.isCulled = shouldCull;
      mesh.setEnabled(!shouldCull);

      if (shouldCull) {
        this.metrics.culledMeshes++;
      } else {
        this.metrics.activeMeshes++;
      }
    }
  }

  /**
   * Calculate culling data for mesh
   */
  private calculateCullingData(mesh: AbstractMesh, camera: Camera): LODCullingData {
    const boundingInfo = mesh.getBoundingInfo();
    const boundingSphere = boundingInfo.boundingSphere;
    const center = boundingSphere.centerWorld;
    const radius = boundingSphere.radiusWorld;

    // Calculate screen space size
    const distance = Vector3.Distance(center, camera.position);
    const screenSpaceSize = (radius / distance) * camera.fov * 100; // Approximate

    return {
      boundingSphere: {
        center: { x: center.x, y: center.y, z: center.z },
        radius,
      },
      screenSpaceSize,
      pixelThreshold: 2.0, // Cull if less than 2 pixels
      importance: 1.0,
    };
  }

  /**
   * Generate LOD levels for mesh
   */
  private generateMeshLODLevels(mesh: AbstractMesh, _lodInstance: LODInstance): void {
    // For now, we'll use runtime scaling
    // In a full implementation, this would pre-compute simplified geometries
    console.log(`[LOD] Generated LOD levels for mesh '${mesh.name}'`);
  }

  /**
   * Apply pre-computed geometry
   */
  private applyPrecomputedGeometry(mesh: AbstractMesh, _lodGeometry: unknown): void {
    // Implementation would swap vertex/index buffers
    console.log(`[LOD] Applied pre-computed geometry to mesh '${mesh.name}'`);
  }

  /**
   * Apply geometry scaling (simplified LOD)
   */
  private applyGeometryScaling(mesh: AbstractMesh, scale: number): void {
    // Simple scaling approach - in production would use mesh decimation
    mesh.scaling.scaleInPlace(scale);
  }

  /**
   * Update active transitions
   */
  private updateTransitions(): void {
    const now = performance.now();
    const completedTransitions: string[] = [];

    for (const [meshId, transition] of this.activeTransitions) {
      const elapsed = now - transition.startTime;

      if (elapsed >= transition.duration) {
        completedTransitions.push(meshId);
      }
    }

    // Remove completed transitions
    for (const meshId of completedTransitions) {
      this.activeTransitions.delete(meshId);
    }
  }

  /**
   * Get mesh by ID
   */
  private getMeshById(meshId: string): AbstractMesh | null {
    const id = Number.parseInt(meshId, 10);
    for (const mesh of this.scene.meshes) {
      if (mesh.uniqueId === id) {
        return mesh;
      }
    }
    return null;
  }

  /**
   * Reset frame metrics
   */
  private resetFrameMetrics(): void {
    this.metrics.activeMeshes = 0;
    this.metrics.culledMeshes = 0;
    this.metrics.levelDistribution = {};
    this.metrics.transitionCount = 0;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    // Count meshes by LOD level
    for (const lodInstance of this.lodInstances.values()) {
      const level = lodInstance.currentLevel;
      this.metrics.levelDistribution[level] = (this.metrics.levelDistribution[level] || 0) + 1;

      if (!lodInstance.isCulled) {
        this.metrics.activeMeshes++;
      }
    }

    // Send metrics to performance manager
    this.performanceManager.updateLODMetrics(this.metrics);
  }

  /**
   * Log LOD performance summary
   */
  private logLODSummary(): void {
    const totalMeshes = this.metrics.totalMeshes;
    const activeMeshes = this.metrics.activeMeshes;
    const culledMeshes = this.metrics.culledMeshes;
    const processingTime = this.metrics.processingTime;

    console.log(`[LOD] Performance Summary:
      Total Meshes: ${totalMeshes} | Active: ${activeMeshes} | Culled: ${culledMeshes}
      Level Distribution: ${JSON.stringify(this.metrics.levelDistribution)}
      Processing Time: ${processingTime.toFixed(2)}ms
      Memory: Geometry ${this.metrics.geometryMemory.toFixed(1)}MB, Texture ${this.metrics.textureMemory.toFixed(1)}MB`);
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    totalMeshes: number;
    activeMeshes: number;
    culledMeshes: number;
    levelDistribution: Record<number, number>;
    efficiency: number;
    memoryUsage: number;
  } {
    const efficiency =
      this.metrics.totalMeshes > 0
        ? (this.metrics.activeMeshes / this.metrics.totalMeshes) * 100
        : 100;

    return {
      totalMeshes: this.metrics.totalMeshes,
      activeMeshes: this.metrics.activeMeshes,
      culledMeshes: this.metrics.culledMeshes,
      levelDistribution: { ...this.metrics.levelDistribution },
      efficiency,
      memoryUsage: this.metrics.geometryMemory + this.metrics.textureMemory,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LODConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LOD] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): LODConfig {
    return { ...this.config };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): LODMetrics {
    return { ...this.metrics };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.lodInstances.clear();
    this.activeTransitions.clear();

    // Reset metrics
    this.metrics = {
      totalMeshes: 0,
      activeMeshes: 0,
      culledMeshes: 0,
      levelDistribution: {},
      geometryMemory: 0,
      textureMemory: 0,
      processingTime: 0,
      transitionCount: 0,
    };

    console.log('[LOD] LODManager disposed');
  }
}
