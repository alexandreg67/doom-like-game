/**
 * Impact Manager - Main controller for weapon impact effects
 */

import type { Scene } from '@babylonjs/core';
import { Vector3 } from '@babylonjs/core';
import type {
  ImpactData,
  ImpactResult,
  ImpactConfig,
  MaterialType,
  MaterialDatabase,
  ImpactSystemStats,
  ImpactPerformanceConfig
} from './impact-types';

export class ImpactManager {
  private scene: Scene;
  private materialDatabase: MaterialDatabase;
  private performanceConfig: ImpactPerformanceConfig;
  private stats: ImpactSystemStats;
  private activeImpacts: Map<string, number> = new Map();
  private lastCleanup = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.performanceConfig = this.getDefaultPerformanceConfig();
    this.stats = this.initializeStats();
    this.materialDatabase = this.initializeMaterialDatabase();
  }

  /**
   * Process weapon impact and trigger appropriate effects
   */
  public processImpact(impactData: ImpactData): ImpactResult {
    const startTime = performance.now();
    
    try {
      // Validate impact data
      if (!this.validateImpactData(impactData)) {
        return this.createErrorResult('Invalid impact data');
      }

      // Check performance limits
      if (!this.canProcessImpact()) {
        return this.createErrorResult('Performance limit reached');
      }

      // Get material configuration
      const materialConfig = this.getMaterialConfig(impactData.materialType);
      
      // Apply LOD based on distance to camera
      const cameraDistance = this.getCameraDistance(impactData.position);
      const lodLevel = this.calculateLODLevel(cameraDistance);
      
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
    
    if (identifier.includes('metal') || identifier.includes('steel') || identifier.includes('iron')) {
      return 'metal';
    }
    if (identifier.includes('concrete') || identifier.includes('cement')) {
      return 'concrete';
    }
    if (identifier.includes('stone') || identifier.includes('rock') || identifier.includes('brick')) {
      return 'stone';
    }
    if (identifier.includes('wood') || identifier.includes('timber') || identifier.includes('plank')) {
      return 'wood';
    }
    if (identifier.includes('glass') || identifier.includes('window')) {
      return 'glass';
    }
    if (identifier.includes('water') || identifier.includes('liquid')) {
      return 'water';
    }
    if (identifier.includes('dirt') || identifier.includes('soil') || identifier.includes('ground')) {
      return 'dirt';
    }
    if (identifier.includes('fabric') || identifier.includes('cloth') || identifier.includes('carpet')) {
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
    const result: ImpactResult = {
      success: true,
      particleSystemsCreated: 0,
      decalsCreated: 0,
      audioSourcesUsed: 0,
      processingTime: 0,
      memoryUsed: 0,
      effectIds: []
    };

    // Create particle effects based on LOD
    if (lodLevel > 0 && config.particleEffects.length > 0) {
      result.particleSystemsCreated = this.createParticleEffects(impactData, config, lodLevel);
    }

    // Create decals for close impacts
    if (lodLevel > 1 && config.decalEnabled) {
      result.decalsCreated = this.createDecalEffect(impactData, config);
    }

    // Play audio for all impacts within hearing range
    if (this.isWithinAudioRange(impactData.position)) {
      result.audioSourcesUsed = this.playImpactAudio(impactData, config);
    }

    return result;
  }

  private createParticleEffects(
    impactData: ImpactData,
    config: ImpactConfig,
    lodLevel: number
  ): number {
    let systemsCreated = 0;
    
    // Reduce particle count based on LOD
    const particleMultiplier = lodLevel === 3 ? 1.0 : lodLevel === 2 ? 0.7 : 0.4;
    const adjustedParticleCount = Math.floor(config.maxParticles * particleMultiplier);
    
    for (const effectType of config.particleEffects) {
      // Create particle system based on effect type and material
      // This will be implemented in the particle system
      systemsCreated++;
    }
    
    return systemsCreated;
  }

  private createDecalEffect(impactData: ImpactData, config: ImpactConfig): number {
    if (!config.decalEnabled) {
      return 0;
    }
    
    // Create bullet hole or impact decal
    // Implementation will depend on decal system
    return 1;
  }

  private playImpactAudio(impactData: ImpactData, config: ImpactConfig): number {
    // Select random audio sample
    const audioSample = config.audioVariations[
      Math.floor(Math.random() * config.audioVariations.length)
    ];
    
    // Play 3D positioned audio
    // Implementation will depend on audio system
    return 1;
  }

  private validateImpactData(data: ImpactData): boolean {
    return !!(
      data.position &&
      data.normal &&
      data.materialType &&
      data.timestamp > 0
    );
  }

  private canProcessImpact(): boolean {
    const activeCount = Array.from(this.activeImpacts.values()).reduce((sum, count) => sum + count, 0);
    return activeCount < this.performanceConfig.maxSimultaneousImpacts;
  }

  private getMaterialConfig(materialType: MaterialType): ImpactConfig {
    return this.materialDatabase.materials.get(materialType) || 
           this.materialDatabase.materials.get(this.materialDatabase.defaultMaterial)!;
  }

  private getCameraDistance(position: Vector3): number {
    const camera = this.scene.activeCamera;
    if (!camera) return 1000;
    
    return Vector3.Distance(position, camera.position);
  }

  private calculateLODLevel(distance: number): number {
    const { highDetailDistance, mediumDetailDistance, lowDetailDistance } = this.performanceConfig;
    
    if (distance <= highDetailDistance) return 3; // High detail
    if (distance <= mediumDetailDistance) return 2; // Medium detail  
    if (distance <= lowDetailDistance) return 1; // Low detail
    return 0; // No effects
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
    this.stats.averageProcessingTime = 
      (this.stats.averageProcessingTime + processingTime) / 2;
  }

  private scheduleCleanup(): void {
    const now = performance.now();
    if (now - this.lastCleanup > 1000) { // Every second
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
      effectIds: []
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
      audioPoolUtilization: 0
    };
  }

  private getDefaultPerformanceConfig(): ImpactPerformanceConfig {
    return {
      highDetailDistance: 20,
      mediumDetailDistance: 50,
      lowDetailDistance: 100,
      cullingDistance: 200,
      
      maxParticlesPerImpact: 50,
      maxSimultaneousImpacts: 10,
      maxDecalsPerSurface: 5,
      
      particleUpdateRate: 60,
      audioUpdateRate: 30,
      
      poolSizes: {
        particles: 500,
        decals: 100,
        audioSources: 20
      }
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
      particleLifetime: 2000,
      maxDistance: 100
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
      particleLifetime: 3000,
      maxDistance: 100
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
      particleLifetime: 2500,
      maxDistance: 80
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
      particleLifetime: 4000,
      maxDistance: 120
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
      particleLifetime: 2000,
      maxDistance: 60
    });

    return {
      materials,
      defaultMaterial: 'default'
    };
  }
}