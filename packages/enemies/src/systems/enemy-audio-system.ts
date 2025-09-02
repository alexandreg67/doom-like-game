import { type Scene, Sound, Vector3 } from '@babylonjs/core';
import type { Entity, System, Transform } from '@doom-like/game-logic';
import type {
  EnemyAudioComponent,
  EnemyIdentityComponent,
  EnemyStateComponent,
} from '../components';
import { EnemyAudioUtils } from '../components/enemy-audio-component';
import type {
  AudioStateConfig,
  EnemyAudioEventData,
  EnemyAudioStats,
  EnemyEvent,
  EnemyState,
  EnemyType,
} from '../types/enemy-types';

/**
 * EnemyAudioSystem - Manages 3D spatial audio for enemies
 *
 * Responsibilities:
 * - Process audio events from FSM state changes
 * - Manage 3D positioning of audio sources
 * - Handle audio asset loading and pooling
 * - Provide performance metrics and debug info
 * - Integrate with Babylon.js Scene for audio context
 */
export class EnemyAudioSystem implements System {
  private scene: Scene;
  private eventQueue: EnemyEvent[] = [];
  private listenerPosition: Vector3 = new Vector3(0, 0, 0);
  private audioPool: Map<string, Sound[]> = new Map();
  private masterVolume = 1.0;
  private enabled = true;
  private debug = false;
  private stats: EnemyAudioStats;

  // Performance tracking
  private lastUpdateTime = 0;
  private updateTimes: number[] = [];
  private maxPoolSize = 10;
  private maxDistance = 150; // Maximum audio distance

  constructor(scene: Scene, options?: { debug?: boolean; masterVolume?: number }) {
    this.scene = scene;
    this.debug = options?.debug ?? false;
    this.masterVolume = options?.masterVolume ?? 1.0;

    this.stats = {
      activeAudioSources: 0,
      audioSourcesByType: {} as Record<EnemyType, number>,
      audioSourcesByState: {} as Record<EnemyState, number>,
      avgAudioUpdateTime: 0,
      audioPoolMemoryUsage: 0,
    };

    if (this.debug) {
      console.log('[ENEMY_AUDIO] System initialized with debug mode enabled');
    }
  }

  /**
   * Update all enemy audio components
   */
  update(entities: Entity[], deltaTime: number): void {
    const startTime = performance.now();

    if (!this.enabled) return;

    // Process event queue first
    this.processEventQueue();

    // Update all enemy audio components
    for (const entity of entities) {
      if (this.isEnemyWithAudio(entity)) {
        this.updateEnemyAudio(entity, deltaTime);
      }
    }

    // Update performance stats
    const updateTime = performance.now() - startTime;
    this.updatePerformanceStats(updateTime);

    // Cleanup old sounds periodically
    if (performance.now() - this.lastUpdateTime > 5000) {
      // Every 5 seconds
      this.cleanupAudioPool();
      this.lastUpdateTime = performance.now();
    }
  }

  /**
   * Queue an enemy audio event for processing
   */
  queueEvent(event: EnemyEvent): void {
    this.eventQueue.push(event);

    if (this.debug) {
      console.log(`[ENEMY_AUDIO] Queued event: ${event.type} for enemy ${event.enemyId}`);
    }
  }

  /**
   * Update listener position (usually player position)
   */
  updateListenerPosition(position: Vector3): void {
    this.listenerPosition.copyFrom(position);
  }

  /**
   * Set master volume for all enemy audio
   */
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Enable/disable enemy audio system
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      // Stop all active sounds when disabled
      this.stopAllAudio();
    }
  }

  /**
   * Get current system statistics
   */
  getStats(): EnemyAudioStats {
    return { ...this.stats };
  }

  /**
   * Stop all audio and cleanup resources
   */
  dispose(): void {
    this.stopAllAudio();
    this.cleanupAudioPool();
    this.eventQueue.length = 0;

    if (this.debug) {
      console.log('[ENEMY_AUDIO] System disposed');
    }
  }

  /**
   * Check if entity has audio component
   */
  private isEnemyWithAudio(entity: Entity): boolean {
    return (
      entity.components.has('enemyIdentity') &&
      entity.components.has('enemyAudio') &&
      entity.components.has('transform')
    );
  }

  /**
   * Update individual enemy audio
   */
  private updateEnemyAudio(entity: Entity, deltaTime: number): void {
    const identity = entity.components.get('enemyIdentity') as EnemyIdentityComponent;
    const audioComponent = entity.components.get('enemyAudio') as EnemyAudioComponent;
    const transform = entity.components.get('transform') as Transform;

    if (!identity?.isAlive || !audioComponent || !transform) return;

    // Calculate distance to listener
    const enemyPosition = new Vector3(transform.x, transform.y, transform.z);
    const distance = Vector3.Distance(enemyPosition, this.listenerPosition);

    // Get current state from state component if available
    const stateComponent = entity.components.get('enemyState') as EnemyStateComponent | undefined;
    const currentState = stateComponent?.currentState || audioComponent.currentAudioState;

    // Update audio component
    EnemyAudioUtils.updateComponent(
      audioComponent,
      currentState,
      enemyPosition,
      distance,
      deltaTime
    );

    // Update 3D position for all active sounds
    this.updateAudioPositions(audioComponent, enemyPosition);
  }

  /**
   * Process queued events
   */
  private processEventQueue(): void {
    for (const event of this.eventQueue) {
      this.processEvent(event);
    }
    this.eventQueue.length = 0; // Clear queue
  }

  /**
   * Process individual audio event
   */
  private processEvent(event: EnemyEvent): void {
    if (event.type === 'state_changed' || event.type === 'audio_state_changed') {
      this.handleStateChangeEvent(event);
    } else if (event.type === 'audio_triggered') {
      this.handleAudioTriggerEvent(event);
    }
  }

  /**
   * Handle FSM state change events
   */
  private handleStateChangeEvent(event: EnemyEvent): void {
    const audioEventData = event.data as EnemyAudioEventData;
    if (!audioEventData) return;

    // Find entity and trigger appropriate audio
    const entity = this.findEntityById(event.enemyId);
    if (!entity) return;

    const audioComponent = entity.components.get('enemyAudio') as EnemyAudioComponent;
    if (!audioComponent) return;

    const currentTime = performance.now();
    const newState = audioEventData.currentState;

    // Check if we can trigger audio for this state
    if (EnemyAudioUtils.canTriggerAudio(audioComponent, newState, currentTime)) {
      this.triggerStateAudio(
        audioComponent,
        newState,
        audioEventData.position,
        audioEventData.intensity || 1.0
      );

      EnemyAudioUtils.markAudioTriggered(audioComponent, newState, currentTime);
    }
  }

  /**
   * Handle direct audio trigger events
   */
  private handleAudioTriggerEvent(event: EnemyEvent): void {
    const audioEventData = event.data as EnemyAudioEventData;
    if (!audioEventData || !audioEventData.audioId) return;

    // Custom audio trigger logic here
    if (this.debug) {
      console.log(`[ENEMY_AUDIO] Custom audio trigger: ${audioEventData.audioId}`);
    }
  }

  /**
   * Trigger audio for specific state
   */
  private triggerStateAudio(
    audioComponent: EnemyAudioComponent,
    state: EnemyState,
    position: Vector3,
    intensity: number
  ): void {
    const config = EnemyAudioUtils.getAudioConfig(audioComponent, state);
    const sampleName = this.selectRandomSample(config.samples);

    if (!sampleName) return;

    // Create or reuse sound from pool
    const sound = this.createOrReuseSound(sampleName, audioComponent.enemyType);
    if (!sound) return;

    // Configure sound properties
    this.configureSpatialSound(sound, config, position, intensity * audioComponent.masterVolume);

    // Track active sound
    const soundId = this.generateSoundId();
    EnemyAudioUtils.addActiveSound(audioComponent, soundId, sound);

    // Play sound
    sound.play();

    // Setup cleanup when sound ends
    sound.onEndedObservable.addOnce(() => {
      EnemyAudioUtils.removeActiveSound(audioComponent, soundId);
      this.returnSoundToPool(sampleName, audioComponent.enemyType, sound);
    });

    if (this.debug) {
      console.log(
        `[ENEMY_AUDIO] Triggered ${sampleName} for state ${state} at intensity ${intensity}`
      );
    }
  }

  /**
   * Select random sample from configuration
   */
  private selectRandomSample(samples: string[]): string | null {
    if (samples.length === 0) return null;
    return samples[Math.floor(Math.random() * samples.length)] ?? null;
  }

  /**
   * Create new sound or reuse from pool
   */
  private createOrReuseSound(sampleName: string, enemyType: string): Sound | null {
    const poolKey = `${enemyType}_${sampleName}`;

    // Try to get from pool first
    const pool = this.audioPool.get(poolKey);
    if (pool && pool.length > 0) {
      const sound = pool.pop();
      if (sound) return sound;
    }

    // Create new sound if pool is empty
    try {
      return new Sound(
        `enemy_audio_${sampleName}_${Date.now()}`,
        `./assets/audio/enemies/${sampleName}.ogg`, // Prefer OGG for web
        this.scene,
        null,
        {
          loop: false,
          autoplay: false,
          spatialSound: true,
          maxDistance: this.maxDistance,
          rolloffFactor: 1.0,
          refDistance: 1,
        }
      );
    } catch (error) {
      console.warn(`[ENEMY_AUDIO] Failed to create sound ${sampleName}:`, error);
      return null;
    }
  }

  /**
   * Configure spatial audio properties
   */
  private configureSpatialSound(
    sound: Sound,
    config: AudioStateConfig,
    position: Vector3,
    finalVolume: number
  ): void {
    // Set 3D position
    sound.setPosition(position);

    // Set volume with master volume applied
    const volume = Math.max(0, Math.min(1, config.volume * finalVolume * this.masterVolume));
    sound.setVolume(volume);

    // Set pitch with variation
    const pitchVariation = (Math.random() - 0.5) * config.pitchVariation;
    const finalPitch = Math.max(0.5, Math.min(2.0, config.pitch + pitchVariation));
    sound.setPlaybackRate(finalPitch);

    // Set spatial properties
    try {
      sound.maxDistance = config.maxDistance;
      sound.rolloffFactor = config.rolloffFactor;
    } catch (_error) {
      // Spatial properties might not be available in all cases
    }

    // Set loop if needed
    if (config.loop) {
      sound.loop = true;
    }
  }

  /**
   * Update 3D positions for all active sounds
   */
  private updateAudioPositions(audioComponent: EnemyAudioComponent, position: Vector3): void {
    for (const sound of audioComponent.activeSounds.values()) {
      if (sound.isPlaying) {
        sound.setPosition(position);
      }
    }
  }

  /**
   * Return sound to pool for reuse
   */
  private returnSoundToPool(sampleName: string, enemyType: string, sound: Sound): void {
    const poolKey = `${enemyType}_${sampleName}`;

    // Reset sound state
    sound.stop();
    sound.setVolume(0);
    sound.loop = false;

    // Add to pool if not full
    if (!this.audioPool.has(poolKey)) {
      this.audioPool.set(poolKey, []);
    }

    const pool = this.audioPool.get(poolKey);
    if (pool && pool.length < this.maxPoolSize) {
      pool.push(sound);
    } else {
      // Pool full or doesn't exist, dispose sound
      sound.dispose();
    }
  }

  /**
   * Cleanup audio pool
   */
  private cleanupAudioPool(): void {
    let disposed = 0;

    for (const [_poolKey, pool] of this.audioPool.entries()) {
      // Keep only half the sounds in each pool to manage memory
      const keepCount = Math.floor(pool.length / 2);
      const toDispose = pool.splice(keepCount);

      for (const sound of toDispose) {
        sound.dispose();
        disposed++;
      }
    }

    if (this.debug && disposed > 0) {
      console.log(`[ENEMY_AUDIO] Cleaned up ${disposed} sounds from pool`);
    }
  }

  /**
   * Stop all audio
   */
  private stopAllAudio(): void {
    // This would require iterating through entities, but for now we handle cleanup in component utils
    if (this.debug) {
      console.log('[ENEMY_AUDIO] Stopping all audio');
    }
  }

  /**
   * Find entity by ID (helper function)
   */
  private findEntityById(_entityId: string): Entity | null {
    // This is a simplified implementation
    // In a real system, you'd have a proper entity lookup
    return null;
  }

  /**
   * Generate unique sound ID
   */
  private generateSoundId(): string {
    return `sound_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(updateTime: number): void {
    this.updateTimes.push(updateTime);

    // Keep only last 60 updates for moving average
    if (this.updateTimes.length > 60) {
      this.updateTimes.shift();
    }

    // Calculate average
    const sum = this.updateTimes.reduce((a, b) => a + b, 0);
    this.stats.avgAudioUpdateTime = sum / this.updateTimes.length;

    // Update other stats
    this.stats.audioPoolMemoryUsage = this.calculatePoolMemoryUsage();
  }

  /**
   * Estimate memory usage of audio pool
   */
  private calculatePoolMemoryUsage(): number {
    let totalSounds = 0;
    for (const pool of this.audioPool.values()) {
      totalSounds += pool.length;
    }

    // Rough estimate: 50KB per sound buffer
    return totalSounds * 50 * 1024;
  }
}
