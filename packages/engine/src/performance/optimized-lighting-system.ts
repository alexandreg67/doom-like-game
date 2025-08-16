/**
 * OptimizedLightingSystem - Integrated high-performance lighting system
 * Combines light pooling, shadow optimization, and performance monitoring
 */

import { type Scene, Vector3 } from '@babylonjs/core';
import type { LightManager } from '../lighting/light-manager';
import type { LightConfig, LightInstance } from '../lighting/types';
import { type LightPoolConfig, LightPoolManager } from './light-pool-manager';
import type { PerformanceManager } from './performance-manager';
import { type ShadowPoolConfig, ShadowPoolManager } from './shadow-pool-manager';

export interface OptimizedLightingConfig {
  lightPool: Partial<LightPoolConfig>;
  shadowPool: Partial<ShadowPoolConfig>;
  globalSettings: {
    enableDynamicQuality: boolean;
    performanceTarget: number; // Target FPS
    aggressiveCulling: boolean;
    adaptiveLOD: boolean;
  };
}

export interface LightingPerformanceStats {
  lightPool: ReturnType<LightPoolManager['getStats']>;
  shadowPool: ReturnType<ShadowPoolManager['getStats']>;
  frameMetrics: {
    lightingTime: number;
    shadowTime: number;
    totalTime: number;
    efficiency: number;
  };
  qualityMetrics: {
    averageQuality: string;
    qualityChanges: number;
    memoryUsage: number;
  };
}

export class OptimizedLightingSystem {
  private lightManager: LightManager;
  private performanceManager: PerformanceManager;
  private lightPool: LightPoolManager;
  private shadowPool: ShadowPoolManager;
  private config: OptimizedLightingConfig;

  // Performance tracking
  private frameCounter = 0;
  private lastQualityAdjustment = 0;
  private performanceHistory: number[] = [];
  private maxHistorySize = 60; // Track 1 second of performance at 60fps

  // Quality adaptation
  private currentQualityLevel = 2; // 0=Ultra, 1=High, 2=Medium, 3=Low
  private readonly QUALITY_LEVELS = ['Ultra', 'High', 'Medium', 'Low'];

  constructor(
    scene: Scene,
    lightManager: LightManager,
    performanceManager: PerformanceManager,
    config: Partial<OptimizedLightingConfig> = {}
  ) {
    this.lightManager = lightManager;
    this.performanceManager = performanceManager;

    this.config = {
      lightPool: {
        maxActiveLights: 8,
        poolSize: 16,
        cullingDistance: 100,
        enableLOD: true,
        updateFrequency: 3,
        ...config.lightPool,
      },
      shadowPool: {
        maxShadowMaps: 4,
        shadowMapSize: 1024,
        enableSoftShadows: true,
        shadowDistance: 100,
        updateFrequency: 2,
        ...config.shadowPool,
      },
      globalSettings: {
        enableDynamicQuality: true,
        performanceTarget: 55, // Target 55+ FPS
        aggressiveCulling: false,
        adaptiveLOD: true,
        ...config.globalSettings,
      },
    };

    // Initialize subsystems
    this.lightPool = new LightPoolManager(scene, performanceManager, this.config.lightPool);
    this.shadowPool = new ShadowPoolManager(scene, performanceManager, this.config.shadowPool);

    console.log('[OPTIMIZED-LIGHTING] OptimizedLightingSystem initialized');
  }

  /**
   * Add a light to the optimized system
   */
  public addLight(config: LightConfig, isStatic = false): void {
    // Add to light manager first
    this.lightManager.addLight(config);

    // Get the light instance
    const lightInstance = this.lightManager.getLight(config.id);
    if (!lightInstance) {
      console.error(`[OPTIMIZED-LIGHTING] Failed to add light '${config.id}' to light manager`);
      return;
    }

    // Add to light pool
    this.lightPool.addLight(lightInstance, isStatic);

    // Set up shadow mapping if needed
    if ((config as any).shadow?.enabled && this.supportsShadows(lightInstance)) {
      this.setupShadowMapping(config.id, lightInstance);
    }

    console.log(`[OPTIMIZED-LIGHTING] Added light '${config.id}' to optimized system`);
  }

  /**
   * Remove a light from the optimized system
   */
  public removeLight(lightId: string): void {
    this.lightPool.removeLight(lightId);
    this.lightManager.removeLight(lightId);

    console.log(`[OPTIMIZED-LIGHTING] Removed light '${lightId}' from optimized system`);
  }

  /**
   * Update the lighting system (call once per frame)
   */
  public update(cameraPosition: Vector3): void {
    this.performanceManager.start('optimized_lighting');

    this.frameCounter++;

    // Update light pooling and culling
    this.lightPool.updateLightCulling(cameraPosition);

    // Update shadow maps
    this.shadowPool.updateShadowMaps(cameraPosition);

    // Perform quality adaptation if enabled
    if (this.config.globalSettings.enableDynamicQuality) {
      this.adaptQualityToPerformance();
    }

    // Collect performance metrics
    this.collectPerformanceMetrics();

    const totalTime = this.performanceManager.end('optimized_lighting');

    // Log performance summary periodically
    if (this.frameCounter % 120 === 0) {
      // Every 2 seconds
      this.logPerformanceSummary(totalTime);
    }
  }

  /**
   * Setup shadow mapping for a light
   */
  private setupShadowMapping(lightId: string, lightInstance: LightInstance): void {
    // Ensure the light supports shadows
    if (!this.supportsShadows(lightInstance)) {
      console.warn(`[OPTIMIZED-LIGHTING] Light '${lightId}' does not support shadows`);
      return;
    }

    // Get shadow map from pool
    const shadowMap = this.shadowPool.getShadowMapForLight(
      lightId,
      lightInstance.babylonLight as any,
      Vector3.Zero() // Will be updated in next frame
    );

    if (shadowMap) {
      lightInstance.shadowGenerator = shadowMap.generator;
      console.log(`[OPTIMIZED-LIGHTING] Setup shadow mapping for light '${lightId}'`);
    }
  }

  /**
   * Check if a light supports shadows
   */
  private supportsShadows(lightInstance: LightInstance): boolean {
    const lightType = lightInstance.config.type;
    return lightType === 'directional' || lightType === 'spot' || lightType === 'point';
  }

  /**
   * Adapt rendering quality based on performance
   */
  private adaptQualityToPerformance(): void {
    const currentFPS = this.performanceManager.getMetrics().fps;
    const targetFPS = this.config.globalSettings.performanceTarget;

    // Update performance history
    this.performanceHistory.push(currentFPS);
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }

    // Only adjust quality if we have enough data and it's been a while since last adjustment
    if (
      this.performanceHistory.length < 30 ||
      this.frameCounter - this.lastQualityAdjustment < 60
    ) {
      return;
    }

    // Calculate average FPS over recent history
    const avgFPS =
      this.performanceHistory.reduce((sum, fps) => sum + fps, 0) / this.performanceHistory.length;
    const performanceRatio = avgFPS / targetFPS;

    let newQualityLevel = this.currentQualityLevel;

    if (performanceRatio < 0.9) {
      // Performance is poor
      // Decrease quality (increase quality level number)
      newQualityLevel = Math.min(this.QUALITY_LEVELS.length - 1, this.currentQualityLevel + 1);
    } else if (performanceRatio > 1.1) {
      // Performance is good
      // Increase quality (decrease quality level number)
      newQualityLevel = Math.max(0, this.currentQualityLevel - 1);
    }

    if (newQualityLevel !== this.currentQualityLevel) {
      this.applyQualityLevel(newQualityLevel);
      this.currentQualityLevel = newQualityLevel;
      this.lastQualityAdjustment = this.frameCounter;

      console.log(
        `[OPTIMIZED-LIGHTING] Quality adapted: ${this.QUALITY_LEVELS[newQualityLevel]} (FPS: ${avgFPS.toFixed(1)})`
      );
    }
  }

  /**
   * Apply a specific quality level
   */
  private applyQualityLevel(qualityLevel: number): void {
    // Adjust light pool settings
    const lightConfig = { ...this.lightPool.getConfig() };
    switch (qualityLevel) {
      case 0: // Ultra
        lightConfig.maxActiveLights = 12;
        lightConfig.cullingDistance = 150;
        lightConfig.updateFrequency = 1;
        break;
      case 1: // High
        lightConfig.maxActiveLights = 8;
        lightConfig.cullingDistance = 100;
        lightConfig.updateFrequency = 2;
        break;
      case 2: // Medium
        lightConfig.maxActiveLights = 6;
        lightConfig.cullingDistance = 75;
        lightConfig.updateFrequency = 3;
        break;
      case 3: // Low
        lightConfig.maxActiveLights = 4;
        lightConfig.cullingDistance = 50;
        lightConfig.updateFrequency = 4;
        break;
    }

    // Adjust shadow pool settings
    const shadowConfig = { ...this.shadowPool.getConfig() };
    switch (qualityLevel) {
      case 0: // Ultra
        shadowConfig.maxShadowMaps = 6;
        shadowConfig.shadowMapSize = 2048;
        shadowConfig.enableSoftShadows = true;
        break;
      case 1: // High
        shadowConfig.maxShadowMaps = 4;
        shadowConfig.shadowMapSize = 1024;
        shadowConfig.enableSoftShadows = true;
        break;
      case 2: // Medium
        shadowConfig.maxShadowMaps = 3;
        shadowConfig.shadowMapSize = 512;
        shadowConfig.enableSoftShadows = true;
        break;
      case 3: // Low
        shadowConfig.maxShadowMaps = 2;
        shadowConfig.shadowMapSize = 256;
        shadowConfig.enableSoftShadows = false;
        break;
    }

    // Apply configurations
    this.lightPool.updateConfig(lightConfig);
    this.shadowPool.updateConfig(shadowConfig);
  }

  /**
   * Add shadow caster to a light
   */
  public addShadowCaster(lightId: string, mesh: any): void {
    const success = this.shadowPool.addShadowCaster(lightId, mesh);
    if (!success) {
      // Fallback to light manager
      this.lightManager.addShadowCaster(lightId, mesh);
    }
  }

  /**
   * Add shadow receiver to a light
   */
  public addShadowReceiver(_lightId: string, mesh: any): void {
    mesh.receiveShadows = true;
  }

  /**
   * Collect performance metrics
   */
  private collectPerformanceMetrics(): void {
    const lightMetrics = this.lightPool.getMetrics();

    // Update performance manager with lighting metrics
    this.performanceManager.updateLightingMetrics(lightMetrics);
  }

  /**
   * Log performance summary
   */
  private logPerformanceSummary(frameTime: number): void {
    const lightStats = this.lightPool.getStats();
    const shadowStats = this.shadowPool.getStats();
    const currentFPS = this.performanceManager.getMetrics().fps;

    console.log(`[OPTIMIZED-LIGHTING] Performance Summary:
      FPS: ${currentFPS.toFixed(1)} | Quality: ${this.QUALITY_LEVELS[this.currentQualityLevel]}
      Lights: ${lightStats.active}/${lightStats.total} active | Culled: ${lightStats.culled}
      Shadows: ${shadowStats.active} maps | Memory: ${shadowStats.memoryUsage.toFixed(1)}MB
      Frame Time: ${frameTime.toFixed(2)}ms`);
  }

  /**
   * Get comprehensive performance statistics
   */
  public getPerformanceStats(): LightingPerformanceStats {
    const lightStats = this.lightPool.getStats();
    const shadowStats = this.shadowPool.getStats();
    const lightMetrics = this.lightPool.getMetrics();
    const shadowMetrics = this.shadowPool.getMetrics();

    return {
      lightPool: lightStats,
      shadowPool: shadowStats,
      frameMetrics: {
        lightingTime: lightMetrics.lightingPassTime,
        shadowTime: shadowMetrics.shadowRenderTime,
        totalTime: lightMetrics.lightingPassTime + shadowMetrics.shadowRenderTime,
        efficiency: lightStats.total > 0 ? (lightStats.active / lightStats.total) * 100 : 100,
      },
      qualityMetrics: {
        averageQuality: this.QUALITY_LEVELS[this.currentQualityLevel] || 'Unknown',
        qualityChanges: shadowMetrics.qualityAdjustments,
        memoryUsage: shadowStats.memoryUsage,
      },
    };
  }

  /**
   * Force a specific quality level
   */
  public setQualityLevel(level: number): void {
    if (level >= 0 && level < this.QUALITY_LEVELS.length) {
      this.applyQualityLevel(level);
      this.currentQualityLevel = level;
      console.log(
        `[OPTIMIZED-LIGHTING] Quality manually set to: ${this.QUALITY_LEVELS[level] || 'Unknown'}`
      );
    }
  }

  /**
   * Get current quality level
   */
  public getQualityLevel(): { level: number; name: string } {
    return {
      level: this.currentQualityLevel,
      name: this.QUALITY_LEVELS[this.currentQualityLevel] || 'Unknown',
    };
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<OptimizedLightingConfig>): void {
    this.config = {
      lightPool: { ...this.config.lightPool, ...config.lightPool },
      shadowPool: { ...this.config.shadowPool, ...config.shadowPool },
      globalSettings: { ...this.config.globalSettings, ...config.globalSettings },
    };

    // Apply to subsystems
    if (config.lightPool) {
      this.lightPool.updateConfig(config.lightPool);
    }
    if (config.shadowPool) {
      this.shadowPool.updateConfig(config.shadowPool);
    }

    console.log('[OPTIMIZED-LIGHTING] Configuration updated');
  }

  /**
   * Get current configuration
   */
  public getConfig(): OptimizedLightingConfig {
    return {
      lightPool: this.lightPool.getConfig(),
      shadowPool: this.shadowPool.getConfig(),
      globalSettings: { ...this.config.globalSettings },
    };
  }

  /**
   * Dispose and cleanup
   */
  public dispose(): void {
    this.lightPool.dispose();
    this.shadowPool.dispose();
    this.performanceHistory = [];

    console.log('[OPTIMIZED-LIGHTING] OptimizedLightingSystem disposed');
  }
}
