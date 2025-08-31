/**
 * Impact Audio System - 3D spatial audio for weapon impacts
 */

import { type Scene, Sound, type Vector3 } from '@babylonjs/core';
import type { ImpactAudioConfig, ImpactData, MaterialType } from '../impact/impact-types';

export class ImpactAudioManager {
  private scene: Scene;
  private audioPool: Map<string, Sound[]> = new Map();
  private activeAudioSources: Map<string, Sound> = new Map();
  private masterVolume = 1.0;
  private maxDistance = 100;

  constructor(scene: Scene) {
    this.scene = scene;
    this.initializeAudioSamples();
  }

  /**
   * Play impact sound based on material type and impact data
   */
  public playImpactSound(impactData: ImpactData, intensity = 1.0): string {
    const materialType = impactData.materialType || 'default';
    const audioConfig = this.getAudioConfigForMaterial(materialType);

    // Select random sound sample
    const soundSample = this.selectRandomSample(materialType);
    if (!soundSample) {
      return '';
    }

    // Create 3D positioned sound
    if (!soundSample) return '';

    const sound = this.createPositionalSound(
      soundSample,
      impactData.position,
      audioConfig,
      intensity
    );

    if (!sound) {
      return '';
    }

    const audioId = this.generateAudioId();
    this.activeAudioSources.set(audioId, sound);

    // Play sound
    sound.play();

    // Remove from active sources when finished
    sound.onEndedObservable.add(() => {
      this.activeAudioSources.delete(audioId);
      this.returnSoundToPool(materialType, sound);
    });

    return audioId;
  }

  /**
   * Play ricochet sound effect
   */
  public playRicochetSound(position: Vector3, materialType: MaterialType, intensity = 1.0): string {
    const ricochetSamples = this.getRicochetSamples(materialType);
    const sampleName =
      ricochetSamples[Math.floor(Math.random() * ricochetSamples.length)] || 'ricochet_generic_01';

    const sound = this.createPositionalSound(
      sampleName,
      position,
      this.getRicochetAudioConfig(materialType),
      intensity
    );

    if (!sound) {
      return '';
    }

    const audioId = this.generateAudioId();
    this.activeAudioSources.set(audioId, sound);

    sound.play();

    sound.onEndedObservable.add(() => {
      this.activeAudioSources.delete(audioId);
      sound.dispose();
    });

    return audioId;
  }

  /**
   * Play metal spark sound for metal impacts
   */
  public playSparkSound(position: Vector3, intensity = 1.0): string {
    const sparkSamples = ['spark_01', 'spark_02', 'spark_03'];
    const sampleName = sparkSamples[Math.floor(Math.random() * sparkSamples.length)] || 'spark_01';

    const config: ImpactAudioConfig = {
      samples: sparkSamples,
      randomize: true,
      volume: 0.8,
      pitch: 1.0,
      pitchVariation: 0.3,
      maxDistance: 50,
      rolloffFactor: 1.2,
      dopplerFactor: 0,
      reverbEnabled: false,
      occlusionEnabled: false,
    };

    const sound = this.createPositionalSound(sampleName, position, config, intensity);

    if (!sound) {
      return '';
    }

    const audioId = this.generateAudioId();
    this.activeAudioSources.set(audioId, sound);

    sound.play();

    sound.onEndedObservable.add(() => {
      this.activeAudioSources.delete(audioId);
      sound.dispose();
    });

    return audioId;
  }

  /**
   * Play debris sound for hard material impacts
   */
  public playDebrisSound(position: Vector3, materialType: MaterialType, intensity = 1.0): string {
    const debrisSamples = this.getDebrisSamples(materialType);
    const sampleName =
      debrisSamples[Math.floor(Math.random() * debrisSamples.length)] || 'debris_generic_01';

    const sound = this.createPositionalSound(
      sampleName,
      position,
      this.getDebrisAudioConfig(materialType),
      intensity
    );

    if (!sound) {
      return '';
    }

    const audioId = this.generateAudioId();
    this.activeAudioSources.set(audioId, sound);

    sound.play();

    sound.onEndedObservable.add(() => {
      this.activeAudioSources.delete(audioId);
      sound.dispose();
    });

    return audioId;
  }

  /**
   * Stop specific audio effect
   */
  public stopAudio(audioId: string): void {
    const sound = this.activeAudioSources.get(audioId);
    if (sound) {
      sound.stop();
      this.activeAudioSources.delete(audioId);
    }
  }

  /**
   * Stop all active audio effects
   */
  public stopAllAudio(): void {
    for (const sound of this.activeAudioSources.values()) {
      sound.stop();
    }
    this.activeAudioSources.clear();
  }

  /**
   * Set master volume for impact sounds
   */
  public setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Set max audible distance
   */
  public setMaxDistance(distance: number): void {
    this.maxDistance = Math.max(1, distance);
  }

  /**
   * Get current audio statistics
   */
  public getAudioStats() {
    return {
      activeAudioSources: this.activeAudioSources.size,
      pooledSounds: Array.from(this.audioPool.values()).reduce((sum, arr) => sum + arr.length, 0),
      masterVolume: this.masterVolume,
      maxDistance: this.maxDistance,
    };
  }

  /**
   * Dispose all audio resources
   */
  public dispose(): void {
    this.stopAllAudio();

    // Dispose pooled sounds
    for (const sounds of this.audioPool.values()) {
      for (const sound of sounds) {
        sound.dispose();
      }
    }
    this.audioPool.clear();
  }

  private createPositionalSound(
    sampleName: string,
    position: Vector3,
    config: ImpactAudioConfig,
    intensity: number
  ): Sound | null {
    try {
      // Try to get from pool first
      const pooledSound = this.getSoundFromPool(sampleName);
      if (pooledSound) {
        this.configureSound(pooledSound, position, config, intensity);
        return pooledSound;
      }

      // Create new sound if pool is empty
      const sound = new Sound(
        `impact_${sampleName}_${Date.now()}`,
        `./assets/audio/impacts/${sampleName}.wav`, // Placeholder path
        this.scene,
        null,
        {
          loop: false,
          autoplay: false,
          spatialSound: true,
          maxDistance: config.maxDistance,
          rolloffFactor: config.rolloffFactor,
          refDistance: 1,
        }
      );

      this.configureSound(sound, position, config, intensity);
      return sound;
    } catch (error) {
      console.warn(`Failed to create impact sound ${sampleName}:`, error);
      return null;
    }
  }

  private configureSound(
    sound: Sound,
    position: Vector3,
    config: ImpactAudioConfig,
    intensity: number
  ): void {
    // Set 3D position
    sound.setPosition(position);

    // Apply configuration
    const finalVolume = config.volume * this.masterVolume * intensity;
    sound.setVolume(Math.max(0, Math.min(1, finalVolume)));

    // Apply pitch variation
    const pitchVariation = (Math.random() - 0.5) * config.pitchVariation;
    const finalPitch = Math.max(0.5, Math.min(2.0, config.pitch + pitchVariation));
    sound.setPlaybackRate(finalPitch);

    // Apply spatial audio settings
    try {
      sound.maxDistance = config.maxDistance;
      sound.rolloffFactor = config.rolloffFactor;
    } catch (error) {
      // Spatial audio properties might not be available
    }
  }

  private getSoundFromPool(sampleName: string): Sound | null {
    const pool = this.audioPool.get(sampleName);
    return pool && pool.length > 0 ? pool.pop()! : null;
  }

  private returnSoundToPool(materialType: string, sound: Sound): void {
    sound.stop();
    sound.setVolume(0);

    if (!this.audioPool.has(materialType)) {
      this.audioPool.set(materialType, []);
    }

    const pool = this.audioPool.get(materialType)!;
    if (pool.length < 5) {
      // Max 5 sounds per material in pool
      pool.push(sound);
    } else {
      sound.dispose();
    }
  }

  private initializeAudioSamples(): void {
    // Initialize audio pools for different materials
    const materialTypes: MaterialType[] = [
      'metal',
      'concrete',
      'stone',
      'wood',
      'glass',
      'water',
      'dirt',
      'fabric',
      'plastic',
      'default',
    ];

    for (const materialType of materialTypes) {
      this.audioPool.set(materialType, []);
    }
  }

  private selectRandomSample(materialType: MaterialType): string {
    const samples = this.getSamplesForMaterial(materialType);
    return samples.length > 0
      ? samples[Math.floor(Math.random() * samples.length)] || 'generic_hit_01'
      : 'generic_hit_01';
  }

  private getSamplesForMaterial(materialType: MaterialType): string[] {
    const sampleMap: Record<MaterialType, string[]> = {
      metal: ['metal_hit_01', 'metal_hit_02', 'metal_hit_03', 'metal_ping_01'],
      concrete: ['concrete_hit_01', 'concrete_hit_02', 'concrete_crack_01'],
      stone: ['stone_hit_01', 'stone_hit_02', 'stone_crack_01'],
      wood: ['wood_hit_01', 'wood_hit_02', 'wood_thud_01', 'wood_splinter_01'],
      glass: ['glass_break_01', 'glass_break_02', 'glass_shatter_01'],
      water: ['water_splash_01', 'water_splash_02', 'water_drop_01'],
      flesh: ['flesh_hit_01', 'flesh_hit_02', 'blood_splat_01'],
      dirt: ['dirt_hit_01', 'dirt_puff_01', 'dirt_scatter_01'],
      fabric: ['fabric_tear_01', 'fabric_rip_01'],
      plastic: ['plastic_snap_01', 'plastic_crack_01'],
      default: ['generic_hit_01', 'generic_hit_02'],
    };

    return sampleMap[materialType] || sampleMap.default;
  }

  private getRicochetSamples(materialType: MaterialType): string[] {
    const ricochetMap: Partial<Record<MaterialType, string[]>> = {
      metal: ['ricochet_metal_01', 'ricochet_metal_02', 'ricochet_ping_01'],
      concrete: ['ricochet_concrete_01', 'ricochet_stone_01'],
      stone: ['ricochet_stone_01', 'ricochet_rock_01'],
    };

    return ricochetMap[materialType] || ['ricochet_generic_01'];
  }

  private getDebrisSamples(materialType: MaterialType): string[] {
    const debrisMap: Partial<Record<MaterialType, string[]>> = {
      metal: ['debris_metal_01', 'debris_metal_clatter_01'],
      concrete: ['debris_concrete_01', 'debris_stone_01', 'debris_dust_01'],
      stone: ['debris_stone_01', 'debris_rock_01'],
      wood: ['debris_wood_01', 'debris_splinter_01'],
      glass: ['debris_glass_01', 'debris_shard_01'],
    };

    return debrisMap[materialType] || ['debris_generic_01'];
  }

  private getAudioConfigForMaterial(materialType: MaterialType): ImpactAudioConfig {
    const configMap: Partial<Record<MaterialType, ImpactAudioConfig>> = {
      metal: {
        samples: this.getSamplesForMaterial('metal'),
        randomize: true,
        volume: 0.9,
        pitch: 1.0,
        pitchVariation: 0.2,
        maxDistance: 80,
        rolloffFactor: 1.0,
        dopplerFactor: 0.5,
        reverbEnabled: true,
        occlusionEnabled: true,
      },
      concrete: {
        samples: this.getSamplesForMaterial('concrete'),
        randomize: true,
        volume: 0.8,
        pitch: 0.9,
        pitchVariation: 0.3,
        maxDistance: 70,
        rolloffFactor: 1.2,
        dopplerFactor: 0.3,
        reverbEnabled: true,
        occlusionEnabled: true,
      },
      wood: {
        samples: this.getSamplesForMaterial('wood'),
        randomize: true,
        volume: 0.7,
        pitch: 0.8,
        pitchVariation: 0.4,
        maxDistance: 60,
        rolloffFactor: 1.3,
        dopplerFactor: 0.2,
        reverbEnabled: false,
        occlusionEnabled: true,
      },
      glass: {
        samples: this.getSamplesForMaterial('glass'),
        randomize: true,
        volume: 0.9,
        pitch: 1.2,
        pitchVariation: 0.3,
        maxDistance: 90,
        rolloffFactor: 0.8,
        dopplerFactor: 0.1,
        reverbEnabled: false,
        occlusionEnabled: false,
      },
      default: {
        samples: this.getSamplesForMaterial('default'),
        randomize: true,
        volume: 0.6,
        pitch: 1.0,
        pitchVariation: 0.2,
        maxDistance: 60,
        rolloffFactor: 1.0,
        dopplerFactor: 0.3,
        reverbEnabled: false,
        occlusionEnabled: true,
      },
    };

    // Create default config for unmapped materials
    const defaultConfig: ImpactAudioConfig = {
      samples: this.getSamplesForMaterial('default'),
      randomize: true,
      volume: 0.6,
      pitch: 1.0,
      pitchVariation: 0.2,
      maxDistance: 60,
      rolloffFactor: 1.0,
      dopplerFactor: 0.3,
      reverbEnabled: false,
      occlusionEnabled: true,
    };
    return configMap[materialType] || defaultConfig;
  }

  private getRicochetAudioConfig(materialType: MaterialType): ImpactAudioConfig {
    const baseConfig = this.getAudioConfigForMaterial(materialType);

    return {
      ...baseConfig,
      volume: baseConfig.volume * 0.7, // Ricochets are quieter
      pitch: baseConfig.pitch * 1.2, // Higher pitch for ricochets
      pitchVariation: 0.4,
      samples: this.getRicochetSamples(materialType),
    };
  }

  private getDebrisAudioConfig(materialType: MaterialType): ImpactAudioConfig {
    const baseConfig = this.getAudioConfigForMaterial(materialType);

    return {
      ...baseConfig,
      volume: baseConfig.volume * 0.5, // Debris is quieter
      pitch: baseConfig.pitch * 0.8, // Lower pitch for debris
      maxDistance: baseConfig.maxDistance * 0.6, // Shorter range
      samples: this.getDebrisSamples(materialType),
    };
  }

  private generateAudioId(): string {
    return `audio_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }
}
