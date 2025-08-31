/**
 * Impact Manager - Main controller for weapon impact effects
 */

import type { Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import { ImpactAudioManager } from '../audio/impact-audio';
import { ImpactParticleSystem } from '../particle/particle-system';
import { ImpactRenderer } from './impact-renderer';
import type {
  ImpactConfig,
  ImpactData,
  ImpactPerformanceConfig,
  ImpactResult,
  ImpactSystemStats,
  MaterialDatabase,
  MaterialType,
} from './impact-types';

export class ImpactManager {
  private scene: Scene;
  private materialDatabase: MaterialDatabase;
  private performanceConfig: ImpactPerformanceConfig;
  private stats: ImpactSystemStats;
  private activeImpacts: Map<string, number> = new Map();
  private lastCleanup = 0;

  // Subsystems
  private particleSystem: ImpactParticleSystem;
  private audioManager: ImpactAudioManager;
  private renderer: ImpactRenderer;

  constructor(scene: Scene) {
    console.log('🚀 [IMPACT_MANAGER] Initializing impact manager v2.0 - NEW VERSION');
    this.scene = scene;
    this.performanceConfig = this.getDefaultPerformanceConfig();
    this.stats = this.initializeStats();
    this.materialDatabase = this.initializeMaterialDatabase();

    // Initialize subsystems
    this.particleSystem = new ImpactParticleSystem(scene);
    this.audioManager = new ImpactAudioManager(scene);
    this.renderer = new ImpactRenderer(scene);

    console.log('[IMPACT_MANAGER] Impact manager initialized successfully');
  }

  /**
   * Process weapon impact and trigger appropriate effects
   */
  public processImpact(impactData: ImpactData): ImpactResult {
    console.log('[IMPACT_MANAGER] Processing impact:', {
      position: impactData.position,
      materialType: impactData.materialType,
      weaponType: impactData.weaponType,
    });

    const startTime = performance.now();

    try {
      // Validate impact data
      if (!this.validateImpactData(impactData)) {
        console.error('[IMPACT_MANAGER] Invalid impact data');
        return this.createErrorResult('Invalid impact data');
      }

      console.log('[IMPACT_MANAGER] Validation passed, processing effects...');

      // Get material configuration
      const materialConfig = this.getMaterialConfig(impactData.materialType);

      // Apply LOD based on distance to camera
      const cameraDistance = this.getCameraDistance(impactData.position);
      const lodLevel = this.calculateLODLevel(cameraDistance);

      console.log(
        `🎯 [IMPACT_MANAGER] Distance: ${cameraDistance.toFixed(1)} units, LOD level: ${lodLevel}`
      );

      // Process effects based on LOD
      const result = this.processImpactEffects(impactData, materialConfig, lodLevel);

      // Update statistics
      this.updateStats(impactData, result, performance.now() - startTime);

      // Schedule cleanup if needed
      this.scheduleCleanup();

      return result;
    } catch (error) {
      return this.createErrorResult(`Impact processing failed: ${error}`);
    }
  }

  /**
   * Detect material type from mesh/surface properties
   */
  public detectMaterialType(meshName?: string, materialName?: string): MaterialType {
    if (!meshName && !materialName) {
      return this.materialDatabase.defaultMaterial;
    }

    // Simple material detection based on naming conventions
    const identifier = (meshName || materialName || '').toLowerCase();

    if (
      identifier.includes('metal') ||
      identifier.includes('steel') ||
      identifier.includes('iron')
    ) {
      return 'metal';
    }
    if (identifier.includes('concrete') || identifier.includes('cement')) {
      return 'concrete';
    }
    if (
      identifier.includes('stone') ||
      identifier.includes('rock') ||
      identifier.includes('brick')
    ) {
      return 'stone';
    }
    if (
      identifier.includes('wood') ||
      identifier.includes('timber') ||
      identifier.includes('plank')
    ) {
      return 'wood';
    }
    if (identifier.includes('glass') || identifier.includes('window')) {
      return 'glass';
    }
    if (identifier.includes('water') || identifier.includes('liquid')) {
      return 'water';
    }
    if (
      identifier.includes('dirt') ||
      identifier.includes('soil') ||
      identifier.includes('ground')
    ) {
      return 'dirt';
    }
    if (
      identifier.includes('fabric') ||
      identifier.includes('cloth') ||
      identifier.includes('carpet')
    ) {
      return 'fabric';
    }
    if (identifier.includes('plastic') || identifier.includes('polymer')) {
      return 'plastic';
    }

    return this.materialDatabase.defaultMaterial;
  }

  /**
   * Get current system statistics
   */
  public getStats(): ImpactSystemStats {
    return { ...this.stats };
  }

  /**
   * Update performance configuration
   */
  public updatePerformanceConfig(config: Partial<ImpactPerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...config };
  }

  /**
   * Cleanup and dispose resources
   */
  public dispose(): void {
    this.activeImpacts.clear();
    // Additional cleanup will be handled by specific effect systems
  }

  private processImpactEffects(
    impactData: ImpactData,
    config: ImpactConfig,
    lodLevel: number
  ): ImpactResult {
    console.log(
      `🔥 [IMPACT_MANAGER] Processing effects with LOD ${lodLevel}, ${config.particleEffects.length} particle types available`
    );

    const result: ImpactResult = {
      success: true,
      particleSystemsCreated: 0,
      decalsCreated: 0,
      audioSourcesUsed: 0,
      processingTime: 0,
      memoryUsed: 0,
      effectIds: [],
    };

    // Create particle effects based on LOD
    if (lodLevel >= 0 && config.particleEffects.length > 0) {
      result.particleSystemsCreated = this.createParticleEffects(impactData, config, lodLevel);
    }

    // Create decals for close impacts
    if (lodLevel >= 0 && config.decalEnabled) {
      console.log(`🏺 [IMPACT_MANAGER] Attempting to create decal at LOD ${lodLevel}`);
      result.decalsCreated = this.createDecalEffect(impactData, config);
    } else {
      console.log(
        `⚠️ [IMPACT_MANAGER] Decal skipped: LOD=${lodLevel}, enabled=${config.decalEnabled}`
      );
    }

    // Play audio for all impacts within hearing range (temporarily disabled)
    // if (this.isWithinAudioRange(impactData.position)) {
    //   result.audioSourcesUsed = this.playImpactAudio(impactData, config);
    // }
    console.log('[IMPACT_MANAGER] Audio temporarily disabled to focus on visual effects');

    return result;
  }

  private createParticleEffects(
    impactData: ImpactData,
    config: ImpactConfig,
    lodLevel: number
  ): number {
    let systemsCreated = 0;

    // Reduce particle count based on LOD
    const particleMultiplier =
      lodLevel === 3
        ? 1.0
        : lodLevel === 2
          ? 0.7
          : lodLevel === 1
            ? 0.4
            : lodLevel === 0
              ? 0.2
              : 0.0; // Minimal effects for LOD 0
    const adjustedParticleCount = Math.floor(config.maxParticles * particleMultiplier);

    for (const effectType of config.particleEffects) {
      try {
        console.log('[IMPACT_MANAGER] Creating particle effect:', effectType);

        // Create particle system based on effect type and material
        let effectId: string;

        switch (effectType) {
          case 'sparks':
            effectId = this.particleSystem.createSparks(impactData);
            break;
          case 'debris':
            effectId = this.particleSystem.createDebris(impactData, impactData.materialType);
            break;
          case 'dust':
            effectId = this.particleSystem.createDust(impactData, impactData.materialType);
            break;
          default:
            effectId = this.particleSystem.createImpactParticles(
              impactData,
              effectType,
              adjustedParticleCount
            );
            break;
        }

        if (effectId) {
          console.log('[IMPACT_MANAGER] Created particle effect:', effectId);
          systemsCreated++;
        }
      } catch (error) {
        console.error('[IMPACT_MANAGER] Failed to create particle effect:', effectType, error);
      }
    }

    return systemsCreated;
  }

  private createDecalEffect(impactData: ImpactData, config: ImpactConfig): number {
    console.log(
      `🏺 [IMPACT_MANAGER] Decal check: enabled=${config.decalEnabled}, material=${impactData.materialType}`
    );

    if (!config.decalEnabled) {
      console.log('⚠️ [IMPACT_MANAGER] Decals disabled for this material');
      return 0;
    }

    try {
      console.log('[IMPACT_MANAGER] Creating decal effect for material:', impactData.materialType);
      const decalId = this.renderer.createBulletHole(impactData, 0.05);
      if (decalId) {
        console.log('[IMPACT_MANAGER] Decal created:', decalId);
        return 1;
      }
    } catch (error) {
      console.error('[IMPACT_MANAGER] Failed to create decal:', error);
    }
    return 0;
  }

  private playImpactAudio(impactData: ImpactData, _config: ImpactConfig): number {
    try {
      console.log('[IMPACT_MANAGER] Playing impact audio for material:', impactData.materialType);
      const audioId = this.audioManager.playImpactSound(impactData);
      if (audioId) {
        console.log('[IMPACT_MANAGER] Impact audio playing:', audioId);
        return 1;
      }
    } catch (error) {
      console.error('[IMPACT_MANAGER] Failed to play impact audio:', error);
    }
    return 0;
  }

  private validateImpactData(data: ImpactData): boolean {
    return !!(data.position && data.normal && data.materialType && data.timestamp > 0);
  }

  private canProcessImpact(): boolean {
    const activeCount = Array.from(this.activeImpacts.values()).reduce(
      (sum, count) => sum + count,
      0
    );
    return activeCount < this.performanceConfig.maxSimultaneousImpacts;
  }

  private getMaterialConfig(materialType: MaterialType): ImpactConfig {
    const direct = this.materialDatabase.materials.get(materialType);
    if (direct) return direct;
    const fallback = this.materialDatabase.materials.get(this.materialDatabase.defaultMaterial);
    if (fallback) return fallback;
    // As a last resort, pick the first available config
    const iterator = this.materialDatabase.materials.values();
    const first = iterator.next();
    if (!first.done) return first.value as ImpactConfig;
    throw new Error('Impact material database is empty');
  }

  private getCameraDistance(position: Vector3): number {
    const camera = this.scene.activeCamera;
    if (!camera) return 1000;

    return Vector3.Distance(position, camera.position);
  }

  private calculateLODLevel(distance: number): number {
    const { highDetailDistance, mediumDetailDistance, lowDetailDistance, cullingDistance } =
      this.performanceConfig;

    if (distance <= highDetailDistance) return 3; // High detail
    if (distance <= mediumDetailDistance) return 2; // Medium detail
    if (distance <= lowDetailDistance) return 1; // Low detail
    if (distance <= cullingDistance) return 0; // Minimal effects (was completely disabled)
    return -1; // Truly no effects beyond culling distance
  }

  private isWithinAudioRange(position: Vector3): boolean {
    const camera = this.scene.activeCamera;
    if (!camera) return false;

    const distance = Vector3.Distance(position, camera.position);
    return distance <= 100; // TODO: Make configurable
  }

  private updateStats(impactData: ImpactData, result: ImpactResult, processingTime: number): void {
    this.stats.totalImpacts++;

    const materialCount = this.stats.impactsByMaterial.get(impactData.materialType) || 0;
    this.stats.impactsByMaterial.set(impactData.materialType, materialCount + 1);

    this.stats.activeEffects += result.particleSystemsCreated + result.decalsCreated;
    this.stats.averageProcessingTime = (this.stats.averageProcessingTime + processingTime) / 2;
  }

  private scheduleCleanup(): void {
    const now = performance.now();
    if (now - this.lastCleanup > 1000) {
      // Every second
      this.performCleanup();
      this.lastCleanup = now;
    }
  }

  private performCleanup(): void {
    // Cleanup expired effects and update active counts
    // This will be implemented when effect systems are complete
  }

  private createErrorResult(error: string): ImpactResult {
    return {
      success: false,
      error,
      particleSystemsCreated: 0,
      decalsCreated: 0,
      audioSourcesUsed: 0,
      processingTime: 0,
      memoryUsed: 0,
      effectIds: [],
    };
  }

  private initializeStats(): ImpactSystemStats {
    return {
      totalImpacts: 0,
      impactsByMaterial: new Map(),
      activeEffects: 0,
      averageProcessingTime: 0,
      memoryUsage: 0,
      frameTime: 0,
      particlePoolUtilization: 0,
      decalPoolUtilization: 0,
      audioPoolUtilization: 0,
    };
  }

  private getDefaultPerformanceConfig(): ImpactPerformanceConfig {
    return {
      highDetailDistance: 100, // Increased from 20
      mediumDetailDistance: 300, // Increased from 50
      lowDetailDistance: 500, // Increased from 100
      cullingDistance: 1000, // Increased from 200

      maxParticlesPerImpact: 50,
      maxSimultaneousImpacts: 10,
      maxDecalsPerSurface: 5,

      particleUpdateRate: 60,
      audioUpdateRate: 30,

      poolSizes: {
        particles: 500,
        decals: 100,
        audioSources: 20,
      },
    };
  }

  private initializeMaterialDatabase(): MaterialDatabase {
    const materials = new Map<MaterialType, ImpactConfig>();

    // Metal configuration
    materials.set('metal', {
      materialType: 'metal',
      hardness: 0.9,
      density: 0.8,
      particleEffects: ['sparks', 'debris'],
      decalEnabled: true,
      scorchMarkEnabled: false,
      audioType: 'metallic_ping',
      audioVariations: ['metal_hit_01', 'metal_hit_02', 'metal_hit_03'],
      ricochetChance: 0.7,
      penetrationResistance: 0.8,
      maxParticles: 30,
      particleLifetime: 6000, // Extended for better visibility
      maxDistance: 100,
    });

    // Concrete configuration
    materials.set('concrete', {
      materialType: 'concrete',
      hardness: 0.8,
      density: 0.9,
      particleEffects: ['dust', 'debris'],
      decalEnabled: true,
      scorchMarkEnabled: false,
      audioType: 'concrete_crack',
      audioVariations: ['concrete_hit_01', 'concrete_hit_02'],
      ricochetChance: 0.3,
      penetrationResistance: 0.9,
      maxParticles: 25,
      particleLifetime: 8000, // Extended for concrete dust
      maxDistance: 100,
    });

    // Wood configuration
    materials.set('wood', {
      materialType: 'wood',
      hardness: 0.4,
      density: 0.5,
      particleEffects: ['debris', 'dust'],
      decalEnabled: true,
      scorchMarkEnabled: false,
      audioType: 'wood_thud',
      audioVariations: ['wood_hit_01', 'wood_hit_02', 'wood_hit_03'],
      ricochetChance: 0.1,
      penetrationResistance: 0.3,
      maxParticles: 20,
      particleLifetime: 7000, // Extended for wood debris
      maxDistance: 80,
    });

    // Glass configuration
    materials.set('glass', {
      materialType: 'glass',
      hardness: 0.7,
      density: 0.3,
      particleEffects: ['shards', 'debris'],
      decalEnabled: false,
      scorchMarkEnabled: false,
      audioType: 'glass_shatter',
      audioVariations: ['glass_break_01', 'glass_break_02'],
      ricochetChance: 0.1,
      penetrationResistance: 0.1,
      maxParticles: 40,
      particleLifetime: 10000, // Extended for glass shards
      maxDistance: 120,
    });

    // Default fallback
    materials.set('default', {
      materialType: 'default',
      hardness: 0.5,
      density: 0.5,
      particleEffects: ['dust'],
      decalEnabled: true,
      scorchMarkEnabled: false,
      audioType: 'default_hit',
      audioVariations: ['generic_hit_01'],
      ricochetChance: 0.2,
      penetrationResistance: 0.5,
      maxParticles: 15,
      particleLifetime: 5000, // Extended for default material
      maxDistance: 60,
    });

    return {
      materials,
      defaultMaterial: 'default',
    };
  }
}
