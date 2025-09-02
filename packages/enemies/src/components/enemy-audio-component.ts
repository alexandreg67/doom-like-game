import { Vector3 } from '@babylonjs/core';
import type { Scene, Sound } from '@babylonjs/core';
import type { Component } from '@doom-like/game-logic';
import {
  type AudioStateConfig,
  type EnemyAudioStats,
  EnemyState,
  EnemyType,
} from '../types/enemy-types';

/**
 * EnemyAudioComponent - Manages 3D spatial audio for enemies
 *
 * Features:
 * - 3D positioned audio using Babylon.js Sound
 * - FSM state-based audio transitions
 * - Audio pooling for performance
 * - Volume/pitch variation
 * - LOD (Level of Detail) based on distance
 */
export interface EnemyAudioComponent extends Component {
  id: 'enemyAudio';

  /** Enemy type for audio configuration */
  enemyType: EnemyType;

  /** Current audio state (synced with FSM) */
  currentAudioState: EnemyState;

  /** Previous audio state (for transition logic) */
  previousAudioState: EnemyState | undefined;

  /** Active audio sources managed by this component */
  activeSounds: Map<string, Sound>;

  /** Audio configuration per FSM state */
  audioConfig: Record<EnemyState, AudioStateConfig>;

  /** Audio system enabled/disabled */
  isEnabled: boolean;

  /** Master volume multiplier for this enemy */
  masterVolume: number;

  /** Last audio trigger time per state (for cooldowns) */
  lastTriggerTime: Record<EnemyState, number>;

  /** Current enemy position (cached for performance) */
  cachedPosition: Vector3;

  /** Distance to player/listener (for LOD) */
  distanceToListener: number;

  /** Whether audio is currently muted due to distance */
  isDistanceMuted: boolean;
}

/**
 * EnemyAudioComponent utilities and factory functions
 */
export class EnemyAudioUtils {
  /**
   * Create a new EnemyAudioComponent with default configuration
   */
  static createComponent(enemyType: EnemyType, _scene: Scene): EnemyAudioComponent {
    const component: EnemyAudioComponent = {
      id: 'enemyAudio',
      enemyType,
      currentAudioState: EnemyState.IDLE,
      previousAudioState: undefined,
      activeSounds: new Map(),
      audioConfig: EnemyAudioUtils.createDefaultAudioConfig(enemyType),
      isEnabled: true,
      masterVolume: 1.0,
      lastTriggerTime: EnemyAudioUtils.initializeLastTriggerTime(),
      cachedPosition: new Vector3(0, 0, 0),
      distanceToListener: 0,
      isDistanceMuted: false,
    };

    return component;
  }

  /**
   * Update audio component state
   */
  static updateComponent(
    component: EnemyAudioComponent,
    newState: EnemyState,
    position: Vector3,
    distanceToListener: number,
    _deltaTime: number
  ): void {
    // Update cached values
    component.cachedPosition.copyFrom(position);
    component.distanceToListener = distanceToListener;
    component.previousAudioState = component.currentAudioState;
    component.currentAudioState = newState;

    // Update distance-based LOD
    EnemyAudioUtils.updateDistanceLOD(component);

    // Clean up finished sounds
    EnemyAudioUtils.cleanupFinishedSounds(component);
  }

  /**
   * Check if audio can be triggered for given state
   */
  static canTriggerAudio(
    component: EnemyAudioComponent,
    state: EnemyState,
    currentTime: number
  ): boolean {
    if (!component.isEnabled || component.isDistanceMuted) {
      return false;
    }

    const config = component.audioConfig[state];
    const lastTrigger = component.lastTriggerTime[state] || 0;
    const cooldownPassed = currentTime - lastTrigger >= config.cooldown * 1000;

    return cooldownPassed && Math.random() <= config.triggerChance;
  }

  /**
   * Mark audio as triggered for cooldown tracking
   */
  static markAudioTriggered(
    component: EnemyAudioComponent,
    state: EnemyState,
    currentTime: number
  ): void {
    component.lastTriggerTime[state] = currentTime;
  }

  /**
   * Get audio configuration for state
   */
  static getAudioConfig(component: EnemyAudioComponent, state: EnemyState): AudioStateConfig {
    return component.audioConfig[state];
  }

  /**
   * Add active sound to component tracking
   */
  static addActiveSound(component: EnemyAudioComponent, soundId: string, sound: Sound): void {
    component.activeSounds.set(soundId, sound);
  }

  /**
   * Remove active sound from component tracking
   */
  static removeActiveSound(component: EnemyAudioComponent, soundId: string): void {
    const sound = component.activeSounds.get(soundId);
    if (sound) {
      sound.stop();
      sound.dispose();
      component.activeSounds.delete(soundId);
    }
  }

  /**
   * Stop all active sounds for this component
   */
  static stopAllSounds(component: EnemyAudioComponent): void {
    for (const [_soundId, sound] of component.activeSounds.entries()) {
      sound.stop();
      sound.dispose();
    }
    component.activeSounds.clear();
  }

  /**
   * Get component statistics
   */
  static getComponentStats(component: EnemyAudioComponent): Partial<EnemyAudioStats> {
    return {
      activeAudioSources: component.activeSounds.size,
      audioSourcesByType: { [component.enemyType]: component.activeSounds.size } as Record<
        EnemyType,
        number
      >,
      audioSourcesByState: { [component.currentAudioState]: component.activeSounds.size } as Record<
        EnemyState,
        number
      >,
    };
  }

  /**
   * Create default audio configuration per enemy type
   */
  private static createDefaultAudioConfig(
    enemyType: EnemyType
  ): Record<EnemyState, AudioStateConfig> {
    // Base configuration
    const baseConfig: Record<EnemyState, AudioStateConfig> = {
      [EnemyState.IDLE]: {
        samples: [`${enemyType}_idle_01`, `${enemyType}_ambient_01`],
        volume: 0.3,
        pitch: 1.0,
        pitchVariation: 0.1,
        maxDistance: 30,
        rolloffFactor: 1.0,
        loop: true,
        triggerChance: 0.2,
        cooldown: 5.0,
      },
      [EnemyState.SEEKING]: {
        samples: [`${enemyType}_seek_01`, `${enemyType}_footstep_01`],
        volume: 0.5,
        pitch: 1.0,
        pitchVariation: 0.15,
        maxDistance: 40,
        rolloffFactor: 1.2,
        loop: false,
        triggerChance: 0.6,
        cooldown: 2.0,
      },
      [EnemyState.CHASE]: {
        samples: [`${enemyType}_chase_01`, `${enemyType}_aggressive_01`],
        volume: 0.7,
        pitch: 1.1,
        pitchVariation: 0.2,
        maxDistance: 60,
        rolloffFactor: 1.0,
        loop: false,
        triggerChance: 0.8,
        cooldown: 1.0,
      },
      [EnemyState.ATTACK]: {
        samples: [`${enemyType}_attack_01`, `${enemyType}_attack_grunt_01`],
        volume: 0.9,
        pitch: 1.2,
        pitchVariation: 0.3,
        maxDistance: 80,
        rolloffFactor: 0.8,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.5,
      },
      [EnemyState.HURT]: {
        samples: [`${enemyType}_hurt_01`, `${enemyType}_pain_01`],
        volume: 0.8,
        pitch: 1.3,
        pitchVariation: 0.4,
        maxDistance: 70,
        rolloffFactor: 1.0,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.2,
      },
      [EnemyState.DEATH]: {
        samples: [`${enemyType}_death_01`, `${enemyType}_death_scream_01`],
        volume: 1.0,
        pitch: 0.9,
        pitchVariation: 0.2,
        maxDistance: 100,
        rolloffFactor: 0.6,
        loop: false,
        triggerChance: 1.0,
        cooldown: 0.0,
      },
    };

    // Enemy type specific adjustments
    switch (enemyType) {
      case EnemyType.IMP:
        // Standard imp - no changes
        break;
      case EnemyType.WEAK_IMP:
        // Weaker sounds for weak imp
        for (const config of Object.values(baseConfig)) {
          config.volume *= 0.7;
          config.pitch *= 0.9;
          config.maxDistance *= 0.8;
        }
        break;
      case EnemyType.TOUGH_IMP:
        // Stronger sounds for tough imp
        for (const config of Object.values(baseConfig)) {
          config.volume *= 1.2;
          config.pitch *= 0.95;
          config.maxDistance *= 1.2;
        }
        break;
      case EnemyType.ALPHA_IMP:
        // Boss-like sounds for alpha imp
        for (const config of Object.values(baseConfig)) {
          config.volume *= 1.5;
          config.pitch *= 0.8;
          config.maxDistance *= 1.5;
          config.rolloffFactor *= 0.8;
        }
        break;
    }

    return baseConfig;
  }

  /**
   * Initialize last trigger time tracking
   */
  private static initializeLastTriggerTime(): Record<EnemyState, number> {
    return {
      [EnemyState.IDLE]: 0,
      [EnemyState.SEEKING]: 0,
      [EnemyState.CHASE]: 0,
      [EnemyState.ATTACK]: 0,
      [EnemyState.HURT]: 0,
      [EnemyState.DEATH]: 0,
    };
  }

  /**
   * Update distance-based Level of Detail
   */
  private static updateDistanceLOD(component: EnemyAudioComponent): void {
    const maxAudibleDistance = 150; // Beyond this, no audio is played

    if (component.distanceToListener > maxAudibleDistance) {
      component.isDistanceMuted = true;
      // Stop all sounds if too far
      EnemyAudioUtils.stopAllSounds(component);
    } else {
      component.isDistanceMuted = false;
      // Adjust volume based on distance (additional to Babylon.js spatial audio)
      const distanceFactor = Math.max(0, 1 - component.distanceToListener / maxAudibleDistance);
      component.masterVolume = distanceFactor;
    }
  }

  /**
   * Clean up sounds that have finished playing
   */
  private static cleanupFinishedSounds(component: EnemyAudioComponent): void {
    const soundsToRemove: string[] = [];

    for (const [soundId, sound] of component.activeSounds.entries()) {
      if (!sound.isPlaying) {
        soundsToRemove.push(soundId);
      }
    }

    for (const soundId of soundsToRemove) {
      EnemyAudioUtils.removeActiveSound(component, soundId);
    }
  }
}
