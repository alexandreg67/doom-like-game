import { Sound, type Scene } from '@babylonjs/core';
import { EnemyType, EnemyState, type AudioStateConfig } from '../types/enemy-types';

/**
 * EnemyAudioManager - Manages audio assets and placeholder sounds for enemies
 *
 * Features:
 * - Audio asset loading with fallbacks
 * - Placeholder sound generation for development
 * - Configuration management per enemy type
 * - Cache optimization with cleanup
 * - Support for multiple audio formats
 */
export class EnemyAudioManager {
  private scene: Scene;
  private audioCache: Map<string, ArrayBuffer> = new Map();
  private placeholderCache: Map<string, AudioBuffer> = new Map();
  private loadingPromises: Map<string, Promise<ArrayBuffer | null>> = new Map();
  private manifest: Record<string, string> | null = null;
  private debug = false;

  // Configuration
  private readonly supportedFormats = ['ogg', 'mp3', 'wav'];
  private readonly maxCacheSize = 50 * 1024 * 1024; // 50MB cache limit
  private readonly basePath = './assets/audio/enemies/';
  
  constructor(scene: Scene, options?: { debug?: boolean; basePath?: string }) {
    this.scene = scene;
    this.debug = options?.debug ?? false;
    
    if (options?.basePath) {
      // @ts-ignore - Allow custom base path override
      this.basePath = options.basePath;
    }

    if (this.debug) {
      console.log('[ENEMY_AUDIO_MANAGER] Initialized with base path:', this.basePath);
    }
  }

  /**
   * Preload audio assets for specific enemy type
   */
  async preloadEnemyAudio(enemyType: EnemyType): Promise<void> {
    if (this.debug) {
      console.log(`[ENEMY_AUDIO_MANAGER] Preloading audio for enemy type: ${enemyType}`);
    }

    // Ensure manifest is loaded
    await this.ensureManifest();

    // Get all sound IDs for this enemy type
    const soundIds = this.getEnemySoundIds(enemyType);
    
    // Load all sounds in parallel
    const loadPromises = soundIds.map(soundId => this.loadAudioAsset(soundId));
    await Promise.all(loadPromises);

    if (this.debug) {
      console.log(`[ENEMY_AUDIO_MANAGER] Preloaded ${soundIds.length} sounds for ${enemyType}`);
    }
  }

  /**
   * Preload audio for all enemy types
   */
  async preloadAllEnemyAudio(): Promise<void> {
    if (this.debug) {
      console.log('[ENEMY_AUDIO_MANAGER] Preloading all enemy audio');
    }

    const enemyTypes = Object.values(EnemyType);
    const loadPromises = enemyTypes.map(type => this.preloadEnemyAudio(type));
    await Promise.all(loadPromises);

    if (this.debug) {
      console.log('[ENEMY_AUDIO_MANAGER] All enemy audio preloaded');
    }
  }

  /**
   * Get audio buffer for sound (with fallback to placeholder)
   */
  async getAudioBuffer(soundId: string, audioContext: AudioContext): Promise<AudioBuffer | null> {
    // Try to get real audio asset first
    const audioData = await this.loadAudioAsset(soundId);
    if (audioData) {
      try {
        return await audioContext.decodeAudioData(audioData.slice(0));
      } catch (error) {
        console.warn(`[ENEMY_AUDIO_MANAGER] Failed to decode audio for ${soundId}:`, error);
      }
    }

    // Fallback to placeholder
    return this.createPlaceholderBuffer(soundId, audioContext);
  }

  /**
   * Create Babylon.js Sound with asset or placeholder
   */
  async createEnemySound(
    soundId: string,
    scene: Scene,
    options: {
      spatialSound?: boolean;
      maxDistance?: number;
      rolloffFactor?: number;
      volume?: number;
    } = {}
  ): Promise<Sound | null> {
    try {
      // Try to create sound with real asset first
      const audioUrl = await this.resolveAudioUrl(soundId);
      if (audioUrl) {
        return new Sound(
          `enemy_${soundId}_${Date.now()}`,
          audioUrl,
          scene,
          null,
          {
            loop: false,
            autoplay: false,
            spatialSound: options.spatialSound ?? true,
            maxDistance: options.maxDistance ?? 100,
            rolloffFactor: options.rolloffFactor ?? 1.0,
            volume: options.volume ?? 1.0,
          }
        );
      }

      // Fallback: create sound with placeholder
      return this.createPlaceholderSound(soundId, scene, options);
    } catch (error) {
      console.warn(`[ENEMY_AUDIO_MANAGER] Failed to create sound ${soundId}:`, error);
      return this.createPlaceholderSound(soundId, scene, options);
    }
  }

  /**
   * Get default audio configuration for enemy type
   */
  getDefaultAudioConfig(enemyType: EnemyType): Record<EnemyState, AudioStateConfig> {
    // This is a comprehensive configuration that can be customized per enemy type
    const baseConfig: Record<EnemyState, AudioStateConfig> = {
      [EnemyState.IDLE]: {
        samples: [
          `${enemyType}_idle_breathing_01`,
          `${enemyType}_idle_ambient_01`,
          `${enemyType}_idle_sniff_01`
        ],
        volume: 0.3,
        pitch: 1.0,
        pitchVariation: 0.1,
        maxDistance: 25,
        rolloffFactor: 1.2,
        loop: true,
        triggerChance: 0.15,
        cooldown: 8.0,
      },
      [EnemyState.SEEKING]: {
        samples: [
          `${enemyType}_seeking_footstep_01`,
          `${enemyType}_seeking_search_01`,
          `${enemyType}_seeking_grunt_01`
        ],
        volume: 0.5,
        pitch: 1.0,
        pitchVariation: 0.15,
        maxDistance: 35,
        rolloffFactor: 1.0,
        loop: false,
        triggerChance: 0.4,
        cooldown: 3.0,
      },
      [EnemyState.CHASE]: {
        samples: [
          `${enemyType}_chase_roar_01`,
          `${enemyType}_chase_aggressive_01`,
          `${enemyType}_chase_footstep_fast_01`
        ],
        volume: 0.7,
        pitch: 1.1,
        pitchVariation: 0.2,
        maxDistance: 50,
        rolloffFactor: 0.9,
        loop: false,
        triggerChance: 0.7,
        cooldown: 1.5,
      },
      [EnemyState.ATTACK]: {
        samples: [
          `${enemyType}_attack_roar_01`,
          `${enemyType}_attack_grunt_01`,
          `${enemyType}_attack_swoosh_01`
        ],
        volume: 0.9,
        pitch: 1.2,
        pitchVariation: 0.3,
        maxDistance: 70,
        rolloffFactor: 0.7,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.3,
      },
      [EnemyState.HURT]: {
        samples: [
          `${enemyType}_hurt_scream_01`,
          `${enemyType}_hurt_pain_01`,
          `${enemyType}_hurt_whimper_01`
        ],
        volume: 0.8,
        pitch: 1.4,
        pitchVariation: 0.4,
        maxDistance: 60,
        rolloffFactor: 0.8,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.1,
      },
      [EnemyState.DEATH]: {
        samples: [
          `${enemyType}_death_scream_01`,
          `${enemyType}_death_final_01`,
          `${enemyType}_death_body_fall_01`
        ],
        volume: 1.0,
        pitch: 0.8,
        pitchVariation: 0.2,
        maxDistance: 100,
        rolloffFactor: 0.5,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.0,
      },
    };

    // Enemy type specific modifications
    return this.applyEnemyTypeModifications(baseConfig, enemyType);
  }

  /**
   * Clean up cache and resources
   */
  dispose(): void {
    this.audioCache.clear();
    this.placeholderCache.clear();
    this.loadingPromises.clear();
    
    if (this.debug) {
      console.log('[ENEMY_AUDIO_MANAGER] Disposed resources');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    cachedAssets: number;
    cacheSize: number;
    placeholderCount: number;
    loadingCount: number;
  } {
    const cacheSize = Array.from(this.audioCache.values())
      .reduce((total, buffer) => total + buffer.byteLength, 0);

    return {
      cachedAssets: this.audioCache.size,
      cacheSize,
      placeholderCount: this.placeholderCache.size,
      loadingCount: this.loadingPromises.size,
    };
  }

  /**
   * Load audio asset with caching
   */
  private async loadAudioAsset(soundId: string): Promise<ArrayBuffer | null> {
    // Check cache first
    if (this.audioCache.has(soundId)) {
      return this.audioCache.get(soundId) || null;
    }

    // Check if already loading
    if (this.loadingPromises.has(soundId)) {
      return await this.loadingPromises.get(soundId) || null;
    }

    // Start loading
    const loadPromise = this.fetchAudioData(soundId);
    this.loadingPromises.set(soundId, loadPromise);

    try {
      const audioData = await loadPromise;
      if (audioData) {
        // Add to cache
        this.audioCache.set(soundId, audioData);
        
        // Check cache size and cleanup if needed
        await this.cleanupCacheIfNeeded();
      }
      
      return audioData;
    } finally {
      this.loadingPromises.delete(soundId);
    }
  }

  /**
   * Fetch audio data from server
   */
  private async fetchAudioData(soundId: string): Promise<ArrayBuffer | null> {
    // Try manifest first
    if (this.manifest && this.manifest[soundId]) {
      const url = `${this.basePath}${this.manifest[soundId]}`;
      const data = await this.tryFetchUrl(url);
      if (data) return data;
    }

    // Try each supported format
    for (const format of this.supportedFormats) {
      const url = `${this.basePath}${soundId}.${format}`;
      const data = await this.tryFetchUrl(url);
      if (data) return data;
    }

    if (this.debug) {
      console.log(`[ENEMY_AUDIO_MANAGER] No audio file found for ${soundId}`);
    }
    return null;
  }

  /**
   * Try to fetch from URL
   */
  private async tryFetchUrl(url: string): Promise<ArrayBuffer | null> {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.arrayBuffer();
      }
    } catch (error) {
      // Silently handle fetch errors
    }
    return null;
  }

  /**
   * Create placeholder audio buffer
   */
  private createPlaceholderBuffer(soundId: string, audioContext: AudioContext): AudioBuffer | null {
    // Check placeholder cache
    if (this.placeholderCache.has(soundId)) {
      return this.placeholderCache.get(soundId) || null;
    }

    try {
      const duration = this.getPlaceholderDuration(soundId);
      const sampleRate = audioContext.sampleRate;
      const length = Math.floor(duration * sampleRate);
      
      const buffer = audioContext.createBuffer(1, length, sampleRate);
      const channelData = buffer.getChannelData(0);

      // Generate sound based on sound ID
      this.generatePlaceholderAudio(channelData, soundId, sampleRate);
      
      // Cache placeholder
      this.placeholderCache.set(soundId, buffer);
      
      return buffer;
    } catch (error) {
      console.warn(`[ENEMY_AUDIO_MANAGER] Failed to create placeholder for ${soundId}:`, error);
      return null;
    }
  }

  /**
   * Create placeholder Babylon.js Sound
   */
  private createPlaceholderSound(
    soundId: string,
    scene: Scene,
    options: any
  ): Sound | null {
    try {
      // Create a data URL with generated audio
      const audioData = this.generatePlaceholderAudioData(soundId);
      const blob = new Blob([audioData], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      return new Sound(
        `placeholder_${soundId}_${Date.now()}`,
        url,
        scene,
        () => {
          // Clean up object URL when sound is ready
          URL.revokeObjectURL(url);
        },
        {
          loop: false,
          autoplay: false,
          spatialSound: options.spatialSound ?? true,
          maxDistance: options.maxDistance ?? 100,
          rolloffFactor: options.rolloffFactor ?? 1.0,
          volume: options.volume ?? 1.0,
        }
      );
    } catch (error) {
      console.warn(`[ENEMY_AUDIO_MANAGER] Failed to create placeholder sound ${soundId}:`, error);
      return null;
    }
  }

  /**
   * Generate placeholder audio data as WAV
   */
  private generatePlaceholderAudioData(soundId: string): ArrayBuffer {
    const sampleRate = 44100;
    const duration = this.getPlaceholderDuration(soundId);
    const length = Math.floor(duration * sampleRate);
    
    // Create WAV file
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);

    // Generate audio samples
    const audioData = new Float32Array(length);
    this.generatePlaceholderAudio(audioData, soundId, sampleRate);
    
    // Convert to 16-bit PCM
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, audioData[i]));
      view.setInt16(44 + i * 2, sample * 0x7FFF, true);
    }

    return buffer;
  }

  /**
   * Generate placeholder audio samples
   */
  private generatePlaceholderAudio(
    channelData: Float32Array, 
    soundId: string, 
    sampleRate: number
  ): void {
    const length = channelData.length;
    
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let sample = 0;

      if (soundId.includes('roar') || soundId.includes('scream')) {
        // Low growl with noise
        sample = Math.sin(t * 150 * Math.PI * 2) * Math.exp(-t * 2);
        sample += (Math.random() - 0.5) * 0.3 * Math.exp(-t * 3);
      } else if (soundId.includes('grunt') || soundId.includes('pain')) {
        // Short percussive sound
        sample = Math.sin(t * 200 * Math.PI * 2) * Math.exp(-t * 5);
      } else if (soundId.includes('footstep')) {
        // Rhythmic thud
        const freq = 80 + Math.sin(t * 8) * 20;
        sample = Math.sin(t * freq * Math.PI * 2) * Math.exp(-t * 3);
      } else if (soundId.includes('breathing') || soundId.includes('ambient')) {
        // Soft ambient sound
        sample = Math.sin(t * 100 * Math.PI * 2) * Math.exp(-t * 0.5) * 0.3;
      } else {
        // Default beep
        sample = Math.sin(t * 440 * Math.PI * 2) * Math.exp(-t * 2);
      }

      channelData[i] = sample * 0.5; // Reduce volume
    }
  }

  /**
   * Get duration for placeholder sound based on type
   */
  private getPlaceholderDuration(soundId: string): number {
    if (soundId.includes('death')) return 3.0;
    if (soundId.includes('scream')) return 2.0;
    if (soundId.includes('roar')) return 1.5;
    if (soundId.includes('footstep')) return 0.3;
    if (soundId.includes('breathing')) return 4.0;
    if (soundId.includes('ambient')) return 5.0;
    return 1.0;
  }

  /**
   * Get all sound IDs for enemy type
   */
  private getEnemySoundIds(enemyType: EnemyType): string[] {
    const config = this.getDefaultAudioConfig(enemyType);
    const soundIds: string[] = [];
    
    for (const stateConfig of Object.values(config)) {
      soundIds.push(...stateConfig.samples);
    }
    
    return [...new Set(soundIds)]; // Remove duplicates
  }

  /**
   * Apply enemy type specific modifications to audio config
   */
  private applyEnemyTypeModifications(
    baseConfig: Record<EnemyState, AudioStateConfig>,
    enemyType: EnemyType
  ): Record<EnemyState, AudioStateConfig> {
    const config = JSON.parse(JSON.stringify(baseConfig)); // Deep copy

    switch (enemyType) {
      case EnemyType.WEAK_IMP:
        // Weaker, quieter sounds
        Object.values(config).forEach(stateConfig => {
          stateConfig.volume *= 0.7;
          stateConfig.pitch *= 1.1;
          stateConfig.maxDistance *= 0.8;
        });
        break;

      case EnemyType.TOUGH_IMP:
        // Stronger, deeper sounds
        Object.values(config).forEach(stateConfig => {
          stateConfig.volume *= 1.3;
          stateConfig.pitch *= 0.9;
          stateConfig.maxDistance *= 1.2;
        });
        break;

      case EnemyType.ALPHA_IMP:
        // Boss-like, powerful sounds
        Object.values(config).forEach(stateConfig => {
          stateConfig.volume *= 1.5;
          stateConfig.pitch *= 0.8;
          stateConfig.maxDistance *= 1.5;
          stateConfig.rolloffFactor *= 0.7;
        });
        break;

      case EnemyType.IMP:
      default:
        // Standard imp - no modifications needed
        break;
    }

    return config;
  }

  /**
   * Resolve audio URL for sound ID
   */
  private async resolveAudioUrl(soundId: string): Promise<string | null> {
    // Check manifest first
    if (this.manifest && this.manifest[soundId]) {
      return `${this.basePath}${this.manifest[soundId]}`;
    }

    // Try to find file with supported formats
    for (const format of this.supportedFormats) {
      const url = `${this.basePath}${soundId}.${format}`;
      // Simple check - in production you might want to verify file exists
      return url;
    }

    return null;
  }

  /**
   * Load manifest file
   */
  private async ensureManifest(): Promise<void> {
    if (this.manifest !== null) return;

    try {
      const response = await fetch(`${this.basePath}manifest.json`);
      if (response.ok) {
        this.manifest = await response.json();
        if (this.debug) {
          console.log('[ENEMY_AUDIO_MANAGER] Loaded audio manifest');
        }
      } else {
        this.manifest = {};
      }
    } catch (error) {
      this.manifest = {};
      if (this.debug) {
        console.log('[ENEMY_AUDIO_MANAGER] No manifest found, using fallback strategy');
      }
    }
  }

  /**
   * Cleanup cache if it exceeds size limit
   */
  private async cleanupCacheIfNeeded(): Promise<void> {
    const stats = this.getCacheStats();
    if (stats.cacheSize > this.maxCacheSize) {
      // Remove oldest entries (simple LRU-like strategy)
      const entries = Array.from(this.audioCache.entries());
      const toRemove = Math.floor(entries.length * 0.3); // Remove 30%
      
      for (let i = 0; i < toRemove; i++) {
        this.audioCache.delete(entries[i][0]);
      }

      if (this.debug) {
        console.log(`[ENEMY_AUDIO_MANAGER] Cleaned up ${toRemove} cached entries`);
      }
    }
  }
}