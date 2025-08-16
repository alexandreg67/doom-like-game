/**
 * LightPoolManager - Advanced light management with pooling and culling optimization
 * Provides high-performance light culling, pooling, and LOD for DOOM-like game engine
 */

import { type Scene, Vector3 } from '@babylonjs/core';
import type { LightConfig, LightInstance } from '../lighting/types';
import type { PerformanceManager } from './performance-manager';
import type { LightingMetrics } from './types';

export interface LightPoolConfig {
  maxActiveLights: number;
  poolSize: number;
  cullingDistance: number;
  shadowMapPoolSize: number;
  enableLOD: boolean;
  priorityThreshold: number;
  updateFrequency: number; // frames between updates
}

export interface LightPriority {
  lightId: string;
  distance: number;
  importance: number;
  lastVisible: number;
  isStatic: boolean;
  intensity: number;
}

export interface CulledLightInfo {
  lightId: string;
  reason: 'distance' | 'priority' | 'performance' | 'shadow-limit';
  distance: number;
  originalIntensity: number;
}

export class LightPoolManager {
  private performanceManager: PerformanceManager;
  private config: LightPoolConfig;

  // Light pools and management
  private activeLights: Map<string, LightInstance> = new Map();
  private inactiveLights: Map<string, LightInstance> = new Map();
  private lightPriorities: Map<string, LightPriority> = new Map();
  private culledLights: Map<string, CulledLightInfo> = new Map();

  // Performance tracking
  private frameCounter = 0;
  private lastUpdateFrame = 0;
  private metrics: LightingMetrics = {
    activeLights: 0,
    shadowCasters: 0,
    lightCulled: 0,
    lightingPassTime: 0,
    shadowMapUpdates: 0,
  };

  // Distance-based LOD levels
  private readonly LOD_DISTANCES = [25, 50, 100, 200];
  private readonly LOD_INTENSITY_MULTIPLIERS = [1.0, 0.8, 0.6, 0.3];

  constructor(
    _scene: Scene,
    performanceManager: PerformanceManager,
    config: Partial<LightPoolConfig> = {}
  ) {
    this.performanceManager = performanceManager;
    this.config = {
      maxActiveLights: 8,
      poolSize: 16,
      cullingDistance: 100,
      shadowMapPoolSize: 4,
      enableLOD: true,
      priorityThreshold: 0.1,
      updateFrequency: 3, // Update every 3 frames
      ...config,
    };

    console.log('[LIGHT-POOL] LightPoolManager initialized with config:', this.config);
  }

  /**
   * Add a light to the pool system
   */
  public addLight(lightInstance: LightInstance, isStatic = false): void {
    const lightId = lightInstance.config.id;

    // Initialize priority tracking
    this.lightPriorities.set(lightId, {
      lightId,
      distance: 0,
      importance: this.calculateImportance(lightInstance.config),
      lastVisible: performance.now(),
      isStatic,
      intensity: lightInstance.config.intensity || 1,
    });

    // Add to inactive pool initially
    this.inactiveLights.set(lightId, lightInstance);

    console.log(`[LIGHT-POOL] Added light '${lightId}' to pool (static: ${isStatic})`);
  }

  /**
   * Remove a light from the pool system
   */
  public removeLight(lightId: string): void {
    this.activeLights.delete(lightId);
    this.inactiveLights.delete(lightId);
    this.lightPriorities.delete(lightId);
    this.culledLights.delete(lightId);

    console.log(`[LIGHT-POOL] Removed light '${lightId}' from pool`);
  }

  /**
   * Update light culling and LOD based on camera position
   */
  public updateLightCulling(cameraPosition: Vector3): void {
    this.performanceManager.start('light_culling');

    this.frameCounter++;

    // Only update every N frames for performance
    if (this.frameCounter - this.lastUpdateFrame < this.config.updateFrequency) {
      this.performanceManager.end('light_culling');
      return;
    }

    this.lastUpdateFrame = this.frameCounter;

    // Update distances and priorities
    this.updateLightPriorities(cameraPosition);

    // Perform culling based on distance and performance
    this.performDistanceCulling();
    this.performPriorityCulling();
    this.performPerformanceCulling();

    // Apply LOD if enabled
    if (this.config.enableLOD) {
      this.applyLOD(cameraPosition);
    }

    // Update metrics
    this.updateMetrics();

    const cullingTime = this.performanceManager.end('light_culling');
    this.metrics.lightingPassTime = cullingTime;

    console.log(
      `[LIGHT-POOL] Culling update: ${this.activeLights.size}/${this.getTotalLights()} active, ${this.culledLights.size} culled`
    );
  }

  /**
   * Update light priorities based on camera position
   */
  private updateLightPriorities(cameraPosition: Vector3): void {
    for (const [lightId, priority] of this.lightPriorities) {
      const lightInstance = this.activeLights.get(lightId) || this.inactiveLights.get(lightId);
      if (!lightInstance) continue;

      // Calculate distance
      const lightPosition = this.getLightPosition(lightInstance);
      const distance = Vector3.Distance(cameraPosition, lightPosition);

      // Update priority data
      priority.distance = distance;

      // Static lights have higher importance when close
      if (priority.isStatic && distance < this.config.cullingDistance * 0.5) {
        priority.importance *= 1.2;
      }

      // Recently visible lights have bonus importance
      const timeSinceVisible = performance.now() - priority.lastVisible;
      if (timeSinceVisible < 5000) {
        // 5 seconds
        priority.importance *= 1.1;
      }
    }
  }

  /**
   * Perform distance-based culling
   */
  private performDistanceCulling(): void {
    for (const [lightId, priority] of this.lightPriorities) {
      const isActive = this.activeLights.has(lightId);
      const isTooFar = priority.distance > this.config.cullingDistance;

      if (isActive && isTooFar) {
        // Move to inactive pool
        const light = this.activeLights.get(lightId)!;
        this.activeLights.delete(lightId);
        this.inactiveLights.set(lightId, light);
        light.babylonLight.setEnabled(false);

        this.culledLights.set(lightId, {
          lightId,
          reason: 'distance',
          distance: priority.distance,
          originalIntensity: priority.intensity,
        });

        this.metrics.lightCulled++;
      } else if (!isActive && !isTooFar && !this.culledLights.has(lightId)) {
        // Consider for activation
        this.considerLightActivation(lightId);
      }
    }
  }

  /**
   * Perform priority-based culling when at light limit
   */
  private performPriorityCulling(): void {
    if (this.activeLights.size <= this.config.maxActiveLights) return;

    // Get all active lights sorted by priority (distance + importance)
    const activePriorities = Array.from(this.lightPriorities.entries())
      .filter(([lightId]) => this.activeLights.has(lightId))
      .map(([lightId, priority]) => ({
        lightId,
        score: this.calculatePriorityScore(priority),
        distance: priority.distance,
      }))
      .sort((a, b) => b.score - a.score); // Higher score = higher priority

    // Cull lowest priority lights
    const excessCount = this.activeLights.size - this.config.maxActiveLights;
    const lightsToCull = activePriorities.slice(-excessCount);

    for (const { lightId, distance } of lightsToCull) {
      const light = this.activeLights.get(lightId)!;
      this.activeLights.delete(lightId);
      this.inactiveLights.set(lightId, light);
      light.babylonLight.setEnabled(false);

      this.culledLights.set(lightId, {
        lightId,
        reason: 'priority',
        distance,
        originalIntensity: this.lightPriorities.get(lightId)?.intensity || 1,
      });

      this.metrics.lightCulled++;
    }
  }

  /**
   * Perform performance-based culling when FPS is low
   */
  private performPerformanceCulling(): void {
    const currentFPS = this.performanceManager.getMetrics().fps;
    const targetFPS = 55; // Below this, start aggressive culling

    if (currentFPS > targetFPS) return;

    // Calculate how many lights to cull based on performance
    const performanceRatio = Math.max(0, (targetFPS - currentFPS) / targetFPS);
    const cullCount = Math.ceil(this.activeLights.size * performanceRatio * 0.3); // Cull up to 30%

    if (cullCount === 0) return;

    // Cull lowest importance lights first
    const lightsByImportance = Array.from(this.lightPriorities.entries())
      .filter(([lightId]) => this.activeLights.has(lightId))
      .sort((a, b) => a[1].importance - b[1].importance)
      .slice(0, cullCount);

    for (const [lightId, priority] of lightsByImportance) {
      const light = this.activeLights.get(lightId)!;
      this.activeLights.delete(lightId);
      this.inactiveLights.set(lightId, light);
      light.babylonLight.setEnabled(false);

      this.culledLights.set(lightId, {
        lightId,
        reason: 'performance',
        distance: priority.distance,
        originalIntensity: priority.intensity,
      });

      this.metrics.lightCulled++;
    }

    console.log(
      `[LIGHT-POOL] Performance culling: removed ${cullCount} lights (FPS: ${currentFPS.toFixed(1)})`
    );
  }

  /**
   * Apply LOD based on distance
   */
  private applyLOD(_cameraPosition: Vector3): void {
    for (const [lightId, light] of this.activeLights) {
      const priority = this.lightPriorities.get(lightId);
      if (!priority) continue;

      const lodLevel = this.calculateLODLevel(priority.distance);
      const intensityMultiplier = this.LOD_INTENSITY_MULTIPLIERS[lodLevel];
      if (intensityMultiplier === undefined) continue;

      const newIntensity = priority.intensity * intensityMultiplier;

      // Update light intensity based on LOD
      if (Math.abs(light.babylonLight.intensity - newIntensity) > 0.01) {
        light.babylonLight.intensity = newIntensity;
      }
    }
  }

  /**
   * Consider activating an inactive light
   */
  private considerLightActivation(lightId: string): void {
    if (this.activeLights.size >= this.config.maxActiveLights) return;

    const light = this.inactiveLights.get(lightId);
    const priority = this.lightPriorities.get(lightId);
    if (!light || !priority) return;

    // Check if this light should be activated based on priority
    const priorityScore = this.calculatePriorityScore(priority);
    if (priorityScore > this.config.priorityThreshold) {
      this.activateLight(lightId, light);
    }
  }

  /**
   * Activate a light from the inactive pool
   */
  private activateLight(lightId: string, light: LightInstance): void {
    this.inactiveLights.delete(lightId);
    this.activeLights.set(lightId, light);
    light.babylonLight.setEnabled(true);
    this.culledLights.delete(lightId);

    // Update last visible time
    const priority = this.lightPriorities.get(lightId);
    if (priority) {
      priority.lastVisible = performance.now();
    }

    console.log(`[LIGHT-POOL] Activated light '${lightId}'`);
  }

  /**
   * Calculate priority score for a light
   */
  private calculatePriorityScore(priority: LightPriority): number {
    const distanceScore = 1 / (1 + priority.distance / this.config.cullingDistance);
    const importanceScore = priority.importance;
    const intensityScore = priority.intensity;

    return distanceScore * importanceScore * intensityScore;
  }

  /**
   * Calculate importance based on light configuration
   */
  private calculateImportance(config: LightConfig): number {
    let importance = 1.0;

    // Directional lights are usually more important (sun, main lighting)
    if (config.type === 'directional') importance *= 2.0;

    // Higher intensity = more important
    importance *= (config.intensity || 1) * 0.5;

    // Shadow casting lights are more important
    // Note: Using 'shadows' property instead of 'shadow' for compatibility
    if ((config as any).shadows?.enabled) importance *= 1.5;

    return importance;
  }

  /**
   * Calculate LOD level based on distance
   */
  private calculateLODLevel(distance: number): number {
    for (let i = 0; i < this.LOD_DISTANCES.length; i++) {
      const threshold = this.LOD_DISTANCES[i];
      if (threshold !== undefined && distance <= threshold) {
        return i;
      }
    }
    return this.LOD_DISTANCES.length - 1;
  }

  /**
   * Get light position from light instance
   */
  private getLightPosition(light: LightInstance): Vector3 {
    // Handle different light types that may or may not have position
    if ('position' in light.babylonLight && light.babylonLight.position) {
      return light.babylonLight.position as Vector3;
    }
    return Vector3.Zero();
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.activeLights = this.activeLights.size;
    this.metrics.shadowCasters = Array.from(this.activeLights.values()).filter(
      (light) => light.shadowGenerator
    ).length;

    // Send metrics to performance manager
    this.performanceManager.updateLightingMetrics(this.metrics);

    // Reset culled count for next frame
    this.metrics.lightCulled = 0;
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    active: number;
    inactive: number;
    culled: number;
    total: number;
    cullingReasons: Record<string, number>;
  } {
    const cullingReasons: Record<string, number> = {};
    for (const culled of this.culledLights.values()) {
      cullingReasons[culled.reason] = (cullingReasons[culled.reason] || 0) + 1;
    }

    return {
      active: this.activeLights.size,
      inactive: this.inactiveLights.size,
      culled: this.culledLights.size,
      total: this.getTotalLights(),
      cullingReasons,
    };
  }

  /**
   * Get total number of lights in the system
   */
  private getTotalLights(): number {
    return this.activeLights.size + this.inactiveLights.size;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<LightPoolConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[LIGHT-POOL] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): LightPoolConfig {
    return { ...this.config };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): LightingMetrics {
    return { ...this.metrics };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.activeLights.clear();
    this.inactiveLights.clear();
    this.lightPriorities.clear();
    this.culledLights.clear();

    console.log('[LIGHT-POOL] LightPoolManager disposed');
  }
}
