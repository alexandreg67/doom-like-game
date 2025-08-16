/**
 * ShadowPoolManager - Optimized shadow map pooling and management
 * Provides efficient shadow map pooling, reuse, and quality management for performance
 */

import {
  type AbstractMesh,
  type IShadowLight,
  type Scene,
  ShadowGenerator,
  Vector3,
} from '@babylonjs/core';
import type { PerformanceManager } from './performance-manager';

export interface ShadowPoolConfig {
  maxShadowMaps: number;
  shadowMapSize: number;
  enableSoftShadows: boolean;
  shadowDistance: number;
  qualityLevels: ShadowQualityLevel[];
  reuseThreshold: number; // Time in ms before shadow map can be reused
  updateFrequency: number; // Frames between shadow updates
}

export interface ShadowQualityLevel {
  name: string;
  distance: number;
  mapSize: number;
  pcfKernel: number;
  bias: number;
}

export interface ShadowMapInstance {
  id: string;
  generator: ShadowGenerator;
  light: IShadowLight;
  lastUsed: number;
  isActive: boolean;
  quality: ShadowQualityLevel;
  casters: Set<AbstractMesh>;
  lastUpdateFrame: number;
}

export interface ShadowMetrics {
  activeShadowMaps: number;
  pooledShadowMaps: number;
  shadowMapUpdates: number;
  shadowRenderTime: number;
  castersManaged: number;
  qualityAdjustments: number;
}

export class ShadowPoolManager {
  private performanceManager: PerformanceManager;
  private config: ShadowPoolConfig;

  // Shadow map pools
  private activeShadowMaps: Map<string, ShadowMapInstance> = new Map();
  private pooledShadowMaps: ShadowMapInstance[] = [];
  private lightToShadowMap: Map<string, string> = new Map(); // Light ID -> Shadow Map ID

  // Performance tracking
  private frameCounter = 0;
  private metrics: ShadowMetrics = {
    activeShadowMaps: 0,
    pooledShadowMaps: 0,
    shadowMapUpdates: 0,
    shadowRenderTime: 0,
    castersManaged: 0,
    qualityAdjustments: 0,
  };

  // Quality levels for different scenarios
  private readonly DEFAULT_QUALITY_LEVELS: ShadowQualityLevel[] = [
    {
      name: 'Ultra',
      distance: 25,
      mapSize: 2048,
      pcfKernel: 64,
      bias: 0.0001,
    },
    {
      name: 'High',
      distance: 50,
      mapSize: 1024,
      pcfKernel: 32,
      bias: 0.0005,
    },
    {
      name: 'Medium',
      distance: 100,
      mapSize: 512,
      pcfKernel: 16,
      bias: 0.001,
    },
    {
      name: 'Low',
      distance: 200,
      mapSize: 256,
      pcfKernel: 4,
      bias: 0.002,
    },
  ];

  constructor(
    _scene: Scene,
    performanceManager: PerformanceManager,
    config: Partial<ShadowPoolConfig> = {}
  ) {
    this.performanceManager = performanceManager;
    this.config = {
      maxShadowMaps: 4,
      shadowMapSize: 1024,
      enableSoftShadows: true,
      shadowDistance: 100,
      qualityLevels: this.DEFAULT_QUALITY_LEVELS,
      reuseThreshold: 1000, // 1 second
      updateFrequency: 2, // Update every 2 frames
      ...config,
    };

    console.log('[SHADOW-POOL] ShadowPoolManager initialized with config:', this.config);
  }

  /**
   * Get or create a shadow map for a light
   */
  public getShadowMapForLight(
    lightId: string,
    light: IShadowLight,
    cameraPosition: Vector3
  ): ShadowMapInstance | null {
    this.performanceManager.start('shadow_allocation');

    // Check if light already has a shadow map
    const shadowMapId = this.lightToShadowMap.get(lightId);
    let shadowMap = shadowMapId ? this.activeShadowMaps.get(shadowMapId) : null;

    if (shadowMap) {
      // Update existing shadow map
      this.updateShadowMapQuality(shadowMap, light, cameraPosition);
      this.performanceManager.end('shadow_allocation');
      return shadowMap;
    }

    // Check if we can create/reuse a shadow map
    if (this.activeShadowMaps.size >= this.config.maxShadowMaps) {
      // Try to reuse an old shadow map
      shadowMap = this.reuseOldestShadowMap(lightId, light, cameraPosition);
    } else {
      // Create new shadow map
      shadowMap = this.createShadowMap(lightId, light, cameraPosition);
    }

    this.performanceManager.end('shadow_allocation');
    return shadowMap;
  }

  /**
   * Create a new shadow map instance
   */
  private createShadowMap(
    lightId: string,
    light: IShadowLight,
    cameraPosition: Vector3
  ): ShadowMapInstance | null {
    const shadowMapId = `shadow_${lightId}_${Date.now()}`;

    // Determine quality level based on distance
    const quality = this.selectQualityLevel(light, cameraPosition);

    try {
      const generator = new ShadowGenerator(quality.mapSize, light);

      // Configure shadow generator
      this.configureShadowGenerator(generator, quality);

      const shadowMap: ShadowMapInstance = {
        id: shadowMapId,
        generator,
        light,
        lastUsed: performance.now(),
        isActive: true,
        quality,
        casters: new Set(),
        lastUpdateFrame: this.frameCounter,
      };

      this.activeShadowMaps.set(shadowMapId, shadowMap);
      this.lightToShadowMap.set(lightId, shadowMapId);

      console.log(
        `[SHADOW-POOL] Created shadow map '${shadowMapId}' for light '${lightId}' (${quality.name} quality)`
      );
      return shadowMap;
    } catch (error) {
      console.error(`[SHADOW-POOL] Failed to create shadow map for light '${lightId}':`, error);
      return null;
    }
  }

  /**
   * Reuse the oldest shadow map for a new light
   */
  private reuseOldestShadowMap(
    lightId: string,
    light: IShadowLight,
    cameraPosition: Vector3
  ): ShadowMapInstance | null {
    // Find the oldest shadow map that can be reused
    let oldestShadowMap: ShadowMapInstance | null = null;
    let oldestTime = performance.now();

    for (const shadowMap of this.activeShadowMaps.values()) {
      const timeSinceUsed = performance.now() - shadowMap.lastUsed;
      if (timeSinceUsed > this.config.reuseThreshold && shadowMap.lastUsed < oldestTime) {
        oldestTime = shadowMap.lastUsed;
        oldestShadowMap = shadowMap;
      }
    }

    if (!oldestShadowMap) {
      console.warn('[SHADOW-POOL] No shadow map available for reuse');
      return null;
    }

    // Remove old light mapping
    for (const [oldLightId, shadowMapId] of this.lightToShadowMap) {
      if (shadowMapId === oldestShadowMap.id) {
        this.lightToShadowMap.delete(oldLightId);
        break;
      }
    }

    // Reconfigure for new light
    oldestShadowMap.light = light;
    oldestShadowMap.lastUsed = performance.now();
    oldestShadowMap.casters.clear();
    oldestShadowMap.lastUpdateFrame = this.frameCounter;

    // Update quality for new light position
    const newQuality = this.selectQualityLevel(light, cameraPosition);
    if (newQuality.name !== oldestShadowMap.quality.name) {
      this.updateShadowMapQuality(oldestShadowMap, light, cameraPosition);
      this.metrics.qualityAdjustments++;
    }

    // Map new light to this shadow map
    this.lightToShadowMap.set(lightId, oldestShadowMap.id);

    console.log(`[SHADOW-POOL] Reused shadow map '${oldestShadowMap.id}' for light '${lightId}'`);
    return oldestShadowMap;
  }

  /**
   * Configure shadow generator with quality settings
   */
  private configureShadowGenerator(generator: ShadowGenerator, quality: ShadowQualityLevel): void {
    // Enable soft shadows if configured
    if (this.config.enableSoftShadows) {
      generator.usePercentageCloserFiltering = true;
      generator.filteringQuality = ShadowGenerator.QUALITY_HIGH;
      // Note: pcfKernel might not be available in all Babylon.js versions
      (generator as any).pcfKernel = quality.pcfKernel;
    }

    // Set bias to reduce shadow acne
    generator.bias = quality.bias;

    // Optimize for performance
    generator.useContactHardeningShadow = false; // Expensive feature
    generator.contactHardeningLightSizeUVRatio = 0.1;

    // Enable variance shadow maps for better quality if available
    if ('useVarianceShadowMap' in generator) {
      (generator as any).useVarianceShadowMap = true;
      (generator as any).varianceBias = 0.00003;
      (generator as any).varianceBlurRatio = 4;
    }
  }

  /**
   * Select appropriate quality level based on light distance
   */
  private selectQualityLevel(light: IShadowLight, cameraPosition: Vector3): ShadowQualityLevel {
    const lightPosition = light.position || Vector3.Zero();
    const distance = Vector3.Distance(cameraPosition, lightPosition);

    // Find the appropriate quality level
    for (const quality of this.config.qualityLevels) {
      if (distance <= quality.distance) {
        return quality;
      }
    }

    // Return lowest quality if beyond all thresholds
    const lastLevel = this.config.qualityLevels[this.config.qualityLevels.length - 1];
    if (!lastLevel) {
      throw new Error('No quality levels configured');
    }
    return lastLevel;
  }

  /**
   * Update shadow map quality based on current conditions
   */
  private updateShadowMapQuality(
    shadowMap: ShadowMapInstance,
    light: IShadowLight,
    cameraPosition: Vector3
  ): void {
    const newQuality = this.selectQualityLevel(light, cameraPosition);

    // Check if quality needs to be adjusted
    if (newQuality.name === shadowMap.quality.name) return;

    // Update quality settings
    shadowMap.quality = newQuality;

    // Reconfigure generator if needed
    if (newQuality.mapSize !== shadowMap.generator.mapSize) {
      // Shadow map size change requires recreation - expensive operation
      // For now, just update other settings
      console.log(
        `[SHADOW-POOL] Quality changed for shadow map '${shadowMap.id}': ${shadowMap.quality.name} -> ${newQuality.name}`
      );
    }

    // Update generator settings
    (shadowMap.generator as any).pcfKernel = newQuality.pcfKernel;
    shadowMap.generator.bias = newQuality.bias;

    this.metrics.qualityAdjustments++;
  }

  /**
   * Add a shadow caster to a shadow map
   */
  public addShadowCaster(lightId: string, mesh: AbstractMesh): boolean {
    const shadowMapId = this.lightToShadowMap.get(lightId);
    const shadowMap = shadowMapId ? this.activeShadowMaps.get(shadowMapId) : null;

    if (!shadowMap) {
      return false;
    }

    shadowMap.generator.addShadowCaster(mesh);
    shadowMap.casters.add(mesh);
    shadowMap.lastUsed = performance.now();

    return true;
  }

  /**
   * Remove a shadow caster from a shadow map
   */
  public removeShadowCaster(lightId: string, mesh: AbstractMesh): boolean {
    const shadowMapId = this.lightToShadowMap.get(lightId);
    const shadowMap = shadowMapId ? this.activeShadowMaps.get(shadowMapId) : null;

    if (!shadowMap) {
      return false;
    }

    shadowMap.generator.removeShadowCaster(mesh);
    shadowMap.casters.delete(mesh);

    return true;
  }

  /**
   * Update shadow maps (call once per frame)
   */
  public updateShadowMaps(cameraPosition: Vector3): void {
    this.performanceManager.start('shadow_update');

    this.frameCounter++;
    let updateCount = 0;

    for (const shadowMap of this.activeShadowMaps.values()) {
      // Skip update if not time yet
      if (this.frameCounter - shadowMap.lastUpdateFrame < this.config.updateFrequency) {
        continue;
      }

      // Check if shadow map should still be active
      const timeSinceUsed = performance.now() - shadowMap.lastUsed;
      if (timeSinceUsed > this.config.reuseThreshold * 2) {
        // Mark for potential cleanup
        shadowMap.isActive = false;
        continue;
      }

      // Update shadow map quality based on current camera position
      this.updateShadowMapQuality(shadowMap, shadowMap.light, cameraPosition);
      shadowMap.lastUpdateFrame = this.frameCounter;
      updateCount++;
    }

    // Cleanup inactive shadow maps periodically
    if (this.frameCounter % 60 === 0) {
      // Every 60 frames (~1 second at 60fps)
      this.cleanupInactiveShadowMaps();
    }

    this.metrics.shadowMapUpdates = updateCount;
    this.updateMetrics();

    const updateTime = this.performanceManager.end('shadow_update');
    this.metrics.shadowRenderTime = updateTime;
  }

  /**
   * Cleanup inactive shadow maps
   */
  private cleanupInactiveShadowMaps(): void {
    const toRemove: string[] = [];

    for (const [shadowMapId, shadowMap] of this.activeShadowMaps) {
      if (!shadowMap.isActive) {
        toRemove.push(shadowMapId);
      }
    }

    for (const shadowMapId of toRemove) {
      const shadowMap = this.activeShadowMaps.get(shadowMapId);
      if (shadowMap) {
        shadowMap.generator.dispose();
        this.activeShadowMaps.delete(shadowMapId);

        // Remove light mapping
        for (const [lightId, mapId] of this.lightToShadowMap) {
          if (mapId === shadowMapId) {
            this.lightToShadowMap.delete(lightId);
            break;
          }
        }

        console.log(`[SHADOW-POOL] Cleaned up inactive shadow map '${shadowMapId}'`);
      }
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.metrics.activeShadowMaps = this.activeShadowMaps.size;
    this.metrics.pooledShadowMaps = this.pooledShadowMaps.length;
    this.metrics.castersManaged = Array.from(this.activeShadowMaps.values()).reduce(
      (total, shadowMap) => total + shadowMap.casters.size,
      0
    );
  }

  /**
   * Get performance statistics
   */
  public getStats(): {
    active: number;
    pooled: number;
    totalCasters: number;
    qualityDistribution: Record<string, number>;
    memoryUsage: number; // Estimated MB
  } {
    const qualityDistribution: Record<string, number> = {};
    let memoryUsage = 0;

    for (const shadowMap of this.activeShadowMaps.values()) {
      qualityDistribution[shadowMap.quality.name] =
        (qualityDistribution[shadowMap.quality.name] || 0) + 1;

      // Estimate memory usage (shadow map size squared * 4 bytes per pixel)
      const mapSize = shadowMap.quality.mapSize;
      memoryUsage += (mapSize * mapSize * 4) / (1024 * 1024); // MB
    }

    return {
      active: this.activeShadowMaps.size,
      pooled: this.pooledShadowMaps.length,
      totalCasters: this.metrics.castersManaged,
      qualityDistribution,
      memoryUsage,
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ShadowPoolConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[SHADOW-POOL] Configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): ShadowPoolConfig {
    return { ...this.config };
  }

  /**
   * Get current metrics
   */
  public getMetrics(): ShadowMetrics {
    return { ...this.metrics };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    // Dispose all active shadow maps
    for (const shadowMap of this.activeShadowMaps.values()) {
      shadowMap.generator.dispose();
    }

    this.activeShadowMaps.clear();
    this.pooledShadowMaps = [];
    this.lightToShadowMap.clear();

    console.log('[SHADOW-POOL] ShadowPoolManager disposed');
  }
}
